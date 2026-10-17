import { Hono } from 'hono';
import { currentUser, noStore, requireJson } from '../accounts';
import { catalogs, validate } from '../catalogs';
import { getDoc, putDoc } from '../docs';
import { randomToken, sha256Hex } from '../passwords';
import { clientIp, overLimit } from '../ratelimit';

const HOUR = 60 * 60 * 1000;
const MIN_LENGTH = 5;

/**
 * The contact form. Anyone can send a message (logged in or not); it lands in
 * the admin tool under Messages. A username is only attached when the person is
 * logged in and ticks the box - otherwise the message is anonymous apart from
 * whatever they type in "reply to".
 */
export const contact = new Hono();
contact.use('*', noStore, requireJson);

contact.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Please write a message' }, 400);
  }
  // Bots fill in every field; people never see this one
  if (typeof body.website === 'string' && body.website.trim()) {
    return c.json({ ok: true }, 201);
  }
  if (await overLimit(c.env.DB, `contact:${clientIp(c)}`, 5, HOUR)) {
    return c.json(
      {
        error: 'That is a lot of messages. Please try again in a little while.',
      },
      429,
    );
  }

  const user = body.includeUsername === true ? await currentUser(c) : null;
  const { value, errors } = validate(catalogs.messages, {
    status: 'new',
    topic: body.topic,
    message: body.message,
    replyTo: body.replyTo,
    username: user?.username,
    received: new Date().toISOString(),
  });
  if (errors) return c.json({ error: errors[0] }, 400);
  if (value.message.length < MIN_LENGTH) {
    return c.json({ error: 'Please write a little more' }, 400);
  }

  // The private link they keep to read replies and answer. Only its hash is stored.
  const token = randomToken();
  const now = new Date().toISOString();
  await putDoc(c.env.DB, catalogs.messages.collection, crypto.randomUUID(), {
    ...value,
    tokenHash: await sha256Hex(token),
    thread: [{ from: 'them', body: value.message, at: now }],
    added: now,
    updated: now,
  });
  return c.json({ ok: true, token }, 201);
});

const MAX_THREAD = 100;
const MAX_REPLY = 4000;

const findThread = async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT id FROM docs WHERE collection = ? AND json_extract(doc, '$.tokenHash') = ?`,
  )
    .bind(
      catalogs.messages.collection,
      await sha256Hex(String(c.req.param('token'))),
    )
    .first();
  return row ? getDoc(c.env.DB, catalogs.messages.collection, row.id) : null;
};

const presentThread = (doc) => ({
  topic: doc.topic,
  thread: doc.thread ?? [],
});

// Read the conversation, with the link they were given
contact.get('/thread/:token', async (c) => {
  const doc = await findThread(c);
  return doc ? c.json(presentThread(doc)) : c.json({ error: 'Not found' }, 404);
});

// Add to it
contact.post('/thread/:token', async (c) => {
  if (await overLimit(c.env.DB, `thread:${clientIp(c)}`, 30, HOUR)) {
    return c.json({ error: 'Please try again in a little while.' }, 429);
  }
  const doc = await findThread(c);
  if (!doc) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) return c.json({ error: 'Write a message' }, 400);
  if (text.length > MAX_REPLY)
    return c.json({ error: 'That is too long' }, 400);
  if ((doc.thread ?? []).length >= MAX_THREAD) {
    return c.json({ error: 'This conversation is full' }, 409);
  }
  const now = new Date().toISOString();
  const updated = await putDoc(
    c.env.DB,
    catalogs.messages.collection,
    doc._id,
    {
      ...doc,
      status: 'new',
      thread: [...(doc.thread ?? []), { from: 'them', body: text, at: now }],
    },
  );
  return c.json(presentThread(updated), 201);
});
