import * as vscode from 'vscode';
import * as path from 'path';
import { ITerminalConfiguration } from '../../terminal/VtyTerminal';
import { Global } from '../../common/global';

/**
 * 网络拓扑编辑器基类
 * 提取WebviewPanel和CustomEditorProvider的公共逻辑
 */
export abstract class NetworkTopologyEditorBase {
    protected readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * 获取WebView的HTML内容
     * @param webview WebView对象
     * @param terminals 终端配置数组
     * @param editorMode 编辑器模式标记（'networkTopology' 或 'customEditor'）
     */
    protected getHtmlContent(
        webview: vscode.Webview,
        terminals: ITerminalConfiguration[],
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
        // 传递终端配置给Vue应用
        window.terminalConfig = ${JSON.stringify(terminals)};
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
    protected getLocalResourceRoots(): vscode.Uri[] {
        return [
            vscode.Uri.file(path.join(this.context.extensionPath, 'public')),
            vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'webview')),
            vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
        ];
    }

    /**
     * 获取WebView配置选项
     */
    protected getWebviewOptions(): vscode.WebviewOptions {
        return {
            enableScripts: true,
            localResourceRoots: this.getLocalResourceRoots(),
            enableCommandUris: true
        };
    }

    /**
     * 处理WebView消息
     * @param webview WebView对象
     * @param message 消息对象
     */
    protected async handleMessage(
        webview: vscode.Webview,
        message: any
    ): Promise<void> {
        switch (message.command) {
            /*case 'saveConfig':
                await this.handleSaveConfig(webview, message);
                break;*/
            case 'addTerminal':
                await this.handleAddTerminal(message);
                break;
            case 'updateConfig':
                await this.handleUpdateConfig(webview, message);
                break;
        }
    }

    /**
     * 处理保存配置消息
     * 子类需要实现具体的保存逻辑
     */
    protected abstract handleSaveConfig(webview: vscode.Webview, message: any): Promise<void>;

    /**
     * 处理添加终端消息
     */
    protected async handleAddTerminal(message: any): Promise<void> {
        // 默认实现：空操作，子类可以覆盖
    }

    /**
     * 处理更新配置消息
     */
    protected async handleUpdateConfig(webview: vscode.Webview, message: any): Promise<void> {
        // 默认实现：调用保存配置
        await this.handleSaveConfig(webview, message);
    }

    /**
     * 保存终端配置到指定URI
     */
    protected async saveTerminalConfigToUri(
        uri: vscode.Uri,
        terminals: ITerminalConfiguration[]
    ): Promise<void> {
        const config = {
            description: 'xterm configuration profile',
            version: '0.0.1',
            terminals: terminals
        };
        const content = JSON.stringify(config, null, 2);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
    }

    /**
     * 从指定URI读取终端配置
     */
    protected async readTerminalConfigFromUri(uri: vscode.Uri): Promise<ITerminalConfiguration[]> {
        try {
            const fileContent = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(fileContent).toString('utf8');
            const config = JSON.parse(content);
            
            // 处理旧格式（兼容）
            if (config.terminals && Array.isArray(config.terminals)) {
                const terminals = config.terminals.map((terminal: any) => {
                    // 如果终端配置没有options字段，将其转换为新格式
                    if (!terminal.options) {
                        // 提取除了name和type之外的所有字段作为options
                        const { name, type, ...options } = terminal;
                        return {
                            name,
                            type,
                            options
                        };
                    }
                    return terminal;
                });
                return terminals;
            }
            return [];
        } catch (error) {
            return [];
        }
    }
}