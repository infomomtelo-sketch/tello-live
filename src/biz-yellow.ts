// Yellow Tello: the Reviews add-on, $9 a month. A separate Stripe subscription from Green Tello, so an owner can have
// either or both; Green Tello includes Reviews. Its state lives in app_settings ("yellow:<bot id>"), so no schema change.
// Stripe sends every account event to every endpoint, so subscriptions carry metadata.plan = "yellow" and the Green
// handler leaves them alone.
import { stripe, telloPortalUrl, ensureAnyWebhook, billingEnabled, type BillingEnv } from "./billing";

export const YELLOW_PRICE = { cents: 900 };
const GOOD = ["active", "trialing", "past_due"];
interface YellowBot { id: string; business: string; owner_email: string; manage_token: string; status: string }
export interface YellowState { sub: string; status: string; customer: string; period_end: string | null; cancel: boolean }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const key = (botId: string) => `yellow:${botId}`;

export async function getYellow(env: { DB: D1Database }, botId: string): Promise<YellowState | null> {
  const v = (await env.DB.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key(botId)).first<{ value: string }>())?.value;
  try { return v ? JSON.parse(v) as YellowState : null; } catch { return null; }
}
export const yellowOn = (y: YellowState | null) => !!y && GOOD.includes(y.status);
/** Reviews come with Yellow Tello or Green Tello. */
export async function hasReviews(env: { DB: D1Database }, bot: Pick<YellowBot, "id" | "status">): Promise<boolean> {
  return GOOD.includes(bot.status) || yellowOn(await getYellow(env, bot.id));
}

export async function applyYellowSub(env: { DB: D1Database }, sub: Record<string, any>, botId: string): Promise<void> {
  const cur = await getYellow(env, botId);
  if (cur && cur.sub !== sub.id && GOOD.includes(cur.status) && !GOOD.includes(sub.status)) return; // an older, ended subscription
  const pe = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  const state: YellowState = { sub: String(sub.id), status: String(sub.status), customer: String(sub.customer || cur?.customer || ""), period_end: typeof pe === "number" ? new Date(pe * 1000).toISOString() : null, cancel: !!sub.cancel_at_period_end };
  await env.DB.prepare("INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(key(botId), JSON.stringify(state), new Date().toISOString()).run();
}

export async function handleYellow(env: BillingEnv & { DB: D1Database }, bot: YellowBot, sub: string, origin: string, cs?: string): Promise<Response | null> {
  const back = `${origin}/business/manage?t=${bot.manage_token}`;
  if (sub === "/yellow-checkout") {
    if (!billingEnabled(env)) return json({ error: "Billing is not available yet." }, 503);
    if (GOOD.includes(bot.status)) return json({ error: "Reviews are already included in your Green Tello." }, 400);
    if (yellowOn(await getYellow(env, bot.id))) return json({ error: "Yellow Tello is already on." }, 400);
    await ensureAnyWebhook(env, origin);
    const session = await stripe(env, "POST", "checkout/sessions", {
      mode: "subscription", customer_email: bot.owner_email, client_reference_id: bot.id,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: YELLOW_PRICE.cents, recurring: { interval: "month" }, product_data: { name: `Yellow Tello (Reviews) for ${bot.business}` } } }],
      subscription_data: { metadata: { bot_id: bot.id, plan: "yellow" } }, metadata: { bot_id: bot.id, plan: "yellow" }, allow_promotion_codes: "true",
      success_url: `${back}&billing=yellow&ys={CHECKOUT_SESSION_ID}`, cancel_url: `${back}&billing=canceled`,
    });
    return json({ url: session.url });
  }
  // Coming back from Checkout: confirm with Stripe right away so the page never shows a stale "Start Yellow Tello".
  if (sub === "/yellow-confirm" && cs && /^cs_[A-Za-z0-9_]{8,}$/.test(cs) && billingEnabled(env)) {
    const s = await stripe(env, "GET", "checkout/sessions/" + cs);
    if (s.client_reference_id === bot.id && s.mode === "subscription" && s.subscription && s.metadata?.plan === "yellow") await applyYellowSub(env, await stripe(env, "GET", "subscriptions/" + s.subscription), bot.id);
    return json({ success: true });
  }
  if (sub === "/yellow-portal") {
    const y = await getYellow(env, bot.id);
    if (!y?.customer || !billingEnabled(env)) return json({ error: "Start Yellow Tello first." }, 400);
    try { return json({ url: await telloPortalUrl(env, y.customer, back + "&billing=portal") }); }
    catch (err) { console.error("[yellow portal]", err instanceof Error ? err.message : err); return json({ error: "Billing could not open just now. Please try again, or email support@tello.live." }, 502); }
  }
  return null;
}
