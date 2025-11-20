import * as vscode from 'vscode';
import { VtyTerminal, ITerminalConfiguration } from './VtyTerminal';
import { getTerminalViewShowEditArea } from "../settingManager";

const terminalManager = new (class {
    private terminals = new Map<string, VtyTerminal>();
    async showTerminal (name: string, cfg: ITerminalConfiguration, closeCallback?: () => void): Promise<void> {
        var exist = this.getFromTerminalName(name);
        if (exist) {
            exist.show();
        } else {
            var showInEditorArea = getTerminalViewShowEditArea();
            const terminal : VtyTerminal = await VtyTerminal.create(name, cfg, false, closeCallback, showInEditorArea);
            this.terminals.set(name, terminal);
        }
    }

    getFromTerminal(terminal: vscode.Terminal): VtyTerminal | undefined {
        return this.terminals.get(terminal.name);
    }

    getFromTerminalName(terminalName: string): VtyTerminal | undefined {
        return this.terminals.get(terminalName);
    }

    remove(terminalName: string): boolean {
        return this.terminals.delete(terminalName);
    }

    removeAll(): void {
        for (const terminal of this.terminals.values()) {
            terminal.close();
        }
        this.terminals.clear();
    }
})();

export { 
    terminalManager 
};