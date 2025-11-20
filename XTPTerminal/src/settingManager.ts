import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';

//const serialPortSettingId = 'SerialTerminal.serial port';
const logSettingId = 'xtp.terminal.log';
const scriptSettingId = 'xtp.terminal.script';
const terminalSettingId = 'xtp.terminal.view';

const configurationsReg: { [Symbol.match](string: string): RegExpMatchArray | null; } = /^(\d+)(n|e|o|)(5|6|7|8|)(1|1.5|2|)$/;
const logSavePathSettingId = 'xtp.terminal.log.savePath';
const logSaveFileSizeLimitId = 'xtp.terminal.log.size';
const scriptSavePathSettingId = 'xtp.terminal.script.savePath';
const logDefaultAddingTimeStampSettingId = 'xtp.terminal.log.defaultAddingTimeStamp';
const terminalViewShowEditAreaSettingId = 'xtp.terminal.view.showEditArea';

function getLogDirUri(): vscode.Uri {
    let folderUri = getSettingFolderOrSetDefault(logSavePathSettingId, vscode.Uri.joinPath(
        vscode.Uri.file(os.homedir()),
        "xtp",
        'terminalLog'
    ).fsPath);
    return folderUri;
}

function getLogSizeLimit() {
    return getSettingOrSetDefault(logSaveFileSizeLimitId, 20000000);
}

function getScriptDirUri(): vscode.Uri {
    return getSettingFolderOrSetDefault(scriptSavePathSettingId, vscode.Uri.joinPath(
        vscode.Uri.file(os.homedir()),
        "xtp",
        'scriptNoteBook'
    ).fsPath);
}

function getLogDefaultAddingTimeStamp(): boolean {
    return getSettingOrSetDefault(logDefaultAddingTimeStampSettingId, true);
}

function getSettingFolderOrSetDefault(section: string, defaultName: string): vscode.Uri {
    let folderPath = getSettingOrSetDefault(section, defaultName);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    return vscode.Uri.file(folderPath);
}

function getTerminalViewShowEditArea(): boolean {
    return getSettingOrSetDefault(terminalViewShowEditAreaSettingId, true);
}

function getGlobalTerminalFont(fontFamily: string, fontSize: number, lineHeight: number): void {
    getSettingOrSetDefault("terminal.integrated.fontFamily", fontFamily);
    getSettingOrSetDefault("terminal.integrated.fontSize", fontSize);
    getSettingOrSetDefault("terminal.integrated.lineHeight", lineHeight);
}

function getSettingOrSetDefault<T>(section: string, defaultValue: T): T {
    let value = vscode.workspace.getConfiguration().get<T>(section);
    if (undefined === value || value === '') {
        vscode.workspace.getConfiguration().update(
            section,
            defaultValue,
            vscode.ConfigurationTarget.Global
        );
        return defaultValue;
    }
    return value;
}

export {
    logSettingId,
    logSaveFileSizeLimitId,
    scriptSettingId,
    configurationsReg,
    terminalSettingId,
    getLogDirUri,
    getLogSizeLimit,
    getScriptDirUri,
    getLogDefaultAddingTimeStamp,
    getTerminalViewShowEditArea,
    getGlobalTerminalFont
};