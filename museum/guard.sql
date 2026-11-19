-- Only this singleton belongs to the museum. No changes to story tables.
-- Start disabled; enabling production requires a separate release approval.
CREATE TABLE IF NOT EXISTS aimes_museum_guard (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  hour_key INTEGER NOT NULL DEFAULT 0,
  hour_used INTEGER NOT NULL DEFAULT 0,
  day_key INTEGER NOT NULL DEFAULT 0,
  day_used INTEGER NOT NULL DEFAULT 0,
  hour_limit INTEGER NOT NULL DEFAULT 200 CHECK (hour_limit BETWEEN 1 AND 200),
  day_limit INTEGER NOT NULL DEFAULT 600 CHECK (day_limit BETWEEN 1 AND 600),
  retry_until INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO aimes_museum_guard (id) VALUES (1);
