# Cloud book generation

The reader, notes and library work without an AI key. New
explanations require a server-side `ANTHROPIC_API_KEY` saved as a Cloudflare secret
(`npx wrangler secret put ANTHROPIC_API_KEY`). The UI never receives the key. Do not
claim a configured key was tested until an actual provider request succeeds.

## Processing

1. Save the parsed EPUB to the user's R2/D1 library.
2. An import starts generation automatically when the cloud AI key is configured.
   `POST /api/jobs` with `{ "bookId": "..." }` creates one Claude Message Batch containing
   every missing substantive section, including partially prepared books, with structured
   JSON output. Length and item-count limits Claude's schema format does not accept are
   dropped from the request only; `validateGuide` still enforces all of them.
   Articles skip the batch: each section is one direct `/v1/messages` call, ready in
   minutes (`completionWindow: "minutes"`), in a separate job slot (`<userId>#articles`)
   so a running book never blocks an article.
   Already prepared or generated sections are excluded. Long chapters are split
   on paragraph/word boundaries with exact paragraph IDs, retaining all text.
3. The provider processes the whole book without the browser or computer staying on.
   Batch completion can take up to 24 hours. The app must show this before starting.
4. `GET /api/jobs?bookId=...` checks provider status and, after completion, stores
   up to 12 validated guides per request. Opening any book in the library again continues
   collection. A closed browser does not collect results into R2 until reopened,
   but the provider continues processing the submitted batch.
5. Added teaching examples use a clearly fictional everyday person applying the
   idea at work or at home. Source claims stay
   faithful; professional transfer is labeled as interpretation. New guides target
   480–720 words of teaching prose and require a chapter-specific mnemonic,
   learningPath bridges, and chapterVisual metadata. chapterVisual also carries a
   one-sentence `takeaway` and one plain `parts` line per label: the lesson opens with that
   picture and the reader taps each part to learn it (see "Visual first" in DESIGN.md). Bounded neighboring source
   excerpts support transitions; citations must still come from the current unit.
   Existing prepared and legacy guides remain readable and importable.
   Every guide must carry 6–10 tap-only `checks` (pick, book, order, mistake),
   each quoting its chapter exactly. Output that asks the reader to write,
   type, describe, summarize or explain in their own words is rejected.
6. Exact source excerpts, schema, graph connectivity, and fictional-example
   labeling are checked before storage. This does not independently establish
   the correctness of the author's claims or of every AI interpretation.

Endpoints require the signed-in owner (build/owner-auth.ts) and same-origin mutation requests.
There are no public generation endpoints, webhooks, or scheduled Codex tasks.

## Controls and recovery

- One current job per user; a different book cannot replace an active job.
- At most 250 missing units per book and 16,000 output tokens per unit (thinking included).
- Model: `claude-haiku-5-5`, effort `low`. Book batches run at half price; the shared
  instructions are prompt-cached.
- No browser, search, code, or other model tools; EPUB content is untrusted input.
- No automatic paid retries. `POST /api/jobs/:id/retry` submits only unfinished
  units, capped at two submissions per unit in the current job.
- `POST /api/jobs/:id/cancel` requests provider cancellation; completed sections may
  still be charged. Successful guides are kept.
- A D1 lease prevents two devices submitting the same book concurrently.
- A durable submission marker is written before the paid request. If its response
  is lost, the app adopts the one provider batch created after that marker with the
  same number of requests, instead of silently creating another batch. Message
  batches carry no metadata, so zero or several matches stay unconfirmed. Unresolved submissions stay visibly
  unconfirmed; they require provider-side inspection if reconciliation keeps failing.
- The saved job is resumable across Worker restarts. Completed guides survive
  later jobs. R2 output caching and immutable guide writes make collection replay safe.

Book passages are sent to the Anthropic API when a job is submitted. API usage is
billed to the Anthropic Console account, separately from any Claude subscription.
Batch results are kept by the provider for 29 days. The current app stores
its own source and validated guides privately in Site storage.

## Verification

Run `node --test tests/generation*.test.mjs` and the project's TypeScript check.
The tests use no external API, charges, or real keys. They cover
complete source coverage, payload bounds, exact-quote rejection, malformed graph,
refusal/incomplete output, concurrent submission, lost-response reconciliation,
collection, retry-only-failed behavior, and retry limits.


Provider reference: Anthropic Message Batches and structured outputs
(https://platform.claude.com/docs).
