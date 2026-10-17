import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_MIN_DAYS, isLocked, lockFor, wholeDays } from './rules.js';

const DAY = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 9, 17, 12, 0, 0);

test("the lock is the longer of what the setter asks and the other person's minimum", () => {
  assert.equal(DEFAULT_MIN_DAYS, 7);
  // asked for 4, their minimum is 7: it goes to 7
  assert.equal(lockFor(4, 7, start).applied, 7);
  // asked for more than the minimum: they get what they asked for
  assert.equal(lockFor(14, 7, start).applied, 14);
  assert.equal(lockFor(7, 7, start).applied, 7);
  // no minimum (solo): exactly what was asked
  assert.equal(lockFor(0, 0, start).applied, 0);
  assert.equal(lockFor(3, 0, start).applied, 3);
});

test('the lock runs from when the rule was set', () => {
  assert.equal(
    lockFor(4, 7, start).lockedUntil,
    new Date(start + 7 * DAY).toISOString(),
  );
  assert.equal(lockFor(0, 0, start).lockedUntil, new Date(start).toISOString());
});

test('a rule can be changed once the time is up, and not before', () => {
  const { lockedUntil } = lockFor(4, 7, start);
  assert.equal(isLocked(lockedUntil, start + 6 * DAY), true);
  assert.equal(isLocked(lockedUntil, start + 7 * DAY - 1000), true);
  assert.equal(
    isLocked(lockedUntil, start + 7 * DAY),
    false,
    'free at the moment the time is up',
  );
  assert.equal(isLocked(lockedUntil, start + 8 * DAY), false);
  assert.equal(
    isLocked(null, start),
    false,
    'older rules with no lock are free',
  );
});

test('days must be whole numbers from 0 to a year', () => {
  assert.equal(wholeDays(0), 0);
  assert.equal(wholeDays(7), 7);
  assert.equal(wholeDays(365), 365);
  for (const bad of [-1, 366, 1.5, '7', null, undefined, NaN])
    assert.equal(wholeDays(bad), null, String(bad));
});
