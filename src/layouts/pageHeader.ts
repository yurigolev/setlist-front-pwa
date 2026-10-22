import type { Component, InjectionKey, ShallowRef } from 'vue';

export interface PageHeaderRegistration {
  heading: Component;
  context: Component;
  withBack: boolean;
}

export const pageHeaderKey: InjectionKey<ShallowRef<PageHeaderRegistration | undefined>> =
  Symbol.for('setlist:page-header');
