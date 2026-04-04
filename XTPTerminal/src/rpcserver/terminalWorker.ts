import { parentPort, workerData } from 'worker_threads';
import * as zmq from 'zeromq';

/**
 * 终端Worker
 * 每个终端对应一个Worker，负责处理终端命令的并发执行
 * 通过IPC与主线程通信，请求主线程执行实际的终端操作
 */

interface WorkerData {
    terminalName: string;
    workerIdentity: string;
    instanceId: string;
}

interface CommandMessage {
    clientId: string;
    method: string;
    target: string;
    commands?: string[] | string;
    search?: string;
    timeout?: number;
    nonewline?: boolean;
    count?: number;
}

interface IPCMessage {
    type: 'terminalOperation';
    terminalName: string;
    operation: string;
    params: any;
    callbackId: string;
}

// 获取Worker数据
const { terminalName, workerIdentity, instanceId } = workerData as WorkerData;

// 连接到后端Dealer
const dealer = new zmq.Dealer();
dealer.routingId = workerIdentity;

// 回调映射表
const callbacks = new Map<string, (error: Error | null, result: any) => void>();

// 标记Worker是否应该退出
let shouldExit = false;

// 处理来自主线程的IPC消息
if (parentPort) {
    parentPort.on('message', (message: any) => {
        if (message.type === 'terminalOperationResult') {
            const { callbackId, error, result } = message;
            const callback = callbacks.get(callbackId);
            if (callback) {
                callback(error, result);
                callbacks.delete(callbackId);
            }
        } else if (message.type === 'exit') {
            // 收到退出命令
            shouldExit = true;
            // 关闭Dealer套接字
            try {
                dealer.close();
            } catch (error) {
                console.error('Error closing dealer socket:', error);
            }
        }
    });
    
    // 监听主线程断开连接
    parentPort.on('close', () => {
        shouldExit = true;
        // 关闭Dealer套接字
        try {
            dealer.close();
        } catch (error) {
            console.error('Error closing dealer socket:', error);
        }
    });
}

async function startWorker(): Promise<void> {
    try {
        // 连接到主Worker的后端Dealer
        await dealer.connect('inproc://workers');
        console.log(`Terminal worker ${workerIdentity} connected to backend`);

        // 处理来自主Worker的命令
        try {
            const dealerIterator = dealer[Symbol.asyncIterator]();
            
            while (!shouldExit) {
                // 等待消息，但定期检查shouldExit标志
                const messagePromise = dealerIterator.next();
                
                // 创建一个可取消的promise，用于定期检查shouldExit
                let checkInterval: NodeJS.Timeout;
                const checkPromise = new Promise<{ done: boolean, value: any }>((resolve) => {
                    checkInterval = setInterval(() => {
                        if (shouldExit) {
                            resolve({ done: true, value: undefined });
                        }
                    }, 100);
                });
                
                // 使用Promise.race等待消息或shouldExit
                const result = await Promise.race([messagePromise, checkPromise]);
                
                // 清除interval
                clearInterval(checkInterval!);
                
                if (result.done || shouldExit) {
                    break;
                }
                
                const [message] = result.value;
                
                try {
                    const request: CommandMessage = JSON.parse(message.toString());
                    console.log(`Worker ${workerIdentity} received command:`, request.method);

                    // 处理命令（通过IPC请求主线程执行终端操作）
                    const response = await handleCommand(request);

                    // 发送响应回主Worker
                    const responseMessage = JSON.stringify({
                        clientId: request.clientId,
                        ...response
                    });
                    await dealer.send(responseMessage);

                } catch (error) {
                    console.error(`Worker ${workerIdentity} error:`, error);
                    
                    // 发送错误响应
                    try {
                        const errorResponse = JSON.stringify({
                            clientId: JSON.parse(message.toString()).clientId,
                            success: false,
                            error: (error as Error).message
                        });
                        await dealer.send(errorResponse);
                    } catch (parseError) {
                        console.error(`Error parsing message:`, parseError);
                    }
                }
            }
        } catch (error) {
            console.error(`Error in message loop:`, error);
        }
        
        // 退出前清理
        console.log(`Worker ${workerIdentity} exited`);
        
    } catch (error) {
        console.error(`Worker ${workerIdentity} failed to start:`, error);
    } finally {
        // 确保关闭Dealer套接字
        try {
            await dealer.close();
            console.log(`Worker ${workerIdentity} dealer socket closed`);
        } catch (error) {
            console.error(`Error closing dealer socket:`, error);
        }
    }
}

/**
 * 处理命令
 * 通过IPC与主线程通信，请求执行实际的终端操作
 */
async function handleCommand(request: CommandMessage): Promise<any> {
    const { method } = request;

    switch (method) {
        case 'send':
            const { commands, search, timeout, nonewline } = request;
            return await sendToTerminal('send', { commands, search, timeout, nonewline });
        
        case 'get_buffer':
            const { count } = request;
            return await sendToTerminal('get_buffer', { count });
        
        case 'clear':
            return await sendToTerminal('clear_buffer', {});
        
        case 'set_user_mark':
            return await sendToTerminal('set_user_mark', {});
        
        case 'get_mark_content':
            return await sendToTerminal('get_mark_content', {});
        
        default:
            throw new Error(`Unknown command: ${method}`);
    }
}

/**
 * 通过IPC发送终端操作请求到主线程
 */
async function sendToTerminal(operation: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!parentPort) {
            return reject(new Error('Parent port not available'));
        }

        const callbackId = `${workerIdentity}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // 存储回调
        callbacks.set(callbackId, (error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });

        // 发送IPC消息到主线程
        const ipcMessage: IPCMessage = {
            type: 'terminalOperation',
            terminalName,
            operation,
            params,
            callbackId
        };

        parentPort.postMessage(ipcMessage);
    });
}

// 启动Worker
startWorker().catch(error => {
    console.error('Failed to start worker:', error);
    // 不要调用process.exit(1)，这会导致VS Code崩溃
    // 而是通过parentPort发送错误信息给主线程
    if (parentPort) {
        parentPort.postMessage({ 
            type: 'error', 
            message: 'Worker startup failed', 
            error: error.message 
        });
    }
});

// 处理Worker退出信号
process.on('exit', () => {
    try {
        // 关闭Dealer套接字
        if (dealer) {
            dealer.close();
            console.log('Dealer socket closed');
        }
    } catch (error) {
        console.error('Error closing dealer socket:', error);
    }
});

// 处理Worker中断信号
process.on('SIGINT', () => {
    try {
        // 关闭Dealer套接字
        if (dealer) {
            dealer.close();
            console.log('Dealer socket closed on SIGINT');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error closing dealer socket on SIGINT:', error);
        process.exit(1);
    }
});

// 处理Worker终止信号
process.on('SIGTERM', () => {
    try {
        // 关闭Dealer套接字
        if (dealer) {
            dealer.close();
            console.log('Dealer socket closed on SIGTERM');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error closing dealer socket on SIGTERM:', error);
        process.exit(1);
    }
});