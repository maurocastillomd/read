# read.

**Books you finish. Ideas you keep.**

read. turns the books and articles you already own into short visual lessons you actually remember. Add an EPUB, a PDF, a web link or a paper's DOI, and read. makes:

- **Visual lessons** for every chapter: a drawn machine that pictures the main idea, about 1,000 words of real prose ("The chapter in brief" and "The chapter in review"), and tap-only questions. No typing.
- **A 30-minute version** of each book: one section per chapter with pictures, the whole book on one page at the end.
- **Listen**: any lesson, 30-minute version or chapter read aloud with your device's own voice, the paragraph highlighted as it goes.
- **Today**: one daily review across everything you've read. Missed ideas come back tomorrow; ideas you know move out to 3, 7 and 21 days. Only recall counts as progress.
- **Article and paper breakdowns**: the question, the study, the findings and their limits, an evidence ladder, statistics drawn from the reported numbers, and "Read next" suggestions.
- **Your copy** when you finish a book: the ideas you hold and the ones that kept slipping, shareable as a picture.
- Highlights, bookmarks, the full original text for reference, day and night themes, and a layout made for iPad and phone.

It's free and open source. You run your own copy on your own free Cloudflare account, with your own Anthropic API key. Nobody else sees your library.

## What you need

- A computer (Mac, Windows or Linux) with [Node.js 22 or newer](https://nodejs.org).
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up). No card needed.
- An [Anthropic API key](https://console.anthropic.com) with a few dollars of credit. read. uses Claude Haiku; whole books go through the Batch API at half price.

## Set it up (once)

1. **Get the code.** On this page, tap **Code → Download ZIP** and unzip it, or run `git clone https://github.com/maurocastillomd/read.git`.
2. **Open a terminal in that folder.** On a Mac: open Terminal, type `cd ` (with a space), drag the folder into the window, press Return.
3. **Install.** Run `npm install`.
4. **Set up and deploy.** Run `npm run setup`. It will:
   - open your browser so you can sign in to Cloudflare,
   - ask for a name for your site (press Return for `read`),
   - create your library's database and storage on your Cloudflare account,
   - build and deploy read.,
   - ask you to paste your Anthropic API key (stored as an encrypted Cloudflare secret, never in the code),
   - print a one-time **setup code**. Your site's address is in the deploy output just above it.
5. **Open your site** at that address with `/read` on the end. Enter the setup code and choose a password. You stay signed in on that device.
6. **Tell read. your name, then add your first book or article.** An article's lessons are ready in minutes. A whole book goes through a batch that can take up to 24 hours (usually much less); you can read the original meanwhile.

Open the same address on your phone or tablet and sign in with your password: your library, progress and reviews sync.

### Updating

Get the new version (download again, or `git pull`), then run `npm install` and `npm run deploy`.

### If something goes wrong

In these commands, replace `read` with your site's name if you chose another.

- **"read. is not configured yet"**: run `npm run setup` again. It reuses what exists and fills in what's missing.
- **"The Anthropic key is not linked to a workspace"**: create the key inside a workspace in the Anthropic Console and save it again with `npx wrangler secret put ANTHROPIC_API_KEY --name read`, or save the workspace ID with `npx wrangler secret put ANTHROPIC_WORKSPACE_ID --name read`.
- **Out of credits**: add credits in the Anthropic Console, then tap Retry in read.
- **Forgot your password**: run `npx wrangler secret put READ_PASSWORD --name read` and type a new one. It replaces the old password.
- **Lost a device, or think someone else signed in**: run `npx wrangler secret put SESSION_SECRET --name read` and paste a new long random value (for example from `openssl rand -base64 32`). Every device is signed out, and you sign in again with your password. Changing the password alone does not sign other devices out.
- **"Too many tries"**: sign-in allows 10 attempts a minute for the whole site. Wait a minute and try again; devices already signed in keep working.

## What it costs

- **Cloudflare**: the free plan covers personal use (Workers, D1 and KV). Without a card on file, going over a daily limit pauses the site until the limit resets; it never bills you.
- **Anthropic**: pay-as-you-go for the lessons you generate. Set a monthly spend limit in the Anthropic Console for a hard cap. Reading, reviewing and listening cost nothing.

## Privacy

Your books, notes and progress are stored only in your own Cloudflare account, behind your password. To make lessons, the text being taught is sent to the Anthropic API under your key. When you add a link, your site fetches that page. Listening uses your device's built-in voice. read. has no analytics and no central server.

## Copyright and your content

**read. ships with no books, articles or other copyrighted reading material.** It is a tool that works only on files you provide.

- Add only books, papers and articles you own, bought for your own use, or that are openly licensed, and only in ways the law where you live allows.
- Your library is private to your own deployment. read. has no feature for publishing or selling the books you add. Don't use it to distribute anyone else's copyrighted work.
- read. refuses DRM-protected EPUBs and makes no attempt to remove copy protection.
- Lessons, summaries and pictures are generated by AI from your copy, for your personal study. They can contain mistakes. Check anything important against the original.

## Disclaimer

read. is provided **"as is", without warranty of any kind**, express or implied, including merchantability, fitness for a particular purpose and non-infringement (see [LICENSE](LICENSE)).

You alone are responsible for the content you upload, for having the rights to use it, for your Cloudflare and Anthropic accounts and their costs, and for following the laws and terms that apply to you. The authors and contributors of read. are not liable for any claim, damage, cost, copyright infringement or other unlawful use arising from anyone's use or misuse of this software, and nothing in this project encourages or authorizes such use.

AI-generated lessons are study aids, not professional, medical, legal or financial advice.

This notice is not legal advice. If you have questions about your rights to a particular work, ask a qualified lawyer.

## For developers

- `npm run dev` starts a local preview. Open http://127.0.0.1:5173/signin?return_to=/read to sign in as a local reader. After a first `npm run build`, create the local database once with `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_strong_trish_tilby.sql`. Put `ANTHROPIC_API_KEY=...` in `.dev.vars` to generate lessons locally.
- `npm test` runs the test suite. `npm run build` builds the reader (`reader/` → `reader/rendered.ts`) and the Worker.
- How lessons are made: [GENERATION.md](GENERATION.md). Design rules: [DESIGN.md](DESIGN.md).
- The reader is plain JavaScript in `reader/`, inlined into one page at build time. The server is a Cloudflare Worker (`app/api/`, `lib/`) built with vinext. Sign-in lives in `build/owner-auth.ts`; deploys in `scripts/setup.mjs` and `scripts/deploy.mjs`.

## License

[MIT](LICENSE). Third-party parts keep their own licenses: see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
