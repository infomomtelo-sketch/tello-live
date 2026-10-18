# Moving tello.live from the EC Rental Worker to this one

Both Workers use the same D1 database (`ec-rental-db`) and R2 bucket (`ec-rental-photos`) for now, so every business
assistant, lead, upload and Green Tello subscription carries over with nothing to migrate. The Tello tables
(`biz_*`, `hub_*`) move to a database of their own in a later step.

1. Deploy this Worker to `https://tello-live.infomomtelo.workers.dev`. Until this repo has its own
   `CLOUDFLARE_API_TOKEN` secret, the ec-rental repo's "Deploy tello-live" workflow does it and copies the shared keys.
   `scripts/smoke.sh` checks the pages and `/api/health` after each deploy.
2. Cutover, in this order:
   - ec-rental: remove the `tello.live` / `www.tello.live` routes and the Green Tello briefing from its cron, and deploy.
   - Here: uncomment the `routes` and the `[triggers]` cron in `wrangler.toml` and deploy. Cloudflare moves the
     custom domain (it fails while the other Worker still holds it).
   - Check tello.live with `scripts/smoke.sh https://tello.live`.
3. Stripe: the first daily cron (or the first checkout) after cutover creates this Worker's own endpoint for
   `https://tello.live/api/stripe/webhook`. Until then, plan changes keep arriving at EC Rental's endpoint, which still
   updates the shared `biz_bots` rows. The ec-rental webhook must keep skipping events with a `bot_id` in their metadata.
4. After tello.live is verified, delete the Tello code from ec-rental (`tello-hub`, `biz-*`, `video-*`,
   `website-request`, `site-reader`, the hub/business/make/videos pages) in a separate change.
5. Email: replace the `info@ecrentalpm.com` sender (`EMAIL_FROM`) once tello.live is verified in Resend.
6. Later: copy the `biz_*` and `hub_*` tables to a `tello-live-db` database and point `wrangler.toml` at it.
