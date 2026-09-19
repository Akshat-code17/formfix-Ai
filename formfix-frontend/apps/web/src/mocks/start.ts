import { IS_DEMO } from '../lib/env';

/**
 * Fixtures are only ever reachable through this function, and it refuses to
 * do anything outside demo mode. There is no code path by which live mode
 * can answer a request from a fixture.
 */
export async function startDemoBackend(): Promise<void> {
  if (!IS_DEMO) {
    // Remove only this app's mock worker when switching the same origin to HTTP.
    if ('serviceWorker' in navigator) {
      for (const registration of await navigator.serviceWorker.getRegistrations()) {
        const worker = registration.active ?? registration.waiting ?? registration.installing;
        if (worker && new URL(worker.scriptURL).pathname === '/mockServiceWorker.js')
          await registration.unregister();
      }
    }
    return;
  }
  const { worker } = await import('./browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
}
