# tello.live

Cloudflare Worker (`src/index.ts`) + static site (`public/`) + D1 (`schema.sql`, idempotent).

- Chat assistant: `src/tello-hub.ts` serves `/api/public/tello-hub/*`; UI is `public/hub.html` + `public/js/tello-*.js`.
- Tone rule for the chat: calm, precise, professional; no exclamation marks, emojis or filler openers.
- This is a split from `infomomtelo-sketch/ec-rental-landing-page`. Do not reintroduce EC Rental (rental) code or branding here.
- Check with `npm run typecheck`; run locally with `npm run dev`.
- Do not enable the `routes` in `wrangler.toml` without the user's go-ahead: it moves the live tello.live domain.
