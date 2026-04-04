import * as vscode from 'vscode';
import * as path from 'path';
import { ITerminalConfiguration } from '../../terminal/VtyTerminal';
import { Global } from '../../common/global';
import { listSerialPort } from '../../sessions/serial/serialSession';

/**
 * 网络拓扑编辑器Provider（CustomEditor模式）
 * 用于打开.tbdx文件
 */
export class NetworkTopologyEditorProvider implements vscode.CustomEditorProvider {
    private static readonly viewType = 'xtp.terminal.networkTopologyEditor';
    private readonly webviewPanels = new Map<string, vscode.WebviewPanel>();
    private currentDocumentUri: vscode.Uri | undefined;
    private readonly context: vscode.ExtensionContext;
    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent>();
    public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        
        // 注册Code Runner命令处理器
        /*
        context.subscriptions.push(
            vscode.commands.registerCommand('code-runner.run', async () => {
                // 获取当前活动的编辑器窗口
                //const activeEditor = vscode.window.activeTextEditor;
                if (this.currentDocumentUri) {
                    const documentUri = this.currentDocumentUri;//activeEditor.document.uri;
                    // 检查是否是网络拓扑编辑器窗口
                    const webviewPanel = this.webviewPanels.get(documentUri.toString());
                    if (webviewPanel) {
                        // 向webview发送消息，触发runCode方法
                        webviewPanel.webview.postMessage({ command: 'runCode' });
                    }
                }
            })
        );*/
    }

    /**
     * 获取WebView的HTML内容
     * 基于Device和Link格式传递数据
     */
    private getHtmlContent(
        webview: vscode.Webview,
        devices: any[],
        links: any[],
        editorMode: 'networkTopology' | 'customEditor'
    ): string {
        const vendorScriptPath = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'webview', 'js', 'vendor.js'))
        );

        const appScriptPath = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'webview', 'js', 'app.js'))
        );

        const vueStylePath = webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'webview', 'theme', 'auto.css'))
        );

        // 根据模式设置不同的标记
        const editorFlags = editorMode === 'networkTopology'
            ? 'window.isNetworkTopologyEditor = true;'
            : 'window.isCustomEditor = true;';

        // 处理设备类型树中的图标路径
        const deviceTypeTreeWithIcons = Global.deviceTypeTree.map((device: any) => {
            if (device.icon && device.icon.startsWith('./icons/')) {
                // 移除./前缀
                const iconRelPath = device.icon.replace('./', '');
                const iconPath = path.join(this.context.extensionPath, 'resources', 'network', iconRelPath);
                const iconUri = webview.asWebviewUri(vscode.Uri.file(iconPath));
                return { ...device, icon: iconUri.toString() };
            }
            return device;
        });

        return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>网络拓扑编辑器</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};">
    <link rel="stylesheet" href="${vueStylePath}">
    <style>
        html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        #app {
            height: 100%;
            width: 100%;
        }
    </style>
</head>
<body>
    <div id="app"></div>
    <script>
        // 标记编辑器模式
        ${editorFlags}
        // 传递设备配置给Vue应用（基于Device和Link格式）
        window.devices = ${JSON.stringify(devices)};
        window.links = ${JSON.stringify(links)};
        // 传递设备类型树结构给Vue应用
        window.deviceTypeTree = ${JSON.stringify(deviceTypeTreeWithIcons)};
    </script>
    <script src="${vendorScriptPath}"></script>
    <script src="${appScriptPath}"></script>
</body>
</html>
`;
    }

    /**
     * 获取WebView的本地资源根目录
     */
    private getLocalResourceRoots(): vscode.Uri[] {
        return [
            vscode.Uri.file(path.join(this.context.extensionPath, 'public')),
            vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'webview')),
            vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
        ];
    }

    /**
     * 获取WebView配置选项
     */
    private getWebviewOptions(): vscode.WebviewOptions {
        return {
            enableScripts: true,
            localResourceRoots: this.getLocalResourceRoots()
        };
    }

    /**
     * 保存终端配置到指定URI
     * 基于Device和Link格式，终端访问信息基于Device保存
     */
    private async saveTerminalConfigToUri(
        uri: vscode.Uri,
        devices: any[],
        links: any[] = []
    ): Promise<void> {
        // 处理设备数据，按照要求格式化
        const formattedDevices = devices.map(device => {
            const formattedDevice: any = {
                name: device.name,
                type: device.type
            };
            
            // 添加position对象（可选）
            if (device.x !== undefined && device.y !== undefined) {
                formattedDevice.position = {
                    x: device.x,
                    y: device.y
                };
            }
            
            // 只保留access-terminal，不保存单独的访问类型信息
            if (device['access-terminal']) {
                formattedDevice['access-terminal'] = device['access-terminal'];
            }
            
            // 不保存icon参数
            
            return formattedDevice;
        });
        
        const config = {
            description: 'xterm configuration profile',
            version: '0.0.1',
            devices: formattedDevices,
            links: links
        };
        const content = JSON.stringify(config, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
    }

    /**
     * 从指定URI读取终端配置
     * 基于Device和Link格式，终端访问信息基于Device获取
     */
    private async readTerminalConfigFromUri(uri: vscode.Uri): Promise<{ devices: any[], terminals: ITerminalConfiguration[], links: any[] }> {
        try {
            const fileContent = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(fileContent).toString('utf8');
            const config = JSON.parse(content);
            
            let devices: any[] = [];
            let terminals: ITerminalConfiguration[] = [];
            let links: any[] = [];
            
            // 基于Device格式读取，终端访问信息包含在access-terminal中
            if (config.devices && Array.isArray(config.devices)) {
                // 处理设备数据，适应新的格式
                devices = config.devices.map((device: any) => {
                    const processedDevice: any = {
                        name: device.name,
                        type: device.type
                    };
                    
                    // 处理位置信息，支持旧格式（直接在根级别）和新格式（在position对象中）
                    if (device.position && device.position.x !== undefined && device.position.y !== undefined) {
                        processedDevice.position = {
                            x: device.position.x,
                            y: device.position.y
                        };
                    } else  {
                        processedDevice.position = {
                            x: 0,
                            y: 0
                        };
                    }
                    
                    // 处理终端访问信息
                    if (device['access-terminal']) {
                        processedDevice['access-terminal'] = device['access-terminal'];
                    }
                    
                    return processedDevice;
                });
                
                // 将Device转换为TerminalConfiguration格式，用于终端列表显示
                terminals = config.devices
                    .map((device: any) => {
                        const terminal: ITerminalConfiguration = {
                            name: device.name,
                            type: 'ssh',
                            options: {}
                        };
                        
                        // 从access-terminal获取终端访问信息
                        if (device['access-terminal']) {
                            terminal.type = device['access-terminal'].type || 'ssh';
                            terminal.options = device['access-terminal'].options || {};
                        }
                        
                        return terminal;
                    })
                    .filter((terminal: ITerminalConfiguration) => {
                        // 过滤掉DUMMY和RPC类型的设备，它们不应该显示在终端列表中
                        return terminal.type !== 'dummy' && terminal.type !== 'rpc';
                    });
                
                // 读取links字段
                links = config.links || [];
            }
            
            return { devices, terminals, links };
        } catch (error) {
            return { devices: [], terminals: [], links: [] };
        }
    }

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.window.registerCustomEditorProvider(
            NetworkTopologyEditorProvider.viewType,
            new NetworkTopologyEditorProvider(context),
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                },
                supportsMultipleEditorsPerDocument: false
            }
        );
    }

    public async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.webviewPanels.set(document.uri.toString(), webviewPanel);
        this.currentDocumentUri = document.uri;

        webviewPanel.webview.options = this.getWebviewOptions();

        // 读取文档内容
        const { devices, terminals, links } = await this.readTerminalConfigFromUri(document.uri);

        // 设置webview内容，使用devices和links格式
        webviewPanel.webview.html = this.getHtmlContent(webviewPanel.webview, devices, links, 'customEditor');

        // 处理webview消息
        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            await this.handleMessage(webviewPanel.webview, message);
        });

        // 发送初始配置，使用devices格式
        webviewPanel.webview.postMessage({
            command: 'init',
            devices: devices,
            links: links
        });

        // 设置window.vscode对象
        webviewPanel.webview.onDidReceiveMessage(message => {
            if (message.command === 'ready') {
                webviewPanel.webview.postMessage({
                    command: 'init',
                    devices: devices,
                    links: links
                });
            }
        });

        // 刷新终端列表，传递文档路径作为测试床路径
        await vscode.commands.executeCommand('xtp.terminal.updateTerminalList', terminals, document.uri.fsPath);

        // 清理订阅
        webviewPanel.onDidDispose(() => {
            this.webviewPanels.delete(document.uri.toString());
            
            // 关闭该测试床中的所有已打开终端窗口
            for (const terminal of terminals) {
                vscode.commands.executeCommand('xtp.terminal.close', terminal.name);
            }
            
            // 从terminalListView中删除该文件对应的设备终端列表
            vscode.commands.executeCommand('xtp.terminal.removeTestbed', document.uri.fsPath);
        });
    }

    /**
     * 处理保存配置消息
     * 基于Device和Link格式保存，终端访问信息基于Device的access-terminal
     */
    protected async handleSaveConfig(webview: vscode.Webview, message: any): Promise<void> {
        if (!this.currentDocumentUri) {
            vscode.window.showErrorMessage('No document URI available');
            return;
        }

        try {
            // 从message中获取devices和links数据
            const devices = message.devices || [];
            const links = message.links || [];
            
            await this.saveTerminalConfigToUri(this.currentDocumentUri, devices, links);
            webview.postMessage({ command: 'saveSuccess' });
            
            // 将Device转换为TerminalConfiguration格式以更新终端列表
            const terminals = devices
                .map((device: any) => {
                    const terminal: ITerminalConfiguration = {
                        name: device.name,
                        type: 'ssh',
                        options: {}
                    };
                    
                    // 从access-terminal获取终端访问信息
                    if (device['access-terminal']) {
                        terminal.type = device['access-terminal'].type || 'ssh';
                        terminal.options = device['access-terminal'].options || {};
                    }
                    
                    return terminal;
                })
                .filter((terminal: ITerminalConfiguration) => {
                    // 过滤掉DUMMY和RPC类型的设备，它们不应该显示在终端列表中
                    return terminal.type !== 'dummy' && terminal.type !== 'rpc';
                });
            
            // 保存后更新终端列表，传递文档路径作为测试床路径
            await vscode.commands.executeCommand('xtp.terminal.updateTerminalList', terminals, this.currentDocumentUri.fsPath);
        } catch (error) {
            vscode.window.showErrorMessage('保存配置失败: ' + (error as Error).message);
        }
    }

    protected async handleMessage(webview: vscode.Webview, message: any): Promise<void> {
        // 从webviewPanel获取对应的文档URI
        let documentUri: vscode.Uri | undefined;
        for (const [uriStr, panel] of this.webviewPanels) {
            if (panel.webview === webview) {
                documentUri = vscode.Uri.parse(uriStr);
                break;
            }
        }
        
        if (!documentUri) {
            return;
        }
        
        switch (message.command) {
            case 'save':
                await this.handleSaveConfig(webview, message);
                break;
            case 'selectDevice':
                // 当选择设备时，通过VS Code命令刷新terminalListView的选择
                await vscode.commands.executeCommand('xtp.terminal.selectTerminal', message.deviceName, documentUri.fsPath);
                break;
            case 'removeDevice':
                // 当删除设备时，通过VS Code命令从测试床中移除终端
                if (documentUri) {
                    await vscode.commands.executeCommand('xtp.terminal.removeTerminalFromTestbed', message.deviceName, documentUri.fsPath);
                }
                // 触发文档变更事件，标记为dirty
                this._onDidChangeCustomDocument.fire({
                    document: { uri: documentUri, dispose: () => {} } as vscode.CustomDocument,
                    undo: () => {},
                    redo: () => {}
                });
                break;
            case 'addDevice':
            case 'addConnection':
            case 'removeConnection':
            case 'updateDevice':
            case 'updateConnection':
                // 触发文档变更事件，标记为dirty
                this._onDidChangeCustomDocument.fire({
                    document: { uri: documentUri, dispose: () => {} } as vscode.CustomDocument,
                    undo: () => {},
                    redo: () => {}
                });
                break;
            /*case 'runCode':
                // 当点击Run Code图标时，打开所有telnet/ssh/serial类型的终端窗口
                if (message.devices) {
                    for (const device of message.devices) {
                        if (device['access-terminal']) {
                            const terminalType = device['access-terminal'].type;
                            if (terminalType === 'ssh' || terminalType === 'telnet' || terminalType === 'serial') {
                                // 构建终端配置
                                const terminalConfig = {
                                    name: device.name,
                                    type: terminalType,
                                    options: device['access-terminal'].options || {}
                                };
                                // 打开终端窗口
                                await vscode.commands.executeCommand('xtp.terminal.terminalListTree.connect', terminalConfig);
                            }
                        }
                    }
                }
                break;*/
            case 'openTerminal':
                // 当双击设备图标时，打开终端窗口
                if (message.device) {
                    const device = message.device;
                    if (device['access-terminal']) {
                        const terminalType = device['access-terminal'].type;
                        if (terminalType === 'ssh' || terminalType === 'telnet' || terminalType === 'serial') {
                            // 构建终端配置
                            const terminalConfig = {
                                name: device.name,
                                type: terminalType,
                                options: device['access-terminal'].options || {}
                            };
                            // 打开终端窗口
                            await vscode.commands.executeCommand('xtp.terminal.terminalListTree.connect', terminalConfig);
                        }
                    }
                }
                break;
            case 'listSerialPorts':
                // 处理请求串口列表的命令
                try {
                    const ports = await listSerialPort();
                    webview.postMessage({
                        command: 'serialPorts',
                        ports: ports
                    });
                } catch (error) {
                    console.error('Failed to list serial ports:', error);
                    webview.postMessage({
                        command: 'serialPorts',
                        ports: []
                    });
                }
                break;
        }
    }



    public async saveCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Promise<void> {
        // 从webview获取当前设备和连接信息
        const webviewPanel = this.webviewPanels.get(document.uri.toString());
        if (!webviewPanel) {
            vscode.window.showErrorMessage('无法找到webview面板');
            return;
        }

        // 请求webview发送当前数据
        const devicesAndLinks = await new Promise<{ devices: any[], links: any[] }>((resolve) => {
            const listener = (message: any) => {
                if (message.command === 'currentData') {
                    webviewPanel.webview.onDidReceiveMessage(listener);
                    resolve({ devices: message.devices, links: message.links });
                }
            };
            webviewPanel.webview.onDidReceiveMessage(listener);
            webviewPanel.webview.postMessage({ command: 'getCurrentData' });
        });

        // 保存设备和连接信息到文件
        await this.saveTerminalConfigToUri(document.uri, devicesAndLinks.devices, devicesAndLinks.links);

        // 转换devices为terminals格式以更新终端列表
        const terminals = devicesAndLinks.devices
            .map((device: any) => {
                const terminal: ITerminalConfiguration = {
                    name: device.name,
                    type: 'ssh',
                    options: {}
                };
                
                // 从access-terminal获取终端访问信息
                if (device['access-terminal']) {
                    terminal.type = device['access-terminal'].type || 'ssh';
                    terminal.options = device['access-terminal'].options || {};
                }
                
                return terminal;
            })
            .filter((terminal: ITerminalConfiguration) => {
                // 过滤掉DUMMY和RPC类型的设备，它们不应该显示在终端列表中
                return terminal.type !== 'dummy' && terminal.type !== 'rpc';
            });
        
        // 保存后更新终端列表，传递文档路径作为测试床路径
        await vscode.commands.executeCommand('xtp.terminal.updateTerminalList', terminals, document.uri.fsPath);
    }

    public async saveCustomDocumentAs(document: vscode.CustomDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
        // 从webview获取当前设备和连接信息
        const webviewPanel = this.webviewPanels.get(document.uri.toString());
        if (!webviewPanel) {
            vscode.window.showErrorMessage('无法找到webview面板');
            return;
        }

        // 请求webview发送当前数据
        const devicesAndLinks = await new Promise<{ devices: any[], links: any[] }>((resolve) => {
            const listener = (message: any) => {
                if (message.command === 'currentData') {
                    webviewPanel.webview.onDidReceiveMessage(listener);
                    resolve({ devices: message.devices, links: message.links });
                }
            };
            webviewPanel.webview.onDidReceiveMessage(listener);
            webviewPanel.webview.postMessage({ command: 'getCurrentData' });
        });

        // 保存设备和连接信息到目标文件
        await this.saveTerminalConfigToUri(destination, devicesAndLinks.devices, devicesAndLinks.links);

        // 转换devices为terminals格式以更新终端列表
        const terminals = devicesAndLinks.devices
            .map((device: any) => {
                const terminal: ITerminalConfiguration = {
                    name: device.name,
                    type: 'ssh',
                    options: {}
                };
                
                // 从access-terminal获取终端访问信息
                if (device['access-terminal']) {
                    terminal.type = device['access-terminal'].type || 'ssh';
                    terminal.options = device['access-terminal'].options || {};
                }
                
                return terminal;
            })
            .filter((terminal: ITerminalConfiguration) => {
                // 过滤掉DUMMY和RPC类型的设备，它们不应该显示在终端列表中
                return terminal.type !== 'dummy' && terminal.type !== 'rpc';
            });
        
        // 保存后更新终端列表，传递目标文档路径作为测试床路径
        await vscode.commands.executeCommand('xtp.terminal.updateTerminalList', terminals, destination.fsPath);
    }

    public async revertCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Promise<void> {
        const webviewPanel = this.webviewPanels.get(document.uri.toString());
        if (webviewPanel) {
            const { devices, links } = await this.readTerminalConfigFromUri(document.uri);
            webviewPanel.webview.postMessage({
                command: 'updateConfig',
                devices: devices,
                links: links
            });
        }
    }

    public async backupCustomDocument(document: vscode.CustomDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
        const backupId = await this.createBackup(document.uri);
        return {
            delete: async () => {
                // 清理备份
            },
            id: backupId
        };
    }

    private async createBackup(uri: vscode.Uri): Promise<string> {
        const content = await vscode.workspace.fs.readFile(uri);
        const backupUri = uri.with({ scheme: 'untitled', path: uri.path + '.backup' });
        await vscode.workspace.fs.writeFile(backupUri, content);
        return backupUri.toString();
    }

    public async openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): Promise<vscode.CustomDocument> {
        return { uri, dispose: () => {} };
    }
}