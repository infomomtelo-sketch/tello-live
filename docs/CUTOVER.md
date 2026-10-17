# Moving tello.live from the EC Rental Worker to this one

Do this only after the pages the chat links to are ported. Nothing here has been done yet.

1. Deploy this Worker (workers.dev address) and check `/`, a chat message, voice, and feedback.
2. Data: decided to start clean. There are no existing tello.live users, so nothing is migrated from the old D1
   (`ec-rental-db`). `tello-live-db` begins empty from `schema.sql`.
3. Uncomment the `routes` in `wrangler.toml` and deploy. Cloudflare reassigns the custom domain, which fails while the
   other Worker still holds it, so first remove the `tello.live` / `www.tello.live` routes from the ec-rental
   `wrangler.toml` and deploy that.
4. Verify tello.live, then delete the Tello code from ec-rental (`tello-hub`, `biz-*`, `business-pages`,
   `video-maker`, hub/business/make pages) in a separate change.
5. Email: replace the `info@ecrentalpm.com` sender (`EMAIL_FROM`) once tello.live is verified in Resend.
6. Stripe: the old Worker stored its webhook signing secret in its own D1 (`app_settings`). This Worker creates its own
   endpoint for `https://tello.live/api/stripe/webhook` on first checkout and deletes any existing endpoint with the
   same URL, so the old one stops working at that point. Set `STRIPE_SECRET_KEY` as a secret first, and test a checkout
   with a test-mode key before using the live key.
