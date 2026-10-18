// Paying for a business video eli made and the owner approved (tello.live/pay). A one-time Stripe Checkout payment;
// coming back, the page confirms it with Stripe and Tello support gets one email per payment.
// One-time payments carry no bot_id and are not subscriptions, so neither Worker's subscription webhook touches them.
import { billingEnabled, stripe, type BillingEnv } from "./billing";

type Notify = (to: string, subject: string, html: string, text: string, replyTo?: string) => Promise<unknown>;
interface PayEnv extends BillingEnv { DB: D1Database }

const NOTIFY_TO = "support@tello.live";
export const VIDEO_PRICES: Record<string, { cents: number; name: string }> = {
  "30": { cents: 4900, name: "30-second business video" },
  "60": { cents: 9900, name: "60-second business video" },
};
const str = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function handleVideoPay(request: Request, env: PayEnv, url: URL, allow: () => Promise<boolean>, notify?: Notify): Promise<Response | null> {
  if (url.pathname === "/api/public/video-pay" && request.method === "POST") {
    if (!(await allow())) return json({ error: "Too many requests. Please wait a minute and try again." }, 429);
    if (!billingEnabled(env)) return json({ error: "Payments are not available right now. Please email support@tello.live." }, 503);
    const body = await request.json() as Record<string, unknown>;
    const price = VIDEO_PRICES[str(body.length, 4)], business = str(body.business, 120), email = str(body.email, 200);
    if (!price) return json({ error: "Please pick the video you are paying for." }, 400);
    if (!business) return json({ error: "Please enter your business name." }, 400);
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return json({ error: "Please enter your email for the receipt." }, 400);
    const session = await stripe(env, "POST", "checkout/sessions", {
      mode: "payment", customer_email: email, submit_type: "pay",
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: price.cents, product_data: { name: `${price.name} for ${business}` } } }],
      metadata: { kind: "video", length: str(body.length, 4), business },
      payment_intent_data: { metadata: { kind: "video", business } },
      success_url: `${url.origin}/pay?paid={CHECKOUT_SESSION_ID}`, cancel_url: `${url.origin}/pay?canceled=1`,
    });
    return json({ url: session.url });
  }

  if (url.pathname === "/api/public/video-pay/confirm" && request.method === "GET") {
    const cs = url.searchParams.get("cs") || "";
    if (!/^cs_[A-Za-z0-9_]{8,}$/.test(cs) || !billingEnabled(env)) return json({ paid: false });
    const s = await stripe(env, "GET", "checkout/sessions/" + cs);
    const paid = s.mode === "payment" && s.payment_status === "paid" && s.metadata?.kind === "video";
    if (paid && notify) {
      // Once per payment, however often the page is reloaded.
      const first = await env.DB.prepare("INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)").bind("video_paid:" + cs, "1", new Date().toISOString()).run();
      if (first.meta.changes) {
        const lines = [`Business: ${s.metadata.business}`, `Video: ${VIDEO_PRICES[s.metadata.length]?.name || s.metadata.length}`, `Paid: $${(s.amount_total / 100).toFixed(2)}`, `Email: ${s.customer_details?.email || s.customer_email || ""}`];
        try { await notify(NOTIFY_TO, `Video paid: ${s.metadata.business}`, `<p>A business paid for its video on tello.live/pay.</p><p>${lines.map(esc).join("<br>")}</p>`, "A business paid for its video on tello.live/pay.\n\n" + lines.join("\n")); }
        catch (err) { console.error("[video-pay] email", err); }
      }
    }
    return json({ paid, business: paid ? s.metadata.business : undefined });
  }
  return null;
}
