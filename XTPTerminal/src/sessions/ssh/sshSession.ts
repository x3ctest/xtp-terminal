import { BaseSession, ISessionCallback } from "../basic/BasicSession";
import * as ssh from "ssh2";

interface SshSessionConfiguration extends ssh.ConnectConfig {
    type: string,
    privateKeyPath: string,
    enableSftp?: boolean,
}

class SSHSession extends BaseSession {
    public constructor(config: SshSessionConfiguration, callback:ISessionCallback, pseudo: boolean = false) {
        super();
        this.sshconfig = config;
        this.callbacks = callback;
        this.bIsOpen = false;
    }

    private init() {
        const pty : ssh.PseudoTtyOptions = {
            rows: 24,
            cols: 80,
            term: 'xterm-256color',
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
            stream.on('error', (err) => {
                this.bIsOpen = false;
                this.callbacks.onError(err);
            });
            
            // 处理流结束
            stream.on('end', () => {
                //this.terminal.write('\r\nConnection closed\r\n');
                this.bIsOpen = false;
                this.callbacks.onClose();
                this.sshclient.end();
            });
        });
       
        // 处理连接关闭
        this.sshclient.on('close', (hadError) => {
            this.bIsOpen = false;
            this.callbacks.onClose();
        });

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
                resolve(true);
            });

            this.sshclient.on('error', (err) => {
                this.bIsOpen = false;
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