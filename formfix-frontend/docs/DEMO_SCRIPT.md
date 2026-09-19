# Demo script — 3 to 4 minutes

**Before you start:** `npm run dev`, browser at `http://localhost:5173`, window at desktop width,
**Demo controls → Switch all off**. If you have already run through it once, press
**Delete my session** so you begin clean.

---

## 0:00 — The problem, on screen (20s)

Open the start screen.

> "This is a six-page form. Most people who have to fill one in do not fail because they are
> careless. They fail because nobody tells them what question 8 actually wants."

Point at the headline and the two entry points: drag a PDF, or **Try a sample form**.

> "Everything you're about to see is marked *Demo data*, and the document is synthetic — we made
> it up for this demo. It is not a real scheme."

Press **Try a sample form**.

## 0:20 — Analysis you can believe (25s)

> "These are the server's real stages. No invented percentages, and if you navigate away the
> job keeps running."

When it finishes, point at the counts.

> "Fourteen questions, three documents, and two items it isn't confident about — and it says so
> rather than guessing. That's a gap in what it could read, not a mistake in your answers."

Press **Open the guide**.

## 0:45 — The core idea (50s)

This is the moment the product lands. Take your time.

> "Left: the questions. Middle: what this one means and what to put. Right: the actual form."

Read the explanation for question 1 aloud, then point at the example box.

> "The example is fictional and clearly marked — it is never written into your answer."

Now click the **Page 1 · Question 1** chip.

> "And this is the part that matters. That explanation came from *there*."

The highlight lands on the sentence. Zoom in twice, then rotate the page once.

> "Measured coordinates, not an estimate. It stays put."

Point at the progress panel.

> "Twelve of fourteen answered. Ten of eleven *required* — one question the form never says is
> compulsory, so we don't pretend to know. And answered is not the same as checked."

## 1:35 — Language (30s)

Switch the language selector to **తెలుగు**.

> "Explanations and chat, in Telugu."

Point at the answer field and the question heading.

> "The answer is untouched. The original label is untouched. The document is untouched. Only the
> explanation is translated — we never rewrite what someone actually entered."

Switch back to English.

## 2:05 — Honest answers (30s)

Open **Ask about this form**, type:

```
Is Aadhaar accepted as identity proof?
```

> "Watch the badge."

It returns **Not in this form**.

> "The form never mentions Aadhaar. It would be trivially easy to say 'yes, usually' — and that's
> exactly the answer that gets someone's application rejected. It cites what the form *does* name,
> and stops there."

Click a source chip to jump to page 6.

## 2:35 — The check (45s)

Go to **Form check** → **Run the check**.

> "Two must-fix, one document missing, one thing only you can settle. Four separate numbers,
> because they are four different kinds of problem."

Read the PIN error.

> "Five characters where page three says six. And it tells you *where* it read that."

Click **Fix this** → type `580009`.

Navigate to question 13, enter `STU-2024-114520`. Go to **Documents**, tick the income
declaration.

> "Ticking this records what you told us. It is not verification — we never see the document."

Back to **Form check** → **Check again**.

> "Zero, zero — and note the wording: *no issues found by the configured checks*. Not 'approved'.
> Not 'you'll get it'. And the item we can't settle is still sitting there, because it hasn't gone
> away."

## 3:20 — Take it away, and take it back (25s)

> "Print or save as PDF, or download the JSON."

Press **Download JSON**, show the file lands.

> "It says on its face that it's a review summary, not a completed application. No session
> identifier in it."

Then **Delete my session** — show the confirmation, cancel it.

---

## If you have another minute: the failure paths

Open **Demo controls**.

> "These are not a story about resilience. They're switches."

**Next save fails** → change any answer.

> "Save failed. Your edit is still there, the field says Unsaved, and Retry works. It does not
> move on and quietly drop what you typed."

Press **Retry** → *Saved*.

**Next save hits a conflict** → change an answer again.

> "409. It takes the server's newer revision, replays your edit on top, and neither side loses."

**Explanations and chat unavailable** → open any question.

> "Provider down. It says so, and the original question and your answer still work."

---

## Questions you will get

**"Can it fill in my real form?"**
Not in demo mode — demo mode only analyses the bundled sample, and says so rather than mapping
these fields onto a document it hasn't read. Live mode against the backend analyses a real upload.

**"Does it submit the application?"**
No. It never fills the official PDF and never talks to a portal. That is out of scope on purpose.

**"How do you know the highlight is in the right place?"**
The demo PDF and its coordinates are produced by the same layout pass. For a real upload the
backend returns the extractor's regions, and where it has none we show the page and the quote
rather than a guessed box — there is a document requirement in this demo that does exactly that.

**"Is the AI making the validation decisions?"**
No. The checks are deterministic rules read off the form — six digits, nine digits, box ticked.
The model's job is explanation and citation. Anything the rules cannot settle is shown as
*needs your judgement*, not decided for you.
