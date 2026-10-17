import { Hono } from 'hono';
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
  if (!Object.hasOwn(catalogs, id)) {
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
