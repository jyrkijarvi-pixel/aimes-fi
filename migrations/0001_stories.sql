CREATE TABLE IF NOT EXISTS stories (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, kind TEXT NOT NULL,
 title TEXT NOT NULL, body TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '', place TEXT NOT NULL DEFAULT '',
 language TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', consent_version TEXT NOT NULL,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS stories_public ON stories(status, updated_at DESC);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);

CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(expires_at);
