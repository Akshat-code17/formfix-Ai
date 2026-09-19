import type { Answer, DocumentReadiness } from '@formfix/contracts';

const at = '2026-09-18T09:00:00.000Z';
const a = (value: Answer['value']): Answer => ({ value, skipped: false, updatedAt: at });
const ready = (value: boolean): DocumentReadiness => ({ ready: value, updatedAt: at });

/**
 * The sample session starts part-filled, with exactly three predictable
 * mistakes so the final check has something honest to find:
 *   1. a five-digit PIN where the form requires six,
 *   2. an empty required supporting-document reference number,
 *   3. one required document not marked ready.
 * Every value here is fictional.
 */
export const demoSeededAnswers: Record<string, Answer> = {
  'fld-full-name': a('Meera Anand Kulkarni'),
  'fld-dob': a('2004-09-04'),
  'fld-enrolment-no': a('007412580'),
  'fld-category': a('general'),
  'fld-address': a('14 Neelkanth Apartments\nSecond Cross Road\nVidya Nagar'),
  'fld-city': a('Dharwad'),
  'fld-pin': a('58000'), // seeded mistake 1 — five digits
  'fld-phone': a('9876500011'),
  'fld-email': a('meera.demo@example.org'),
  'fld-support-type': a('tuition'),
  'fld-amount': a('24000'),
  'fld-doc-number': a(''), // seeded mistake 2 — required, left empty
  'fld-declaration': a(true),
};

export const demoSeededReadiness: Record<string, DocumentReadiness> = {
  'doc-identity': ready(true),
  'doc-income': ready(false), // seeded mistake 3 — required, not marked ready
};

/** The same session after the three mistakes are corrected. Used by tests. */
export const demoCorrectedAnswers: Record<string, Answer> = {
  ...demoSeededAnswers,
  'fld-pin': a('580009'),
  'fld-doc-number': a('STU-2024-114520'),
};

export const demoCorrectedReadiness: Record<string, DocumentReadiness> = {
  'doc-identity': ready(true),
  'doc-income': ready(true),
};

/** A brand-new session: nothing answered at all. */
export const demoEmptyAnswers: Record<string, Answer> = {};
export const demoEmptyReadiness: Record<string, DocumentReadiness> = {};
