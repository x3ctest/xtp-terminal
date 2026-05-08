<template>
  <div class="network-topology-editor">
    <div class="editor-content">
      <div class="canvas-container">
        <div 
          ref="canvas"
          class="canvas"
          @mousedown="startDrag"
          @mousemove="drag"
          @mouseup="handleMouseUp"
          @mouseleave="handleMouseLeave"
          @dragover.prevent="onDragOver"
          @drop="onDrop"
        >
          <!-- 连接线 -->
          <svg class="connections" width="100%" height="100%" style="position: absolute; top: 0; left: 0; pointer-events: auto; z-index: 1;">
            <g v-for="(connection, index) in connections" :key="connection.id">
              <!-- 计算两个设备之间的连接偏移量，使多条连接平行显示 -->
              <template v-if="connection.fromIndex !== connection.toIndex">
                <!-- 找到相同设备对的所有连接 -->
                <template>
                  <!-- 计算偏移量 -->
                  <g>
                    <!-- 连接线 -->
                    <line 
                      :x1="devices[connection.fromIndex].x + 50 + (connection.id.split('-')[2] ? parseInt(connection.id.split('-')[2]) * 15 : 0)"
                      :y1="devices[connection.fromIndex].y + 30 + (connection.id.split('-')[2] ? parseInt(connection.id.split('-')[2]) * 8 : 0)"
                      :x2="devices[connection.toIndex].x + 50 + (connection.id.split('-')[2] ? parseInt(connection.id.split('-')[2]) * 15 : 0)"
                      :y2="devices[connection.toIndex].y + 30 + (connection.id.split('-')[2] ? parseInt(connection.id.split('-')[2]) * 8 : 0)"
                      :style="{
                        stroke: selectedConnectionIndex === index ? '#0078D4' : '#FF9800',
                        strokeWidth: selectedConnectionIndex === index ? '4' : '2',
                        strokeLinecap: 'round',
                        cursor: 'pointer'
                      }"
                      @click="selectConnection(index)"
                      @mousemove="updateTooltipPosition($event, index)"
                      @mouseenter="showConnectionTooltip(index)"
                      @mouseleave="hideConnectionTooltip()"
                    />
                  </g>
                </template>
              </template>
            </g>
            
            <!-- 连接提示框 -->
            <g v-if="hoveredConnectionIndex >= 0 && hoveredConnectionTooltip" style="pointer-events: none;">
              <!-- 计算文本长度，确保背景框足够宽 -->
              <!--text 
                :x="tooltipPosition.x"
                :y="tooltipPosition.y - 12"
                text-anchor="middle"
                fill="white"
                font-size="12"
                style="visibility: hidden;"
                ref="tooltipText"
              >
                {{ hoveredConnectionTooltip }}
              </text-->
              <!-- 背景框 -->
              <!--rect 
                :x="tooltipPosition.x - 15"
                :y="tooltipPosition.y - 30"
                :width="Math.max(tooltipWidth + 30, 120)"
                height="24"
                rx="4"
                fill="rgba(0, 0, 0, 0.8)"
              /-->
              <!-- 实际文本 -->
              <text 
                :x="tooltipPosition.x"
                :y="tooltipPosition.y - 12"
                text-anchor="middle"
                fill="white"
                font-size="12"
                style="white-space: nowrap;"
              >
                {{ hoveredConnectionTooltip }}
              </text>
            </g>
          </svg>
          
          <div 
            v-for="(device, index) in devices" 
            :key="device.name"
            class="device"
            :class="[device.type, { 'selected': selectedDeviceIndex === index }]"
            :style="{
              left: device.x + 'px',
              top: device.y + 'px',
              position: 'absolute',
              zIndex: 2
            }"
            @mousedown.stop="startDragDevice($event, index)"
            @mousedown.right.stop="startConnectDevice($event, index)"
            @click.stop="selectDevice(index)"
            @dblclick.stop="openDeviceTerminal(index)"
          >
            <div class="device-header">
              <div class="device-name-container">
                <div class="device-icon-container">
                  <span v-if="device.icon" class="device-icon" draggable="false">
                    <img :src="device.icon" alt="" width="48" height="48" draggable="false">
                  </span>
                  <span v-else class="device-icon placeholder">
                    {{ getDeviceTypeLabel(device.type).charAt(0) }}
                  </span>
                  <span class="device-name">{{ device.name }}</span>
                </div>
                <div class="device-actions">
                  <button @click.stop="removeDevice(index)" class="action-btn delete-btn">
                    <span>×</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="properties-panel">
        <div class="palette">
          <h3>网络对象</h3>
          <div class="device-types">
            <div 
              v-for="item in deviceTypeTree" 
              :key="item.value" 
              class="device-type-item"
              @dragstart="onDragStart($event, item.value)"
              draggable="true"
            >
              <span v-if="item.icon" class="device-type-icon">
                <img :src="item.icon" alt="" width="16" height="16">
              </span>
              <span v-else class="device-type-icon placeholder">
                {{ item.label.charAt(0) }}
              </span>
              {{ item.label || 'Unknown' }}
            </div>
          </div>
        </div>
        
        <div class="divider"></div>
        
        <!-- 设备属性 -->
        <div class="palette" v-if="selectedDeviceIndex >= 0">
          <h3>设备属性</h3>
          <div class="property-form">
            <div class="form-group">
              <label>设备名称</label>
              <input 
                type="text" 
                class="form-control" 
                v-model="devices[selectedDeviceIndex].name"
                @input="updateDeviceName"
              >
            </div>
            <div class="form-group">
              <label>设备类型</label>
              <select 
                class="form-control" 
                v-model="devices[selectedDeviceIndex].type"
                @change="updateDeviceType"
              >
                <option v-for="type in deviceTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>终端类型</label>
              <select 
                class="form-control" 
                v-model="selectedDeviceTerminalType"
                @change="updateTerminalType"
              >
                <option value="ssh">SSH</option>
                <option value="telnet">Telnet</option>
                <option value="serial">Serial</option>
                <option value="rpc">RPC</option>
                <option value="dummy">DUMMY</option>
              </select>
            </div>
            
            <!-- SSH 终端配置 -->
            <div v-if="selectedDeviceTerminalType === 'ssh'" class="terminal-config">
              <h4>SSH 配置</h4>
              <div class="form-group">
                <label>主机</label>
                <input type="text" class="form-control" v-model="sshConfig.host" @input="updateTerminalConfig">
              </div>
              <div class="form-group">
                <label>端口</label>
                <input type="number" class="form-control" v-model.number="sshConfig.port" @input="updateTerminalConfig">
              </div>
              <div class="form-group">
                <label>用户名</label>
                <input type="text" class="form-control" v-model="sshConfig.username" @input="updateTerminalConfig">
              </div>
              <div class="form-group">
                <label>认证类型</label>
                <select class="form-control" v-model="sshConfig.type" @change="updateTerminalConfig">
                  <option value="password">密码</option>
                  <option value="privateKey">私钥</option>
                </select>
              </div>
              <div v-if="sshConfig.type === 'password'" class="form-group">
                <label>密码</label>
                <input type="password" class="form-control" v-model="sshConfig.password" @input="updateTerminalConfig">
              </div>
              <div v-else class="form-group">
                <label>私钥路径</label>
                <input type="text" class="form-control" v-model="sshConfig.privateKeyPath" @input="updateTerminalConfig">
              </div>
              <div v-if="sshConfig.type === 'privateKey'" class="form-group">
                <label>密码短语</label>
                <input type="password" class="form-control" v-model="sshConfig.passphrase" @input="updateTerminalConfig">
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" v-model="sshConfig.enableSftp" @change="updateTerminalConfig">
                  启用SFTP浏览器
                </label>
              </div>
              <!-- 终端Dimension配置 -->
              <div class="form-group">
                <label>
                  <input type="checkbox" v-model="sshConfig.dimension.autoResize" @change="updateTerminalConfig">
                  自动适配窗口行列
                </label>
              </div>
              <div v-if="!sshConfig.dimension.autoResize" class="dimension-config">
                <div class="form-group">
                  <label>行数</label>
                  <input type="number" class="form-control" 
                         v-model.number="sshConfig.dimension.rows" 
                         @input="updateTerminalConfig"
                         min="1" max="65535">
                </div>
                <div class="form-group">
                  <label>列数</label>
                  <input type="number" class="form-control" 
                         v-model.number="sshConfig.dimension.cols" 
                         @input="updateTerminalConfig"
                         min="1" max="65535">
                </div>
              </div>
            </div>
            
            <!-- Telnet 终端配置 -->
            <div v-if="selectedDeviceTerminalType === 'telnet'" class="terminal-config">
              <h4>Telnet 配置</h4>
              <div class="form-group">
                <label>主机</label>
                <input type="text" class="form-control" v-model="telnetConfig.host" @input="updateTerminalConfig">
              </div>
              <div class="form-group">
                <label>端口</label>
                <input type="number" class="form-control" v-model.number="telnetConfig.port" @input="updateTerminalConfig">
              </div>
              <div class="form-group">
                <label>用户名</label>
                <input type="text" class="form-control" v-model="telnetConfig.username" @input="updateTerminalConfig">
              </div>
              <div class="form-group">
                <label>密码</label>
                <input type="password" class="form-control" v-model="telnetConfig.password" @input="updateTerminalConfig">
              </div>
              <!-- 终端Dimension配置 -->
              <div class="form-group">
                <label>
                  <input type="checkbox" v-model="telnetConfig.dimension.autoResize" @change="updateTerminalConfig">
                  自动适配窗口行列
                </label>
              </div>
              <div v-if="!telnetConfig.dimension.autoResize" class="dimension-config">
                <div class="form-group">
                  <label>行数</label>
                  <input type="number" class="form-control" 
                         v-model.number="telnetConfig.dimension.rows" 
                         @input="updateTerminalConfig"
                         min="1" max="65535">
                </div>
                <div class="form-group">
                  <label>列数</label>
                  <input type="number" class="form-control" 
                         v-model.number="telnetConfig.dimension.cols" 
                         @input="updateTerminalConfig"
                         min="1" max="65535">
                </div>
              </div>
            </div>
            
            <!-- Serial 终端配置 -->
            <div v-if="selectedDeviceTerminalType === 'serial'" class="terminal-config">
              <h4>Serial 配置</h4>
              <div class="form-group">
                <label>端口</label>
                <select class="form-control" v-model="serialConfig.path" @change="updateTerminalConfig">
                  <option value="">请选择端口</option>
                  <option v-for="port in serialPorts" :key="port.path" :value="port.path">
                    {{ port.path }}{{ port.friendlyName ? ' (' + port.friendlyName + ')' : '' }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>波特率</label>
                <input type="number" class="form-control" v-model.number="serialConfig.baudrate" @input="updateTerminalConfig">
              </div>
              <div class="form-group">
                <label>数据位</label>
                <select class="form-control" v-model="serialConfig.dataBits" @change="updateTerminalConfig">
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                </select>
              </div>
              <div class="form-group">
                <label>校验位</label>
                <select class="form-control" v-model="serialConfig.parity" @change="updateTerminalConfig">
                  <option value="None">None</option>
                  <option value="Odd">Odd</option>
                  <option value="Even">Even</option>
                  <option value="Mark">Mark</option>
                  <option value="Space">Space</option>
                </select>
              </div>
              <div class="form-group">
                <label>停止位</label>
                <select class="form-control" v-model="serialConfig.stopBits" @change="updateTerminalConfig">
                  <option value="1">1</option>
                  <option value="1.5">1.5</option>
                  <option value="2">2</option>
                </select>
              </div>
              <!-- 终端Dimension配置 -->
              <div class="form-group">
                <label>
                  <input type="checkbox" v-model="serialConfig.dimension.autoResize" @change="updateTerminalConfig">
                  自动适配窗口行列
                </label>
              </div>
              <div v-if="!serialConfig.dimension.autoResize" class="dimension-config">
                <div class="form-group">
                  <label>行数</label>
                  <input type="number" class="form-control" 
                         v-model.number="serialConfig.dimension.rows" 
                         @input="updateTerminalConfig"
                         min="1" max="65535">
                </div>
                <div class="form-group">
                  <label>列数</label>
                  <input type="number" class="form-control" 
                         v-model.number="serialConfig.dimension.cols" 
                         @input="updateTerminalConfig"
                         min="1" max="65535">
                </div>
              </div>
            </div>
            
            <!-- DUMMY 终端配置 -->
            <div v-if="selectedDeviceTerminalType === 'dummy'" class="terminal-config">
              <h4>DUMMY 配置</h4>
              <div class="form-group">
                <label>IP地址</label>
                <input type="text" class="form-control" v-model="dummyConfig.ip" @input="updateTerminalConfig">
              </div>
            </div>
            
            <!-- RPC 终端配置 -->
            <div v-if="selectedDeviceTerminalType === 'rpc'" class="terminal-config">
              <h4>RPC 配置</h4>
              <div class="form-group">
                <label>IP地址</label>
                <input type="text" class="form-control" v-model="rpcConfig.ip" @input="updateTerminalConfig">
              </div>
            </div>
          </div>
        </div>
        
        <!-- 连接属性 -->
        <div class="palette" v-else-if="selectedConnectionIndex >= 0 && selectedConnection">
          <h3>连接属性</h3>
          <div class="property-form">
            <h4>源设备</h4>
            <div class="form-group">
              <label>设备名称</label>
              <input type="text" class="form-control" v-model="selectedConnection.source.device" @input="updateConnection" disabled>
            </div>
            <div class="form-group">
              <label>端口名称</label>
              <input type="text" class="form-control" v-model="selectedConnection.source.port" @input="updateConnection">
            </div>
            <div class="form-group">
              <label>IPv4地址</label>
              <input type="text" class="form-control" v-model="selectedConnection.source.ipv4" @input="updateConnection">
            </div>
            <div class="form-group">
              <label>IPv6地址</label>
              <input type="text" class="form-control" v-model="selectedConnection.source.ipv6" @input="updateConnection">
            </div>
            
            <h4>目的设备</h4>
            <div class="form-group">
              <label>设备名称</label>
              <input type="text" class="form-control" v-model="selectedConnection.destination.device" @input="updateConnection" disabled>
            </div>
            <div class="form-group">
              <label>端口名称</label>
              <input type="text" class="form-control" v-model="selectedConnection.destination.port" @input="updateConnection">
            </div>
            <div class="form-group">
              <label>IPv4地址</label>
              <input type="text" class="form-control" v-model="selectedConnection.destination.ipv4" @input="updateConnection">
            </div>
            <div class="form-group">
              <label>IPv6地址</label>
              <input type="text" class="form-control" v-model="selectedConnection.destination.ipv6" @input="updateConnection">
            </div>
          </div>
        </div>
        
        <!-- 未选择任何对象 -->
        <div class="palette" v-else>
          <h3>属性</h3>
          <p>请选择一个设备或连接以查看其属性</p>
        </div>
      </div>
    </div>
  </div>
</template>

<!-- 设备类型树节点组件 -->

<script>
export default {
  name: 'NetworkTopologyEditor',

  data() {
    return {
      devices: [],
      connections: [],
      links: [],
      selectedDeviceIndex: -1,
      selectedDeviceOldName: '',
      selectedConnectionIndex: -1,
      selectedConnection: null,
      hoveredConnectionIndex: -1,
      hoveredConnectionTooltip: '',
      tooltipPosition: { x: 0, y: 0 },
      tooltipWidth: 0,
      isDragging: false,
      isConnecting: false,
      dragStart: { x: 0, y: 0 },
      dragDeviceIndex: -1,
      connectStartIndex: -1,
      connectEndIndex: -1,
      deviceTypes: [],
      deviceTypeTree: [],
      fullDeviceTypeTree: [],
      selectedDeviceTerminalType: 'ssh',
      serialPorts: [],
      sshConfig: {
        host: '',
        port: 22,
        username: '',
        type: 'password',
        password: '',
        privateKeyPath: '',
        passphrase: '',
        enableSftp: true,
        dimension: {
          autoResize: true,
          rows: 24,
          cols: 80
        }
      },
      telnetConfig: {
        host: '',
        port: 23,
        username: '',
        password: '',
        dimension: {
          autoResize: true,
          rows: 24,
          cols: 80
        }
      },
      serialConfig: {
        path: '',
        baudrate: 9600,
        dataBits: '8',
        parity: 'None',
        stopBits: '1',
        dimension: {
          autoResize: true,
          rows: 24,
          cols: 80
        }
      },
      dummyConfig: {
        ip: ''
      },
      rpcConfig: {
        ip: ''
      }
    };
  },
  mounted() {
    console.log('NetworkTopologyEditor mounted');
    console.log('window.devices:', window.devices);
    console.log('window.deviceTypeTree:', window.deviceTypeTree);
    
    // 加载设备类型信息
    this.loadDeviceTypes();
    console.log('After loadDeviceTypes - deviceTypeTree:', this.deviceTypeTree);
    console.log('After loadDeviceTypes - deviceTypes:', this.deviceTypes);
    
    // 加载串口列表
    this.loadSerialPorts();
    
    // 从window.devices加载设备配置（基于Device和Link格式）
    if (window.devices && Array.isArray(window.devices)) {
      this.devices = window.devices.map((device, index) => {
        const deviceData = {
          name: device.name,
          type: device.type,
          x: device.position.x || 100 + (index % 4) * 200,
          y: device.position.y || 100 + Math.floor(index / 4) * 150
        };

        // 根据设备类型获取对应的图标
        const deviceTypeInfo = this.deviceTypes.find(dt => dt.value === device.type);
        if (deviceTypeInfo && deviceTypeInfo.icon) {
          deviceData.icon = deviceTypeInfo.icon;
        }
        
        // 处理access-terminal字段，保留原始字段
        if (device['access-terminal']) {
          deviceData['access-terminal'] = device['access-terminal'];
          const terminalType = device['access-terminal'].type || 'ssh';
          deviceData[terminalType] = device['access-terminal'].options || {};
        }
        
        return deviceData;
      });
      
      // 加载links数据
      this.links = window.links || [];
      console.log('Loaded devices:', this.devices);
      console.log('Loaded links:', this.links);
      
      // 将links转换为connections格式用于UI显示
      this.connections = [];
      
      // 遍历所有links，为每个连接计算连接数量并生成正确的ID
      this.links.forEach((link, index) => {
        // 找到源设备和目标设备的索引
        const fromIndex = this.devices.findIndex(d => d.name === link.source?.device);
        const toIndex = this.devices.findIndex(d => d.name === link.destination?.device);
        
        if (fromIndex >= 0 && toIndex >= 0) {
          // 计算当前设备对的连接数量
          const connectionCount = this.connections.filter(conn => 
            (conn.fromIndex === fromIndex && conn.toIndex === toIndex) ||
            (conn.fromIndex === toIndex && conn.toIndex === fromIndex)
          ).length;
          
          // 创建连接对象，与手动创建的格式一致，添加link索引
          const connection = {
            id: `conn-${Date.now()}-${index}-${connectionCount}`,
            fromIndex: fromIndex,
            toIndex: toIndex,
            linkIndex: index // 存储对应的link索引
          };
          
          this.connections.push(connection);
        }
      });
      console.log('Converted connections:', this.connections);
    } else {
      console.log('window.devices is not available');
      // 添加一个默认设备，以便测试显示
      this.devices.push({
        name: 'Test Device',
        type: 'Host',
        x: 100,
        y: 100
      });
      console.log('Added default device:', this.devices);
    }
    // 监听来自VSCode的消息
    window.addEventListener('message', this.handleMessage);
    // 监听键盘事件
    window.addEventListener('keydown', this.handleKeyDown);
    console.log('NetworkTopologyEditor mounted completed');
  },
  beforeDestroy() {
    window.removeEventListener('message', this.handleMessage);
    window.removeEventListener('keydown', this.handleKeyDown);
  },
  methods: {
    // 加载设备类型信息
    loadDeviceTypes() {
      // 从 window.deviceTypeTree 获取设备类型信息（由插件加载时提供）
      if (window.deviceTypeTree && Array.isArray(window.deviceTypeTree)) {
        console.log('Loaded device types from window.deviceTypeTree:', window.deviceTypeTree);
        // 保留完整的设备类型树信息
        this.fullDeviceTypeTree = window.deviceTypeTree;
        // 只获取第二层级的设备类型（parent为"Device"）用于显示
        this.deviceTypes = window.deviceTypeTree
          .filter(model => model.parent === 'Device')
          .map(model => ({
            label: model.description,
            value: model.name,
            icon: model.icon
          }));
        // 直接使用过滤后的设备类型作为列表
        this.deviceTypeTree = this.deviceTypes;
        console.log('Filtered device types:', this.deviceTypes);
        console.log('Full device type tree:', this.fullDeviceTypeTree);
      } else {
        console.error('window.deviceTypeTree not available');
        // 加载失败时使用默认设备类型
        this.deviceTypes = [
          { label: '主机', value: 'Host', icon: '' },
          { label: '交换机', value: 'Switch', icon: '' },
          { label: '路由器', value: 'Router', icon: '' },
          { label: '测试仪器', value: 'TestInstrument', icon: '' }
        ];
        this.deviceTypeTree = this.deviceTypes;
        this.fullDeviceTypeTree = this.deviceTypes;
      }
    },
    // 构建设备类型树
    buildDeviceTypeTree(models) {
      const modelMap = {};
      const tree = [];
      
      // 首先创建所有节点的映射，确保每个节点都有 name 和 description
      models.forEach(model => {
        if (model && model.name && model.description) {
          modelMap[model.name] = {
            label: model.description, // 将 description 映射为树节点的 label
            value: model.name, // 将 name 映射为树节点的 value
            children: []
          };
        }
      });
      
      // 然后构建树结构，确保只添加有效的节点
      models.forEach(model => {
        if (model && model.name) {
          const parent = model.parent || 'none';
          if (parent === 'none') {
            // 根节点
            if (modelMap[model.name]) {
              tree.push(modelMap[model.name]);
            }
          } else if (modelMap[parent] && modelMap[model.name]) {
            // 子节点
            modelMap[parent].children.push(modelMap[model.name]);
          }
        }
      });
      
      // 确保所有节点都被添加到树中（处理没有parent的节点）
      models.forEach(model => {
        if (model && model.name && modelMap[model.name] && !tree.includes(modelMap[model.name])) {
          // 检查是否已经作为子节点添加
          let isAdded = false;
          for (const node of tree) {
            if (this.isNodeInTree(node, model.name)) {
              isAdded = true;
              break;
            }
          }
          if (!isAdded) {
            tree.push(modelMap[model.name]);
          }
        }
      });
      
      console.log('Built device type tree:', tree);
      return tree;
    },
    // 检查节点是否在树中
    isNodeInTree(node, nodeName) {
      if (node.value === nodeName) {
        return true;
      }
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          if (this.isNodeInTree(child, nodeName)) {
            return true;
          }
        }
      }
      return false;
    },
    getDeviceTypeLabel(type) {
      const deviceType = this.deviceTypes.find(dt => dt.value === type);
      return deviceType ? deviceType.label : type.toUpperCase();
    },
    addDeviceByType(type) {
      // 获取设备类型信息，包括图标
      const deviceTypeInfo = this.deviceTypes.find(dt => dt.value === type);
      const icon = deviceTypeInfo ? deviceTypeInfo.icon : '';
      
      const newDevice = {
        name: `${type.toUpperCase()} Device ${this.devices.length + 1}`,
        type,
        icon: icon,
        x: 100 + (this.devices.length % 4) * 200,
        y: 100 + Math.floor(this.devices.length / 4) * 150
      };
      
      // 根据设备类型设置默认终端类型
      if (type === 'Host') {
        // 主机类型设备默认设置为 DUMMY
        newDevice['access-terminal'] = {
          type: 'dummy',
          options: {
            ip: ''
          }
        };
        newDevice.dummy = {
          ip: ''
        };
      } else if (type === 'TestInstrument') {
        // TestInstrument 类型设备默认设置为 RPC
        newDevice['access-terminal'] = {
          type: 'rpc',
          options: {
            ip: ''
          }
        };
        newDevice.rpc = {
          ip: ''
        };
      } else {
        const telnetOptions = {
          host: '',
          port: 23,
          username: '',
          password: '',
          dimension: {
            autoResize: true,
            rows: 24,
            cols: 80
          }
        };
        newDevice['access-terminal'] = {
          type: 'telnet',
          options: { ...telnetOptions }
        };
        newDevice.telnet = { ...telnetOptions };
      }
      
      this.devices.push(newDevice);
      this.selectedDeviceIndex = this.devices.length - 1;
      // 调用 selectDevice 方法加载设备的终端配置信息
      this.selectDevice(this.selectedDeviceIndex);
    },
    removeDevice(index) {
      //if (confirm('确定要删除这个设备吗？所有与该设备相关的连接也会被删除。')) {
        const deviceName = this.devices[index].name;
        
        // 先删除与该设备相关的所有连接
        const connectionsToRemove = [];
        for (let i = this.connections.length - 1; i >= 0; i--) {
          const connection = this.connections[i];
          if (connection.fromIndex === index || connection.toIndex === index) {
            connectionsToRemove.push(i);
          }
        }
        
        // 按照索引从大到小删除，避免索引错乱
        connectionsToRemove.sort((a, b) => b - a).forEach(i => {
          this.connections.splice(i, 1);
        });
        
        // 同时从links数组中删除相关连接
        this.links = this.links.filter(link => {
          return link.source?.device !== deviceName && link.destination?.device !== deviceName;
        });
        
        // 删除设备
        this.devices.splice(index, 1);
        if (this.selectedDeviceIndex === index) {
          this.selectedDeviceIndex = -1;
        } else if (this.selectedDeviceIndex > index) {
          this.selectedDeviceIndex--;
            }
            
            // 检查并更新选中的连接索引
            if (this.selectedConnectionIndex >= 0) {
                // 如果选中的连接被删除，重置选择
                if (connectionsToRemove.includes(this.selectedConnectionIndex)) {
                    this.selectedConnectionIndex = -1;
                }
                // 如果删除的设备在其他连接的索引之前，更新连接索引
                else {
                    this.connections.forEach((connection, connIndex) => {
                        if (connection.fromIndex > index || connection.toIndex > index) {
                            if (connIndex < this.selectedConnectionIndex) {
                                this.selectedConnectionIndex--;
                            }
                        }
                    });
                }
            }
            
            // 更新其他连接的索引（如果删除的设备在其他连接的索引之前）
            this.connections.forEach(connection => {
                if (connection.fromIndex > index) {
                    connection.fromIndex--;
                }
                if (connection.toIndex > index) {
                    connection.toIndex--;
                }
            });
        
        console.log('removeDevice - deviceName:', deviceName);

        // 发送消息给VS Code，通知删除了设备
        window.vscode.postMessage({
          command: 'removeDevice',
          deviceName: deviceName
        });
        
        // 保存配置
        //this.saveConfig();
      //}
    },
    editDevice(index) {
      this.selectedDeviceIndex = index;
    },
    selectDevice(index) {
      this.selectedDeviceIndex = index;
      this.selectedConnectionIndex = -1; // 取消连接选择
      this.selectedConnection = null; // 清空连接选择
      const device = this.devices[index];
      
      // 保存设备的旧名称，用于后续更新连接信息
      this.selectedDeviceOldName = device.name;
      
      console.log('selectDevice - device:', device);
      
      // 加载设备的终端配置
      let terminalType = 'ssh';
      let terminalOptions = {};

      // 优先处理access-terminal格式（新格式）
      if (device['access-terminal']) {
        terminalType = device['access-terminal'].type || 'ssh';
        terminalOptions = device['access-terminal'].options || {};
        console.log('selectDevice - access-terminal:', device['access-terminal']);
      }
      // 处理旧格式
      else if (device.ssh) {
        terminalType = 'ssh';
        terminalOptions = device.ssh;
      } else if (device.telnet) {
        terminalType = 'telnet';
        terminalOptions = device.telnet;
      } else if (device.serial) {
        terminalType = 'serial';
        terminalOptions = device.serial;
      } else if (device.dummy) {
        terminalType = 'dummy';
        terminalOptions = device.dummy;
      } else if (device.rpc) {
        terminalType = 'rpc';
        terminalOptions = device.rpc;
      }
      
      console.log('selectDevice - terminalType:', terminalType);
      console.log('selectDevice - terminalOptions:', terminalOptions);
      
      this.selectedDeviceTerminalType = terminalType;
      
      // 根据终端类型加载配置
      if (terminalType === 'ssh') {
        this.sshConfig = {
          host: terminalOptions.host || device.host || '',
          port: terminalOptions.port || 22,
          username: terminalOptions.username || '',
          type: terminalOptions.type || 'password',
          password: terminalOptions.password || '',
          privateKeyPath: terminalOptions.privateKeyPath || '',
          passphrase: terminalOptions.passphrase || '',
          enableSftp: terminalOptions.enableSftp !== false, // 默认启用
          dimension: {
            autoResize: terminalOptions.dimension?.autoResize !== false, // 默认启用自适应
            rows: terminalOptions.dimension?.rows || 24,
            cols: terminalOptions.dimension?.cols || 80
          }
        };
        console.log('selectDevice - sshConfig:', this.sshConfig);
      } else if (terminalType === 'telnet') {
        this.telnetConfig = {
          host: terminalOptions.host || device.host || '',
          port: terminalOptions.port || 23,
          username: terminalOptions.username || '',
          password: terminalOptions.password || '',
          dimension: {
            autoResize: terminalOptions.dimension?.autoResize !== false, // 默认启用自适应
            rows: terminalOptions.dimension?.rows || 24,
            cols: terminalOptions.dimension?.cols || 80
          }
        };
        console.log('selectDevice - telnetConfig:', this.telnetConfig);
      } else if (terminalType === 'serial') {
        this.serialConfig = {
          path: terminalOptions.path || '',
          baudrate: terminalOptions.baudrate || 9600,
          dataBits: terminalOptions.dataBits || '8',
          parity: terminalOptions.parity || 'None',
          stopBits: terminalOptions.stopBits || '1',
          dimension: {
            autoResize: terminalOptions.dimension?.autoResize !== false, // 默认启用自适应
            rows: terminalOptions.dimension?.rows || 24,
            cols: terminalOptions.dimension?.cols || 80
          }
        };
        console.log('selectDevice - serialConfig:', this.serialConfig);
      } else if (terminalType === 'dummy') {
        this.dummyConfig = {
          ip: terminalOptions.ip || device.host || ''
        };
        console.log('selectDevice - dummyConfig:', this.dummyConfig);
      } else if (terminalType === 'rpc') {
        this.rpcConfig = {
          ip: terminalOptions.ip || device.host || ''
        };
        console.log('selectDevice - rpcConfig:', this.rpcConfig);
      }
      

    },
    selectConnection(index) {
      console.log('selectConnection - Connection:', index);
      this.selectedConnectionIndex = index;
      this.selectedDeviceIndex = -1; // 取消设备选择
      
      // 获取连接对应的link数据
      const connection = this.connections[index];
      if (connection) {
        // 使用linkIndex直接访问对应的link
        let link = null;
        if (connection.linkIndex !== undefined && connection.linkIndex >= 0 && connection.linkIndex < this.links.length) {
          link = this.links[connection.linkIndex];
        }
        
        // 如果没有找到，尝试通过设备名称匹配
        if (!link) {
          // 首先尝试找到完全匹配的连接（源到目标）
          link = this.links.find(link => {
            return link.source?.device === this.devices[connection.fromIndex].name && 
                   link.destination?.device === this.devices[connection.toIndex].name;
          });
          
          // 如果没有找到，尝试反方向匹配
          if (!link) {
            link = this.links.find(link => {
              return link.source?.device === this.devices[connection.toIndex].name && 
                     link.destination?.device === this.devices[connection.fromIndex].name;
            });
          }
        }
        
        // 如果找到了匹配的link，使用它；否则创建一个新的
        this.selectedConnection = link || {
          source: {
            device: this.devices[connection.fromIndex].name,
            port: 'GigbitEthernet0/0/1',
            ipv4: '10.1.1.1/24',
            ipv6: '2001::1/64'
          },
          destination: {
            device: this.devices[connection.toIndex].name,
            port: 'GigbitEthernet0/0/1',
            ipv4: '10.1.1.2/24',
            ipv6: '2001::2/64'
          }
        };
      }
    },
    showConnectionTooltip(index) {
      const connection = this.connections[index];
      if (!connection) return;
      
      this.hoveredConnectionIndex = index;
      
      // 找到对应的link
      let link = null;
      // 使用linkIndex直接访问对应的link
      if (connection.linkIndex !== undefined && connection.linkIndex >= 0 && connection.linkIndex < this.links.length) {
        link = this.links[connection.linkIndex];
      }
      
      // 如果没有找到，尝试通过设备名称匹配
      if (!link) {
        link = this.links.find(link => {
          return link.source?.device === this.devices[connection.fromIndex].name && 
                 link.destination?.device === this.devices[connection.toIndex].name;
        });
      }
      
      if (link) {
        const sourceDevice = link.source?.device || this.devices[connection.fromIndex].name;
        const sourcePort = link.source?.port || 'GigbitEthernet0/0/1';
        const destDevice = link.destination?.device || this.devices[connection.toIndex].name;
        const destPort = link.destination?.port || 'GigbitEthernet0/0/1';
        
        this.hoveredConnectionTooltip = `${sourceDevice}:${sourcePort} <-> ${destDevice}:${destPort}`;
        // 估算提示框宽度
        this.tooltipWidth = this.hoveredConnectionTooltip.length * 8;
      } else {
        const sourceDevice = this.devices[connection.fromIndex].name;
        const destDevice = this.devices[connection.toIndex].name;
        
        this.hoveredConnectionTooltip = `${sourceDevice}:GigbitEthernet0/0/1 <-> ${destDevice}:GigbitEthernet0/0/1`;
        this.tooltipWidth = this.hoveredConnectionTooltip.length * 8;
      }
    },
    hideConnectionTooltip() {
      this.hoveredConnectionIndex = -1;
      this.hoveredConnectionTooltip = '';
    },
    updateTooltipPosition(event, index) {
      // 获取鼠标在SVG坐标系中的位置
      const svg = event.currentTarget.closest('svg');
      if (svg) {
        const rect = svg.getBoundingClientRect();
        this.tooltipPosition = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        };
      }
    },
    updateConnection() {
      if (this.selectedConnectionIndex >= 0 && this.selectedConnection) {
        const connection = this.connections[this.selectedConnectionIndex];
        if (connection) {
          // 使用linkIndex直接更新对应的link
          let linkIndex = -1;
          if (connection.linkIndex !== undefined && connection.linkIndex >= 0 && connection.linkIndex < this.links.length) {
            linkIndex = connection.linkIndex;
          } else {
            // 如果没有linkIndex，尝试通过设备名称匹配
            // 首先尝试找到完全匹配的连接（源到目标）
            linkIndex = this.links.findIndex(link => {
              return link.source?.device === this.devices[connection.fromIndex].name && 
                     link.destination?.device === this.devices[connection.toIndex].name;
            });
            
            // 如果没有找到，尝试反方向匹配
            if (linkIndex === -1) {
              linkIndex = this.links.findIndex(link => {
                return link.source?.device === this.devices[connection.toIndex].name && 
                       link.destination?.device === this.devices[connection.fromIndex].name;
              });
            }
          }
          
          // 如果找到了匹配的link，更新它
          if (linkIndex >= 0) {
            this.links[linkIndex] = this.selectedConnection;
          } else {
            // 如果没有找到，创建新link
            const newLinkIndex = this.links.length;
            this.links.push(this.selectedConnection);
            // 更新connection的linkIndex
            connection.linkIndex = newLinkIndex;
          }
          
          // 发送消息给VS Code，通知添加了连接
          window.vscode.postMessage({ command: 'addConnection' });
        }
      }
    },
    updateDevice() {
      // 设备基本属性更新
      // 发送消息给VS Code，触发文档变更事件，标记为dirty
      window.vscode.postMessage({ command: 'updateDevice' });
    },
    updateDeviceName() {
      // 设备名称更新
      if (this.selectedDeviceIndex >= 0) {
        const device = this.devices[this.selectedDeviceIndex];
        
        // 检查设备名称是否重复
        const isNameDuplicate = this.devices.some((d, index) => {
          return d.name === device.name && index !== this.selectedDeviceIndex;
        });
        
        if (isNameDuplicate) {
          // 显示错误提示
          alert('设备名称已存在，请使用其他名称');
          // 恢复旧名称
          device.name = this.selectedDeviceOldName;
          return;
        }
        
        // 遍历所有连接，更新与当前设备相关的连接信息中的设备名称
        this.links.forEach(link => {
          // 检查连接的源设备或目标设备是否与旧设备名称匹配
          if (link.source?.device === this.selectedDeviceOldName) {
            link.source.device = device.name;
          }
          if (link.destination?.device === this.selectedDeviceOldName) {
            link.destination.device = device.name;
          }
        });
        
        // 更新selectedDeviceOldName为新名称，以便后续修改
        this.selectedDeviceOldName = device.name;
      }
      // 发送消息给VS Code，触发文档变更事件，标记为dirty
      window.vscode.postMessage({ command: 'updateDevice' });
    },
    updateDeviceType() {
      if (this.selectedDeviceIndex >= 0) {
        const device = this.devices[this.selectedDeviceIndex];
        const deviceTypeInfo = this.deviceTypes.find(dt => dt.value === device.type);
        if (deviceTypeInfo) {
          device.icon = deviceTypeInfo.icon;
        }
        // 发送消息给VS Code，触发文档变更事件，标记为dirty
        window.vscode.postMessage({ command: 'updateDevice' });
      }
    },
    updateTerminalType() {
      if (this.selectedDeviceIndex >= 0) {
        const device = this.devices[this.selectedDeviceIndex];
        
        // 清除之前的终端配置
        delete device.ssh;
        delete device.telnet;
        delete device.serial;
        delete device.dummy;
        delete device.rpc;
        
        // 根据新的终端类型设置默认配置
        if (this.selectedDeviceTerminalType === 'ssh') {
          this.sshConfig = {
            host: device.host || '',
            port: 22,
            username: '',
            type: 'password',
            password: '',
            privateKeyPath: '',
            passphrase: '',
            enableSftp: true,
            dimension: {
              autoResize: true,
              rows: 24,
              cols: 80
            }
          };
          device.ssh = { ...this.sshConfig };
          device['access-terminal'] = {
            type: 'ssh',
            options: { ...this.sshConfig }
          };
        } else if (this.selectedDeviceTerminalType === 'telnet') {
          this.telnetConfig = {
            host: device.host || '',
            port: 23,
            username: '',
            password: '',
            dimension: {
              autoResize: true,
              rows: 24,
              cols: 80
            }
          };
          device.telnet = { ...this.telnetConfig };
          device['access-terminal'] = {
            type: 'telnet',
            options: { ...this.telnetConfig }
          };
        } else if (this.selectedDeviceTerminalType === 'serial') {
          // 加载串口列表
          this.loadSerialPorts();
          
          this.serialConfig = {
            path: '',
            baudrate: 9600,
            dataBits: '8',
            parity: 'None',
            stopBits: '1',
            dimension: {
              autoResize: true,
              rows: 24,
              cols: 80
            }
          };
          device.serial = { ...this.serialConfig };
          device['access-terminal'] = {
            type: 'serial',
            options: { ...this.serialConfig }
          };
        } else if (this.selectedDeviceTerminalType === 'dummy') {
          this.dummyConfig = {
            ip: device.host || ''
          };
          device.dummy = { ...this.dummyConfig };
          device['access-terminal'] = {
            type: 'dummy',
            options: { ...this.dummyConfig }
          };
        } else if (this.selectedDeviceTerminalType === 'rpc') {
          this.rpcConfig = {
            ip: device.host || ''
          };
          device.rpc = { ...this.rpcConfig };
          device['access-terminal'] = {
            type: 'rpc',
            options: { ...this.rpcConfig }
          };
        }
        // 强制Vue重新渲染视图，确保终端类型切换后UI正确更新
        this.$forceUpdate();
        // 发送消息给VS Code，触发文档变更事件，标记为dirty
        window.vscode.postMessage({ command: 'updateDevice' });
      }
    },
    // 加载串口列表
    loadSerialPorts() {
      // 发送消息给VS Code，请求串口列表
      window.vscode.postMessage({ command: 'listSerialPorts' });
    },
    updateTerminalConfig() {
      if (this.selectedDeviceIndex >= 0) {
        const device = this.devices[this.selectedDeviceIndex];
        
        // 清除之前的终端配置
        delete device.ssh;
        delete device.telnet;
        delete device.serial;
        delete device.dummy;
        delete device.rpc;
        
        // 根据当前终端类型保存配置
        if (this.selectedDeviceTerminalType === 'ssh') {
          device.ssh = { ...this.sshConfig };
          // 同时更新access-terminal字段
          device['access-terminal'] = {
            type: 'ssh',
            options: { ...this.sshConfig }
          };
        } else if (this.selectedDeviceTerminalType === 'telnet') {
          device.telnet = { ...this.telnetConfig };
          // 同时更新access-terminal字段
          device['access-terminal'] = {
            type: 'telnet',
            options: { ...this.telnetConfig }
          };
        } else if (this.selectedDeviceTerminalType === 'serial') {
          device.serial = { ...this.serialConfig };
          // 同时更新access-terminal字段
          device['access-terminal'] = {
            type: 'serial',
            options: { ...this.serialConfig }
          };
        } else if (this.selectedDeviceTerminalType === 'dummy') {
          device.dummy = { ...this.dummyConfig };
          // 同时更新access-terminal字段
          device['access-terminal'] = {
            type: 'dummy',
            options: { ...this.dummyConfig }
          };
        } else if (this.selectedDeviceTerminalType === 'rpc') {
          device.rpc = { ...this.rpcConfig };
          // 同时更新access-terminal字段
          device['access-terminal'] = {
            type: 'rpc',
            options: { ...this.rpcConfig }
          };
        }
        // 发送消息给VS Code，触发文档变更事件，标记为dirty
        window.vscode.postMessage({ command: 'updateDevice' });
      }
    },
    startDrag(event) {
      this.isDragging = true;
      this.dragStart = { x: event.clientX, y: event.clientY };
    },
    drag(event) {
      if (this.isDragging) {
        const deltaX = event.clientX - this.dragStart.x;
        const deltaY = event.clientY - this.dragStart.y;
        this.dragStart = { x: event.clientX, y: event.clientY };
        
        if (this.dragDeviceIndex >= 0) {
          // 只移动指定的设备
          this.devices[this.dragDeviceIndex].x += deltaX;
          this.devices[this.dragDeviceIndex].y += deltaY;
        } else {
          // 移动所有设备
          this.devices.forEach(device => {
            device.x += deltaX;
            device.y += deltaY;
          });
        }
      }
    },
    stopDrag() {
      this.isDragging = false;
      this.dragDeviceIndex = -1;
    },
    onDragOver(event) {
      event.preventDefault();
    },
    onDrop(event) {
      event.preventDefault();
      const deviceType = event.dataTransfer.getData('text/plain');
      if (deviceType) {
        // 获取鼠标在canvas中的位置
        const canvasRect = this.$refs.canvas.getBoundingClientRect();
        const x = event.clientX - canvasRect.left;
        const y = event.clientY - canvasRect.top;
        
        // 调用 addDeviceByType 方法添加设备
        this.addDeviceByType(deviceType);
        
        // 调整设备位置到鼠标放置的位置
        const newDeviceIndex = this.devices.length - 1;
        this.devices[newDeviceIndex].x = x - 50; // 居中放置
        this.devices[newDeviceIndex].y = y - 30;
        
        // 发送消息给VS Code，通知添加了设备
        window.vscode.postMessage({ command: 'addDevice' });
        //this.saveConfig();
      }
    },
    onDragStart(event, deviceType) {
      event.dataTransfer.setData('text/plain', deviceType);
    },
    startDragDevice(event, index) {
      // 阻止默认的拖拽行为
      event.preventDefault();
      // 只有左键点击才进行拖动
      if (event.button === 0) {
        this.isDragging = true;
        this.dragDeviceIndex = index;
        this.dragStart = { x: event.clientX, y: event.clientY };
      }
    },
    startConnectDevice(event, index) {
      // 右键点击开始连接
      event.preventDefault();
      this.isConnecting = true;
      this.connectStartIndex = index;
      this.dragStart = { x: event.clientX, y: event.clientY };
    },
    drag(event) {
      if (this.isDragging) {
        const deltaX = event.clientX - this.dragStart.x;
        const deltaY = event.clientY - this.dragStart.y;
        this.dragStart = { x: event.clientX, y: event.clientY };
        
        if (this.dragDeviceIndex >= 0) {
          // 只移动指定的设备
          this.devices[this.dragDeviceIndex].x += deltaX;
          this.devices[this.dragDeviceIndex].y += deltaY;
        } else {
          // 移动所有设备
          this.devices.forEach(device => {
            device.x += deltaX;
            device.y += deltaY;
          });
        }
      }
    },
    stopDrag() {
      this.isDragging = false;
      this.dragDeviceIndex = -1;
    },
    stopConnectDevice(event) {
      if (this.isConnecting) {
        // 结束连接过程
        this.isConnecting = false;
        
        // 检查是否点击到了另一个设备
        const canvasRect = this.$refs.canvas.getBoundingClientRect();
        const x = event.clientX - canvasRect.left;
        const y = event.clientY - canvasRect.top;
        
        // 查找点击位置的设备
        let targetDeviceIndex = -1;
        this.devices.forEach((device, index) => {
          if (index !== this.connectStartIndex && 
              x >= device.x && x <= device.x + 120 && 
              y >= device.y && y <= device.y + 80) {
            targetDeviceIndex = index;
          }
        });
        
        // 如果找到了目标设备，建立连接
        if (targetDeviceIndex >= 0) {
          // 检查是否已经存在相同的连接
          /*const existingConnection = this.connections.find(conn => 
            (conn.fromIndex === this.connectStartIndex && conn.toIndex === targetDeviceIndex) ||
            (conn.fromIndex === targetDeviceIndex && conn.toIndex === this.connectStartIndex)
          );
          */
          //if (!existingConnection) {
            // 计算当前设备对的连接数量
            const connectionCount = this.connections.filter(conn => 
              (conn.fromIndex === this.connectStartIndex && conn.toIndex === targetDeviceIndex) ||
              (conn.fromIndex === targetDeviceIndex && conn.toIndex === this.connectStartIndex)
            ).length;
            
            // 同时更新links数组（新格式）
            const newLink = {
              source: {
                device: this.devices[this.connectStartIndex].name,
                port: 'GigbitEthernet0/0/1',
                ipv4: '10.1.1.1/24',
                ipv6: '2001::1/64'
              },
              destination: {
                device: this.devices[targetDeviceIndex].name,
                port: 'GigbitEthernet0/0/1',
                ipv4: '10.1.1.2/24',
                ipv6: '2001::2/64'
              }
            };
            this.links.push(newLink);
            
            // 创建新连接，添加link索引
            const newConnection = {
              id: `conn-${Date.now()}-${connectionCount}`,
              fromIndex: this.connectStartIndex,
              toIndex: targetDeviceIndex,
              linkIndex: this.links.length - 1 // 存储对应的link索引
            };
            this.connections.push(newConnection);
            
            // 发送消息给VS Code，通知添加了连接
            window.vscode.postMessage({ command: 'addConnection' });
          //}
        }
        
        this.connectStartIndex = -1;
        this.connectEndIndex = -1;
      }
    },
    handleMouseUp(event) {
      // 处理鼠标松开事件
      this.stopDrag();
      this.stopConnectDevice(event);
    },
    handleMouseLeave(event) {
      // 处理鼠标离开事件
      this.stopDrag();
      this.stopConnectDevice(event);
    },
    // 打开设备终端
    openDeviceTerminal(index) {
      if (index >= 0 && index < this.devices.length) {
        const device = this.devices[index];
        // 发送消息给VS Code，打开设备终端
        window.vscode.postMessage({ 
          command: 'openTerminal', 
          device: device 
        });
      }
    },
    // 处理Run Code命令
    /*runCode() {
      // 发送消息给VS Code，打开所有telnet/ssh/serial类型的终端窗口
      window.vscode.postMessage({ 
        command: 'runCode', 
        devices: this.devices 
      });
    },*/
    // 处理键盘事件
    handleKeyDown(event) {
      // 检查当前焦点是否在输入框内
      const activeElement = document.activeElement;
      const isInputElement = activeElement instanceof HTMLInputElement || 
                            activeElement instanceof HTMLTextAreaElement || 
                            activeElement instanceof HTMLSelectElement;
      
      // 如果焦点在输入框内，不执行删除操作
      if (isInputElement) {
        return;
      }
      
      // 按下 DEL 键删除选中的设备或连接
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (this.selectedDeviceIndex >= 0) {
          // 删除选中的设备
          this.removeDevice(this.selectedDeviceIndex);
        } else if (this.selectedConnectionIndex >= 0) {
          // 删除选中的连接
          this.removeConnection(this.selectedConnectionIndex);
        }
      }
    },
    // 删除连接
    removeConnection(index) {
      if (index >= 0 && index < this.connections.length) {
        const connection = this.connections[index];
        
        // 从links数组中删除对应的连接
        if (connection.linkIndex !== undefined && connection.linkIndex >= 0 && connection.linkIndex < this.links.length) {
          this.links.splice(connection.linkIndex, 1);
        }
        
        // 从connections数组中删除连接
        this.connections.splice(index, 1);
        
        // 重置选中的连接索引
        if (this.selectedConnectionIndex === index) {
          this.selectedConnectionIndex = -1;
          this.selectedConnection = null;
        } else if (this.selectedConnectionIndex > index) {
          this.selectedConnectionIndex--;
        }
        
        // 发送消息给VS Code，通知删除了连接
        window.vscode.postMessage({ command: 'removeConnection' });
      }
    },
    /*saveConfig() {
      // 转换设备配置为新的.tbdx格式
      const devices = this.devices.map(({ x, y, name, type, ssh, telnet, serial, ...other }) => {
        const accessTerminal = {
          type: type || 'ssh',
          options: {}
        };
        
        // 处理不同类型的终端配置
        if (ssh) {
          accessTerminal.type = 'ssh';
          accessTerminal.options = ssh;
        } else if (telnet) {
          accessTerminal.type = 'telnet';
          accessTerminal.options = telnet;
        } else if (serial) {
          accessTerminal.type = 'serial';
          accessTerminal.options = serial;
        }
        
        return {
          name,
          type,
          'access-terminal': accessTerminal
        };
      });
      
      // 准备保存的数据
      const saveData = {
        devices: devices,
        links: this.links
      };
      
      window.vscode.postMessage({
        command: 'saveConfig',
        ...saveData
      });
    },*/
    handleMessage(event) {
      const message = event.data;
      switch (message.command) {
        case 'init':
          // 初始化设备配置，基于Device和Link格式
          if (message.devices && Array.isArray(message.devices)) {
            this.devices = message.devices.map((device, index) => {
              const deviceData = {
                name: device.name,
                type: device.type,
                x: device.position?.x || 100 + (index % 4) * 200,
                y: device.position?.y || 100 + Math.floor(index / 4) * 150
              };
              
              // 根据设备类型获取对应的图标
              const deviceTypeInfo = this.deviceTypes.find(dt => dt.value === device.type);
              if (deviceTypeInfo && deviceTypeInfo.icon) {
                deviceData.icon = deviceTypeInfo.icon;
              }
              
              // 处理access-terminal字段，保留原始字段
              if (device['access-terminal']) {
                deviceData['access-terminal'] = device['access-terminal'];
                const terminalType = device['access-terminal'].type || 'ssh';
                deviceData[terminalType] = device['access-terminal'].options || {};
              }
              
              return deviceData;
            });
            
            // 加载links数据
            this.links = message.links || [];
            
            // 将links转换为connections格式用于UI显示
            this.connections = [];
            
            // 遍历所有links，为每个连接计算连接数量并生成正确的ID
            this.links.forEach((link, index) => {
              // 找到源设备和目标设备的索引
              const fromIndex = this.devices.findIndex(d => d.name === link.source?.device);
              const toIndex = this.devices.findIndex(d => d.name === link.destination?.device);
              
              if (fromIndex >= 0 && toIndex >= 0) {
                // 计算当前设备对的连接数量
                const connectionCount = this.connections.filter(conn => 
                  (conn.fromIndex === fromIndex && conn.toIndex === toIndex) ||
                  (conn.fromIndex === toIndex && conn.toIndex === fromIndex)
                ).length;
                
                // 创建连接对象，与手动创建的格式一致，添加link索引
                const connection = {
                  id: `conn-${Date.now()}-${index}-${connectionCount}`,
                  fromIndex: fromIndex,
                  toIndex: toIndex,
                  linkIndex: index // 存储对应的link索引
                };
                
                this.connections.push(connection);
              }
            });
          }
          break;
        case 'updateConfig':
          // 更新设备配置，基于Device和Link格式
          if (message.devices && Array.isArray(message.devices)) {
            this.devices = message.devices.map((device, index) => {
              const deviceData = {
                name: device.name,
                type: device.type,
                x: device.position?.x || 100 + (index % 4) * 200,
                y: device.position?.y || 100 + Math.floor(index / 4) * 150
              };
              
              // 根据设备类型获取对应的图标
              const deviceTypeInfo = this.deviceTypes.find(dt => dt.value === device.type);
              if (deviceTypeInfo && deviceTypeInfo.icon) {
                deviceData.icon = deviceTypeInfo.icon;
              }
              
              // 处理access-terminal字段，保留原始字段
              if (device['access-terminal']) {
                deviceData['access-terminal'] = device['access-terminal'];
                const terminalType = device['access-terminal'].type || 'ssh';
                deviceData[terminalType] = device['access-terminal'].options || {};
              }
              
              return deviceData;
            });
            
            // 加载links数据
            this.links = message.links || [];
            
            // 将links转换为connections格式用于UI显示
            this.connections = [];
            
            // 遍历所有links，为每个连接计算连接数量并生成正确的ID
            this.links.forEach((link, index) => {
              // 找到源设备和目标设备的索引
              const fromIndex = this.devices.findIndex(d => d.name === link.source?.device);
              const toIndex = this.devices.findIndex(d => d.name === link.destination?.device);
              
              if (fromIndex >= 0 && toIndex >= 0) {
                // 计算当前设备对的连接数量
                const connectionCount = this.connections.filter(conn => 
                  (conn.fromIndex === fromIndex && conn.toIndex === toIndex) ||
                  (conn.fromIndex === toIndex && conn.toIndex === fromIndex)
                ).length;
                
                // 创建连接对象，与手动创建的格式一致，添加link索引
                const connection = {
                  id: `conn-${Date.now()}-${index}-${connectionCount}`,
                  fromIndex: fromIndex,
                  toIndex: toIndex,
                  linkIndex: index // 存储对应的link索引
                };
                
                this.connections.push(connection);
              }
            });
          }
          break;
        case 'saveSuccess':
          // 保存成功提示
          alert('配置保存成功！');
          break;
        case 'getCurrentData':
          // 返回当前设备和连接信息
          window.vscode.postMessage({
            command: 'currentData',
            devices: this.devices,
            links: this.links
          });
          break;
        case 'serialPorts':
          // 处理串口列表数据
          if (message.ports && Array.isArray(message.ports)) {
            this.serialPorts = message.ports;
            console.log('Loaded serial ports:', this.serialPorts);
          }
          break;
        //case 'runCode':
          // 处理来自VS Code的Run Code命令
          //this.runCode();
          //break;
      }
    }
  }
};
</script>

<style scoped>
.network-topology-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-editor-background);
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
}

.editor-header {
  padding: 10px 20px;
  background-color: var(--vscode-panel-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-buttons {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--vscode-button-border);
  border-radius: 4px;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  cursor: pointer;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
}

.btn:hover {
  background-color: var(--vscode-button-hoverBackground);
}

.btn-primary {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border-color: var(--vscode-button-border);
}

.btn-primary:hover {
  background-color: var(--vscode-button-hoverBackground);
}

.editor-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

/* 确保html和body元素有正确的高度 */
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}

/* 确保#app元素有正确的高度 */
#app {
  height: 100%;
  width: 100%;
}

.palette {
  padding: 10px;
  background-color: var(--vscode-sidebar-background);
  border-bottom: 1px solid var(--vscode-sidebar-border);
  overflow-y: auto;
  margin-bottom: 15px;
}

.properties-panel {
  width: 210px;
  padding: 10px;
  background-color: var(--vscode-sidebar-background);
  border-left: 1px solid var(--vscode-sidebar-border);
  overflow-y: auto;
  color: var(--vscode-foreground);
}

.property-form {
  margin-top: 10px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: bold;
  color: var(--vscode-foreground);
}

.form-control {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  font-size: 12px;
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-family: var(--vscode-font-family);
  box-sizing: border-box;
}

select.form-control {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  font-size: 12px;
  background-color: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  font-family: var(--vscode-font-family);
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
}

.form-control:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
}

.terminal-config {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--vscode-panel-border);
}

.terminal-config h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: var(--vscode-foreground);
}

.no-selection {
  padding: 20px;
  text-align: center;
  color: var(--vscode-foreground);
  opacity: 0.6;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: auto;
  background-color: var(--vscode-editor-background);
}

.device-types {
  margin-top: 10px;
}

.divider {
  height: 1px;
  background-color: var(--vscode-panel-border);
  margin: 15px 0;
}

.device-type-node {
  margin-bottom: 4px;
}

.device-type-item {
  padding: 6px 10px;
  margin: 2px 0;
  background-color: var(--vscode-list-background);
  border: 1px solid var(--vscode-list-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}

.device-type-icon {
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.device-type-icon.placeholder {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  font-size: 12px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.device-type-item:hover {
  background-color: var(--vscode-list-hoverBackground);
  border-color: var(--vscode-focusBorder);
}

.device-type-children {
  margin-left: 20px;
  padding-left: 10px;
  border-left: 1px solid var(--vscode-list-border);
  overflow: visible;
  display: block !important;
}

.device-type-node {
  overflow: visible;
  display: block !important;
}

.canvas {
  position: relative;
  width: 2000px;
  height: 1500px;
  background-color: var(--vscode-editor-background);
  background-image: 
    linear-gradient(var(--vscode-editorLineNumber-foreground) 1px, transparent 1px),
    linear-gradient(90deg, var(--vscode-editorLineNumber-foreground) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0.2;
}

.connections {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
}

.connections line {
  stroke: var(--vscode-foreground);
  opacity: 0.5;
}

.device {
  position: absolute;
  width: 120px;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  background-color: var(--vscode-panel-background);
  cursor: move;
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  color: var(--vscode-foreground);
  text-align: center;
  transition: all 0.2s ease;
}

.device.selected {
  border: 2px solid var(--vscode-focusBorder);
  box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.4);
  background-color: var(--vscode-focusBorder);
  z-index: 10;
}

.device.selected .device-name {
  color: white;
  font-weight: bold;
}

.device.Host {
  border-left: 4px solid #4CAF50;
}

.device.Switch {
  border-left: 4px solid #2196F3;
}

.device.Router {
  border-left: 4px solid #FF9800;
}

.device.TestInstrument {
  border-left: 4px solid #00BCD4;
}

.device.H3CSwitch {
  border-left: 4px solid #2196F3;
}

.device.H3CRouter {
  border-left: 4px solid #FF9800;
}

.device.TestCenter {
  border-left: 4px solid #00BCD4;
}

.device.Xinertel {
  border-left: 4px solid #00BCD4;
}

.device.Peak9000 {
  border-left: 4px solid #00BCD4;
}

.device-header {
  padding: 8px;
  background-color: var(--vscode-panel-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.device-name-container {
  display: flex;
  align-items: center;
  flex: 1;
  position: relative;
}

.device-icon-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.device-icon {
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.device-icon img {
  filter: invert(1) brightness(2);
  transition: filter 0.2s ease;
}

.device.selected .device-icon img {
  filter: invert(1) brightness(1);
}

.device-icon.placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.device-name {
  font-weight: bold;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
  color: var(--vscode-editor-selectionForeground);
}

.device-actions {
  position: absolute;
  top: -5px;
  right: -5px;
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 2px 4px;
  font-size: 10px;
  border: 1px solid var(--vscode-button-border);
  border-radius: 50%;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  cursor: pointer;
  font-family: var(--vscode-font-family);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
}

.action-btn:hover {
  background-color: var(--vscode-button-hoverBackground);
}

.delete-btn {
  font-size: 14px;
  line-height: 1;
  color: #ff4444;
  border-color: #ff4444;
}

.delete-btn:hover {
  background-color: #ff4444;
  color: white;
}

.device-info {
  padding: 8px;
  font-size: 10px;
  color: var(--vscode-foreground);
  opacity: 0.8;
}

.info-item {
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>