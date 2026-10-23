<script setup lang="ts">
import yandexLoginArtwork from '@/assets/yandex-id-login.svg';
</script>

<template>
  <button class="yandex-login-button" type="button">
    <img :src="yandexLoginArtwork" width="260" height="56" alt="" aria-hidden="true" />
    <span class="yandex-login-button__label">Войти с Яндекс ID</span>
  </button>
</template>

<style scoped>
.yandex-login-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 56px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 12px;
  background: #000;
  color: #fff;
  cursor: pointer;
}

.yandex-login-button img {
  display: block;
  max-width: 100%;
  height: auto;
}

.yandex-login-button:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 4px;
}

.yandex-login-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.yandex-login-button__label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
