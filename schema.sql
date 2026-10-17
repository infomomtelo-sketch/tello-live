-- tello.live database. Every statement is CREATE ... IF NOT EXISTS, so it is safe to run on every deploy.
-- Visitor leads from the front-page chat (name/email/phone left by a visitor).
CREATE TABLE IF NOT EXISTS signups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, company TEXT DEFAULT '', email TEXT NOT NULL, phone TEXT NOT NULL, property_count TEXT NOT NULL, plan TEXT NOT NULL, message TEXT DEFAULT '', status TEXT DEFAULT 'pending', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
-- Front-page assistant: daily spend, per-visitor limits and thumbs up/down feedback.
CREATE TABLE IF NOT EXISTS hub_spend (day TEXT PRIMARY KEY, input_tokens INTEGER, output_tokens INTEGER, searches INTEGER, usd_cents INTEGER);
CREATE TABLE IF NOT EXISTS hub_visitors (key TEXT PRIMARY KEY, day TEXT NOT NULL, messages INTEGER NOT NULL DEFAULT 0, attachments INTEGER NOT NULL DEFAULT 0, searches INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_hub_visitors_day ON hub_visitors(day);
CREATE TABLE IF NOT EXISTS hub_feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, vote INTEGER NOT NULL, question TEXT NOT NULL, reply TEXT NOT NULL, created_at TEXT NOT NULL);

-- Business assistants (Tello for your business): bots, leads, usage, photo uploads.
CREATE TABLE IF NOT EXISTS biz_bots (id TEXT PRIMARY KEY, manage_token TEXT NOT NULL UNIQUE, owner_email TEXT NOT NULL, owner_name TEXT DEFAULT '', business TEXT NOT NULL, site_url TEXT DEFAULT '', facts TEXT DEFAULT '', greeting TEXT DEFAULT '', extra TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'trial', trial_ends TEXT NOT NULL, customer_id TEXT, subscription_id TEXT, period_end TEXT, cancel_at_period_end INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_biz_bots_email ON biz_bots(owner_email, created_at);
CREATE TABLE IF NOT EXISTS biz_leads (id INTEGER PRIMARY KEY AUTOINCREMENT, bot_id TEXT NOT NULL, name TEXT DEFAULT '', contact TEXT NOT NULL, message TEXT DEFAULT '', created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_biz_leads_bot ON biz_leads(bot_id, id);
CREATE TABLE IF NOT EXISTS biz_usage (bot_id TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (bot_id, day));
CREATE TABLE IF NOT EXISTS biz_pro (bot_id TEXT PRIMARY KEY, plan TEXT NOT NULL DEFAULT 'starter', audience TEXT DEFAULT '[]', suggestions TEXT DEFAULT '[]', example_q TEXT DEFAULT '', example_a TEXT DEFAULT '', cta TEXT DEFAULT '', updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS biz_lead_done (lead_id INTEGER PRIMARY KEY, bot_id TEXT NOT NULL, done_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_biz_lead_done_bot ON biz_lead_done(bot_id);
CREATE TABLE IF NOT EXISTS biz_settings (bot_id TEXT PRIMARY KEY, uploads INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS biz_files (id TEXT PRIMARY KEY, bot_id TEXT NOT NULL, lead_id INTEGER NOT NULL, r2_key TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_biz_files_lead ON biz_files(lead_id);
CREATE INDEX IF NOT EXISTS idx_biz_files_bot ON biz_files(bot_id, created_at);
CREATE TABLE IF NOT EXISTS biz_link_sends (email TEXT PRIMARY KEY, sent_at TEXT NOT NULL);
