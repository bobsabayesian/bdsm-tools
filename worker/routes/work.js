import { Hono } from 'hono';
import { noStore, requireJson, requireUser } from '../accounts';
import { catalogs, validate } from '../catalogs';
import { assessAssignment } from '../limits';
import { overLimit } from '../ratelimit';
import {
  availability,
  checkResponse,
  parseQuiz,
  SUPPORTED_PROOFS,
} from '../tasks';
import { getDoc, listDocs } from '../docs';
import { resumeDuePauses } from './dynamics';

/**
 * Tasks and rules inside a dynamic.
 *
 * Who may do what follows who has control: in a pair that is the dominant (who
 * assigns tasks, sets rules and reviews), the submissive does the tasks and may
 * comment on anything; in solo mode the one person is both. Nothing here is
 * ever visible outside the dynamic, or once it has ended.
 */

const TASKS = 'slave-training-tasks';
const MAX_COMMENT = 2000;
const MAX_RULE_TITLE = 120;
const MAX_RULE_BODY = 4000;

export const dynamicWork = new Hono();
dynamicWork.use('*', noStore, requireJson, requireUser);

const body = (c) => c.req.json().catch(() => ({}));

// ---- Who is who in this dynamic ------------------------------------------

/**
 * Returns { m } for a member of an open dynamic, or { res } with the error to
 * send. Writing needs the dynamic to be active (not paused).
 */
const guard = async (c, { write = false } = {}) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  await resumeDuePauses(db, userId);

  const { results } = await db
    .prepare(
      `SELECT d.id, d.kind, d.status, m.user_id, m.role, m.alias
       FROM dynamics d JOIN dynamic_members m ON m.dynamic_id = d.id
       WHERE d.id = ?`,
    )
    .bind(c.req.param('id'))
    .all();
  const me = results.find((row) => row.user_id === userId);
  // Not a member, or the dynamic has ended: it simply is not there
  if (!me || results[0].status === 'ended') {
    return { res: c.json({ error: 'Not found' }, 404) };
  }
  const { id, kind, status } = results[0];
  if (status === 'invited') {
    return {
      res: c.json({ error: 'Nobody has joined this dynamic yet' }, 409),
    };
  }
  if (write && status !== 'active') {
    return { res: c.json({ error: 'This dynamic is paused' }, 409) };
  }

  const controller = results.find((r) => r.role === 'dom' || r.role === 'self');
  const assignee = results.find((r) => r.role === 'sub' || r.role === 'self');
  return {
    m: {
      id,
      kind,
      status,
      me,
      controller,
      assignee,
      canAssign: controller.user_id === userId,
      isAssignee: assignee.user_id === userId,
      alias: (uid) =>
        results.find((r) => r.user_id === uid)?.alias ?? 'Someone',
    },
  };
};

// In a pair, tasks go to someone who has been through profile setup (skipping
// counts): that is when they have seen that their partner can see everything.
const assigneeReady = async (c, m) => {
  if (m.kind === 'solo') return null;
  const row = await c.env.DB.prepare(
    'SELECT profile_shared_at FROM users WHERE id = ?',
  )
    .bind(m.assignee.user_id)
    .first();
  return row.profile_shared_at
    ? null
    : c.json(
        {
          error: `${m.assignee.alias} hasn’t finished setting up their profile yet`,
          code: 'profile-not-shared',
        },
        409,
      );
};

const forbid = (c, message) => c.json({ error: message }, 403);

const selectionsOf = async (db, userId) => {
  const { results } = await db
    .prepare(
      'SELECT catalog, key, direction, state FROM user_selections WHERE user_id = ?',
    )
    .bind(userId)
    .all();
  return results;
};

// ---- Presenting things ---------------------------------------------------

// The person doing a quiz must not be able to read the answers: they get the questions only
const forViewer = (task, m) =>
  task.proof === 'quiz' && !m.canAssign
    ? { ...task, questions: parseQuiz(task.questions).map((q) => q.question) }
    : task;

const presentAssignment = (row, m, counts) => ({
  id: row.id,
  status: row.status,
  overdue:
    row.status === 'pending' &&
    !!row.due_at &&
    row.due_at < new Date().toISOString() &&
    m.status === 'active',
  task: forViewer(JSON.parse(row.task), m),
  dueAt: row.due_at,
  requiresReview: !!row.requires_review,
  attestedSoftLimits: JSON.parse(row.attested_soft_limits),
  startedAt: row.started_at,
  response: row.response ? JSON.parse(row.response) : null,
  feedback: row.feedback,
  createdAt: row.created_at,
  submittedAt: row.submitted_at,
  completedAt: row.completed_at,
  reviewedAt: row.reviewed_at,
  comments: counts.get(`assignment:${row.id}`) ?? 0,
});

const commentCounts = async (db, dynamicId) => {
  const { results } = await db
    .prepare(
      `SELECT target_type, target_id, COUNT(*) AS n FROM dynamic_comments
       WHERE dynamic_id = ? GROUP BY target_type, target_id`,
    )
    .bind(dynamicId)
    .all();
  return new Map(results.map((r) => [`${r.target_type}:${r.target_id}`, r.n]));
};

const youOf = (m) => ({
  role: m.me.role,
  canAssign: m.canAssign,
  isAssignee: m.isAssignee,
  partner:
    m.kind === 'pair'
      ? m.alias(m.canAssign ? m.assignee.user_id : m.controller.user_id)
      : null,
});

const readAssignment = async (c, m, id) => {
  const row = await c.env.DB.prepare(
    'SELECT * FROM assignments WHERE id = ? AND dynamic_id = ?',
  )
    .bind(id, m.id)
    .first();
  return row ?? null;
};

// ---- Tasks ---------------------------------------------------------------

// The fields a task has (the same ones the admin library uses), for the
// "write my own" form. Photo and location proofs are left out until supported.
dynamicWork.get('/:id/task-fields', async (c) => {
  const { m, res } = await guard(c);
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person with control can assign tasks');
  return c.json(
    catalogs.tasks.fields
      .filter((f) => !['category', 'timeOptions'].includes(f.name))
      .map((f) =>
        f.name === 'proof'
          ? {
              ...f,
              options: f.options.filter((o) =>
                SUPPORTED_PROOFS.includes(o.value),
              ),
            }
          : f,
      ),
  );
});

dynamicWork.get('/:id/tasks', async (c) => {
  const { m, res } = await guard(c);
  if (res) return res;
  const db = c.env.DB;
  const [{ results }, counts] = await Promise.all([
    db
      .prepare(
        'SELECT * FROM assignments WHERE dynamic_id = ? ORDER BY created_at DESC LIMIT 200',
      )
      .bind(m.id)
      .all(),
    commentCounts(db, m.id),
  ]);
  return c.json({
    dynamic: { id: m.id, kind: m.kind, status: m.status },
    you: youOf(m),
    assignments: results.map((row) => presentAssignment(row, m, counts)),
  });
});

// The task library, with what is and is not possible for the person who would do it
dynamicWork.get('/:id/library', async (c) => {
  const { m, res } = await guard(c);
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person with control can assign tasks');
  const notReady = await assigneeReady(c, m);
  if (notReady) return notReady;
  const db = c.env.DB;

  const [tasks, selections] = await Promise.all([
    listDocs(db, TASKS, { limit: 500 }),
    selectionsOf(db, m.assignee.user_id),
  ]);
  const fields = catalogs.tasks.fields.map((f) => f.name);

  return c.json(
    tasks
      .filter((task) => task.task)
      .map((task) => {
        const a = availability(task, selections);
        return {
          id: task._id,
          ...Object.fromEntries(
            fields
              .filter((f) => task[f] !== undefined)
              .map((f) => [f, task[f]]),
          ),
          availability: a,
        };
      }),
  );
});

const parseDue = (dueAt) => {
  if (dueAt === undefined || dueAt === null || dueAt === '')
    return { due: null };
  const when = new Date(dueAt);
  const now = Date.now();
  if (
    Number.isNaN(when.getTime()) ||
    when.getTime() < now - 5 * 60 * 1000 ||
    when.getTime() > now + 3 * 366 * 24 * 3600 * 1000
  ) {
    return { error: 'The due date must be in the future (within three years)' };
  }
  return { due: when.toISOString() };
};

dynamicWork.post('/:id/tasks', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person with control can assign tasks');
  const notReady = await assigneeReady(c, m);
  if (notReady) return notReady;
  const db = c.env.DB;
  const input = await body(c);

  // The task: from the library, or written for this dynamic - checked the same way
  let source = input.task;
  let templateId = null;
  if (input.templateId) {
    const template = await getDoc(db, TASKS, String(input.templateId));
    if (!template) return c.json({ error: 'That task no longer exists' }, 404);
    source = template;
    templateId = template._id;
  }
  const checked = validate(catalogs.tasks, source);
  if (checked.errors) return c.json({ errors: checked.errors }, 400);
  const task = checked.value;
  delete task.category;

  const { due, error } = parseDue(input.dueAt);
  if (error) return c.json({ error }, 400);

  // Can the person who would do it actually do it?
  const selections = await selectionsOf(db, m.assignee.user_id);
  const attested = Array.isArray(input.attested)
    ? input.attested.filter(
        (a) =>
          typeof a?.key === 'string' &&
          (a.direction === 'give' || a.direction === 'receive'),
      )
    : [];
  const options = availability(task, selections);
  if (options.reasons.length > 0) {
    return c.json(
      {
        error: 'That task is not available for this dynamic',
        code: 'unavailable',
        reasons: options.reasons,
      },
      409,
    );
  }
  const verdict = assessAssignment(task, selections, attested);
  if (verdict.reason === 'hard-limit') {
    return c.json(
      {
        error: 'That task crosses a hard limit',
        code: 'hard-limit',
        hardLimits: verdict.hardLimits,
      },
      409,
    );
  }
  // In solo mode there is no partner to have talked to
  if (verdict.reason === 'attestation-required' && m.kind !== 'solo') {
    return c.json(
      {
        error: 'Please attest that you have talked about the soft limits',
        code: 'attestation-required',
        missing: verdict.missing,
      },
      409,
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO assignments (id, dynamic_id, assigned_by, assigned_to, template_id, task, status,
         requires_review, due_at, attested_soft_limits, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    )
    .bind(
      id,
      m.id,
      m.me.user_id,
      m.assignee.user_id,
      templateId,
      JSON.stringify(task),
      m.kind === 'pair' && input.requiresReview === true ? 1 : 0,
      due,
      JSON.stringify(m.kind === 'solo' ? [] : verdict.attested),
      now,
    )
    .run();

  const row = await readAssignment(c, m, id);
  return c.json(presentAssignment(row, m, new Map()), 201);
});

// Starting a timer task: the server notes when, and checks the time was served
dynamicWork.post('/:id/tasks/:aid/start', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  const row = await readAssignment(c, m, c.req.param('aid'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.assigned_to !== m.me.user_id)
    return forbid(c, 'This task is not yours to do');
  if (row.status !== 'pending')
    return c.json({ error: 'This task is not waiting to be done' }, 409);
  if (JSON.parse(row.task).proof !== 'timer')
    return c.json({ error: 'This task has no timer' }, 400);

  await c.env.DB.prepare('UPDATE assignments SET started_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), row.id)
    .run();
  return c.json(
    presentAssignment(await readAssignment(c, m, row.id), m, new Map()),
  );
});

dynamicWork.post('/:id/tasks/:aid/submit', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  const row = await readAssignment(c, m, c.req.param('aid'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.assigned_to !== m.me.user_id)
    return forbid(c, 'This task is not yours to do');
  if (row.status !== 'pending')
    return c.json({ error: 'This task is not waiting to be done' }, 409);

  const result = checkResponse(JSON.parse(row.task), (await body(c)).response, {
    startedAt: row.started_at ? new Date(row.started_at).getTime() : undefined,
    now: Date.now(),
  });
  if (!result.ok)
    return c.json({ error: result.error, incorrect: result.incorrect }, 422);

  const now = new Date().toISOString();
  const review = !!row.requires_review;
  await c.env.DB.prepare(
    `UPDATE assignments SET status = ?, response = ?, submitted_at = ?, completed_at = ?, feedback = NULL WHERE id = ?`,
  )
    .bind(
      review ? 'submitted' : 'done',
      JSON.stringify(result.response),
      now,
      review ? null : now,
      row.id,
    )
    .run();
  return c.json(
    presentAssignment(await readAssignment(c, m, row.id), m, new Map()),
  );
});

// The person with control looks over what was submitted: approve it, or send it back
dynamicWork.post('/:id/tasks/:aid/review', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person who assigned this can review it');
  const row = await readAssignment(c, m, c.req.param('aid'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.status !== 'submitted')
    return c.json({ error: 'There is nothing to review' }, 409);

  const { approve, note } = await body(c);
  if (typeof approve !== 'boolean')
    return c.json({ error: 'Say whether to approve it' }, 400);
  if (
    note !== undefined &&
    (typeof note !== 'string' || note.length > MAX_COMMENT)
  ) {
    return c.json({ error: 'That note is too long' }, 400);
  }
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    approve
      ? `UPDATE assignments SET status = 'done', completed_at = ?, reviewed_at = ?, feedback = ? WHERE id = ?`
      : `UPDATE assignments SET status = 'pending', response = NULL, started_at = NULL, submitted_at = NULL, reviewed_at = ?, feedback = ? WHERE id = ?`,
  )
    .bind(...(approve ? [now, now] : [now]), note?.trim() || null, row.id)
    .run();
  return c.json(
    presentAssignment(await readAssignment(c, m, row.id), m, new Map()),
  );
});

const closeTask = (status, from) => async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person who assigned this can do that');
  const row = await readAssignment(c, m, c.req.param('aid'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (!from.includes(row.status))
    return c.json({ error: 'That cannot be done to this task now' }, 409);

  await c.env.DB.prepare(
    'UPDATE assignments SET status = ?, completed_at = ? WHERE id = ?',
  )
    .bind(status, new Date().toISOString(), row.id)
    .run();
  return c.json(
    presentAssignment(await readAssignment(c, m, row.id), m, new Map()),
  );
};
dynamicWork.post(
  '/:id/tasks/:aid/cancel',
  closeTask('cancelled', ['pending', 'submitted']),
);
// A neutral record, not a punishment: nothing else changes when a task is marked not done
dynamicWork.post(
  '/:id/tasks/:aid/not-done',
  closeTask('not-done', ['pending']),
);

// ---- Rules ---------------------------------------------------------------
// Whoever has control sets the rules; the other person can comment on them but
// there is nothing for them to approve. In a pair, making or changing a rule
// needs the setter to attest they have discussed it - checked here, not only by
// the button.

const needsAttestation = (m, input) =>
  m.kind === 'pair' && input.attested !== true
    ? {
        error: 'Please attest that you have discussed this with your partner',
        code: 'attestation-required',
      }
    : null;

const checkRule = (input, { partial = false } = {}) => {
  const out = {};
  for (const [field, max, label] of [
    ['title', MAX_RULE_TITLE, 'Title'],
    ['body', MAX_RULE_BODY, 'The rule'],
  ]) {
    if (input[field] === undefined && partial) continue;
    const text = typeof input[field] === 'string' ? input[field].trim() : '';
    if (!text) return { error: `${label} is required` };
    if (text.length > max) return { error: `${label} is too long` };
    out[field] = text;
  }
  return { rule: out };
};

const presentRule = (row, m, counts) => ({
  id: row.id,
  title: row.title,
  body: row.body,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  attestedAt: row.attested_at,
  comments: counts.get(`rule:${row.id}`) ?? 0,
});

dynamicWork.get('/:id/rules', async (c) => {
  const { m, res } = await guard(c);
  if (res) return res;
  const db = c.env.DB;
  const [{ results }, counts] = await Promise.all([
    db
      .prepare(
        'SELECT * FROM dynamic_rules WHERE dynamic_id = ? ORDER BY created_at',
      )
      .bind(m.id)
      .all(),
    commentCounts(db, m.id),
  ]);
  return c.json({
    you: youOf(m),
    rules: results.map((row) => presentRule(row, m, counts)),
  });
});

dynamicWork.post('/:id/rules', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person with control can set rules');
  const input = await body(c);
  const missing = needsAttestation(m, input);
  if (missing) return c.json(missing, 400);
  const { rule, error } = checkRule(input);
  if (error) return c.json({ error }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO dynamic_rules (id, dynamic_id, title, body, status, created_by, created_at, updated_at, attested_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
  )
    .bind(
      id,
      m.id,
      rule.title,
      rule.body,
      m.me.user_id,
      now,
      now,
      m.kind === 'pair' ? now : null,
    )
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM dynamic_rules WHERE id = ?')
    .bind(id)
    .first();
  return c.json(presentRule(row, m, new Map()), 201);
});

const findRule = (c, m) =>
  c.env.DB.prepare(
    'SELECT * FROM dynamic_rules WHERE id = ? AND dynamic_id = ?',
  )
    .bind(c.req.param('rid'), m.id)
    .first();

dynamicWork.put('/:id/rules/:rid', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person with control can change rules');
  const row = await findRule(c, m);
  if (!row) return c.json({ error: 'Not found' }, 404);
  const input = await body(c);
  const missing = needsAttestation(m, input);
  if (missing) return c.json(missing, 400);
  const { rule, error } = checkRule(input, { partial: true });
  if (error) return c.json({ error }, 400);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'UPDATE dynamic_rules SET title = ?, body = ?, updated_at = ?, attested_at = ? WHERE id = ?',
  )
    .bind(
      rule.title ?? row.title,
      rule.body ?? row.body,
      now,
      m.kind === 'pair' ? now : null,
      row.id,
    )
    .run();
  const updated = await c.env.DB.prepare(
    'SELECT * FROM dynamic_rules WHERE id = ?',
  )
    .bind(row.id)
    .first();
  return c.json(presentRule(updated, m, await commentCounts(c.env.DB, m.id)));
});

// Retiring a rule needs no attestation; bringing one back does, like making it
dynamicWork.post('/:id/rules/:rid/retire', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person with control can change rules');
  const row = await findRule(c, m);
  if (!row) return c.json({ error: 'Not found' }, 404);
  await c.env.DB.prepare(
    `UPDATE dynamic_rules SET status = 'retired', updated_at = ? WHERE id = ?`,
  )
    .bind(new Date().toISOString(), row.id)
    .run();
  return c.body(null, 204);
});

dynamicWork.post('/:id/rules/:rid/restore', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person with control can change rules');
  const row = await findRule(c, m);
  if (!row) return c.json({ error: 'Not found' }, 404);
  const missing = needsAttestation(m, await body(c));
  if (missing) return c.json(missing, 400);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE dynamic_rules SET status = 'active', updated_at = ?, attested_at = ? WHERE id = ?`,
  )
    .bind(now, m.kind === 'pair' ? now : null, row.id)
    .run();
  return c.body(null, 204);
});

// ---- Comments on rules and tasks ----------------------------------------
// Either person can comment. This is how a rule gets talked about - comments
// are not approvals, and nothing changes because of them.

const readTarget = async (c, m, target) => {
  const [type, id] = String(target ?? '').split(':');
  if (!['rule', 'assignment'].includes(type) || !id) return null;
  const table = type === 'rule' ? 'dynamic_rules' : 'assignments';
  const found = await c.env.DB.prepare(
    `SELECT id FROM ${table} WHERE id = ? AND dynamic_id = ?`,
  )
    .bind(id, m.id)
    .first();
  return found ? { type, id } : null;
};

dynamicWork.get('/:id/comments', async (c) => {
  const { m, res } = await guard(c);
  if (res) return res;
  const target = await readTarget(c, m, c.req.query('target'));
  if (!target) return c.json({ error: 'Not found' }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT id, user_id, body, created_at FROM dynamic_comments
     WHERE target_type = ? AND target_id = ? ORDER BY created_at`,
  )
    .bind(target.type, target.id)
    .all();
  return c.json(
    results.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      by: row.user_id === m.me.user_id ? 'you' : 'them',
      alias: m.alias(row.user_id),
    })),
  );
});

dynamicWork.post('/:id/comments', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  const input = await body(c);
  const target = await readTarget(c, m, input.target);
  if (!target) return c.json({ error: 'Not found' }, 404);
  const text = typeof input.body === 'string' ? input.body.trim() : '';
  if (!text || text.length > MAX_COMMENT) {
    return c.json(
      { error: `A comment must be 1-${MAX_COMMENT} characters` },
      400,
    );
  }
  if (await overLimit(c.env.DB, `comment:${m.me.user_id}`, 100, 3600 * 1000)) {
    return c.json({ error: 'Too many comments - please wait a while' }, 429);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO dynamic_comments (id, dynamic_id, target_type, target_id, user_id, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, m.id, target.type, target.id, m.me.user_id, text, now)
    .run();
  return c.json(
    { id, body: text, createdAt: now, by: 'you', alias: m.me.alias },
    201,
  );
});
