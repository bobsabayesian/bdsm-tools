import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysFor,
  effectiveDays,
  deleteAfterDays,
  fullPolicy,
  readPolicy,
  visibility,
} from './retention.js';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-20T00:00:00Z');
const ago = (days) => new Date(now - days * DAY).toISOString();

test('days fall back to the default, and a policy must be 1-365 whole days', () => {
  assert.equal(daysFor({}, 'media'), 30);
  assert.equal(daysFor({ media: 3 }, 'media'), 3);
  assert.equal(daysFor({ media: 0 }, 'media'), 30);
  assert.equal(readPolicy({ media: 0 }), null);
  assert.equal(readPolicy({ media: 1.5 }), null);
  assert.equal(readPolicy({ media: 366 }), null);
  assert.equal(readPolicy({ nonsense: 5 }), null);
  assert.deepEqual(readPolicy({ media: 1 }, { text: 9 }), {
    media: 1,
    text: 9,
  });
  assert.equal(Object.keys(fullPolicy({})).length, 10);
});

test('deletion waits at least a week, or longer if the person chose more', () => {
  assert.equal(deleteAfterDays(1), 7);
  assert.equal(deleteAfterDays(7), 7);
  assert.equal(deleteAfterDays(30), 30);
});

test("the partner stops seeing it after the person's number of days", () => {
  const at = (age, isOwner) =>
    visibility({ submittedAt: ago(age), days: 2, isOwner, now });
  assert.equal(at(1, false), 'visible');
  assert.equal(at(3, false), 'hidden');
  assert.equal(at(3, true), 'visible'); // they still see their own
  assert.equal(at(8, true), 'deleted'); // a week later it is gone for everyone
  assert.equal(at(8, false), 'deleted');
  assert.equal(visibility({ submittedAt: null, days: 2, now }), 'visible');
});

test("what is kept is the shorter of the two partners' numbers", () => {
  const days = (requested, setterDefault, doerMax) =>
    effectiveDays({ requested, setterDefault, doerMax });
  assert.equal(days(undefined, 30, 7), 7, 'their limit wins');
  assert.equal(
    days(undefined, 3, 30),
    3,
    "the setter's default wins when shorter",
  );
  assert.equal(days(10, 30, 30), 10, 'asked for less');
  assert.equal(days(60, 30, 20), 20, 'asked for more than they allow');
  assert.equal(days(0, 5, 30), 5, 'nonsense counts as not asked');
});
