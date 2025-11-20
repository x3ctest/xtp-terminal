<!-- 引入VS Code UI组件库的样式 -->
<template>
  <div>
    <!-- Telnet 连接表单 -->
    <section>
        <label class="inline-block w-32 mr-5 font-medium text-base">{{ $t('configview.telnet.host') }}</label>
        <input class="vscode-input"
            placeholder="Telnet Host (e.g., 127.0.0.1)"
            v-model="connectionOption.telnet.host"
            :disabled = "!editModel"
        ></input>
    </section>

    <section>
        <label class="inline-block w-32 mr-5 font-medium text-base">{{ $t('configview.telnet.port') }}</label>
        <input class="vscode-input"
            type="number"
            placeholder="Telnet Port (e.g., 23)"
            v-model="connectionOption.telnet.port"
            :disabled = "!editModel"
        ></input>
    </section>

    <section>
        <label class="inline-block w-32 mr-5 font-medium text-base">{{ $t('configview.telnet.username') }}</label>
        <input class="vscode-input"
            placeholder="Optional Username"
            v-model="connectionOption.telnet.username"
            :disabled = "!editModel"
        ></input>
    </section>

    <section>
        <label class="inline-block w-32 mr-5 font-medium text-base">{{ $t('configview.telnet.password') }}</label>
        <input class="vscode-input"
            type="password"
            placeholder="Optional Password"
            v-model="connectionOption.telnet.password"
            :disabled = "!editModel"
        ></input>
    </section>
  </div>
</template>


<script>
export default {
  props: {
    // 对 props 进行类型校验和默认值设置
   connectionOption: {
      type: Object,
      required: true,
      default: () => ({ telnet: { host: '', port: '', username: '', password: '' } })
    },
    editModel: true
  },
  methods: {
    /**
     * 触发 Telnet 连接事件
     */
    //   connectTelnet() {
    //     if (!this.connectionOption.host || !this.connectionOption.port) {
    //       this.$emit("error", "Please provide both host and port.");
    //       return;
    //     }
    //     this.$emit("connectTelnet", {
    //       host: this.connectionOption.host,
    //       port: this.connectionOption.port,
    //     });
    //   },
  }
};
</script>