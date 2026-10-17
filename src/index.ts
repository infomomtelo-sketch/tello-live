/**
 * tello.live Worker. The front page is the Tello chat (public/hub.html); /api/public/tello-hub/* is its API.
 * Pages for /business, /make and the rest are ported one at a time (see README.md).
 */
import { type HubEnv } from "./tello-hub";
import { handleVideoMaker } from "./video-maker";
import { handleBizBots, handleBotStripeEvent } from "./biz-bots";
import { handleStripeWebhook, type BillingEnv } from "./billing";
import { runGreenBriefings } from "./biz-green";

interface Env extends HubEnv, BillingEnv {
  ASSETS: Fetcher;
  PHOTOS?: R2Bucket;
  CHAT_LIMITER?: RateLimit;
  RESEND_API_KEY?: string;
  EMAIL_FROM: string;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const clientIp = (request: Request) => request.headers.get("CF-Connecting-IP") || "unknown";
/** True when the caller is under the limit. A missing binding (local dev) never blocks. */
async function underLimit(limiter: RateLimit | undefined, key: string): Promise<boolean> {
  if (!limiter) return true;
  return (await limiter.limit({ key })).success;
}

async function sendEmail(env: Env, to: string, subject: string, html: string, text: string, replyTo?: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) { console.warn("RESEND_API_KEY not set; email to " + to + " not sent"); return false; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) console.error("Resend " + res.status + ": " + (await res.text()));
  return res.ok;
}

// The Terms and Privacy Policy that currently cover tello.live are published by EC Rental Property Management LLC.
const LEGAL: Record<string, string> = { "/privacy": "https://ecrentalpm.com/privacy", "/terms": "https://ecrentalpm.com/terms" };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const get = request.method === "GET" || request.method === "HEAD";

    if (url.protocol === "http:" && get && /(^|\.)tello\.live$/.test(url.hostname)) { url.protocol = "https:"; return Response.redirect(url.toString(), 301); }
    if (url.hostname === "www.tello.live" && get) { url.hostname = "tello.live"; return Response.redirect(url.toString(), 301); }
    if (get && LEGAL[url.pathname]) return Response.redirect(LEGAL[url.pathname], 302);
    if (get && (url.pathname === "/ask" || url.pathname === "/hub" || url.pathname === "/hub.html")) { url.pathname = "/"; return Response.redirect(url.toString(), 301); }
    // Business pages: the hosted chat for one business is /b/<id>, served by the same static page for every id.
    if (get && /^\/b\/[a-f0-9]{10}$/.test(url.pathname)) return env.ASSETS.fetch(new Request(new URL("/b", url).toString(), request));
    if (get && url.pathname === "/business.html") { url.pathname = "/business"; return Response.redirect(url.toString(), 301); }
    // The website builder inside tello.live is OwnSite's own page, served here so owners never leave tello.live.
    if (get && url.pathname === "/build") {
      try {
        const r = await fetch("https://ownsite.app/", { cf: { cacheTtl: 300, cacheEverything: true } } as RequestInit);
        if (r.ok) return new Response(request.method === "HEAD" ? null : r.body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex" } });
      } catch (err) { console.error("[build]", err instanceof Error ? err.message : err); }
      return Response.redirect("https://ownsite.app/" + url.search, 302);
    }
    // The chat is the front page.
    if (get && url.pathname === "/") return env.ASSETS.fetch(new Request(new URL("/hub", url).toString(), request));

    if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
      try { return await handleStripeWebhook(request, env, (event) => handleBotStripeEvent(env, event)); }
      catch (err) { console.error("[stripe-webhook]", err instanceof Error ? err.message : err); return json({ error: "Webhook failed" }, 500); }
    }

    if (url.pathname.startsWith("/api/") || /^\/embed\//.test(url.pathname)) {
      const allow = () => underLimit(env.CHAT_LIMITER, "ip:" + clientIp(request));
      const notify = (to: string, subject: string, html: string, text: string, replyTo?: string) => sendEmail(env, to, subject, html, text, replyTo || "support@tello.live");
      try {
        // The hub chat (/api/public/tello-hub/*), business assistants (/api/public/bots*, /api/biz/*) and /embed/<id>.js.
        const biz = await handleBizBots(request, env, url, allow, notify);
        if (biz) return biz;
        const maker = await handleVideoMaker(request, env, url);
        if (maker) return maker;
      } catch (err) {
        console.error("[api]", err instanceof Error ? err.message : err);
        return json({ error: "Something went wrong. Please try again." }, 500);
      }
      return json({ error: "Not found." }, 404);
    }
    return env.ASSETS.fetch(request);
  },

  // Daily cron (wrangler.toml [triggers]): each Green Tello owner's morning briefing.
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const notify = (to: string, subject: string, html: string, text: string, replyTo?: string) => sendEmail(env, to, subject, html, text, replyTo || "support@tello.live");
    ctx.waitUntil(runGreenBriefings(env, notify, "https://tello.live")
      .then((n) => console.log("[green-briefings] sent", n))
      .catch((err) => console.error("[green-briefings]", err instanceof Error ? err.message : err)));
  },
};
