import { Hono } from 'hono';
import { noStore, requireJson, requireUser } from '../accounts';
import { catalogs } from '../catalogs';
import { LEVELS, sidesFor } from '../limits';
import { DEFAULT_MIN_DAYS, wholeDays } from '../rules';

/**
 * What a person has chosen to include or avoid. Everyone in a dynamic with them
 * sees all of it (see GET /api/dynamics/:id/profile) - nothing is hidden -
 * but only once they have seen that said (`profile_shared_at`), and never
 * after a dynamic has ended.
 *
 * Body parts are about what someone wants *included* in tasks - not a
 * statement of anatomy or identity, and nobody is asked for either. Kinks are
 * rated on the scale in limits.js, separately for giving and receiving.
 */

// In the order setup walks through them
// My Body is its own screen. "What's in bounds?" is four lists on another
// (body & anatomy, clothing, items, spaces): each is saved and skipped
// separately here so the lists can change independently.
const STEPS = {
  bodyParts: { states: ['yes'], sided: false },
  boundsBody: { states: ['yes'], sided: false },
  boundsClothing: { states: ['yes'], sided: false },
  equipment: { states: ['yes'], sided: false },
  boundsSpaces: { states: ['yes'], sided: false },
  kinks: { states: LEVELS, sided: true },
};

// The optional "Me" tab - never part of the setup walk-through, never required
const MAX_PRONOUNS = 10;
const MAX_PRONOUN_LENGTH = 40;
const MAX_ABOUT = 2000;
const MAX_DISPLAY_NAME = 40; // the same limit as a name within a dynamic
const MAX_CHOICES = 600;

export const profile = new Hono();
profile.use('*', noStore, requireJson, requireUser);

/** The active items of a step's catalog: { key -> { sides } } */
const activeItems = async (db, step) => {
  const { results } = await db
    .prepare(
      `SELECT json_extract(doc, '$.key') AS key, json_extract(doc, '$.sides') AS sides
       FROM docs WHERE collection = ? AND json_extract(doc, '$.active') = 1`,
    )
    .bind(catalogs[step].collection)
    .all();
  return new Map(results.map(({ key, sides }) => [key, sides]));
};

// A step only exists while there is something to choose from
const availableSteps = async (db) => {
  const available = [];
  for (const step of Object.keys(STEPS)) {
    if ((await activeItems(db, step)).size > 0) available.push(step);
  }
  return available;
};

const markShared = (db, userId, now) =>
  db
    .prepare(
      'UPDATE users SET profile_shared_at = COALESCE(profile_shared_at, ?) WHERE id = ?',
    )
    .bind(now, userId);

// `minDays` is the person's own "rule change minimum" (kept on the user)
// `displayName` is only passed when a person reads their own - it is a private
// default for naming themselves in a dynamic, never shown to partners.
export const readAbout = (
  row,
  minDays = DEFAULT_MIN_DAYS,
  displayName = undefined,
) => ({
  genders: row ? JSON.parse(row.genders) : [],
  pronouns: row ? JSON.parse(row.pronouns) : [],
  about: row ? row.about : '',
  ruleChangeMinDays: minDays,
  ...(displayName === undefined ? {} : { displayName: displayName ?? '' }),
});

const readSteps = async (db, userId) => {
  const row = await db
    .prepare('SELECT profile_steps FROM users WHERE id = ?')
    .bind(userId)
    .first();
  return JSON.parse(row.profile_steps);
};

// One atomic update, so several lists being saved at once cannot overwrite each
// other's "done". A finished step is never changed to "skipped".
const writeStep = (db, userId, step, status) =>
  db
    .prepare(
      `UPDATE users SET profile_steps = CASE
         WHEN ?3 = 'skipped' AND json_extract(profile_steps, '$.' || ?2) = 'done' THEN profile_steps
         ELSE json_set(profile_steps, '$.' || ?2, ?3)
       END
       WHERE id = ?1`,
    )
    .bind(userId, step, status);

profile.get('/', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const [done, available, { results }, aboutRow] = await Promise.all([
    readSteps(db, userId),
    availableSteps(db),
    db
      .prepare(
        'SELECT catalog, key, direction, state FROM user_selections WHERE user_id = ?',
      )
      .bind(userId)
      .all(),
    db
      .prepare(
        'SELECT genders, pronouns, about FROM user_about WHERE user_id = ?',
      )
      .bind(userId)
      .first(),
  ]);

  const {
    profile_shared_at: sharedAt,
    rule_change_min_days: minDays,
    display_name: displayName,
  } = await db
    .prepare(
      'SELECT profile_shared_at, rule_change_min_days, display_name FROM users WHERE id = ?',
    )
    .bind(userId)
    .first();

  const steps = available.map((id) => ({ id, status: done[id] ?? null }));
  return c.json({
    steps,
    // Answers given before sharing was explained stay hidden until confirmed
    sharing: {
      sharedAt,
      needsReview: !sharedAt && (results.length > 0 || !!aboutRow),
    },
    me: readAbout(aboutRow, minDays, displayName),
    nextStep: steps.find((step) => !step.status)?.id ?? null,
    selections: Object.fromEntries(
      Object.keys(STEPS).map((id) => [
        id,
        results
          .filter((row) => row.catalog === id)
          .map(({ key, direction, state }) => ({
            key,
            state,
            ...(STEPS[id].sided ? { direction } : {}),
          })),
      ]),
    ),
  });
});

// The "Me" tab: { genders: [keys], pronouns: [text], about: text } - all optional
profile.put('/me', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const body = await c.req.json().catch(() => ({}));

  const genders = body.genders ?? [];
  const pronouns = body.pronouns ?? [];
  const about = body.about ?? '';
  // How long a rule must stand before it can be changed; left alone if not sent
  const minDays =
    body.ruleChangeMinDays === undefined
      ? undefined
      : wholeDays(body.ruleChangeMinDays);
  // The name pre-filled when starting or joining a dynamic; '' clears it
  // eslint-disable-next-line no-control-regex
  const controls = /[\u0000-\u001f]/g;
  const displayName =
    body.displayName === undefined
      ? undefined
      : typeof body.displayName === 'string'
        ? body.displayName.replace(controls, '').trim()
        : null;
  const textList = (list) =>
    Array.isArray(list) &&
    list.every((item) => typeof item === 'string' && item.trim().length > 0);
  if (
    !textList(genders) ||
    !textList(pronouns) ||
    pronouns.length > MAX_PRONOUNS ||
    pronouns.some((item) => item.length > MAX_PRONOUN_LENGTH) ||
    typeof about !== 'string' ||
    about.length > MAX_ABOUT ||
    minDays === null ||
    displayName === null ||
    (displayName !== undefined && displayName.length > MAX_DISPLAY_NAME)
  ) {
    return c.json({ error: 'Invalid details' }, 400);
  }

  const { results: valid } = await db
    .prepare(
      `SELECT json_extract(doc, '$.key') AS key FROM docs
       WHERE collection = ? AND json_extract(doc, '$.active') = 1`,
    )
    .bind(catalogs.genders.collection)
    .all();
  const allowed = new Set(valid.map(({ key }) => key));
  if (genders.some((key) => !allowed.has(key))) {
    return c.json({ error: 'Some choices are not available' }, 400);
  }

  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO user_about (user_id, genders, pronouns, about, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET genders = excluded.genders,
           pronouns = excluded.pronouns, about = excluded.about, updated_at = excluded.updated_at`,
      )
      .bind(
        userId,
        JSON.stringify([...new Set(genders)]),
        JSON.stringify([...new Set(pronouns.map((item) => item.trim()))]),
        about.trim(),
        now,
      ),
    ...(minDays === undefined
      ? []
      : [
          db
            .prepare('UPDATE users SET rule_change_min_days = ? WHERE id = ?')
            .bind(minDays, userId),
        ]),
    ...(displayName === undefined
      ? []
      : [
          db
            .prepare('UPDATE users SET display_name = ? WHERE id = ?')
            .bind(displayName || null, userId),
        ]),
    markShared(db, userId, now),
  ]);
  return c.body(null, 204);
});

// Replace everything chosen in one catalog:
//   { choices: [{ key, state, direction? }] }   (or { keys } for body parts)
profile.put('/:step', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const step = c.req.param('step');
  if (!Object.hasOwn(STEPS, step)) return c.json({ error: 'Not found' }, 404);

  const items = await activeItems(db, step);
  if (items.size === 0) return c.json({ error: 'Not found' }, 404);

  const { states, sided } = STEPS[step];
  const body = await c.req.json().catch(() => ({}));
  const choices = Array.isArray(body.choices)
    ? body.choices
    : Array.isArray(body.keys)
      ? body.keys.map((key) => ({ key, state: 'yes' }))
      : null;
  if (!choices || choices.length > MAX_CHOICES) {
    return c.json({ error: 'Invalid choices' }, 400);
  }

  const rows = new Map();
  for (const choice of choices) {
    const direction = sided ? choice?.direction : '';
    const valid =
      typeof choice?.key === 'string' &&
      states.includes(choice.state) &&
      // Only things that exist and are switched on, on a side that makes sense
      items.has(choice.key) &&
      (sided ? sidesFor(items.get(choice.key)).includes(direction) : true);
    if (!valid) return c.json({ error: 'Some choices are not available' }, 400);
    rows.set(`${choice.key}/${direction}`, {
      key: choice.key,
      direction,
      state: choice.state,
    });
  }

  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare('DELETE FROM user_selections WHERE user_id = ? AND catalog = ?')
      .bind(userId, step),
    ...[...rows.values()].map(({ key, direction, state }) =>
      db
        .prepare(
          `INSERT INTO user_selections (user_id, catalog, key, direction, state, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(userId, step, key, direction, state, now),
    ),
    writeStep(db, userId, step, 'done'),
    markShared(db, userId, now),
  ]);
  return c.body(null, 204);
});

// "Not now" - recorded so setup is not forced on anyone, and can be done later
profile.post('/steps/:step/skip', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const step = c.req.param('step');
  if (!(await availableSteps(db)).includes(step)) {
    return c.json({ error: 'Not found' }, 404);
  }

  await db.batch([
    writeStep(db, userId, step, 'skipped'),
    markShared(db, userId, new Date().toISOString()),
  ]);
  return c.body(null, 204);
});

// "I understand my partners can see these" - for answers given before that was said
profile.post('/share', async (c) => {
  await markShared(c.env.DB, c.get('user').id, new Date().toISOString()).run();
  return c.body(null, 204);
});
