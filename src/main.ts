import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'

import App from './App.vue'
import { router } from './router'
import './styles.css'
import './focused-glass.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')

// Только production-сборка содержит полный precache для мгновенного офлайн-запуска.
if (import.meta.env.PROD) registerSW({ immediate: true })
