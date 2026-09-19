import { LanguageSchema, type Language } from '@formfix/contracts';

/**
 * Only harmless preferences are kept in the browser. Answers live on the
 * server; nothing identifying and no session secret is written here.
 */
const KEYS = {
  language: 'formfix.pref.language',
  lastFormId: 'formfix.pref.lastFormId',
  sourcePanel: 'formfix.pref.sourcePanel',
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: preferences simply do not persist.
  }
}

export const prefs = {
  getLanguage(): Language {
    const parsed = LanguageSchema.safeParse(read(KEYS.language));
    return parsed.success ? parsed.data : 'en';
  },
  setLanguage(language: Language) {
    write(KEYS.language, language);
  },
  getLastFormId(): string | null {
    return read(KEYS.lastFormId);
  },
  setLastFormId(formId: string | null) {
    write(KEYS.lastFormId, formId);
  },
  getSourcePanelOpen(): boolean {
    return read(KEYS.sourcePanel) !== 'closed';
  },
  setSourcePanelOpen(open: boolean) {
    write(KEYS.sourcePanel, open ? 'open' : 'closed');
  },
  /** Called after the session is deleted or expires. */
  clearAll() {
    Object.values(KEYS).forEach((k) => write(k, null));
  },
};
