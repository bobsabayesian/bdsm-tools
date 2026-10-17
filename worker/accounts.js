import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomToken, sha256Hex } from './passwords';

const SESSION_COOKIE = 'session';
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVITY_GRANULARITY_MS = 60 * 1000;

const cookieOptions = (c) => ({
  path: '/',
  httpOnly: true,
  sameSite: 'Lax',
  secure: new URL(c.req.url).protocol === 'https:',
});

/** Log a user in: creates a session and sets the cookie */
export const startSession = async (c, userId) => {
  const token = randomToken();
  await c.env.DB.prepare(
    'INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(
      await sha256Hex(token),
      userId,
      new Date().toISOString(),
      Date.now() + SESSION_LIFETIME_MS,
    )
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    ...cookieOptions(c),
    maxAge: SESSION_LIFETIME_MS / 1000,
  });
};

export const endSession = async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await c.env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
      .bind(await sha256Hex(token))
      .run();
  }
  deleteCookie(c, SESSION_COOKIE, cookieOptions(c));
};

/** The logged-in user ({ id, username }) or null. Also records activity. */
export const currentUser = async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;

  const db = c.env.DB;
  const row = await db
    .prepare(
      `SELECT u.id, u.username, u.last_active_at
       FROM auth_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.deleted_at IS NULL`,
    )
    .bind(await sha256Hex(token), Date.now())
    .first();
  if (!row) return null;

  // "Last active" is shown to the people in someone's dynamics; one-minute
  // precision is plenty and saves a write on every request
  const now = new Date();
  if (now - new Date(row.last_active_at) > ACTIVITY_GRANULARITY_MS) {
    await db
      .prepare('UPDATE users SET last_active_at = ? WHERE id = ?')
      .bind(now.toISOString(), row.id)
      .run();
  }
  return { id: row.id, username: row.username };
};

export const requireUser = async (c, next) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'Please log in' }, 401);
  c.set('user', user);
  await next();
};

/**
 * Account routes only accept JSON bodies. Together with SameSite=Lax cookies
 * this means another website cannot make a logged-in browser change anything.
 */
export const requireJson = async (c, next) => {
  const method = c.req.method;
  if (method !== 'GET' && method !== 'HEAD') {
    const type = c.req.header('content-type') ?? '';
    const hasBody = (c.req.header('content-length') ?? '0') !== '0';
    if (hasBody && !type.startsWith('application/json')) {
      return c.json({ error: 'Content-Type must be application/json' }, 415);
    }
  }
  await next();
};

export const noStore = async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
};
