import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { l10n } from 'vscode';
import { Global } from "./common/global";
import { registerCommands } from './commands';
import { registerContextCallback } from './ui/terminal/contextManager';
import { registerTerminalListView } from './ui/slidebar/terminalListView';

//import { registerTerminalConfigurationView } from './ui/slidebar/terminalConfiguratiionView';
import { registerLogView } from './ui/slidebar/logView';
//import { registerScriptView } from './ui/editpanel/scriptView';
import { registerReadOnlyDocument } from './readOnlyDcoument';
import { ServiceManager } from './terminal/serviceManager';
import { ZmqRouterServiceImpl } from './rpcserver/zmqRouterService';
import { ITerminalConfiguration } from './terminal/VtyTerminal';
import { NetworkTopologyEditorProvider } from './ui/editpanel/networkTopologyEditorProvider';
import { registerNetworkTopologyView } from './ui/editpanel/networkTopologyView';
//import { getGlobalTerminalFont } from './settingManager';

export var extensionContext: vscode.ExtensionContext;

export async function activate(context: vscode.ExtensionContext) {
	extensionContext = context;
	const serviceManager = new ServiceManager(context);

	// 读取 model.json 文件并存储到 Global 类中
	const modelJsonPath = path.join(context.extensionPath, 'resources', 'network', 'model.json');
	try {
		const modelJsonContent = await fs.readFile(modelJsonPath, 'utf8');
		const modelData = JSON.parse(modelJsonContent);
		Global.deviceTypeTree = modelData.models;
	} catch (error) {
		console.error('读取 model.json 文件失败:', error);
	}

	registerCommands(context);
	// 注册终端列表视图
	registerTerminalListView(context);
	// 注册网络拓扑编辑器
	NetworkTopologyEditorProvider.register(context);
	// 注册网络拓扑视图
	registerNetworkTopologyView(context);
	//registerTerminalConfigurationView(context);
	registerLogView(context);
	//registerScriptView(context);
	registerContextCallback(context);
	registerReadOnlyDocument(context);
	
	// 初始化并启动ZMQ路由服务（非阻塞方式）
	const zmqService = ZmqRouterServiceImpl.getInstance();
	zmqService.start().catch(err => {
		const msg = l10n.t('xtp.terminal.xagent.start.error');
		console.error(msg + ':', err);
	});	
}

export function deactivate() { 
	// 清理ZMQ路由服务
	try {
        const zmqService = ZmqRouterServiceImpl.getInstance();
        zmqService.stop();
	} catch (err) {
		const msg = l10n.t('xtp.terminal.xagent.close.error');
		console.error(msg + ':', err);
	}
}
