# The 30-min version: content spec

One JSON file per book: `reader/thirty-min/<bookId>.json`. Check it with
`node scripts/check-thirty-min.mjs reader/thirty-min/<bookId>.json` (must print no ✗).

## What it is

An expanded summary of the whole book that reads like the book itself, in about
30 minutes (6,300–7,000 words at 230 words a minute; figure text counts). It
carries the meaning and ideas through every chapter, in order. The reader is a
visual learner, so every section has pictures (figures) that nail its main point,
and the book's main ideas come back again and again: each section restates the
book's thread in its own terms, and ends by carrying its idea into the next.

No questions to the reader, no quizzes, no exercises to write, no "ask yourself".
Just words and pictures. Declarative, plain, warm, book-like prose: real
paragraphs of 110–190 words, not bullet lists. Present tense ("The author shows…").
Faithful to the author: their claims, their examples, studies and stories by name.
Quote the author only in short phrases (under 15 words), rarely.

## Shape

```json
{
  "bookId": "<id from lib/*-library.json>",
  "thread": "One sentence: the book's core argument (≤ 260 chars). Shown at the top of every section.",
  "opening": ["1–3 paragraphs: what the book argues and why it matters"],
  "sections": [
    {
      "covers": ["chapter-1"],
      "label": "Chapter 1",
      "title": "Journey to Elsewhen",
      "idea": "One plain sentence: this section's big idea (≤ 260 chars).",
      "blocks": [
        {"p": "paragraph"},
        {"fig": {"kind": "contrast", "...": "..."}},
        {"p": "paragraph"},
        {"pull": "One line that restates the main idea, set large (≤ 260 chars)."},
        {"h": "Optional subheading (≤ 100 chars)"},
        {"p": "paragraph"}
      ],
      "carry": "2–3 sentences: restate this section's idea and hand it to the next section by name (the last one hands to the closing)."
    }
  ],
  "closing": ["1–3 paragraphs that pull every section's idea together, naming them, and land the thread"]
}
```

- `covers`: the book's chapter ids this section condenses, in reading order, each
  chapter at most once. Skip front/back matter with no ideas (title page,
  contents, notes, index, about the author, ads). Group very short chapters.
- `label`: short, e.g. "Chapter 1", "Introduction", "Part II", "Strategies 1–7".
- Every section: at least 3 paragraphs, at least 2 figures of different kinds, and
  one `pull`. Put the first figure after the first or second paragraph.

## Figure kinds (`fig`)

All text is short. `title` (≤ 120 chars) is optional on every kind and says what the picture shows.

- `contrast`: `{left:{label, points[2–4]}, right:{label, points[2–4]}}` labels ≤ 50, points ≤ 140. Two sides: what we expect vs what happens, before vs after, myth vs fact.
- `chain`: `{steps:[{label ≤ 48, note ≤ 140}] ×3–5}` a sequence or cause → effect.
- `cycle`: same shape as chain; a loop that feeds back to its start.
- `stack`: `{layers:[{label, note}] ×3–5}` top layer first; levels, from surface to deep.
- `scale`: `{from ≤ 40, to ≤ 40, marks:[{at 0–100, label ≤ 60}] ×2–4}` a spectrum with points placed on it.
- `stat`: `{value ≤ 12 chars, label ≤ 200}` a real number from the book only (e.g. "2×", "60%").
- `terms`: `{items:[{term ≤ 60, meaning ≤ 200}] ×2–4}` the section's key words.
