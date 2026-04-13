import * as vscode from 'vscode';
import { getScriptDirUri } from '../../settingManager';
import { FileTreeDataProvider } from '../slidebar/FileTreeDataProvider';

function registerScriptView(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            "xtp.terminal.scriptsNotebooks",
            new FileTreeDataProvider(
                ['.xtps'],
                getScriptDirUri,
                {
                    command: "xtp.terminal.openTreeItemResource",
                    readdirErrorMessagePrefix: vscode.l10n.t("Script path error: "),
                    icon: vscode.ThemeIcon.File/*new vscode.ThemeIcon("notebook")*/,
                }
            )
        )
    );
}

export { registerScriptView };