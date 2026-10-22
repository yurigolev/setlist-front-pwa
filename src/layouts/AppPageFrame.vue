<script setup lang="ts">
import { computed, provide, shallowRef } from 'vue';
import { useAuthStore } from '@/stores/auth';
import SessionHeader from '@/components/SessionHeader.vue';
import SessionStatusNotice from '@/components/SessionStatusNotice.vue';
import { pageHeaderKey, type PageHeaderRegistration } from './pageHeader';

const props = defineProps<{ routeName?: string | symbol; publicPage: boolean }>();
const auth = useAuthStore();
const publicPage = computed(() => props.publicPage || !auth.user);
const pageHeader = shallowRef<PageHeaderRegistration>();
provide(pageHeaderKey, pageHeader);
</script>

<template>
  <div class="route-page">
    <header
      class="layout-header"
      :class="{
        'layout-header--public': publicPage,
        'layout-header--with-back': pageHeader?.withBack,
      }"
    >
      <div class="layout-header__row">
        <div id="layout-page-heading"><component :is="pageHeader.heading" v-if="pageHeader" /></div>
        <SessionHeader v-if="pageHeader && !publicPage && routeName !== 'profile'" />
      </div>
      <div class="layout-session-notice">
        <SessionStatusNotice v-if="pageHeader && !publicPage" />
      </div>
      <div id="layout-page-context"><component :is="pageHeader.context" v-if="pageHeader" /></div>
    </header>
    <slot />
  </div>
</template>
