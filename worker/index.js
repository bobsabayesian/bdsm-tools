import { Hono } from 'hono';
import { admin } from './routes/admin';
import { catalog } from './routes/catalog';
import { featureFlags } from './routes/feature-flags';
import { sceneNegotiation } from './routes/scene-negotiation';
import { slaveTraining } from './routes/slave-training';

// Static files (the React app) are served by Cloudflare directly; this Worker
// only handles /api/*.
const app = new Hono();

app.route('/api/feature-flag', featureFlags);
app.route('/api/scene-negotiation', sceneNegotiation);
app.route('/api/slave-training', slaveTraining);
app.route('/api/admin', admin);
app.route('/api/catalog', catalog);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
