# Architecture note

Short version: one typed client, one source of truth for shapes, one place fixtures can live,
and a save queue that never loses what someone typed.

---

## 1. The contract is a package, not a convention

`packages/contracts` holds Zod schemas and the types inferred from them, plus the route table
and the error codes. Both builds import it, so a change to a response shape is a change to one
file and a typecheck failure everywhere it matters.

Three decisions in there are load-bearing:

**`SourceRef.bbox` is optional.** An extractor that cannot locate a region must still be able to
cite the page and the sentence. The viewer branches on its absence and shows the quote rather
than drawing a rectangle it invented. `doc-bank` in the fixtures exercises this path on purpose.

**`requiredStatus` has four values, not two.** `required | optional | conditional | unknown`.
A form that does not say whether a question is compulsory produces `unknown`, which flows all
the way through to a manual-review item the user has to settle. Nothing downstream is allowed to
turn "the form does not say" into "optional".

**`AnswerValue` includes `null` separately from `false`.** `null` means no value; `false` means
a checkbox was seen and left unticked. `isAnswered()` in the contract encodes that once, and
progress, validation and export all call it rather than each reinventing the rule. Identifiers
stay `string` throughout so a leading zero is never lost to a number cast.

---

## 2. Coordinates are measured, not estimated

`fixtures/demo/scripts/build-pdf.mjs` renders the synthetic document with pdf-lib and, in the
same layout pass, writes `regions.generated.json` — the normalised box of every labelled block.
`form-model.ts` reads both the block text (for the quote) and its region (for the box), so the
highlight and the citation can never drift apart.

Boxes are normalised 0–1 from the top-left of the rotation-normalised page. The viewer multiplies
by the rendered viewport, so zoom needs no special handling at all. User rotation is the one case
that does, and `rotateBox()` handles it with a unit-tested transform per quarter turn.

---

## 3. One client, two modes, no overlap

`apps/web/src/lib/api.ts` is the only module that calls `fetch`. It attaches credentials, adds
the CSRF header to mutations, parses every response through its schema, and converts failures
into `FormFixApiError` with a code the UI branches on (`isConflict`, `isSessionGone`, `retryable`).

Mode selection happens once, in `src/mocks/start.ts`:

```ts
if (!IS_DEMO) return;
const { worker } = await import('./browser');
```

The fixture adapter sits behind a dynamic import inside that guard, so live mode never loads it.
That is the whole mechanism preventing a hidden fixture from dressing up as a real AI answer —
there is no fallback branch to get wrong.

---

## 4. The save queue

`src/state/session.tsx`. Typed answers go to three places at once: a draft map that the UI reads,
a pending map that the queue reads, and, after a 600 ms debounce, the server.

- **Serialised, not parallel.** One flush is in flight at a time. Edits made during a flush
  accumulate for the next pass, so an older response can never overwrite newer input.
- **Snapshot and restore.** A flush takes the pending map and clears it. On failure it puts the
  batch back, skipping any field the user has since retyped.
- **409 means take their revision, keep our edit.** The queue refetches the session, adopts the
  server's revision, and replays the pending changes on top. It does not discard either side and
  it does not silently move on.
- **Drafts outlive failures.** A failed save leaves the typed value on screen, the field badged
  *Unsaved*, and a working Retry. The status line says *Save failed* rather than *Saved*.
- **Validation flushes first.** The check runs against saved state, never against what is still
  in the browser, and retries once on a 409 so a language change landing mid-check does not
  surface as a conflict the user cannot act on.

Tested directly in `src/state/session.test.tsx` with a mocked client.

---

## 5. Completion and validity are different numbers

`src/lib/progress.ts` computes "answered" separately from "required", and reports an
`unresolvedCount` for fields whose requirement cannot be settled — a conditional whose
controlling question is blank, or an `unknown` status. The workspace shows both lines plus the
sentence "Answered is not the same as checked". The review screen counts must-fix, checklist
gaps, warnings and manual review in four separate tiles, and a clean deterministic run still
displays the manual items. The success wording is "No issues found by the configured checks" —
never "Approved".

Editing an answer after a check makes the held report visibly stale (`reportStale` compares the
report's revision against the session's and the pending-edit count).

---

## 6. Language

Language changes explanations and chat only. Answers are canonical values and are never
translated, reformatted or rewritten — the e2e suite asserts the name field is byte-identical
across a switch to Hindi and back.

Explanations are cached under `['explanation', formId, fieldId, language, SCHEMA_VERSION]`, and
the query's `AbortSignal` is passed through to the client, so switching language cancels the
older request and a late reply cannot replace the chosen language.

Translated text is tagged with `lang` so the right face and line box apply. Nothing carrying
translated text has a fixed height; Devanagari and Telugu get taller line heights in
`styles/index.css`.

---

## 7. Colour and contrast

The palette was measured rather than assumed, and one token failed:

| pairing | ratio | |
|---|---|---|
| ink `#172B3A` on paper `#F6F5F1` | 13.8:1 | ✓ |
| muted `#566470` on paper | 5.6:1 | ✓ |
| teal `#087F8C` on white | 4.8:1 | ✓ buttons |
| **teal `#087F8C` on paper** | **4.3:1** | **✗ body text** |
| teal-ink `#06626D` on paper | 6.5:1 | ✓ |
| amber `#A35A00` on paper | 4.8:1 | ✓ |
| red `#B42318` on paper | 6.0:1 | ✓ |

So `--color-teal` is reserved for fills, borders and the source highlight, and text that needs to
read as teal uses `--color-teal-ink`. The table is repeated in a comment at the top of
`styles/index.css` so the next person changing a colour sees it.

Motion is limited to three things that aid orientation — the source highlight pulse, the field
transition, and state changes — and all of it is switched off under `prefers-reduced-motion`.

---

## 8. Untrusted text

Chat replies render through `MarkdownLite`, which splits on a fixed set of patterns and emits
React elements. There is no `dangerouslySetInnerHTML` anywhere in the codebase; a reply
containing `<script>` is displayed as the characters it is. Tested in
`src/components/markdown-lite.test.tsx`.

Chat cannot submit the form or change an answer. It reads the current field for context and
returns text and citations, nothing else.
