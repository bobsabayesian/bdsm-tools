import { Hono } from 'hono';
import {
  currentUser,
  endSession,
  noStore,
  requireJson,
  requireUser,
  startSession,
} from '../accounts';
import {
  hashPassword,
  normalizeCode,
  randomCode,
  sha256Hex,
  verifyPassword,
} from '../passwords';
import { clientIp, overLimit, tidyRateLimits } from '../ratelimit';

const MINUTE = 60 * 1000;
const USERNAME = /^[a-z0-9][a-z0-9_.-]{2,31}$/i;
const MIN_PASSWORD = 10;
const MAX_PASSWORD = 200;

export const account = new Hono();
account.use('*', noStore, requireJson);

const checkPassword = (password) =>
  typeof password === 'string' &&
  password.length >= MIN_PASSWORD &&
  password.length <= MAX_PASSWORD;

const PASSWORD_RULE = `Password must be ${MIN_PASSWORD}-${MAX_PASSWORD} characters`;

const body = (c) => c.req.json().catch(() => ({}));

// Something to verify against when the username doesn't exist, so a login
// takes the same time either way
// (Created on first use: Workers can't generate random values at startup.)
let dummyHash;
const getDummyHash = () => {
  if (!dummyHash) dummyHash = hashPassword('not-a-real-password');
  return dummyHash;
};

const newRecoveryCode = async () => {
  const code = randomCode(5);
  return { code, hash: await sha256Hex(normalizeCode(code)) };
};

account.get('/me', async (c) => {
  const user = await currentUser(c);
  return user ? c.json({ username: user.username }) : c.json(null);
});

account.post('/signup', async (c) => {
  const db = c.env.DB;
  const { username, password } = await body(c);

  if (typeof username !== 'string' || !USERNAME.test(username)) {
    return c.json(
      {
        error:
          'Username must be 3-32 characters: letters, numbers, dots, dashes or underscores',
      },
      400,
    );
  }
  if (!checkPassword(password)) return c.json({ error: PASSWORD_RULE }, 400);

  if (await overLimit(db, `signup:${clientIp(c)}`, 10, 60 * MINUTE)) {
    return c.json({ error: 'Too many sign-ups. Please try again later.' }, 429);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const recovery = await newRecoveryCode();
  try {
    await db
      .prepare(
        `INSERT INTO users (id, username, password_hash, recovery_hash, created_at, last_active_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, username, await hashPassword(password), recovery.hash, now, now)
      .run();
  } catch (e) {
    if (/UNIQUE constraint failed/.test(e?.message)) {
      return c.json({ error: 'That username is taken' }, 409);
    }
    throw e;
  }

  await startSession(c, id);
  // The recovery code is shown once - only its hash is kept
  return c.json({ username, recoveryCode: recovery.code }, 201);
});

account.post('/login', async (c) => {
  const db = c.env.DB;
  const { username, password } = await body(c);
  if (typeof username !== 'string' || typeof password !== 'string') {
    return c.json({ error: 'Username and password are required' }, 400);
  }

  const tooMany =
    (await overLimit(
      db,
      `login:user:${username.toLowerCase()}`,
      8,
      15 * MINUTE,
    )) || (await overLimit(db, `login:ip:${clientIp(c)}`, 40, 15 * MINUTE));
  if (tooMany) {
    return c.json({ error: 'Too many attempts. Please wait a while.' }, 429);
  }

  const user = await db
    .prepare(
      'SELECT id, username, password_hash FROM users WHERE username = ? AND deleted_at IS NULL',
    )
    .bind(username)
    .first();
  const ok = await verifyPassword(
    password.slice(0, MAX_PASSWORD),
    user ? user.password_hash : await getDummyHash(),
  );
  if (!user || !ok)
    return c.json({ error: 'Incorrect username or password' }, 401);

  await startSession(c, user.id);
  if (Math.random() < 0.02) c.executionCtx.waitUntil(tidyRateLimits(db));
  return c.json({ username: user.username });
});

account.post('/logout', async (c) => {
  await endSession(c);
  return c.body(null, 204);
});

// Forgotten password: needs the recovery code shown at sign-up
account.post('/recover', async (c) => {
  const db = c.env.DB;
  const { username, recoveryCode, newPassword } = await body(c);
  if (typeof username !== 'string' || typeof recoveryCode !== 'string') {
    return c.json({ error: 'Username and recovery code are required' }, 400);
  }
  if (!checkPassword(newPassword)) return c.json({ error: PASSWORD_RULE }, 400);

  if (
    await overLimit(db, `recover:${username.toLowerCase()}`, 5, 60 * MINUTE)
  ) {
    return c.json({ error: 'Too many attempts. Please wait a while.' }, 429);
  }

  const user = await db
    .prepare(
      'SELECT id, recovery_hash FROM users WHERE username = ? AND deleted_at IS NULL',
    )
    .bind(username)
    .first();
  const matches =
    user &&
    user.recovery_hash === (await sha256Hex(normalizeCode(recoveryCode)));
  if (!matches)
    return c.json({ error: 'Incorrect username or recovery code' }, 401);

  // Each recovery code works once; issue a new one and log out everywhere
  const recovery = await newRecoveryCode();
  await db.batch([
    db
      .prepare(
        'UPDATE users SET password_hash = ?, recovery_hash = ? WHERE id = ?',
      )
      .bind(await hashPassword(newPassword), recovery.hash, user.id),
    db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(user.id),
  ]);
  await startSession(c, user.id);
  return c.json({ username, recoveryCode: recovery.code });
});

account.post('/password', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { currentPassword, newPassword } = await body(c);
  if (!checkPassword(newPassword)) return c.json({ error: PASSWORD_RULE }, 400);
  if (
    await overLimit(
      db,
      `login:user:${user.username.toLowerCase()}`,
      8,
      15 * MINUTE,
    )
  ) {
    return c.json({ error: 'Too many attempts. Please wait a while.' }, 429);
  }

  const row = await db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.id)
    .first();
  if (
    typeof currentPassword !== 'string' ||
    !(await verifyPassword(
      currentPassword.slice(0, MAX_PASSWORD),
      row.password_hash,
    ))
  ) {
    return c.json({ error: 'Current password is incorrect' }, 401);
  }

  await db
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(await hashPassword(newPassword), user.id)
    .run();
  return c.body(null, 204);
});

// Deleting an account ends all of its dynamics and removes the personal details.
// The people in those dynamics just see that it ended.
account.delete('/', requireUser, async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { password } = await body(c);

  if (
    await overLimit(
      db,
      `login:user:${user.username.toLowerCase()}`,
      8,
      15 * MINUTE,
    )
  ) {
    return c.json({ error: 'Too many attempts. Please wait a while.' }, 429);
  }
  const row = await db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.id)
    .first();
  if (
    typeof password !== 'string' ||
    !(await verifyPassword(password.slice(0, MAX_PASSWORD), row.password_hash))
  ) {
    return c.json({ error: 'Password is incorrect' }, 401);
  }

  const now = new Date().toISOString();
  const { results: open } = await db
    .prepare(
      `SELECT d.id FROM dynamics d
       JOIN dynamic_members m ON m.dynamic_id = d.id
       WHERE m.user_id = ? AND d.status != 'ended'`,
    )
    .bind(user.id)
    .all();

  await db.batch([
    ...open.flatMap(({ id }) => [
      db
        .prepare(
          `UPDATE dynamic_members SET last_active_frozen =
             (SELECT last_active_at FROM users WHERE users.id = dynamic_members.user_id)
           WHERE dynamic_id = ?`,
        )
        .bind(id),
      db
        .prepare(
          `UPDATE dynamics SET status = 'ended', ended_at = ?, invite_hash = NULL WHERE id = ?`,
        )
        .bind(now, id),
      db
        .prepare(
          `INSERT INTO dynamic_events (id, dynamic_id, user_id, type, reason, at)
           VALUES (?, ?, ?, 'ended', 'account-deleted', ?)`,
        )
        .bind(crypto.randomUUID(), id, user.id, now),
    ]),
    db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM user_selections WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM user_about WHERE user_id = ?').bind(user.id),
    db
      .prepare(
        `UPDATE users SET username = ?, password_hash = '', recovery_hash = '', profile_steps = '{}', deleted_at = ? WHERE id = ?`,
      )
      .bind(`deleted-${user.id}`, now, user.id),
  ]);
  await endSession(c);
  return c.body(null, 204);
});
