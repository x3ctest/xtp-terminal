import * as vscode from 'vscode';
import * as path from 'path';
import { l10n } from 'vscode';
import { Global } from "./common/global";
import { registerCommands } from './commands';
import { registerContextCallback } from './ui/terminal/contextManager';
import { registerTerminalListView, registerRpcTerminalMgtDealer } from './ui/slidebar/terminalListView';
import { registerTerminalConfigurationView } from './ui/slidebar/terminalConfiguratiionView';
import { registerLogView } from './ui/slidebar/logView';
import { registerScriptView } from './ui/editpanel/scriptView';
import { registerReadOnlyDocument } from './readOnlyDcoument';
import { ServiceManager } from './terminal/serviceManager';
import { XtpAgentManager } from './rpcserver/xtpagent';
import { closeDealer } from './rpcserver/xtpserver';
//import { getGlobalTerminalFont } from './settingManager';

export var extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
	extensionContext = context;
	const serviceManager = new ServiceManager(context);

	registerCommands(context);
	registerTerminalListView(context);
	registerTerminalConfigurationView(context);
	registerLogView(context);
	registerScriptView(context);
	registerContextCallback(context);
	registerReadOnlyDocument(context);
	// 检查并启动xtp-agent
	const agentManager = new XtpAgentManager();
    agentManager.checkAgentRunning().then(pid => {
        if (!pid) {
            // 未运行，启动进程
            agentManager.startAgent(path.join(context.extensionPath, 'bin', 'xtp-agent.exe'));
        } else {
			const msg = l10n.t('xtp.terminal.xagent.running');
            vscode.window.showInformationMessage(msg + `:(PID: ${pid})`);
        }
    });
	//注册终端管理服务
	registerRpcTerminalMgtDealer(context);
}

export function deactivate() { 
	//取消终端管理服务注册
	try {
        if (Global.terminalRpcMgtDealerHandle) {
            closeDealer(Global.terminalRpcMgtDealerHandle);
        }
	} catch (err) {
		const msg = l10n.t('xtp.terminal.xagent.close.error');
		console.error(msg + ':', err);
	}
}
