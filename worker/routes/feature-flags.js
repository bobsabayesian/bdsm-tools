import { Hono } from 'hono';

export const featureFlags = new Hono();

featureFlags.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'public, max-age=60'); // admins expect toggles to take effect quickly
});

const FLAG_QUERY = `SELECT id, doc FROM docs WHERE collection = 'feature-flags'`;

const present = ({ id, doc }) => {
  const flag = JSON.parse(doc);
  return {
    _id: flag.key ?? id,
    ...flag,
    // The site shows when a flag was last switched
    lastChanged: flag.lastChanged ?? flag.updated,
  };
};

// Registered before /flag/:id, which would otherwise swallow it
featureFlags.get('/flag/enabled', async (c) => {
  const { results } = await c.env.DB.prepare(
    `${FLAG_QUERY} AND json_extract(doc, '$.enabled') = 1 LIMIT 100`,
  ).all();
  return c.json(results.map((row) => present(row)._id));
});

featureFlags.get('/flag/:id', async (c) => {
  const row = await c.env.DB.prepare(
    `${FLAG_QUERY} AND (id = ?1 OR json_extract(doc, '$.key') = ?1)`,
  )
    .bind(c.req.param('id'))
    .first();
  return row ? c.json(present(row)) : c.text('No feature with that ID', 404);
});
