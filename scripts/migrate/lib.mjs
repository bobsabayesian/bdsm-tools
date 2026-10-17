// Pure helpers for turning exported documents into D1-compatible SQL

/** Recursively turn database-specific types (ObjectId, Timestamp, Date) into JSON-friendly values */
export const plain = (value) => {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(plain);

  switch (value._bsontype) {
    case 'ObjectId':
      return value.toString();
    case 'Timestamp': // BSON timestamp: high bits are seconds since the epoch
      return new Date(value.high * 1000).toISOString();
    case 'Long':
    case 'Int32':
    case 'Double':
      return Number(value.toString());
  }
  // Firestore Timestamp
  if (typeof value.toDate === 'function') return value.toDate().toISOString();

  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [key, plain(v)]),
  );
};

const quote = (text) => `'${String(text).replaceAll("'", "''")}'`;

export const insertDoc = (
  collection,
  id,
  doc,
  now = new Date().toISOString(),
) => {
  const { _id, id: _id2, ...data } = plain(doc);
  const added = typeof data.added === 'string' ? data.added : now;
  return (
    'INSERT OR REPLACE INTO docs (collection, id, doc, added, updated) VALUES (' +
    [collection, id, JSON.stringify(data), added, now].map(quote).join(', ') +
    ');'
  );
};

/** { a: { b: 2 }, c: 3 } -> { 'a.b': 2, c: 3 } (numbers only) */
export const flattenCounters = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'number') return [[name, value]];
    if (value && typeof value === 'object') return flattenCounters(value, name);
    return [];
  });

export const insertCounter = (name, value) =>
  `INSERT OR REPLACE INTO counters (name, value) VALUES (${quote(name)}, ${Math.round(value)});`;
