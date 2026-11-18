/**
 * Free video share links (tello.live/make): POST /api/public/video-share uploads a
 * recorded MP4/WebM (max 10 MB) to R2 and returns a public link; GET /v/<key> serves
 * it back with Range support (Safari will not play video without it).
 * No account, no payment. A link is permanent and public — anyone with the link
 * can watch the video — so the maker only uploads when the visitor taps
 * "Copy link". Nothing is uploaded by building or downloading a video.
 */

const MAX_BYTES = 10 * 1024 * 1024;
const KEY_RE = /^[0-9a-f]{32}\.(mp4|webm)$/;
const UPLOADS_PER_HOUR = 5;

const hits = new Map<string, number[]>(); // best-effort per-IP limiter (per isolate)

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function limited(ip: string): boolean {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (list.length >= UPLOADS_PER_HOUR) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 500) for (const k of hits.keys()) { hits.delete(k); if (hits.size < 250) break; }
  return false;
}

function randKey(ext: string): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("") + "." + ext;
}

function rangeResponse(request: Request, body: ArrayBuffer, type: string): Response {
  const size = body.byteLength;
  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000" };
  const m = (request.headers.get("Range") || "").match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === "" && m[2] === "")) {
    return new Response(request.method === "HEAD" ? null : body, { headers: { ...headers, "Content-Length": String(size) } });
  }
  let start: number, end: number;
  if (m[1] === "") { start = Math.max(0, size - parseInt(m[2])); end = size - 1; }
  else { start = parseInt(m[1]); end = m[2] === "" ? size - 1 : Math.min(parseInt(m[2]), size - 1); }
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(request.method === "HEAD" ? null : body.slice(start, end + 1), {
    status: 206,
    headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
  });
}

/** POST /api/public/video-share. Returns {url} or null for anything else. */
export async function handleVideoSharePost(request: Request, env: { PHOTOS?: R2Bucket }, url: URL): Promise<Response | null> {
  if (url.pathname !== "/api/public/video-share") return null;
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  const ctype = (request.headers.get("Content-Type") || "").split(";")[0].trim();
  if (ctype !== "video/mp4" && ctype !== "video/webm") return json({ error: "Send a video file (MP4 or WebM)." }, 400);
  const ip = request.headers.get("CF-Connecting-IP") || "x";
  if (limited(ip)) return json({ error: "Too many uploads. Please try again later." }, 429);
  if (!env.PHOTOS) return json({ error: "Sharing is not switched on yet." }, 503);
  const buf = await request.arrayBuffer();
  if (buf.byteLength < 1000 || buf.byteLength > MAX_BYTES) return json({ error: "That video is too big to share (10 MB max)." }, 413);
  const ext = ctype === "video/mp4" ? "mp4" : "webm";
  const key = "videos/" + randKey(ext);
  await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: ctype, cacheControl: "public, max-age=31536000" } });
  return json({ url: new URL(request.url).origin + "/v/" + key.slice("videos/".length) });
}

/** GET /v/<32 hex>.<mp4|webm>. Returns null unless the path is a share link. */
export async function handleVideoShareGet(request: Request, env: { PHOTOS?: R2Bucket }, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith("/v/") || (request.method !== "GET" && request.method !== "HEAD")) return null;
  const name = url.pathname.slice(3);
  if (!KEY_RE.test(name)) return null;
  if (!env.PHOTOS) return json({ error: "Sharing is not switched on yet." }, 503);
  const obj = await env.PHOTOS.get("videos/" + name);
  if (!obj) return new Response("Not found.", { status: 404 });
  const type = obj.httpMetadata?.contentType || (name.endsWith(".mp4") ? "video/mp4" : "video/webm");
  return rangeResponse(request, await obj.arrayBuffer(), type);
}
