import * as vscode from 'vscode';
import { terminalManager } from '../../terminal/terminalManager';

function registerContextCallback(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTerminal((terminal) => {
            if (!terminal) {
                return;
            }
            
            const vty = terminalManager.getFromTerminal(terminal);
            if (!vty) {
                setTernimalFocus(false);
                return;
            } else {
                setTernimalFocus(true);
            setTernimalRecordingLog(vty.state.loging);
            }
        }));
}

function setTernimalRecordingLog(value: boolean) {
    vscode.commands.executeCommand(
        "setContext",
        "xtp.terminal.setTernimalRecordingLog",
        value
    );
}

function setTernimalFocus(value: boolean) {
    vscode.commands.executeCommand(
        "setContext",
        "xtp.terminal.setTernimalFocus",
        value
    );
}

export { registerContextCallback, setTernimalRecordingLog };