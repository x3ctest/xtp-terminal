import * as vscode from 'vscode';
import * as fs from 'fs';

import { l10n } from 'vscode';
import { getLogDefaultAddingTimeStamp, getLogDirUri, getScriptDirUri, getLogSizeLimit, logSettingId, terminalSettingId,logSaveFileSizeLimitId, scriptSettingId } from './settingManager';

function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.openLogConfigaration",
            () => { vscode.commands.executeCommand("workbench.action.openSettings", logSettingId); })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.openScriptConfigaration",
            () => { vscode.commands.executeCommand("workbench.action.openSettings", scriptSettingId); })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.openTerminalConfiguration",
            () => { vscode.commands.executeCommand("workbench.action.openSettings", terminalSettingId); })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.openTreeItemResource",
            openTreeItemResource
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.revealInExplorer",
            revealInExplorer
        )
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.revealScriptNoteBooks",
            () => vscode.commands.executeCommand("revealFileInOS", getScriptDirUri())
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.revealLogs",
            () => vscode.commands.executeCommand("revealFileInOS", getLogDirUri())
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.deleteResource",
            deleteResource
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.viewReadOnlyDocument",
            viewReadOnlyDocument
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.clearTerminal",
            clearTerminal,
        )
    );

    /*context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.terminalListTree.add",
            openConnectConfiguration,
        )
    );*/

    // 打开网络拓扑编辑器
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.openNetworkTopologyEditor",
            async () => {
                await vscode.commands.executeCommand("xtp.network.topology");
            }
        )
    );
    
    // 关闭终端
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "xtp.terminal.close",
            (terminalName: string) => {
                const { terminalManager } = require('./terminal/terminalManager');
                terminalManager.close(terminalName);
            }
        )
    );
}

/*async function openConnectConfiguration(context?: any) {
    connectConfiguration.openConnect();
}

async function startSaveLog() {
    const terminal = vscode.window.activeTerminal;
    if (!terminal) {
        return;
    }

    const terminalInstance = terminalManager.getFromTerminal(terminal);
    if (!terminalInstance) {
        return;
    }

    let timestamp = getLogDefaultAddingTimeStamp();
    let logSize = getLogSizeLimit();
    let logPath = getLogDirUri().fsPath;
    setTernimalRecordingLog(await terminalInstance.startLogging(logPath, logSize, timestamp));
}

function stopSaveLog() {
    const terminal = vscode.window.activeTerminal;

    if (!terminal) {
        return;
    }

    const terminalInstance = terminalManager.getFromTerminal(terminal);
    if (!terminalInstance) {
        return;
    }

    setTernimalRecordingLog(terminalInstance.stopLogging());
}
*/
function openTreeItemResource(context: vscode.TreeItem) {
    vscode.commands.executeCommand("vscode.open", context.resourceUri);
}

function revealInExplorer(context: vscode.TreeItem) {
    vscode.commands.executeCommand("revealFileInOS", context.resourceUri);
}

async function createScriptNotebook() {
    const fileName = await vscode.window.showInputBox({
        title: l10n.t("Please enter the script notebook file name"),
        prompt: l10n.t("Only letters, numbers, `_` and `-` are allowed"),
        validateInput: (value: string) => {
            const result = value.match(/^[0-9a-zA-Z_-]*$/g)?.toString();
            return result ? undefined : l10n.t("Only letters, numbers, `_` and `-` are allowed");
        }
    });
    if (!fileName) {
        return false;
    }
    const scriptNotebookFile = vscode.Uri.joinPath(getScriptDirUri(), fileName + ".xtps");
    fs.writeFileSync(scriptNotebookFile.fsPath, "");
    vscode.commands.executeCommand("vscode.open", scriptNotebookFile);
}
async function deleteResource(context: vscode.TreeItem) {
    if (context.resourceUri) {
        await vscode.workspace.fs.delete(context.resourceUri);
    }
}

async function viewReadOnlyDocument(uri: vscode.Uri) {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse('readonly:' + uri.path));
    await vscode.window.showTextDocument(doc, { preview: false });
}

function clearTerminal() {
    vscode.commands.executeCommand(
        "workbench.action.terminal.clear"
    );
}

export { registerCommands };