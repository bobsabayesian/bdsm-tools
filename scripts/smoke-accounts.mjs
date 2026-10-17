// End-to-end check of accounts and dynamics against a running Worker:
//   BASE=http://localhost:8787 node scripts/smoke-accounts.mjs
// Run it against a fresh local database (sign-ups are rate limited per IP).
// Set ADMIN_TOKEN as well to include a check that needs one extra kink created.
import assert from 'node:assert/strict';

const BASE = process.env.BASE ?? 'http://localhost:8787';
const PASSWORD = 'a long enough password';

class Person {
  constructor(name) {
    this.name = name;
    this.cookie = '';
  }
  async call(method, path, data, { raw } = {}) {
    const res = await fetch(BASE + '/api' + path, {
      method,
      headers: {
        ...(data === undefined
          ? {}
          : { 'content-type': raw ?? 'application/json' }),
        cookie: this.cookie,
      },
      body: data === undefined ? undefined : raw ? data : JSON.stringify(data),
    });
    const set = res.headers.get('set-cookie');
    if (set)
      this.cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    const text = await res.text();
    return { status: res.status, text, json: text ? JSON.parse(text) : null };
  }
  signup() {
    return this.call('POST', '/account/signup', {
      username: this.name,
      password: PASSWORD,
    });
  }
}

const step = (name) => console.log('•', name);
const [a, b, c] = ['alice-account', 'bob-account', 'carol-account'].map(
  (n) => new Person(n),
);

step('sign-up rules');
const signupA = await a.signup();
assert.equal(signupA.status, 201);
assert.match(signupA.json.recoveryCode, /^([A-Z2-9]{4}-){4}[A-Z2-9]{4}$/);
assert.equal((await b.signup()).status, 201);
assert.equal((await c.signup()).status, 201);
assert.equal(
  (await new Person(a.name.toUpperCase()).signup()).status,
  409,
  'usernames are case-insensitive',
);
assert.equal(
  (
    await new Person('short').call('POST', '/account/signup', {
      username: 'shorty',
      password: 'short',
    })
  ).status,
  400,
);
assert.equal((await a.call('GET', '/account/me')).json.username, a.name);
assert.equal(
  (await new Person('x').call('GET', '/dynamics')).status,
  401,
  'dynamics need a login',
);

step('login');
assert.equal(
  (
    await new Person(a.name).call('POST', '/account/login', {
      username: a.name,
      password: 'wrong password!!',
    })
  ).status,
  401,
);
assert.equal(
  (
    await new Person(a.name).call('POST', '/account/login', {
      username: 'nobody-here',
      password: PASSWORD,
    })
  ).status,
  401,
);

step('setup: the public catalogs offer groups and additive presets');
const publicParts = await (await fetch(`${BASE}/api/catalog/bodyParts`)).json();
assert.ok(
  publicParts.length >= 8 &&
    publicParts.every((p) => p.value && p.label && p.group),
);
const presets = await (
  await fetch(`${BASE}/api/catalog/bodyPartPresets`)
).json();
assert.ok(
  presets.length >= 3 &&
    presets.every((p) => Array.isArray(p.parts) && p.parts.length),
);
assert.ok(
  presets
    .flatMap((p) => p.parts)
    .every((k) => publicParts.some((p) => p.value === k)),
  'presets only contain real parts',
);

step("setup: What's in bounds? has its own lists, separate from My Body");
const catalogOf = async (name) =>
  (await fetch(`${BASE}/api/catalog/${name}`)).json();
const [boundsBody, boundsClothing, items] = await Promise.all([
  catalogOf('boundsBody'),
  catalogOf('boundsClothing'),
  catalogOf('equipment'),
]);
assert.ok(
  boundsBody.length >= 40 &&
    boundsBody.every((i) => i.value && i.label && i.group && i.description),
);
assert.ok(
  boundsClothing.length >= 15 &&
    boundsClothing.every((i) => i.value && i.label && i.group),
);
assert.ok(items.length >= 20);
assert.deepEqual(
  await catalogOf('boundsSpaces'),
  [],
  'spaces have none yet, so that section stays hidden',
);
assert.ok(
  !boundsBody.some((i) => i.value === 'ass'),
  'My Body keeps its own, coarser list',
);
const quick = await catalogOf('boundsPresets');
assert.ok(quick.length >= 5);
const exists = (list, keys) =>
  keys.every((k) => list.some((i) => i.value === k));
for (const q of quick) {
  assert.ok(
    exists(boundsBody, q.parts) &&
      exists(boundsClothing, q.clothing) &&
      exists(items, q.equipment),
    `${q.label} only names real things`,
  );
}
assert.ok(
  quick.some((q) => q.clothing.length > 0) &&
    quick.some((q) => q.parts.length > 0),
  'quick starts reach into more than one list',
);
assert.ok(
  !quick.some(
    (q) =>
      q.value !== 'select-everything' &&
      [...q.parts, ...q.clothing].length > 40,
  ),
  'no quick start is "everything"',
);

step('setup: body parts are chosen, validated and private');
assert.equal((await new Person('x').call('GET', '/profile')).status, 401);
let profile = (await b.call('GET', '/profile')).json;
assert.deepEqual(profile.steps, [
  { id: 'bodyParts', status: null },
  { id: 'boundsBody', status: null },
  { id: 'boundsClothing', status: null },
  { id: 'equipment', status: null },
  { id: 'kinks', status: null },
]);
assert.equal(profile.nextStep, 'bodyParts');
assert.equal(
  (await b.call('PUT', '/profile/bodyParts', { keys: ['mouth', 'nope'] }))
    .status,
  400,
  'unknown parts are refused',
);
assert.equal(
  (
    await b.call('PUT', '/profile/bodyParts', {
      choices: [{ key: 'mouth', state: 'no' }],
    })
  ).status,
  400,
  'body parts have no "no" state',
);
assert.equal(
  (
    await b.call('PUT', '/profile/bodyParts', {
      keys: ['mouth', 'pussy', 'mouth'],
    })
  ).status,
  204,
);
profile = (await b.call('GET', '/profile')).json;
assert.deepEqual(profile.selections.bodyParts.map((x) => x.key).sort(), [
  'mouth',
  'pussy',
]);
assert.equal(profile.steps[0].status, 'done');
assert.equal(profile.nextStep, 'boundsBody', "What's in bounds? comes next");
await b.call('PUT', '/profile/bodyParts', { keys: ['ass'] });
assert.deepEqual(
  (await b.call('GET', '/profile')).json.selections.bodyParts.map((x) => x.key),
  ['ass'],
  'saving replaces the earlier choice',
);
assert.equal(
  (await b.call('PUT', '/profile/bodyParts', { keys: [] })).status,
  204,
  'choosing nothing is allowed',
);

step('setup: skipping is allowed and can be undone');
assert.equal(
  (await c.call('POST', '/profile/steps/bodyParts/skip', {})).status,
  204,
);
profile = (await c.call('GET', '/profile')).json;
assert.equal(profile.steps[0].status, 'skipped');
assert.equal(
  profile.nextStep,
  'boundsBody',
  'a skipped step is not nagged about - on to the next',
);
await c.call('PUT', '/profile/bodyParts', { keys: ['throat'] });
await c.call('POST', '/profile/steps/bodyParts/skip', {});
assert.equal(
  (await c.call('GET', '/profile')).json.steps[0].status,
  'done',
  'skipping never undoes a finished step',
);

step('setup: equipment is chosen the same way');
const publicEquipment = await (
  await fetch(`${BASE}/api/catalog/equipment`)
).json();
assert.ok(
  publicEquipment.length >= 20 &&
    publicEquipment.every((e) => e.value && e.label),
);
assert.equal(
  (await b.call('PUT', '/profile/equipment', { keys: ['rope', 'not-real'] }))
    .status,
  400,
);
assert.equal(
  (
    await b.call('PUT', '/profile/equipment', {
      choices: [{ key: 'rope', state: 'love' }],
    })
  ).status,
  400,
  'equipment is just "I have this"',
);
assert.equal(
  (
    await b.call('PUT', '/profile/equipment', {
      keys: ['rope', 'blindfold', 'rope'],
    })
  ).status,
  204,
);
profile = (await b.call('GET', '/profile')).json;
assert.deepEqual(profile.selections.equipment.map((x) => x.key).sort(), [
  'blindfold',
  'rope',
]);
assert.equal(
  profile.nextStep,
  'boundsBody',
  'the other in-bounds lists are still to do',
);

step("setup: What's in bounds? is chosen one list at a time, and checked");
assert.equal(
  (await b.call('PUT', '/profile/boundsBody', { keys: ['neck', 'nonsense'] }))
    .status,
  400,
);
assert.equal(
  (await b.call('PUT', '/profile/boundsBody', { keys: ['ass'] })).status,
  400,
  "'ass' is a My Body part, not one of these",
);
assert.equal(
  (await b.call('PUT', '/profile/boundsClothing', { keys: ['thong', 'mouth'] }))
    .status,
  400,
  'clothing only takes clothing',
);
assert.equal(
  (await b.call('PUT', '/profile/boundsSpaces', { keys: [] })).status,
  404,
  'no spaces exist, so there is no step',
);
assert.equal(
  (
    await b.call('PUT', '/profile/boundsBody', {
      keys: ['neck', 'feet', 'neck'],
    })
  ).status,
  204,
);
assert.equal(
  (await b.call('PUT', '/profile/boundsClothing', { keys: ['thong', 'pants'] }))
    .status,
  204,
);
profile = (await b.call('GET', '/profile')).json;
assert.deepEqual(profile.selections.boundsBody.map((x) => x.key).sort(), [
  'feet',
  'neck',
]);
assert.deepEqual(profile.selections.boundsClothing.map((x) => x.key).sort(), [
  'pants',
  'thong',
]);
assert.deepEqual(
  profile.selections.bodyParts.map((x) => x.key),
  [],
  'My Body is untouched',
);
assert.equal(
  profile.nextStep,
  'kinks',
  "My Body and What's in bounds? are done; kinks are next",
);
for (const step of ['boundsBody', 'boundsClothing', 'equipment']) {
  assert.equal(
    (await c.call('POST', `/profile/steps/${step}/skip`, {})).status,
    204,
  );
}
assert.equal((await c.call('GET', '/profile')).json.nextStep, 'kinks');

step('saving several lists at once must not lose any of them');
const racer = new Person('racer-account');
assert.equal((await racer.signup()).status, 201);
await Promise.all([
  racer.call('PUT', '/profile/bodyParts', { keys: ['mouth'] }),
  racer.call('PUT', '/profile/boundsBody', { keys: ['neck'] }),
  racer.call('PUT', '/profile/boundsClothing', { keys: ['pants'] }),
  racer.call('PUT', '/profile/equipment', { keys: ['rope'] }),
]);
const raced = (await racer.call('GET', '/profile')).json;
assert.deepEqual(
  raced.steps.map((x) => x.status),
  ['done', 'done', 'done', 'done', null],
  'all four are marked done (kinks are still to do)',
);
assert.equal(raced.nextStep, 'kinks');
await Promise.all(
  ['boundsBody', 'equipment'].map((st) =>
    racer.call('POST', `/profile/steps/${st}/skip`, {}),
  ),
);
assert.deepEqual(
  (await racer.call('GET', '/profile')).json.steps.map((x) => x.status),
  ['done', 'done', 'done', 'done', null],
  'skipping never undoes a finished step',
);

step('the Me tab: optional details, validated, never required');
profile = (await b.call('GET', '/profile')).json;
assert.deepEqual(profile.me, {
  genders: [],
  pronouns: [],
  about: '',
  ruleChangeMinDays: 7,
  displayName: '',
});
assert.equal(
  (await b.call('PUT', '/profile/me', { genders: ['nonsense'] })).status,
  400,
  'unknown genders are refused',
);
assert.equal(
  (await b.call('PUT', '/profile/me', { pronouns: 'she/her' })).status,
  400,
);
assert.equal(
  (await b.call('PUT', '/profile/me', { about: 'x'.repeat(2001) })).status,
  400,
);
assert.equal(
  (await b.call('PUT', '/profile/me', { pronouns: Array(11).fill('x') }))
    .status,
  400,
);
assert.equal(
  (
    await b.call('PUT', '/profile/me', {
      pronouns: ['they/them', 'she/her', 'they/them'],
      about: '  I like a plan.  ',
    })
  ).status,
  204,
);
assert.deepEqual((await b.call('GET', '/profile')).json.me, {
  genders: [],
  pronouns: ['they/them', 'she/her'],
  about: 'I like a plan.',
  ruleChangeMinDays: 7,
  displayName: '',
});
assert.equal(
  (await b.call('PUT', '/profile/me', {})).status,
  204,
  'everything on this tab can be left blank',
);
await b.call('PUT', '/profile/me', {
  pronouns: ['they/them'],
  about: 'I like a plan.',
});

step('the display name is a private default for naming yourself in a dynamic');
assert.equal(
  (await b.call('PUT', '/profile/me', { displayName: 'x'.repeat(41) })).status,
  400,
);
assert.equal(
  (await b.call('PUT', '/profile/me', { displayName: 7 })).status,
  400,
);
assert.equal(
  (await b.call('PUT', '/profile/me', { displayName: '  Bob\u0007  ' })).status,
  204,
);
assert.equal(
  (await b.call('GET', '/profile')).json.me.displayName,
  'Bob',
  'trimmed, control characters removed',
);
assert.equal(
  (
    await b.call('PUT', '/profile/me', {
      pronouns: ['they/them'],
      about: 'I like a plan.',
    })
  ).status,
  204,
);
assert.equal(
  (await b.call('GET', '/profile')).json.me.displayName,
  'Bob',
  'left alone when not sent',
);
assert.equal(
  (await b.call('PUT', '/profile/me', { displayName: '' })).status,
  204,
);
assert.equal(
  (await b.call('GET', '/profile')).json.me.displayName,
  '',
  'an empty name clears it',
);
assert.equal(
  (
    await b.call('PUT', '/profile/me', {
      displayName: 'Bob',
      pronouns: ['they/them'],
      about: 'I like a plan.',
    })
  ).status,
  204,
);

step('the Me tab also holds the rule change minimum (days), default 7');
for (const bad of [-1, 366, 1.5, '7', null]) {
  assert.equal(
    (await b.call('PUT', '/profile/me', { ruleChangeMinDays: bad })).status,
    400,
    `${bad} is not allowed`,
  );
}
assert.equal(
  (await b.call('PUT', '/profile/me', { ruleChangeMinDays: 14 })).status,
  204,
);
assert.equal((await b.call('GET', '/profile')).json.me.ruleChangeMinDays, 14);
assert.equal(
  (
    await b.call('PUT', '/profile/me', {
      pronouns: ['they/them'],
      about: 'I like a plan.',
    })
  ).status,
  204,
);
assert.equal(
  (await b.call('GET', '/profile')).json.me.ruleChangeMinDays,
  14,
  'left alone when not sent',
);
assert.equal(
  (await b.call('PUT', '/profile/me', { ruleChangeMinDays: 0 })).status,
  204,
  'zero is allowed',
);
// the Me tab always sends everything, so the last save restores the details
assert.equal(
  (
    await b.call('PUT', '/profile/me', {
      pronouns: ['they/them'],
      about: 'I like a plan.',
      ruleChangeMinDays: 7,
    })
  ).status,
  204,
);

step(
  "kinks: the real list, the five-point scale, and what each section's sides mean",
);
const allKinks = await catalogOf('kinks');
const kink = Object.fromEntries(allKinks.map((k) => [k.value, k]));
assert.ok(allKinks.length >= 194);
assert.ok(
  new Set(allKinks.map((k) => k.category)).size >= 12,
  'twelve sections',
);
assert.deepEqual(
  [
    kink.discipline.sides,
    kink.discipline.giveLabel,
    kink.discipline.receiveLabel,
  ],
  ['both', 'As Dominant', 'As submissive'],
  'D/s sections are Dominant / submissive',
);
assert.equal(kink['non-con-rape-roleplay'].giveLabel, 'As aggressor');
assert.equal(kink['non-con-rape-roleplay'].receiveLabel, 'As target');
assert.equal(kink['sensual-massage'].giveLabel, 'As actor');
assert.equal(kink['nekomimi-cat-features'].receiveLabel, 'Self');
assert.equal(
  kink['exhibitionism-voyeurism'].sides,
  'any',
  'themes have a single answer',
);
assert.equal(kink['group-sex'].sides, 'any');
assert.equal(kink.aftercare.sides, 'both');
assert.ok(
  !kink.aftercare.giveLabel,
  'plain sections just say Giving / Receiving',
);
const quickKinks = await catalogOf('kinkPresets');
assert.equal(quickKinks.length, 7);
assert.ok(quickKinks.some((q) => q.label === 'Light Restraint'));
assert.ok(
  new Set(allKinks.map((k) => k.category)).size >= 24,
  'including the impact, pain and bondage sections',
);
const risky = allKinks
  .filter((k) => /\(Higher Risk\)$/.test(k.category))
  .map((k) => k.value);
assert.equal(
  risky.length,
  7,
  'four advanced pain items and three advanced bondage items',
);
assert.ok(
  !quickKinks
    .flatMap((q) => q.kinks)
    .some((k) => risky.includes(k) || k === 'single-tail-bullwhip'),
  'no quick start ever includes the higher-risk items or the whips',
);
assert.ok(
  kink['single-tail-bullwhip'] &&
    kink['needle-play'] &&
    kink.cutting &&
    kink.suspension &&
    kink.mummification,
  'but they are there to be rated - or set as hard limits',
);
assert.ok(
  quickKinks.every((q) => q.kinks.length > 0 && q.kinks.every((k) => kink[k])),
  'quick starts only name real kinks',
);

profile = (await b.call('GET', '/profile')).json;
assert.deepEqual(
  profile.steps.map((x) => x.id),
  ['bodyParts', 'boundsBody', 'boundsClothing', 'equipment', 'kinks'],
);
assert.equal(profile.nextStep, 'kinks', 'kinks come after the rest');

if (process.env.ADMIN_TOKEN) {
  const made = await fetch(`${BASE}/api/admin/catalogs/kinks/items`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
    },
    body: JSON.stringify({
      key: 'test-receive-only',
      label: 'Test',
      category: 'Test',
      order: 9001,
      sides: 'receive',
    }),
  });
  assert.equal(made.status, 201);
}

const put = (choices) => b.call('PUT', '/profile/kinks', { choices });
assert.equal(
  (await put([{ key: 'discipline', state: 'love' }])).status,
  400,
  'a side is required',
);
assert.equal(
  (await put([{ key: 'discipline', direction: 'receive', state: 'maybe' }]))
    .status,
  400,
  'only the five levels exist',
);
assert.equal(
  (await put([{ key: 'discipline', direction: 'any', state: 'like' }])).status,
  400,
  'a kink with sides is not answered once',
);
assert.equal(
  (
    await put([
      { key: 'exhibitionism-voyeurism', direction: 'give', state: 'like' },
    ])
  ).status,
  400,
  'a theme has no sides',
);
assert.equal(
  (await put([{ key: 'nonsense', direction: 'give', state: 'like' }])).status,
  400,
  'unknown kinks are refused',
);
if (process.env.ADMIN_TOKEN) {
  assert.equal(
    (
      await put([
        { key: 'test-receive-only', direction: 'give', state: 'like' },
      ])
    ).status,
    400,
    'receive-only kinks cannot be given',
  );
}

assert.equal(
  (
    await put([
      { key: 'discipline', direction: 'give', state: 'love' },
      { key: 'discipline', direction: 'receive', state: 'hard-limit' },
      { key: 'aftercare', direction: 'receive', state: 'soft-limit' },
      {
        key: 'exhibitionism-voyeurism',
        direction: 'any',
        state: 'indifferent',
      },
    ])
  ).status,
  204,
);
profile = (await b.call('GET', '/profile')).json;
const answers = Object.fromEntries(
  profile.selections.kinks.map((k) => [`${k.key}/${k.direction}`, k.state]),
);
assert.deepEqual(answers, {
  'discipline/give': 'love',
  'discipline/receive': 'hard-limit',
  'aftercare/receive': 'soft-limit',
  'exhibitionism-voyeurism/any': 'indifferent',
});
assert.equal(profile.nextStep, null);
assert.deepEqual(
  profile.selections.bodyParts.map((x) => x.key),
  [],
  'body part choices are untouched',
);
await put([{ key: 'discipline', direction: 'give', state: 'like' }]);
assert.equal(
  (await b.call('GET', '/profile')).json.selections.kinks.length,
  1,
  'saving replaces earlier answers',
);

assert.equal(
  (await c.call('POST', '/profile/steps/kinks/skip', {})).status,
  204,
);
assert.equal((await c.call('GET', '/profile')).json.nextStep, null);
assert.equal(
  (await c.call('POST', '/profile/steps/nonsense/skip', {})).status,
  404,
);

step('Alice invites, Bob joins');
const invite = await a.call('POST', '/dynamics/invite', {
  role: 'dom',
  alias: 'Sir',
});
assert.equal(invite.status, 201);
assert.equal(invite.json.status, 'invited');
const code = invite.json.code;
assert.equal(
  (await a.call('POST', '/dynamics/join', { code, alias: 'me' })).status,
  404,
  'cannot join your own invite',
);
assert.deepEqual((await b.call('POST', '/dynamics/preview', { code })).json, {
  inviterAlias: 'Sir',
  yourRole: 'sub',
});
const joined = await b.call('POST', '/dynamics/join', {
  code: code.toLowerCase().replaceAll('-', ' '),
  alias: 'kitten',
});
assert.equal(joined.status, 201);
assert.equal(joined.json.status, 'active');
assert.equal(joined.json.you.role, 'sub');
assert.equal(joined.json.partner.alias, 'Sir');
assert.equal(
  (await c.call('POST', '/dynamics/join', { code, alias: 'x' })).status,
  404,
  'invite codes are single-use',
);
const abId = joined.json.id;

step('Bob has a second dynamic with Carol; Alice must not learn of it');
const invite2 = await b.call('POST', '/dynamics/invite', {
  role: 'dom',
  alias: 'Boss',
});
assert.equal(
  (
    await c.call('POST', '/dynamics/join', {
      code: invite2.json.code,
      alias: 'pet',
    })
  ).status,
  201,
);
const bobList = (await b.call('GET', '/dynamics')).json;
assert.equal(bobList.length, 2);
const aliceView = await a.call('GET', '/dynamics');
assert.equal(aliceView.json.length, 1);
const carolView = await c.call('GET', '/dynamics');
assert.equal(carolView.json.length, 1);
for (const [who, view, hidden] of [
  [a, aliceView.text, [b.name, c.name, 'Boss', 'pet']],
  [c, carolView.text, [a.name, b.name, 'kitten', 'Sir']],
]) {
  for (const secret of hidden)
    assert.ok(!view.includes(secret), `${who.name} must not see "${secret}"`);
}
assert.ok(
  !aliceView.text.includes(b.name) && !/user_?id/i.test(aliceView.text),
  'partners never see usernames or ids',
);
assert.equal(
  (await c.call('GET', `/dynamics/${abId}`)).status,
  404,
  "strangers cannot open someone else's dynamic",
);

step('profiles: both people see each other in full - once it has been said');
await b.call('PUT', '/profile/bodyParts', { keys: ['mouth', 'pussy'] });
await b.call('PUT', '/profile/kinks', {
  choices: [
    { key: 'discipline', direction: 'receive', state: 'hard-limit' },
    { key: 'aftercare', direction: 'receive', state: 'soft-limit' },
    { key: 'domestic-servitude', direction: 'give', state: 'love' },
    { key: 'exhibitionism-voyeurism', direction: 'any', state: 'like' },
  ],
});
const seenByAlice = (await a.call('GET', `/dynamics/${abId}/profile`)).json;
assert.equal(seenByAlice.shared, true);
assert.deepEqual(seenByAlice.selections.bodyParts.map((x) => x.key).sort(), [
  'mouth',
  'pussy',
]);
const states = Object.fromEntries(
  seenByAlice.selections.kinks.map((k) => [`${k.key}/${k.direction}`, k.state]),
);
assert.deepEqual(
  states,
  {
    'discipline/receive': 'hard-limit',
    'aftercare/receive': 'soft-limit',
    'domestic-servitude/give': 'love',
    'exhibitionism-voyeurism/any': 'like',
  },
  'limits are shown in full, hard ones included',
);
assert.deepEqual(
  (await b.call('GET', `/dynamics/${abId}/profile`)).json,
  { shared: false },
  'nothing is shown until the person has been told it is shared',
);
assert.equal(
  (await a.call('PUT', '/profile/bodyParts', { keys: ['feet'] })).status,
  204,
);
assert.equal(
  (await b.call('GET', `/dynamics/${abId}/profile`)).json.selections
    .bodyParts[0].key,
  'feet',
  'it is mutual',
);
assert.deepEqual(
  seenByAlice.selections.equipment.map((x) => x.key).sort(),
  ['blindfold', 'rope'],
  'equipment is shared too',
);
assert.deepEqual(
  seenByAlice.me,
  {
    genders: [],
    pronouns: ['they/them'],
    about: 'I like a plan.',
    ruleChangeMinDays: 7,
  },
  'and so are the Me details',
);
assert.ok(
  !('displayName' in seenByAlice.me),
  "a partner never sees someone's display name",
);
assert.equal(
  (await c.call('GET', `/dynamics/${abId}/profile`)).status,
  404,
  'strangers see nothing',
);
const carolsDynamic = (await c.call('GET', '/dynamics')).json[0];
const carolSees = await c.call('GET', `/dynamics/${carolsDynamic.id}/profile`);
assert.deepEqual(
  carolSees.json.selections.bodyParts.map((x) => x.key).sort(),
  ['mouth', 'pussy'],
  'Bob is the same person in every dynamic',
);
assert.ok(
  !/alice/i.test(carolSees.text),
  "Carol learns nothing about Bob's other dynamic",
);
assert.equal((await a.call('POST', '/profile/share', {})).status, 204);
assert.equal((await a.call('GET', '/profile')).json.sharing.needsReview, false);

step('pause: only the person who paused can resume');
const resumeOn = new Date(Date.now() + 3 * 864e5).toISOString();
const paused = await b.call('POST', `/dynamics/${abId}/pause`, {
  reason: 'break',
  note: 'Exams this week',
  resumeOn,
});
assert.equal(paused.json.status, 'paused');
const seen = (await a.call('GET', `/dynamics/${abId}`)).json;
assert.equal(seen.lastEvent.note, 'Exams this week');
assert.equal(seen.lastEvent.by, 'them');
assert.equal(seen.lastEvent.reason, 'break');
assert.ok(seen.partner.lastActive, 'partner last-active is shown');
assert.equal(
  (await a.call('POST', `/dynamics/${abId}/resume`, {})).status,
  403,
);
assert.equal(
  (await b.call('POST', `/dynamics/${abId}/resume`, {})).json.status,
  'active',
);
assert.equal(
  (await b.call('POST', `/dynamics/${abId}/pause`, { resumeOn: 'yesterday' }))
    .status,
  400,
);
assert.equal(
  (await b.call('POST', `/dynamics/${abId}/pause`, { reason: 'because' }))
    .status,
  400,
);

step('ending is optional-reason, needs no approval, and freezes last-active');
const ended = await b.call('POST', `/dynamics/${abId}/end`, {});
assert.equal(ended.json.status, 'ended');
assert.equal(ended.json.lastEvent.note, null);
const frozen = (await a.call('GET', `/dynamics/${abId}`)).json.partner
  .lastActive;
assert.ok(frozen);
assert.equal((await a.call('POST', `/dynamics/${abId}/pause`, {})).status, 409);
assert.equal((await a.call('POST', `/dynamics/${abId}/end`, {})).status, 409);

assert.equal(
  (await a.call('GET', `/dynamics/${abId}/profile`)).status,
  404,
  'nothing is visible once a dynamic has ended',
);
assert.equal((await b.call('GET', `/dynamics/${abId}/profile`)).status, 404);

step('solo mode');
assert.equal(
  (await a.call('POST', '/dynamics/solo', {})).json.you.role,
  'self',
);
assert.equal((await a.call('POST', '/dynamics/solo', {})).status, 409);

step('withdrawing an unused invite');
const spare = await a.call('POST', '/dynamics/invite', {
  role: 'sub',
  alias: 'x',
});
assert.equal(
  (await a.call('DELETE', `/dynamics/${spare.json.id}`)).status,
  204,
);
assert.equal(
  (
    await b.call('POST', '/dynamics/join', {
      code: spare.json.code,
      alias: 'y',
    })
  ).status,
  404,
);

step('requests that are not JSON are refused');
assert.equal(
  (
    await a.call('POST', '/dynamics/solo', 'x=1', {
      raw: 'application/x-www-form-urlencoded',
    })
  ).status,
  415,
);

step('recovery code resets the password and logs everyone out');
const old = a.cookie;
const recovered = await new Person(a.name).call('POST', '/account/recover', {
  username: a.name,
  recoveryCode: signupA.json.recoveryCode.toLowerCase(),
  newPassword: 'brand new password',
});
assert.equal(recovered.status, 200);
assert.notEqual(recovered.json.recoveryCode, signupA.json.recoveryCode);
a.cookie = old;
assert.equal(
  (await a.call('GET', '/dynamics')).status,
  401,
  'old sessions are gone',
);
assert.equal(
  (
    await new Person(a.name).call('POST', '/account/recover', {
      username: a.name,
      recoveryCode: signupA.json.recoveryCode,
      newPassword: 'another new password',
    })
  ).status,
  401,
  'recovery codes work once',
);

step('deleting an account ends its dynamics for the other person');
assert.equal(
  (await c.call('DELETE', '/account', { password: 'nope nope nope' })).status,
  401,
);
assert.equal(
  (await c.call('DELETE', '/account', { password: PASSWORD })).status,
  204,
);
const afterDelete = (await b.call('GET', '/dynamics')).json.find(
  (d) => d.partner?.alias === 'Deleted account',
);
assert.ok(afterDelete, 'Bob sees a deleted account');
assert.equal(afterDelete.status, 'ended');
assert.equal((await c.call('GET', '/account/me')).json, null);
assert.equal(
  (
    await new Person('c').call('POST', '/account/login', {
      username: c.name,
      password: PASSWORD,
    })
  ).status,
  401,
);

step('login attempts are throttled');
const target = new Person('throttle');
let last;
for (let i = 0; i < 10; i++)
  last = await target.call('POST', '/account/login', {
    username: 'throttle-user',
    password: 'wrong password!!',
  });
assert.equal(last.status, 429);

console.log('\nAll account checks passed.');
