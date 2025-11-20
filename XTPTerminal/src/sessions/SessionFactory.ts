import { BaseSession, ISessionCallback } from "./basic/BasicSession";
import { SSHSession, SshSessionConfiguration } from "./ssh/sshSession";
import { SerialSession, SerialPortConfiguration } from "./serial/serialSession";
import { TelnetSession, TelnetSessionConfig } from "./telnet/telnetSession";


interface ISessionConfiguration {
    type: string;
    options: any;
}

// 判断是否为Serial终端配置
function isSerialConfig(type: string, config: any): config is SerialPortConfiguration {
    return type === 'serial';
}
  
// 判断是否为SSH终端配置
function isSshConfig(type: string, config: any): config is SshSessionConfiguration {
    return type === 'ssh';
}

// 判断是否为SSH终端配置
function isTelnetConfig(type: string, config: any): config is TelnetSessionConfig {
    return type === 'telnet';
}

class SessionFactory {
    static async createSession(cfg: ISessionConfiguration, callback:ISessionCallback, pseudo: boolean = false): Promise<BaseSession> {
        var session : BaseSession;
        if (isSerialConfig(cfg.type, cfg.options)) {
            session = new SerialSession(cfg.options, callback, pseudo);
        } else if(isSshConfig(cfg.type, cfg.options)) {
            session = new SSHSession(cfg.options, callback, pseudo);
        } else if (isTelnetConfig(cfg.type, cfg.options)) {
            session = new TelnetSession(cfg.options, callback, pseudo);
        } else {
            const err : Error = {
                name: "XTP session type undefined",
                message: "session type ${cfg.type} undefined"
            };
            callback.onError(err);
            return null;
        }

        return session;
        
        /*try {
            const result: boolean = await session.open();
            return result ? session : null;
        } catch (err) {
            callback.onError(err as Error);
            return null; 
         }*/
    }
}

export {
    ISessionConfiguration,
    SessionFactory
}