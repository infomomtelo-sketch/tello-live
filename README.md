# tello.live

The Tello front door: a free AI assistant for small business. Cloudflare Worker + static assets + D1.

Split out of `ec-rental-landing-page` (where tello.live was a second hostname on the EC Rental Worker). This repo is
Tello only: its own Worker, database, budgets and deploys.

## Status

| Area | State |
| --- | --- |
| Chat front page (`/`, `public/hub.html`, `src/tello-hub.ts`) | Ported |
| Free video maker API (`src/video-maker.ts`, voice) | Ported (API only) |
| `/business`, hosted chat `/b/<id>`, `/embed/<id>.js`, `/business/manage`, `/install`, `/models` | Ported (`src/biz-bots.ts`, `src/biz-green.ts`, `src/billing.ts`) |
| Green Tello billing (Stripe checkout, webhook, portal) and the daily briefing cron | Ported, untested against live Stripe |
| `/build` | Ported (proxies ownsite.app) |
| Meet Tello page `/m/<id>` (old Pro plan, no longer sold) | Not ported |
| `/make`, `/videos` (Tello business videos only), `/website`, `/social-setup`, video requests | Ported |
| `/meeting` (talking demo that also calls the EC Rental chat), SEO how-to guides, sitemap, `llms.txt`, page-view counter | Not ported |
| Own Privacy / Terms | Not written: `/privacy` and `/terms` redirect to ecrentalpm.com |
| Domain tello.live | Still served by the ec-rental Worker. See `docs/CUTOVER.md` |

The chat and `/business` link to `/meeting`, which is not here yet, so do not cut the domain over until
those are ported (or the links are removed).

## Develop

```
npm install
npx wrangler d1 execute tello-live-db --local --file=schema.sql
npm run dev          # http://localhost:8787
npm run typecheck
```

Without `ANTHROPIC_API_KEY` or the AI binding the chat answers "could not answer"; put keys in `.dev.vars`.

## Deploy

Push to `main`. `.github/workflows/deploy.yml` needs the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`,
and optionally `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `DEEPINFRA_API_KEY`.
Daily AI spend caps are in `wrangler.toml` (`HUB_DAILY_CENTS` etc.).
