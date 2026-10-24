// Deploys the built app to your own Cloudflare account.
// Usage: npm run deploy  (runs the build first; needs deploy.config.json from npm run setup)
//        node scripts/deploy.mjs --dry-run
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const configPath = new URL("../deploy.config.json", import.meta.url);
if (!existsSync(configPath)) {
  console.error("deploy.config.json is missing. Run npm run setup first (see README.md).");
  process.exit(1);
}
const config = JSON.parse(readFileSync(configPath));
const builtPath = new URL("../dist/server/wrangler.json", import.meta.url);
const deployPath = new URL("../dist/server/wrangler.deploy.json", import.meta.url);
const built = JSON.parse(readFileSync(builtPath));

const deploy = {
  ...built,
  name: config.name,
  topLevelName: config.name,
  d1_databases: [{ ...config.d1, migrations_dir: "../../drizzle" }],
  // Library files go to Workers KV (free plan, no card) instead of R2.
  r2_buckets: [],
  kv_namespaces: [config.kv],
  // Sign-in guesses are capped (build/owner-auth.ts). Old versions stay off the web.
  ratelimits: [{ name: "SIGN_IN_LIMIT", namespace_id: "1001", simple: { limit: 10, period: 60 } }],
  preview_urls: false,
  vars: { ...built.vars, ...config.vars },
};
writeFileSync(deployPath, JSON.stringify(deploy, null, 2));

const wrangler = (...args) => {
  const result = spawnSync("npx", ["wrangler", ...args, "--config", "dist/server/wrangler.deploy.json"], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
const dryRun = process.argv.includes("--dry-run");
if (!dryRun) wrangler("d1", "migrations", "apply", config.d1.binding, "--remote");
wrangler("deploy", ...(dryRun ? ["--dry-run"] : []));
