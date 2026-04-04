import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * 实例ID管理器
 * 负责生成、存储和获取VSCode实例的唯一标识
 */
export class InstanceIdManager {
    private static instance: InstanceIdManager;
    private instanceId: string;

    private constructor() {
        // 初始化实例ID
        this.instanceId = this.generateInstanceId();
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): InstanceIdManager {
        if (!InstanceIdManager.instance) {
            InstanceIdManager.instance = new InstanceIdManager();
        }
        return InstanceIdManager.instance;
    }

    /**
     * 获取实例ID
     */
    public getInstanceId(): string {
        return this.instanceId;
    }

    /**
     * 生成实例ID
     * 基于当前工程路径生成UUID
     */
    private generateInstanceId(): string {
        // 获取当前工程路径
        let projectPath = '';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            projectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        
        // 对projectPath进行UTF-8编码，然后生成哈希值
        const hash = crypto.createHash('sha256').update(Buffer.from(projectPath.toLocaleLowerCase(), 'utf8')).digest('hex');
        
        // 将哈希值转换为UUID格式
        // 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        const uuid = [
            hash.substring(0, 8),
            hash.substring(8, 12),
            '4' + hash.substring(12, 15),
            ((parseInt(hash.substring(15, 16), 16) & 0x3) | 0x8).toString(16) + hash.substring(16, 19),
            hash.substring(19, 32)
        ].join('-');
        
        return uuid;
    }


}