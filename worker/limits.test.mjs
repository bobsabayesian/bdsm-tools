import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hardLimitConflicts, LEVELS, sidesFor } from './limits.js';

const row = (key, direction, state) => ({
  catalog: 'kinks',
  key,
  direction,
  state,
});

test('the scale runs from hard limit to love', () => {
  assert.deepEqual(LEVELS, [
    'hard-limit',
    'soft-limit',
    'indifferent',
    'like',
    'love',
  ]);
});

test('only hard limits block a task, and only on the matching side', () => {
  const selections = [
    row('spanking', 'receive', 'hard-limit'),
    row('rope', 'receive', 'soft-limit'),
    row('rope', 'give', 'hard-limit'),
    row('kissing', 'receive', 'love'),
  ];
  assert.deepEqual(
    hardLimitConflicts({ kinksReceiving: ['spanking'] }, selections),
    ['spanking'],
  );
  assert.deepEqual(
    hardLimitConflicts({ kinksGiving: ['spanking'] }, selections),
    [],
    'the give side was not limited',
  );
  assert.deepEqual(
    hardLimitConflicts({ kinksReceiving: ['rope'] }, selections),
    [],
    'a soft limit never blocks',
  );
  assert.deepEqual(hardLimitConflicts({ kinksGiving: ['rope'] }, selections), [
    'rope',
  ]);
  assert.deepEqual(
    hardLimitConflicts({ kinksReceiving: ['kissing'] }, selections),
    [],
  );
  assert.deepEqual(
    hardLimitConflicts({}, selections),
    [],
    'a task with no kinks is always allowed',
  );
});

test('body part choices are never mistaken for limits', () => {
  const selections = [
    {
      catalog: 'bodyParts',
      key: 'spanking',
      direction: '',
      state: 'hard-limit',
    },
  ];
  assert.deepEqual(
    hardLimitConflicts({ kinksReceiving: ['spanking'] }, selections),
    [],
  );
});

test('a kink can be one-sided', () => {
  assert.deepEqual(sidesFor('both'), ['give', 'receive']);
  assert.deepEqual(sidesFor(undefined), ['give', 'receive']);
  assert.deepEqual(sidesFor('receive'), ['receive']);
  assert.deepEqual(sidesFor('give'), ['give']);
});
