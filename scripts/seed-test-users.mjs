// Sets up a local playground on a LOCAL Worker:
//   npm run seed:users
// - three test accounts (and a dynamic between two of them), with profiles filled in
// - if ADMIN_TOKEN is set (the top-level .env is read): demo tasks, some using the limits
// Safe to run repeatedly. Refuses to run against anything but localhost.
const BASE = process.env.BASE ?? 'http://localhost:8787';
const ADMIN = process.env.ADMIN_TOKEN;
const PASSWORD = 'test-password-123';
const USERS = ['dom-test', 'sub-test', 'switch-test'];

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  throw new Error(
    `Refusing to create test users on ${BASE} - local development only`,
  );
}

const call = async (cookie, method, path, data) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: data && JSON.stringify(data),
  });
  const setCookie = res.headers.get('set-cookie');
  return {
    status: res.status,
    cookie: setCookie ? setCookie.split(';')[0] : cookie,
    json: await res.json().catch(() => null),
  };
};
const admin = (path, data) =>
  fetch(`${BASE}/api/admin${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ADMIN}`,
    },
    body: JSON.stringify(data),
  }).then((res) => res.status); // 409 just means it is already there

// ---- accounts
const sessions = {};
for (const username of USERS) {
  let result = await call('', 'POST', '/account/login', {
    username,
    password: PASSWORD,
  });
  if (result.status === 401) {
    result = await call('', 'POST', '/account/signup', {
      username,
      password: PASSWORD,
    });
  }
  if (result.status >= 300)
    throw new Error(`${username}: ${JSON.stringify(result.json)}`);
  sessions[username] = result.cookie;
}

// ---- demo kinks and tasks (needs the admin token)
if (ADMIN) {
  // tasks have no unique key, so only add the ones that are not there yet
  const existingTasks = new Set(
    (
      await fetch(`${BASE}/api/admin/catalogs/tasks/items`, {
        headers: { authorization: `Bearer ${ADMIN}` },
      }).then((res) => res.json())
    ).map((t) => t.task),
  );
  for (const task of [
    { task: 'Make your bed as soon as you wake up' },
    {
      task: 'Drink water through the day',
      proof: 'numeric',
      unit: 'oz',
      minValue: 64,
      maxValue: 200,
    },
    {
      task: 'Kneel quietly with your hands behind your head',
      proof: 'timer',
      seconds: 60,
    },
    {
      task: 'Write a short reflection on your day',
      proof: 'text',
      minLength: 80,
      prompt: 'What went well? What was hard?',
    },
    {
      task: 'Write the house rule',
      proof: 'lines',
      phrase: 'I will ask before I act',
      repetitions: 5,
    },
    {
      task: "Choose tonight's dinner",
      proof: 'choice',
      choices: ['pasta', 'curry', 'salad'],
    },
    {
      task: 'Recite the safewords',
      proof: 'quiz',
      questions: ['Safeword to stop? | red', 'Safeword to slow down? | yellow'],
    },
    {
      task: 'Wear your rope harness for an hour',
      proof: 'timer',
      seconds: 3600,
      requiresEquipment: ['rope'],
    },
    {
      task: "Be teased about yesterday's mistake",
      kinksReceiving: ['humiliation'],
    },
    {
      task: 'Use formal honorifics all evening',
      kinksReceiving: ['high-protocol'],
    },
    {
      task: 'Send a good-morning message when you wake',
      kinksGeneral: ['long-distance-remote-control'],
    },
    {
      task: 'Join a group scene',
      kinksGeneral: ['group-sex'],
    },
    {
      task: 'Be watched while you do your chores',
      kinksGeneral: ['exhibitionism-voyeurism'],
    },
    {
      task: 'Wear a thong under your clothes today',
      requiresClothing: ['thong'],
    },
    {
      task: 'Spend ten minutes kneeling on the floor',
      proof: 'timer',
      seconds: 600,
      requiresBoundsBody: ['knees'],
    },
  ])
    if (!existingTasks.has(task.task))
      await admin('/catalogs/tasks/items', task);
}

// ---- profiles: everyone has been through setup, so tasks can be assigned
const profiles = {
  'dom-test': {
    parts: ['mouth', 'hands', 'feet'],
    gear: ['rope', 'blindfold', 'wrist restraints'],
    bounds: ['neck', 'knees', 'hands', 'feet'],
    clothing: ['pants', 'underwear-everyday'],
  },
  'sub-test': {
    parts: ['mouth', 'hands', 'feet', 'ass', 'thighs'],
    gear: ['rope', 'blindfold'],
    bounds: ['neck', 'knees', 'wrists', 'feet', 'ass-cheeks'],
    clothing: ['pants', 'underwear-everyday', 'thong'],
  },
  'switch-test': {
    parts: ['mouth', 'hands'],
    gear: ['rope'],
    bounds: ['neck', 'hands'],
    clothing: ['pants'],
  },
};
for (const [username, { parts, gear, bounds, clothing }] of Object.entries(
  profiles,
)) {
  await call(sessions[username], 'PUT', '/profile/bodyParts', { keys: parts });
  // "What's in bounds?" - body & anatomy, clothing and items (spaces: none yet)
  await call(sessions[username], 'PUT', '/profile/boundsBody', {
    keys: bounds,
  });
  await call(sessions[username], 'PUT', '/profile/boundsClothing', {
    keys: clothing,
  });
  await call(sessions[username], 'PUT', '/profile/equipment', { keys: gear });
  await call(sessions[username], 'PUT', '/profile/me', {
    pronouns: ['they/them'],
    about: `Hello from ${username}.`,
    ruleChangeMinDays: 7,
  });
}
// sub-test has hard and soft limits, so the limit handling can be seen
await call(sessions['sub-test'], 'PUT', '/profile/kinks', {
  choices: [
    { key: 'humiliation', direction: 'receive', state: 'hard-limit' },
    { key: 'high-protocol', direction: 'receive', state: 'soft-limit' },
    { key: 'praise-kink', direction: 'receive', state: 'love' },
    { key: 'aftercare', direction: 'receive', state: 'love' },
    { key: 'service-submission', direction: 'receive', state: 'like' },
    { key: 'exhibitionism-voyeurism', direction: 'any', state: 'soft-limit' },
    { key: 'group-sex', direction: 'any', state: 'hard-limit' },
  ],
});
await call(sessions['dom-test'], 'PUT', '/profile/kinks', {
  choices: [
    { key: 'high-protocol', direction: 'give', state: 'love' },
    { key: 'discipline', direction: 'give', state: 'love' },
    { key: 'praise-kink', direction: 'give', state: 'love' },
    { key: 'aftercare', direction: 'give', state: 'love' },
    { key: 'exhibitionism-voyeurism', direction: 'any', state: 'like' },
  ],
});

// ---- dom-test <-> sub-test, if they are not already in a dynamic together
const existing = (await call(sessions['dom-test'], 'GET', '/dynamics')).json;
if (!existing.some((d) => d.kind === 'pair' && d.status !== 'ended')) {
  const invite = (
    await call(sessions['dom-test'], 'POST', '/dynamics/invite', {
      role: 'dom',
      alias: 'Sir',
    })
  ).json;
  await call(sessions['sub-test'], 'POST', '/dynamics/join', {
    code: invite.code,
    alias: 'kitten',
  });
}

console.log(`Test users (password for all: ${PASSWORD})`);
for (const username of USERS) console.log(`  ${username}`);
console.log(
  '\ndom-test (as "Sir") and sub-test (as "kitten") are in a dynamic together; switch-test has none yet.',
);
console.log(
  'sub-test has hard limits (receiving humiliation, group sex) and soft limits (receiving high protocol, exhibitionism).',
);
console.log(
  ADMIN
    ? 'Demo tasks are in the library (the kinks list is already loaded).'
    : 'Set ADMIN_TOKEN (in .env) to also add demo tasks.',
);
