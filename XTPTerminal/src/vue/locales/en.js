export default {
  configview: {
    name: 'Terminal Name:',
    type: 'Terminal Type:',
    ssh: {
      host: 'Host:',
      port: 'Port:',
      username: 'User Name:',
      type: "Authentication Type:",
      password: "Password:",
      algorithms: "Authentication Algorithms:",
      privateKeyPath: "Private Key:",
      passphrase: "Passphrase:",
    },
    telnet: {
      host: "Host:",
      port: "Port:",
      username: "User Name:",
      password: "Password:"
    },
    serial: {
      path: "Path:",
      baudrate: "Baudrate:",
      dataBits: "Databits:",
      parity: "Parity:",
      stopBits: "Stopbits:"
    },
    saveBtn: "Save"
  }
}