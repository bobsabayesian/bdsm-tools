import { getCookie, setCookie } from 'hono/cookie';

const SESSION_COOKIE = 'sessionID';
const SESSION_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000; // ~60 days

/**
 * Anonymous visitor sessions stored in D1. Adds `c.get('session')` (a plain
 * object handlers may mutate) and `c.get('hadSession')`. Changes are saved
 * after the handler runs.
 */
export const session = () => async (c, next) => {
  const db = c.env.DB;
  const existingId = getCookie(c, SESSION_COOKIE);

  let data = {};
  let id = existingId;
  if (id) {
    const row = await db
      .prepare('SELECT data FROM sessions WHERE id = ? AND expires > ?')
      .bind(id, Date.now())
      .first();
    if (row) data = JSON.parse(row.data);
  }

  c.set('hadSession', !!existingId);
  c.set('session', data);
  const before = JSON.stringify(data);

  await next();

  if (!id) {
    id = crypto.randomUUID();
    setCookie(c, SESSION_COOKIE, id, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: new URL(c.req.url).protocol === 'https:',
      maxAge: SESSION_LIFETIME_MS / 1000,
    });
  }

  const after = JSON.stringify(c.get('session'));
  if (after !== before) {
    await db
      .prepare(
        `INSERT INTO sessions (id, data, expires) VALUES (?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET data = excluded.data, expires = excluded.expires`,
      )
      .bind(id, after, Date.now() + SESSION_LIFETIME_MS)
      .run();
  }

  // Occasionally tidy up expired sessions
  if (Math.random() < 0.01) {
    c.executionCtx.waitUntil(
      db
        .prepare('DELETE FROM sessions WHERE expires < ?')
        .bind(Date.now())
        .run(),
    );
  }
};
