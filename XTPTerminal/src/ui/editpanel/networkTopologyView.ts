import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ITerminalConfiguration } from '../../terminal/VtyTerminal';
import { NetworkTopologyEditorBase } from './networkTopologyEditorBase';

// 获取当前工作区目录
function getCurrentProjectDir(): string | undefined {
    if (!vscode.workspace.workspaceFolders) {
        return undefined;
    }
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}

/**
 * 网络拓扑视图类（WebviewPanel模式）
 * 通过命令手动打开
 */
export class NetworkTopologyView extends NetworkTopologyEditorBase {
    private _panel: vscode.WebviewPanel | undefined;

    constructor(context: vscode.ExtensionContext) {
        super(context);
    }

    /**
     * 显示网络拓扑视图
     */
    public async show(): Promise<void> {
        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.One);
            return;
        }

        // 创建WebView面板
        this._panel = vscode.window.createWebviewPanel(
            'xtp.networkTopology',
            '网络拓扑编辑器',
            vscode.ViewColumn.One,
            this.getWebviewOptions()
        );

        // 加载终端配置
        const terminals = await this.readTerminalConfig();

        // 设置WebView内容
        this._panel.webview.html = this.getHtmlContent(this._panel.webview, terminals, 'networkTopology');

        // 处理WebView消息
        this._panel.webview.onDidReceiveMessage(async (message) => {
            await this.handleMessage(this._panel!.webview, message);
        });

        // 处理面板关闭
        this._panel.onDidDispose(() => {
            this._panel = undefined;
        });
    }

    /**
     * 从默认配置文件读取终端配置
     */
    private async readTerminalConfig(): Promise<ITerminalConfiguration[]> {
        const projectDir = getCurrentProjectDir();
        if (!projectDir) {
            return [];
        }

        const configPath = path.join(projectDir, 'xtp-default.tbdx');
        const configUri = vscode.Uri.file(configPath);
        return await this.readTerminalConfigFromUri(configUri);
    }

    /**
     * 处理保存配置消息
     */
    protected async handleSaveConfig(webview: vscode.Webview, message: any): Promise<void> {
        const projectDir = getCurrentProjectDir();
        if (!projectDir) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const configPath = path.join(projectDir, 'xtp-default.tbdx');
        const configUri = vscode.Uri.file(configPath);

        try {
            await this.saveTerminalConfigToUri(configUri, message.terminals);
            vscode.window.showInformationMessage('网络拓扑配置已保存');
            webview.postMessage({ command: 'saveSuccess' });
        } catch (error) {
            vscode.window.showErrorMessage('保存配置失败: ' + (error as Error).message);
        }
    }
}

/**
 * 注册网络拓扑视图命令
 */
export function registerNetworkTopologyView(context: vscode.ExtensionContext): void {
    const networkTopologyView = new NetworkTopologyView(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('xtp.network.topology', async () => {
            await networkTopologyView.show();
        })
    );
}