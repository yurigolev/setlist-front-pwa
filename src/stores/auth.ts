import { defineStore } from 'pinia';
import { useAuthSession } from '@/composables/useAuthSession';
export type { SessionUser } from '@/composables/useAuthSession';

export const useAuthStore = defineStore('auth', () => useAuthSession());
