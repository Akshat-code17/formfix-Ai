import type { AppMode } from '@formfix/contracts';

/**
 * Two explicit modes.
 *
 * `demo` — every request is answered by the fixture adapter (MSW). The UI
 *          says so, persistently, on every screen.
 * `live` — every request goes to the real backend. If it fails, it fails.
 *          Fixtures are never loaded in this mode, so there is no path by
 *          which a hidden fixture could dress up as a real AI answer.
 */
const raw = (import.meta.env.VITE_APP_MODE ?? 'demo').trim();

export const APP_MODE: AppMode = raw === 'live' ? 'live' : 'demo';
export const IS_DEMO = APP_MODE === 'demo';

/**
 * Requests always go to a same-origin `/api` path. In live mode the dev
 * server proxies that to VITE_API_BASE_URL, so the browser never makes a
 * cross-origin credentialed call and no provider key is ever in the bundle.
 */
export const API_PREFIX = '';

export const RETENTION_POLICY_FALLBACK_URL = '/retention';
