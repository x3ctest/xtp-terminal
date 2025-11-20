import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { l10n } from 'vscode';
import crypto from 'crypto';
import { EventEmitter, ExtensionTerminalOptions, Terminal, TerminalDimensions, TerminalEditorLocationOptions, TerminalLocation, TerminalSplitLocationOptions, ThemeColor, ThemeIcon, Uri, window } from "vscode";
import { ISessionCallback, BaseSession } from "../sessions/basic/BasicSession";
import { SessionFactory, ISessionConfiguration } from '../sessions/SessionFactory';
import { startTerminalRpcDealer, DealerHandle, closeDealer } from '../rpcserver/xtpserver';
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
    private onClose?: () => void;
    private onSetDimensions?: (dimensions: TerminalDimensions) => void;
    private opts: ExtensionTerminalOptions;
    private terminalInstance: Terminal | undefined;
    private bindSession : BaseSession;
    state: { loging: boolean; logSize:number; timeStamp: boolean; hex: boolean;};
    private logPath: string;
    private contentBuffer = new TerminalContentBuffer();
    private rpcDealerHandle: DealerHandle;

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
                    if (this.onOpen) { this.onOpen(initialDimensions); }
                },
                close: () => {
                    if (this.onClose) { this.onClose(); }
                },
                handleInput: (data: string) => {
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

    setOnOpen(callback?: (initialDimensions: TerminalDimensions | undefined) => void) {
        this.onOpen = callback;
    }

    setOnInput(callback?: (data: string) => void) {
        this.onInput = callback;
    }

    setOnClose(callback?: () => void) {
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
                this.onClose();    
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
        this.output("————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————\r\n");
        this.output("\x1b[31mSession stopped\x1b[0m\r\n" + 
            "- Press \x1b[95m<Return>\x1b[0m to exit tab\r\n" +
            "- Press \x1b[95mR\x1b[0m to restart session\r\n");
        this.setOnInput(
            (data) => {
                switch (data) {
                    case '\r': {
                        this.terminalInstance.dispose();
                        this.onClose();
                        break;
                    }
                    case 'R': {
                        this.openSession();
                        break;
                    }
                    default : {

                    }
                }
            }
        );
    };

    showOnError =  (err : Error) =>{
        this.output("\r\n");
        this.output("\x1b[31m" + err.message + "\x1b[0m");
        this.showOnReconnect();
    }

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

    close(n: number | void) {
        this.closeEmitter.fire(n);
    }

    get name(): string {
        return this.opts.name;
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
        fs.stat(this.logPath, (err, stats) => {
            if (stats.size >= this.state.logSize) {
                this.logPath = path.dirname(this.logPath) + "/" + this.name + "_" + this.getLogFileTime() + ".log";
                fs.writeFileSync(this.logPath, "");
            }
        });
        if (this.state.timeStamp) {
            fs.appendFileSync(
                this.logPath,
                data.toString()
                    .replaceAll('\r', '')
                    .replaceAll('\n', '\n' + this.getTimeStamp()));
        } else {
            fs.appendFileSync(this.logPath, data.toString().replaceAll('\r', ''));
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

    private async doRpcCommand(rpcrequest: string): Promise<string> {
        console.log(rpcrequest);
        const jsonrequest = JSON.parse(rpcrequest);

        switch (jsonrequest.method) {
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
                return cmdResults.join("\n"); // 按换行符拼接结果
            }
            case "get_buffer": {
                const { count } = jsonrequest;
                return this.contentBuffer.getLatestLines(count);
            }
            case "clear": {
                this.contentBuffer.clear();
                return `${this.opts.name} 已清空缓冲区`;
            }
             case "set_user_mark": {
                this.contentBuffer.setExternalMark();
                return `${this.opts.name} 已清空缓冲区`;
            }
            case "get_mark_content": {
                return this.contentBuffer.getExternalMarkedLines();
            }
            default: {
                return `${this.opts.name} 未知命令: ${jsonrequest.method}`;
            }
        }
    }

    // doRpcSend 保持不变（已正确实现单命令的异步等待）
    private async doRpcSend(command: string, search: string, timeout: number = 1000, nonewline: boolean = false): Promise<string> {
        return new Promise((resolve) => {
            this.contentBuffer.setInternalMark();
            this.bindSession.send(command);
            if (!nonewline) {
                this.bindSession.send("\r\n");
            }

            if (search) {
                const regex = new RegExp(search, "g");
                const timerId = setInterval(() => {
                    const cmdResult = this.contentBuffer.getInternalMarkedLines();
                    if (cmdResult.match(regex)) {
                        clearInterval(timerId);
                        clearTimeout(timeoutId);
                        this.contentBuffer.resetInternalMark();
                        resolve(cmdResult);
                    }
                }, 100);

                // 超时控制
                const timeoutId = setTimeout(() => {
                    clearInterval(timerId); // 修复：必须清除定时器，避免内存泄漏
                    const cmdResult = this.contentBuffer.getInternalMarkedLines();
                    this.contentBuffer.resetInternalMark();
                    resolve(cmdResult);
                }, timeout);
            } else {
                // 无搜索条件时，直接返回当前标记的内容（根据实际需求调整）
                // 注意：若命令执行需要时间，可能需要短暂等待或调整逻辑
                const cmdResult = this.contentBuffer.getInternalMarkedLines();
                this.contentBuffer.resetInternalMark();
                resolve(cmdResult);
            }
        });
    }

    public static async create(name: string, terminalConfig: ITerminalConfiguration, pseudo: boolean = false, closeCallback: (terminal:string) => void, bInEditorArea: boolean = false) : Promise<VtyTerminal> {
        let opts = { create: true, location: TerminalLocation.Panel };
        if (bInEditorArea) {
            opts.location = TerminalLocation.Editor;
        }
        const terminal = new VtyTerminal(name, opts);
        terminal.setOnOpen(async () => {
            const sessionCallbacks : ISessionCallback = {
                onData: terminal.write,
                onError: terminal.showOnError,
                onClose: terminal.showOnReconnect
            };
            
            const session : BaseSession = await SessionFactory.createSession(terminalConfig, sessionCallbacks, pseudo);
            terminal.setBindSession(session);
            terminal.openSession();
        });

        terminal.setOnClose(async () => {
            try {
                if (terminal.rpcDealerHandle) {
                    await closeDealer(terminal.rpcDealerHandle);
                }
            } catch (err) {
                console.error("关闭Dealer失败:", err);
            } finally {
                if (terminal.bindSession) { 
                    terminal.bindSession.close(); 
                    terminal.bindSession = null;              
                }
                closeCallback(terminal.opts.name);
            }
        });

        terminal.show(); // 显示终端，触发onOpen

        const projectPath = getCurrentProjectDir();
        const instanceId = crypto.createHash('sha256').update(projectPath).digest('hex');

        
        terminal.rpcDealerHandle = await startTerminalRpcDealer(instanceId + ":" + terminal.name, (request: string) => {
            return terminal.doRpcCommand(request);
        });

        return terminal;
    }
}
export { 
    VtyTerminal, 
    VtyTerminalOptions,
    ITerminalConfiguration
};