import Vue from 'vue';
import App from './App';
import ElementUI from 'element-ui';
import locale from 'element-ui/lib/locale/lang/en';
import VueRouter from 'vue-router';
import UmyTable from 'umy-table';

import 'umy-table/lib/theme-chalk/index.css';
import '../../public/theme/auto.css';
import '../../public/theme/umyui.css';
//import "tailwindcss/tailwind.css";
import "./style/vscode.css";
import VueI18n from 'vue-i18n';
import enLocale from './locales/en';
import zhLocale from './locales/zh';

Vue.use(VueRouter);
Vue.use(ElementUI, { locale });
Vue.use(UmyTable);
Vue.use(VueI18n);

Vue.config.productionTip = false;

import session from "./session";

const router = new VueRouter({
  routes: [
    { path: '/session', component: session, name: 'session' }
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

new Vue({
  el: '#app',
  i18n,
  components: { App },
  router,
  template: '<App/>'
});
