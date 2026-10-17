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
    orderBy: "json_extract(doc, '$.label')",
  });
  c.header('Cache-Control', 'public, max-age=60');
  return c.json(
    items
      .filter((item) => item.active)
      .map(({ key, label }) => ({ label, value: key })),
  );
});
