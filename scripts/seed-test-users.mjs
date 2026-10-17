// Creates test accounts (and a dynamic between two of them) on a LOCAL Worker:
//   npm run seed:users
// Safe to run repeatedly. Refuses to run against anything but localhost.
const BASE = process.env.BASE ?? 'http://localhost:8787';
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

const sessions = {};
for (const username of USERS) {
  let result = await call('', 'POST', '/account/signup', {
    username,
    password: PASSWORD,
  });
  if (result.status === 409) {
    result = await call('', 'POST', '/account/login', {
      username,
      password: PASSWORD,
    });
  }
  if (result.status >= 300)
    throw new Error(`${username}: ${JSON.stringify(result.json)}`);
  sessions[username] = result.cookie;
}

// dom-test <-> sub-test, if they are not already in a dynamic together
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
  '\ndom-test and sub-test are already in a dynamic together; switch-test has none yet.',
);
