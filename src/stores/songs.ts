import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { NewSong, Song } from '@/domain/song'
import * as api from '@/services/libraryApi'
import { createUuid } from '@/services/uuid'
import { attachmentValidationMessage } from '@/services/attachments'
import { checkAttachment } from '@/services/libraryApi'
import { publishSnapshot, readSnapshot, type SnapshotMeta } from '@/repositories/serverSnapshotRepository'

export const useSongsStore = defineStore('songs', () => {
  const songs = ref<Song[]>([])
  const isLoading = ref(false)
  const isSyncing = ref(false)
  const syncError = ref('')
  const meta = ref<SnapshotMeta>()
  const online = ref(navigator.onLine)
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { online.value = true })
    window.addEventListener('offline', () => { online.value = false })
  }
  async function load(): Promise<void> {
    isLoading.value = true
    try {
      const local = await readSnapshot(); songs.value = local.songs; meta.value = local.meta
    } finally { isLoading.value = false }
    if (online.value) await refresh().catch(() => undefined)
  }
  async function refresh(): Promise<void> {
    isSyncing.value = true; syncError.value = ''
    try {
      const snapshot = await api.fetchSnapshot()
      meta.value = await publishSnapshot(snapshot)
      songs.value = (await readSnapshot()).songs
      online.value = true
    } catch (error) {
      syncError.value = error instanceof Error ? error.message : 'Не удалось обновить библиотеку'
      if (error instanceof api.UnknownResultError) online.value = false
      throw error
    } finally { isSyncing.value = false }
  }
  function get(id: string): Promise<Song | undefined> { return Promise.resolve(songs.value.find((song) => song.id === id)) }
  async function afterWrite(): Promise<void> { await refresh() }
  async function create(input: NewSong, key = createUuid()): Promise<Song> {
    if (!online.value) throw new Error('Для сохранения требуется интернет')
    try { const song = await api.createSong(input, key); await afterWrite(); return await get(song.id) ?? song }
    catch (error) { if (error instanceof api.UnknownResultError) await refresh().catch(() => undefined); throw error }
  }
  async function update(song: Song): Promise<Song> {
    if (!online.value) throw new Error('Для сохранения требуется интернет')
    try { const saved = await api.patchSong(song); await afterWrite(); return await get(saved.id) ?? saved }
    catch (error) { if (error instanceof api.UnknownResultError || error instanceof api.ApiError && error.status === 409) await refresh().catch(() => undefined); throw error }
  }
  async function remove(song: Song): Promise<void> {
    if (!online.value) throw new Error('Для сохранения требуется интернет')
    try { await api.deleteSong(song); await afterWrite() }
    catch (error) { if (error instanceof api.UnknownResultError || error instanceof api.ApiError && error.status === 409) await refresh().catch(() => undefined); throw error }
  }
  async function addAttachment(song: Song, file: File, id = createUuid(), revision = song.revision): Promise<Song> {
    if (!online.value) throw new Error('Для сохранения требуется интернет')
    const validation = attachmentValidationMessage(file)
    if (validation) throw new Error(validation)
    await checkAttachment(file)
    try { await api.uploadAttachment(song, file, id, revision) }
    catch (error) { if (error instanceof api.UnknownResultError) await refresh().catch(() => undefined); throw error }
    await afterWrite()
    return (await get(song.id))!
  }
  async function removeAttachment(song: Song, id: string): Promise<Song> {
    if (!online.value) throw new Error('Для сохранения требуется интернет')
    await api.deleteAttachment(id); await afterWrite()
    return (await get(song.id))!
  }
  return { songs, isLoading, isSyncing, syncError, meta, online, load, refresh, get, create, update, remove, addAttachment, removeAttachment }
})
