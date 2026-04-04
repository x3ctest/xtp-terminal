import * as zmq from 'zeromq';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Worker } from 'worker_threads';
import { InstanceIdManager } from './instanceIdManager';
import { terminalManager } from '../terminal/terminalManager';
import { ITerminalConfiguration } from '../terminal/VtyTerminal';

/**
 * 终端Worker信息
 */
interface TerminalWorkerInfo {
    id: string;
    name: string;
    worker: Worker;
    identity: string;
    isConnected: boolean;
    buffer: string;
}

/**
 * 错误处理工具类
 */
class ErrorHandler {
    static handleNetworkError(error: Error): void {
        console.error('Network error:', error);
    }
    
    static handleMessageError(error: Error): void {
        console.error('Message error:', error);
    }
    
    static handleCommandError(error: Error): void {
        console.error('Command error:', error);
    }
    
    static createErrorResponse(errorType: string, message: string): any {
        return {
            error: {
                type: errorType,
                message: message,
                timestamp: new Date().toISOString()
            }
        };
    }
}

/**
 * ZMQ Router服务
 * 架构：
 * - 一个主Worker处理终端的打开和关闭操作
 * - 每个终端基于其名称绑定到唯一的Worker
 */
export class ZmqRouterServiceImpl {
    private static instance: ZmqRouterServiceImpl;
    
    // 前端Router套接字（接收客户端请求）
    private frontend: zmq.Router | null = null;
    
    // 后端Dealer套接字（与终端Worker通信）
    private backend: zmq.Dealer | null = null;
    
    // 终端Worker映射表（终端名称 -> Worker信息）
    private terminalWorkers: Map<string, TerminalWorkerInfo> = new Map();
    
    // Worker身份到终端名称的映射
    private workerToTerminal: Map<string, string> = new Map();
    
    // 实例信息
    private instanceId: string;
    private address: string = '';
    private isRunning: boolean = false;
    private abortController: AbortController;

    private constructor() {
        this.instanceId = InstanceIdManager.getInstance().getInstanceId();
        this.abortController = new AbortController();
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): ZmqRouterServiceImpl {
        if (!ZmqRouterServiceImpl.instance) {
            ZmqRouterServiceImpl.instance = new ZmqRouterServiceImpl();
        }
        return ZmqRouterServiceImpl.instance;
    }

    /**
     * 启动ZMQ Router服务
     */
    public async start(): Promise<boolean> {
        try {
            if (this.isRunning) {
                console.log('ZMQ Router service is already running');
                return true;
            }

            // 创建前端Router套接字（接收客户端请求）
            this.frontend = new zmq.Router();
            
            // 绑定到可用的TCP端口
            const tcpAddress = await this.bindToAvailableTcpPort();
            if (tcpAddress) {
                this.address = tcpAddress;
                console.log(`ZMQ Router service started on TCP: ${this.address}`);
            } else {
                console.error('Failed to start ZMQ Router service: No available TCP port found');
                return false;
            }

            // 创建后端Dealer套接字（与终端Worker通信）
            this.backend = new zmq.Dealer();
            await this.backend.bind('inproc://workers');
            console.log('Backend bound to inproc://workers');

            this.isRunning = true;
            
            // 存储实例信息到临时文件
            this.storeInstanceInfo();
            
            // 启动消息处理循环
            this.processMessages();
            
            return true;
        } catch (error) {
            ErrorHandler.handleNetworkError(error as Error);
            return false;
        }
    }

    /**
     * 绑定到可用的TCP端口
     */
    private async bindToAvailableTcpPort(): Promise<string | null> {
        if (!this.frontend) return null;
        
        // 尝试端口范围：8888-9999
        for (let port = 8501; port <= 8629; port++) {
            const address = `tcp://127.0.0.1:${port}`;
            try {
                await this.frontend.bind(address);
                return address;
            } catch (error) {
                // 端口被占用，尝试下一个
                console.log(`Port ${port} is occupied, trying next...`);
                continue;
            }
        }
        
        // 没有找到可用端口
        console.error('No available TCP port found in range 8888-9999');
        return null;
    }

    /**
     * 停止ZMQ Router服务
     */
    public async stop(): Promise<void> {
        try {
            this.abortController.abort();
            
            // 关闭所有终端Worker
            for (const [name, workerInfo] of this.terminalWorkers) {
                console.log(`Closing terminal worker: ${name}`);
                workerInfo.worker.terminate();
            }
            this.terminalWorkers.clear();
            this.workerToTerminal.clear();
            
            // 关闭后端Dealer
            if (this.backend) {
                await this.backend.close();
                this.backend = null;
            }
            
            // 关闭前端Router
            if (this.frontend) {
                await this.frontend.close();
                this.frontend = null;
            }
            
            // 删除临时目录下以当前instanceId命名的子目录
            try {
                const tempDir = os.tmpdir();
                const instanceDir = path.join(tempDir, this.instanceId);
                if (fs.existsSync(instanceDir)) {
                    console.log(`Deleting temporary directory: ${instanceDir}`);
                    // 递归删除目录
                    fs.rmSync(instanceDir, { recursive: true, force: true });
                    console.log(`Temporary directory ${instanceDir} deleted`);
                }
            } catch (err) {
                console.error('Error deleting temporary directory:', err);
            }
            
            this.isRunning = false;
            console.log('ZMQ Router service stopped');
        } catch (error) {
            ErrorHandler.handleNetworkError(error as Error);
        }
    }

    /**
     * 获取服务地址
     */
    public getAddress(): string {
        return this.address;
    }

    /**
     * 获取实例ID
     */
    public getInstanceId(): string {
        return this.instanceId;
    }

    /**
     * 存储实例信息到临时文件
     */
    private storeInstanceInfo(): void {
        try {
            const tempDir = path.join(os.tmpdir(), 'xtp-terminal');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // 以instance id作为名称创建子目录
            const instanceDir = path.join(tempDir, this.instanceId);
            if (!fs.existsSync(instanceDir)) {
                fs.mkdirSync(instanceDir, { recursive: true });
            }
            
            // 在子目录中保存address信息
            const addressFile = path.join(instanceDir, 'address.txt');
            fs.writeFileSync(addressFile, this.address);
            
            process.env.XTP_TERMINAL_INSTANCE_ID = this.instanceId;
            process.env.XTP_TERMINAL_ADDRESS = this.address;
            
            console.log(`Instance info stored: ID=${this.instanceId}, Address=${this.address}`);
        } catch (error) {
            console.error('Failed to store instance info:', error);
        }
    }

    /**
     * 处理消息循环
     */
    private async processMessages(): Promise<void> {
        if (!this.frontend || !this.backend) return;
        
        // 前端消息处理（来自客户端）
        (async () => {
            for await (const [clientId, message] of this.frontend!) {
                if (this.abortController.signal.aborted) break;
                
                try {
                    const clientIdentity = clientId.toString();
                    const requestmsg = message.toString();
                    console.log(`Received message from client ${clientIdentity}:`, requestmsg);
                    
                    // 检查message长度是否为0
                    if (requestmsg.length === 0) {
                        console.warn(`Empty message received from client ${clientIdentity}`);
                        await this.sendErrorToClient(clientIdentity, 'Empty message');
                        continue;
                    }
                    
                    const request = JSON.parse(requestmsg); 
                    // 验证实例ID
                    //if (request.instanceId !== this.instanceId) {
                    //    console.warn(`Message for instance ${request.instanceId} received by instance ${this.instanceId}`);
                    //    await this.sendErrorToClient(clientIdentity, 'Invalid instance ID');
                    //    continue;
                    //}
                    
                    // 根据消息类型处理
                    await this.handleClientRequest(clientIdentity, request);
                    
                } catch (error) {
                    ErrorHandler.handleMessageError(error as Error);
                    const clientIdentity = clientId.toString();
                    await this.sendErrorToClient(clientIdentity, (error as Error).message);
                }
            }
        })();

        // 后端消息处理（来自终端Worker）
        (async () => {
            for await (const [workerId, message] of this.backend!) {
                if (this.abortController.signal.aborted) break;
                
                try {
                    const response = JSON.parse(message.toString());
                    const { clientId, ...result } = response;
                    
                    // 将Worker响应转发给客户端
                    if (clientId) {
                        await this.sendSuccessToClient(clientId, result);
                    }
                } catch (error) {
                    ErrorHandler.handleMessageError(error as Error);
                }
            }
        })();
    }

    /**
     * 处理客户端请求
     */
    private async handleClientRequest(clientIdentity: string, request: any): Promise<void> {
        const { method, target } = request;
        
        // 检查必要参数
        if (!method || !target) {
            await this.sendErrorToClient(clientIdentity, 'Missing required parameters: method and target');
            return;
        }
        
        // open和close命令由主线程处理
        if (method === 'open') {
            // 处理打开终端命令
            const { opts } = request;
            try {
                const result = await this.handleCreateTerminal({ terminalName: target, ...opts });
                await this.sendSuccessToClient(clientIdentity, result);
            } catch (error) {
                await this.sendErrorToClient(clientIdentity, `Failed to open terminal: ${error.message}`);
            }
            return;
        } else if (method === 'close') {
            // 处理关闭终端命令
            try {
                const result = await this.handleCloseTerminal({ terminalName: target });
                await this.sendSuccessToClient(clientIdentity, result);
            } catch (error) {
                await this.sendErrorToClient(clientIdentity, `Failed to close terminal: ${error.message}`);
            }
            return;
        }
        
        // 其他命令路由到对应的终端Worker
        if (this.terminalWorkers.has(target)) {
            await this.handleTerminalCommand(clientIdentity, request);
            return;
        }
        
        // 未找到对应的终端
        await this.sendErrorToClient(clientIdentity, `Terminal not found: ${target}`);
    }

    /**
     * 处理终端命令
     * 主线程直接处理终端操作，不转发给Worker
     */
    private async handleTerminalCommand(clientIdentity: string, request: any): Promise<void> {
        const { method, target } = request;
        
        try {
            // 获取终端实例
            const terminal = terminalManager.getFromTerminalName(target);
            if (!terminal) {
                await this.sendErrorToClient(clientIdentity, `Terminal not found: ${target}`);
                return;
            }

            // 根据命令类型处理
            let response: any;
            
            switch (method) {
                case 'send':
                    const { commands, search, timeout, nonewline } = request;
                    response = await this.handleTerminalSend(terminal, { commands, search, timeout, nonewline });
                    break;
                    
                case 'get_buffer':
                    const { count } = request;
                    response = await this.handleTerminalGetBuffer(terminal, { count });
                    break;
                    
                case 'clear':
                    response = await this.handleTerminalClearBuffer(terminal);
                    break;
                    
                case 'set_user_mark':
                    // 实现设置用户标记功能
                    response = { success: true, message: 'User mark set' };
                    break;
                    
                case 'get_mark_content':
                    // 实现获取标记内容功能
                    response = { success: true, content: '' };
                    break;
                    
                default:
                    throw new Error(`Unknown terminal command: ${method}`);
            }
            
            await this.sendSuccessToClient(clientIdentity, response);
            
        } catch (error) {
            await this.sendErrorToClient(clientIdentity, (error as Error).message);
        }
    }

    // ==================== 终端命令处理实现 ====================

    /**
     * 向终端发送数据
     */
    private async handleTerminalSend(terminal: any, content: any): Promise<any> {
        const { commands, search, timeout = 1000, nonewline = false } = content;
        if (!commands) {
            throw new Error('Commands is required');
        }

        // 构建RPC请求
        const rpcRequest = {
            method: 'send',
            commands: Array.isArray(commands) ? commands : [commands],
            search: search || '',
            timeout: timeout,
            nonewline: nonewline
        };

        // 调用终端的doRpcCommand方法
        try {
            const result = await (terminal as any).doRpcCommand(JSON.stringify(rpcRequest));
            
            return {
                success: true,
                data: result,
                message: 'Data sent successfully'
            };
        } catch (error) {
            throw new Error(`Failed to send data: ${error}`);
        }
    }

    /**
     * 获取终端缓冲区内容
     */
    private async handleTerminalGetBuffer(terminal: any, content: any): Promise<any> {
        const { count = 100 } = content || {};

        // 通过RPC调用获取缓冲区
        const rpcRequest = {
            method: 'get_buffer',
            count: count
        };

        try {
            const result = await (terminal as any).doRpcCommand(JSON.stringify(rpcRequest));

            return {
                success: true,
                /*data: {
                    terminalName: (terminal as any).opts.name,
                    buffer: result,
                    totalLines: (terminal as any).contentBuffer?.getLineCount() || 0
                }*/
               data: result,
               message: 'Get buffer successfully'
            };
        } catch (error) {
            throw new Error(`Failed to get buffer: ${error}`);
        }
    }

    /**
     * 清空终端缓冲区
     */
    private async handleTerminalClearBuffer(terminal: any): Promise<any> {
        // 通过RPC调用清空缓冲区
        const rpcRequest = {
            method: 'clear'
        };

        try {
            const result = await (terminal as any).doRpcCommand(JSON.stringify(rpcRequest));

            return {
                success: true,
                data: result,
                message: 'Buffer cleared successfully'
            };
        } catch (error) {
            throw new Error(`Failed to clear buffer: ${error}`);
        }
    }

    /**
     * 获取终端状态
     */
    private handleTerminalGetStatus(terminal: any): any {
        return {
            success: true,
            data: {
                terminalName: (terminal as any).opts.name,
                isConnected: true,
                bufferLength: (terminal as any).contentBuffer?.getLineCount() || 0
            }
        };
    }


    // ==================== 管理命令处理实现 ====================

    /**
     * 创建终端
     */
    private async handleCreateTerminal(content: any): Promise<any> {
        const terminalConfig: ITerminalConfiguration = content;
        if (!terminalConfig) {
            throw new Error('Terminal configuration is required');
        }
        
        const terminalName = terminalConfig.name;
        
        // 检查终端是否已存在
        if (this.terminalWorkers.has(terminalName)) {
            return {
                success: true,
                terminalId: terminalName,
                message: `Terminal ${terminalName} already exists`
            };
        }
        
        try {
            // 使用terminalManager创建终端
            await terminalManager.showTerminal(
                terminalName, 
                terminalConfig, 
                async () => {
                    // 终端关闭时的回调
                    // 只需要调用terminalManager.remove，它会自动清理Worker
                    await terminalManager.remove(terminalName);
                }
            );
            
            // 创建终端Worker
            await this.createTerminalWorker(terminalName);
            
            return {
                success: true,
                terminalId: terminalName,
                message: 'Terminal created successfully'
            };
        } catch (error) {
            console.error('Failed to create terminal:', error);
            return {
                success: false,
                terminalId: terminalName,
                message: `Failed to create terminal: ${error}`
            };
        }
    }

    /**
     * 关闭终端
     */
    private async handleCloseTerminal(content: any): Promise<any> {
        const { id } = content;
        if (!id) {
            throw new Error('Terminal ID is required');
        }
        
        const terminalName = id;
        
        // 检查终端是否存在
        if (!this.terminalWorkers.has(terminalName)) {
            return {
                success: false,
                message: `Terminal not found: ${terminalName}`
            };
        }
        
        // 使用terminalManager关闭终端
        const terminal = terminalManager.getFromTerminalName(terminalName);
        if (terminal) {
            terminal.close();
            await terminalManager.remove(terminalName);
        } else {
            // 如果终端不存在，直接清理Worker
            await this.cleanupWorker(terminalName);
        }
        
        return {
            success: true,
            message: 'Terminal closed successfully'
        };
    }

    /**
     * 列出所有终端
     */
    private handleListTerminals(): any {
        const terminals: any[] = [];
        
        // 遍历已注册的终端Workers
        for (const [name, workerInfo] of this.terminalWorkers) {
            terminals.push({
                id: workerInfo.id,
                name: workerInfo.name,
                workerIdentity: workerInfo.identity,
                isConnected: workerInfo.isConnected
            });
        }
        
        return {
            success: true,
            data: terminals
        };
    }

    /**
     * 获取终端信息
     */
    private handleGetTerminalInfo(content: any): any {
        const { id } = content;
        if (!id) {
            throw new Error('Terminal ID is required');
        }
        
        const terminalName = id;
        const workerInfo = this.terminalWorkers.get(terminalName);
        
        if (!workerInfo) {
            throw new Error(`Terminal not found: ${terminalName}`);
        }
        
        return {
            success: true,
            data: {
                id: workerInfo.id,
                name: workerInfo.name,
                identity: workerInfo.identity,
                isConnected: workerInfo.isConnected,
                bufferLength: workerInfo.buffer.length
            }
        };
    }

    // ==================== 终端Worker管理 ====================

    /**
     * 创建终端Worker
     */
    public async createTerminalWorker(terminalName: string): Promise<void> {
        try {
            // 检查终端是否已经有Worker
            if (this.terminalWorkers.has(terminalName)) {
                console.log(`Worker for terminal ${terminalName} already exists`);
                return;
            }

            // 生成唯一的Worker身份
            const workerIdentity = `worker-${terminalName}-${Date.now()}`;

            // 获取当前文件的绝对路径
            const currentFile = __filename;
            // 获取当前目录的绝对路径
            const currentDir = path.dirname(currentFile);
            // 构建terminalWorker.js的绝对路径
            const workerPath = path.join(currentDir, 'terminalWorker.js');
            // 调试：查看路径信息
            console.log(`[DEBUG] Current file: ${currentFile}`);
            console.log(`[DEBUG] Current dir: ${currentDir}`);
            console.log(`[DEBUG] Worker path: ${workerPath}`);
            console.log(`[DEBUG] Worker path exists: ${fs.existsSync(workerPath)}`);

            // 创建Worker实例
            const worker = new Worker(workerPath, {
                workerData: {
                    terminalName,
                    workerIdentity,
                    instanceId: this.instanceId
                }
            });

            // 启动Worker
            worker.on('message', (message: any) => {
                // 处理来自Worker的IPC消息
                if (message.type === 'terminalOperation') {
                    this.handleWorkerTerminalOperation(worker, message);
                } else if (message.type === 'error') {
                    // 处理来自Worker的错误信息
                    console.error(`Worker error for terminal ${terminalName}:`, message.error);
                }
            });

            worker.on('error', (error: Error) => {
                console.error(`Worker error for terminal ${terminalName}:`, error);
                // 只有在worker还在terminalWorkers中时才清理，避免递归调用
                if (this.terminalWorkers.has(terminalName)) {
                    this.cleanupWorker(terminalName).catch(err => {
                        console.error(`Error cleaning up worker on error:`, err);
                    });
                }
            });

            worker.on('exit', (code: number) => {
                console.log(`Worker for terminal ${terminalName} exited with code:`, code);
                // 只有在worker还在terminalWorkers中时才清理，避免递归调用
                if (this.terminalWorkers.has(terminalName)) {
                    this.cleanupWorker(terminalName).catch(err => {
                        console.error(`Error cleaning up worker on exit:`, err);
                    });
                }
               //worker.terminate();
            });

            // 存储Worker信息
            const workerInfo: TerminalWorkerInfo = {
                id: terminalName,
                name: terminalName,
                worker,
                identity: workerIdentity,
                isConnected: true,
                buffer: ''
            };
            
            this.terminalWorkers.set(terminalName, workerInfo);
            this.workerToTerminal.set(workerIdentity, terminalName);

            console.log(`Created worker for terminal ${terminalName} with identity: ${workerIdentity}`);
        } catch (error) {
            console.error(`Failed to create terminal worker: ${error}`);
        }
    }

    /**
     * 处理Worker线程的终端操作请求
     */
    private async handleWorkerTerminalOperation(worker: Worker, message: any) {
        const { terminalName, operation, params, callbackId } = message;

        try {
            let result;

            // 获取终端实例
            const terminal = terminalManager.getFromTerminalName(terminalName);
            if (!terminal) {
                throw new Error(`Terminal ${terminalName} not found`);
            }

            // 根据操作类型执行不同的终端操作
            switch (operation) {
                case 'send':
                    result = await this.handleTerminalSend(terminal, params);
                    break;
                case 'get_buffer':
                    result = await this.handleTerminalGetBuffer(terminal, params);
                    break;
                case 'clear_buffer':
                    result = await this.handleTerminalClearBuffer(terminal);
                    break;
                case 'get_status':
                    result = this.handleTerminalGetStatus(terminal);
                    break;
                default:
                    throw new Error(`Unknown terminal operation: ${operation}`);
            }

            // 发送操作结果回Worker
            worker.postMessage({
                type: 'terminalOperationResult',
                callbackId,
                error: null,
                result
            });

        } catch (error) {
            console.error(`Error executing terminal operation ${operation} for ${terminalName}:`, error);

            // 发送错误信息回Worker
            worker.postMessage({
                type: 'terminalOperationResult',
                callbackId,
                error: (error as Error).message,
                result: null
            });
        }
    }

    /**
     * 清理终端Worker
     */
    public async cleanupWorker(terminalName: string): Promise<void> {
        // 检查terminalName是否有效
        if (!terminalName) {
            console.warn('Invalid terminal name provided to cleanupWorker');
            return;
        }
        
        // 检查terminalWorkers是否存在该终端
        if (!this.terminalWorkers.has(terminalName)) {
            console.log(`No worker found for terminal ${terminalName}, skipping cleanup`);
            return;
        }
        
        const workerInfo = this.terminalWorkers.get(terminalName);
        if (workerInfo) {
            // 保存worker引用
            const worker = workerInfo.worker;
            const identity = workerInfo.identity;
            
            // 向Worker发送退出命令
            if (worker) {
                try {
                    // 首先发送exit消息，让Worker优雅退出
                    worker.postMessage({ type: 'exit' });
                    console.log(`Sent exit command to worker for terminal ${terminalName}`);
                    
                    // 等待Worker退出，最多等待500毫秒
                    await new Promise<void>((resolve) => {
                        // 设置超时
                        const timeout = setTimeout(async () => {
                            console.log(`Worker cleanup timeout for terminal ${terminalName}, forcing termination`);
                            // 超时后强制终止Worker
                            try {
                                await worker.terminate();
                                console.log(`Forced worker termination for terminal ${terminalName}`);
                            } catch (error) {
                                console.error(`Error forcing worker termination:`, error);
                            }
                            resolve();
                        }, 500);
                        
                        // 监听Worker的exit事件
                        worker.once('exit', (code) => {
                            clearTimeout(timeout);
                            console.log(`Worker for terminal ${terminalName} exited with code:`, code);
                            resolve();
                        });
                    });
                } catch (error) {
                    console.error(`Error during worker cleanup:`, error);
                    // 发生错误时，尝试强制终止Worker
                    try {
                        await worker.terminate();
                        console.log(`Forced worker termination after error`);
                    } catch (terminateError) {
                        console.error(`Error forcing worker termination:`, terminateError);
                    }
                }
            }
            // 从映射中删除，避免重复清理和递归调用
            this.workerToTerminal.delete(identity);
            this.terminalWorkers.delete(terminalName);
            console.log(`Cleaned up worker info for terminal ${terminalName}`);
        }
    }

    // ==================== 响应发送方法 ====================

    /**
     * 发送成功响应给客户端
     */
    private async sendSuccessToClient(clientIdentity: string, response: any): Promise<void> {
        if (!this.frontend) return;
        
        try {
            const responseMessage = JSON.stringify({
                status: 'SUCCESS',
                data: response
            });
            
            await this.frontend.send([Buffer.from(clientIdentity), Buffer.from(responseMessage)]);
        } catch (error) {
            ErrorHandler.handleNetworkError(error as Error);
        }
    }

    /**
     * 发送错误响应给客户端
     */
    private async sendErrorToClient(clientIdentity: string, errorMessage: string): Promise<void> {
        if (!this.frontend) return;
        
        try {
            const errorResponse = ErrorHandler.createErrorResponse('command_error', errorMessage);
            const responseMessage = JSON.stringify({
                status: 'ERROR',
                error: errorResponse
            });
            
            await this.frontend.send([Buffer.from(clientIdentity), Buffer.from(responseMessage)]);
        } catch (error) {
            ErrorHandler.handleNetworkError(error as Error);
        }
    }
}