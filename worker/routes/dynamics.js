import { Hono } from 'hono';
import { noStore, requireJson, requireUser } from '../accounts';
import { normalizeCode, randomCode, sha256Hex } from '../passwords';
import { overLimit } from '../ratelimit';
import { readAbout } from './profile';

/**
 * A "dynamic" is a relationship between two people (or one person alone, in
 * solo mode). A person can be in any number of them and nobody is told about
 * the others: partners only ever see the alias chosen for that dynamic, and
 * never a username or user id.
 */

const HOUR = 60 * 60 * 1000;
const INVITE_LIFETIME_MS = 7 * 24 * HOUR;
const MAX_LISTED = 50;

const REASONS = ['break', 'not-working', 'something-happened', 'not-okay'];
const MAX_NOTE = 1000;

export const dynamics = new Hono();
dynamics.use('*', noStore, requireJson, requireUser);

const body = (c) => c.req.json().catch(() => ({}));

const cleanAlias = (alias, fallback) => {
  if (alias === undefined || alias === null || alias === '') return fallback;
  if (typeof alias !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const trimmed = alias.replace(/[\u0000-\u001f]/g, '').trim();
  return trimmed.length >= 1 && trimmed.length <= 40 ? trimmed : null;
};

// Everyone needs a display name before they can be in a dynamic
const displayNameOf = async (db, userId) =>
  (
    await db
      .prepare('SELECT display_name FROM users WHERE id = ?')
      .bind(userId)
      .first()
  )?.display_name || null;

const needsName = (c) =>
  c.json(
    {
      error:
        'Add your display name (under My profile) before starting or joining a dynamic',
      code: 'display-name-required',
    },
    409,
  );

/**
 * The name and title someone takes into a dynamic. The name defaults to their
 * display name; the title (Sir, kitten...) is chosen here and `titleFallback` is
 * used when none is given (null: it is required).
 */
const readNames = async (c, input, titleFallback) => {
  const displayName = await displayNameOf(c.env.DB, c.get('user').id);
  if (!displayName) return { missing: true };
  const name = cleanAlias(input.name, displayName);
  const title = cleanAlias(input.alias, titleFallback);
  if (!name) return { error: 'Name must be 1-40 characters' };
  if (!title) return { error: 'Title must be 1-40 characters' };
  return { name, title };
};

const placeholders = (items) => items.map(() => '?').join(',');

/** Pauses with a "resume on" date lift themselves once the date arrives */
export const resumeDuePauses = async (db, userId) => {
  const now = new Date().toISOString();
  const { results } = await db
    .prepare(
      `SELECT d.id FROM dynamics d JOIN dynamic_members m ON m.dynamic_id = d.id
       WHERE m.user_id = ? AND d.status = 'paused' AND d.resume_on IS NOT NULL AND d.resume_on <= ?`,
    )
    .bind(userId, now)
    .all();
  if (!results.length) return;

  await db.batch(
    results.flatMap(({ id }) => [
      db
        .prepare(
          `UPDATE dynamics SET status = 'active', resume_on = NULL WHERE id = ?`,
        )
        .bind(id),
      db
        .prepare(
          `INSERT INTO dynamic_events (id, dynamic_id, user_id, type, at) VALUES (?, ?, NULL, 'resumed', ?)`,
        )
        .bind(crypto.randomUUID(), id, now),
    ]),
  );
};

/**
 * What this person is allowed to know about their dynamics. `id` limits it to
 * one dynamic; the person must be a member of it.
 */
const loadDynamics = async (db, userId, id) => {
  await resumeDuePauses(db, userId);

  const { results: mine } = await db
    .prepare(
      `SELECT d.id, d.kind, d.status, d.resume_on, d.created_at, d.ended_at, d.invite_expires,
              m.role, m.alias, m.name
       FROM dynamics d JOIN dynamic_members m ON m.dynamic_id = d.id
       WHERE m.user_id = ?1 AND (?2 IS NULL OR d.id = ?2)
       ORDER BY d.created_at DESC LIMIT ${MAX_LISTED}`,
    )
    .bind(userId, id ?? null)
    .all();
  if (!mine.length) return [];

  const ids = mine.map((d) => d.id);
  const [{ results: others }, { results: events }] = await Promise.all([
    db
      .prepare(
        `SELECT m.dynamic_id, m.role, m.alias, m.name, m.last_active_frozen, u.last_active_at, u.deleted_at
         FROM dynamic_members m JOIN users u ON u.id = m.user_id
         WHERE m.dynamic_id IN (${placeholders(ids)}) AND m.user_id != ?`,
      )
      .bind(...ids, userId)
      .all(),
    db
      .prepare(
        `SELECT * FROM (
           SELECT e.*, ROW_NUMBER() OVER (PARTITION BY dynamic_id ORDER BY at DESC) AS n
           FROM dynamic_events e WHERE dynamic_id IN (${placeholders(ids)})
         ) WHERE n <= ?`,
      )
      .bind(...ids, id ? 20 : 1)
      .all(),
  ]);

  return mine.map((d) => {
    const other = others.find((o) => o.dynamic_id === d.id);
    const history = events
      .filter((e) => e.dynamic_id === d.id)
      .map((e) => ({
        type: e.type,
        reason: e.reason,
        note: e.note,
        resumeOn: e.resume_on,
        at: e.at,
        by:
          e.user_id === null ? 'system' : e.user_id === userId ? 'you' : 'them',
      }));

    return {
      id: d.id,
      kind: d.kind,
      status: d.status,
      createdAt: d.created_at,
      endedAt: d.ended_at,
      resumeOn: d.resume_on,
      inviteExpires: d.status === 'invited' ? d.invite_expires : undefined,
      you: { role: d.role, alias: d.alias, name: d.name ?? d.alias },
      partner: other && {
        role: other.role,
        alias: other.deleted_at ? 'Deleted account' : other.alias,
        name: other.deleted_at
          ? 'Deleted account'
          : (other.name ?? other.alias),
        // Live while the dynamic is going; frozen at the moment it ended
        lastActive:
          d.status === 'ended'
            ? other.last_active_frozen
            : other.last_active_at,
        accountDeleted: !!other.deleted_at,
      },
      lastEvent: history[0],
      history: id ? history : undefined,
    };
  });
};

const loadOne = async (c, id) => {
  const [found] = await loadDynamics(c.env.DB, c.get('user').id, id);
  return found;
};

dynamics.get('/', async (c) =>
  c.json(await loadDynamics(c.env.DB, c.get('user').id)),
);

dynamics.get('/:id', async (c) => {
  const found = await loadOne(c, c.req.param('id'));
  return found ? c.json(found) : c.json({ error: 'Not found' }, 404);
});

// ---- Starting a dynamic ------------------------------------------------

dynamics.post('/solo', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const names = await readNames(c, await body(c), 'Me');
  if (names.missing) return needsName(c);
  if (names.error) return c.json({ error: names.error }, 400);

  const existing = await db
    .prepare(
      `SELECT 1 FROM dynamics d JOIN dynamic_members m ON m.dynamic_id = d.id
       WHERE m.user_id = ? AND d.kind = 'solo' AND d.status != 'ended'`,
    )
    .bind(user.id)
    .first();
  if (existing)
    return c.json({ error: 'You already have a solo dynamic' }, 409);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO dynamics (id, kind, status, created_at) VALUES (?, 'solo', 'active', ?)`,
      )
      .bind(id, now),
    db
      .prepare(
        `INSERT INTO dynamic_members (dynamic_id, user_id, role, alias, name, joined_at) VALUES (?, ?, 'self', ?, ?, ?)`,
      )
      .bind(id, user.id, names.title, names.name, now),
  ]);
  return c.json(await loadOne(c, id), 201);
});

// Invite someone: you pick your role and your alias; they get the other role.
// The code is shown once and only its hash is stored.
dynamics.post('/invite', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const input = await body(c);
  if (input.role !== 'dom' && input.role !== 'sub') {
    return c.json({ error: 'Role must be "dom" or "sub"' }, 400);
  }
  const role = input.role;
  const names = await readNames(c, input, null);
  if (names.missing) return needsName(c);
  if (names.error) return c.json({ error: names.error }, 400);

  if (await overLimit(db, `invite:${user.id}`, 10, 24 * HOUR)) {
    return c.json({ error: 'Too many invitations today' }, 429);
  }

  const id = crypto.randomUUID();
  const code = randomCode(4);
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO dynamics (id, kind, status, invite_hash, invite_expires, created_at)
         VALUES (?, 'pair', 'invited', ?, ?, ?)`,
      )
      .bind(
        id,
        await sha256Hex(normalizeCode(code)),
        Date.now() + INVITE_LIFETIME_MS,
        now,
      ),
    db
      .prepare(
        `INSERT INTO dynamic_members (dynamic_id, user_id, role, alias, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, user.id, role, names.title, names.name, now),
  ]);
  return c.json({ ...(await loadOne(c, id)), code }, 201);
});

const findInvite = async (c, code) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (typeof code !== 'string' || normalizeCode(code).length < 16) return null;

  const invite = await db
    .prepare(
      `SELECT d.id, m.user_id AS inviter_id, m.role AS inviter_role, m.alias AS inviter_alias, m.name AS inviter_name
       FROM dynamics d JOIN dynamic_members m ON m.dynamic_id = d.id
       WHERE d.invite_hash = ? AND d.status = 'invited' AND d.invite_expires > ?`,
    )
    .bind(await sha256Hex(normalizeCode(code)), Date.now())
    .first();
  return invite && invite.inviter_id !== user.id ? invite : null;
};

const INVALID_CODE = 'That invitation code is not valid or has expired';

// Look before accepting: who is asking, and which role would you take?
dynamics.post('/preview', async (c) => {
  const user = c.get('user');
  if (await overLimit(c.env.DB, `join:${user.id}`, 10, HOUR)) {
    return c.json({ error: 'Too many attempts. Please wait a while.' }, 429);
  }
  const invite = await findInvite(c, (await body(c)).code);
  if (!invite) return c.json({ error: INVALID_CODE }, 404);
  return c.json({
    inviterAlias: invite.inviter_alias,
    inviterName: invite.inviter_name ?? invite.inviter_alias,
    yourRole: invite.inviter_role === 'dom' ? 'sub' : 'dom',
  });
});

dynamics.post('/join', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const input = await body(c);
  const names = await readNames(c, input, null);
  if (names.missing) return needsName(c);
  if (names.error) return c.json({ error: names.error }, 400);

  if (await overLimit(db, `join:${user.id}`, 10, HOUR)) {
    return c.json({ error: 'Too many attempts. Please wait a while.' }, 429);
  }
  const invite = await findInvite(c, input.code);
  if (!invite) return c.json({ error: INVALID_CODE }, 404);

  // Two people can only be in one dynamic together at a time
  const already = await db
    .prepare(
      `SELECT 1 FROM dynamics d
       JOIN dynamic_members a ON a.dynamic_id = d.id AND a.user_id = ?1
       JOIN dynamic_members b ON b.dynamic_id = d.id AND b.user_id = ?2
       WHERE d.kind = 'pair' AND d.status IN ('active', 'paused')`,
    )
    .bind(user.id, invite.inviter_id)
    .first();
  if (already) {
    return c.json(
      {
        error:
          'You are already in a dynamic with this person. End that one first if you want to start another.',
        code: 'already-together',
      },
      409,
    );
  }

  const now = new Date().toISOString();
  // A batch runs as one transaction, so of two people redeeming the same code
  // at once only the first finds the dynamic still 'invited' and gets in
  const [claim] = await db.batch([
    db
      .prepare(
        `INSERT INTO dynamic_members (dynamic_id, user_id, role, alias, name, joined_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6
         WHERE EXISTS (SELECT 1 FROM dynamics WHERE id = ?1 AND status = 'invited')`,
      )
      .bind(
        invite.id,
        user.id,
        invite.inviter_role === 'dom' ? 'sub' : 'dom',
        names.title,
        names.name,
        now,
      ),
    db
      .prepare(
        `UPDATE dynamics SET status = 'active', invite_hash = NULL, invite_expires = NULL
         WHERE id = ? AND status = 'invited'`,
      )
      .bind(invite.id),
  ]);
  if (!claim.meta.changes) return c.json({ error: INVALID_CODE }, 404);
  return c.json(await loadOne(c, invite.id), 201);
});

// Everything the other person has chosen: all of it, limits included. Both people
// in a dynamic see this about each other. It stops when the dynamic ends, and
// never shows anything from before the person was told it would be shared.
dynamics.get('/:id/profile', async (c) => {
  const db = c.env.DB;
  const found = await loadOne(c, c.req.param('id'));
  if (
    !found ||
    !found.partner ||
    (found.status !== 'active' && found.status !== 'paused')
  ) {
    return c.json({ error: 'Not found' }, 404);
  }

  const partner = await db
    .prepare(
      `SELECT u.id, u.profile_shared_at, u.profile_steps, u.rule_change_min_days
       FROM dynamic_members m JOIN users u ON u.id = m.user_id
       WHERE m.dynamic_id = ? AND m.user_id != ? AND u.deleted_at IS NULL`,
    )
    .bind(found.id, c.get('user').id)
    .first();
  if (!partner) return c.json({ error: 'Not found' }, 404);
  if (!partner.profile_shared_at) return c.json({ shared: false });

  const [{ results }, aboutRow] = await Promise.all([
    db
      .prepare(
        'SELECT catalog, key, direction, state FROM user_selections WHERE user_id = ?',
      )
      .bind(partner.id)
      .all(),
    db
      .prepare(
        'SELECT genders, pronouns, about FROM user_about WHERE user_id = ?',
      )
      .bind(partner.id)
      .first(),
  ]);
  return c.json({
    shared: true,
    steps: JSON.parse(partner.profile_steps),
    me: readAbout(aboutRow, partner.rule_change_min_days),
    selections: {
      bodyParts: results
        .filter((row) => row.catalog === 'bodyParts')
        .map(({ key }) => ({ key })),
      equipment: results
        .filter((row) => row.catalog === 'equipment')
        .map(({ key }) => ({ key })),
      boundsBody: results
        .filter((row) => row.catalog === 'boundsBody')
        .map(({ key }) => ({ key })),
      boundsClothing: results
        .filter((row) => row.catalog === 'boundsClothing')
        .map(({ key }) => ({ key })),
      boundsSpaces: results
        .filter((row) => row.catalog === 'boundsSpaces')
        .map(({ key }) => ({ key })),
      kinks: results
        .filter((row) => row.catalog === 'kinks')
        .map(({ key, direction, state }) => ({ key, direction, state })),
    },
  });
});

// Withdraw an invitation nobody has accepted
dynamics.delete('/:id', async (c) => {
  const db = c.env.DB;
  const found = await loadOne(c, c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  if (found.status !== 'invited') {
    return c.json({ error: 'Only pending invitations can be withdrawn' }, 409);
  }
  await db.prepare('DELETE FROM dynamics WHERE id = ?').bind(found.id).run();
  return c.body(null, 204);
});

dynamics.put('/:id/me', async (c) => {
  const found = await loadOne(c, c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const input = await body(c);
  // either or both can be sent; what is left out stays as it is
  const title =
    input.alias === undefined ? found.you.alias : cleanAlias(input.alias, null);
  const name =
    input.name === undefined ? found.you.name : cleanAlias(input.name, null);
  if (!title) return c.json({ error: 'Title must be 1-40 characters' }, 400);
  if (!name) return c.json({ error: 'Name must be 1-40 characters' }, 400);

  await c.env.DB.prepare(
    'UPDATE dynamic_members SET alias = ?, name = ? WHERE dynamic_id = ? AND user_id = ?',
  )
    .bind(title, name, found.id, c.get('user').id)
    .run();
  return c.json(await loadOne(c, found.id));
});

// ---- Pausing and ending ------------------------------------------------
// Either person can do these at any time, with nobody's approval. The reason
// and note are optional.

const readReason = async (c) => {
  const { reason, note, resumeOn } = await body(c);
  if (reason !== undefined && reason !== null && !REASONS.includes(reason)) {
    return { error: 'Unknown reason' };
  }
  if (
    note !== undefined &&
    note !== null &&
    (typeof note !== 'string' || note.length > MAX_NOTE)
  ) {
    return { error: `Note must be at most ${MAX_NOTE} characters` };
  }
  let resume = null;
  if (resumeOn) {
    const when = new Date(resumeOn);
    if (
      Number.isNaN(when.getTime()) ||
      when <= new Date() ||
      when - new Date() > 366 * 24 * HOUR
    ) {
      return { error: 'Resume date must be in the future, within a year' };
    }
    resume = when.toISOString();
  }
  return { reason: reason ?? null, note: note?.trim() || null, resume };
};

const event = (db, dynamicId, userId, type, { reason, note, resume }, at) =>
  db
    .prepare(
      `INSERT INTO dynamic_events (id, dynamic_id, user_id, type, reason, note, resume_on, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      dynamicId,
      userId,
      type,
      reason,
      note,
      resume,
      at,
    );

dynamics.post('/:id/pause', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await loadOne(c, c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  if (found.status !== 'active')
    return c.json({ error: 'Only an active dynamic can be paused' }, 409);

  const input = await readReason(c);
  if (input.error) return c.json({ error: input.error }, 400);

  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `UPDATE dynamics SET status = 'paused', resume_on = ? WHERE id = ?`,
      )
      .bind(input.resume, found.id),
    event(db, found.id, user.id, 'paused', input, now),
  ]);
  return c.json(await loadOne(c, found.id));
});

// Only whoever paused can resume (otherwise a pause could be overridden by
// the other person); a "resume on" date lifts it automatically.
dynamics.post('/:id/resume', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await loadOne(c, c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  if (found.status !== 'paused')
    return c.json({ error: 'This dynamic is not paused' }, 409);

  const pause = await db
    .prepare(
      `SELECT user_id FROM dynamic_events WHERE dynamic_id = ? AND type = 'paused' ORDER BY at DESC LIMIT 1`,
    )
    .bind(found.id)
    .first();
  if (pause && pause.user_id !== user.id) {
    return c.json({ error: 'Only the person who paused can resume' }, 403);
  }

  await db.batch([
    db
      .prepare(
        `UPDATE dynamics SET status = 'active', resume_on = NULL WHERE id = ?`,
      )
      .bind(found.id),
    event(
      db,
      found.id,
      user.id,
      'resumed',
      { reason: null, note: null, resume: null },
      new Date().toISOString(),
    ),
  ]);
  return c.json(await loadOne(c, found.id));
});

dynamics.post('/:id/end', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await loadOne(c, c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  if (found.status !== 'active' && found.status !== 'paused') {
    return c.json({ error: 'This dynamic has already ended' }, 409);
  }

  const input = await readReason(c);
  if (input.error) return c.json({ error: input.error }, 400);
  input.resume = null;

  const now = new Date().toISOString();
  await db.batch([
    // Freeze both people's "last active" so nobody can keep watching after it ends
    db
      .prepare(
        `UPDATE dynamic_members SET last_active_frozen =
           (SELECT last_active_at FROM users WHERE users.id = dynamic_members.user_id)
         WHERE dynamic_id = ?`,
      )
      .bind(found.id),
    db
      .prepare(
        `UPDATE dynamics SET status = 'ended', ended_at = ?, resume_on = NULL WHERE id = ?`,
      )
      .bind(now, found.id),
    event(db, found.id, user.id, 'ended', input, now),
  ]);
  return c.json(await loadOne(c, found.id));
});
