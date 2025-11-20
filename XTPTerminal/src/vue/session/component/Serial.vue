<template>
  <div class="mt-5">
    <section>
      <!--div class="inline-block mb-2 mr-10"-->
        <label class="inline-block font-bold mr-9 w-28">{{ $t('configview.serial.path') }}</label>
        <select class="vscode-select" v-model="connectionOption.serial.path" :disabled = "!editModel">
          <!-- option value="COM1">COM1</option -->
          <option v-for="item in comList" :key="item.value" :label="item.label" :value="item.label"/>
        </select>
      <!--/div-->
    </section>

    <section>
      <label class="inline-block font-bold mr-9 w-28"> {{ $t('configview.serial.baudrate') }}</label>
      <select class="vscode-select" v-model="connectionOption.serial.baudrate" :disabled = "!editModel">
        <option value="4800">4800</option>
        <option value="9600">9600</option>
        <option value="19200">19200</option>
        <option value="38400">38400</option>
        <option value="57600">57600</option>
        <option value="115200">115200</option>
        <option value="230400">230400</option>
      </select>
    </section>

    <section>
      <label class="inline-block font-bold mr-9 w-28">{{ $t('configview.serial.dataBits') }}</label>
      <select class="vscode-select" v-model="connectionOption.serial.dataBits" :disabled = "!editModel">
        <option value="5">5</option>
        <option value="6">6</option>
        <option value="7">7</option>
        <option value="8">8</option>
      </select>
    </section>

    <section>
      <label class="inline-block font-bold mr-9 w-28">{{ $t('configview.serial.parity') }}</label>
      <select class="vscode-select" v-model="connectionOption.serial.parity" :disabled = "!editModel">
        <option value="None">None</option>
        <option value="Odd">Odd</option>
        <option value="Even">Even</option>
        <option value="Mark">Mark</option>
        <option value="Space">Space</option>
      </select>
    </section>

    <section>
      <label class="inline-block font-bold mr-9 w-28">{{ $t('configview.serial.stopBits') }}</label>
      <select class="vscode-select" v-model="connectionOption.serial.stopBits">
        <option value="1">1</option>
        <option value="1.5">1.5</option>
        <option value="2">2</option>
      </select>
    </section>
  </div>
</template>

<script>
import { getVscodeEvent } from "../../util/vscode";
let vscodeEvent;

export default {
  props: {
    // 对 props 进行类型校验和默认值设置
    connectionOption: {
      type: Object,
      required: true,
      default: () => ({ serial: { path: '', baudrate: '9600', dataBits: '8', parity: 'None', stopBits: '1' }})
    },
    comList: [],
    editModel: false
  },
  mounted() {
    /*vscodeEvent = getVscodeEvent();
    vscodeEvent
      .on("xtp.terminal.connection.recvserialports", event => {
        // 格式化数据以适配select
        //console.log(event.data);
        this.com_list = event.data.map((item, index) => {
          // 假设原始数据是简单字符串数组，转换为{label, value}格式
          return {
             label: item,
             value: index
          };
      })
    });
        
    // 向插件主进程发送消息
    vscodeEvent.emit("xtp.terminal.connection.getserialports");*/
  }
};
</script>
