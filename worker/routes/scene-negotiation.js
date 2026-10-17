import { Hono } from 'hono';
import { requireAdmin } from '../auth';
import { deleteDoc, getDoc, listDocs, putDoc } from '../docs';

const TYPES = 'scene-negotiation-types';
const NEGOTIATIONS = 'scene-negotiations';
const MAX_BODY_BYTES = 200000;

// This API's documents are identified by `id` rather than `_id`
const out = ({ _id, ...doc }) => ({ id: _id, ...doc });

const readJson = async (c) => {
  const text = await c.req.text();
  if (text.length > MAX_BODY_BYTES) return { status: 413 };
  try {
    const body = JSON.parse(text);
    return body && typeof body === 'object' && !Array.isArray(body)
      ? { body }
      : { status: 400 };
  } catch {
    return { status: 400 };
  }
};

export const sceneNegotiation = new Hono();

sceneNegotiation.get('/negotiation-types', async (c) => {
  const { id, all } = c.req.query();
  if (id) {
    const type = await getDoc(c.env.DB, TYPES, id);
    return type ? c.json(out(type)) : c.json({ error: 'Not found' }, 404);
  }
  const types = (await listDocs(c.env.DB, TYPES, { limit: 100 })).filter(
    (type) => all === 'true' || type.active === true,
  );
  return c.json(types.map(out));
});

sceneNegotiation.get('/negotiation', async (c) => {
  const id = c.req.query('id');
  const negotiation = id && (await getDoc(c.env.DB, NEGOTIATIONS, id));
  return negotiation
    ? c.json(out(negotiation))
    : c.json({ error: 'No data found for resource' }, 404);
});

sceneNegotiation.post('/negotiation', async (c) => {
  const { body, status } = await readJson(c);
  if (!body) return c.json({ error: 'Invalid request body' }, status);

  const id = crypto.randomUUID();
  const negotiation = await putDoc(c.env.DB, NEGOTIATIONS, id, {
    ...body,
    when: new Date().toISOString(),
  });
  return c.json(out(negotiation));
});

// Managing templates is for admins only
sceneNegotiation.post('/negotiation-types', requireAdmin);
sceneNegotiation.use('/negotiation-types/*', requireAdmin);

sceneNegotiation.post('/negotiation-types', async (c) => {
  const { body, status } = await readJson(c);
  if (!body) return c.json({ error: 'Invalid request body' }, status);

  const type = await putDoc(c.env.DB, TYPES, crypto.randomUUID(), {
    ...body,
    active: false,
  });
  return c.json(out(type));
});

sceneNegotiation.post('/negotiation-types/activate', async (c) => {
  const { id, active } = c.req.query();
  const type = id && (await getDoc(c.env.DB, TYPES, id));
  if (!type) return c.json({ error: 'Not found' }, 404);

  const { _id, ...doc } = type;
  const updated = await putDoc(c.env.DB, TYPES, _id, {
    ...doc,
    active: (active || 'true') === 'true',
  });
  return c.json(out(updated));
});

sceneNegotiation.post('/negotiation-types/delete', async (c) => {
  const id = c.req.query('id');
  const type = id && (await getDoc(c.env.DB, TYPES, id));
  if (!type) return c.json({ error: 'Not found' }, 404);
  if (type.active) return c.json({ error: 'Template is active' }, 400);

  await deleteDoc(c.env.DB, TYPES, id);
  return c.body(null, 204);
});
