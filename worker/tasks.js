import { assessAssignment } from './limits.js';

/**
 * Pure rules about tasks in a dynamic: which can be assigned to whom, and how
 * a response is checked. (Photo/video/audio and location proofs need file
 * storage and location consent, so they are not available yet.)
 */

export const SUPPORTED_PROOFS = [
  'attestation',
  'numeric',
  'text',
  'lines',
  'timer',
  'choice',
  'quiz',
];

const keysOf = (selections, catalog) =>
  new Set(selections.filter((s) => s.catalog === catalog).map((s) => s.key));

/**
 * Can this task be given to someone with these selections?
 *
 * Returns { assignable, reasons, hardLimits, softLimits } where each reason is
 *   { code: 'proof' }                      - needs a proof type not yet supported
 *   { code: 'body-part', keys: [...] }     - needs body parts they have not included
 *   { code: 'in-bounds-body' | 'clothing' | 'equipment' | 'space', keys: [...] } - likewise (from "What's in bounds?")
 * (hard limits are listed separately). Soft limits never make a task unavailable:
 * they are flagged, and the assigner must attest (see assessAssignment).
 */
// [field on the task, list it refers to, reason code]
const NEEDS = [
  ['requiresBodyPart', 'bodyParts', 'body-part'], // My Body
  ['requiresBoundsBody', 'boundsBody', 'in-bounds-body'],
  ['requiresClothing', 'boundsClothing', 'clothing'],
  ['requiresEquipment', 'equipment', 'equipment'],
  ['requiresSpaces', 'boundsSpaces', 'space'],
];

export const availability = (task, selections) => {
  const reasons = [];

  if (!SUPPORTED_PROOFS.includes(task.proof ?? 'attestation')) {
    reasons.push({ code: 'proof' });
  }

  // Everything a task needs must be in bounds for the person who would do it
  for (const [field, catalog, code] of NEEDS) {
    const chosen = keysOf(selections, catalog);
    const missing = (task[field] ?? []).filter((k) => !chosen.has(k));
    if (missing.length) reasons.push({ code, keys: missing });
  }

  const { hardLimits, softLimits } = assessAssignment(task, selections);
  return {
    assignable: reasons.length === 0 && hardLimits.length === 0,
    reasons,
    hardLimits,
    softLimits,
  };
};

const same = (a, b) =>
  String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** "Question | Answer" -> { question, answer } */
export const parseQuiz = (entries = []) =>
  entries.map((entry) => {
    const [question, ...rest] = String(entry).split('|');
    return { question: question.trim(), answer: rest.join('|').trim() };
  });

/**
 * Checks someone's response against the task's proof settings.
 * `startedAt` / `now` are timestamps in ms (timers are checked against when the
 * server saw them start). Returns { ok: true, response } with the response
 * cleaned up for storing, or { ok: false, error } (quizzes also say which
 * answers were wrong, so they can try again).
 */
export const checkResponse = (task, response = {}, { startedAt, now } = {}) => {
  switch (task.proof ?? 'attestation') {
    case 'attestation':
      return { ok: true, response: { done: true } };

    case 'numeric': {
      const value = response.value;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { ok: false, error: 'Enter a number' };
      }
      if (typeof task.minValue === 'number' && value < task.minValue) {
        return { ok: false, error: `Must be at least ${task.minValue}` };
      }
      if (typeof task.maxValue === 'number' && value > task.maxValue) {
        return { ok: false, error: `Must be at most ${task.maxValue}` };
      }
      return { ok: true, response: { value } };
    }

    case 'text': {
      const text =
        typeof response.text === 'string' ? response.text.trim() : '';
      if (!text) return { ok: false, error: 'Write something' };
      if (text.length > 10000) return { ok: false, error: 'That is too long' };
      if (task.minLength && text.length < task.minLength) {
        return {
          ok: false,
          error: `Write at least ${task.minLength} characters`,
        };
      }
      return { ok: true, response: { text } };
    }

    case 'lines': {
      const lines =
        typeof response.text === 'string'
          ? response.text
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
          : [];
      const wanted = task.repetitions ?? 1;
      if (lines.length !== wanted) {
        return {
          ok: false,
          error: `Write it exactly ${wanted} times, one per line`,
        };
      }
      const wrong = lines.findIndex((line) => !same(line, task.phrase));
      if (wrong !== -1) {
        return { ok: false, error: `Line ${wrong + 1} is not the phrase` };
      }
      return { ok: true, response: { lines: lines.length } };
    }

    case 'timer': {
      if (!startedAt) return { ok: false, error: 'Start the timer first' };
      const elapsed = Math.floor((now - startedAt) / 1000);
      // a couple of seconds of slack for the request itself
      if (elapsed < (task.seconds ?? 0) - 2) {
        return { ok: false, error: 'The time is not up yet' };
      }
      return { ok: true, response: { seconds: elapsed } };
    }

    case 'choice': {
      if (!(task.choices ?? []).includes(response.choice)) {
        return { ok: false, error: 'Choose one of the options' };
      }
      return { ok: true, response: { choice: response.choice } };
    }

    case 'quiz': {
      const quiz = parseQuiz(task.questions);
      const answers = Array.isArray(response.answers) ? response.answers : [];
      if (answers.length !== quiz.length) {
        return { ok: false, error: 'Answer every question' };
      }
      const incorrect = quiz
        .map((q, i) => (same(answers[i] ?? '', q.answer) ? -1 : i))
        .filter((i) => i !== -1);
      if (incorrect.length) {
        return {
          ok: false,
          error: 'Some answers are not right yet',
          incorrect,
        };
      }
      return {
        ok: true,
        response: { answers: answers.map((a) => String(a).trim()) },
      };
    }

    default:
      return { ok: false, error: 'This kind of task cannot be completed yet' };
  }
};
