import * as vscode from "vscode";
import { ExtensionContext } from "vscode";
import { Global } from "../common/global";


export class ServiceManager {

    public static instance: ServiceManager;
    //public connectService = new ConnectService();
    //public historyService = new HistoryRecorder();
    private isInit = false;

    constructor(private readonly context: ExtensionContext) {
        Global.context = context;
        //ViewManager.initExtesnsionPath(context.extensionPath);
    }

    public init(): vscode.Disposable[] {
        if (this.isInit) { return [] }
        //new HighlightCreator()
        const res: vscode.Disposable[] = [
        ]

        //res.push(this.initTreeView())
        //res.push(this.initTreeProvider())
        // res.push(vscode.window.createTreeView("github.cweijan.history",{treeDataProvider:new HistoryProvider(this.context)}))
        ServiceManager.instance = this;
        this.isInit = true
        return res
    }


    private initTreeView() {
        /*this.provider = new DbTreeDataProvider(this.context, CacheKey.DATBASE_CONECTIONS);
        const treeview = vscode.window.createTreeView("github.cweijan.mysql", {
            treeDataProvider: this.provider,
        });
        treeview.onDidCollapseElement((event) => {
            DatabaseCache.storeElementState(event.element, vscode.TreeItemCollapsibleState.Collapsed);
        });
        treeview.onDidExpandElement((event) => {
            DatabaseCache.storeElementState(event.element, vscode.TreeItemCollapsibleState.Expanded);
        });
        return treeview;
        */
    }

    private initTreeProvider() {
        /*
        this.nosqlProvider = new DbTreeDataProvider(this.context, CacheKey.NOSQL_CONNECTION);
        const treeview = vscode.window.createTreeView("github.cweijan.nosql", {
            treeDataProvider: this.nosqlProvider,
        });
        treeview.onDidCollapseElement((event) => {
            DatabaseCache.storeElementState(event.element, vscode.TreeItemCollapsibleState.Collapsed);
        });
        treeview.onDidExpandElement((event) => {
            DatabaseCache.storeElementState(event.element, vscode.TreeItemCollapsibleState.Expanded);
        });
        return treeview;
        */
    }
}