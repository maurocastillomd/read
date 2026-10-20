// One-time setup on your own free Cloudflare account. Run: npm run setup
//
// 1. Signs you in to Cloudflare (a browser window opens).
// 2. Creates a D1 database and a Workers KV namespace for your library.
// 3. Builds and deploys read. as a Worker.
// 4. Saves your Anthropic API key and two generated secrets on the Worker.
// 5. Prints your site address and a one-time setup code for choosing a password.
//
// Safe to run again: it reuses what already exists and only fills in what's missing.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";

const configPath = new URL("../deploy.config.json", import.meta.url);
const ask = async (question, fallback = "") => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(question)).trim();
  rl.close();
  return answer || fallback;
};
const run = (args, { input, quiet } = {}) => {
  const result = spawnSync("npx", ["wrangler", ...args], { input, encoding: "utf8", stdio: [input === undefined ? "inherit" : "pipe", quiet ? "pipe" : "inherit", "inherit"] });
  if (result.status !== 0) {
    console.error(`\nwrangler ${args.join(" ")} failed. Fix the message above, then run npm run setup again.`);
    process.exit(result.status ?? 1);
  }
  return result.stdout || "";
};
// Wrangler can print notices before its JSON; parse from the first line that starts it.
const json = (text) => JSON.parse(text.slice(Math.max(0, text.search(/^\s*[[{]/m))));
const step = (text) => console.log(`\n— ${text}`);

step("Signing in to Cloudflare");
const who = spawnSync("npx", ["wrangler", "whoami"], { encoding: "utf8" });
if (who.status !== 0 || /not authenticated/i.test(who.stdout + who.stderr)) run(["login"]);

const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath)) : {};
config.name ||= (await ask("Name for your site (letters, numbers, dashes) [read]: ", "read")).toLowerCase().replace(/[^a-z0-9-]/g, "-");
const dbName = `${config.name}-library`, kvTitle = `${config.name}-files`;

step("Creating your library database (D1)");
let database = json(run(["d1", "list", "--json"], { quiet: true })).find((d) => d.name === dbName);
if (!database) {
  run(["d1", "create", dbName], { quiet: true });
  database = json(run(["d1", "list", "--json"], { quiet: true })).find((d) => d.name === dbName);
}
if (!database) { console.error(`Could not find the database ${dbName} after creating it.`); process.exit(1); }
config.d1 = { binding: "DB", database_name: dbName, database_id: database.uuid || database.id };

step("Creating storage for your books (Workers KV)");
let namespace = json(run(["kv", "namespace", "list"], { quiet: true })).find((n) => n.title === kvTitle);
if (!namespace) {
  run(["kv", "namespace", "create", kvTitle], { quiet: true });
  namespace = json(run(["kv", "namespace", "list"], { quiet: true })).find((n) => n.title === kvTitle);
}
if (!namespace) { console.error(`Could not find the storage ${kvTitle} after creating it.`); process.exit(1); }
config.kv = { binding: "FILES", id: namespace.id };
config.vars ||= {};
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

step("Building and deploying read.");
const build = spawnSync("npm", ["run", "deploy"], { stdio: "inherit" });
if (build.status !== 0) { console.error("\nThe deploy failed. Fix the message above, then run npm run setup again."); process.exit(1); }

step("Saving secrets on your Worker");
const secrets = run(["secret", "list", "--name", config.name], { quiet: true });
const has = (name) => secrets.includes(`"${name}"`);
if (!has("ANTHROPIC_API_KEY")) {
  const key = await ask("Paste your Anthropic API key (from console.anthropic.com → API keys): ");
  if (!key) { console.error("An Anthropic API key is needed to make lessons. Run npm run setup again when you have one."); process.exit(1); }
  run(["secret", "put", "ANTHROPIC_API_KEY", "--name", config.name], { input: key });
}
if (!has("SESSION_SECRET")) run(["secret", "put", "SESSION_SECRET", "--name", config.name], { input: randomBytes(32).toString("base64url") });
let setupCode = "";
if (!has("SETUP_CODE")) {
  setupCode = randomBytes(6).toString("hex");
  run(["secret", "put", "SETUP_CODE", "--name", config.name], { input: setupCode });
}

console.log(`
Done. read. is live on your Cloudflare account.

Open it: https://${config.name}.<your-subdomain>.workers.dev/read
(the exact address is printed in the deploy output above)
${setupCode ? `\nYour one-time setup code: ${setupCode}\nEnter it on first visit, then choose your password.\n` : ""}
Updating later: git pull, then npm run deploy.`);
