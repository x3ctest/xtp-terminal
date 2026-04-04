import { Telnet, ConnectOptions } from 'telnet-client';
import { BaseSession, ISessionCallback} from "../basic/BasicSession";

interface TelnetSessionConfig extends ConnectOptions {
}
/**
 * TelnetConnection 类用于管理 Telnet 连接。
 * 提供了连接、发送数据和关闭连接的功能。
 */
class TelnetSession extends BaseSession {
    public constructor(telnetConfig: TelnetSessionConfig, callback: ISessionCallback, pseudo: boolean = false) {
        super();
        /*this.state = {
            loging: false,
            timeStamp: getLogDefaultAddingTimeStamp(),
            hex: false,
        };*/
        //this.client = telnetClient;

        this.bIsOpen = false;
        this.telnetconfig = telnetConfig;
        this.callbacks = callback;
    }

    private init() {
        /*this.terminal.setOnInput(
            (data) => this.client.write(data)
        );
        this.terminal.setOnOpen(() => {
            this.terminal.write(this.client.writable ?
                colors.green.bold(l10n.t('({0}) CONNECTED', this.telnetconfig.options.host) + '\r\n\r\n')
                : colors.red.bold(l10n.t('({0}) OPEN FAILED!', this.telnetconfig.options.host) + '\r\n\r\n'));
        });
        this.terminal.setOnClose(() => {
            this.client.destroy();
            if (this.closeCallback) { this.closeCallback(); };
        });
        */
        //this.client.addListener("data", (data) => {
        //    c
        //});

        this.client.on('data', (data: Buffer) => {
            let output = this.client.parseData(data);
            this.callbacks.onData(output);
        });

        /*this.client.on("close", () => {
            this.terminal.write(colors.red.bold(
                "\n" + l10n.t("({0}) CLOSED!", this.telnetconfig.options.host) + '\r\n\r\n'));
        }
        );*/

        // 监听错误事件
        this.client.on("error", (err) => {
            //vscode.window.showErrorMessage(`Telnet connection error: ${err.message}`);
            this.callbacks.onError(err);
            //reject(err);
        });

        // 监听关闭事件
        this.client.on("close", () => {
            //vscode.window.showInformationMessage(`Telnet connection to ${this.telnetconfig.options.host}:${this.telnetconfig.options.port} closed.`);
            this.callbacks.onClose();
            this.cleanup(); // 清理资源
        });
    }
    
    /**
     * 通过 Telnet 连接到远程服务器。
     * @param host Telnet 服务器的主机名或 IP 地址。
     * @param port Telnet 服务器的端口号。
     * @param callback 可选回调函数，用于处理连接成功后的逻辑。
     */
    async open(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.client = new Telnet();//net.Socket();
            this.init();
            let openCallBack = () => {
                this.bIsOpen = true;
                resolve(true);
            };
                       
            this.telnetconfig.negotiationMandatory = false;
            this.client.connect(this.telnetconfig)
            .then(() => {
                openCallBack();
            })
            .catch((err) => {
                this.callbacks.onError(err);
                resolve(false);
            });
        });
    }

    
    /**
     * 发送数据到 Telnet 服务器。
     * @param data 要发送的数据。
     */
    public send(data: string): void {
        if (this.client) {
            this.client.write(data);
        } //else {
         //   vscode.window.showErrorMessage("Telnet connection is not established.");
        //}
    }

    /**
     * 关闭 Telnet 连接。
     */
    public close(): void {
        if (this.client) {
            this.client.end(); // 关闭连接
            this.cleanup(); // 清理资源
            //vscode.window.showInformationMessage("Telnet connection closed.");
        } //else {
            //vscode.window.showErrorMessage("No active Telnet connection to close.");
        //}
    }

    /**
     * 清理资源，释放 Telnet 客户端实例。
     */
    private cleanup(): void {
        this.client = null;
    }

    public isOpen(): boolean {
        return this.bIsOpen;
    }
    
    private client: Telnet | null = null; // Telnet 客户端实例
    private telnetconfig: TelnetSessionConfig;
    
    callbacks: ISessionCallback;
    private bIsOpen: boolean;
}


export {
    TelnetSessionConfig,
    TelnetSession
};