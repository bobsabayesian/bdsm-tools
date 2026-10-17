import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogs, validate } from './catalogs.js';

const task = (body) => validate(catalogs.tasks, body);

test('a task needs text but defaults to attestation', () => {
  assert.deepEqual(task({}).errors, ['Task is required']);
  assert.equal(task({ task: 'Make the bed' }).value.proof, 'attestation');
});

test('settings for other proof types are dropped, not stored', () => {
  const { value } = task({
    task: 'Drink water',
    proof: 'numeric',
    unit: 'ounces',
    minValue: 64,
    phrase: 'left over from a previous proof type',
    seconds: 30,
  });
  assert.equal(value.unit, 'ounces');
  assert.equal(value.minValue, 64);
  assert.equal(value.phrase, undefined);
  assert.equal(value.seconds, undefined);
});

test('settings required by the chosen proof type are enforced', () => {
  assert.deepEqual(task({ task: 'x', proof: 'lines' }).errors, [
    'Phrase to write is required',
    'Times to write it is required',
  ]);
  assert.deepEqual(task({ task: 'x', proof: 'choice', choices: [] }).errors, [
    'Choices is required',
  ]);
  assert.equal(
    task({ task: 'x', proof: 'timer', seconds: 600 }).value.seconds,
    600,
  );
  // ...but not for proof types that do not use them
  assert.equal(task({ task: 'x', proof: 'attestation' }).errors, undefined);
});

test('an unknown proof type or category type is rejected', () => {
  assert.ok(task({ task: 'x', proof: 'telepathy' }).errors);
  assert.ok(task({ task: 'x', category: 5 }).errors);
  assert.equal(
    task({ task: 'x', category: 'domestic' }).value.category,
    'domestic',
  );
});

test('keys are lower-cased and checked', () => {
  const genders = catalogs.genders;
  assert.equal(
    validate(genders, { key: ' Non  Binary ', label: 'NB' }).value.key,
    'non binary',
  );
  assert.ok(validate(genders, { key: '!!', label: 'x' }).errors);
});

test('a message needs text and a topic from the list; status starts as new', () => {
  const message = (body) => validate(catalogs.messages, body);
  assert.deepEqual(message({}).errors, ['Message is required']);
  const ok = message({ topic: 'question', message: 'Hello there' });
  assert.equal(ok.value.status, 'new');
  assert.deepEqual(ok.errors, undefined);
  assert.ok(message({ topic: 'spam', message: 'x' }).errors);
});
