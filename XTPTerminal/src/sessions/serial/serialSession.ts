import { l10n } from 'vscode';
import { BaseSession, ISessionCallback } from "../basic/BasicSession";

const terminalNamePrefix = "PORT: ";

interface SerialPortConfiguration {
    path: string,
    baudrate: number,
    parity: 'none' | 'even' | 'odd' | undefined,
    dataBits: 5 | 6 | 7 | 8 | undefined,
    stopBits: 1 | 1.5 | 2 | undefined,
}

// 动态导入SerialPort模块
let SerialPort: any = null;

async function loadSerialPort() {
    if (!SerialPort) {
        try {
            const serialport = await import('serialport');
            SerialPort = serialport.SerialPort;
        } catch (error) {
            console.error('Failed to load serialport module:', error);
            throw new Error('Serial port module not available');
        }
    }
    return SerialPort;
}

async function listSerialPort() {
    const serialPort = await loadSerialPort();
    return serialPort.list();
}

function serialPortInfo2String(portInfo: any): string {
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

    let infoString = "";
    info.forEach((value, key) => {
        infoString += `${l10n.t(key)}: ${value}\n`;
    });

    return infoString;
}

class SerialSession extends BaseSession {
    public constructor(config: SerialPortConfiguration, callback: ISessionCallback, pseudo: boolean = false) {
        super();
        this.serialConfig = config;
        this.callbacks = callback;
    }

    private init() {
        this.serialPort.addListener("data", (data: Buffer) => {
            this.callbacks.onData(data);
        });

        this.serialPort.on("close", () => {
            this.callbacks.onClose();
        });
    }

    async open(): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            try {
                const serialPort = await loadSerialPort();
                
                let openCallBack = () => {
                    this.init();
                    resolve(true);
                };

                /* bug: If dataBits is assigned to undefined, opening the serial port fails, so... */
                if (this.serialConfig.dataBits) {
                    this.serialPort = new serialPort({
                        path: this.serialConfig.path,
                        baudRate: this.serialConfig.baudrate,
                        parity: this.serialConfig.parity,
                        dataBits: this.serialConfig.dataBits,
                        stopBits: this.serialConfig.stopBits,
                    });
                } else {
                    this.serialPort = new serialPort({
                        path: this.serialConfig.path,
                        baudRate: this.serialConfig.baudrate,
                        parity: this.serialConfig.parity,
                        stopBits: this.serialConfig.stopBits,
                    });
                }

                this.serialPort.open(openCallBack);
            } catch (error) {
                console.error('Failed to open serial port:', error);
                resolve(false);
            }
        });
    }

    send(command: string) {}

    isOpen(): boolean {
        return this.serialPort && this.serialPort.isOpen;
    }

    public close() {}

    serialConfig: SerialPortConfiguration;
    serialPort: any; // 使用any类型，因为SerialPort类型在动态导入后才可用
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