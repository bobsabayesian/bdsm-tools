import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hashPassword,
  normalizeCode,
  randomCode,
  randomToken,
  sha256Hex,
  verifyPassword,
} from './passwords.js';

test('passwords verify only when correct, and hashes are salted', async () => {
  const hash = await hashPassword('correct horse battery');
  assert.ok(await verifyPassword('correct horse battery', hash));
  assert.equal(await verifyPassword('wrong horse battery', hash), false);
  assert.notEqual(hash, await hashPassword('correct horse battery'));
  assert.equal(await verifyPassword('anything', ''), false);
  assert.equal(await verifyPassword('anything', 'garbage$1$2$3'), false);
});

test('codes look right and are typed in forgivingly', () => {
  const code = randomCode(4);
  assert.match(code, /^([A-HJ-NP-Z2-9]{4}-){3}[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(
    normalizeCode(code.toLowerCase().replaceAll('-', ' ')),
    normalizeCode(code),
  );
  assert.equal(normalizeCode(code).length, 16);
  assert.notEqual(randomCode(4), randomCode(4));
});

test('tokens are long, URL-safe and unique; hashes are stable', async () => {
  const token = randomToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(token, randomToken());
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});
