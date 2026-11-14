-- Apply after 0001. D1 migrations run this file transactionally.
-- Back up child rows explicitly: DROP of the old parent cascades even with deferred FKs.
CREATE TABLE accounts_vk_next (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('yandex', 'mailru', 'vk')),
  subject TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE(provider, subject)
);
INSERT INTO accounts_vk_next(id,provider,subject,email,created_at)
  SELECT id,provider,subject,email,created_at FROM accounts;

CREATE TABLE vk_pair_state_backup AS SELECT account_id,data_json,revision,updated_at FROM pair_state;
CREATE TABLE vk_sessions_backup AS SELECT token_hash,account_id,expires_at FROM sessions;

DROP TABLE accounts;
ALTER TABLE accounts_vk_next RENAME TO accounts;

INSERT INTO pair_state(account_id,data_json,revision,updated_at)
  SELECT account_id,data_json,revision,updated_at FROM vk_pair_state_backup;
INSERT INTO sessions(token_hash,account_id,expires_at)
  SELECT token_hash,account_id,expires_at FROM vk_sessions_backup;

DROP TABLE vk_pair_state_backup;
DROP TABLE vk_sessions_backup;
