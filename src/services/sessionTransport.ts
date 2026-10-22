// Compatibility exports; session state and token handling live in one composable.
export {
  apiBaseUrl,
  authFetch,
  configureSession,
  notifyUnauthorized,
  safeReturnTo,
  sessionOptions,
  sessionVersion,
} from '@/composables/useAuthSession';
