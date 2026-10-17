import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availability, checkResponse, parseQuiz } from './tasks.js';

const sel = (catalog, key, state = 'yes', direction = '') => ({
  catalog,
  key,
  direction,
  state,
});

test('a task needing nothing is available', () => {
  const result = availability({ task: 'x' }, []);
  assert.equal(result.assignable, true);
  assert.deepEqual(result.reasons, []);
});

test('body parts and equipment the person has not chosen make a task unavailable, naming them', () => {
  const task = {
    requiresBodyPart: ['mouth', 'feet'],
    requiresEquipment: ['rope'],
  };
  const result = availability(task, [sel('bodyParts', 'mouth')]);
  assert.equal(result.assignable, false);
  assert.deepEqual(result.reasons, [
    { code: 'body-part', keys: ['feet'] },
    { code: 'equipment', keys: ['rope'] },
  ]);
  assert.equal(
    availability(task, [
      sel('bodyParts', 'mouth'),
      sel('bodyParts', 'feet'),
      sel('equipment', 'rope'),
    ]).assignable,
    true,
  );
});

test('hard limits make a task unavailable; soft limits are flagged but do not', () => {
  const selections = [
    sel('kinks', 'spanking', 'hard-limit', 'receive'),
    sel('kinks', 'rope', 'soft-limit', 'receive'),
  ];
  const hard = availability({ kinksReceiving: ['spanking'] }, selections);
  assert.equal(hard.assignable, false);
  assert.deepEqual(hard.hardLimits, [
    { key: 'spanking', direction: 'receive' },
  ]);

  const soft = availability({ kinksReceiving: ['rope'] }, selections);
  assert.equal(soft.assignable, true);
  assert.deepEqual(soft.softLimits, [{ key: 'rope', direction: 'receive' }]);
});

test('photo and location tasks cannot be assigned yet', () => {
  assert.equal(availability({ proof: 'media' }, []).assignable, false);
  assert.equal(availability({ proof: 'location' }, []).assignable, false);
  assert.equal(availability({ proof: 'timer' }, []).assignable, true);
});

test('attestation, numbers and text', () => {
  assert.equal(checkResponse({}, {}).ok, true);
  const numeric = { proof: 'numeric', minValue: 2, maxValue: 10 };
  assert.equal(checkResponse(numeric, { value: 5 }).ok, true);
  assert.equal(checkResponse(numeric, { value: 1 }).ok, false);
  assert.equal(checkResponse(numeric, { value: 11 }).ok, false);
  assert.equal(checkResponse(numeric, { value: '5' }).ok, false);
  const text = { proof: 'text', minLength: 10 };
  assert.equal(checkResponse(text, { text: '  short ' }).ok, false);
  assert.deepEqual(
    checkResponse(text, { text: ' long enough text ' }).response,
    { text: 'long enough text' },
  );
  assert.equal(checkResponse(text, { text: '' }).ok, false);
});

test('lines must be the phrase, written exactly the right number of times', () => {
  const task = { proof: 'lines', phrase: 'I will be good', repetitions: 3 };
  assert.equal(
    checkResponse(task, {
      text: 'I will be good\ni will be good\n  I WILL BE GOOD ',
    }).ok,
    true,
  );
  assert.match(
    checkResponse(task, { text: 'I will be good\nI will be good' }).error,
    /exactly 3 times/,
  );
  assert.match(
    checkResponse(task, { text: 'I will be good\nnope\nI will be good' }).error,
    /Line 2/,
  );
});

test('a timer is checked against when the server saw it start', () => {
  const task = { proof: 'timer', seconds: 600 };
  const started = 1_000_000;
  assert.equal(
    checkResponse(task, {}, { now: started + 700_000 }).ok,
    false,
    'never started',
  );
  assert.equal(
    checkResponse(task, {}, { startedAt: started, now: started + 300_000 }).ok,
    false,
  );
  assert.equal(
    checkResponse(task, {}, { startedAt: started, now: started + 599_000 }).ok,
    true,
    'a moment of slack',
  );
  assert.equal(
    checkResponse(task, {}, { startedAt: started, now: started + 700_000 })
      .response.seconds,
    700,
  );
});

test('choices and quizzes', () => {
  assert.equal(
    checkResponse(
      { proof: 'choice', choices: ['tea', 'coffee'] },
      { choice: 'tea' },
    ).ok,
    true,
  );
  assert.equal(
    checkResponse({ proof: 'choice', choices: ['tea'] }, { choice: 'wine' }).ok,
    false,
  );

  const quiz = {
    proof: 'quiz',
    questions: ['Safeword? | red', 'Colour for slow | Yellow | amber'],
  };
  assert.deepEqual(parseQuiz(quiz.questions), [
    { question: 'Safeword?', answer: 'red' },
    { question: 'Colour for slow', answer: 'Yellow | amber' },
  ]);
  assert.equal(
    checkResponse(quiz, { answers: ['RED ', 'yellow | amber'] }).ok,
    true,
  );
  const wrong = checkResponse(quiz, { answers: ['red', 'blue'] });
  assert.equal(wrong.ok, false);
  assert.deepEqual(wrong.incorrect, [1], 'says which answers to retry');
  assert.equal(checkResponse(quiz, { answers: ['red'] }).ok, false);
});
