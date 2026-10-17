// End-to-end check of accounts and dynamics against a running Worker:
//   BASE=http://localhost:8787 node scripts/smoke-accounts.mjs
// Run it against a fresh local database (sign-ups are rate limited per IP).
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
