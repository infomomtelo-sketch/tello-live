-- tello.live database. Every statement is CREATE ... IF NOT EXISTS, so it is safe to run on every deploy.
-- Visitor leads from the front-page chat (name/email/phone left by a visitor).
CREATE TABLE IF NOT EXISTS signups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, company TEXT DEFAULT '', email TEXT NOT NULL, phone TEXT NOT NULL, property_count TEXT NOT NULL, plan TEXT NOT NULL, message TEXT DEFAULT '', status TEXT DEFAULT 'pending', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
-- Front-page assistant: daily spend, per-visitor limits and thumbs up/down feedback.
CREATE TABLE IF NOT EXISTS hub_spend (day TEXT PRIMARY KEY, input_tokens INTEGER, output_tokens INTEGER, searches INTEGER, usd_cents INTEGER);
CREATE TABLE IF NOT EXISTS hub_visitors (key TEXT PRIMARY KEY, day TEXT NOT NULL, messages INTEGER NOT NULL DEFAULT 0, attachments INTEGER NOT NULL DEFAULT 0, searches INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_hub_visitors_day ON hub_visitors(day);
CREATE TABLE IF NOT EXISTS hub_feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, vote INTEGER NOT NULL, question TEXT NOT NULL, reply TEXT NOT NULL, created_at TEXT NOT NULL);
