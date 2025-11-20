import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { l10n } from 'vscode';

/**
 * 管理xtp-agent.exe进程的工具类
 */
export class XtpAgentManager {
    // xtp-agent.exe的默认路径（可根据实际场景调整，比如从配置中读取）
    private static readonly DEFAULT_AGENT_PATH = path.join(
        vscode.env.appRoot, // VS Code安装目录（示例）
        'extensions', 
        'your-extension-id', // 你的插件ID
        'bin', 
        'xtp-agent.exe'
    );

    /**
     * 检查xtp-agent.exe是否正在运行
     * @returns 进程ID（number），未运行则返回null
     */
    async checkAgentRunning(): Promise<number | null> {
        try {
            // Windows系统通过tasklist命令查询进程
            // 命令解释：tasklist /fi "imagename eq xtp-agent.exe" /fo csv /nh
            // 作用：筛选出进程名为xtp-agent.exe的进程，以CSV格式输出（无表头）
            const result = await new Promise<string>((resolve, reject) => {
                child_process.exec(
                    'tasklist /fi "imagename eq xtp-agent.exe" /fo csv /nh',
                    (error, stdout) => {
                        if (error) {
                            reject(error);
                            return;
                        }
                        resolve(stdout);
                    }
                );
            });

            // 解析输出：CSV格式的行类似 "xtp-agent.exe","1234","Console","1","12,345 K"
            const lines = result.trim().split('\n');
            for (const line of lines) {
                if (line.includes('xtp-agent.exe')) {
                    // 提取进程ID（第二列，去除引号）
                    const pid = parseInt(line.split('","')[1], 10);
                    if (!isNaN(pid)) {
                        return pid;
                    }
                }
            }
            return null; // 未找到进程
        } catch (error) {
            console.error('检查xtp-agent进程失败：', error);
            return null;
        }
    }

    /**
     * 启动xtp-agent.exe进程
     * @param agentPath 可选，指定xtp-agent.exe的路径，默认使用DEFAULT_AGENT_PATH
     * @returns 启动的子进程（child_process.ChildProcess）
     */
    async startAgent(agentPath?: string): Promise<child_process.ChildProcess | null> {
        const actualPath = agentPath || XtpAgentManager.DEFAULT_AGENT_PATH;

        // 检查文件是否存在
        if (!fs.existsSync(actualPath)) {
            const msg = l10n.t('xtp.terminal.xagent.notefound');
            vscode.window.showErrorMessage(msg + `: ${actualPath}`);
            return null;
        }

        // 检查是否已运行，避免重复启动
        const pid = await this.checkAgentRunning();
        if (pid) {
            const msg = l10n.t('xtp.terminal.xagent.notexist');
            vscode.window.showInformationMessage(msg + `(PID: ${pid})`);
            return null;
        }

        try {
            // 启动进程（ detached: true 让进程在插件退出后继续运行）
            const agentProcess = child_process.spawn(actualPath, [], {
                detached: true,
                stdio: 'ignore' // 忽略输入输出（如需日志可重定向到文件）
            });

            // 解除父进程与子进程的关联（避免插件退出时杀死子进程）
            agentProcess.unref();

            // 验证启动是否成功（短暂延迟后检查进程）
            await new Promise(resolve => setTimeout(resolve, 1000));
            const newPid = await this.checkAgentRunning();
            if (newPid) {
                vscode.window.showInformationMessage(`xtp-agent启动成功（PID: ${newPid}）`);
                return agentProcess;
            } else {
                const msg = l10n.t('xtp.terminal.xagent.start.failed');
                vscode.window.showErrorMessage(msg);
                return null;
            }
        } catch (error) {
            const msg = l10n.t('xtp.terminal.xagent.start.error');
            console.error('启动xtp-agent失败：', error);
            vscode.window.showErrorMessage(msg + ` ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * 停止xtp-agent.exe进程（可选）
     * @returns 是否停止成功
     */
    async stopAgent(): Promise<boolean> {
        const pid = await this.checkAgentRunning();
        if (!pid) {
            //vscode.window.showInformationMessage('xtp-agent未在运行');
            return true;
        }

        try {
            // 通过taskkill命令终止进程
            await new Promise<void>((resolve, reject) => {
                child_process.exec(`taskkill /pid ${pid} /f`, (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });
            // vscode.window.showInformationMessage(`xtp-agent已停止（PID: ${pid}）`);
            return true;
        } catch (error) {
            console.error('停止xtp-agent失败：', error);
            // vscode.window.showErrorMessage(`停止xtp-agent失败：${(error as Error).message}`);
            return false;
        }
    }
}