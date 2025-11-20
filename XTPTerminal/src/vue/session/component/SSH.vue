<template>
  <div class="mt-5">
    <section>
      <div class="inline-block mb-2 mr-10">
        <label class="inline-block font-bold mr-9 w-28">
          {{ $t('configview.ssh.host') }}
          <!--span class="mr-1 text-red-600" title="required">*</span-->
        </label>
        <input class="vscode-input" 
          placeholder="SSH Host" 
          required 
          v-model="connectionOption.ssh.host"
          :disabled = "!editModel"
        />
      </div>
      <div class="inline-block mb-2 mr-10">
        <label class="inline-block font-bold mr-9 w-28">
          {{ $t('configview.ssh.port') }}
          <!--span class="mr-1 text-red-600" title="required">*</span-->
        </label>
        <input
          class="vscode-input"
          placeholder="SSH Port"
          required
          type="number"
          v-model="connectionOption.ssh.port"
          :disabled = "!editModel"
        />
      </div>
    </section>

    <section>
      <div class="inline-block mb-2 mr-10">
        <label class="inline-block font-bold mr-9 w-28">
          {{ $t('configview.ssh.username') }}
          <!--span class="mr-1 text-red-600" title="required">*</span-->
        </label>
        <input class="vscode-input" 
         placeholder="SSH Username"  
         v-model="connectionOption.ssh.username"
         :disabled = "!editModel"
        />
      </div>

      <!--div class="inline-block mb-2 mr-10">
        <label class="inline-block font-bold mr-9 w-28">SSH Cipher:</label>
        <select  class="vscode-select" v-model="connectionOption.ssh.algorithms.cipher[0]" placeholder="Default">
          <option value="aes128-cbc">aes128-cbc</option>
          <option value="aes192-cbc">aes192-cbc</option>
          <option value="aes256-cbc">aes256-cbc</option>
          <option value="3des-cbc">3des-cbc</option>
          <option value="aes128-ctr">aes128-ctr</option>
          <option value="aes192-ctr">aes192-ctr</option>
          <option value="aes256-ctr">aes256-ctr</option>
        </select>
      </div-->
    </section>

    <!--section v-if="connectionOption.conType == 'SSH'">
      <div class="inline-block mb-2 mr-10">
        <label class="inline-block w-32 mr-5 font-bold">Show Hidden File</label>
        <el-switch v-model="connectionOption.showHidden"></el-switch>
      </div>
    </section-->

    <section class="mb-2">
      <label class="inline-block font-bold mr-9 w-28">{{ $t('configview.ssh.type') }}</label>
      <div class="vscode-radio-group">
        <label class="vscode-radio">
          <input type="radio" name="options" v-model="connectionOption.ssh.type" value="password" :disabled = "!editModel" checked>
          <span class="radio-indicator"></span>
          <span class="radio-label">Password</span>
        </label>
        <label class="vscode-radio">
          <input type="radio" name="options" v-model="connectionOption.ssh.type" value="privatekey" :disabled = "!editModel">
          <span class="radio-indicator"></span>
          <span class="radio-label">PrivateKey</span>
        </label>
        <!--label class="vscode-radio">
          <input type="radio" name="options" v-model="connectionOption.ssh.type" value="native">
          <span class="radio-indicator"></span>
          <span class="radio-label">Native SSH</span>
        </label-->
      </div>    
    </section>

    <div v-if="connectionOption.ssh.type == 'password'" class="mb-2">
      <section>
        <label class="inline-block font-bold mr-9 w-28">
          {{ $t('configview.ssh.password') }}
          <!--span class="mr-1 text-red-600" title="required">*</span-->
        </label>
        <input
          class="vscode-input"
          placeholder="Password"
          type="password"
          v-model="connectionOption.ssh.password"
          :disabled = "!editModel"
        />
      </section>
    </div>
    <div v-else class="mb-2">
      <section>
        <div class="inline-block mb-2 mr-8">
          <label class="inline-block font-bold mr-9 w-28">{{ $t('configview.ssh.privateKeyPath') }}</label>
          <div class="file-input-wrapper">
          <input
            class="vscode-input file-input"
            placeholder="Private Key Path"
            v-model="connectionOption.ssh.privateKeyPath"
            :disabled = "!editModel"
          />
          <button class="file-select-icon" @click="() => $emit('choosePrivatekey')" type="button" :disabled = "!editModel">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </button>
          </div>
        </div>
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block font-bold mr-9 w-28">{{ $t('configview.ssh.passphrase') }}</label>
          <input
            class="vscode-input"
            placeholder="Passphrase"
            type="password"
            v-model="connectionOption.ssh.passphrase"
            :disabled = "!editModel"
          />
        </div>
      </section>
      <!--section v-if="connectionOption.ssh.type == 'native'">
        <div class="inline-block mr-10">
          <label class="inline-block font-bold mr-9 w-28">Waiting Time:</label>
          <input
            class="vscode-input"
            placeholder="Waiting time for ssh command."
            v-model="connectionOption.ssh.watingTime"
          />
        </div>
      </section-->
    </div>
  </div>
</template>

<script>
export default {
   props: {
    // 对 props 进行类型校验和默认值设置
    connectionOption: {
      type: Object,
      required: true,
      default: () => ({ ssh: {host: "", port: 22, username: "", type: "password", password: "", algorithms: {cipher: [] }, privateKeyPath: "", passphrase: ""}})
    },
    editModel: false
  },
};
</script>