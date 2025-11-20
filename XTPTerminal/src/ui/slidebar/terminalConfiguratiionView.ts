import * as vscode from 'vscode';
import * as fs from "fs";
import * as path from "path";
import { l10n } from 'vscode';
import { EventEmitter } from 'events';
import { ITerminalConfiguration } from '@/terminal/VtyTerminal';
import { listSerialPort, SerialPortConfiguration } from "../../sessions/serial/serialSession";
import { TelnetSessionConfig} from "@/sessions/telnet/telnetSession";
import { SshSessionConfiguration } from "../../sessions/ssh/sshSession";

function isDataBits(value: number): value is 5 | 6 | 7 | 8 {
    return [5, 6, 7, 8].includes(value);
}

function isStopBits(value: number): value is 1 | 2 | 1.5 {
    return [1, 2, 1.5].includes(value);
}

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

function getTerminalConfigurationObj(connectOpt: any): ITerminalConfiguration {
    let cfg: ITerminalConfiguration = {} as ITerminalConfiguration;

    cfg.name = connectOpt.name;
    if (connectOpt.conType === "SSH") {
        cfg.type = "ssh";
        cfg.options = {} as  SshSessionConfiguration;

        cfg.options.host = connectOpt.ssh.host;
        cfg.options.port = connectOpt.ssh.port;
        cfg.options.username = connectOpt.ssh.username;
        cfg.options.type = connectOpt.ssh.type;
        if (cfg.options.type === "password") {
          cfg.options.password = connectOpt.ssh.password;  
        }
        else {
          cfg.options.privateKeyPath = connectOpt.ssh.privateKeyPath;
          try {
              // 检查文件是否可访问（F_OK 表示仅判断存在性）
              fs.accessSync(cfg.options.privateKeyPath, fs.constants.F_OK);
              //const configUri = vscode.Uri.file(connectOpt.ssh.privateKeyPath);
      
              // 读取文件内容
              cfg.options.privateKey = fs.readFileSync(cfg.options.privateKeyPath, 'utf8');
          } catch {
              //返回空配置信息
              cfg.options.privateKey = "";
          }
          cfg.options.passphrase = connectOpt.ssh.passphrase;
        }
    }
    else if(connectOpt.conType === "SERIAL") {
        cfg.type = "serial";
        //cfg.name = connectOpt.name;
        cfg.options = {} as  SerialPortConfiguration;

        cfg.options.path = connectOpt.serial.path;
        cfg.options.baudrate = connectOpt.serial.baudrate;
        cfg.options.parity = connectOpt.serial.parity;
        if (isDataBits(connectOpt.serial.dataBits)) {
            // 此时TS会自动将num的类型收窄为 5 | 6 | 7 | 8
            cfg.options.dataBits = connectOpt.serial.dataBits; 
        } else {
            // 处理不合法的情况（如赋值为undefined或报错）
            cfg.options.dataBits = 8;
        }

        if (isStopBits(connectOpt.serial.stopBits)) {
            // 此时TS会自动将num的类型收窄为 1,2,1.5
            cfg.options.stopBits = connectOpt.serial.stopBits; 
        } else {
            // 处理不合法的情况（如赋值为undefined或报错）
            cfg.options.stopBits = 1;
        }
    }
    else if (connectOpt.conType === "TELNET") {
        cfg.type = "telnet";
        //cfg.name = connectOpt.name;
        cfg.options = {} as TelnetSessionConfig;
        cfg.options.host = connectOpt.telnet.host;
        cfg.options.port = connectOpt.telnet.port;
    }
    else {}

    return cfg;
}

function getTerminalConfigurationStr(terminal: ITerminalConfiguration) {
    let config = {
    name: "",
    conType: "SSH",
    ssh: {
      host: "",
      port: 22,
      username: "",
      type: "password",
      password: "",
      algorithms: {
        cipher: [],
      },
      privateKeyPath: "",
      passphrase: "",
    },
    telnet: {
      host: "",
      port: 23,
      username: "",
      password: ""
    },
    serial: {
      path: "",
      baudrate: 9600,
      dataBits: "8",
      parity: "None",
      stopBits: "1"
    }
  };
  
  config.name = terminal.name;
  config.conType = terminal.type.toUpperCase();
  if (isSerialTerminalConfig(terminal)) {
    config.serial.path = terminal.options.path;
    config.serial.baudrate = terminal.options.baudrate;
    config.serial.dataBits = terminal.options.dataBits;
    config.serial.parity = terminal.options.parity;
    config.serial.stopBits = terminal.options.stopBits;
  }
  else if (isSshTerminalConfig(terminal)) {
    config.ssh.host = terminal.options.host;
    config.ssh.port = terminal.options.port;
    config.ssh.username = terminal.options.username;
    if (!!terminal.options.type) {
        config.ssh.type = terminal.options.type;
    }
    config.ssh.password = terminal.options.password;
    config.ssh.privateKeyPath = terminal.options.privateKeyPath;
    config.ssh.passphrase = terminal.options.passphrase;     
  }
  else if (isTelnetTerminalConfig(terminal)) {
    config.telnet.host = terminal.options.host;
    config.telnet.port = terminal.options.port;
    config.telnet.username = terminal.options.username;
    config.telnet.password = terminal.options.password;
  }
  else {
      const warningmsg = l10n.t('xtp.terminal.message.warning.notsupported');
      vscode.window.showErrorMessage(`${warningmsg}: ${terminal.name}(${terminal.type})`);
  }
  return config;
}

function registerTerminalConfigurationView(context: vscode.ExtensionContext) {
  // 注册 Webview 视图提供器
  const terminalConfigView = new TerminalConfigWebViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'xtp.terminal.configView', // 与 package.json 中定义的视图 ID 一致
      terminalConfigView
    )
  );

  context.subscriptions.push(vscode.commands.registerCommand(
        'xtp.terminal.showTerminalConfiguration',
        (config: ITerminalConfiguration) => {
          terminalConfigView.showTerminalConfiguration(config);
        }
    ),
    vscode.commands.registerCommand(
        'xtp.terminal.editTerminalConfiguration',
        (config: ITerminalConfiguration) => {
          terminalConfigView.showTerminalConfiguration(config);
          terminalConfigView.editTerminalConfiguration();
        }
    ),
    vscode.commands.registerCommand(
        'xtp.terminal.configView.edit',
        () => {
          terminalConfigView.editTerminalConfiguration();
        }
    )
  );
}

class Handler {
  constructor(
    public webpanel: vscode.WebviewView, 
    private eventEmitter: EventEmitter
  ) {
    // 关键：在构造函数中监听Webview消息，并转发到eventEmitter
    this.webpanel.webview.onDidReceiveMessage((message) => {
      // 将Webview消息转换为eventEmitter事件（按message.type区分）
      this.eventEmitter.emit(message.type, message.content);
    });
  }

  // 监听特定事件（通过eventEmitter）
  on(event: string, callback: (content: any) => void): this {
    this.eventEmitter.on(event, callback);
    return this;
  }

  // 发送消息到Webview
  emit(event: string, content?: any) {
    this.webpanel.webview.postMessage({ 
      type: event, 
      content 
    });
  }
}

class TerminalConfigWebViewProvider implements vscode.WebviewViewProvider {
  private webview: vscode.WebviewView;
  private eventEmitter: EventEmitter;
  private readonly extensionUri: vscode.Uri;
  private handler: Handler;
  private currentConfig: ITerminalConfiguration; //当前处于编辑状态的终端名称

  constructor(uri: vscode.Uri) {
    this.extensionUri = uri;
    this.eventEmitter = new EventEmitter();
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.webview = webviewView;
    this.handler = new Handler(webviewView, this.eventEmitter);

    // 1. 先配置 Webview 选项（必须在赋值 HTML 前配置）
    const webviewPath = path.join(this.extensionUri.fsPath, "out", "webview"); // 用 path.join 避免路径分隔符问题
    webviewView.webview.options = { // 操作正确的 webviewView 对象
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(webviewPath)] // 限制资源访问范围
    };

    // 2. 读取 app.html（使用 path.join 确保跨平台路径正确）
    const targetPath = path.join(webviewPath, "app.html");
     try {
      // 同步读取：确保 HTML 内容准备好后再赋值
      const htmlContent = fs.readFileSync(targetPath, 'utf8');
      const resolvedHtml = this.buildPath(htmlContent, webviewView.webview, webviewPath);
      webviewView.webview.html = resolvedHtml;
      
      
      // 3. 后续的消息监听、销毁逻辑，都基于 webviewView
      webviewView.onDidDispose(() => {
        // 视图销毁时的清理逻辑
      });

      // 4. 设置消息处理
      this.setConfigurationViewEventHandler();
      
    } catch (err) {
      vscode.window.showErrorMessage(`Load plugin view failed: ${(err as Error).message}`);
    }
  }

  showTerminalConfiguration(terminal: ITerminalConfiguration) {
    if (this.handler === undefined || terminal === null) {
      return;
    }
    this.currentConfig = terminal;
    const config = getTerminalConfigurationStr(terminal);
    this.handler.emit('show-parameters', config);
  }

  editTerminalConfiguration() {
    //启动编辑时携带初始配置信息
    listSerialPort().then((ports) => {
      const portItems: string[] = ports.map((port) => {
        return port.path;
      });
      this.handler.emit('edit-parameters', {comList: portItems});
    });
  }

  private setConfigurationViewEventHandler() {    
    this.handler.on("init", () => {
      this.handler.emit('route', 'session');
    }).on("save-configuration", async (data) => {
          const config: ITerminalConfiguration = getTerminalConfigurationObj(data.connectionOption);
          const name = this.currentConfig.name;
          await vscode.commands.executeCommand('xtp.terminal.terminalListTree.save', name, config);
    }).on("choose-privatekey", ({ filters }) => {
        vscode.window.showOpenDialog({ filters }).then((uris) => {
            const uri = uris[0];
            if (uri) {
                this.handler.emit("choose-privatekey", uri.fsPath);
            }
        });
    });
  }

  private buildPath(data: string, webview: vscode.Webview, contextPath: string): string {
    //return data.replace(/((src|href)=("|'))(.+?\.(css|js))\b/gi, "$1" + webview.asWebviewUri(vscode.Uri.file(`${contextPath}`)) + "/$4");
    return data.replace(
      /(src|href)=("|')([^"']+\.(css|js))("|')/gi, // 更精确的正则：匹配 src="xxx.css" 或 href="xxx.js"
      (match, attr, quoteStart, resourcePath, ext, quoteEnd) => {
        // 1. 基于 contextPath（webview 资源根目录）创建资源的本地 URI
        const localResourceUri = vscode.Uri.file(path.join(contextPath, resourcePath));
        // 2. 转换为 WebView 可访问的 URI（关键：使用 asWebviewUri）
        const webviewResourceUri = webview.asWebviewUri(localResourceUri);
        // 3. 替换为正确的 URI
        return `${attr}=${quoteStart}${webviewResourceUri}${quoteEnd}`;
      }
    );
  }  
}

export {
    registerTerminalConfigurationView,
    getTerminalConfigurationObj
}