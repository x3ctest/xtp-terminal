# XTP Terminal - 测试平台终端扩展

一个功能强大的VS Code终端扩展，支持多种终端类型和网络拓扑编辑。

## 主要功能

### 1. 多类型终端支持

- **SSH终端**: 支持密码和私钥认证
- **Telnet终端**: 标准Telnet连接
- **Serial终端**: 串口通信，支持自动检测本地COM端口
- **DUMMY终端**: 虚拟终端，用于测试
- **RPC终端**: 远程过程调用终端

### 2. 网络拓扑编辑器

- 可视化网络拓扑设计
- 拖拽式设备添加
- 设备连接管理
- 设备属性配置
- 终端参数配置
- 设备名称唯一性检查
- 支持自定义设备类型和图标

### 3. 终端管理

- 多终端同时运行
- 终端窗口位置配置（编辑区域/终端区域）
- 终端日志记录
- 时间戳支持
- 终端内容缓冲

### 4. 脚本笔记本

脚本笔记本是一个用于编写和管理自动化脚本的工具，支持批量执行终端命令。

#### 功能特性

- **脚本文件管理**: 创建、编辑、删除脚本文件（.xts格式）
- **脚本编写**: 支持编写自动化测试脚本
- **脚本执行**: 在终端中执行脚本命令
- **文件树浏览**: 以树形结构浏览脚本文件

#### 使用方法

1. **创建脚本文件**
   - 在脚本笔记本视图中点击"新建"按钮
   - 输入脚本文件名（仅支持字母、数字、下划线和连字符）
   - 自动创建 `.xts` 格式的脚本文件

2. **编辑脚本**
   - 点击脚本文件在编辑器中打开
   - 编写自动化脚本内容

3. **执行脚本**
   - 在终端中通过命令执行脚本
   - 支持批量命令执行

#### 脚本文件格式

脚本文件使用 `.xts` 扩展名，内容为文本格式，支持以下功能：

- 命令序列
- 等待响应
- 条件判断
- 循环执行

#### 配置选项

```json
{
  "xtp.terminal.script.savePath": "脚本保存路径"
}
```

默认保存路径：`用户主目录/xtp/scriptNoteBook`

## 配置选项

### 终端显示位置

配置终端窗口的显示位置：

```json
{
  "xtp.terminal.view.showEditArea": true
}
```

- `true`: 终端显示在编辑器区域
- `false`: 终端显示在终端面板

### 日志配置

```json
{
  "xtp.terminal.log.savePath": "日志保存路径",
  "xtp.terminal.log.size": 日志文件大小限制,
  "xtp.terminal.log.defaultAddingTimeStamp": true
}
```

## 使用方法

### 打开网络拓扑编辑器

1. 创建或打开 `.tbdx` 文件
2. 自动打开网络拓扑编辑器
3. 从左侧面板拖拽设备到画布
4. 右键点击设备开始连接
5. 双击设备打开终端

### 配置设备

1. 点击设备选中
2. 在右侧属性面板配置设备参数
3. 选择终端类型（SSH/Telnet/Serial/DUMMY/RPC）
4. 配置连接参数

### Serial端口配置

1. 选择Serial终端类型
2. 端口下拉列表自动显示可用COM端口
3. 配置波特率、数据位、校验位、停止位

## 文件格式

### 测试床文件 (.tbdx)

```json
{
  "description": "xterm configuration profile",
  "version": "0.0.1",
  "devices": [
    {
      "name": "设备名称",
      "type": "设备类型",
      "position": {
        "x": 100,
        "y": 100
      },
      "access-terminal": {
        "type": "ssh",
        "options": {
          "host": "192.168.1.1",
          "port": 22,
          "username": "user",
          "password": "password"
        }
      }
    }
  ],
  "links": [
    {
      "source": {
        "device": "设备1",
        "port": "端口1"
      },
      "destination": {
        "device": "设备2",
        "port": "端口2"
      }
    }
  ]
}
```

## 技术架构

### 核心组件

- **VtyTerminal**: 终端实例管理
- **TerminalManager**: 终端生命周期管理
- **ZmqRouterService**: ZeroMQ通信服务
- **NetworkTopologyEditorProvider**: 网络拓扑编辑器提供者

### 会话管理

- **SessionFactory**: 会话工厂
- **SSHSession**: SSH会话
- **TelnetSession**: Telnet会话
- **SerialSession**: 串口会话

### Vue组件

- **NetworkTopologyEditor**: 网络拓扑编辑器组件
- **TerminalListView**: 终端列表视图

## 开发计划

### 已完成

- [x] 多类型终端支持
- [x] 网络拓扑编辑器
- [x] 设备连接管理
- [x] 终端日志记录
- [x] 脚本笔记本
- [x] 终端显示位置配置
- [x] Serial端口自动检测
- [x] 设备名称唯一性检查

### 进行中

- [ ] 终端视图增强
  - [ ] 日志开关
  - [ ] 时间戳开关
  - [ ] 断开连接
  - [ ] 清空终端
  - [ ] 波特率修改
  - [ ] 十六进制显示

### 计划中

- [ ] X/Y/Zmodem协议支持
- [ ] 十六进制数据发送和显示
- [ ] 日志浏览器增强
- [ ] 脚本笔记本浏览器增强

## 安装

1. 下载 `.vsix` 文件
2. 在VS Code中按 `Ctrl+Shift+P`
3. 输入 `Extensions: Install from VSIX`
4. 选择下载的 `.vsix` 文件

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！
