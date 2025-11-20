<template>
  <form @submit.prevent="saveConfiguration" class="flex flex-col mx-auto connect-container">
    <!-- 终端名称部分 -->
    <section class="flex flex-wrap items-center mb-5">
      <div class="w-full md:w-auto">
        <label class="inline-block w-24 font-bold text-right pr-4">{{ $t('configview.name') }}</label>
        <input
          class="vscode-input"
          required
          placeholder="Connection name"
          v-model="connectionOption.name"
          :disabled = "!editModel"
        />
      </div>
    </section>

    <!-- 连接类型部分 -->
    <section class="mb-5">
      <div class="w-full md:w-auto">
        <label class="block w-24 font-bold mb-2 text-left">{{ $t('configview.type') }}</label>
        <!-- 下拉列表容器 -->
        <select 
          class="vscode-select"
          v-model="connectionOption.conType"
          :disabled = "!editModel"
        >
          <!-- 循环生成下拉选项 -->
          <option 
            v-for="supportConnection in supportConnections" 
            :key="supportConnection"
            :value="supportConnection">
            {{ supportConnection }}
          </option>
        </select>
      </div>
    </section>


    <TELNET v-if="connectionOption.conType == 'TELNET'" :connectionOption="connectionOption" :context="context" :edit-model="editModel" />
    <SSH v-else-if="connectionOption.conType == 'SSH'" :connectionOption="connectionOption" @choosePrivatekey="onChoosePrivateKey" :edit-model="editModel"/>
    <SERIAL v-else-if="connectionOption.conType == 'SERIAL'" :connectionOption="connectionOption" :edit-model="editModel" :com-list="comList"/>

    <section>
      <div class="mt-2">
        <button class="vscode-button" type="submit" :disabled="!editModel">{{ $t('configview.saveBtn') }}</button>
      </div>
    </section>
  </form>
</template>

<script>
import SSH from "./component/SSH.vue";
import TELNET from './component/Telnet.vue'
import SERIAL from './component/Serial.vue'
import { getVscodeEvent } from "../util/vscode";
let vscodeEvent;
export default {
  name: "Session",
  components: { SSH, TELNET, SERIAL },
  data() {
    return {
      connectionOption: {
        name: "",
        conType: "SSH",
        ssh: {
          host: "",
          port: 22,
          username: "",
          type: "password",
          password: "",
          algorithms: {
            cipher: [],
          },
          privateKeyPath: "",
          passphrase: "",
        },
        telnet: {
          host: "",
          port: 23,
          username: "",
          password: ""
        },
        serial: {
          path: "",
          baudrate: 9600,
          dataBits: "8",
          parity: "None",
          stopBits: "1"
        }
      },
      supportConnections: [
        "SSH",
        "TELNET",
        "SERIAL"
      ],
      comList: [],
      editModel: false,
    };
  },
  mounted() {
    vscodeEvent = getVscodeEvent();
    vscodeEvent
      .on("choose-privatekey", (path) => {
        this.connectionOption.ssh.privateKeyPath = path;
        this.$forceUpdate();
      })      
      .on("show-parameters", (config) => {
        this.connectionOption = config;
        this.editModel = false;
        this.$forceUpdate();
      })
      .on("edit-parameters", (data) => {
        //this.connectionOption = config;
        console.log(data);
        this.comList = data.comList.map((item, index) => {
            // 假设原始数据是简单字符串数组，转换为{label, value}格式
            return {
              label: item,
              value: index
            };
        })
        console.log(this.comList);
        this.editModel = true;
        this.$forceUpdate();
      });
    vscodeEvent.emit("route-" + this.$route.name);
  },
  destroyed() {
    vscodeEvent.destroy();
  },
  methods: {
    saveConfiguration() {
      vscodeEvent.emit("save-configuration", {
        connectionOption: this.connectionOption,
      });
    },
    onChoosePrivateKey() {
      let filters = {};
      filters["PrivateKey"] = ["key", "cer", "crt", "der", "pub", "pem", "pk"];
      filters["File"] = ["*"];
      vscodeEvent.emit("choose-privatekey", filters);
    }
  }
};
</script>
