import { Hono } from 'hono';
import { noStore, requireJson, requireUser } from '../accounts';
import { catalogs } from '../catalogs';

/**
 * What a person has chosen to include or avoid. Private to them: nothing here
 * is shown to anyone in their dynamics.
 *
 * Body parts are about what someone wants *included* in tasks - not a
 * statement of anatomy or identity, and nobody is asked for either.
 */

// The setup steps, in order. Each is a catalog people choose from, and the
// states a choice can have. (Kinks will join as yes / maybe / no.)
const STEPS = {
  bodyParts: { states: ['yes'] },
};
const MAX_CHOICES = 300;

export const profile = new Hono();
profile.use('*', noStore, requireJson, requireUser);

const readSteps = async (db, userId) => {
  const row = await db
    .prepare('SELECT profile_steps FROM users WHERE id = ?')
    .bind(userId)
    .first();
  return JSON.parse(row.profile_steps);
};

const writeStep = (db, userId, steps, step, status) =>
  db
    .prepare('UPDATE users SET profile_steps = ? WHERE id = ?')
    .bind(JSON.stringify({ ...steps, [step]: status }), userId);

profile.get('/', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const [done, { results }] = await Promise.all([
    readSteps(db, userId),
    db
      .prepare(
        'SELECT catalog, key, state FROM user_selections WHERE user_id = ?',
      )
      .bind(userId)
      .all(),
  ]);

  const steps = Object.keys(STEPS).map((id) => ({
    id,
    status: done[id] ?? null,
  }));
  return c.json({
    steps,
    nextStep: steps.find((step) => !step.status)?.id ?? null,
    selections: Object.fromEntries(
      Object.keys(STEPS).map((id) => [
        id,
        results
          .filter((row) => row.catalog === id)
          .map(({ key, state }) => ({ key, state })),
      ]),
    ),
  });
});

// Replace everything chosen in one catalog: { choices: [{ key, state }] }
// (or { keys: [...] } for catalogs where the only state is 'yes')
profile.put('/:step', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const step = c.req.param('step');
  if (!Object.hasOwn(STEPS, step)) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json().catch(() => ({}));
  const choices = Array.isArray(body.choices)
    ? body.choices
    : Array.isArray(body.keys)
      ? body.keys.map((key) => ({ key, state: 'yes' }))
      : null;
  if (
    !choices ||
    choices.length > MAX_CHOICES ||
    choices.some(
      (choice) =>
        typeof choice?.key !== 'string' ||
        !STEPS[step].states.includes(choice.state),
    )
  ) {
    return c.json({ error: 'Invalid choices' }, 400);
  }

  // Only things that exist and are switched on can be chosen
  const { results: valid } = await db
    .prepare(
      `SELECT json_extract(doc, '$.key') AS key FROM docs
       WHERE collection = ? AND json_extract(doc, '$.active') = 1`,
    )
    .bind(catalogs[step].collection)
    .all();
  const allowed = new Set(valid.map(({ key }) => key));
  if (choices.some(({ key }) => !allowed.has(key))) {
    return c.json({ error: 'Some choices are not available' }, 400);
  }

  const unique = new Map(choices.map(({ key, state }) => [key, state]));
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare('DELETE FROM user_selections WHERE user_id = ? AND catalog = ?')
      .bind(userId, step),
    ...[...unique].map(([key, state]) =>
      db
        .prepare(
          'INSERT INTO user_selections (user_id, catalog, key, state, updated_at) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(userId, step, key, state, now),
    ),
    writeStep(db, userId, await readSteps(db, userId), step, 'done'),
  ]);
  return c.body(null, 204);
});

// "Not now" - recorded so setup is not forced on anyone, and can be done later
profile.post('/steps/:step/skip', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const step = c.req.param('step');
  if (!Object.hasOwn(STEPS, step)) return c.json({ error: 'Not found' }, 404);

  const steps = await readSteps(db, userId);
  if (steps[step] !== 'done')
    await writeStep(db, userId, steps, step, 'skipped').run();
  return c.body(null, 204);
});
