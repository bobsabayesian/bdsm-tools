/**
 * A tiny document store on top of D1's `docs` table.
 * Documents come back as `{ _id, ...doc }`.
 */

const parse = ({ id, doc }) => ({ _id: id, ...JSON.parse(doc) });

export const isUniqueViolation = (e) =>
  /UNIQUE constraint failed/.test(e?.message);

export const getDoc = async (db, collection, id) => {
  const row = await db
    .prepare('SELECT id, doc FROM docs WHERE collection = ? AND id = ?')
    .bind(collection, id)
    .first();
  return row ? parse(row) : null;
};

/** `orderBy` is interpolated into SQL - only ever pass a constant */
export const listDocs = async (
  db,
  collection,
  { orderBy = 'added', limit = 5000 } = {},
) => {
  const { results } = await db
    .prepare(
      `SELECT id, doc FROM docs WHERE collection = ? ORDER BY ${orderBy} LIMIT ?`,
    )
    .bind(collection, limit)
    .all();
  return results.map(parse);
};

/** Insert or replace a document. Pass the whole document. */
export const putDoc = async (db, collection, id, doc) => {
  const now = new Date().toISOString();
  const data = { ...doc };
  delete data._id;
  delete data.id;
  await db
    .prepare(
      `INSERT INTO docs (collection, id, doc, added, updated) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (collection, id) DO UPDATE SET doc = excluded.doc, updated = excluded.updated`,
    )
    .bind(collection, id, JSON.stringify(data), data.added ?? now, now)
    .run();
  return { _id: id, ...data };
};

export const deleteDoc = async (db, collection, id) => {
  const { meta } = await db
    .prepare('DELETE FROM docs WHERE collection = ? AND id = ?')
    .bind(collection, id)
    .run();
  return meta.changes > 0;
};

export const bump = (db, name, by = 1) =>
  db
    .prepare(
      `INSERT INTO counters (name, value) VALUES (?, ?)
       ON CONFLICT (name) DO UPDATE SET value = value + excluded.value`,
    )
    .bind(name, by)
    .run();

export const bumpMax = (db, name, value) =>
  db
    .prepare(
      `INSERT INTO counters (name, value) VALUES (?, ?)
       ON CONFLICT (name) DO UPDATE SET value = MAX(value, excluded.value)`,
    )
    .bind(name, value)
    .run();

export const getCounters = async (db, names) => {
  const { results } = await db
    .prepare(
      `SELECT name, value FROM counters WHERE name IN (${names.map(() => '?').join(',')})`,
    )
    .bind(...names)
    .all();
  return Object.fromEntries(results.map(({ name, value }) => [name, value]));
};
