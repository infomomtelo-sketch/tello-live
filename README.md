# tello.live

The Tello front door: a free AI assistant for small business. Cloudflare Worker + static assets + D1.

Split out of `ec-rental-landing-page` (where tello.live was a second hostname on the EC Rental Worker). This repo is
Tello only: its own Worker, budgets and deploys. It shares EC Rental's D1 database for now (see `docs/CUTOVER.md`).

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
| How-to guide pages (6), `sitemap.xml`, `llms.txt`, `robots.txt` | Ported (static files) |
| `/meeting` (talking demo; its Rentals persona calls the EC Rental chat, so it is held back and removed from the menus and the chat's links until reworked), page-view counter | Not ported |
| Own Privacy / Terms | Not written: `/privacy` and `/terms` redirect to ecrentalpm.com |
| Domain tello.live | Still served by the ec-rental Worker. See `docs/CUTOVER.md` |

Every internal link on the site now points at a page or route that exists. Before moving the domain: test the Stripe
checkout with a test key, deploy to the workers.dev address and click through it, and decide on Tello's own
Privacy and Terms.

## Develop

```
npm install
npx wrangler d1 execute ec-rental-db --local --file=schema.sql
npm run dev          # http://localhost:8787
npm run typecheck
```

Without `ANTHROPIC_API_KEY` or the AI binding the chat answers "could not answer"; put keys in `.dev.vars`.

## Deploy

Push to `main`. `.github/workflows/deploy.yml` needs the secret `CLOUDFLARE_API_TOKEN` (the account id is built in),
and optionally `STRIPE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `DEEPINFRA_API_KEY`.
Daily AI spend caps are in `wrangler.toml` (`HUB_DAILY_CENTS` etc.).

## Product facts the chat relies on

The chat's product facts (`HUB_SYSTEM` in `src/tello-hub.ts`) and the pages must match the products:

- Business chat and Green Tello: prices, 7-day trial, 50/300 message caps and Confirm-only actions are checked against `src/biz-bots.ts` and `src/biz-green.ts`.
- EC Rental (ecrentalpm.com): Solo $29 with the $3-for-3-months offer through 2026-12-31; Green Tello included in every plan.
- Gold Tello is coming soon; nothing in the code implements it.
