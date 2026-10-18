# tello.live

Cloudflare Worker (`src/index.ts`) + static site (`public/`) + D1 (`schema.sql`, idempotent).

- Chat assistant: `src/tello-hub.ts` serves `/api/public/tello-hub/*`; UI is `public/hub.html` + `public/js/tello-*.js`.
- Tone rule for the chat: calm, precise, professional; no exclamation marks, emojis or filler openers.
- This is a split from `infomomtelo-sketch/ec-rental-landing-page`. Do not reintroduce EC Rental (rental) code or branding here.
- Check with `npm run typecheck`; run locally with `npm run dev`.
- Never modify, deploy or push to the Title22 repos (title-22-site, runp8-care, title22-*): they have ongoing engagements and are independent of this repo.
- Do not enable the `routes` in `wrangler.toml` without the user's go-ahead: it moves the live tello.live domain.
- Database: eli decided on 2026-10-18 to keep today's data. This Worker shares EC Rental's D1 (`ec-rental-db`) and R2 (`ec-rental-photos`) until the Tello tables are moved to their own database in a planned step. Do not switch it to an empty database.
