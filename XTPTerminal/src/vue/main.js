import Vue from 'vue';
import App from './App';
import ElementUI from 'element-ui';
import locale from 'element-ui/lib/locale/lang/en';
import VueRouter from 'vue-router';
import UmyTable from 'umy-table';

import 'umy-table/lib/theme-chalk/index.css';
import '../../public/theme/auto.css';
import '../../public/theme/umyui.css';
import "./style/vscode.css";
import VueI18n from 'vue-i18n';
import enLocale from './locales/en';
import zhLocale from './locales/zh';

Vue.use(VueRouter);
Vue.use(ElementUI, { locale });
Vue.use(UmyTable);
Vue.use(VueI18n);

Vue.config.productionTip = false;

import NetworkTopologyEditor from './network/index.vue';

const router = new VueRouter({
  routes: [
    { path: '/networkTopology', component: NetworkTopologyEditor, name: 'networkTopology' }
  ]
});

const i18n = new VueI18n({
  // 设置默认语言
  locale: localStorage.getItem('language') || 'en', 
  //  fallbackLocale：当翻译缺失时使用的语言
  fallbackLocale: 'en',
  // 语言包对象
  messages: {
    en: enLocale,
    zh: zhLocale
  }
})

// 检查是否在网络拓扑编辑器页面
console.log('Window flags:', {
  isNetworkTopologyEditor: window.isNetworkTopologyEditor,
  isCustomEditor: window.isCustomEditor,
  location: window.location.href
});

// 简化判断逻辑，直接检查window.isNetworkTopologyEditor或window.isCustomEditor
const isNetworkEditor = window.isNetworkTopologyEditor || window.isCustomEditor;
console.log('Is network editor:', isNetworkEditor);

// 检查 #app 元素是否存在
const appElement = document.getElementById('app');
console.log('App element:', appElement);

if (isNetworkEditor && appElement) {
  console.log('Rendering NetworkTopologyEditor');
  
  try {
    // 使用render函数创建Vue实例
    new Vue({
      el: '#app',
      i18n,
      render: h => h(NetworkTopologyEditor)
    });
    console.log('NetworkTopologyEditor Vue instance created successfully');
  } catch (error) {
    console.error('Error creating NetworkTopologyEditor:', error);
    appElement.innerHTML = '<div style="color: red;">Error loading network topology editor: ' + error.message + '</div>';
  }
} else if (appElement) {
  console.log('Rendering App');
  try {
    new Vue({
      el: '#app',
      i18n,
      router,
      render: h => h(App)
    });
    console.log('App Vue instance created successfully');
  } catch (error) {
    console.error('Error creating App:', error);
    appElement.innerHTML = '<div style="color: red;">Error loading app: ' + error.message + '</div>';
  }
} else {
  console.error('App element not found!');
  // 创建一个错误提示
  const errorElement = document.createElement('div');
  errorElement.style.position = 'fixed';
  errorElement.style.top = '50%';
  errorElement.style.left = '50%';
  errorElement.style.transform = 'translate(-50%, -50%)';
  errorElement.style.color = 'red';
  errorElement.textContent = 'Error: App element not found!';
  document.body.appendChild(errorElement);
}
