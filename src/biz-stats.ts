// Counts how many owners use the Today card and the lunch line, so eli can see whether anyone sees them before selling
// restaurant picks. One row per owner, event and day in biz_usage (day "ev-<event>-<date>"), so a count is unique owners
// per day and refreshing the page cannot inflate it. No schema change. A summary goes to support@tello.live on Mondays.
interface StatsEnv { DB: D1Database }
type Notify = (to: string, subject: string, html: string, text: string, replyTo?: string) => Promise<unknown>;

export const EVENTS = ["today_view", "lunch_shown", "lunch_heard", "lunch_tap"] as const;
const LABEL: Record<(typeof EVENTS)[number], string> = { today_view: "Opened Today", lunch_shown: "Saw the lunch line", lunch_heard: "Heard Tello say it", lunch_tap: "Tapped an order button" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const dayOf = (d: Date) => d.toISOString().slice(0, 10);

export async function recordEvent(env: StatsEnv, botId: string, event: unknown, now = new Date()): Promise<Response> {
  if (typeof event !== "string" || !(EVENTS as readonly string[]).includes(event)) return json({ error: "Unknown event." }, 400);
  await env.DB.prepare("INSERT OR IGNORE INTO biz_usage (bot_id, day, n) VALUES (?, ?, 1)").bind(botId, `ev-${event}-${dayOf(now)}`).run();
  return json({ success: true });
}

/** Unique owners per event for each of the last 7 days, oldest first, plus the total number of owners. */
export async function weekCounts(env: StatsEnv, now = new Date()) {
  const days = Array.from({ length: 7 }, (_, i) => dayOf(new Date(now.getTime() - (6 - i) * 864e5)));
  const rows = (await env.DB.prepare("SELECT day, COUNT(*) AS n FROM biz_usage WHERE day LIKE 'ev-%' AND substr(day, -10) >= ? GROUP BY day").bind(days[0]).all<{ day: string; n: number }>()).results || [];
  const by = new Map(rows.map((r) => [r.day, r.n]));
  const owners = (await env.DB.prepare("SELECT COUNT(*) AS n FROM biz_bots").first<{ n: number }>())?.n ?? 0;
  return { days, owners, events: EVENTS.map((e) => ({ event: e, label: LABEL[e], perDay: days.map((d) => by.get(`ev-${e}-${d}`) ?? 0) })) };
}

/** Monday summary email (the daily cron runs at 16:00 UTC). */
export async function sendWeeklyStats(env: StatsEnv, notify: Notify, now = new Date()): Promise<boolean> {
  if (now.getUTCDay() !== 1) return false;
  const w = await weekCounts(env, now);
  const head = w.days.map((d) => d.slice(5)).join(" | ");
  const text = `Tello owners in total: ${w.owners}\nUnique owners per day, ${w.days[0]} to ${w.days[6]} (${head}):\n\n`
    + w.events.map((e) => `${e.label}: ${e.perDay.join(" | ")}`).join("\n");
  const cell = "padding:4px 8px;border-bottom:1px solid #ddd;text-align:right";
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a"><p>Tello owners in total: <strong>${w.owners}</strong>. Unique owners per day:</p>`
    + `<table style="border-collapse:collapse;font-size:14px"><tr><th style="${cell};text-align:left"></th>${w.days.map((d) => `<th style="${cell}">${d.slice(5)}</th>`).join("")}</tr>`
    + w.events.map((e) => `<tr><td style="${cell};text-align:left">${e.label}</td>${e.perDay.map((n) => `<td style="${cell}">${n}</td>`).join("")}</tr>`).join("")
    + `</table><p style="color:#666;font-size:12px">Sent every Monday by the tello.live Worker.</p></div>`;
  await notify("support@tello.live", `Tello weekly: ${w.owners} owners, ${w.events[0].perDay.reduce((a, b) => a + b, 0)} Today opens`, html, text);
  return true;
}
