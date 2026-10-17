import { Hono } from 'hono';
import { currentUser, noStore, requireJson } from '../accounts';
import { catalogs, validate } from '../catalogs';
import { putDoc } from '../docs';
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

  const now = new Date().toISOString();
  await putDoc(c.env.DB, catalogs.messages.collection, crypto.randomUUID(), {
    ...value,
    added: now,
    updated: now,
  });
  return c.json({ ok: true }, 201);
});
