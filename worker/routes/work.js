import { Hono } from 'hono';
import { noStore, requireJsonUnlessUpload, requireUser } from '../accounts';
import { catalogs, validate } from '../catalogs';
import { assessAssignment } from '../limits';
import { overLimit } from '../ratelimit';
import { isLocked, lockFor, MAX_DAYS, wholeDays } from '../rules';
import {
  availability,
  checkResponse,
  parseQuiz,
  REQUIRED_FIELDS,
  SUPPORTED_PROOFS,
} from '../tasks';
import {
  acceptedKinds,
  bareType,
  kindOf,
  MEDIA_KINDS,
  mediaKey,
  parseRange,
} from '../media';
import {
  daysFor,
  effectiveDays,
  fullPolicy,
  parseFields,
  parseKinds,
  parsePolicy,
  visibility,
} from '../retention';
import {
  endOfLocalDay,
  finished,
  localDate,
  occursOn,
  readRepeat,
} from '../schedule';
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
dynamicWork.use('*', noStore, requireJsonUnlessUpload, requireUser);

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
      `SELECT d.id, d.kind, d.status, m.user_id, m.role, m.alias, m.name
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
      // people are spoken of by name (Zak), not title (Sir)
      alias: (uid) => {
        const found = results.find((r) => r.user_id === uid);
        return found ? (found.name ?? found.alias) : 'Someone';
      },
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
          error: `${m.assignee.name ?? m.assignee.alias} hasn’t finished setting up their profile yet`,
          code: 'profile-not-shared',
        },
        409,
      );
};

const forbid = (c, message) => c.json({ error: message }, 403);

/** { policy, unwilling } - what someone has said about retention and kinds of task */
const preferencesOf = async (db, userId) => {
  const row = await db
    .prepare(
      'SELECT data_retention, unwilling_task_types, required_task_fields FROM users WHERE id = ?',
    )
    .bind(userId)
    .first();
  return {
    policy: parsePolicy(row?.data_retention),
    unwilling: parseKinds(row?.unwilling_task_types),
    required: parseFields(row?.required_task_fields, REQUIRED_FIELDS),
  };
};

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

const presentAssignment = (row, m, counts) => {
  // what is left of a submission once the doer's retention days have passed
  const shown = visibility({
    submittedAt: row.submitted_at,
    days: row.retention_days,
    isOwner: row.assigned_to === m.me.user_id,
  });
  return {
    id: row.id,
    status: row.status,
    overdue:
      row.status === 'pending' &&
      !row.queued &&
      !!row.due_at &&
      row.due_at < new Date().toISOString() &&
      m.status === 'active',
    task: forViewer(JSON.parse(row.task), m),
    dueAt: row.due_at,
    queued: !!row.queued,
    consequenceFor: row.consequence_for,
    requiresReview: !!row.requires_review,
    attestedSoftLimits: JSON.parse(row.attested_soft_limits),
    startedAt: row.started_at,
    response:
      row.response && shown === 'visible' ? JSON.parse(row.response) : null,
    // why a submission can't be seen: 'hidden' (the doer's days have passed) or 'deleted'
    responseGone: shown === 'visible' ? null : shown,
    retentionDays: row.retention_days,
    feedback: row.feedback,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    reviewedAt: row.reviewed_at,
    comments: counts.get(`assignment:${row.id}`) ?? 0,
  };
};

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
  await makeDueOccurrences(db, m);
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

// What you need to know to assign: days of content retention (your default
// for tasks you set, and the most your partner allows, for each kind of
// proof) and the parts of a task your partner requires to be filled in
dynamicWork.get('/:id/assign-options', async (c) => {
  const { m, res } = await guard(c);
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person with control can assign tasks');
  const [mine, theirs] = await Promise.all([
    preferencesOf(c.env.DB, m.me.user_id),
    preferencesOf(c.env.DB, m.assignee.user_id),
  ]);
  return c.json({
    mine: fullPolicy(mine.policy),
    theirs: fullPolicy(theirs.policy),
    // parts of a task they require to be filled in before it is assigned
    requiredFields: theirs.required,
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

  const [tasks, selections, { unwilling, required }] = await Promise.all([
    listDocs(db, TASKS, { limit: 500 }),
    selectionsOf(db, m.assignee.user_id),
    preferencesOf(db, m.assignee.user_id),
  ]);
  const fields = catalogs.tasks.fields.map((f) => f.name);

  return c.json(
    tasks
      .filter((task) => task.task)
      .map((task) => {
        const a = availability(task, selections, unwilling, required);
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

const insertAssignment = (db, a) =>
  db
    .prepare(
      `INSERT INTO assignments (id, dynamic_id, assigned_by, assigned_to, template_id, task, status,
         requires_review, due_at, attested_soft_limits, created_at, retention_days,
         consequence_for, queued, schedule_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      a.id,
      a.dynamicId,
      a.assignedBy,
      a.assignedTo,
      a.templateId ?? null,
      JSON.stringify(a.task),
      a.requiresReview ? 1 : 0,
      a.due ?? null,
      JSON.stringify(a.attested ?? []),
      a.createdAt,
      a.retentionDays,
      a.consequenceFor ?? null,
      a.queued ? 1 : 0,
      a.scheduleId ?? null,
    );

/** How long what they submit is kept: the shorter of the setter's wish and the doer's maximum */
const retentionFor = async (db, setterId, doerPolicy, task, requested) => {
  const setter = await preferencesOf(db, setterId);
  const proof = task.proof ?? 'attestation';
  return effectiveDays({
    requested,
    setterDefault: daysFor(setter.policy, proof),
    doerMax: daysFor(doerPolicy, proof),
  });
};

/**
 * Repeating tasks make their day's task the first time anyone opens the
 * dynamic's tasks that day. Days nobody looked at are not made up afterwards,
 * and a day is skipped (with a note) if the task has since become something the
 * person cannot be given - a hard limit, a task type they are no longer up
 * for - so a schedule never gets around what they have said.
 */
const makeDueOccurrences = async (db, m) => {
  if (m.status !== 'active') return;
  const { results } = await db
    .prepare(
      "SELECT * FROM task_schedules WHERE dynamic_id = ? AND status = 'active'",
    )
    .bind(m.id)
    .all();
  const now = Date.now();
  for (const s of results) {
    const today = localDate(now, s.tz_offset);
    if (finished(s, today)) {
      await db
        .prepare("UPDATE task_schedules SET status = 'stopped' WHERE id = ?")
        .bind(s.id)
        .run();
      continue;
    }
    if (s.last_date === today || !occursOn(s, today)) continue;
    // claim the day first, so two people opening the page cannot both make it
    const claimed = await db
      .prepare(
        'UPDATE task_schedules SET last_date = ?1, note = NULL WHERE id = ?2 AND (last_date IS NULL OR last_date <> ?1)',
      )
      .bind(today, s.id)
      .run();
    if (claimed.meta.changes !== 1) continue;

    const task = JSON.parse(s.task);
    const doer = await preferencesOf(db, s.assigned_to);
    const selections = await selectionsOf(db, s.assigned_to);
    const options = availability(
      task,
      selections,
      doer.unwilling,
      doer.required,
    );
    const verdict = assessAssignment(
      task,
      selections,
      JSON.parse(s.attested_soft_limits),
    );
    const fine =
      options.reasons.length === 0 &&
      (verdict.allowed ||
        (m.kind === 'solo' && verdict.reason === 'attestation-required'));
    if (!fine) {
      await db
        .prepare('UPDATE task_schedules SET note = ? WHERE id = ?')
        .bind(`Skipped ${today}: it can no longer be given as it stands`, s.id)
        .run();
      continue;
    }
    await insertAssignment(db, {
      id: crypto.randomUUID(),
      dynamicId: m.id,
      assignedBy: s.created_by,
      assignedTo: s.assigned_to,
      task,
      requiresReview: !!s.requires_review,
      due: endOfLocalDay(today, s.tz_offset),
      attested: JSON.parse(s.attested_soft_limits),
      createdAt: new Date(now).toISOString(),
      retentionDays: await retentionFor(
        db,
        s.created_by,
        doer.policy,
        task,
        s.retention_days_requested,
      ),
      scheduleId: s.id,
    }).run();
  }
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
          ['give', 'receive', 'any'].includes(a.direction),
      )
    : [];
  const doer = await preferencesOf(db, m.assignee.user_id);
  const options = availability(task, selections, doer.unwilling, doer.required);
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
  // Some people require a due time before a task can be given to them
  const repeatInput = input.repeat;
  const today = localDate(
    Date.now(),
    Number.isInteger(repeatInput?.tzOffset) ? repeatInput.tzOffset : 0,
  );
  let repeat = null;
  if (repeatInput) {
    if (input.consequenceFor)
      return c.json({ error: 'A consequence cannot repeat' }, 400);
    const read = readRepeat(repeatInput, today);
    if (read.error) return c.json({ error: read.error }, 400);
    repeat = read.repeat;
  }
  const dueAt = repeat ? endOfLocalDay(today, repeat.tzOffset) : due;
  if (doer.required.includes('due') && !dueAt) {
    return c.json(
      {
        error: 'A due time is required for this person',
        code: 'unavailable',
        reasons: [{ code: 'missing-field', field: 'due' }],
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

  // A consequence is added by the person with control, for a task they marked
  // "not done" - never automatically - and waits in the queue until started
  let consequenceFor = null;
  if (input.consequenceFor !== undefined && input.consequenceFor !== null) {
    const original = await readAssignment(c, m, String(input.consequenceFor));
    if (!original || original.status !== 'not-done') {
      return c.json(
        { error: 'A consequence goes with a task marked not done' },
        409,
      );
    }
    consequenceFor = original.id;
  }
  const queued = consequenceFor && input.queued !== false;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const attestedLimits = m.kind === 'solo' ? [] : verdict.attested;
  const review = m.kind === 'pair' && input.requiresReview === true;
  const statements = [];
  let scheduleId = null;
  // a repeat that starts on a later day makes nothing yet
  const startsLater = !!repeat && repeat.startDate > today;
  if (repeat) {
    scheduleId = crypto.randomUUID();
    statements.push(
      db
        .prepare(
          `INSERT INTO task_schedules (id, dynamic_id, created_by, assigned_to, task,
             attested_soft_limits, requires_review, retention_days_requested, frequency, weekday,
             start_date, end_date, tz_offset, due_end_of_day, last_date, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        )
        .bind(
          scheduleId,
          m.id,
          m.me.user_id,
          m.assignee.user_id,
          JSON.stringify(task),
          JSON.stringify(attestedLimits),
          review ? 1 : 0,
          Number.isInteger(input.retentionDays) ? input.retentionDays : null,
          repeat.frequency,
          repeat.weekday,
          repeat.startDate,
          repeat.endDate,
          repeat.tzOffset,
          1,
          startsLater ? null : today,
          now,
        ),
    );
  }
  if (!startsLater) {
    statements.push(
      insertAssignment(db, {
        id,
        dynamicId: m.id,
        assignedBy: m.me.user_id,
        assignedTo: m.assignee.user_id,
        templateId,
        task,
        requiresReview: review,
        due: dueAt,
        attested: attestedLimits,
        createdAt: now,
        retentionDays: await retentionFor(
          db,
          m.me.user_id,
          doer.policy,
          task,
          input.retentionDays,
        ),
        consequenceFor,
        queued,
        scheduleId,
      }),
    );
  }
  await db.batch(statements);

  if (startsLater) {
    return c.json({ scheduled: true, startsOn: repeat.startDate }, 201);
  }
  const row = await readAssignment(c, m, id);
  return c.json(presentAssignment(row, m, new Map()), 201);
});

// The repeating tasks of a dynamic, visible to both people
dynamicWork.get('/:id/schedules', async (c) => {
  const { m, res } = await guard(c);
  if (res) return res;
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM task_schedules WHERE dynamic_id = ? AND status = 'active' ORDER BY created_at",
  )
    .bind(m.id)
    .all();
  return c.json(
    results.map((s) => ({
      id: s.id,
      task: JSON.parse(s.task),
      frequency: s.frequency,
      weekday: s.weekday,
      endDate: s.end_date,
      dueEndOfDay: !!s.due_end_of_day,
      note: s.note,
    })),
  );
});

dynamicWork.post('/:id/schedules/:sid/stop', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person who set this can do that');
  const stopped = await c.env.DB.prepare(
    "UPDATE task_schedules SET status = 'stopped' WHERE id = ? AND dynamic_id = ? AND status = 'active'",
  )
    .bind(c.req.param('sid'), m.id)
    .run();
  if (stopped.meta.changes !== 1) return c.json({ error: 'Not found' }, 404);
  return c.body(null, 204);
});

// Starting a timer task: the server notes when, and checks the time was served
dynamicWork.post('/:id/tasks/:aid/start', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  const row = await readAssignment(c, m, c.req.param('aid'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.assigned_to !== m.me.user_id)
    return forbid(c, 'This task is not yours to do');
  if (row.status !== 'pending' || row.queued)
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
  if (row.status !== 'pending' || row.queued)
    return c.json({ error: 'This task is not waiting to be done' }, 409);

  const task = JSON.parse(row.task);
  let given = (await body(c)).response;
  if (task.proof === 'media') {
    // what was uploaded is what the server holds, whatever the page says
    const stored = await c.env.MEDIA?.head(mediaKey(m.id, row.id));
    const contentType = stored?.httpMetadata?.contentType;
    given = stored
      ? { media: { kind: kindOf(contentType), contentType, size: stored.size } }
      : {};
  }
  const result = checkResponse(task, given, {
    startedAt: row.started_at ? new Date(row.started_at).getTime() : undefined,
    now: Date.now(),
    dueAt: row.due_at,
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

// ---- Photo, video and audio proofs (stored in R2) ------------------------

const mediaTask = (row) => {
  const task = JSON.parse(row.task);
  return task.proof === 'media' ? task : null;
};

// The person doing the task uploads their file; sending it again replaces it
dynamicWork.put('/:id/tasks/:aid/media', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!c.env.MEDIA)
    return c.json({ error: 'Uploads are not set up on this site' }, 501);
  if (c.req.header('x-upload') !== '1')
    return c.json({ error: 'Not an upload' }, 400);
  const row = await readAssignment(c, m, c.req.param('aid'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const task = mediaTask(row);
  if (!task) return c.json({ error: 'This task does not take a file' }, 409);
  if (row.assigned_to !== m.me.user_id)
    return forbid(c, 'This task is not yours to do');
  if (row.status !== 'pending' || row.queued)
    return c.json({ error: 'This task is not waiting to be done' }, 409);

  const contentType = bareType(c.req.header('content-type'));
  const kind = kindOf(contentType);
  if (!kind || !acceptedKinds(task.allowedMedia).includes(kind)) {
    return c.json(
      {
        error: `This task takes a ${task.allowedMedia ?? 'photo'}, and that is not one`,
      },
      415,
    );
  }
  const limit = MEDIA_KINDS[kind].maxBytes;
  const declared = Number(c.req.header('content-length') ?? 0);
  if (!declared) return c.json({ error: 'Empty file' }, 400);
  if (declared > limit)
    return c.json(
      { error: `That file is too big (most ${limit / 1048576} MB)` },
      413,
    );
  if (await overLimit(c.env.DB, `upload:${m.me.user_id}`, 30, 60 * 60 * 1000))
    return c.json({ error: 'Too many uploads - try again later' }, 429);

  const data = await c.req.arrayBuffer();
  if (data.byteLength === 0 || data.byteLength > limit)
    return c.json({ error: 'That file is not the right size' }, 413);
  await c.env.MEDIA.put(mediaKey(m.id, row.id), data, {
    httpMetadata: { contentType },
  });
  return c.json({ kind, contentType, size: data.byteLength });
});

// Either person in the dynamic can look at it - the person with control only
// while the doer's retention days have not passed
dynamicWork.get('/:id/tasks/:aid/media', async (c) => {
  const { m, res } = await guard(c);
  if (res) return res;
  const row = await readAssignment(c, m, c.req.param('aid'));
  if (!row || !mediaTask(row) || !c.env.MEDIA)
    return c.json({ error: 'Not found' }, 404);
  const isOwner = row.assigned_to === m.me.user_id;
  const shown = visibility({
    submittedAt: row.submitted_at,
    days: row.retention_days,
    isOwner,
  });
  // the doer can check what they just uploaded; the other person sees it once submitted
  const submitted = row.response !== null;
  if (shown !== 'visible' || (!submitted && !isOwner))
    return c.json({ error: 'Not found' }, 404);

  const key = mediaKey(m.id, row.id);
  const head = await c.env.MEDIA.head(key);
  if (!head) return c.json({ error: 'Not found' }, 404);
  const range = parseRange(c.req.header('range'), head.size);
  const object = await c.env.MEDIA.get(key, range ? { range } : undefined);
  if (!object) return c.json({ error: 'Not found' }, 404);

  const headers = {
    'Content-Type':
      head.httpMetadata?.contentType ?? 'application/octet-stream',
    'Content-Length': String(range ? range.length : head.size),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Content-Disposition': 'inline',
  };
  if (range) {
    headers['Content-Range'] =
      `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`;
  }
  return new Response(object.body, { status: range ? 206 : 200, headers });
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
  if (!approve && mediaTask(row)) {
    await c.env.MEDIA?.delete(mediaKey(m.id, row.id));
  }
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

// Starting a queued consequence: from now on it is an ordinary task to do
dynamicWork.post('/:id/tasks/:aid/start-consequence', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person who assigned this can do that');
  const row = await readAssignment(c, m, c.req.param('aid'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (!row.queued || row.status !== 'pending')
    return c.json({ error: 'That is not waiting in the queue' }, 409);
  const input = await body(c);
  const { due, error } = parseDue(input.dueAt);
  if (error) return c.json({ error }, 400);
  await c.env.DB.prepare(
    'UPDATE assignments SET queued = 0, due_at = COALESCE(?, due_at) WHERE id = ?',
  )
    .bind(due, row.id)
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
// A neutral record: nothing else changes when a task is marked not done. A
// consequence is only ever a separate, deliberate choice (see above).
dynamicWork.post(
  '/:id/tasks/:aid/not-done',
  closeTask('not-done', ['pending']),
);

// ---- Rules ---------------------------------------------------------------
// Rules belong to the dynamic as a whole and have nothing to do with any
// particular task. Whoever has control sets them; the other person can comment
// but there is nothing for them to approve. In a pair, making, changing or
// bringing back a rule needs the setter to attest they have discussed it -
// checked here, not only by the button.
//
// Each rule is locked for a number of days: the setter says how many, the
// person living under the rules has a minimum in their profile (default 7), and
// the longer applies. Until the time is up the rule cannot be changed or
// retired (see ../rules.js).

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

/** The least number of days a rule must stand: the other person's minimum (none when alone) */
const minimumDays = async (c, m) => {
  if (m.kind === 'solo') return 0;
  const row = await c.env.DB.prepare(
    'SELECT rule_change_min_days FROM users WHERE id = ?',
  )
    .bind(m.assignee.user_id)
    .first();
  return row.rule_change_min_days;
};

/** { lock } for a new or changed rule, or { error } */
const readLock = async (c, m, input) => {
  const requested = wholeDays(input.lockDays);
  if (requested === null) {
    return {
      error: `Say how many days (0 to ${MAX_DAYS}) until this can be changed`,
    };
  }
  const { applied, lockedUntil } = lockFor(requested, await minimumDays(c, m));
  return { lock: { requested, applied, lockedUntil } };
};

const presentRule = (row, counts) => ({
  id: row.id,
  title: row.title,
  body: row.body,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  attestedAt: row.attested_at,
  lockDaysRequested: row.lock_days_requested,
  lockDaysApplied: row.lock_days_applied,
  lockedUntil: row.locked_until,
  locked: isLocked(row.locked_until),
  comments: counts.get(`rule:${row.id}`) ?? 0,
});

dynamicWork.get('/:id/rules', async (c) => {
  const { m, res } = await guard(c);
  if (res) return res;
  const db = c.env.DB;
  const [{ results }, counts, minDays] = await Promise.all([
    db
      .prepare(
        'SELECT * FROM dynamic_rules WHERE dynamic_id = ? ORDER BY created_at',
      )
      .bind(m.id)
      .all(),
    commentCounts(db, m.id),
    minimumDays(c, m),
  ]);
  return c.json({
    you: youOf(m),
    minDays,
    rules: results.map((row) => presentRule(row, counts)),
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
  const { lock, error: lockError } = await readLock(c, m, input);
  if (lockError) return c.json({ error: lockError }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO dynamic_rules (id, dynamic_id, title, body, status, created_by, created_at, updated_at,
       attested_at, locked_until, lock_days_requested, lock_days_applied)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
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
      lock.lockedUntil,
      lock.requested,
      lock.applied,
    )
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM dynamic_rules WHERE id = ?')
    .bind(id)
    .first();
  return c.json(presentRule(row, new Map()), 201);
});

const findRule = (c, m) =>
  c.env.DB.prepare(
    'SELECT * FROM dynamic_rules WHERE id = ? AND dynamic_id = ?',
  )
    .bind(c.req.param('rid'), m.id)
    .first();

const stillLocked = (c, row) =>
  c.json(
    {
      error: 'This rule cannot be changed yet',
      code: 'rule-locked',
      lockedUntil: row.locked_until,
    },
    409,
  );

dynamicWork.put('/:id/rules/:rid', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person with control can change rules');
  const row = await findRule(c, m);
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (isLocked(row.locked_until)) return stillLocked(c, row);
  const input = await body(c);
  const missing = needsAttestation(m, input);
  if (missing) return c.json(missing, 400);
  const { rule, error } = checkRule(input, { partial: true });
  if (error) return c.json({ error }, 400);
  // A change starts a fresh lock
  const { lock, error: lockError } = await readLock(c, m, input);
  if (lockError) return c.json({ error: lockError }, 400);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE dynamic_rules SET title = ?, body = ?, updated_at = ?, attested_at = ?,
       locked_until = ?, lock_days_requested = ?, lock_days_applied = ? WHERE id = ?`,
  )
    .bind(
      rule.title ?? row.title,
      rule.body ?? row.body,
      now,
      m.kind === 'pair' ? now : null,
      lock.lockedUntil,
      lock.requested,
      lock.applied,
      row.id,
    )
    .run();
  const updated = await c.env.DB.prepare(
    'SELECT * FROM dynamic_rules WHERE id = ?',
  )
    .bind(row.id)
    .first();
  return c.json(presentRule(updated, await commentCounts(c.env.DB, m.id)));
});

// Retiring is a change, so it waits for the lock too. It needs no attestation.
dynamicWork.post('/:id/rules/:rid/retire', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person with control can change rules');
  const row = await findRule(c, m);
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (isLocked(row.locked_until)) return stillLocked(c, row);
  await c.env.DB.prepare(
    `UPDATE dynamic_rules SET status = 'retired', updated_at = ? WHERE id = ?`,
  )
    .bind(new Date().toISOString(), row.id)
    .run();
  return c.body(null, 204);
});

// Bringing a rule back sets it again: it needs the attestation and a fresh lock
dynamicWork.post('/:id/rules/:rid/restore', async (c) => {
  const { m, res } = await guard(c, { write: true });
  if (res) return res;
  if (!m.canAssign)
    return forbid(c, 'Only the person with control can change rules');
  const row = await findRule(c, m);
  if (!row) return c.json({ error: 'Not found' }, 404);
  const input = await body(c);
  const missing = needsAttestation(m, input);
  if (missing) return c.json(missing, 400);
  const { lock, error: lockError } = await readLock(c, m, input);
  if (lockError) return c.json({ error: lockError }, 400);

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE dynamic_rules SET status = 'active', updated_at = ?, attested_at = ?,
       locked_until = ?, lock_days_requested = ?, lock_days_applied = ? WHERE id = ?`,
  )
    .bind(
      now,
      m.kind === 'pair' ? now : null,
      lock.lockedUntil,
      lock.requested,
      lock.applied,
      row.id,
    )
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
    {
      id,
      body: text,
      createdAt: now,
      by: 'you',
      alias: m.me.name ?? m.me.alias,
    },
    201,
  );
});
