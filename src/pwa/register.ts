// Service worker registration. The new version installs in the background (autoUpdate) but the page is
// never reloaded on its own: an in-progress log must not be interrupted. Instead we call onUpdated and
// the toast offers "Updated – tap to reload"; otherwise the new version applies on next launch.
import { registerSW } from 'virtual:pwa-register';

export function registerPwa(onUpdated: () => void): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onNeedReload: onUpdated,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // An installed app can stay open for days; look for a new version whenever it comes back to the front.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    },
    onRegisterError() {
      // Offline or unsupported: the app still works from the network or the existing cache.
    },
  });
}
