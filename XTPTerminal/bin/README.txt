=================================================中文===============================================
XTP-Agent通过ZMQ的Router模式代理XTP-Python接口访问XTP-Terminal的命令。XTP-Agent编译成功后防止到XTP-Terminal的src/bin目录下和XTP-Termianl一起
打包为VSCode插件。在插件启动时自动启动XTP-Agent进程。在调试时可以手动启动xtp-agent.exe，并通过窗口输出查看代理命令交互过程。

在Windows系统编译:
set CGO_ENABLED=1
set CC=gcc.exe
set CGO_CFLAGS=-m64 -O2 -Wall -I.
set CGO_LDFLAGS=-m64 -L. -lzmq
go build -x xtp-agent.go

================================================English===============================================
[Introduction]
XTP-Agent proxies commands for accessing XTP-Terminal via the Router pattern of ZMQ through the XTP-Python interface. After successful compilation, 
XTP-Agent is placed in the src/bin directory of XTP-Terminal and packaged together with XTP-Terminal into a VS Code extension. When the extension starts, 
the XTP-Agent process is launched automatically. During debugging, you can manually start xtp-agent.exe and view the proxy command interaction process
through window output.

[Compile in Windows]
set CGO_ENABLED=1
set CC=gcc.exe
set CGO_CFLAGS=-m64 -O2 -Wall -I.
set CGO_LDFLAGS=-m64 -L. -lzmq
go build -x xtp-agent.go

