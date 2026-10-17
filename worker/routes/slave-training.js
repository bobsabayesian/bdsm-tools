import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { bump, bumpMax, getCounters, putDoc } from '../docs';
import { session } from '../session';

const TASKS = 'slave-training-tasks';
const NO_MATCH = 'No tasks match the equipment / body parts selected';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_FEEDBACK_CHARS = 4000;

const emptyStats = () => ({
  points: 0,
  completedTasks: 0,
  failedTasks: 0,
  dailyStreak: 0,
});

const list = (value) => (value ? value.split('|').filter(Boolean) : []);

const isToday = (timestamp) =>
  new Date(timestamp).toISOString().slice(0, 10) ===
  new Date().toISOString().slice(0, 10);

const sha256Hex = async (text) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

// Tasks are only offered when every body part / piece of equipment they
// require is one the user has. Tasks requiring nothing always match.
const MATCHING_TASKS = `
  collection = ?1
  AND NOT EXISTS (
    SELECT 1 FROM json_each(docs.doc, '$.requiresBodyPart')
    WHERE value NOT IN (SELECT value FROM json_each(?2)))
  AND NOT EXISTS (
    SELECT 1 FROM json_each(docs.doc, '$.requiresEquipment')
    WHERE value NOT IN (SELECT value FROM json_each(?3)))`;

const countTasks = async (db, bodyParts, equipment) =>
  (
    await db
      .prepare(`SELECT COUNT(*) AS count FROM docs WHERE ${MATCHING_TASKS}`)
      .bind(TASKS, JSON.stringify(bodyParts), JSON.stringify(equipment))
      .first()
  ).count;

const taskAt = async (db, bodyParts, equipment, index) => {
  const row = await db
    .prepare(
      `SELECT id, doc FROM docs WHERE ${MATCHING_TASKS}
       ORDER BY added, id LIMIT 1 OFFSET ?4`,
    )
    .bind(TASKS, JSON.stringify(bodyParts), JSON.stringify(equipment), index)
    .first();
  return { _id: row.id, ...JSON.parse(row.doc) };
};

/** Respond with a task chosen by `pick(count)`, or a 400 explaining why not */
const respondWithTask = async (c, bodyParts, equipment, pick) => {
  const db = c.env.DB;
  const count = await countTasks(db, bodyParts, equipment);
  if (count === 0) return c.text(NO_MATCH, 400);

  const task = await taskAt(db, bodyParts, equipment, pick(count));
  c.header('x-bdsmtools-slave-task-count', String(count));
  return c.json(task);
};

const statsResponse = (c) => {
  const { stats, completedTasks, failedTasks } = c.get('session');
  return c.json({
    stats: stats ?? emptyStats(),
    completedTasks: (completedTasks ?? []).filter(({ timestamp }) =>
      isToday(timestamp),
    ),
    failedTasks: (failedTasks ?? []).filter(({ timestamp }) =>
      isToday(timestamp),
    ),
  });
};

export const slaveTraining = new Hono();

slaveTraining.use('*', session());

slaveTraining.get('/stats', statsResponse);

slaveTraining.get('/task', async (c) => {
  const equipment = list(getCookie(c, 'my-equipment'));
  if (equipment.length === 0) return c.text('Missing "equipment" cookie', 400);

  const bodyPart = c.req.query('bodyPart');
  if (bodyPart) {
    const response = await respondWithTask(c, [bodyPart], equipment, (count) =>
      Math.floor(Math.random() * count),
    );
    if (response.ok) await bump(c.env.DB, `randomTask.${bodyPart}`);
    return response;
  }

  const bodyParts = list(getCookie(c, 'body-parts'));
  if (bodyParts.length === 0) return c.text('Missing "body-parts" cookie', 400);

  const response = await respondWithTask(c, bodyParts, equipment, (count) =>
    Math.floor(Math.random() * count),
  );
  if (response.ok) await bump(c.env.DB, 'randomTask.any');
  return response;
});

slaveTraining.get('/daily-task', async (c) => {
  const equipment = list(getCookie(c, 'my-equipment'));
  if (equipment.length === 0) return c.text('Missing "equipment" cookie', 400);
  const bodyParts = list(getCookie(c, 'body-parts'));
  if (bodyParts.length === 0) return c.text('Missing "body-parts" cookie', 400);

  // "Today" in the user's timezone, so the daily task rolls over at their midnight
  const offsetMinutes = Number(getCookie(c, 'timezoneOffset') || 0) || 0;
  const today = new Date(Date.now() + offsetMinutes * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const dayHash = await sha256Hex(today);

  const response = await respondWithTask(
    c,
    bodyParts,
    equipment,
    (count) => parseInt(dayHash.slice(0, 8), 16) % count,
  );
  if (response.ok) await bump(c.env.DB, 'dailyTask');
  return response;
});

const requireSession = async (c, next) => {
  if (!c.get('hadSession')) return c.body(null, 401);
  await next();
};

const finishTask = (completed) => async (c) => {
  const { id: taskId } = c.req.query();
  const bonus = c.req.query('bonus') === 'true';
  const daily = c.req.query('daily') === 'true';
  if (!taskId) return c.text('Missing "id" parameter', 400);

  const db = c.env.DB;
  const data = c.get('session');
  data.stats = data.stats ?? emptyStats();
  const entry = { taskId, timestamp: new Date().toISOString(), daily };

  if (completed) {
    data.completedTasks = data.completedTasks ?? [];

    const lastDaily = data.completedTasks.findLast((task) => task.daily);
    if (daily && lastDaily) {
      const dayOf = (timestamp) => Math.floor(new Date(timestamp) / DAY_MS);
      const gap = dayOf(entry.timestamp) - dayOf(lastDaily.timestamp);
      // Completing yesterday's and today's dailies extends the streak
      if (gap === 1) data.stats.dailyStreak++;
      else if (gap > 1) data.stats.dailyStreak = 0;
    }

    data.stats.points += 100 * (bonus ? 2 : 1) * (daily ? 5 : 1);
    data.stats.completedTasks++;
    data.completedTasks.push(entry);

    await Promise.all([
      bump(db, 'taskSuccess'),
      daily && bump(db, 'dailyTaskSuccess'),
      bump(db, `tasks.success.${taskId}.standard`),
      bonus && bump(db, `tasks.success.${taskId}.bonus`),
      daily && bump(db, `tasks.success.${taskId}.daily`),
      bumpMax(db, 'dailyStreakHighScore', data.stats.dailyStreak),
    ]);
  } else {
    data.failedTasks = data.failedTasks ?? [];

    data.stats.points -= 100 * (daily ? 5 : 1);
    data.stats.failedTasks++;
    data.failedTasks.push(entry);

    await Promise.all([
      bump(db, 'taskFail'),
      daily && bump(db, 'dailyTaskFail'),
      bump(db, `tasks.fail.${taskId}.standard`),
      bonus && bump(db, `tasks.fail.${taskId}.bonus`),
      daily && bump(db, `tasks.fail.${taskId}.daily`),
    ]);
  }

  return statsResponse(c);
};

slaveTraining.post('/complete-task', requireSession, finishTask(true));
slaveTraining.post('/fail-task', requireSession, finishTask(false));

const rate = (success, fail) =>
  success + fail === 0 ? -1 : Number((success / (success + fail)).toFixed(2));

slaveTraining.get('/task/stats', async (c) => {
  const id = c.req.query('id');
  if (!id) return c.text('Missing "id" parameter', 400);

  const names = ['success', 'fail'].flatMap((outcome) =>
    ['standard', 'bonus'].map((kind) => `tasks.${outcome}.${id}.${kind}`),
  );
  const n = await getCounters(c.env.DB, names);
  const get = (outcome, kind) => n[`tasks.${outcome}.${id}.${kind}`] ?? 0;

  return c.json({
    successRate: rate(get('success', 'standard'), get('fail', 'standard')),
    successRateWithBonus: rate(get('success', 'bonus'), get('fail', 'bonus')),
  });
});

slaveTraining.post('/feedback', async (c) => {
  const taskId = c.req.query('taskId');
  const rating = Number(c.req.query('rating'));
  if (!taskId || !Number.isFinite(rating) || rating < 0 || rating > 5) {
    return c.text('Invalid "taskId" or "rating"', 400);
  }
  const text = (await c.req.text()).slice(0, MAX_FEEDBACK_CHARS);

  const db = c.env.DB;
  await putDoc(db, 'feedback', crypto.randomUUID(), {
    type: 'star',
    rating,
    text,
    when: new Date().toISOString(),
    for: 'slave-training-task',
    context: { taskId },
  });

  await db
    .prepare(
      `UPDATE docs SET doc = json_set(doc, '$.rating', json_object(
         'count', COALESCE(json_extract(doc, '$.rating.count'), 0) + 1,
         'average',
           (COALESCE(json_extract(doc, '$.rating.average'), 0)
              * COALESCE(json_extract(doc, '$.rating.count'), 0) + ?3)
           / (COALESCE(json_extract(doc, '$.rating.count'), 0) + 1)))
       WHERE collection = ?1 AND id = ?2`,
    )
    .bind(TASKS, taskId, rating)
    .run();

  return c.body(null, 204);
});
