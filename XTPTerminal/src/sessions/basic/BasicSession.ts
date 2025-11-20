class BaseSession {
    readonly callbacks: ISessionCallback;
    public async open(): Promise<boolean> {
        return false;
    }
    public close(): void {}
    isOpen(): boolean {return false;}
    //startLogging(timeStamp?: boolean): Promise<boolean>;
    //stopLogging(): boolean;
    //setCloseCallback(callback?: () => void): void;
    send(command: string): void {}
}

interface ISessionCallback {
    onData: (data: any) => void;
    onClose: () => void;
    onError: (err: Error) => void;
}

export {
    BaseSession,
    ISessionCallback
}