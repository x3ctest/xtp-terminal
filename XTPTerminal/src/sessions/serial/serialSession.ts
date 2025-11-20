import { l10n } from 'vscode';
import { SerialPort } from "serialport";
import { BaseSession, ISessionCallback } from "../basic/BasicSession";


const terminalNamePrefix = "PORT: ";

interface SerialPortConfiguration {
    path: string,
    baudrate: number,
    parity: 'none' | 'even' | 'odd' | undefined,
    dataBits: 5 | 6 | 7 | 8 | undefined,
    stopBits: 1 | 1.5 | 2 | undefined,
}

async function listSerialPort() {
    return SerialPort.list();
}

function serialPortInfo2String(portInfo: import("@serialport/bindings-cpp").PortInfo): string {
    let info = new Map<string, string>();
    let portInfoAny = portInfo as any;

    if (portInfoAny.friendlyName) { info.set("Name", portInfoAny.friendlyName); }
    if (portInfoAny.path) { info.set("Path", portInfoAny.path); }
    if (portInfoAny.manufacturer) { info.set("Manufacturer", portInfoAny.manufacturer); }
    if (portInfoAny.vendorId) { info.set("VendorId", portInfoAny.vendorId); }
    if (portInfoAny.productId) { info.set("ProductId", portInfoAny.productId); }
    if (portInfoAny.serialNumber) { info.set("SerialNumber", portInfoAny.serialNumber); }
    if (portInfoAny.pnpId) { info.set("PnpId", portInfoAny.pnpId); }
    if (portInfoAny.locationId) { info.set("LocationId", portInfoAny.locationId); }

    let maxWidth = 0;
    info.forEach((_, key) => {
        maxWidth = Math.max(key.length, maxWidth);
    });

    let infoString = "";
    info.forEach((value, key) => {
        infoString += `${l10n.t(key)}: ${value}\n`;
    });


    return infoString;
}

class SerialSession extends BaseSession {
    public constructor(config: SerialPortConfiguration, callback: ISessionCallback, pseudo: boolean = false) {
        super();
        /*this.state = {
            loging: false,
            timeStamp: getLogDefaultAddingTimeStamp(),
            hex: false,
        };*/
        this.serialConfig = config;
        this.callbacks = callback;
        //let opts = pseudo ? { create: false } : undefined;
        //this.terminal = new PseudoTerminal(name, opts);
        //this.init();
    }

    private init() {
        /*this.terminal.setOnInput(
            (data) => this.serialport.write(data)
        );
        this.terminal.setOnOpen(() => {
            this.terminal.write(this.serialport.isOpen ?
                colors.green.bold(l10n.t('({0}) CONNECTED', this.serialport.path) + '\r\n\r\n')
                : colors.red.bold(l10n.t('({0}) OPEN FAILED!', this.serialport.path) + '\r\n\r\n'));
        });
        this.terminal.setOnClose(() => {
            this.serialport.close();
            if (this.closeCallback) { this.closeCallback(); };
        });
        */
        this.serialPort.addListener("data", (data) =>{
            //this.terminal.write(data.toString())
            this.callbacks.onData(data);
        });

        this.serialPort.on("close", () => {
            this.callbacks.onClose();
            //this.terminal.write(colors.red.bold(
            //    "\n" + l10n.t("({0}) CLOSED!", this.serialport.path) + '\r\n\r\n'));
        }
        );
    }

    async open(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            let openCallBack = () => {
                //this.bIsOpen = true;
                this.init();
                /*const ret: ActionResult = {
                    result: true,
                    msg: ""
                }*/
                resolve(true);
                //resolve(new SerialSession(cfg.name, serialPort));
            };

            /* bug: If dataBits is assigned to undefined, opening the serial port fails, so... */
            if (this.serialConfig.dataBits) {
                this.serialPort = new SerialPort({
                    path: this.serialConfig.path,
                    baudRate: this.serialConfig.baudrate,
                    parity: this.serialConfig.parity,
                    dataBits: this.serialConfig.dataBits,
                    stopBits: this.serialConfig.stopBits,
                });
            } else {
                this.serialPort = new SerialPort({
                    path: this.serialConfig.path,
                    baudRate: this.serialConfig.baudrate,
                    parity: this.serialConfig.parity,
                    stopBits: this.serialConfig.stopBits,
                });
            }

            this.serialPort.open(openCallBack);
            //this.init();
        });
    }

    //setCloseCallback(callback?: () => void): void { this.closeCallback = callback; }

    //state: { loging: boolean; timeStamp: boolean; hex: boolean; };

    /*open(): void {
        if (this.serialport.isOpen) { return; }
        this.serialport.open(() => {
            this.terminal.write(this.serialport.isOpen ?
                colors.green.bold(l10n.t('({0}) CONNECTED', this.serialport.path) + '\r\n\r\n')
                : colors.red.bold(l10n.t('({0}) OPEN FAILED!', this.serialport.path) + '\r\n\r\n'));
        });
    }*/

    send(command:string) {}

    isOpen(): boolean {
        return this.serialPort.isOpen;
    }

    public close() {}

    serialConfig: SerialPortConfiguration;
    serialPort: SerialPort;
    callbacks: ISessionCallback;
}

export {
    SerialPortConfiguration,
    SerialSession,
    listSerialPort,
    //isSerialPortTerminal,
    terminalNamePrefix,
    serialPortInfo2String
};