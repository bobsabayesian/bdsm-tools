// End-to-end check of tasks and rules inside a dynamic, against a running Worker:
//   ADMIN_TOKEN=... BASE=http://localhost:8787 node scripts/smoke-tasks.mjs
// Use a fresh local database (it signs people up and creates kinks and tasks).
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const BASE = process.env.BASE ?? 'http://localhost:8787';
const ADMIN = process.env.ADMIN_TOKEN;
if (!ADMIN)
  throw new Error('Set ADMIN_TOKEN (it creates kinks and library tasks)');
const PASSWORD = 'a long enough password';
const stamp = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Person {
  constructor(name) {
    this.name = name + stamp;
    this.cookie = '';
  }
  async call(method, path, data) {
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', cookie: this.cookie },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null, text };
  }
  // A file, for photo / video / audio proofs
  async raw(method, path, body, headers = {}) {
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { cookie: this.cookie, ...headers },
      body,
    });
    return {
      status: res.status,
      headers: res.headers,
      bytes: Buffer.from(await res.arrayBuffer()),
    };
  }
  // A display name is required to be in a dynamic: Zak, Sara and Sam
  async signup(displayName) {
    const r = await this.call('POST', '/account/signup', {
      username: this.name,
      password: PASSWORD,
    });
    assert.equal(r.status, 201);
    const named = await this.call('PUT', '/profile/display-name', {
      displayName,
    });
    assert.equal(named.status, 204);
    return this;
  }
}
const admin = async (path, data) => {
  const res = await fetch(`${BASE}/api/admin${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ADMIN}`,
    },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  assert.equal(res.status, 201, `${path} ${text}`);
  return JSON.parse(text)._id;
};
const step = (name) => console.log('•', name);

const dom = await new Person('dom').signup('Zak');
const sub = await new Person('sub').signup('Sara');
const stranger = await new Person('stranger').signup('Sam');

step('a pair, with a sub who has set up a profile');
const invite = (
  await dom.call('POST', '/dynamics/invite', { role: 'dom', alias: 'Sir' })
).json;
const pair = (
  await sub.call('POST', '/dynamics/join', {
    code: invite.code,
    alias: 'kitten',
  })
).json;
const P = `/dynamics/${pair.id}`;

// the kinks used below ('spanking', 'blindfolds' ...) come from the real list
await admin('/catalogs/kinks/items', {
  key: 'spanking',
  label: 'Spanking',
  category: 'Impact',
  order: 9001,
});
await sub.call('PUT', '/profile/bodyParts', { keys: ['mouth'] });
await sub.call('PUT', '/profile/equipment', { keys: ['rope'] });
await sub.call('PUT', '/profile/boundsBody', { keys: ['neck'] });
await sub.call('PUT', '/profile/boundsClothing', { keys: ['pants'] });
await sub.call('PUT', '/profile/kinks', {
  choices: [
    { key: 'spanking', direction: 'receive', state: 'hard-limit' },
    { key: 'blindfolds', direction: 'receive', state: 'soft-limit' },
    // kinks with a single answer (no sides)
    { key: 'exhibitionism-voyeurism', direction: 'any', state: 'soft-limit' },
    { key: 'group-sex', direction: 'any', state: 'hard-limit' },
  ],
});

const lib = {};
const add = async (name, task) =>
  (lib[name] = await admin('/catalogs/tasks/items', { task: name, ...task }));
await add('Kneel', {});
await add('Needs feet', { requiresBodyPart: ['feet'] });
await add('Needs rope', { requiresEquipment: ['rope'] });
await add('Needs neck', { requiresBoundsBody: ['neck'] });
await add('Needs feet in bounds', { requiresBoundsBody: ['feet'] });
await add('Wear pants', { requiresClothing: ['pants'] });
await add('Be watched', { kinksGeneral: ['exhibitionism-voyeurism'] });
await add('Group scene', { kinksGeneral: ['group-sex'] });
await add('Wear a thong', { requiresClothing: ['thong'] });
await add('Spank', { kinksReceiving: ['spanking'] });
await add('Blindfolded', { kinksReceiving: ['blindfolds'] });
await add('Photo', { proof: 'media', allowedMedia: 'photo' });
await add('Timer', { proof: 'timer', seconds: 4 });
await add('Quiz', {
  proof: 'quiz',
  questions: ['Safeword? | red', 'Slow down? | yellow'],
});
await add('Lines', {
  proof: 'lines',
  phrase: 'I will be good',
  repetitions: 2,
});
await add('Count', {
  proof: 'numeric',
  unit: 'oz',
  minValue: 8,
  maxValue: 100,
});
await add('Pick', { proof: 'choice', choices: ['tea', 'coffee'] });
await add('Write', { proof: 'text', minLength: 20 });

step('only the person with control can assign, and only members can look');
assert.equal(
  (await stranger.call('GET', `${P}/tasks`)).status,
  404,
  'strangers see nothing',
);
assert.equal((await stranger.call('GET', `${P}/rules`)).status, 404);
assert.equal(
  (await sub.call('GET', `${P}/library`)).status,
  403,
  'the sub cannot browse the assign library',
);
assert.equal(
  (await sub.call('POST', `${P}/tasks`, { templateId: lib.Kneel })).status,
  403,
  'the sub cannot assign',
);
const tasks = (await sub.call('GET', `${P}/tasks`)).json;
assert.deepEqual(tasks.you, {
  role: 'sub',
  canAssign: false,
  isAssignee: true,
  partner: 'Zak',
});
assert.deepEqual((await dom.call('GET', `${P}/tasks`)).json.you, {
  role: 'dom',
  canAssign: true,
  isAssignee: false,
  partner: 'Sara',
});

step('tasks wait until the other person has been through profile setup');
const invite2 = (
  await dom.call('POST', '/dynamics/invite', { role: 'dom', alias: 'Boss' })
).json;
const fresh = (
  await stranger.call('POST', '/dynamics/join', {
    code: invite2.code,
    alias: 'pet',
  })
).json;
const early = await dom.call('POST', `/dynamics/${fresh.id}/tasks`, {
  templateId: lib.Kneel,
});
assert.equal(early.status, 409);
assert.equal(early.json.code, 'profile-not-shared');
assert.equal(
  (await dom.call('GET', `/dynamics/${fresh.id}/library`)).json.code,
  'profile-not-shared',
);
await stranger.call('POST', '/profile/steps/bodyParts/skip', {});
assert.equal(
  (
    await dom.call('POST', `/dynamics/${fresh.id}/tasks`, {
      templateId: lib.Kneel,
    })
  ).status,
  201,
  'skipping setup is enough',
);

step('the library says what is possible for this person, and why');
const library = (await dom.call('GET', `${P}/library`)).json;
const by = Object.fromEntries(library.map((t) => [t.task, t.availability]));
assert.equal(by.Kneel.assignable, true);
assert.deepEqual(by['Needs feet'].reasons, [
  { code: 'body-part', keys: ['feet'] },
]);
assert.equal(by['Needs rope'].assignable, true, 'they have the rope');
assert.equal(by['Needs neck'].assignable, true, 'their neck is in bounds');
assert.deepEqual(by['Needs feet in bounds'].reasons, [
  { code: 'in-bounds-body', keys: ['feet'] },
]);
assert.equal(by['Wear pants'].assignable, true);
assert.deepEqual(by['Wear a thong'].reasons, [
  { code: 'clothing', keys: ['thong'] },
]);
assert.deepEqual(
  by['Be watched'].softLimits,
  [{ key: 'exhibitionism-voyeurism', direction: 'any' }],
  'a single-answer kink can be a soft limit',
);
assert.equal(by['Be watched'].assignable, true);
assert.deepEqual(by['Group scene'].hardLimits, [
  { key: 'group-sex', direction: 'any' },
]);
assert.equal(by['Group scene'].assignable, false);
// My Body is a separate list: 'mouth' is in My Body but not in bounds
assert.equal(
  (
    await dom.call('POST', `${P}/tasks`, {
      task: { task: 'Use your mouth', requiresBoundsBody: ['mouth'] },
    })
  ).json.code,
  'unavailable',
  'My Body does not put anything in bounds',
);
assert.deepEqual(by.Spank.hardLimits, [
  { key: 'spanking', direction: 'receive' },
]);
assert.equal(by.Spank.assignable, false);
assert.equal(by.Blindfolded.assignable, true);
assert.deepEqual(
  by.Blindfolded.softLimits,
  [{ key: 'blindfolds', direction: 'receive' }],
  'soft limits are flagged, not blocked',
);
assert.deepEqual(by.Photo.reasons, [], 'photo tasks can be assigned now');

const fields = (await dom.call('GET', `${P}/task-fields`)).json;
assert.ok(fields.find((f) => f.name === 'task' && f.required));
assert.ok(!fields.some((f) => f.name === 'category'));
assert.deepEqual(
  fields.find((f) => f.name === 'proof').options.map((o) => o.value),
  [
    'attestation',
    'media',
    'numeric',
    'text',
    'lines',
    'timer',
    'choice',
    'quiz',
    'checkin',
    'location',
  ],
);
assert.equal((await sub.call('GET', `${P}/task-fields`)).status, 403);

step('assigning is refused, on the server, when it should be');
const assign = (templateId, extra = {}) =>
  dom.call('POST', `${P}/tasks`, { templateId, ...extra });
const groupAttempt = await assign(lib['Group scene'], {
  attested: [{ key: 'group-sex', direction: 'any' }],
});
assert.equal(
  groupAttempt.json.code,
  'hard-limit',
  'a hard limit on a themed kink is refused whatever is attested',
);
const watchAttempt = await assign(lib['Be watched']);
assert.equal(watchAttempt.json.code, 'attestation-required');
assert.deepEqual(watchAttempt.json.missing, [
  { key: 'exhibitionism-voyeurism', direction: 'any' },
]);
assert.equal(
  (await assign(lib['Be watched'], { attested: watchAttempt.json.missing }))
    .status,
  201,
);
assert.equal((await assign(lib['Needs feet'])).json.code, 'unavailable');
assert.equal(
  (await assign(lib.Photo)).status,
  201,
  'photo tasks can be assigned now',
);
const hard = await assign(lib.Spank, {
  attested: [{ key: 'spanking', direction: 'receive' }],
});
assert.equal(hard.status, 409);
assert.equal(
  hard.json.code,
  'hard-limit',
  'a hard limit is refused whatever is attested',
);
const soft = await assign(lib.Blindfolded);
assert.equal(soft.status, 409);
assert.equal(soft.json.code, 'attestation-required');
assert.deepEqual(soft.json.missing, [
  { key: 'blindfolds', direction: 'receive' },
]);
assert.equal(
  (
    await assign(lib.Blindfolded, {
      attested: [{ key: 'blindfolds', direction: 'give' }],
    })
  ).status,
  409,
  'the wrong side is not enough',
);
assert.equal(
  (await assign(lib.Kneel, { dueAt: '2001-01-01' })).status,
  400,
  'due dates must be in the future',
);
assert.equal((await dom.call('POST', `${P}/tasks`, {})).status, 400);
assert.equal((await assign('no-such-task')).status, 404);

step(
  'an attested soft-limit task is assigned, and the attestation is recorded where both can see it',
);
const flagged = await assign(lib.Blindfolded, {
  attested: [{ key: 'blindfolds', direction: 'receive' }],
});
assert.equal(flagged.status, 201);
assert.deepEqual(flagged.json.attestedSoftLimits, [
  { key: 'blindfolds', direction: 'receive' },
]);
const seen = (await sub.call('GET', `${P}/tasks`)).json.assignments.find(
  (a) => a.id === flagged.json.id,
);
assert.deepEqual(
  seen.attestedSoftLimits,
  [{ key: 'blindfolds', direction: 'receive' }],
  'the sub sees it',
);
assert.equal(seen.task.task, 'Blindfolded');

step('a custom task is held to the same limits as a library task');
const custom = await dom.call('POST', `${P}/tasks`, {
  task: { task: 'Be spanked', kinksReceiving: ['spanking'] },
});
assert.equal(custom.json.code, 'hard-limit');
const own = await dom.call('POST', `${P}/tasks`, {
  task: { task: 'Write a note of thanks', proof: 'text' },
  dueAt: new Date(Date.now() + 864e5).toISOString(),
});
assert.equal(own.status, 201);
assert.ok(own.json.dueAt);

step(
  'doing a task: only the person it was given to, and not until it is waiting',
);
const kneel = (await assign(lib.Kneel)).json;
assert.equal(
  (await dom.call('POST', `${P}/tasks/${kneel.id}/submit`, { response: {} }))
    .status,
  403,
  "the dom cannot do the sub's task",
);
const done = await sub.call('POST', `${P}/tasks/${kneel.id}/submit`, {
  response: {},
});
assert.equal(done.json.status, 'done');
assert.ok(done.json.completedAt);
assert.equal(
  (await sub.call('POST', `${P}/tasks/${kneel.id}/submit`, { response: {} }))
    .status,
  409,
  'not twice',
);

step(
  'data retention: the sub chooses, per kind of proof, how long the dom sees it',
);
assert.equal(done.json.retentionDays, 30, 'the default is 30 days');
const mine = (await sub.call('GET', '/profile')).json.me;
const saveRetention = (dataRetention) =>
  sub.call('PUT', '/profile/me', { ...mine, dataRetention });
assert.equal(
  (await saveRetention({ attestation: 0 })).status,
  400,
  'at least 1 day',
);
assert.equal((await saveRetention({ attestation: 400 })).status, 400);
assert.equal((await saveRetention({ nonsense: 5 })).status, 400);
assert.equal((await saveRetention({ attestation: 3 })).status, 204);
const myMe = (await sub.call('GET', '/profile')).json.me;
assert.equal(myMe.dataRetention.attestation, 3);
assert.equal(myMe.dataRetention.media, 30, 'others keep the default');
const theirs = (await dom.call('GET', `${P}/profile`)).json.me;
assert.equal(theirs.dataRetention.attestation, 3, 'the dom can see the policy');
const kept = (await assign(lib.Kneel)).json;
assert.equal(kept.retentionDays, 3, 'copied onto the task when assigned');
await sub.call('POST', `${P}/tasks/${kept.id}/submit`, { response: {} });
const keptSeen = (await dom.call('GET', `${P}/tasks`)).json.assignments.find(
  (a) => a.id === kept.id,
);
assert.equal(keptSeen.retentionDays, 3);
assert.equal(keptSeen.responseGone, null, 'still within its days');
assert.equal(
  (await sub.call('GET', `${P}/tasks`)).json.assignments.find(
    (a) => a.id === done.json.id,
  ).retentionDays,
  30,
  'an earlier task keeps the policy it had',
);

step(
  'retention is the shorter of the two partners, and kinds of task can be declined',
);
// the sub allows 3 days for attestation (set above); the dom's default is 30
const domMe = (await dom.call('GET', '/profile')).json.me;
const limits = (await dom.call('GET', `${P}/assign-options`)).json;
assert.equal(limits.theirs.attestation, 3);
assert.equal(limits.mine.attestation, 30);
assert.equal((await sub.call('GET', `${P}/assign-options`)).status, 403);
const asked = (await assign(lib.Kneel, { retentionDays: 2 })).json;
assert.equal(asked.retentionDays, 2, 'the dom asked for less');
const tooMany = (await assign(lib.Kneel, { retentionDays: 90 })).json;
assert.equal(tooMany.retentionDays, 3, 'never more than the sub allows');
assert.equal(
  (
    await dom.call('PUT', '/profile/me', {
      ...domMe,
      dataRetention: { attestation: 1 },
    })
  ).status,
  204,
);
assert.equal(
  (await assign(lib.Kneel)).json.retentionDays,
  1,
  "the dom's own default can be shorter",
);
await dom.call('PUT', '/profile/me', {
  ...domMe,
  dataRetention: { attestation: 30 },
});
assert.equal(
  (
    await sub.call('PUT', '/profile/me', {
      ...mine,
      unwillingTaskTypes: ['nonsense'],
    })
  ).status,
  400,
);
assert.equal(
  (
    await sub.call('PUT', '/profile/me', {
      ...mine,
      dataRetention: { attestation: 3 },
      unwillingTaskTypes: ['quiz'],
    })
  ).status,
  204,
);
const quizTry = await assign(lib.Quiz);
assert.equal(quizTry.status, 409, 'not up for quizzes');
assert.equal(quizTry.json.code, 'unavailable');
assert.deepEqual(quizTry.json.reasons, [{ code: 'task-type', proof: 'quiz' }]);
const libNow = (await dom.call('GET', `${P}/library`)).json;
assert.equal(
  libNow.find((t) => t.task === 'Quiz').availability.assignable,
  false,
);
assert.ok(libNow.every((t) => t.bonusTask === undefined));
assert.deepEqual(
  (await dom.call('GET', `${P}/profile`)).json.me.unwillingTaskTypes,
  ['quiz'],
);
await sub.call('PUT', '/profile/me', {
  ...mine,
  dataRetention: { attestation: 3 },
  unwillingTaskTypes: [],
});
assert.equal((await assign(lib.Quiz)).status, 201, 'willing again');

step('check-in and location proofs are recorded, never refused');
const checkin = await dom.call('POST', `${P}/tasks`, {
  task: { task: 'Check in on time', proof: 'checkin', graceMinutes: 1 },
  dueAt: new Date(Date.now() - 4 * 60000).toISOString(),
});
assert.equal(checkin.status, 201);
const checkedIn = await sub.call(
  'POST',
  `${P}/tasks/${checkin.json.id}/submit`,
  {
    response: {},
  },
);
assert.equal(checkedIn.json.status, 'done');
assert.ok(checkedIn.json.response.minutesLate >= 4, 'late is noted');
const where = await dom.call('POST', `${P}/tasks`, {
  task: {
    task: 'Be at the gym',
    proof: 'location',
    place: 'the gym',
    placeLat: 51.5007,
    placeLng: -0.1246,
    radiusMeters: 200,
  },
});
assert.equal(where.status, 201);
assert.equal(
  (
    await sub.call('POST', `${P}/tasks/${where.json.id}/submit`, {
      response: {},
    })
  ).status,
  422,
  'nothing is shared until they choose to',
);
const shared = await sub.call('POST', `${P}/tasks/${where.json.id}/submit`, {
  response: { lat: 51.51, lng: -0.1246, accuracy: 20 },
});
assert.equal(shared.json.status, 'done', 'being elsewhere is not refused');
assert.equal(shared.json.response.withinRadius, false);

step('photo proofs are stored privately and only shown to the pair');
const photo = await dom.call('POST', `${P}/tasks`, {
  task: {
    task: 'Send a photo of your made bed',
    proof: 'media',
    allowedMedia: 'photo',
  },
  requiresReview: true,
});
assert.equal(photo.status, 201);
const U = `/dynamics/${pair.id}/tasks/${photo.json.id}/media`;
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const asPng = { 'content-type': 'image/png', 'x-upload': '1' };
assert.equal(
  (
    await sub.call('POST', `${P}/tasks/${photo.json.id}/submit`, {
      response: {},
    })
  ).status,
  422,
  'nothing uploaded yet',
);
assert.equal(
  (await dom.raw('PUT', U, png, asPng)).status,
  403,
  'only the doer uploads',
);
assert.equal(
  (await stranger.raw('PUT', U, png, asPng)).status,
  404,
  'not a member',
);
assert.equal(
  (await sub.raw('PUT', U, png, { 'content-type': 'image/png' })).status,
  400,
  'needs our header',
);
assert.equal(
  (
    await sub.raw('PUT', U, png, {
      'content-type': 'text/html',
      'x-upload': '1',
    })
  ).status,
  415,
);
assert.equal(
  (
    await sub.raw('PUT', U, png, {
      'content-type': 'video/mp4',
      'x-upload': '1',
    })
  ).status,
  415,
  'a photo task takes a photo',
);
assert.equal(
  (await sub.raw('PUT', U, Buffer.alloc(11 * 1048576), asPng)).status,
  413,
  'too big',
);
assert.equal((await sub.raw('PUT', U, png, asPng)).status, 200);
assert.equal(
  (await dom.raw('GET', U)).status,
  404,
  'the dom sees nothing until it is submitted',
);
assert.equal(
  (await sub.raw('GET', U)).status,
  200,
  'the doer can check their own',
);
const sent = await sub.call('POST', `${P}/tasks/${photo.json.id}/submit`, {
  response: { media: { kind: 'video', size: 1 } },
});
assert.equal(sent.json.status, 'submitted');
assert.deepEqual(
  sent.json.response.media,
  { kind: 'photo', contentType: 'image/png', size: png.length },
  'what the server holds, not what the page said',
);
const shownToDom = await dom.raw('GET', U);
assert.equal(shownToDom.status, 200);
assert.deepEqual(shownToDom.bytes, png);
assert.equal(shownToDom.headers.get('content-type'), 'image/png');
assert.equal(shownToDom.headers.get('x-content-type-options'), 'nosniff');
assert.match(shownToDom.headers.get('content-security-policy'), /sandbox/);
const part = await dom.raw('GET', U, undefined, { range: 'bytes=0-3' });
assert.equal(part.status, 206);
assert.equal(part.bytes.length, 4);
assert.equal((await stranger.raw('GET', U)).status, 404);
assert.equal(
  (await sub.raw('PUT', U, png, asPng)).status,
  409,
  'not once submitted',
);
await dom.call('POST', `${P}/tasks/${photo.json.id}/review`, {
  approve: false,
  note: 'again',
});
assert.equal(
  (await dom.raw('GET', U)).status,
  404,
  'sent back: the file is gone',
);

step("review is the dom's choice: send back, then approve");
const reviewed = (await assign(lib.Kneel, { requiresReview: true })).json;
assert.equal(reviewed.requiresReview, true);
assert.equal(
  (
    await sub.call('POST', `${P}/tasks/${reviewed.id}/review`, {
      approve: true,
    })
  ).status,
  403,
  'the sub cannot review',
);
assert.equal(
  (
    await dom.call('POST', `${P}/tasks/${reviewed.id}/review`, {
      approve: true,
    })
  ).status,
  409,
  'nothing submitted yet',
);
assert.equal(
  (await sub.call('POST', `${P}/tasks/${reviewed.id}/submit`, { response: {} }))
    .json.status,
  'submitted',
);
const sentBack = await dom.call('POST', `${P}/tasks/${reviewed.id}/review`, {
  approve: false,
  note: 'Please try again, slower',
});
assert.equal(sentBack.json.status, 'pending');
assert.equal(sentBack.json.feedback, 'Please try again, slower');
await sub.call('POST', `${P}/tasks/${reviewed.id}/submit`, { response: {} });
const approved = await dom.call('POST', `${P}/tasks/${reviewed.id}/review`, {
  approve: true,
});
assert.equal(approved.json.status, 'done');

step('every kind of proof is checked');
const submit = async (name, response, extra) => {
  const a = (await assign(lib[name], extra)).json;
  const r = await sub.call('POST', `${P}/tasks/${a.id}/submit`, { response });
  return { a, r };
};
assert.equal(
  (await submit('Count', { value: 3 })).r.status,
  422,
  'below the minimum',
);
assert.equal((await submit('Count', { value: 12 })).r.json.status, 'done');
assert.equal((await submit('Pick', { choice: 'wine' })).r.status, 422);
assert.equal((await submit('Pick', { choice: 'tea' })).r.json.status, 'done');
assert.equal((await submit('Write', { text: 'too short' })).r.status, 422);
assert.equal(
  (await submit('Write', { text: 'a sentence that is long enough' })).r.json
    .status,
  'done',
);
assert.equal(
  (await submit('Lines', { text: 'I will be good' })).r.status,
  422,
  'must be written twice',
);
assert.equal(
  (await submit('Lines', { text: 'I will be good\nI will be good' })).r.json
    .status,
  'done',
);
const quizTask = (await assign(lib.Quiz)).json;
const asSub = (await sub.call('GET', `${P}/tasks`)).json.assignments.find(
  (x) => x.id === quizTask.id,
);
assert.deepEqual(
  asSub.task.questions,
  ['Safeword?', 'Slow down?'],
  'the person answering never sees the answers',
);
const asDom = (await dom.call('GET', `${P}/tasks`)).json.assignments.find(
  (x) => x.id === quizTask.id,
);
assert.deepEqual(
  asDom.task.questions,
  ['Safeword? | red', 'Slow down? | yellow'],
  'the person who set it can',
);
assert.ok(
  !JSON.stringify((await sub.call('GET', `${P}/tasks`)).json).includes('| red'),
);
const wrongQuiz = await submit('Quiz', { answers: ['red', 'green'] });
assert.equal(wrongQuiz.r.status, 422);
assert.deepEqual(wrongQuiz.r.json.incorrect, [1], 'says which to retry');
assert.equal(
  (
    await sub.call('POST', `${P}/tasks/${wrongQuiz.a.id}/submit`, {
      response: { answers: ['RED', 'Yellow'] },
    })
  ).json.status,
  'done',
  'and can try again',
);

step('a timer is checked against when the server saw it start');
const timer = (await assign(lib.Timer)).json;
assert.equal(
  (await sub.call('POST', `${P}/tasks/${timer.id}/submit`, { response: {} }))
    .status,
  422,
  'not started',
);
assert.ok(
  (await sub.call('POST', `${P}/tasks/${timer.id}/start`, {})).json.startedAt,
);
assert.equal(
  (await sub.call('POST', `${P}/tasks/${timer.id}/submit`, { response: {} }))
    .status,
  422,
  'time is not up',
);
await sleep(3000);
const served = await sub.call('POST', `${P}/tasks/${timer.id}/submit`, {
  response: {},
});
assert.equal(served.json.status, 'done');
assert.ok(served.json.response.seconds >= 3);

step('cancelling and "not done" are the dom\'s to do, and are plain records');
const spare = (await assign(lib.Kneel)).json;
assert.equal(
  (await sub.call('POST', `${P}/tasks/${spare.id}/cancel`, {})).status,
  403,
);
assert.equal(
  (await dom.call('POST', `${P}/tasks/${spare.id}/not-done`, {})).json.status,
  'not-done',
);
assert.equal(
  (await dom.call('POST', `${P}/tasks/${spare.id}/cancel`, {})).status,
  409,
  'already closed',
);
const spare2 = (await assign(lib.Kneel)).json;
assert.equal(
  (await dom.call('POST', `${P}/tasks/${spare2.id}/cancel`, {})).json.status,
  'cancelled',
);

step('consequences: only a deliberate choice by the dom, queued until started');
const before = (await sub.call('GET', `${P}/tasks`)).json.assignments.length;
assert.equal(
  (
    await dom.call('POST', `${P}/tasks`, {
      templateId: lib.Kneel,
      consequenceFor: kneel.id,
    })
  ).status,
  409,
  'only for a task marked not done',
);
assert.equal(
  (
    await sub.call('POST', `${P}/tasks`, {
      templateId: lib.Kneel,
      consequenceFor: spare.id,
    })
  ).status,
  403,
  'the sub does not set them',
);
assert.equal(
  (await sub.call('GET', `${P}/tasks`)).json.assignments.length,
  before,
  'marking something not done adds nothing by itself',
);
const penalty = await dom.call('POST', `${P}/tasks`, {
  templateId: lib.Kneel,
  consequenceFor: spare.id,
});
assert.equal(penalty.status, 201);
assert.equal(penalty.json.queued, true);
assert.equal(penalty.json.consequenceFor, spare.id);
const queuedForSub = (
  await sub.call('GET', `${P}/tasks`)
).json.assignments.find((a) => a.id === penalty.json.id);
assert.equal(
  queuedForSub.queued,
  true,
  'nothing is hidden: the sub sees the queue',
);
assert.equal(
  (
    await sub.call('POST', `${P}/tasks/${penalty.json.id}/submit`, {
      response: {},
    })
  ).status,
  409,
  'cannot be done while queued',
);
assert.equal(
  (
    await sub.call(
      'POST',
      `${P}/tasks/${penalty.json.id}/start-consequence`,
      {},
    )
  ).status,
  403,
);
const started = await dom.call(
  'POST',
  `${P}/tasks/${penalty.json.id}/start-consequence`,
  {},
);
assert.equal(started.json.queued, false);
assert.equal(started.json.consequenceFor, spare.id);
assert.equal(
  (
    await dom.call(
      'POST',
      `${P}/tasks/${penalty.json.id}/start-consequence`,
      {},
    )
  ).status,
  409,
  'not twice',
);
assert.equal(
  (
    await sub.call('POST', `${P}/tasks/${penalty.json.id}/submit`, {
      response: {},
    })
  ).json.status,
  'done',
);
const removable = await dom.call('POST', `${P}/tasks`, {
  templateId: lib.Kneel,
  consequenceFor: spare.id,
});
assert.equal(
  (await dom.call('POST', `${P}/tasks/${removable.json.id}/cancel`, {})).json
    .status,
  'cancelled',
  'a queued one can be removed',
);

step('required task fields: the sub says what a task must include');
const subMe = (await sub.call('GET', '/profile')).json.me;
const saveRequired = (requiredTaskFields) =>
  sub.call('PUT', '/profile/me', {
    ...subMe,
    dataRetention: { attestation: 3 },
    requiredTaskFields,
  });
assert.equal((await saveRequired(['nonsense'])).status, 400);
assert.equal((await saveRequired(['guardrails', 'kinks', 'due'])).status, 204);
assert.deepEqual(
  (await dom.call('GET', `${P}/assign-options`)).json.requiredFields,
  ['guardrails', 'kinks', 'due'],
);
assert.deepEqual(
  (await dom.call('GET', `${P}/profile`)).json.me.requiredTaskFields,
  ['guardrails', 'kinks', 'due'],
);
const bare = await dom.call('POST', `${P}/tasks`, {
  task: { task: 'Stand by the door', proof: 'attestation' },
});
assert.equal(bare.status, 409);
assert.deepEqual(bare.json.reasons, [
  { code: 'missing-field', field: 'guardrails' },
  { code: 'missing-field', field: 'kinks' },
]);
const tomorrow = new Date(Date.now() + 864e5).toISOString();
const themed = {
  task: 'Stand by the door',
  proof: 'attestation',
  requiresBodyPart: [],
  kinksGeneral: ['exhibitionism-voyeurism'],
};
assert.equal(
  (
    await dom.call('POST', `${P}/tasks`, {
      task: { ...themed, requiresClothing: [] },
      dueAt: tomorrow,
    })
  ).status,
  409,
  'still no guardrails',
);
const libReasons = (await dom.call('GET', `${P}/library`)).json.find(
  (t) => t.task === 'Kneel',
).availability.reasons;
assert.ok(
  libReasons.some((r) => r.code === 'missing-field'),
  'the library shows why',
);
await saveRequired(['due']);
const noDue = await dom.call('POST', `${P}/tasks`, { task: themed });
assert.equal(noDue.status, 409);
assert.deepEqual(noDue.json.reasons, [{ code: 'missing-field', field: 'due' }]);
assert.equal(
  (await dom.call('POST', `${P}/tasks`, { task: themed, dueAt: tomorrow }))
    .status,
  409,
  'attestation still needed for the soft limit',
);
await saveRequired([]);

step(
  'repeating tasks make one a day, only when someone looks, and can be stopped',
);
const repeating = await dom.call('POST', `${P}/tasks`, {
  task: { task: 'Morning check', proof: 'attestation' },
  repeat: { frequency: 'daily', tzOffset: 0 },
});
assert.equal(repeating.status, 201);
assert.ok(repeating.json.dueAt, 'always due the day it is assigned');
assert.ok(
  repeating.json.dueAt.endsWith('23:59:59.000Z'),
  'at the end of that day',
);
const countMorning = async () =>
  (await sub.call('GET', `${P}/tasks`)).json.assignments.filter(
    (a) => a.task.task === 'Morning check',
  ).length;
assert.equal(await countMorning(), 1);
assert.equal(
  await countMorning(),
  1,
  'looking again the same day makes nothing more',
);
const schedules = (await sub.call('GET', `${P}/schedules`)).json;
assert.equal(schedules.length, 1, 'both of them see it');
assert.equal(schedules[0].frequency, 'daily');
execSync(
  `npx wrangler d1 execute bdsm-tools --local --command "UPDATE task_schedules SET last_date = '2000-01-01'"`,
  { stdio: 'ignore' },
);
assert.equal(
  await countMorning(),
  2,
  'a new day makes the next one - once, with no backlog',
);
assert.equal(await countMorning(), 2);
assert.equal(
  (await sub.call('POST', `${P}/schedules/${schedules[0].id}/stop`, {})).status,
  403,
);
assert.equal(
  (await dom.call('POST', `${P}/schedules/${schedules[0].id}/stop`, {})).status,
  204,
);
execSync(
  `npx wrangler d1 execute bdsm-tools --local --command "UPDATE task_schedules SET last_date = '2000-01-01'"`,
  { stdio: 'ignore' },
);
assert.equal(await countMorning(), 2, 'stopped: nothing more');
assert.equal((await sub.call('GET', `${P}/schedules`)).json.length, 0);
const startDay = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
const later = await dom.call('POST', `${P}/tasks`, {
  task: { task: 'Evening check', proof: 'attestation' },
  repeat: { frequency: 'daily', tzOffset: 0, startDate: startDay },
});
assert.equal(later.status, 201);
assert.equal(later.json.scheduled, true);
assert.equal(later.json.startsOn, startDay);
const countEvening = async () =>
  (await sub.call('GET', `${P}/tasks`)).json.assignments.filter(
    (a) => a.task.task === 'Evening check',
  ).length;
assert.equal(await countEvening(), 0, 'nothing is made before its start day');
assert.equal((await sub.call('GET', `${P}/schedules`)).json.length, 1);
execSync(
  `npx wrangler d1 execute bdsm-tools --local --command "UPDATE task_schedules SET start_date = '2000-01-01' WHERE status = 'active'"`,
  { stdio: 'ignore' },
);
assert.equal(await countEvening(), 1, 'on the start day the first one is made');
assert.equal(await countEvening(), 1);
const evening = (await sub.call('GET', `${P}/schedules`)).json[0];
await dom.call('POST', `${P}/schedules/${evening.id}/stop`, {});
assert.equal(
  (
    await dom.call('POST', `${P}/tasks`, {
      task: { task: 'y', proof: 'attestation' },
      repeat: { frequency: 'daily', tzOffset: 0, startDate: '2001-01-01' },
    })
  ).status,
  400,
  'cannot start in the past',
);
assert.equal(
  (
    await dom.call('POST', `${P}/tasks`, {
      task: { task: 'x', proof: 'attestation' },
      repeat: { frequency: 'hourly', tzOffset: 0 },
    })
  ).status,
  400,
);

step(
  'rules: the dom sets them, the sub comments, and there is nothing to approve',
);
assert.equal(
  (
    await sub.call('POST', `${P}/rules`, {
      title: 'Mine',
      body: 'x',
      attested: true,
      lockDays: 7,
    })
  ).status,
  403,
  'the sub cannot set rules',
);
const noAttest = await dom.call('POST', `${P}/rules`, {
  title: 'Greet me',
  body: 'Say good morning',
  lockDays: 7,
});
assert.equal(noAttest.status, 400);
assert.equal(
  noAttest.json.code,
  'attestation-required',
  'Cancel in the dialog means no rule',
);
assert.equal(
  (
    await dom.call('POST', `${P}/rules`, {
      title: '',
      body: 'x',
      attested: true,
      lockDays: 7,
    })
  ).status,
  400,
);
assert.equal(
  (
    await dom.call('POST', `${P}/rules`, {
      title: 'Greet me',
      body: 'Say good morning',
      attested: true,
    })
  ).status,
  400,
  'the setter must say how long it stands',
);
for (const bad of [-1, 366, 2.5, '4']) {
  assert.equal(
    (
      await dom.call('POST', `${P}/rules`, {
        title: 'a',
        body: 'b',
        attested: true,
        lockDays: bad,
      })
    ).status,
    400,
    `${bad} days is not allowed`,
  );
}

step(
  "a rule stands for the longer of what the dom asks and the sub's minimum (default 7 days)",
);
const week = 7 * 864e5;
const rule = await dom.call('POST', `${P}/rules`, {
  title: 'Greet me',
  body: 'Say good morning',
  attested: true,
  lockDays: 4,
});
assert.equal(rule.status, 201);
assert.ok(rule.json.attestedAt, 'recorded that it was discussed');
assert.equal(rule.json.lockDaysRequested, 4);
assert.equal(
  rule.json.lockDaysApplied,
  7,
  "asked for 4 but the sub's minimum is 7, so it is 7",
);
assert.ok(
  Math.abs(new Date(rule.json.lockedUntil) - (Date.now() + week)) < 60000,
);
assert.equal(rule.json.locked, true);
const longer = await dom.call('POST', `${P}/rules`, {
  title: 'Longer',
  body: 'x',
  attested: true,
  lockDays: 14,
});
assert.equal(
  longer.json.lockDaysApplied,
  14,
  'asking for more than the minimum is fine',
);

step('the dom cannot change or retire a rule until the time is up');
const changeAttempt = await dom.call('PUT', `${P}/rules/${rule.json.id}`, {
  body: 'Say good morning by 9am',
  attested: true,
  lockDays: 7,
});
assert.equal(changeAttempt.status, 409);
assert.equal(changeAttempt.json.code, 'rule-locked');
assert.equal(changeAttempt.json.lockedUntil, rule.json.lockedUntil);
const retireAttempt = await dom.call(
  'POST',
  `${P}/rules/${rule.json.id}/retire`,
  {},
);
assert.equal(retireAttempt.status, 409, 'retiring is a change too');
assert.equal(retireAttempt.json.code, 'rule-locked');
assert.equal(
  (await dom.call('GET', `${P}/rules`)).json.rules.find(
    (r) => r.id === rule.json.id,
  ).title,
  'Greet me',
  'nothing changed',
);

step(
  'the sub can raise or lower their minimum; rules already set keep the lock they were set with',
);
assert.equal((await dom.call('GET', `${P}/rules`)).json.minDays, 7);
assert.equal(
  (await sub.call('PUT', '/profile/me', { ruleChangeMinDays: 30 })).status,
  204,
);
assert.equal(
  (await dom.call('GET', `${P}/rules`)).json.minDays,
  30,
  'the dom can see it',
);
const thirty = await dom.call('POST', `${P}/rules`, {
  title: 'Thirty',
  body: 'x',
  attested: true,
  lockDays: 4,
});
assert.equal(
  thirty.json.lockDaysApplied,
  30,
  'a new rule uses the new minimum',
);
assert.equal(
  (await dom.call('GET', `${P}/rules`)).json.rules.find(
    (r) => r.id === rule.json.id,
  ).lockDaysApplied,
  7,
  'the earlier rule is unchanged',
);
assert.equal(
  (await sub.call('PUT', '/profile/me', { ruleChangeMinDays: 0 })).status,
  204,
);

step(
  'with no minimum, a rule can be changed straight away - and a change starts a new lock',
);
const free = await dom.call('POST', `${P}/rules`, {
  title: 'Greet me kindly',
  body: 'Say good morning',
  attested: true,
  lockDays: 0,
});
assert.equal(free.json.lockDaysApplied, 0);
assert.equal(free.json.locked, false);
assert.equal(
  (
    await dom.call('PUT', `${P}/rules/${free.json.id}`, {
      body: 'Say good morning by 9am',
    })
  ).status,
  400,
  'asks again',
);
assert.equal(
  (
    await dom.call('PUT', `${P}/rules/${free.json.id}`, {
      body: 'Say good morning by 9am',
      attested: true,
    })
  ).status,
  400,
  'and for how long',
);
const edited = await dom.call('PUT', `${P}/rules/${free.json.id}`, {
  body: 'Say good morning by 9am',
  attested: true,
  lockDays: 3,
});
assert.equal(edited.json.body, 'Say good morning by 9am');
assert.equal(edited.json.title, 'Greet me kindly', 'untouched parts stay');
assert.equal(edited.json.lockDaysApplied, 3);
assert.equal(edited.json.locked, true, 'the change starts a fresh lock');
assert.equal(
  (
    await dom.call('PUT', `${P}/rules/${free.json.id}`, {
      body: 'again',
      attested: true,
      lockDays: 0,
    })
  ).status,
  409,
);
assert.equal(
  (
    await sub.call('PUT', `${P}/rules/${free.json.id}`, {
      body: 'x',
      attested: true,
      lockDays: 0,
    })
  ).status,
  403,
);

step(
  'retiring and bringing back: retiring waits for the lock, bringing back asks again and locks again',
);
const quick = (
  await dom.call('POST', `${P}/rules`, {
    title: 'Quick',
    body: 'x',
    attested: true,
    lockDays: 0,
  })
).json;
assert.equal(
  (await dom.call('POST', `${P}/rules/${quick.id}/retire`, {})).status,
  204,
);
assert.equal(
  (await dom.call('GET', `${P}/rules`)).json.rules.find(
    (r) => r.id === quick.id,
  ).status,
  'retired',
);
assert.equal(
  (await dom.call('POST', `${P}/rules/${quick.id}/restore`, { lockDays: 2 }))
    .status,
  400,
  'needs the attestation',
);
assert.equal(
  (await dom.call('POST', `${P}/rules/${quick.id}/restore`, { attested: true }))
    .status,
  400,
  'and a lock',
);
assert.equal(
  (
    await dom.call('POST', `${P}/rules/${quick.id}/restore`, {
      attested: true,
      lockDays: 2,
    })
  ).status,
  204,
);
const restored = (await dom.call('GET', `${P}/rules`)).json.rules.find(
  (r) => r.id === quick.id,
);
assert.equal(restored.status, 'active');
assert.equal(restored.lockDaysApplied, 2);
assert.equal(restored.locked, true);

step('the sub comments; nothing is approved, and rules do not touch tasks');
const rules = (await sub.call('GET', `${P}/rules`)).json;
assert.equal(rules.you.canAssign, false);
assert.ok(rules.rules.length >= 4);
const target = `rule:${rule.json.id}`;
assert.equal(
  (
    await sub.call('POST', `${P}/comments`, {
      target,
      body: 'Could it be by 9am?',
    })
  ).status,
  201,
);
assert.equal(
  (
    await dom.call('POST', `${P}/comments`, {
      target,
      body: 'Yes, let us talk tonight',
    })
  ).status,
  201,
);
const thread = (await dom.call('GET', `${P}/comments?target=${target}`)).json;
assert.deepEqual(
  thread.map((c) => [c.by, c.alias, c.body]),
  [
    ['them', 'Sara', 'Could it be by 9am?'],
    ['you', 'Zak', 'Yes, let us talk tonight'],
  ],
);
assert.equal(
  (await sub.call('GET', `${P}/rules`)).json.rules.find(
    (r) => r.id === rule.json.id,
  ).comments,
  2,
);
assert.equal(
  (await stranger.call('GET', `${P}/comments?target=${target}`)).status,
  404,
);
assert.equal(
  (await sub.call('POST', `${P}/comments`, { target: 'rule:nope', body: 'hi' }))
    .status,
  404,
);
assert.equal(
  (await sub.call('POST', `${P}/comments`, { target, body: '   ' })).status,
  400,
);
assert.equal(
  (
    await dom.call('POST', `${P}/comments`, {
      target: `assignment:${kneel.id}`,
      body: 'Well done',
    })
  ).status,
  201,
  'tasks can be talked about too',
);
assert.ok(
  !JSON.stringify(
    (await sub.call('GET', `${P}/tasks`)).json.assignments,
  ).includes('ruleId'),
  'tasks carry no link to rules',
);

step('a paused dynamic can be read but not changed');
await dom.call('POST', `${P}/pause`, {});
assert.equal((await sub.call('GET', `${P}/tasks`)).status, 200);
assert.equal(
  (await dom.call('POST', `${P}/tasks`, { templateId: lib.Kneel })).status,
  409,
);
assert.equal(
  (
    await dom.call('POST', `${P}/rules`, {
      title: 'a',
      body: 'b',
      attested: true,
    })
  ).status,
  409,
);
assert.equal(
  (await sub.call('POST', `${P}/comments`, { target, body: 'hi' })).status,
  409,
);
await dom.call('POST', `${P}/resume`, {});

step(
  'solo mode: you hold both roles, so there is nobody to attest to or review',
);
const solo = (await sub.call('POST', '/dynamics/solo', {})).json;
const S = `/dynamics/${solo.id}`;
assert.deepEqual((await sub.call('GET', `${S}/tasks`)).json.you, {
  role: 'self',
  canAssign: true,
  isAssignee: true,
  partner: null,
});
const selfSoft = await sub.call('POST', `${S}/tasks`, {
  templateId: lib.Blindfolded,
  requiresReview: true,
});
assert.equal(selfSoft.status, 201, 'no attestation needed for yourself');
assert.equal(selfSoft.json.requiresReview, false, 'nor a review');
assert.equal(
  (await sub.call('POST', `${S}/tasks`, { templateId: lib.Spank })).json.code,
  'hard-limit',
  'but your own hard limits still hold',
);
assert.equal(
  (
    await sub.call('POST', `${S}/tasks/${selfSoft.json.id}/submit`, {
      response: {},
    })
  ).json.status,
  'done',
);
assert.equal(
  (
    await sub.call('POST', `${S}/rules`, {
      title: 'Early to bed',
      body: 'Lights out by 11',
      lockDays: 3,
    })
  ).status,
  201,
  'no attestation for your own rules',
);
assert.equal(
  (await dom.call('GET', `${S}/tasks`)).status,
  404,
  'nobody else can look',
);

step('once a dynamic has ended it is gone from view');
await dom.call('POST', `${P}/end`, {});
for (const path of ['tasks', 'rules', 'library'])
  assert.equal((await dom.call('GET', `${P}/${path}`)).status, 404, path);
assert.equal((await sub.call('GET', `${P}/tasks`)).status, 404);

console.log('\nAll task and rule checks passed.');
