# Moving tello.live from the EC Rental Worker to this one

This Worker has its own D1 database (`tello-live-db`) and photo bucket (`tello-live-photos`), created by wrangler on the
first deploy. There are no existing tello.live users, so nothing is migrated: the database starts empty from
`schema.sql`. The EC Rental database and bucket are not touched.

1. Deploy to `https://tello-live.infomomtelo.workers.dev` (push to `main`; the repo's `CLOUDFLARE_API_TOKEN` needs
   Workers, D1 and R2 edit permissions). `scripts/smoke.sh` checks the pages and `/api/health` after each deploy.
2. Cutover, in this order:
   - ec-rental: remove the `tello.live` / `www.tello.live` routes and the Green Tello briefing from its cron, and deploy.
   - Here: uncomment the `routes` and the `[triggers]` cron in `wrangler.toml` and deploy. Cloudflare moves the
     custom domain (it fails while the other Worker still holds it).
   - Check tello.live with `scripts/smoke.sh https://tello.live`.
3. Stripe: the first daily cron (or the first checkout) after cutover creates this Worker's own endpoint for
   `https://tello.live/api/stripe/webhook` and deletes any existing endpoint with that URL, so the old one stops working
   at that point. Set `STRIPE_SECRET_KEY` first and test a checkout with a test-mode key before the live key.
4. After tello.live is verified, delete the Tello code from ec-rental (`tello-hub`, `biz-*`, `video-*`,
   `website-request`, `site-reader`, the hub/business/make/videos pages) in a separate change.
5. Email: replace the `info@ecrentalpm.com` sender (`EMAIL_FROM`) once tello.live is verified in Resend.
