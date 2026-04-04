"use strict";
import * as vscode from "vscode";
import { join } from "path";
import * as path from 'path';
import * as fs from 'fs';

export class Global {

    public static context: vscode.ExtensionContext;
    private static mysqlStatusBarItem: vscode.StatusBarItem;
    public static deviceTypeTree: any[] = [];

    public static getExtPath(...paths: string[]) {
        return join(Global.context.extensionPath, ...paths)
    }

    /*public static updateStatusBarItems(activeConnection: Node) {
        if (Global.mysqlStatusBarItem) {
            Global.mysqlStatusBarItem.text = Global.getStatusBarItemText(activeConnection);
        } else {
            Global.mysqlStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
            Global.mysqlStatusBarItem.command='mysql.db.active'
            Global.mysqlStatusBarItem.text = Global.getStatusBarItemText(activeConnection);
            Global.mysqlStatusBarItem.show();
        }
    }

    private static getStatusBarItemText(activeConnection: Node): string {
        return `$(server) ${activeConnection.getHost()}` + (activeConnection.schema ? ` $(schema) ${activeConnection.schema}` : "");
    }*/
}

/**
 * FileManager 类用于管理文件的创建、读取、写入和显示操作。
 * 提供了与 VS Code 工作区和文件系统交互的功能。
 */
export class FileManager {

    // 存储路径，用于保存文件的全局存储目录
    public static storagePath: string;

    /**
     * 初始化 FileManager，设置全局存储路径。
     * @param context VS Code 扩展上下文，用于获取全局存储路径。
     */
    public static init(context: vscode.ExtensionContext) {
        this.storagePath = context.globalStoragePath;
    }

    /**
     * 显示指定文件的内容。
     * 如果文件不存在，则会创建一个空文件。
     * @param fileName 文件名，可以是绝对路径或相对路径。
     * @returns 返回一个 Promise，解析为 VS Code 的 TextEditor 实例。
     */
    /*public static show(fileName: string): Promise<vscode.TextEditor> {
        if (!this.storagePath) { 
            vscode.window.showErrorMessage("FileManager is not init!"); 
        }
        if (!fileName) { 
            return; 
        }

        // 解析文件路径，如果是相对路径，则拼接到存储路径下
        const recordPath = path.isAbsolute(fileName) ? fileName : `${this.storagePath}/${fileName}`;

        // 检查文件所在的目录是否存在，不存在则递归创建
        this.check(path.resolve(recordPath, '..'));

        // 如果文件不存在，则创建一个空文件
        if (!fs.existsSync(recordPath)) {
            fs.appendFileSync(recordPath, "");
        }

        // 打开文件并显示在 VS Code 编辑器中
        const openPath = vscode.Uri.file(recordPath);
        return new Promise((resolve) => {
            vscode.workspace.openTextDocument(openPath).then(async (doc) => {
                resolve(await vscode.window.showTextDocument(doc));
            });
        });
    }*/

    /**
     * 记录内容到指定文件。
     * 如果文件不存在，则会创建文件。
     * @param fileName 文件名，可以是绝对路径或相对路径。
     * @param content 要写入的内容。
     * @param model 写入模式，支持覆盖写入（WRITE）或追加写入（APPEND）。
     * @returns 返回一个 Promise，解析为文件的绝对路径。
     */
    public static record(fileName: string, content: string, model?: FileModel): Promise<string> {
        if (!this.storagePath) { 
            vscode.window.showErrorMessage("FileManager is not init!"); 
        }
        if (!fileName) { 
            //return null; 
        }

        // 移除文件名中的非法字符
        fileName = fileName.replace(/[\:\*\?"\<\>]*/g, "");

        return new Promise((resolve) => {
            const recordPath = `${this.storagePath}/${fileName}`;

            // 检查文件所在的目录是否存在，不存在则递归创建
            this.check(path.resolve(recordPath, '..'));

            // 如果存储路径不存在，则递归创建
            if (!fs.existsSync(this.storagePath)) {
                fs.mkdirSync(this.storagePath, { recursive: true });
            }

            // 根据写入模式（覆盖或追加）写入内容
            if (model == FileModel.WRITE) {
                fs.writeFileSync(recordPath, `${content}`, { encoding: 'utf8' });
            } else {
                fs.appendFileSync(recordPath, `${content}`, { encoding: 'utf8' });
            }

            resolve(recordPath);
        });
    }

    /**
     * 获取指定文件的绝对路径。
     * @param fileName 文件名，可以是相对路径。
     * @returns 返回文件的绝对路径。
     */
    public static getPath(fileName: string) {
        return `${this.storagePath}/${fileName}`;
    }

    /**
     * 检查指定路径是否存在，如果不存在则递归创建。
     * @param checkPath 要检查的路径。
     */
    private static check(checkPath: string) {
        if (!fs.existsSync(checkPath)) { 
            this.recursiseCreate(checkPath); 
        }
    }

    /**
     * 递归创建文件夹路径。
     * @param folderPath 要创建的文件夹路径。
     */
    private static recursiseCreate(folderPath: string) {
        folderPath.split(path.sep)
            .reduce((prevPath, folder) => {
                const currentPath = path.join(prevPath, folder, path.sep);
                if (!fs.existsSync(currentPath)) {
                    fs.mkdirSync(currentPath, { recursive: true });
                }
                return currentPath;
            }, '');
    }
}

/**
 * 文件写入模式枚举。
 * WRITE 表示覆盖写入，APPEND 表示追加写入。
 */
export enum FileModel {
    WRITE, // 覆盖写入
    APPEND // 追加写入
}