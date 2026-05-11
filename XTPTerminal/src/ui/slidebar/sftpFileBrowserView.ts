import * as vscode from "vscode";
import * as path from 'path';
import { l10n } from 'vscode';
import { terminalManager } from "../../terminal/terminalManager";
import { SSHSession } from "../../sessions/ssh/sshSession";
import * as ssh from "ssh2";
import * as fs from 'fs';

// SFTP文件/目录项
interface SftpItem {
    name: string;
    type: 'file' | 'directory';
    path: string;
    size?: number;
    mtime?: number;
}

// SFTP文件浏览器视图提供器
class SftpFileBrowserViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'xtp.terminal.sftpFileBrowser';

    private _view?: vscode.WebviewView;
    private _currentTerminalName: string | undefined;
    private _currentPath: string = '/';
    private _terminalPaths: Map<string, string> = new Map(); // 存储每个终端的当前路径
    private _terminalChangeDisposable: vscode.Disposable | undefined;
    private _terminalCreateDisposable: vscode.Disposable | undefined;
    private _activeEditorDisposable: vscode.Disposable | undefined;
    private _visibleEditorDisposable: vscode.Disposable | undefined;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    // 公共方法，用于处理命令
    public refresh() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'refresh' });
        }
    }

    public navigateParent() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'navigateParent' });
        }
    }

    public downloadSelected() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'downloadSelected' });
        }
    }

    public upload() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'upload' });
        }
    }

    public deleteSelected() {
        if (this._view) {
            this._view.webview.postMessage({ type: 'deleteSelected' });
        }
    }

    // 处理终端关闭的方法
    public onTerminalClosed(terminalName: string) {
        // 检查是否是当前活动终端
        if (this._currentTerminalName === terminalName) {
            // 刷新并清空SFTP文件浏览器
            this._currentTerminalName = undefined;
            this._currentPath = '/';
            if (this._view) {
                this._view.webview.postMessage({ 
                    type: 'update', 
                    path: '/', 
                    items: [] 
                });
            }
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // 允许脚本
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // 处理来自webview的消息
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'navigate':
                    await this._navigateToPath(data.path);
                    break;
                case 'doubleClick':
                    await this._handleDoubleClick(data.item);
                    break;
                case 'download':
                    await this._downloadFile(data.path);
                    break;
                case 'refresh':
                    await this._refresh();
                    break;
                case 'upload':
                    await this._uploadFile();
                    break;
                case 'delete':
                    await this._deleteFile(data.path);
                    break;
            }
        });

        // 当视图可见时刷新
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._checkActiveTerminal();
            }
        });

        // 监听活动终端变化
        this._terminalChangeDisposable = vscode.window.onDidChangeActiveTerminal(() => {
            //this._checkActiveTerminal();
            setTimeout(() => {
                this._checkActiveTerminal();
            }, 1000);
        });

        // 监听终端创建事件
        /*this._terminalCreateDisposable = vscode.window.onDidOpenTerminal((terminal) => {
            // 延迟检查，确保终端已完全初始化
            setTimeout(() => {
                this._checkActiveTerminal();
            }, 1000);
        });*/
        // 初始化时检查活动终端
        // this._checkActiveTerminal();
    }

    // 检查活动终端
    private _checkActiveTerminal(): void {
        const activeTerminal = vscode.window.activeTerminal;
        if (!activeTerminal) {
            this._currentTerminalName = undefined;
            this._refresh();
            return;
        }

        // 检查活动终端是否为SSH终端
        const terminalName = activeTerminal.name;
        const terminal = terminalManager.getFromTerminalName(terminalName);
        
        if (terminal) {
            const session = terminal.getSession();
            if (session instanceof SSHSession) {
                // 是SSH终端，更新当前终端
                if (this._currentTerminalName !== terminalName) {
                    // 保存当前终端的路径
                    if (this._currentTerminalName) {
                        this._terminalPaths.set(this._currentTerminalName, this._currentPath);
                    }
                    
                    // 切换到新终端，恢复保存的路径或使用默认值
                    this._currentTerminalName = terminalName;
                    this._currentPath = this._terminalPaths.get(terminalName) || '/';
                    this._refresh();
                }
            } else {
                // 不是SSH终端，清空视图
                if (this._currentTerminalName) {
                    // 保存当前终端的路径
                    this._terminalPaths.set(this._currentTerminalName, this._currentPath);
                }
                this._currentTerminalName = undefined;
                this._refresh();
            }
        } else {
            // 终端不在管理列表中，清空视图
            if (this._currentTerminalName) {
                // 保存当前终端的路径
                // this._terminalPaths.set(this._currentTerminalName, this._currentPath);
                const terminalOld = terminalManager.getFromTerminalName(this._currentTerminalName);
                if (!terminalOld) {
                    this._currentTerminalName = undefined;
                    this._refresh();
                }

            }
            //this._currentTerminalName = undefined;
            //this._refresh();
        }
    }

    // 清理资源
    public dispose(): void {
        if (this._terminalChangeDisposable) {
            this._terminalChangeDisposable.dispose();
        }
        if (this._terminalCreateDisposable) {
            this._terminalCreateDisposable.dispose();
        }
        if (this._activeEditorDisposable) {
            this._activeEditorDisposable.dispose();
        }
    }

    // 设置当前终端
    public setCurrentTerminal(terminalName: string): void {
        this._currentTerminalName = terminalName;
        this._currentPath = '/';
        this._refresh();
    }

    //获取当前终端名称
    public getCurrentTerminal(): string {
        return this._currentTerminalName;
    }

    // 刷新文件列表
    private async _refresh(): Promise<void> {
        if (!this._view) {
            return;
        }

        if (!this._currentTerminalName) {
            // 没有终端时发送null
            this._view.webview.postMessage({
                type: 'update',
                path: '',
                items: null
            });
            this._view.title = '文件浏览器';
            return;
        }

        // 获取终端的IP地址
        const terminal = terminalManager.getFromTerminalName(this._currentTerminalName);
        let ipAddress = '';
        if (terminal) {
            const session = terminal.getSession();
            if (session instanceof SSHSession) {
                // 从SSH会话的配置中获取IP地址
                // @ts-ignore - 访问sshconfig属性
                ipAddress = session.sshconfig?.host || '';
            }
        }

        // 更新视图标题
        this._view.title = ipAddress ? `文件浏览器（${ipAddress}）` : '文件浏览器';

        const items = await this._listDirectory(this._currentPath, this._currentTerminalName);
        this._view.webview.postMessage({
            type: 'update',
            path: this._currentPath,
            items: items
        });
    }

    // 导航到指定路径
    private async _navigateToPath(newPath: string): Promise<void> {
        // 确保路径格式正确
        let normalizedPath = newPath;
        if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
        }
        
        // 规范化路径（处理 . 和 ..）
        const parts = normalizedPath.split('/').filter(part => part);
        const stack: string[] = [];
        
        for (const part of parts) {
            if (part === '.') {
                continue;
            } else if (part === '..') {
                stack.pop();
            } else {
                stack.push(part);
            }
        }
        
        this._currentPath = '/' + stack.join('/');
        
        // 保存路径到对应终端
        if (this._currentTerminalName) {
            this._terminalPaths.set(this._currentTerminalName, this._currentPath);
        }
        
        await this._refresh();
    }

    // 处理双击事件
    private async _handleDoubleClick(item: SftpItem): Promise<void> {
        if (item.type === 'directory') {
            this._currentPath = item.path;
            
            // 保存路径到对应终端
            if (this._currentTerminalName) {
                this._terminalPaths.set(this._currentTerminalName, this._currentPath);
            }
            
            await this._refresh();
        } else {
            await this._downloadFile(item.path);
        }
    }

    // 下载文件
    private async _downloadFile(filePath: string): Promise<void> {
        if (!this._currentTerminalName) {
            return;
        }

        const terminal = terminalManager.getFromTerminalName(this._currentTerminalName);
        if (!terminal) {
            vscode.window.showErrorMessage('终端未找到');
            return;
        }

        const session = terminal.getSession();
        if (!(session instanceof SSHSession)) {
            vscode.window.showErrorMessage('非SSH终端，无法使用SFTP');
            return;
        }

        const sftpClient = session.getSftpClient();
        if (!sftpClient) {
            vscode.window.showErrorMessage('SFTP连接未建立');
            return;
        }

        // 选择保存路径
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.basename(filePath)),
            title: '保存文件'
        });

        if (!saveUri) {
            return;
        }

        // 获取文件大小用于进度计算（字节）
        let fileSize = 0;
        try {
            const stats = await new Promise<any>((resolve, reject) => {
                sftpClient.stat(filePath, (err, attrs) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(attrs);
                    }
                });
            });
            fileSize = stats.size; // 字节
        } catch (err) {
            // 如果获取文件大小失败，继续下载（进度条可能不准确）
        }

        // 显示进度条下载文件
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `下载文件: ${path.basename(filePath)}`,
            cancellable: true
        }, async (progress, token) => {
            return new Promise((resolve, reject) => {
                token.onCancellationRequested(() => {
                    // 用户取消操作
                    reject(new Error('下载已取消'));
                });

                sftpClient.fastGet(filePath, saveUri.fsPath, {
                    step: (transferred: number, total: number) => {
                        // 使用实际获取的文件大小作为总大小（确保单位一致）
                        const actualTotal = fileSize > 0 ? fileSize : total;
                        const percentage = actualTotal > 0 ? Math.round((transferred / actualTotal) * 100) : 0;
                        // 将字节转换为可读格式
                        const transferredStr = this._formatFileSize(transferred);
                        const totalStr = this._formatFileSize(actualTotal);
                        progress.report({
                            message: `${transferredStr} / ${totalStr} (${percentage}%)`,
                            increment: actualTotal > 0 ? (transferred / actualTotal) * 100 : 0
                        });
                    }
                }, (err) => {
                    if (err) {
                        vscode.window.showErrorMessage(`下载失败: ${err.message}`);
                        reject(err);
                    } else {
                        vscode.window.showInformationMessage(`文件已下载: ${saveUri.fsPath}`);
                        resolve(undefined);
                    }
                });
            });
        });
    }

    // 上传文件
    private async _uploadFile(): Promise<void> {
        if (!this._currentTerminalName) {
            vscode.window.showErrorMessage('请先打开一个SSH终端');
            return;
        }

        const terminal = terminalManager.getFromTerminalName(this._currentTerminalName);
        if (!terminal) {
            vscode.window.showErrorMessage('终端未找到');
            return;
        }

        const session = terminal.getSession();
        if (!(session instanceof SSHSession)) {
            vscode.window.showErrorMessage('非SSH终端，无法使用SFTP');
            return;
        }

        const sftpClient = session.getSftpClient();
        if (!sftpClient) {
            vscode.window.showErrorMessage('SFTP连接未建立');
            return;
        }

        // 选择要上传的文件
        const fileUris = await vscode.window.showOpenDialog({
            title: '选择要上传的文件',
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true
        });

        if (!fileUris || fileUris.length === 0) {
            return;
        }

        // 上传每个文件
        for (const fileUri of fileUris) {
            const fileName = path.basename(fileUri.fsPath);
            const remotePath = path.posix.join(this._currentPath, fileName);

            // 获取本地文件大小（字节）
            const fileStats = fs.statSync(fileUri.fsPath);
            const fileSize = fileStats.size; // 字节

            // 显示进度条上传文件
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `上传文件: ${fileName}`,
                cancellable: true
            }, async (progress, token) => {
                return new Promise((resolve, reject) => {
                    token.onCancellationRequested(() => {
                        // 用户取消操作
                        reject(new Error('上传已取消'));
                    });

                    sftpClient.fastPut(fileUri.fsPath, remotePath, {
                        step: (transferred: number, total: number) => {
                            // 使用实际获取的文件大小作为总大小（确保单位一致）
                            const actualTotal = fileSize > 0 ? fileSize : total;
                            const percentage = actualTotal > 0 ? Math.round((transferred / actualTotal) * 100) : 0;
                            // 将字节转换为可读格式
                            const transferredStr = this._formatFileSize(transferred);
                            const totalStr = this._formatFileSize(actualTotal);
                            progress.report({
                                message: `${transferredStr} / ${totalStr} (${percentage}%)`,
                                increment: actualTotal > 0 ? (transferred / actualTotal) * 100 : 0
                            });
                        }
                    }, (err) => {
                        if (err) {
                            vscode.window.showErrorMessage(`上传失败 ${fileName}: ${err.message}`);
                            reject(err);
                        } else {
                            vscode.window.showInformationMessage(`文件已上传: ${remotePath}`);
                            resolve(undefined);
                        }
                    });
                });
            });
        }

        // 刷新文件列表
        await this._refresh();
    }

    // 删除文件
    private async _deleteFile(filePath: string): Promise<void> {
        if (!this._currentTerminalName) {
            vscode.window.showErrorMessage('请先打开一个SSH终端');
            return;
        }

        const terminal = terminalManager.getFromTerminalName(this._currentTerminalName);
        if (!terminal) {
            vscode.window.showErrorMessage('终端未找到');
            return;
        }

        const session = terminal.getSession();
        if (!(session instanceof SSHSession)) {
            vscode.window.showErrorMessage('非SSH终端，无法使用SFTP');
            return;
        }

        const sftpClient = session.getSftpClient();
        if (!sftpClient) {
            vscode.window.showErrorMessage('SFTP连接未建立');
            return;
        }

        // 确认删除
        const confirmed = await vscode.window.showWarningMessage(
            `确定要删除文件: ${filePath}吗？`,
            { modal: true },
            '确定',
            '取消'
        );

        if (confirmed !== '确定') {
            return;
        }

        // 删除文件
        return new Promise((resolve, reject) => {
            sftpClient.unlink(filePath, (err) => {
                if (err) {
                    vscode.window.showErrorMessage(`删除文件失败: ${err.message}`);
                    reject(err);
                } else {
                    vscode.window.showInformationMessage(`文件已删除: ${filePath}`);
                    // 刷新文件列表
                    this._refresh();
                    resolve();
                }
            });
        });
    }

    // 列出目录内容
    private async _listDirectory(dirPath: string, terminalName: string): Promise<SftpItem[]> {
        const terminal = terminalManager.getFromTerminalName(terminalName);
        if (!terminal) {
            return [];
        }

        const session = terminal.getSession();
        if (!(session instanceof SSHSession)) {
            return [];
        }

        const sftpClient = session.getSftpClient();
        if (!sftpClient) {
            return [];
        }

        return new Promise((resolve, reject) => {
            sftpClient.readdir(dirPath, (err, list) => {
                if (err) {
                    console.error('SFTP readdir error:', err);
                    resolve([]);
                    return;
                }

                const items: SftpItem[] = [];
                
                // 添加当前目录和上级目录
                items.push({
                    name: '.',
                    type: 'directory',
                    path: dirPath
                });
                
                if (dirPath !== '/') {
                    const parentPath = path.posix.dirname(dirPath);
                    items.push({
                        name: '..',
                        type: 'directory',
                        path: parentPath
                    });
                }

                // 添加目录内容
                list.forEach((item) => {
                    const fullPath = path.posix.join(dirPath, item.filename);
                    const isDirectory = (item.attrs.mode & 0o40000) === 0o40000;
                    
                    items.push({
                        name: item.filename,
                        type: isDirectory ? 'directory' : 'file',
                        path: fullPath,
                        size: item.attrs.size,
                        mtime: item.attrs.mtime * 1000 // 转换为毫秒
                    });
                });

                // 按类型排序：目录在前，文件在后
                items.sort((a, b) => {
                    if (a.type === b.type) {
                        // 特殊处理 . 和 ..
                        if (a.name === '.') return -1;
                        if (b.name === '.') return 1;
                        if (a.name === '..') return -1;
                        if (b.name === '..') return 1;
                        return a.name.localeCompare(b.name);
                    }
                    return a.type === 'directory' ? -1 : 1;
                });

                resolve(items);
            });
        });
    }

    // 格式化文件大小（字节转换为可读格式）
    private _formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 生成webview HTML
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // 从文件读取HTML内容
        const htmlPath = path.join(this._extensionUri.fsPath, 'out', 'ui', 'slidebar', 'browser', 'sftpBrowser.html');
        try {
            return fs.readFileSync(htmlPath, 'utf8');
        } catch (error) {
            console.error('Failed to read HTML file:', error);
            return `
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                    <meta charset="UTF-8">
                    <title>文件浏览器</title>
                </head>
                <body>
                    <div style="padding: 20px; text-align: center; color: red;">
                        无法加载HTML文件，请检查插件安装是否完整。
                    </div>
                </body>
                </html>
            `;
        }
    }
}

// 注册SFTP文件浏览器视图
function registerSftpFileBrowserView(context: vscode.ExtensionContext) {
    const viewProvider = new SftpFileBrowserViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SftpFileBrowserViewProvider.viewType,
            viewProvider
        )
    );

    // 注册刷新命令
    context.subscriptions.push(
        vscode.commands.registerCommand('xtp.terminal.sftpFileBrowser.refresh', () => {
            // 刷新命令由webview内部处理
            viewProvider.refresh();
        })
    );

    // 注册导航到上级目录命令
    context.subscriptions.push(
        vscode.commands.registerCommand('xtp.terminal.sftpFileBrowser.navigateParent', () => {
            viewProvider.navigateParent();
        })
    );

    // 注册下载文件命令
    context.subscriptions.push(
        vscode.commands.registerCommand('xtp.terminal.sftpFileBrowser.download', () => {
            viewProvider.downloadSelected();
        })
    );

    // 注册上传文件命令
    context.subscriptions.push(
        vscode.commands.registerCommand('xtp.terminal.sftpFileBrowser.upload', () => {
            viewProvider.upload();
        })
    );

    // 注册删除文件命令
    context.subscriptions.push(
        vscode.commands.registerCommand('xtp.terminal.sftpFileBrowser.delete', () => {
            viewProvider.deleteSelected();
        })
    );

    // 注册关闭终端命令
    context.subscriptions.push(
        vscode.commands.registerCommand('xtp.terminal.sftpFileBrowser.closeTerminal', (terminalName) => {
            if (terminalName ===viewProvider.getCurrentTerminal()) {
                // 刷新命令由webview内部处理
                viewProvider.refresh();
            }
        })
    );
}

export {
    registerSftpFileBrowserView,
    SftpFileBrowserViewProvider
};