PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('yandex', 'mailru')),
  subject TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(provider, subject)
);

CREATE TABLE IF NOT EXISTS pair_state (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  data_json TEXT NOT NULL DEFAULT '{"draft":null,"plans":[],"favorites":[]}',
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS oauth_flows (
  state_hash TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_flows_expiry ON oauth_flows(expires_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
