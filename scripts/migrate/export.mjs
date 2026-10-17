// Usage: npm run export [-- mongo|firestore]
//
// Writes data.sql, which you then load with (from the repo root):
//   npx wrangler d1 execute bdsm-tools --local  --file scripts/migrate/data.sql
//   npx wrangler d1 execute bdsm-tools --remote --file scripts/migrate/data.sql
//
// Visitor sessions (points, streaks) are deliberately not migrated: browser
// cookies don't carry over to a new address, so they'd be unreachable.
import { writeFileSync } from 'node:fs';
import { flattenCounters, insertCounter, insertDoc } from './lib.mjs';

const sources = process.argv.slice(2);
const want = (name) => sources.length === 0 || sources.includes(name);

const lines = [];
const counts = {};
const add = (collection, id, doc) => {
  lines.push(insertDoc(collection, String(id), doc));
  counts[collection] = (counts[collection] ?? 0) + 1;
};

if (want('mongo')) {
  const { MONGO_CLUSTER_PASSWORD, MONGO_CLUSTER_URI, MONGO_DB } = process.env;
  if (!(MONGO_CLUSTER_PASSWORD && MONGO_CLUSTER_URI && MONGO_DB)) {
    throw new Error(
      'Set MONGO_CLUSTER_PASSWORD, MONGO_CLUSTER_URI and MONGO_DB in the top-level .env',
    );
  }
  const { MongoClient } = await import('mongodb');
  const client = await MongoClient.connect(
    `mongodb+srv://bdsmtools-gcf:${MONGO_CLUSTER_PASSWORD}@${MONGO_CLUSTER_URI}?retryWrites=true&w=majority&appName=bdsmtools-db`,
  );
  const db = client.db(MONGO_DB);

  for (const name of ['feature-flags', 'slave-training-tasks', 'feedback']) {
    for await (const doc of db.collection(name).find()) add(name, doc._id, doc);
  }

  const stats = await db.collection('stats').findOne({ _id: 'slave-training' });
  if (stats) {
    const { _id, ...rest } = stats;
    for (const [name, value] of flattenCounters(rest)) {
      lines.push(
        insertCounter(
          name.replace('randomTask.undefined', 'randomTask.any'),
          value,
        ),
      );
      counts.counters = (counts.counters ?? 0) + 1;
    }
  }
  await client.close();
}

if (want('firestore')) {
  // Uses Application Default Credentials: run `gcloud auth application-default login`
  const { initializeApp, applicationDefault } =
    await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'bdsm-tools',
  });
  const firestore = getFirestore();

  for (const name of ['scene-negotiation-types', 'scene-negotiations']) {
    const snapshot = await firestore.collection(name).get();
    snapshot.forEach((doc) => add(name, doc.id, doc.data()));
  }
}

writeFileSync(new URL('./data.sql', import.meta.url), lines.join('\n') + '\n');
console.log('Wrote scripts/migrate/data.sql', counts);
