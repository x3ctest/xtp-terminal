import { BaseSession, ISessionCallback } from "../basic/BasicSession";
import * as ssh from "ssh2";

//const terminalNamePrefix = "PORT: ";

interface SshSessionConfiguration extends ssh.ConnectConfig {
    //options : ssh.ConnectConfig;
    type: string,
    privateKeyPath: string,
    enableSftp?: boolean,
}

class SSHSession extends BaseSession {
    public constructor(config: SshSessionConfiguration, callback:ISessionCallback, pseudo: boolean = false) {
        super();
        /*this.state = {
            loging: false,
            timeStamp: getLogDefaultAddingTimeStamp(),
            hex: false,
        };*/
        this.sshconfig = config;
        this.callbacks = callback;
        this.bIsOpen = false;
    }

    private init() {
        /*this.terminal.setOnInput(
            (data) => this.shell.write(data)
        );*/

        //this.terminal.setOnOpen(() => {
        //    this.bIsOpen = true;
            /*this.terminal.write(this.sshclient.shell(); ?
                colors.green.bold(l10n.t('({0}) CONNECTED', this.serialport.path) + '\r\n\r\n')
                : colors.red.bold(l10n.t('({0}) OPEN FAILED!', this.serialport.path) + '\r\n\r\n'));*/
        //});
        /*this.terminal.setOnClose(() => {
            this.shell.close();
            this.bIsOpen = false;
            if (this.closeCallback) { this.closeCallback(); };
        });*/


        /*
        
        this.sshclient.addListener("data", (data) =>
            this.terminal.write(data.toString())
        );

        this.sshclient.on("close", () => {
            this.terminal.write(colors.red.bold(
                "\n" + l10n.t("({0}) CLOSED!", this.sshprofile.host) + '\r\n\r\n'));
        }
        );*/

        const pty : ssh.PseudoTtyOptions = {
            rows: 24,
            cols: 80,
        };
        // 请求一个交互式shell
        this.sshclient.shell(pty, (err, stream) => {
            if (err) {
                //vscode.window.showErrorMessage(`SSH shell error: ${err.message}`);
                this.callbacks.onError(err);
                return;
            }
            
            // 存储shell流用于后续写入
            this.shell = stream;
            
            // 接收来自服务器的输出并显示在终端
            stream.on('data', (data) => {
                this.callbacks.onData(data);
            });
            
            // 处理错误
            stream.on('error', (err) => this.callbacks.onError);
            
            // 处理流结束
            stream.on('end', () => {
                //this.terminal.write('\r\nConnection closed\r\n');
                this.sshclient.end();
            });
        });

        /*this.sshclient.on('ready', () => {
            //this.terminal.write(`Connected to ${host} as ${username}\r\n`);
            
            // SSH连接建立后，同步建立SFTP连接
            this.initSftp();
        });*/
        
        // 处理SSH错误
        //this.sshclient.on('error', (err) =>this.callbacks.onError);
        
        // 处理连接关闭
        this.sshclient.on('close', (hadError) => this.callbacks.onClose);

        this.initSftp();
    }

    /**
     * 初始化SFTP连接
     */
    private initSftp() {
        // 检查是否启用SFTP连接
        const enableSftp = this.sshconfig.enableSftp !== false; // 默认启用
        
        if (enableSftp) {
            this.sshclient.sftp((err, sftp) => {
                if (err) {
                    console.error('SFTP connection error:', err);
                    return;
                }
                
                this.sftpClient = sftp;
                console.log('SFTP connection established');
            });
        }
    }

    async open(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.sshclient = new ssh.Client();

            /* bug: If dataBits is assigned to undefined, opening the serial port fails, so... */
            this.sshclient.on('ready', () => {
                this.bIsOpen = true;
                this.init();
                //const ret: ActionResult = {
                //    result: true,
                //    msg: ""
                //}
                resolve(true);
            });

            this.sshclient.on('error', (err) => {
                this.bIsOpen = false;
                //const ret: ActionResult = {
                //    result: false,
                //    msg: err.message
                //}
                this.callbacks.onError(err);
                resolve(false);
            });
            this.sshclient.connect(this.sshconfig);
        });
    }

    public send(command: string) {
        this.shell.write(command, 'utf-8');
    }

    /**
     * 调整PTY尺寸
     * @param cols 列数
     * @param rows 行数
     */
    public resize(cols: number, rows: number): void {
        if (this.shell && typeof this.shell.setWindow === 'function') {
            // setWindow(width, height, pixWidth, pixHeight)
            this.shell.setWindow(rows, cols, 0, 0);
        }
    }

    public isOpen(): boolean {
        return this.bIsOpen;
    }

    public close(): void {
        this.sshclient.end();
        if (this.sftpClient) {
            this.sftpClient.end();
        }
    }

    /**
     * 获取SFTP客户端实例
     * @returns SFTP客户端实例
     */
    public getSftpClient(): ssh.SFTPWrapper | undefined {
        return this.sftpClient;
    }

    sshconfig: SshSessionConfiguration;
    callbacks: ISessionCallback;
    sshclient: ssh.Client;
    shell: ssh.ClientChannel;
    sftpClient: ssh.SFTPWrapper;
    bIsOpen: boolean;

}

export {
    SshSessionConfiguration,
    SSHSession
};