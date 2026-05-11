import * as vscode from "vscode";
import * as path from 'path';
import { l10n } from 'vscode';
import { TreeDataProvider, TreeItem } from "vscode";
import { ITerminalConfiguration } from "../../terminal/VtyTerminal";
import { terminalManager } from "../../terminal/terminalManager";
import { getLogDefaultAddingTimeStamp, getLogDirUri, getLogSizeLimit } from '../../settingManager';
import { SftpFileBrowserViewProvider } from './sftpFileBrowserView';

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
        vscode.commands.registerCommand('xtp.terminal.terminalListTree.connect', async (item: TerminalTreeNode | ITerminalConfiguration) => {
            if (item instanceof TerminalTreeNode) {
                // 如果是测试床节点，打开该测试床下的所有终端
                if (item.type === 'testbed') {
                    // 查找该测试床的所有终端
                    const testbedData = terminalConfigurationProvider.testbeds.get(item.testbedPath);
                    if (testbedData) {
                        const terminals = testbedData.terminals;
                        if (terminals.length > 0) {
                            for (const terminal of terminals) {
                                if (((terminal.type ==="ssh" || terminal.type === "telnet") && terminal.options.host === "") ||
                                    (terminal.type === "serial" && terminal.options.path === "")) {
                                    continue;
                                }
                                await terminalManager.showTerminal(terminal.name, terminal, async () => {
                                     await terminalManager.remove(terminal.name);
                                     
                                     // 处理SFTP文件浏览器
                                     if (terminal.type === 'ssh') {
                                        vscode.commands.executeCommand('xtp.terminal.sftpFileBrowser.closeTerminal', {terminalName:terminal.name});
                                     }
                                });
                            }
                            const msg = l10n.t('command.connection.connect');
                            vscode.window.showInformationMessage(`${msg}: ${terminals.length} 个终端`);
                        } else {
                            vscode.window.showInformationMessage('该测试床下没有终端');
                        }
                    }
                } else {
                    // 如果是终端节点，打开单个终端
                    const terminal = terminalConfigurationProvider.getTerminalElement(item);
                    if (terminal !== null) {
                        if (((terminal.type ==="ssh" || terminal.type === "telnet") && terminal.options.host === "") ||
                            (terminal.type === "serial" && terminal.options.path === "")) {
                            return;
                        }
                        await terminalManager.showTerminal(terminal.name, terminal, async () => {
                            await terminalManager.remove(terminal.name);
                            
                            // 处理SFTP文件浏览器
                            if (terminal.type === 'ssh') {
                                // 尝试获取视图提供器实例
                                vscode.commands.executeCommand('xtp.terminal.sftpFileBrowser.closeTerminal', {terminalName:terminal.name});
                            }
                        });
                        const msg = l10n.t('command.connection.connect');
                        vscode.window.showInformationMessage(`${msg}: ${terminal.name}`);
                    }
                }
            } else {
                // 如果是终端配置对象，直接使用
                const terminal = item;
                if (terminal !== null) {
                    if (((terminal.type ==="ssh" || terminal.type === "telnet") && terminal.options.host === "") ||
                        (terminal.type === "serial" && terminal.options.path === "")) {
                        return;
                    }
                    await terminalManager.showTerminal(terminal.name, terminal, async () => {
                    await terminalManager.remove(terminal.name);
                    
                    // 处理SFTP文件浏览器
                    if (terminal.type === 'ssh') {
                        // 尝试获取视图提供器实例
                        vscode.commands.executeCommand('xtp.terminal.sftpFileBrowser.closeTerminal', {terminalName:terminal.name});
                    }
                });
                    const msg = l10n.t('command.connection.connect');
                    vscode.window.showInformationMessage(`${msg}: ${terminal.name}`);
                }
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
                    vscode.window.showInformationMessage(`${msg} success: ${item.label}`);
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
        vscode.commands.registerCommand('xtp.terminal.terminalListTree.closeAllTerminals', async (item: TerminalTreeNode) => {
            if (item.type === 'testbed') {
                const testbedData = terminalConfigurationProvider.testbeds.get(item.testbedPath);
                if (testbedData) {
                    let closedCount = 0;
                    // 使用 Set 避免重复关闭（原始终端和复制终端可能共享配置）
                    const closedTerminals = new Set<string>();
                    
                    // 遍历所有终端（包括复制的终端）
                    const closeTerminalRecursively = async (node: TerminalTreeNode) => {
                        // 关闭当前节点对应的终端
                        if (node.type !== 'testbed' && !closedTerminals.has(node.label)) {
                            const termInstance = terminalManager.getFromTerminalName(node.label);
                            if (termInstance) {
                                termInstance.close();
                                await terminalManager.remove(node.label);
                                
                                // 处理SFTP文件浏览器
                                const terminalConfig = terminalConfigurationProvider.getTerminalElement(node);
                                if (terminalConfig && terminalConfig.type === 'ssh') {
                                    vscode.commands.executeCommand('xtp.terminal.sftpFileBrowser.closeTerminal', { terminalName: node.label });
                                }
                                
                                closedTerminals.add(node.label);
                                closedCount++;
                            }
                        }
                        
                        // 递归关闭子节点（复制的终端）
                        // 使用 [...node.children] 创建副本，避免遍历过程中数组被修改导致遗漏
                        for (const child of [...node.children]) {
                            await closeTerminalRecursively(child);
                        }
                    };
                    
                    // 关闭测试床节点下的所有终端
                    await closeTerminalRecursively(testbedData.node);
                    
                    const msg = l10n.t('command.connection.closeAll');
                    vscode.window.showInformationMessage(`${msg}: ${closedCount} 个终端`);
                }
            }
        }),
        vscode.commands.registerCommand('xtp.terminal.terminalListTree.duplicateTerminal', async (args: any) => {
            // 参数可以是 TerminalTreeNode 或直接调用
            if (!(args instanceof TerminalTreeNode)) {
                return;
            }
            
            const sourceNode = args;
            
            // 获取终端配置
            const terminalConfig = terminalConfigurationProvider.getTerminalElement(sourceNode);
            if (!terminalConfig) {
                vscode.window.showErrorMessage('无法找到终端配置');
                return;
            }
            
            // 检查终端类型，只支持 ssh 和 telnet
            if (terminalConfig.type === 'serial') {
                vscode.window.showErrorMessage('Serial 类型终端不支持复制');
                return;
            }
            
            if (terminalConfig.type !== 'ssh' && terminalConfig.type !== 'telnet') {
                vscode.window.showErrorMessage('仅支持 SSH 和 Telnet 类型终端复制');
                return;
            }
            
            // 检查是否已经是复制的终端（二级子节点不允许再复制）
            if (sourceNode.isDuplicate) {
                vscode.window.showErrorMessage('复制的终端不支持再次复制');
                return;
            }
            
            // 生成新终端名称（添加数字序号）
            let newName = terminalConfig.name;
            let counter = 1;
            // 检查测试床中是否已存在同名终端
            const testbedData = terminalConfigurationProvider.testbeds.get(sourceNode.testbedPath);
            if (testbedData) {
                while (testbedData.terminals.some(t => t.name === newName)) {
                    newName = `${terminalConfig.name} (${counter})`;
                    counter++;
                }
            }
            
            // 创建复制的终端配置
            const newTerminalConfig: ITerminalConfiguration = {
                ...terminalConfig,
                name: newName
            };
            
            // 将新终端添加到测试床
            if (testbedData) {
                testbedData.terminals.push(newTerminalConfig);
                
                // 创建子节点并添加到源节点下
                const duplicateNode = createTerminalNode(newTerminalConfig, sourceNode.testbedPath, true, sourceNode);
                sourceNode.children.push(duplicateNode);
                
                // 不管原始终端是否打开，都打开复制的终端
                await terminalManager.showTerminal(newName, { ...newTerminalConfig }, async () => {
                    await terminalManager.remove(newName);
                    
                    // 当复制的终端窗口关闭时，自动删除列表中的子节点
                    // 从父节点的children中移除
                    const parentNode = duplicateNode.parentTerminal;
                    if (parentNode) {
                        const index = parentNode.children.indexOf(duplicateNode);
                        if (index !== -1) {
                            parentNode.children.splice(index, 1);
                        }
                    }
                    
                    // 从测试床的terminals数组中移除
                    const termIndex = testbedData.terminals.findIndex(t => t.name === newName);
                    if (termIndex !== -1) {
                        testbedData.terminals.splice(termIndex, 1);
                    }
                    
                    // 通知树视图数据已更改
                    terminalConfigurationProvider.refresh(sourceNode);
                });
                
                // 更新状态为 running
                terminalConfigurationProvider.updateItemStatus(duplicateNode, "running");
                
                // 通知树视图数据已更改
                terminalConfigurationProvider.refresh(sourceNode);
                
                const msg = l10n.t('command.connection.duplicate');
                vscode.window.showInformationMessage(`${msg}: ${newName}`);
            }
        })
    );
    
    // 注册从外部更新终端列表的命令
    context.subscriptions.push(
        vscode.commands.registerCommand('xtp.terminal.updateTerminalList', (terminals: ITerminalConfiguration[], testbedPath: string = 'default') => {
            terminalConfigurationProvider.loadTerminals(terminals, testbedPath);
            const treeNode = terminalConfigurationProvider.getFirstTerminalNodes();
            if (treeNode) {
                treeView.reveal(treeNode, {
                    select: true,
                    focus: true
                });
            }
        }),
        vscode.commands.registerCommand('xtp.terminal.removeTerminalFromTestbed', (terminalName: string, testbedPath: string = 'default') => {
            terminalConfigurationProvider.removeTerminalFromTestbed(terminalName, testbedPath);
        }),
        vscode.commands.registerCommand('xtp.terminal.removeTestbed', (testbedPath: string) => {
            terminalConfigurationProvider.removeTestbed(testbedPath);
        })
    );
}

function setTernimalRecordingLog(value: boolean) {
    vscode.commands.executeCommand(
        "setContext",
        "xtp.terminal.terminalListTree.treeItem",
        value
    );
}

// 树视图节点
class TerminalTreeNode extends vscode.TreeItem {
    public children: TerminalTreeNode[] = [];
    public readonly testbedPath: string;
    public isDuplicate: boolean = false;  // 是否为复制的终端
    public parentTerminal: TerminalTreeNode | null = null;  // 父终端节点（仅复制终端有）

    constructor(
        public label: string,
        public readonly type: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        testbedPath: string = '',
        isDuplicate: boolean = false,
        parentTerminal: TerminalTreeNode | null = null
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label} (${this.type})`;
        this.description = this.type;
        // 区分测试床节点和终端节点，格式: type:label:status:isDuplicate
        const nodeType = type === 'testbed' ? 'testbed' : 'terminal';
        this.contextValue = `xtp.terminal.terminalListTree.treeItem:${nodeType}:${label}:stopped:${isDuplicate ? 'duplicate' : 'original'}`;
        this.testbedPath = testbedPath;
        this.isDuplicate = isDuplicate;
        this.parentTerminal = parentTerminal;
    }
}

function createTerminalNode (terminal: ITerminalConfiguration, testbedPath: string, isDuplicate: boolean = false, parentTerminal: TerminalTreeNode | null = null) : TerminalTreeNode {
    var treeNode : TerminalTreeNode;
    if (isSerialTerminalConfig(terminal)) {
        treeNode = new TerminalTreeNode(terminal.name, terminal.options.path, vscode.TreeItemCollapsibleState.None, testbedPath, isDuplicate, parentTerminal);
    }
    else if (isSshTerminalConfig(terminal)) {
        treeNode = new TerminalTreeNode(terminal.name, terminal.options.host, isDuplicate ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed, testbedPath, isDuplicate, parentTerminal);
    }
    else if (isTelnetTerminalConfig(terminal)) {
        treeNode = new TerminalTreeNode(terminal.name, terminal.options.host, isDuplicate ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed, testbedPath, isDuplicate, parentTerminal);
    }
    else {
        const msg = l10n.t('xtp.terminal.listview.unsupported');
        vscode.window.showErrorMessage(msg + `: ${terminal.name}(${terminal.type})`);
    }
    return treeNode;
};

function createTestbedNode (testbedPath: string) : TerminalTreeNode {
    const testbedName = path.basename(testbedPath);
    return new TerminalTreeNode(testbedName, 'testbed', vscode.TreeItemCollapsibleState.Expanded, testbedPath);
};
    

// 树视图数据提供器
const terminalConfigurationProvider = new (class implements TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TerminalTreeNode | undefined | null | void> = new vscode.EventEmitter<TerminalTreeNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TerminalTreeNode | undefined | null | void> = this._onDidChangeTreeData.event;

    public testbeds: Map<string, { terminals: ITerminalConfiguration[], node: TerminalTreeNode }> = new Map();
    private treeNodes: TerminalTreeNode[] = [];

    constructor() {
        // 初始化时加载配置
    }

    // 从外部传入终端配置，支持多个测试床文件
    loadTerminals(terminals: ITerminalConfiguration[], testbedPath: string = 'default') {
        try {
            // 存储终端数据
            if (!this.testbeds.has(testbedPath)) {
                const testbedNode = createTestbedNode(testbedPath);
                this.testbeds.set(testbedPath, { terminals: [], node: testbedNode });
                this.treeNodes.push(testbedNode);
            }

            const testbedData = this.testbeds.get(testbedPath);
            if (testbedData) {
                testbedData.terminals = terminals;
                testbedData.node.children = [];
                
                terminals.map(terminal => {
                    const treeNode = createTerminalNode(terminal, testbedPath);
                    testbedData.node.children.push(treeNode);
                });

                // 按名称排序测试床节点
                this.treeNodes.sort((a, b) => a.label.localeCompare(b.label));

                // 通知树视图数据已更改
                this._onDidChangeTreeData.fire();
               
                // vscode.window.showInformationMessage(`已加载 ${terminals.length} 个终端配置`);
            }
        } catch (error) {
            if (error instanceof Error) {
                const msg = l10n.t('xtp.terminal.listview.load.failed');
                vscode.window.showErrorMessage(msg + `: ${error.message}`);
            }
        }
    }

    // 从测试床中删除终端
    removeTerminalFromTestbed(terminalName: string, testbedPath: string = 'default') {
        const testbedData = this.testbeds.get(testbedPath);
        if (testbedData) {
            const terminalIndex = testbedData.terminals.findIndex(t => t.name === terminalName);
            if (terminalIndex !== -1) {
                testbedData.terminals.splice(terminalIndex, 1);
                testbedData.node.children.splice(terminalIndex, 1);
                this._onDidChangeTreeData.fire();
            }
        }
    }

    // 删除整个测试床
    removeTestbed(testbedPath: string) {
        const testbedData = this.testbeds.get(testbedPath);
        if (testbedData) {
            // 从testbeds Map中删除
            this.testbeds.delete(testbedPath);
            
            // 从treeNodes数组中删除对应的节点
            const index = this.treeNodes.indexOf(testbedData.node);
            if (index > -1) {
                this.treeNodes.splice(index, 1);
            }
            
            this._onDidChangeTreeData.fire();
        }
    }

    // 获取树节点
    getTreeItem(element: TerminalTreeNode): vscode.TreeItem {
        return element;
    }

    // 获取子节点
    getChildren(element?: TerminalTreeNode): Thenable<TerminalTreeNode[]> {
        if (element) {
            return Promise.resolve(element.children); // 返回测试床的子节点（设备）
        } else {
            return Promise.resolve(this.treeNodes); // 返回根节点（测试床）
        }
    }

    getParent(element: vscode.TreeItem): vscode.ProviderResult<TreeItem> {
        // 查找子节点的父节点（测试床节点）
        for (const testbedNode of this.treeNodes) {
            if (testbedNode.children.includes(element as TerminalTreeNode)) {
                return testbedNode;
            }
        }
        return undefined;
    }

    getFirstTerminalNodes(): TerminalTreeNode | undefined {
        return this.treeNodes.length > 0 ? this.treeNodes[0] : undefined;
    }
    
    getTerminalElement(item: TerminalTreeNode) {
        if(item === undefined) {
            return null;
        }
        // 如果是测试床节点，返回null
        if (item.type === 'testbed') {
            return null;
        }
        // 遍历所有测试床查找终端
        for (const [testbedPath, testbedData] of this.testbeds) {
            for (const terminal of testbedData.terminals) {
                if (terminal.name === item.label) {
                    return terminal;
                }
            }
        }
        return null;
    }

    getTerminalElementByName(name: string, testbedPath: string = 'default') {
        if(name === undefined) {
            return null;
        }
        const testbedData = this.testbeds.get(testbedPath);
        if (testbedData) {
            for (const terminal of testbedData.terminals) {
                if (terminal.name === name) {
                    return terminal;
                }
            }
        }
        return null;
    }

    getTreeNodeByTerminalName(name: string, testbedPath: string = 'default') {
        if(name === undefined) {
            return null;
        }
        const testbedData = this.testbeds.get(testbedPath);
        if (testbedData) {
            for (const treeNode of testbedData.node.children) {
                if (treeNode.label === name) {
                    return treeNode;
                }
            }
        }
        return null;
    }

    updateItemStatus(item: TerminalTreeNode, status: string) {
        // 格式: type:label:status:isDuplicate
        const nodeType = item.type === 'testbed' ? 'testbed' : 'terminal';
        item.contextValue = `xtp.terminal.terminalListTree.treeItem:${nodeType}:${item.label}:${status}:${item.isDuplicate ? 'duplicate' : 'original'}`;
        this._onDidChangeTreeData.fire(item);
    }

    // 公共方法：触发树视图更新
    refresh(element?: TerminalTreeNode) {
        this._onDidChangeTreeData.fire(element);
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
    //registerRpcTerminalMgtDealer
};