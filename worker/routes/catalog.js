import { Hono } from 'hono';
import { catalogs } from '../catalogs';
import { listDocs } from '../docs';

/**
 * Public, read-only view of the catalogs flagged `public` in catalogs.js,
 * shaped for the site's lists: [{ label, value }] for active items.
 */
export const catalog = new Hono();

catalog.get('/:name', async (c) => {
  const name = c.req.param('name');
  const definition = Object.hasOwn(catalogs, name) ? catalogs[name] : null;
  if (!definition?.public) return c.json({ error: 'Not found' }, 404);

  const items = await listDocs(c.env.DB, definition.collection, {
    // Catalogs with a position (such as body parts) keep it; the rest are alphabetical
    orderBy:
      "COALESCE(json_extract(doc, '$.order'), 1000000), json_extract(doc, '$.label')",
  });
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(
    items
      .filter((item) => item.active)
      .map((item) => {
        // `value` is the key; everything else the catalog defines comes along
        // (label, group, parts...) minus bookkeeping
        const fields = { ...item };
        for (const bookkeeping of [
          '_id',
          'key',
          'active',
          'added',
          'updated',
        ]) {
          delete fields[bookkeeping];
        }
        return { value: item.key, ...fields };
      }),
  );
});
