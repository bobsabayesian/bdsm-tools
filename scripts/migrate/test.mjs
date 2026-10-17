import assert from 'node:assert/strict';
import { flattenCounters, insertCounter, insertDoc, plain } from './lib.mjs';

const objectId = { _bsontype: 'ObjectId', toString: () => 'abc123' };
const timestamp = { _bsontype: 'Timestamp', high: 1_700_000_000 };

assert.deepEqual(
  plain({
    id: objectId,
    when: timestamp,
    d: new Date(0),
    n: [objectId],
    s: 'x',
  }),
  {
    id: 'abc123',
    when: '2023-11-14T22:13:20.000Z',
    d: '1970-01-01T00:00:00.000Z',
    n: ['abc123'],
    s: 'x',
  },
);

const sql = insertDoc(
  'c',
  'i',
  { _id: objectId, task: "it's", added: new Date(0) },
  'NOW',
);
assert.equal(
  sql,
  `INSERT OR REPLACE INTO docs (collection, id, doc, added, updated) VALUES ('c', 'i', '{"task":"it''s","added":"1970-01-01T00:00:00.000Z"}', '1970-01-01T00:00:00.000Z', 'NOW');`,
);

assert.deepEqual(
  flattenCounters({ a: 1, b: { c: 2, d: { e: 3 } }, s: 'skip' }),
  [
    ['a', 1],
    ['b.c', 2],
    ['b.d.e', 3],
  ],
);
assert.equal(
  insertCounter("x'y", 2),
  `INSERT OR REPLACE INTO counters (name, value) VALUES ('x''y', 2);`,
);
console.log('migrate lib: ok');
