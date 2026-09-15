import { createSSRApp } from 'vue'
import * as Pinia from 'pinia'
import App from './App.vue'
import './styles.scss'

export function createApp() {
  const app = createSSRApp(App)
  app.use(Pinia.createPinia())
  // App 端必须返回 Pinia 模块，调试基座才能正确注入运行时
  return { app, Pinia }
}
