// Who may sign up, and the one-time codes behind it. A code is shown once when
// it is made; only its hash is kept, so a copy of the database holds no usable code.

import { normalizeCode, randomCode, sha256Hex } from './passwords';

export const SIGNUP_MODES = ['invite', 'open', 'closed'];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const RESET_CODE_LIFETIME_MS = HOUR;
export const MAX_INVITE_DAYS = 365;

export const getSignupMode = async (db) => {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = 'signup_mode'")
    .first();
  return SIGNUP_MODES.includes(row?.value) ? row.value : 'invite';
};

export const setSignupMode = (db, mode) =>
  db
    .prepare(
      `INSERT INTO settings (key, value) VALUES ('signup_mode', ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    )
    .bind(mode)
    .run();

const hashOf = (code) => sha256Hex(normalizeCode(code));

/** A new invite code for someone, optionally expiring after `days` */
export const makeInvite = async (db, { note, days }) => {
  const code = randomCode(4);
  const now = Date.now();
  const expires =
    Number.isInteger(days) && days > 0 && days <= MAX_INVITE_DAYS
      ? new Date(now + days * DAY).toISOString()
      : null;
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO invite_codes (id, code_hash, note, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      await hashOf(code),
      note?.slice(0, 200) || null,
      new Date(now).toISOString(),
      expires,
    )
    .run();
  return { id, code, expiresAt: expires };
};

/**
 * Uses up an invite code, once. Returns true only for the one request that
 * claimed it (so two people cannot sign up on the same code).
 */
export const claimInvite = async (db, code, userId) => {
  const result = await db
    .prepare(
      `UPDATE invite_codes SET used_at = ?1, used_by = ?2
       WHERE code_hash = ?3 AND used_at IS NULL
         AND (expires_at IS NULL OR expires_at > ?1)`,
    )
    .bind(new Date().toISOString(), userId, await hashOf(code))
    .run();
  return result.meta.changes === 1;
};

/** Gives a claimed invite back (the sign-up it was for did not happen) */
export const releaseInvite = async (db, code) =>
  db
    .prepare(
      'UPDATE invite_codes SET used_at = NULL, used_by = NULL WHERE code_hash = ?',
    )
    .bind(await hashOf(code))
    .run();

/** A one-hour code that lets one account choose a new password */
export const makeResetCode = async (db, userId, note) => {
  const code = randomCode(4);
  const now = Date.now();
  const expiresAt = new Date(now + RESET_CODE_LIFETIME_MS).toISOString();
  await db.batch([
    // only the newest code for an account is good
    db
      .prepare(
        'UPDATE reset_codes SET used_at = ? WHERE user_id = ? AND used_at IS NULL',
      )
      .bind(new Date(now).toISOString(), userId),
    db
      .prepare(
        `INSERT INTO reset_codes (id, user_id, code_hash, note, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        userId,
        await hashOf(code),
        note?.slice(0, 200) || null,
        new Date(now).toISOString(),
        expiresAt,
      ),
  ]);
  return { code, expiresAt };
};

/** Uses up this account's reset code, once. True for the one request that did. */
export const claimResetCode = async (db, userId, code) => {
  const result = await db
    .prepare(
      `UPDATE reset_codes SET used_at = ?1
       WHERE user_id = ?2 AND code_hash = ?3 AND used_at IS NULL AND expires_at > ?1`,
    )
    .bind(new Date().toISOString(), userId, await hashOf(code))
    .run();
  return result.meta.changes === 1;
};

export const logAccountEvent = (db, userId, type, detail) =>
  db
    .prepare(
      'INSERT INTO account_events (id, user_id, type, detail, at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      crypto.randomUUID(),
      userId,
      type,
      detail ?? null,
      new Date().toISOString(),
    );
