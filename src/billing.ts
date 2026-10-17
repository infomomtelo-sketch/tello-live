/**
 * Stripe for Green Tello ($19/month after a 7-day trial): the API helper, the webhook (endpoint created by the Worker on
 * first use, signing secret kept in app_settings; STRIPE_WEBHOOK_SECRET overrides it) and Tello's billing portal.
 * Everything stays off until STRIPE_SECRET_KEY is set. Bot plan logic lives in src/biz-bots.ts.
 */
export interface BillingEnv {
  DB: D1Database;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** Only for local tests against a fake Stripe server. */
  STRIPE_API_BASE?: string;
}
type StripeObject = Record<string, any>;

const WEBHOOK_EVENTS = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export function billingEnabled(env: BillingEnv): boolean { return !!env.STRIPE_SECRET_KEY; }
/** Test and live keys get separate webhook and portal settings, so switching keys just works. */
export function keyMode(env: BillingEnv): string { return env.STRIPE_SECRET_KEY!.includes("_live_") ? "live" : "test"; }

/** Flattens {a: {b: 1}, c: [x, y]} into Stripe's form encoding: a[b]=1&c[0]=x&c[1]=y */
function formEncode(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (item !== null && typeof item === "object" ? formEncode(item as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") formEncode(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe(env: BillingEnv, method: "GET" | "POST" | "DELETE", path: string, params: Record<string, unknown> = {}): Promise<StripeObject> {
  const base = env.STRIPE_API_BASE || "https://api.stripe.com";
  const body = formEncode(params).toString();
  const target = method === "GET" && body ? `${base}/v1/${path}?${body}` : `${base}/v1/${path}`;
  const res = await fetch(target, {
    method,
    headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : body,
  });
  const data = await res.json().catch(() => ({})) as StripeObject;
  if (!res.ok) throw new Error(`Stripe ${method} ${path} ${res.status}: ${data?.error?.message || "unknown error"}`);
  return data;
}

export async function getSetting(env: BillingEnv, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}
export async function setSetting(env: BillingEnv, key: string, value: string): Promise<void> {
  await env.DB.prepare("INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(key, value, new Date().toISOString()).run();
}

async function webhookSecrets(env: BillingEnv): Promise<string[]> {
  if (env.STRIPE_WEBHOOK_SECRET) return [env.STRIPE_WEBHOOK_SECRET];
  const rows = await env.DB.prepare("SELECT value FROM app_settings WHERE key LIKE ?").bind(`stripe_webhook:${keyMode(env)}:%`).all<{ value: string }>();
  return rows.results.map((r) => { try { return JSON.parse(r.value).secret as string; } catch { return ""; } }).filter(Boolean);
}

/** Makes sure Stripe will call our webhook, so paid plans are reported back. The signing secret is only shown once, so it is stored when created. */
export async function ensureAnyWebhook(env: BillingEnv, origin: string): Promise<void> {
  if (env.STRIPE_WEBHOOK_SECRET || !origin.startsWith("https://")) return;
  if ((await webhookSecrets(env)).length) return;
  const endpointUrl = origin + "/api/stripe/webhook";
  // An endpoint we cannot read the secret of is useless to us, so replace it.
  const existing = await stripe(env, "GET", "webhook_endpoints", { limit: 100 });
  for (const ep of existing.data || []) if (ep.url === endpointUrl) await stripe(env, "DELETE", "webhook_endpoints/" + ep.id);
  const ep = await stripe(env, "POST", "webhook_endpoints", { url: endpointUrl, enabled_events: WEBHOOK_EVENTS, description: "Tello plans (created by the site)" });
  await setSetting(env, `stripe_webhook:${keyMode(env)}:${endpointUrl}`, JSON.stringify({ id: ep.id, secret: ep.secret }));
}

/** Stripe's customer portal for a Tello subscriber: card, invoices, billing email and cancel. Cancelling there reaches the bot through the webhook. */
export async function telloPortalUrl(env: BillingEnv, customerId: string, returnUrl: string): Promise<string> {
  const settingKey = `stripe_portal_tello:${keyMode(env)}`;
  let conf = await getSetting(env, settingKey);
  if (!conf) {
    const made = await stripe(env, "POST", "billing_portal/configurations", {
      business_profile: { headline: "Tello billing" },
      features: {
        payment_method_update: { enabled: "true" },
        invoice_history: { enabled: "true" },
        customer_update: { enabled: "true", allowed_updates: ["email", "name"] },
        subscription_cancel: { enabled: "true", mode: "at_period_end" },
      },
    });
    conf = made.id as string;
    await setSetting(env, settingKey, conf);
  }
  const session = await stripe(env, "POST", "billing_portal/sessions", { customer: customerId, configuration: conf, return_url: returnUrl });
  return session.url as string;
}

export async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(",").map((p) => p.split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - parseInt(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  const expected = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === expected.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

/** POST /api/stripe/webhook. Public; trusted only through the Stripe-Signature header. */
export async function handleStripeWebhook(request: Request, env: BillingEnv, onEvent: (event: StripeObject) => Promise<boolean>): Promise<Response> {
  if (!billingEnabled(env)) return json({ error: "Billing is not set up" }, 404);
  const payload = await request.text();
  const header = request.headers.get("Stripe-Signature") || "";
  let ok = false;
  for (const secret of await webhookSecrets(env)) if (await verifySignature(payload, header, secret)) { ok = true; break; }
  if (!ok) return json({ error: "Bad signature" }, 400);
  await onEvent(JSON.parse(payload) as StripeObject);
  return json({ received: true });
}
