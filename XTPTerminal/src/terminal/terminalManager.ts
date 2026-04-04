import * as vscode from 'vscode';
import { VtyTerminal } from './VtyTerminal';
import { ZmqRouterServiceImpl } from '../rpcserver/zmqRouterService';
import { getTerminalViewShowEditArea } from '../settingManager';

/**
 * 终端管理器
 * 负责管理所有Vty终端实例
 */
export class TerminalManager {
    private static instance: TerminalManager;
    private terminals: Map<string, VtyTerminal> = new Map();

    private constructor() {}

    /**
     * 获取单例实例
     */
    public static getInstance(): TerminalManager {
        if (!TerminalManager.instance) {
            TerminalManager.instance = new TerminalManager();
        }
        return TerminalManager.instance;
    }

    /**
     * 显示终端
     * @param name 终端名称
     */
    public async showTerminal(name: string): Promise<VtyTerminal>;
    
    /**
     * 显示终端（带配置和回调）
     * @param name 终端名称
     * @param config 终端配置
     * @param closeCallback 关闭回调
     */
    public async showTerminal(name: string, config: any, closeCallback: (terminal: string) => void): Promise<VtyTerminal>;
    
    /**
     * 显示终端实现
     */
    public async showTerminal(name: string, config?: any, closeCallback?: (terminal: string) => void): Promise<VtyTerminal> {
        let terminal = this.terminals.get(name);
        if (!terminal) {
            if (config && closeCallback) {
                terminal = await VtyTerminal.create(name, config, false, closeCallback, getTerminalViewShowEditArea());
            } else {
                terminal = await VtyTerminal.create(name);
            }
            this.terminals.set(name, terminal);
            // 尝试创建对应的Worker
            await this.createTerminalWorker(name);
        }
        terminal.show();
        return terminal;
    }

    /**
     * 为终端创建Worker
     * @param terminalName 终端名称
     */
    public async createTerminalWorker(terminalName: string): Promise<void> {
        try {
            const routerService = ZmqRouterServiceImpl.getInstance();
            await routerService.createTerminalWorker(terminalName);
        } catch (error) {
            console.error(`Failed to create worker for terminal ${terminalName}:`, error);
            // 即使Worker创建失败，也不影响终端的基本功能
        }
    }

    /**
     * 清理终端Worker
     * @param terminalName 终端名称
     */
    public async cleanupTerminalWorker(terminalName: string): Promise<void> {
        try {
            // 检查terminalName是否有效
            if (!terminalName) {
                console.warn('Invalid terminal name provided to cleanupTerminalWorker');
                return;
            }
            
            // 尝试获取ZmqRouterService实例
            const routerService = ZmqRouterServiceImpl.getInstance();
            if (routerService) {
                // 调用cleanupWorker方法
                await routerService.cleanupWorker(terminalName);
            } else {
                console.warn('ZmqRouterService instance not available');
            }
        } catch (error) {
            console.error(`Failed to cleanup worker for terminal ${terminalName}:`, error);
        }
    }

    /**
     * 执行RPC命令
     * @param terminalName 终端名称
     * @param command 命令名称
     * @param params 命令参数
     */
    public async doRpcCommand(terminalName: string, command: string, params: any): Promise<any> {
        const terminal = this.getFromTerminalName(terminalName);
        if (!terminal) {
            throw new Error(`Terminal ${terminalName} not found`);
        }

        // 构建RPC请求
        const rpcRequest = `${command}:${JSON.stringify(params || {})}`;
        return await terminal.doRpcCommand(rpcRequest);
    }

    /**
     * 根据终端名称获取终端实例
     * @param name 终端名称
     */
    public getFromTerminalName(name: string): VtyTerminal | undefined {
        return this.terminals.get(name);
    }

    /**
     * 根据终端获取终端实例（兼容旧代码）
     * @param terminal 终端
     */
    public getFromTerminal(terminal: any): VtyTerminal | undefined {
        if (typeof terminal === 'string') {
            return this.getFromTerminalName(terminal);
        }
        return this.terminals.get(terminal.name);
    }

    /**
     * 添加终端实例
     * @param terminal 终端实例
     */
    public add(terminal: VtyTerminal): void {
        this.terminals.set(terminal.name, terminal);
    }

    /**
     * 移除终端实例
     * @param name 终端名称
     */
    public async remove(name: string): Promise<void> {
        // 清理Worker
        await this.cleanupTerminalWorker(name);
        this.terminals.delete(name);
    }
    
    /**
     * 关闭终端
     * @param name 终端名称
     */
    public close(name: string): void {
        const terminal = this.terminals.get(name);
        if (terminal) {
            terminal.close();
        }
    }

    /**
     * 获取所有终端实例
     */
    public getAll(): VtyTerminal[] {
        return Array.from(this.terminals.values());
    }
}

// 导出单例实例
export const terminalManager = TerminalManager.getInstance();