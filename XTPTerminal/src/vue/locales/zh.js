export default {
  configview: {
    name: '终端名称：',
    type: '终端类型：',
    ssh: {
      host: '访问地址：',
      port: '访问端口：',
      username: '用户名：',
      type: "认证类型：",
      password: "密码：",
      algorithms: "认证算法：",
      privateKeyPath: "秘钥文件：",
      passphrase: "密码密码：",
    },
    telnet: {
      host: "访问地址：",
      port: "访问端口：",
      username: "用户名：",
      password: "密  码："
    },
    serial: {
      path: "串口名称：",
      baudrate: "波特率：",
      databits: "数据位：",
      parity: "校验位：",
      stopBits: "停止位："
    },
    saveBtn: "保存"
  }
}