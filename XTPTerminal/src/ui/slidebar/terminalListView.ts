import * as vscode from "vscode";
import * as path from 'path';
import fs from 'fs/promises';
import { l10n } from 'vscode';
import crypto from 'crypto';
import { Global } from "../../common/global";
import { TreeDataProvider, TreeItem } from "vscode";
import { ITerminalConfiguration } from "../../terminal/VtyTerminal";
import { terminalManager } from "../../terminal/terminalManager";
import { getLogDefaultAddingTimeStamp, getLogDirUri, getLogSizeLimit } from '../../settingManager';
import { startTerminalMgtDealer, DealerHandle, closeDealer  } from '../../rpcserver/xtpserver';
import { getTerminalConfigurationObj } from './terminalConfiguratiionView';

// 定义终端配置的数据模型
interface TerminalConfigProfile {
    description: string;
    version: string;
    name: string,
    terminals: ITerminalConfiguration[];
}

// 判断是否为Serial终端配置
function isSerialTerminalConfig(config: ITerminalConfiguration) {
    return config.type === 'serial';
}
  
// 判断是否为SSH终端配置
function isSshTerminalConfig(config: ITerminalConfiguration) {
    return config.type === 'ssh';
}

// 判断是否为SSH终端配置
function isTelnetTerminalConfig(config: ITerminalConfiguration) {
    return config.type === 'telnet';
}

function getCurrentProjectDir(): string | undefined {
    // 判断是否有打开的工作区
    if (!vscode.workspace.workspaceFolders) {
        //vscode.window.showErrorMessage('未打开任何文件夹');
        return undefined;
    }

    // 取第一个工作区目录的本地路径
    const firstWorkspaceFolder = vscode.workspace.workspaceFolders[0];
    return firstWorkspaceFolder.uri.fsPath;
}


const DEFAULT_TESTBED_FILE = "xtp-default.tbdx";

function registerTerminalListView(context: vscode.ExtensionContext) {
    const treeView = vscode.window.createTreeView('xtp.terminal.terminalListTree', {
        treeDataProvider: terminalConfigurationProvider,
        showCollapseAll: true
    });
          
    // 注册刷新命令
    context.subscriptions.push(
        vscode.commands.registerCommand('xtp.terminal.terminalListTree.add', () => {
            var treeNode = terminalConfigurationProvider.addNewTerminalNode();
            var config = terminalConfigurationProvider.getTerminalElement(treeNode);

            treeView.reveal(treeNode, {
                select: true,
                focus: true
            });

            setImmediate(async ()=> {
                vscode.commands.executeCommand('xtp.terminal.editTerminalConfiguration', config);
            });
        }),
        vscode.commands.registerCommand('xtp.terminal.terminalListTree.refresh', async () => {
            await terminalConfigurationProvider.loadConfig();
            const treeNode = terminalConfigurationProvider.getFirstTerminalNodes();
            if (treeNode) {
                treeView.reveal(treeNode, {
                    select: true,
                    focus: true
                });
            }
        }),
        vscode.commands.registerCommand('xtp.terminal.terminalListTree.connect', (item: TerminalTreeNode) => {
            const terminal = terminalConfigurationProvider.getTerminalElement(item);
            if (terminal !== null) {
                terminalManager.showTerminal(terminal.name, terminal, () => {
                    terminalManager.remove(terminal.name);
                });
                const msg = l10n.t('command.connection.connect');
                vscode.window.showInformationMessage(`${msg}: ${item.label}`);
            }
        }),
        vscode.commands.registerCommand('xtp.terminal.terminalListTree.startSaveLog', async (item: TerminalTreeNode) => {
            const termItem = terminalConfigurationProvider.getTerminalElement(item);
            if (termItem !== null) {
                const terminal = terminalManager.getFromTerminalName(termItem.name);
                if (!terminal.state.loging) {
                    let timestamp = getLogDefaultAddingTimeStamp();
                    let logSize = getLogSizeLimit();
                    let logPath = getLogDirUri().fsPath;
                    terminalConfigurationProvider.updateItemStatus(item, "running");
                    setTernimalRecordingLog(await terminal.startLogging(logPath, logSize, timestamp));

                    const msg = l10n.t('commands.startSaveLog');
                    vscode.window.showInformationMessage(`${msg} failed: ${item.label}`);
                }
            }
        }),
        vscode.commands.registerCommand('xtp.terminal.terminalListTree.stopSaveLog', async (item: TerminalTreeNode) => {
            const termItem = terminalConfigurationProvider.getTerminalElement(item);
            if (termItem !== null) {
                const terminal = terminalManager.getFromTerminalName(termItem.name);
                if (terminal.state.loging) {
                    setTernimalRecordingLog(terminal.stopLogging());                    
                    terminalConfigurationProvider.updateItemStatus(item, "stopped");
                    // vscode.window.showInformationMessage(`停止记录日志: ${item.label}`);
                }
            }
        }),
        vscode.commands.registerCommand('xtp.terminal.terminalListTree.delete', async (item: TerminalTreeNode) => {
              const result = await vscode.window.showWarningMessage(
                `确定要删除终端 "${item.label}" 吗？此操作不可恢复。`,
                '确认',  // 第一个按钮（确认）
                '取消'   // 第二个按钮（取消）
              );
          
              // 2. 根据用户选择执行逻辑
              if (result === '确认') {
                // 用户确认删除：执行实际删除操作（如删除文件/更新树视图）
                const treeNode = terminalConfigurationProvider.removeTerminalItem(item);
                treeView.reveal(treeNode, {
                    select: true,
                    focus: true
                });

                const config = terminalConfigurationProvider.getTerminalElement(treeNode);
                await vscode.commands.executeCommand('xtp.terminal.showTerminalConfiguration', config);
              } else {
                // 用户取消或关闭对话框：不执行操作
                // vscode.window.showInformationMessage('删除操作已取消');
              }
        }),
        vscode.commands.registerCommand('xtp.terminal.terminalListTree.save', (name: string, terminal: ITerminalConfiguration) => {
            const treeNode = terminalConfigurationProvider.saveTerminalConfiguration(name, terminal);
            if (!treeNode) {
                return;
            }
            treeView.reveal(treeNode, {
              select: true,
              focus: true
            });
        })
    );
    
    treeView.onDidChangeSelection(async (event) => {
        const item = event.selection[0] as TerminalTreeNode;
        const config = terminalConfigurationProvider.getTerminalElement(item);
        await vscode.commands.executeCommand('xtp.terminal.showTerminalConfiguration', config);
    });

    setTimeout(async () => {
        await terminalConfigurationProvider.loadConfig();
        const treeNode = terminalConfigurationProvider.getFirstTerminalNodes();
        if (treeNode) {
            treeView.reveal(treeNode, {
                select: true,
                focus: true
            });
            //const config = terminalConfigurationProvider.getTerminalElement(treeNode);
            //await vscode.commands.executeCommand('xtp.terminal.showTerminalConfiguration', config);
        }
    }, 1000);
   
    /*context.subscriptions.push(vscode.commands.registerCommand(
        'xtp.terminal.handleTreeItemDoubleClick',
        (item) => {
          // 在这里实现双击后的具体逻辑
          // vscode.window.showInformationMessage(`双击了: ${item.label}`);
          // 例如：打开文件、显示详情等操作
        }
    ));*/    
}

async function registerRpcTerminalMgtDealer(context: vscode.ExtensionContext) {
    const projectPath = getCurrentProjectDir();
    const identity = crypto.createHash('sha256').update(projectPath).digest('hex');
    Global.terminalRpcMgtDealerHandle = await startTerminalMgtDealer(identity, projectPath, async (request: string) : Promise<string> => {
        console.log(request);
        const jsonrequest = JSON.parse(request);
        switch (jsonrequest.method) {
            case "open": {
                const target = jsonrequest.target;
                const config = terminalConfigurationProvider.getTerminalElementByName(target);
                if (config !== null) {
                    if (!jsonrequest.opts) {
                        //已存在终端信息且不更新参数，直接打开
                        terminalManager.showTerminal(config.name, config, () => {
                            //terminalManager.remove(config.name);
                        });
                        return "success";
                    }
                    else {
                        //参数已更新，关闭已打开的终端窗口并删除终端信息
                        const terminal = terminalManager.getFromTerminalName(target);
                        if (terminal !== undefined) {
                            terminal.close();
                            terminalManager.remove(target);
                        }
                        terminalConfigurationProvider.removeTerminalItemByName(target);
                    }
                    
                    //const msg = l10n.t('command.connection.connect');
                    //vscode.window.showInformationMessage(`${msg}: ${target}`);
                }

                //添加窗口信息并打开
                const connectOpts :ITerminalConfiguration = getTerminalConfigurationObj(jsonrequest.opts);
                terminalConfigurationProvider.addTerminalItem(connectOpts);
                terminalManager.showTerminal(connectOpts.name, connectOpts, () => {
                    //terminalManager.remove(connectOpts.name);
                });
                                
                //vscode.window.showInformationMessage("open");
                return "success";
            }
            case "close": {
                const target = jsonrequest.target;
                const terminal = terminalManager.getFromTerminalName(target);
                if (terminal !== undefined) {
                    terminal.close();
                    terminalManager.remove(target);
                }
                //vscode.window.showInformationMessage("close");
                return "success";
            }
            default: {
                return "failed";
            }
        }
    });
}

function setTernimalRecordingLog(value: boolean) {
    vscode.commands.executeCommand(
        "setContext",
        "xtp.terminal.terminalListTree.treeItem",
        value
    );
}

async function readTestbed(configPath: string) {
    try {
        // 检查文件是否可访问（F_OK 表示仅判断存在性）
        await fs.access(configPath, fs.constants.F_OK);       
        const configUri = vscode.Uri.file(configPath);

        // 读取文件内容
        const fileContent = await vscode.workspace.fs.readFile(configUri);
        const jsonString = new TextDecoder().decode(fileContent);

        return jsonString;
    } catch {
        //返回空配置信息
        return '{description: "xterm configuration profile", version:"0.0.1", terminals:[]}';
    }
    
}

async function getTestbedTerminals(configPath: string) {
    const jsonString = await readTestbed(configPath);
    const config: TerminalConfigProfile = JSON.parse(jsonString);

    return config.terminals;
}

async function writeTestbed(configPath: string, content:string) {  
    const configUri = vscode.Uri.file(configPath);
    const textEncoder = new TextEncoder();
    const data = textEncoder.encode(content);
    await vscode.workspace.fs.writeFile(configUri, data);
}

async function saveTestbedTerminals(configPath: string, terminals: ITerminalConfiguration[]) {
    const jsonString = await readTestbed(configPath);
    const config: TerminalConfigProfile = JSON.parse(jsonString);

    let newTestbed: TerminalConfigProfile = config;
    newTestbed.description = config.description;
    newTestbed.version = config.version;
    newTestbed.terminals = terminals;

    const newTestbedContent: string = JSON.stringify(newTestbed);

    await writeTestbed(configPath, newTestbedContent);
}

// 树视图节点
class TerminalTreeNode extends vscode.TreeItem {
    constructor(
        public label: string,
        public readonly type: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label} (${this.type})`;
        this.description = this.type;
        this.contextValue = `xtp.terminal.terminalListTree.treeItem:${label}:stopped`;
    }
}

function createTerminalNode (terminal: ITerminalConfiguration) : TerminalTreeNode {
    var treeNode : TerminalTreeNode;
    if (isSerialTerminalConfig(terminal)) {
        treeNode = new TerminalTreeNode(terminal.name, terminal.options.path);
    }
    else if (isSshTerminalConfig(terminal)) {
        treeNode = new TerminalTreeNode(terminal.name, terminal.options.host);
    }
    else if (isTelnetTerminalConfig(terminal)) {
        treeNode = new TerminalTreeNode(terminal.name, terminal.options.host);
    }
    else {
        const msg = l10n.t('xtp.terminal.listview.unsupported');
        vscode.window.showErrorMessage(msg + `: ${terminal.name}(${terminal.type})`);
    }
    return treeNode;
};
    

// 树视图数据提供器
const terminalConfigurationProvider = new (class implements TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TerminalTreeNode | undefined | null | void> = new vscode.EventEmitter<TerminalTreeNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TerminalTreeNode | undefined | null | void> = this._onDidChangeTreeData.event;

    private terminals: ITerminalConfiguration[] = [];
    private treeNodes: TerminalTreeNode[] = [];
    private testbed: string;

    constructor() {
        // 初始化时加载配置
        //this.loadConfig();
    }

    // 加载并解析配置文件
    async loadConfig() {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                //vscode.window.showErrorMessage('请打开包含终端配置的工作区');
                return;
            }

            // 假设配置文件名为default.tbdx，位于工作区根目录
            const rootPath = workspaceFolders[0].uri.fsPath;
            this.testbed = path.join(rootPath, DEFAULT_TESTBED_FILE);
            
            // 存储终端数据
            this.terminals = await getTestbedTerminals(this.testbed);
            this.treeNodes.length = 0;
            this.terminals.map(terminal => {
                const treeNode = createTerminalNode(terminal);
                this.treeNodes.push(treeNode);
            });

            // 通知树视图数据已更改
            this._onDidChangeTreeData.fire();
           
            // vscode.window.showInformationMessage(`已加载 ${this.terminals.length} 个终端配置`);
        } catch (error) {
            if (error instanceof Error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    const msg = l10n.t('xtp.terminal.listview.notfound');
                    vscode.window.showErrorMessage(DEFAULT_TESTBED_FILE + " " + msg);
                } else if (error.name === 'SyntaxError') {
                    const msg = l10n.t('xtp.terminal.listview.load.failed');
                    vscode.window.showErrorMessage(msg + `: ${error.message}`);
                } else {
                    const msg = l10n.t('xtp.terminal.listview.load.failed');
                    vscode.window.showErrorMessage(msg + `: ${error.message}`);
                }
            }
        }
    }

    // 获取树节点
    getTreeItem(element: TerminalTreeNode): vscode.TreeItem {
        return element;
    }

    // 获取子节点
    getChildren(element?: TerminalTreeNode): Thenable<TerminalTreeNode[]> {
        if (element) {
            return Promise.resolve([]); // 无子节点
        } else {
            return Promise.resolve(this.treeNodes); // 返回根节点
        }
    }

    getParent(element: vscode.TreeItem): vscode.ProviderResult<TreeItem> {
        for (const treeNode of this.treeNodes) {
            if (element === treeNode.label) {
                return treeNode;
            }
        }
        return element;
    }

    getFirstTerminalNodes(): TerminalTreeNode | undefined {
        return this.treeNodes.length > 0 ? this.treeNodes[0] : undefined;
    }

    addNewTerminalNode() : TerminalTreeNode  {
        //查找一个不重复的名称
        var termPrefix = "DEFAULT_";
        var index : number = 0;

        while(true) {
            var termName : string = termPrefix + index.toString();
            var conflict : boolean = false;
            for (const terminal of this.terminals) {
                if (terminal.name === termName) {
                    conflict = true;
                    break;
                }
            }

            if (!conflict) {
                break;
            }
            index += 1;
        }
        
        const terminal : ITerminalConfiguration = {
            name: termPrefix + index.toString(),
            type: "ssh",
            options: {
                host: "127.0.0.l",
                port: 22,
                username: "",
                type: "password",
                password: "",
                algorithms: {
                    cipher: [],
                },
                privateKeyPath: "",
                passphrase: "",
            }
        };
        
        //添加终端节点
        return this.addTerminalItem(terminal);
    }

    addTerminalItem(cfg: ITerminalConfiguration) : TerminalTreeNode {
        for (const terminal of this.terminals) {
            if (terminal.name === cfg.name) {
                const msg = l10n.t('xtp.terminal.listview.conflict');
                vscode.window.showErrorMessage(msg);
                return null;
            }
        }

        const treeNode = createTerminalNode(cfg);
        if (treeNode) {
            this.terminals.push(cfg);
            this.treeNodes.push(treeNode);
            this._onDidChangeTreeData.fire();
            saveTestbedTerminals(this.testbed, this.terminals);
        }
        return treeNode;
    }

    /**
     * 删除一个节点
     * @param item 要删除的节点
     * @returns 删除后选中的节点位置
     */
    removeTerminalItem(item: TerminalTreeNode) : TerminalTreeNode {
        let index: number = 0;
        for (const terminal of this.terminals) {
            if (terminal.name === item.label) {
                this.terminals.splice(index, 1);
                this.treeNodes.splice(index, 1);

                saveTestbedTerminals(this.testbed, this.terminals);

                this._onDidChangeTreeData.fire();
                index = index > this.treeNodes.length - 1?this.treeNodes.length - 1:index;
                return this.treeNodes[index];
            }
            index += 1;
        }
        return item;
    }

    removeTerminalItemByName(name: string) : TerminalTreeNode {
        let index: number = 0;
        for (const terminal of this.terminals) {
            if (terminal.name === name) {
                this.terminals.splice(index, 1);
                this.treeNodes.splice(index, 1);

                saveTestbedTerminals(this.testbed, this.terminals);

                this._onDidChangeTreeData.fire();
                index = index > this.treeNodes.length - 1?this.treeNodes.length - 1:index;
                return this.treeNodes[index];
            }
            index += 1;
        }
        return null;
    }

    saveTerminalConfiguration(name: string, config: ITerminalConfiguration) {
        if (name !== config.name) {
            for (const terminal of this.terminals) {
                if (terminal.name === config.name) {
                    const msg = l10n.t('xtp.terminal.listview.conflict');
                    vscode.window.showWarningMessage(msg + `: ${config.name}`);
                    return;
                }
            }
        }
        
        var index: number = 0;
        for (const terminal of this.terminals) {
            if (terminal.name === name) {
                this.terminals[index] = config;
                if (isSerialTerminalConfig(config)) {
                    this.treeNodes[index] = new TerminalTreeNode(config.name, config.options.path);
                }
                else if (isSshTerminalConfig(config)) {
                    this.treeNodes[index] = new TerminalTreeNode(config.name, config.options.host);
                }
                else if (isTelnetTerminalConfig(config)) {
                    this.treeNodes[index] = new TerminalTreeNode(config.name, config.options.host);
                }
                else {}
                saveTestbedTerminals(this.testbed, this.terminals);
                this._onDidChangeTreeData.fire();
                return this.treeNodes[index];
            }
            index += 1;
        }
    }

    changeTerminalName(item: TerminalTreeNode, newName: string) {
        for (const terminal of this.terminals) {
            if (terminal.name === newName) {
                const msg = l10n.t('xtp.terminal.listview.conflict');
                vscode.window.showWarningMessage(msg + `: ${newName}`);
                return;
            }
        }
        for (const terminal of this.terminals) {
            if (terminal.name === item.label) {
                terminal.name = newName;
                saveTestbedTerminals(this.testbed, this.terminals);

                this._onDidChangeTreeData.fire();
            }
        }
    }

    getTerminalElement(item: TerminalTreeNode) {
        if(item === undefined) {
            return null;
        }
        for (const terminal of this.terminals) {
            if (terminal.name === item.label) {
                return terminal;
            }
        }
        return null;
    }

    getTerminalElementByName(name: string) {
        if(name === undefined) {
            return null;
        }
        for (const terminal of this.terminals) {
            if (terminal.name === name) {
                return terminal;
            }
        }
        return null;
    }

    /*getTerminalItemConfig(item: TerminalTreeNode)  {     
      const terminal = this.getTerminalElement(item);
      return this.getTerminalConfiguration(terminal);
    }*/

    updateItemStatus(item: TerminalTreeNode, status: string) {
        item.contextValue = `xtp.terminal.terminalListTree.treeItem:${item.label}:${status}`;
        this._onDidChangeTreeData.fire(item);
    }
})();


interface CommandQuickPickItem extends vscode.QuickPickItem {
    label: string;
    kind?: vscode.QuickPickItemKind | undefined;
    description?: string | undefined;
    detail?: string | undefined;
    picked?: boolean | undefined;
    alwaysShow?: boolean | undefined;
    buttons?: readonly vscode.QuickInputButton[] | undefined;
    command?: vscode.Command;
}


export {
    registerTerminalListView,
    registerRpcTerminalMgtDealer
};