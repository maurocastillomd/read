// Single-owner password sign-in for your own deployment. A valid session cookie
// becomes the oai-authenticated-user-* headers the app reads (app/auth.ts), so
// nothing past this file needs to know how sign-in works.
//
// First visit: enter the setup code `npm run setup` printed, then choose a
// password. Only you can open your library, so nobody else spends your AI key.

const SIGN_IN_PATH = "/signin";
const SIGN_OUT_PATH = "/signout";
const COOKIE = "read_session";
const SESSION_DAYS = 365;
const IDENTITY_PREFIX = "oai-authenticated-user-";

type AuthEnv = { READ_PASSWORD?: string; SESSION_SECRET?: string; SETUP_CODE?: string; OWNER_EMAIL?: string; FILES?: KVNamespace };
const PASSWORD_KEY = "auth/owner-password";
const MIN_PASSWORD = 8;

const encoder = new TextEncoder();

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Compares HMACs of both values so timing never depends on where they differ.
async function sameSecret(secret: string, a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([hmac(secret, a), hmac(secret, b)]);
  return x === y;
}

async function pbkdf2(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 100_000 }, key, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

// The owner's password: a READ_PASSWORD secret if set, else the hash saved on first visit.
async function passwordMatches(env: AuthEnv, secret: string, attempt: string): Promise<boolean> {
  if (env.READ_PASSWORD) return sameSecret(secret, attempt, env.READ_PASSWORD);
  const stored = await env.FILES?.get(PASSWORD_KEY);
  if (!stored) return false;
  const [salt, hash] = stored.split(".");
  return sameSecret(secret, await pbkdf2(attempt, salt), hash);
}

async function passwordIsSet(env: AuthEnv): Promise<boolean> {
  return Boolean(env.READ_PASSWORD || (await env.FILES?.get(PASSWORD_KEY)));
}

async function sessionValue(secret: string): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  return `${expires}.${await hmac(secret, `owner.${expires}`)}`;
}

async function validSession(secret: string, request: Request): Promise<boolean> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!match) return false;
  const [expires, signature] = match[1].split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return sameSecret(secret, signature, await hmac(secret, `owner.${expires}`));
}

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/read";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local" || url.pathname === SIGN_IN_PATH || url.pathname === SIGN_OUT_PATH) return "/read";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/read";
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function signInPage(returnTo: string, error = "", status = 200, setup = false): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>read.</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:18px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:Canvas;color:CanvasText}
form{width:min(320px,calc(100vw - 32px));display:grid;gap:12px}h1{margin:0 0 8px;font-size:32px;letter-spacing:-.02em}
input,button{font:inherit;padding:12px 14px;border-radius:10px;border:1px solid color-mix(in srgb,CanvasText 25%,transparent);background:Canvas;color:CanvasText}
button{background:CanvasText;color:Canvas;border:0;cursor:pointer}p{margin:0;color:#b3261e}p.note{color:inherit;opacity:.75}</style></head>
<body><form method="post" action="${SIGN_IN_PATH}?return_to=${encodeURIComponent(returnTo)}"><h1>read.</h1>
${setup
  ? `<p class="note">Enter the setup code from <code>npm run setup</code>, then choose the password you'll use to open read.</p>
<input name="setup_code" autocomplete="one-time-code" placeholder="Setup code" required autofocus>
<input type="password" name="password" autocomplete="new-password" placeholder="New password (8+ characters)" minlength="${MIN_PASSWORD}" required>
<input type="password" name="confirm" autocomplete="new-password" placeholder="Same password again" minlength="${MIN_PASSWORD}" required>`
  : `<input type="password" name="password" autocomplete="current-password" placeholder="Password" required autofocus>`}
${error ? `<p>${escapeHtml(error)}</p>` : ""}<button type="submit">${setup ? "Save password" : "Open"}</button></form></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function redirect(location: string, cookie?: string): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

/** Returns a Response to send as-is, or the request to pass on to the app. */
export async function ownerAuth(request: Request, env: AuthEnv): Promise<Response | Request> {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) if (name.startsWith(IDENTITY_PREFIX)) headers.delete(name);

  const secret = env.SESSION_SECRET;
  if (!secret) return new Response("read. is not configured yet. Run npm run setup (see README.md).", { status: 503 });

  if (url.pathname === SIGN_OUT_PATH) {
    return redirect(SIGN_IN_PATH, `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  }

  if (url.pathname === SIGN_IN_PATH) {
    const returnTo = safeReturnTo(url.searchParams.get("return_to"));
    const setup = !(await passwordIsSet(env));
    if (setup && (!env.SETUP_CODE || !env.FILES)) return new Response("read. is not configured yet. Run npm run setup (see README.md).", { status: 503 });
    const signedIn = async () => redirect(returnTo, `${COOKIE}=${await sessionValue(secret)}; Path=/; Max-Age=${SESSION_DAYS * 86_400}; HttpOnly; Secure; SameSite=Lax`);
    const refuse = async (message: string) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return signInPage(returnTo, message, 401, setup);
    };
    if (request.method === "POST") {
      const form = await request.formData().catch(() => null);
      const field = (name: string) => String(form?.get(name) ?? "");
      if (setup) {
        if (!(await sameSecret(secret, field("setup_code").trim(), env.SETUP_CODE!))) return refuse("That setup code didn't match.");
        if (field("password").length < MIN_PASSWORD) return refuse(`Use at least ${MIN_PASSWORD} characters.`);
        if (field("password") !== field("confirm")) return refuse("The two passwords didn't match.");
        const salt = crypto.randomUUID();
        await env.FILES!.put(PASSWORD_KEY, `${salt}.${await pbkdf2(field("password"), salt)}`);
        return signedIn();
      }
      if (!(await passwordMatches(env, secret, field("password")))) return refuse("That password didn't match.");
      return signedIn();
    }
    if (!setup && (await validSession(secret, request))) return redirect(returnTo);
    return signInPage(returnTo, "", 200, setup);
  }

  if (await validSession(secret, request)) {
    const email = env.OWNER_EMAIL || "owner@read.local";
    headers.set(`${IDENTITY_PREFIX}id`, "owner");
    headers.set(`${IDENTITY_PREFIX}email`, email);
  }
  return new Request(request, { headers });
}
