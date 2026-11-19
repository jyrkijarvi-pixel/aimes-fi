// One shared row, primary D1 reads and an atomic reservation before each API call.
// No per-visitor data or search terms are stored in D1.
export const reserveSql = `UPDATE aimes_museum_guard SET
  hour_used = CASE WHEN hour_key = ?1 THEN hour_used + 1 ELSE 1 END,
  hour_key = ?1,
  day_used = CASE WHEN day_key = ?2 THEN day_used + 1 ELSE 1 END,
  day_key = ?2
  WHERE id = 1 AND enabled = 1 AND retry_until <= ?3
    AND (hour_key != ?1 OR hour_used < hour_limit)
    AND (day_key != ?2 OR day_used < day_limit)
  RETURNING id`;

export async function control(db) {
  if (!db) throw new Error('configuration');
  const state = await db.prepare('SELECT * FROM aimes_museum_guard WHERE id = 1').first();
  if (!state || state.enabled !== 1) throw new Error('configuration');
  return state;
}
export function retrySeconds(state, now = Date.now()) {
  const hour = Math.floor(now / 3600000), day = Math.floor(now / 86400000);
  const until = Math.max(state.retry_until || 0,
    state.day_key === day && state.day_used >= state.day_limit ? (day + 1) * 86400000 : 0,
    state.hour_key === hour && state.hour_used >= state.hour_limit ? (hour + 1) * 3600000 : 0);
  return Math.max(0, Math.ceil((until - now) / 1000));
}
export async function reserve(db, now = Date.now()) {
  const row = await db.prepare(reserveSql).bind(Math.floor(now / 3600000), Math.floor(now / 86400000), now).first();
  if (row) return;
  const state = await control(db);
  throw Object.assign(new Error('limit'), { retryAfter: Math.max(1, retrySeconds(state, now)) });
}
export function cooldown(db, seconds) {
  return db.prepare('UPDATE aimes_museum_guard SET retry_until = MAX(retry_until, ?1) WHERE id = 1').bind(Date.now() + seconds * 1000).run();
}
