PRAGMA foreign_keys = ON;
-- Durable delivery log for server-to-server CTT integration; does not alter existing submissions.
CREATE TABLE IF NOT EXISTS ctt_integration_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_code TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sent','failed','not_configured')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_http_status INTEGER,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ctt_outbox_state ON ctt_integration_outbox(state,updated_at);
