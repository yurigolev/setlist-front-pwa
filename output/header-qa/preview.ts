// Isolated visual fixture. No backend requests or production session changes.
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '/src/App.vue'
import Library from '/src/views/LibraryView.vue'
import Profile from '/src/views/ProfileView.vue'
import Form from '/src/views/SongFormView.vue'
import Setlists from '/src/views/SetlistsView.vue'
import { useAuthStore } from '/src/stores/auth'
import { useSongsStore } from '/src/stores/songs'
import { useSetlistsStore } from '/src/stores/setlists'
import '/src/styles.css'
import '/src/focused-glass.css'
import '/src/layout.css'
const app=createApp(App), pinia=createPinia(); app.use(pinia)
const auth=useAuthStore(); auth.user={id:'header-preview',displayName:'yuri golev'}; auth.ready=true
const setlists=useSetlistsStore(); setlists.setlists=[{id:'preview',title:'Еще сет лист',role:'owner',revision:1,createdAt:'2026-10-12T12:36:00Z',updatedAt:'2026-10-12T12:36:00Z',deletedAt:null}]; setlists.selectedId='preview';setlists.ready=true;setlists.initialize=async()=>{}
const songs=useSongsStore();songs.load=async()=>{};songs.refresh=async()=>{};songs.syncedAt={preview:'2026-10-12T12:36:00Z'}
songs.songs=[{id:'one',title:'Кукушка',artist:'Кино',content:'',attachments:[],updatedAt:'2026-10-12T12:36:00Z'},{id:'two',title:'Звезда по имени Солнце',artist:'Кино',content:'',attachments:[],updatedAt:'2026-10-11T12:36:00Z'}]
const router=createRouter({history:createMemoryHistory(),routes:[{path:'/',name:'library',component:Library},{path:'/profile',name:'profile',component:Profile},{path:'/songs/new',name:'song-new',component:Form},{path:'/setlists',name:'setlists',component:Setlists}]});app.use(router);await router.push('/');await router.isReady();app.mount('#app')
