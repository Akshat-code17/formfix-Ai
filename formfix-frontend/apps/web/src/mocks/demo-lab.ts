/**
 * Demo controls.
 *
 * These are real, working switches that make the fixture backend fail in
 * specific ways, so the recovery paths can be shown rather than described.
 * They exist only in demo mode and the panel says exactly what each one does.
 */
export type DemoFaultKey =
  | 'failNextSave'
  | 'conflictNextSave'
  | 'providerOutage'
  | 'sessionExpired'
  | 'slowNetwork';

export const FAULT_LABELS: Record<DemoFaultKey, { title: string; detail: string }> = {
  failNextSave: {
    title: 'Next save fails',
    detail: 'The next answer save returns a server error. Your edit is kept and can be retried.',
  },
  conflictNextSave: {
    title: 'Next save hits a conflict',
    detail: 'The next save returns 409 because the session moved on. Your pending edit is preserved.',
  },
  providerOutage: {
    title: 'Explanations and chat unavailable',
    detail: 'Explanation and chat requests return "provider unavailable" until you switch this off.',
  },
  sessionExpired: {
    title: 'Session expired',
    detail: 'Every request returns 401 until you switch this off, as if the session had timed out.',
  },
  slowNetwork: {
    title: 'Slow network',
    detail: 'Adds about two seconds to every request so loading states are visible.',
  },
};

const KEY = 'formfix.demo.faults';

type Faults = Partial<Record<DemoFaultKey, boolean>>;

function read(): Faults {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Faults;
  } catch {
    return {};
  }
}

function write(faults: Faults) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(faults));
  } catch {
    // Storage unavailable (private mode). The controls simply do nothing.
  }
  listeners.forEach((l) => l(faults));
}

const listeners = new Set<(f: Faults) => void>();

export const demoLab = {
  get: read,
  isOn(key: DemoFaultKey) {
    return read()[key] === true;
  },
  set(key: DemoFaultKey, value: boolean) {
    write({ ...read(), [key]: value });
  },
  toggle(key: DemoFaultKey) {
    this.set(key, !this.isOn(key));
  },
  /** One-shot faults clear themselves once they have fired. */
  consume(key: DemoFaultKey) {
    if (!this.isOn(key)) return false;
    this.set(key, false);
    return true;
  },
  clear() {
    write({});
  },
  subscribe(listener: (f: Faults) => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
