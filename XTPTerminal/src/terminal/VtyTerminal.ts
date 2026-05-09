import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { l10n } from 'vscode';
import { EventEmitter, ExtensionTerminalOptions, Terminal, TerminalDimensions, TerminalEditorLocationOptions, TerminalLocation, TerminalSplitLocationOptions, ThemeColor, ThemeIcon, Uri, window } from "vscode";
import { ISessionCallback, BaseSession } from "../sessions/basic/BasicSession";
import { SessionFactory, ISessionConfiguration } from '../sessions/SessionFactory';
import { TerminalContentBuffer } from './terminalContentBuffer';

interface VtyTerminalOptions {
    create?: boolean;
    iconPath?: Uri | { light: Uri; dark: Uri } | ThemeIcon;
    color?: ThemeColor;
    location?: TerminalLocation | TerminalEditorLocationOptions | TerminalSplitLocationOptions;
    isTransient?: boolean;
}

interface ITerminalConfiguration extends ISessionConfiguration {
    name: string;
}

function getCurrentProjectDir(): string | undefined {
    // 判断是否有打开的工作区
    if (!vscode.workspace.workspaceFolders) {
        //vscode.window.showErrorMessage('未打开任何文件夹');
        return undefined;
    }

    // 取第一个工作区目录的本地路径
    const firstWorkspaceFolder = vscode.workspace.workspaceFolders[0];
    return firstWorkspaceFolder.uri.fsPath;
}

class VtyTerminal {
    private writeEmitter = new EventEmitter<string>();
    private overrideDimensionsEmitter = new EventEmitter<TerminalDimensions | undefined>();
    private closeEmitter = new EventEmitter<void | number>();
    private changeNameEmitter = new EventEmitter<string>();
    private onOpen?: (initialDimensions?: TerminalDimensions) => void;
    private onInput?: (data: string) => void;
    private onClose?: () => void | Promise<void>;
    private onSetDimensions?: (dimensions: TerminalDimensions) => void;
    private opts: ExtensionTerminalOptions;
    private currentColumns: number = 80;  // 当前终端列数，默认80列
    private terminalInstance: Terminal | undefined;
    private bindSession : BaseSession;
    state: { loging: boolean; logSize:number; timeStamp: boolean; hex: boolean;};
    private logPath: string;
    private contentBuffer = new TerminalContentBuffer();
    //private rpcDealerHandle: DealerHandle;

    constructor(name: string, opts?: VtyTerminalOptions) {
        this.state = {
            loging: false,
            logSize: 20000000,
            timeStamp: false,
            hex: false,
        };

        this.opts = {
            pty: {
                onDidWrite: this.writeEmitter.event,
                onDidOverrideDimensions: this.overrideDimensionsEmitter.event,
                onDidClose: this.closeEmitter.event,
                onDidChangeName: this.changeNameEmitter.event,
                open: (initialDimensions?: vscode.TerminalDimensions) => {
                    if (initialDimensions) {
                        this.currentColumns = initialDimensions.columns || 80;
                    }
                    if (this.onOpen) { this.onOpen(initialDimensions); }
                },
                close: async () => {
                    if (this.onClose) { await this.onClose(); }
                },
                handleInput: (data: string) => {
                    console.log(`handleInput called: ${JSON.stringify(data)}, onInput exists: ${!!this.onInput}`);
                    if (this.onInput) { this.onInput(data); }
                },
                setDimensions: (dimensions: TerminalDimensions) => {
                    if (this.onSetDimensions) { this.onSetDimensions(dimensions); }
                }
            },
            name: name,
            iconPath: opts?.iconPath,
            color: opts?.color,
            location: opts?.location,
            isTransient: opts?.isTransient
        };
        if (!opts || opts?.create) {
            this.terminalInstance = window.createTerminal(this.opts);
        }
    }

    setBindSession(session: BaseSession) {
        this.bindSession = session;
    }
    
    /**
     * 关闭终端
     */
    close() {
        if (this.terminalInstance) {
            this.terminalInstance.dispose();
            this.terminalInstance = undefined;
        }
    }

    setOnOpen(callback?: (initialDimensions: TerminalDimensions | undefined) => void) {
        this.onOpen = callback;
    }

    setOnInput(callback?: (data: string) => void) {
        this.onInput = callback;
    }

    setOnClose(callback?: () => void | Promise<void>) {
        this.onClose = callback;
    }

    setOnChangeDimensions(callback?: (dimensions: TerminalDimensions) => void) {
        this.onSetDimensions = callback;
    }

    async openSession() {
        if (!this.bindSession) {
            return;
        }
        try {
            const result: boolean = await this.bindSession.open();
            if (result) {
                this.setOnInput(
                    (data) => this.bindSession.send(data)
                );
            }
            else {
                const msg = l10n.t('xtp.terminal.vtp.connected.failed');
                vscode.window.showErrorMessage(`${this.name} ` + msg);
            }
        } catch (err) {
            const msg = l10n.t('xtp.terminal.vtp.connected.failed');
            vscode.window.showErrorMessage(`${this.name} ` + msg);
            this.showOnError(err);
        }
    }

    write = (data: Buffer) => {
        if (this.state.loging) {
            this.log(data);
        }
        this.output(data.toString('utf-8'));
    };

    output = (text: string) => {
        this.writeEmitter.fire(text);
        this.contentBuffer.saveContent(text);
    };

    showOnReconnect= () =>{
        this.output("\r\n");
        const separator = '—'.repeat(this.currentColumns);
        this.output(separator + "\r\n");
        this.output("\r\n");
        this.output("\x1b[31mSession stopped\x1b[0m\r\n" + 
            "- Press \x1b[95m<Return>\x1b[0m to exit tab\r\n" +
            "- Press \x1b[95mR\x1b[0m to restart session\r\n");
        
        this.setOnInput(
            async (data) => {
                if (data === '\r' || data === '\n' || data === '\r\n') {
                    if (this.terminalInstance) {
                        this.terminalInstance.dispose();
                        this.terminalInstance = undefined;
                    }
                    if (this.onClose) {
                        await this.onClose();
                    }
                } else if (data === 'R' || data === 'r') {
                    this.openSession();
                }
            }
        );
    };

    showOnError =  (err : Error) =>{
        this.output("\r\n");
        this.output("\x1b[31m" + err.message + "\x1b[0m");
        this.showOnReconnect();
    };

    setDimensions(dimensions?: TerminalDimensions) {
        this.overrideDimensionsEmitter.fire(dimensions);
    }

    show() {
        if (this.terminalInstance) { this.terminalInstance.show(); }
        else {
            let terminal = vscode.window.terminals.find((terminal) => {
                return terminal.name === this.opts.name ? terminal : undefined;
            });
            terminal?.show();
        }
    }

    get name(): string {
        return this.opts.name;
    }

    /**
     * 获取终端名称
     */
    public getName(): string {
        return this.opts.name;
    }

    /**
     * 获取绑定的会话
     */
    public getSession(): BaseSession | undefined {
        return this.bindSession;
    }

    get options(): ExtensionTerminalOptions | undefined {
        if (!this.terminalInstance) { return this.opts; }
    }

    private get terminal(): Terminal | undefined {
        return this.terminalInstance;
    }

    private getTime() {
        return new Date().toLocaleString('zh', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    }

    private getTimeStamp(): string { return `[${this.getTime()}] `; }
    private getLogFileTime(): string {
        return this.getTime()
                .replaceAll(' ', '_')
                .replaceAll(':', '')
                .replaceAll('/', '');
    }

    private log(data: Buffer) {
        fs.stat(this.logPath, async(err, stats) =>  {
            if (stats.size >= this.state.logSize) {
                this.logPath = path.dirname(this.logPath) + "/" + this.name + "_" + this.getLogFileTime() + ".log";
                fs.writeFileSync(this.logPath, "");
            }
        });
        try {
            if (this.state.timeStamp) {
                fs.appendFileSync(
                    this.logPath,
                    data.toString()
                        .replaceAll('\r', '')
                        .replaceAll('\n', '\n' + this.getTimeStamp()));
            } else {
                fs.appendFileSync(this.logPath, data.toString().replaceAll('\r', ''));
            }
        } catch(err) {
            console.log(err.message);
        }
    }

    async startLogging(logPath?:string, logSize?: number, timeStamp?: boolean | undefined): Promise<boolean> {
        if (this.state.loging) { return this.state.loging; }
        if (!logPath === null) { return this.state.loging; } else {
            this.logPath = logPath + "/" + this.name + "_" + this.getLogFileTime() + ".log";
            fs.writeFileSync(this.logPath, "");
        }
        if (logSize) {this.state.logSize = logSize};
        if (timeStamp) { this.state.timeStamp = timeStamp; }
        this.state.loging = true;
        return this.state.loging;
    }

    stopLogging(): boolean {
        if (!this.state.loging) { return false; }

        this.state.loging = false;
        return this.state.loging;
    }

    /**
     * 执行RPC命令
     * @param rpcrequest RPC请求字符串
     */
    public async doRpcCommand(rpcrequest: string): Promise<string> {
        let result = '';

        try {
            const jsonrequest = JSON.parse(rpcrequest);
            const { method } = jsonrequest;

            switch (method) {
            case "send": {
                // 存储所有命令的结果
                const cmdResults: string[] = [];
                // 获取命令列表和全局配置（搜索条件、超时时间）
                const { commands, search, timeout: globalTimeout, nonewline: bNoNewline } = jsonrequest;

                // 用 for...of 循环串行执行命令（确保顺序执行并等待结果）
                for (const cmd of commands) {
                    // 等待当前命令执行完成，再执行下一个
                    const result = await this.doRpcSend(
                        cmd,
                        search,
                        globalTimeout ? parseInt(globalTimeout, 10) : 1000,
                        bNoNewline ? Boolean(bNoNewline) : false
                    );
                    cmdResults.push(result);
                }

                // 合并所有命令的结果并返回
                result = cmdResults.join("\n"); // 按换行符拼接结果
                break;
            }
            case "get_buffer": {
                const { count } = jsonrequest;
                result = this.contentBuffer.getLatestLines(count);
                break;
            }
            case "clear": {
                this.contentBuffer.clear();
                result = `${this.opts.name} 已清空缓冲区`;
                break;
            }
             case "set_user_mark": {
                this.contentBuffer.setExternalMark();
                result = `${this.opts.name} 已清空缓冲区`;
                break;
            }
            case "get_mark_content": {
                result = this.contentBuffer.getExternalMarkedLines();
                break;
            }

            default:
                result = `Unknown command: ${method}`;
                break;
            }
        } catch (error) {
            result = `Error parsing RPC request: ${(error as Error).message}`;
        }
        return result;
    }

    /**
     * 执行RPC发送并等待响应
     * @param command 命令
     * @param search 搜索的响应字符串
     * @param timeout 超时时间（毫秒）
     * @param nonewline 是否不添加换行
     */
    private async doRpcSend(command: string, search: string, timeout: number = 1000, nonewline: boolean = false): Promise<string> {
        return new Promise((resolve, reject) => {
            let response = '';
            const startTime = Date.now();
            
            // 模拟响应处理，实际应该从终端的输出中捕获
            const checkResponse = () => {
                response = this.contentBuffer.getInternalMarkedLines();
                // 使用正则表达式匹配search字符串
                try {
                    const regex = new RegExp(search);
                    if (regex.test(response)) {
                        resolve(response);
                    } else if (Date.now() - startTime > timeout) {
                        reject(new Error('RPC send timeout'));
                    } else {
                        setTimeout(checkResponse, 100);
                    }
                } catch (error) {
                    // 如果正则表达式创建失败，回退到字符串包含匹配
                    if (response.includes(search)) {
                        resolve(response);
                    } else if (Date.now() - startTime > timeout) {
                        reject(new Error('RPC send timeout'));
                    } else {
                        setTimeout(checkResponse, 100);
                    }
                }
            };
            
            this.contentBuffer.setInternalMark();

            // 发送命令
            //this.write(Buffer.from(nonewline ? command : command + '\r\n'));
            this.bindSession.send(nonewline ? command : command + '\r\n');
            
            // 启动响应检查
            setTimeout(checkResponse, 100);
        });
    }

    /**
     * 创建VtyTerminal实例
     * @param name 终端名称
     * @param terminalConfig 终端配置
     * @param pseudo 是否为伪终端
     * @param closeCallback 关闭回调
     * @param bInEditorArea 是否在编辑器区域显示
     */
    public static async create(name: string, terminalConfig?: ITerminalConfiguration, pseudo: boolean = false, closeCallback?: (terminal:string) => void, bInEditorArea: boolean = false) : Promise<VtyTerminal> {
        const terminal = new VtyTerminal(name, {
            create: !pseudo,
            location: bInEditorArea ? TerminalLocation.Editor : undefined
        });

        // 设置关闭回调
        if (closeCallback) {
            terminal.setOnClose(() => {
                closeCallback(name);
            });
        } else {
            // 清理Worker
            terminal.setOnClose(async () => {
                const { terminalManager } = require('./terminalManager');
                await terminalManager.remove(name);
            });
        }

        // 获取Dimension配置（用于在终端打开后应用）
        const dimension = terminalConfig?.options?.dimension;

        // 初始化会话
        const sessionCallbacks: ISessionCallback = {
            onData: terminal.write,
            onError: terminal.showOnError,
            onClose: terminal.showOnReconnect
        };
        const session = await SessionFactory.createSession(terminalConfig, sessionCallbacks, false);
        terminal.setBindSession(session);

        // 设置终端尺寸变化回调（用于通知SSH服务器调整PTY尺寸）
        terminal.setOnChangeDimensions((newDimensions) => {
            terminal.currentColumns = newDimensions.columns || 80;
            if (session && typeof session.resize === 'function' && dimension.autoResize) {
                session.resize(newDimensions.columns || 80, newDimensions.rows || 24);
            }
        });

        // 打开会话
        await terminal.openSession();

        // 在终端打开后设置Dimension（非自适应模式）
        if (dimension && !dimension.autoResize) {
            const columns = Math.max(80, Math.min(65535, dimension.cols || 80));
            const rows = Math.max(24, Math.min(65535, dimension.rows || 24));
            terminal.setDimensions({ rows, columns });
        }

        return terminal;
    }

}
export { 
    VtyTerminal, 
    VtyTerminalOptions,
    ITerminalConfiguration
};