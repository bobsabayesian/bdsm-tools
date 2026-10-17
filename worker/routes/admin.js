import { Hono } from 'hono';
import {
  logAccountEvent,
  makeInvite,
  makeResetCode,
  SIGNUP_MODES,
  getSignupMode,
  setSignupMode,
} from '../access';
import { requireAdmin } from '../auth';
import { catalogs, describe, validate } from '../catalogs';
import {
  deleteDoc,
  getDoc,
  isUniqueViolation,
  listDocs,
  putDoc,
} from '../docs';

export const admin = new Hono();

admin.use('*', requireAdmin);

admin.get('/catalogs', (c) => c.json(describe()));

// Everything under /catalogs/:catalog resolves the catalog first
admin.use('/catalogs/:catalog/*', async (c, next) => {
  const id = c.req.param('catalog');
  if (!Object.hasOwn(catalogs, id) || catalogs[id].hidden) {
    return c.json({ error: 'No such catalog' }, 404);
  }
  c.set('catalog', catalogs[id]);
  await next();
});

const duplicate = (c) =>
  c.json({ errors: ['An item with that key already exists'] }, 409);

const readBody = (c) => c.req.json().catch(() => undefined);

admin.get('/catalogs/:catalog/items', async (c) => {
  const catalog = c.get('catalog');
  const items = await listDocs(c.env.DB, catalog.collection, {
    orderBy: catalog.keyed
      ? "json_extract(doc, '$.key')"
      : catalog.newestFirst
        ? 'added DESC'
        : 'added',
  });
  return c.json(items);
});

admin.post('/catalogs/:catalog/items', async (c) => {
  const catalog = c.get('catalog');
  const { value, errors } = validate(catalog, await readBody(c));
  if (errors) return c.json({ errors }, 400);

  const now = new Date().toISOString();
  try {
    const item = await putDoc(
      c.env.DB,
      catalog.collection,
      crypto.randomUUID(),
      {
        ...value,
        added: now,
        updated: now,
      },
    );
    return c.json(item, 201);
  } catch (e) {
    if (isUniqueViolation(e)) return duplicate(c);
    throw e;
  }
});

admin.put('/catalogs/:catalog/items/:id', async (c) => {
  const catalog = c.get('catalog');
  const { value, errors } = validate(catalog, await readBody(c));
  if (errors) return c.json({ errors }, 400);

  const existing = await getDoc(
    c.env.DB,
    catalog.collection,
    c.req.param('id'),
  );
  if (!existing) return c.json({ error: 'No item with that ID' }, 404);

  try {
    // Replace the fields the catalog manages (so cleared ones are removed)
    // but keep unmanaged ones (rating, added, ...)
    const managed = new Set(catalog.fields.map((field) => field.name));
    const unmanaged = Object.fromEntries(
      Object.entries(existing).filter(([name]) => !managed.has(name)),
    );
    const now = new Date().toISOString();
    const item = await putDoc(c.env.DB, catalog.collection, existing._id, {
      ...unmanaged,
      ...value,
      updated: now,
      // Feature flags report when they were last switched
      ...(catalog.collection === 'feature-flags' &&
      value.enabled !== existing.enabled
        ? { lastChanged: now }
        : {}),
    });
    return c.json(item);
  } catch (e) {
    if (isUniqueViolation(e)) return duplicate(c);
    throw e;
  }
});

admin.delete('/catalogs/:catalog/items/:id', async (c) => {
  const catalog = c.get('catalog');
  const deleted = await deleteDoc(
    c.env.DB,
    catalog.collection,
    c.req.param('id'),
  );
  return deleted
    ? c.body(null, 204)
    : c.json({ error: 'No item with that ID' }, 404);
});

// ---- Messages: the conversations started from the contact form -------------

const MESSAGES = catalogs.messages.collection;

const presentMessage = (doc) => {
  const thread = doc.thread ?? [];
  return {
    id: doc._id,
    topic: doc.topic,
    status: doc.status ?? 'new',
    replyTo: doc.replyTo ?? null,
    username: doc.username ?? null,
    received: doc.received ?? doc.added,
    thread,
    // the last word was theirs
    waiting: thread.length > 0 && thread[thread.length - 1].from === 'them',
  };
};

admin.get('/messages', async (c) => {
  const docs = await listDocs(c.env.DB, MESSAGES, { orderBy: 'added DESC' });
  return c.json(docs.map(presentMessage));
});

admin.post('/messages/:id/reply', async (c) => {
  const doc = await getDoc(c.env.DB, MESSAGES, c.req.param('id'));
  if (!doc) return c.json({ error: 'Not found' }, 404);
  const body = await readBody(c);
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!text || text.length > 4000) {
    return c.json({ error: 'Write a reply (4000 characters at most)' }, 400);
  }
  const updated = await putDoc(c.env.DB, MESSAGES, doc._id, {
    ...doc,
    status: 'handled',
    thread: [
      ...(doc.thread ?? []),
      { from: 'admin', body: text, at: new Date().toISOString() },
    ],
  });
  return c.json(presentMessage(updated));
});

admin.put('/messages/:id', async (c) => {
  const doc = await getDoc(c.env.DB, MESSAGES, c.req.param('id'));
  if (!doc) return c.json({ error: 'Not found' }, 404);
  const body = await readBody(c);
  if (!['new', 'handled'].includes(body?.status)) {
    return c.json({ error: 'Status must be new or handled' }, 400);
  }
  return c.json(
    presentMessage(
      await putDoc(c.env.DB, MESSAGES, doc._id, {
        ...doc,
        status: body.status,
      }),
    ),
  );
});

admin.delete('/messages/:id', async (c) => {
  return (await deleteDoc(c.env.DB, MESSAGES, c.req.param('id')))
    ? c.body(null, 204)
    : c.json({ error: 'Not found' }, 404);
});

// ---- Access: who can sign up, and the codes that let people in -------------

const inviteState = (row, now) =>
  row.used_at
    ? 'used'
    : row.expires_at && row.expires_at <= now
      ? 'expired'
      : 'unused';

admin.get('/access', async (c) => {
  const db = c.env.DB;
  const now = new Date().toISOString();
  const [mode, invites, events] = await Promise.all([
    getSignupMode(db),
    db
      .prepare(
        `SELECT id, note, created_at, expires_at, used_at FROM invite_codes
         ORDER BY created_at DESC LIMIT 200`,
      )
      .all(),
    db
      .prepare(
        `SELECT e.type, e.detail, e.at, u.username FROM account_events e
         LEFT JOIN users u ON u.id = e.user_id ORDER BY e.at DESC LIMIT 40`,
      )
      .all(),
  ]);
  return c.json({
    mode,
    invites: invites.results.map((r) => ({
      id: r.id,
      note: r.note,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      usedAt: r.used_at,
      state: inviteState(r, now),
    })),
    events: events.results.map((e) => ({
      type: e.type,
      detail: e.detail,
      at: e.at,
      username: e.username,
    })),
  });
});

admin.put('/access/mode', async (c) => {
  const body = await readBody(c);
  if (!SIGNUP_MODES.includes(body?.mode)) {
    return c.json({ error: 'Mode must be invite, open or closed' }, 400);
  }
  await setSignupMode(c.env.DB, body.mode);
  return c.json({ mode: body.mode });
});

admin.post('/invites', async (c) => {
  const body = (await readBody(c)) ?? {};
  const made = await makeInvite(c.env.DB, {
    note: typeof body.note === 'string' ? body.note.trim() : '',
    days: body.days,
  });
  // The only time the code can be seen
  return c.json(made, 201);
});

admin.delete('/invites/:id', async (c) => {
  const { meta } = await c.env.DB.prepare(
    'DELETE FROM invite_codes WHERE id = ? AND used_at IS NULL',
  )
    .bind(c.req.param('id'))
    .run();
  return meta.changes > 0
    ? c.body(null, 204)
    : c.json({ error: 'Only an unused code can be removed' }, 404);
});

// ---- Accounts: what you need to check someone is who they say they are ----

const likePattern = (text) => `%${text.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

admin.get('/users', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  if (q.length < 2) return c.json([]);
  const db = c.env.DB;
  const { results: users } = await db
    .prepare(
      `SELECT id, username, display_name, created_at, last_active_at FROM users
       WHERE deleted_at IS NULL AND username LIKE ? ESCAPE '\\'
       ORDER BY username LIMIT 10`,
    )
    .bind(likePattern(q))
    .all();

  return c.json(
    await Promise.all(
      users.map(async (u) => {
        const [{ results: mine }, tasks, { results: events }] =
          await Promise.all([
            db
              .prepare(
                `SELECT d.id, d.kind, d.status, m.role, m.alias, m.name
               FROM dynamic_members m JOIN dynamics d ON d.id = m.dynamic_id
               WHERE m.user_id = ? ORDER BY d.created_at DESC`,
              )
              .bind(u.id)
              .all(),
            db
              .prepare(
                'SELECT COUNT(*) AS n FROM assignments WHERE assigned_to = ? OR assigned_by = ?',
              )
              .bind(u.id, u.id)
              .first(),
            db
              .prepare(
                `SELECT type, detail, at FROM account_events WHERE user_id = ?
               ORDER BY at DESC LIMIT 10`,
              )
              .bind(u.id)
              .all(),
          ]);
        const dynamics = await Promise.all(
          mine.map(async (d) => {
            const { results: others } = await db
              .prepare(
                `SELECT m.alias, m.name, u2.username FROM dynamic_members m
                 JOIN users u2 ON u2.id = m.user_id
                 WHERE m.dynamic_id = ? AND m.user_id != ?`,
              )
              .bind(d.id, u.id)
              .all();
            return {
              kind: d.kind,
              status: d.status,
              role: d.role,
              name: d.name ?? d.alias,
              title: d.alias,
              partners: others.map((o) => ({
                name: o.name ?? o.alias,
                title: o.alias,
                username: o.username,
              })),
            };
          }),
        );
        return {
          id: u.id,
          username: u.username,
          displayName: u.display_name,
          createdAt: u.created_at,
          lastActiveAt: u.last_active_at,
          tasks: tasks.n,
          dynamics,
          events,
        };
      }),
    ),
  );
});

admin.post('/users/:id/reset-code', async (c) => {
  const db = c.env.DB;
  const user = await db
    .prepare('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL')
    .bind(c.req.param('id'))
    .first();
  if (!user) return c.json({ error: 'Not found' }, 404);
  const body = (await readBody(c)) ?? {};
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const made = await makeResetCode(db, user.id, note);
  await logAccountEvent(
    db,
    user.id,
    'reset-code-issued',
    note || 'no note',
  ).run();
  return c.json(made, 201);
});
