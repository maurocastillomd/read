# read. design rules

Every screen and every new feature follows these rules from the first draft. They keep the app consistent as it grows.

## The direction

Minimal, but tech-forward. Think rounded glass and the Apple ecosystem: soft radii, frosted translucent surfaces that float over content, quiet chrome, and the content first. The bar to clear is "better than Kindle or any current reading app."

## Keep

- **Colors.** Keep the existing palette: paper backgrounds, near-black ink, the app blue (`--blue`, #2039c4 by day) as the only accent, and the night theme. Don't add new brand colors. Tints come from `color-mix` of what is already there.
- **Fonts.** Keep the existing families: the sans for UI, the serif for display headings, and Literata (`/fonts/`) for book text. Don't add a typeface.

## Shapes and surfaces

All tokens live in `reader/design-system.css`. That file loads last, so it has the final word on chrome. New CSS uses these tokens and never hard-codes a radius or a shadow.

| Token | Use |
| --- | --- |
| `--r-pill` (999px) | Buttons, segmented controls, the top bar, toasts, inputs |
| `--r-control` (14px) | List rows, menu items, small fields |
| `--r-card` (22px) | Cards and panels |
| `--r-sheet` (28px) | Dialogs, sheets, the iPad sidebar rail |
| `--glass-bg` / `--glass-bg-strong` | Floating bars / sheets that hold text |
| `--glass-fill` / `--glass-fill-hover` | Quiet filled controls inside glass |
| `--glass-edge`, `--glass-shadow`, `--glass-blur` | The hairline edge, lift and frosted blur |
| `--ease` | Every transition |

- **Floating chrome.** The top bar is a pill that floats. It doesn't stretch edge to edge. The reader bar hides while you read and comes back with a tap. On iPad and desktop the sidebar is a floating glass rail.
- **Icon buttons** are 40px circles with no border (`.glass-icon`). They fill faintly only on hover or press.
- **Glass must stay readable.** If text behind a surface is legible through it, raise the opacity. Don't add a border. Respect `prefers-reduced-transparency` and `prefers-reduced-motion`.
- **Press feedback.** Buttons scale down slightly when pressed (0.94 to 0.97).

## Chrome budget

- The top bar holds a breadcrumb plus at most four round icons. Status lives in a dot, not a sentence.
- Panels that are only for the library, like the reading-habit strip, show on the library only.
- Settings belong in sheets. Aa ("Text and page") holds every reading preference. Don't add toolbars.
- The reader page shows only the book. The progress is a hairline plus one small glass pill.

## Visual first

read. is built for visual learners. Every book lesson leads with a picture of its main idea, not with text.

But a lesson must still feel like reading. Right under the picture, "The chapter in brief" gives two paragraphs of real prose set in the book's typeface (Literata, ragged right, indented second paragraph), and the chapter map opens with one paragraph on how its ideas connect. Prepared lessons keep this text in `reader/idea-visuals.json` (`reading.passage`, `reading.connect`); generated lessons use `guide.reading`; older guides show their gist. The lesson ends with "The chapter in review" (`reading.forward`, one paragraph): a recap of the chapter's ideas that carries them into the next chapter by name, or closes out the book on the last lesson. Keep it source-first and declarative: no questions, no writing prompts.

- **The big idea** opens step 1: one plain sentence, then a picture of three parts drawn from `chapterVisual.kind` (handoff, loop, capacity, decision, layers, compass, release, network). Tapping a part shows what it means. After all three, a tap check hides one part and asks which belongs in the gap.
- **The chapter map** opens "Picture it": the guide's `flow` drawn as a graph. Tapping an idea lights up its links. "Fill the gap" hides the busiest idea.
- Bundled books (none ship with the public edition) can get their sentences from `reader/idea-visuals.json`. Uploads get `takeaway` and `parts` from the generator. Older guides fall back to their own concepts, so no lesson is ever without a picture.
- **Lesson header** (books): one row (All lessons, Lesson n of N, Original, lesson picker), one step rail, the title, then the picture. The real-life examples switch lives in the Aa sheet under "Lessons".
- **Book at a glance** is the default view of "Understand the book": every lesson's picture, main idea and three parts as cards. A Pictures/List switch keeps the old list.
- **Picture review**: passing a lesson's picture check schedules it for day 1, 3 and 7 (`state.last[book]['pic:<unit>'] = 'YYYY-MM-DD|stage'`). Each return hides a different part. Due pictures show as a card on the library, the book overview and the lesson collection, and open in a glass sheet. Code: `reader/book-glance.js`.
- **No picture repeats.** Every picture in the library (lesson pictures, 30-min figures, book art, an article's study at a glance) gets its own machine. The first picture of each kind keeps the hand-built machine (the tank, the balance…); every later one is a bench of stations (tank, gears, spring, lamp… 18 in all, two variants each) set out in the idea's shape: a line for a handoff or chain, a closed pipe ring for a loop or cycle, a fork for a choice, rising steps for layers, a hub for a direction, a gate for a limit. A register (`reader/iso-compose.js`, fed by `ideaLibraryOrder` in `idea-visual.js`) walks the whole library in a fixed order (lessons, then 30-min figures, then one-off art) and never hands out the same combination twice. A picture comes back only as itself: its own thumbnail, the 30-min section for that chapter, and review.
- Pictures use the palette tokens only, animate gently, and stop moving under `prefers-reduced-motion`. Code: `reader/idea-visual.js` and `.css`.

## Keep what you read

Everything read. asks you to recall shares one memory (`reader/keep.js`): a lesson's picture, a tap question, an article's main result. Each has a return schedule of 1, 3, 7 and 21 days; a miss comes back tomorrow, a right-but-guessing answer keeps its gap, a sure answer moves one step further apart. Entries live in `state.last[book]` as `'YYYY-MM-DD|stage|right|returns|misses'`.

- **Today** is the first card on the library (and on a book's home, for that book): everything due, misses first, one reading at a time so books and articles mix, eight per sitting, in a glass sheet. No typing.
- **Before you start** opens every lesson after the first with one recall from the previous lesson (its picture, or a question), then the lesson as usual. Answered once per lesson; a miss joins Today's pile.
- **What's holding** replaces "lessons done" on the shelf, the Continue card and the book home: held (right twice, 3+ days apart), fading (due), missed. Opening a lesson counts for nothing.
- **Your copy** appears when a book is finished: the ideas you hold in your holding order, the three that kept slipping, and a share-as-picture button (a drawn image through the share sheet; text when the device can't share files).
- The library opens on Today and Continue; there is no intro headline. "Add reading" sits beside the shelf search.

## Lessons first

read. exists so you get a book's main ideas and move on, without reading every page. The original text is a reference, reached from "See it in the book" and "Read the original", never the default.

- **Lesson codes.** Every lesson shows a short code: `C5 · L1` is chapter 5, lesson 1. Front matter reads `Intro · L1, L2…`, back matter `End · L1`. A chapter split into several lessons counts L1, L2, L3. Codes come from `lessonCodes()` in `reader/lessons-first.js`; use them wherever a lesson is named (lesson bar, picker, book home, review sheet, Continue card).
- **Opening a book** goes to its lessons ("Lessons" in the sidebar), not the overview: "The whole book in N minutes" (N counts the brief, every big idea and every chapter-in-brief), a Continue button for the next lesson, "The book in brief" (prepared books, `BOOK_BRIEFS`), then one row per lesson with its picture, big idea and a folded "The chapter in brief".
- **The library** leads with one Continue card: the book touched most recently that isn't finished, its next lesson and its picture.
- **Done** means marked reviewed, the last step reached, or the picture check passed. When every lesson is done, the book home opens on "Book finished" with one pick for the next book from the shelf, and the last lesson's button reads "Finish the book".

## Interaction

- No typing anywhere in learning flows. See "No typing, anywhere" in `CLOUD-START-HERE.md`.
- Tap targets are at least 40px. Design for iPad first, at 820×1180 portrait.
- Check every change in day and night at iPad size before calling it done.

## Library and covers

- **Every reading has its own cover.** A book shows the real cover from its file. A web article shows its page's own share picture (fetched once at import, logos skipped). Anything else gets a cover drawn from its own title: one of eight line motifs on one of six palette tones, so no two match. A picture that more than one reading shares counts as none. Code: `reader/library-shelf.js`.
- **Shelves fold.** Tapping a shelf's name (Books, Articles & papers) hides or shows it; the choice is remembered on the device. Searching opens every shelf.
- **Back to top** is a 48px glass circle with an arrow, bottom right, that appears in the last stretch of a long lesson, chapter or article. No words. Code: `reader/back-to-top.js`.
