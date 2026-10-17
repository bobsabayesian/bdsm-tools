/**
 * Counts attempts per key in a time window and says whether the limit has been
 * passed. Used to slow down password and invite-code guessing.
 */
export const overLimit = async (db, key, limit, windowMs) => {
  const now = Date.now();
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN reset_at <= ?3 THEN 1 ELSE count + 1 END,
         reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END
       RETURNING count`,
    )
    .bind(key, now + windowMs, now)
    .first();
  return row.count > limit;
};

export const clientIp = (c) => c.req.header('cf-connecting-ip') ?? 'local';

export const tidyRateLimits = (db) =>
  db
    .prepare('DELETE FROM rate_limits WHERE reset_at < ?')
    .bind(Date.now())
    .run();
