import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assessAssignment,
  hardLimitConflicts,
  LEVELS,
  sidesFor,
  SOFT_LIMIT_ATTESTATION,
  SOFT_LIMIT_PROMPT,
  softLimitFlags,
} from './limits.js';

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
    [{ key: 'spanking', direction: 'receive' }],
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
    { key: 'rope', direction: 'give' },
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

test('soft limits are flagged to the assigner, only on the matching side, and never block', () => {
  const selections = [
    row('rope', 'receive', 'soft-limit'),
    row('rope', 'give', 'love'),
    row('spanking', 'receive', 'hard-limit'),
    row('service', 'give', 'soft-limit'),
  ];
  assert.deepEqual(softLimitFlags({ kinksReceiving: ['rope'] }, selections), [
    { key: 'rope', direction: 'receive' },
  ]);
  assert.deepEqual(
    softLimitFlags({ kinksGiving: ['rope'] }, selections),
    [],
    'giving rope is loved, not limited',
  );
  assert.deepEqual(
    softLimitFlags(
      { kinksGiving: ['service'], kinksReceiving: ['rope'] },
      selections,
    ),
    [
      { key: 'rope', direction: 'receive' },
      { key: 'service', direction: 'give' },
    ],
  );
  assert.deepEqual(
    softLimitFlags({ kinksReceiving: ['spanking'] }, selections),
    [],
    'hard limits are handled separately',
  );
  assert.deepEqual(
    hardLimitConflicts({ kinksReceiving: ['rope'] }, selections),
    [],
    'a flagged task is still allowed',
  );
  assert.deepEqual(softLimitFlags({}, selections), []);
});

test('the assigner sees the flag and attests in the agreed words', () => {
  assert.equal(
    SOFT_LIMIT_PROMPT,
    'Assignments should never be a surprise to your partner.',
  );
  assert.equal(
    SOFT_LIMIT_ATTESTATION,
    "I attest that we've talked about this soft limit.",
  );
});

const sel = [
  row('rope', 'receive', 'soft-limit'),
  row('service', 'give', 'soft-limit'),
  row('spanking', 'receive', 'hard-limit'),
];
const rope = { key: 'rope', direction: 'receive' };
const service = { key: 'service', direction: 'give' };

test('a task with nothing in the way is simply allowed', () => {
  const result = assessAssignment({ kinksReceiving: ['kissing'] }, sel);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.attested, []);
  assert.equal(assessAssignment({}, sel).allowed, true);
});

test('a soft limit needs the assigner to attest, or the task is not assigned', () => {
  const task = { kinksReceiving: ['rope'] };
  const refused = assessAssignment(task, sel);
  assert.equal(refused.allowed, false);
  assert.equal(refused.reason, 'attestation-required');
  assert.deepEqual(refused.missing, [rope]);

  const allowed = assessAssignment(task, sel, [rope]);
  assert.equal(allowed.allowed, true);
  assert.deepEqual(
    allowed.attested,
    [rope],
    'what to record on the assignment',
  );
});

test('each soft limit needs its own attestation, on the right side', () => {
  const task = { kinksReceiving: ['rope'], kinksGiving: ['service'] };
  assert.deepEqual(
    assessAssignment(task, sel, [rope]).missing,
    [service],
    'one is not enough',
  );
  assert.equal(assessAssignment(task, sel, [rope, service]).allowed, true);
  assert.equal(
    assessAssignment({ kinksReceiving: ['rope'] }, sel, [
      { key: 'rope', direction: 'give' },
    ]).allowed,
    false,
    'attesting about giving does not cover receiving',
  );
  assert.equal(
    assessAssignment({ kinksReceiving: ['rope'] }, sel, [rope, service])
      .allowed,
    true,
    'extra attestations are harmless',
  );
});

test('a hard limit refuses whatever has been attested', () => {
  const task = { kinksReceiving: ['spanking', 'rope'] };
  const result = assessAssignment(task, sel, [
    rope,
    { key: 'spanking', direction: 'receive' },
  ]);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'hard-limit');
  assert.deepEqual(result.hardLimits, [
    { key: 'spanking', direction: 'receive' },
  ]);
});

test('a kink with no sides has one answer, and a task can touch it', () => {
  assert.deepEqual(sidesFor('any'), ['any']);
  const selections = [
    {
      catalog: 'kinks',
      key: 'exhibitionism',
      direction: 'any',
      state: 'hard-limit',
    },
    { catalog: 'kinks', key: 'erp', direction: 'any', state: 'soft-limit' },
    {
      catalog: 'kinks',
      key: 'discipline',
      direction: 'receive',
      state: 'hard-limit',
    },
  ];
  assert.deepEqual(
    hardLimitConflicts({ kinksGeneral: ['exhibitionism'] }, selections),
    [{ key: 'exhibitionism', direction: 'any' }],
  );
  assert.deepEqual(softLimitFlags({ kinksGeneral: ['erp'] }, selections), [
    { key: 'erp', direction: 'any' },
  ]);
  // a general kink is not the same as a given or received one
  assert.deepEqual(
    hardLimitConflicts({ kinksGiving: ['exhibitionism'] }, selections),
    [],
  );
  assert.deepEqual(
    hardLimitConflicts({ kinksGeneral: ['discipline'] }, selections),
    [],
  );
  const result = assessAssignment({ kinksGeneral: ['erp'] }, selections);
  assert.equal(result.reason, 'attestation-required');
  assert.deepEqual(result.missing, [{ key: 'erp', direction: 'any' }]);
  assert.equal(
    assessAssignment({ kinksGeneral: ['erp'] }, selections, [
      { key: 'erp', direction: 'any' },
    ]).allowed,
    true,
  );
});
