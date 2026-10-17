/**
 * How someone feels about a kink, from firmest "no" to strongest "yes".
 *
 * - hard-limit:  never assigned. The app stops anyone assigning it.
 * - soft-limit:  a reason to talk. When a task touches one, the person assigning
 *                it is shown a flag naming it and must attest - Yes or
 *                Cancel - that they have talked about it with their partner
 *                (SOFT_LIMIT_PROMPT, SOFT_LIMIT_ATTESTATION). Without the
 *                attestation the task is not assigned. The app trusts an
 *                adult's word but records it, and both people can see it.
 * - indifferent / like / love: preferences that help a pair find things
 *                they will enjoy.
 *
 * Not answering is simply "not decided".
 */
export const LEVELS = [
  'hard-limit',
  'soft-limit',
  'indifferent',
  'like',
  'love',
];

const SIDES = ['give', 'receive'];

/**
 * Which directions can be answered for a kink: 'give' and 'receive' (the default),
 * only one of them, or 'any' for a kink with no sides at all (a theme such as
 * "Exhibitionism" is just liked or not - there is one answer).
 */
export const sidesFor = (sides) => {
  if (sides === 'any') return ['any'];
  if (sides === 'give' || sides === 'receive') return [sides];
  return SIDES;
};

// Which of a task's lists of kinks goes with which direction of answer
const TASK_KINKS = [
  ['kinksReceiving', 'receive'],
  ['kinksGiving', 'give'],
  ['kinksGeneral', 'any'],
];

/** The kinks in a task that the person has given this state, as [{ key, direction }] */
const touching = (task, selections, state) => {
  const marked = new Set(
    selections
      .filter((row) => row.catalog === 'kinks' && row.state === state)
      .map((row) => `${row.key}/${row.direction}`),
  );
  return TASK_KINKS.flatMap(([field, direction]) =>
    (task[field] ?? [])
      .filter((key) => marked.has(`${key}/${direction}`))
      .map((key) => ({ key, direction })),
  );
};

/**
 * The kinks in a task that its assignee has made a soft limit, as
 * [{ key, direction }]. The assigner is shown a flag for each, together with
 * SOFT_LIMIT_PROMPT. (They can already see the assignee's whole profile - people
 * in a dynamic are fully open to each other - but the flag is raised at the
 * moment it matters.)
 */
export const softLimitFlags = (task, selections) =>
  touching(task, selections, 'soft-limit');

/** Shown with the flag, then the person assigning must attest (Yes) or Cancel */
export const SOFT_LIMIT_PROMPT =
  'Assignments should never be a surprise to your partner.';
export const SOFT_LIMIT_ATTESTATION =
  "I attest that we've talked about this soft limit.";

/**
 * The kinks in a task that its assignee has made a hard limit, as
 * [{ key, direction }]. Tasks list kinks from the assignee's point of view:
 * ones they receive, ones they give, and general ones (kinks with no sides).
 *
 * `selections` are rows of { catalog, key, direction, state }.
 * Because people in a dynamic see each other's limits in full, the assign
 * screen can simply say a task is unavailable and why.
 */
export const hardLimitConflicts = (task, selections) =>
  touching(task, selections, 'hard-limit');

/**
 * Can this task be assigned to someone with these selections?
 *
 * `attested` lists the soft limits the assigner has attested they discussed:
 * [{ key, direction }]. This is checked on the SERVER when an assignment is
 * created - the screen's Yes button is not what makes it valid.
 *
 *  - a hard limit always refuses, whatever has been attested
 *  - each soft limit needs its own attestation (one per kink and side)
 *  - otherwise the task is allowed, and `attested` is what to record on it
 */
export const assessAssignment = (task, selections, attested = []) => {
  const hardLimits = hardLimitConflicts(task, selections);
  const softLimits = softLimitFlags(task, selections);
  const given = new Set(attested.map((a) => `${a.key}/${a.direction}`));
  const missing = softLimits.filter(
    (f) => !given.has(`${f.key}/${f.direction}`),
  );

  if (hardLimits.length > 0) {
    return {
      allowed: false,
      reason: 'hard-limit',
      hardLimits,
      softLimits,
      missing: [],
    };
  }
  if (missing.length > 0) {
    return {
      allowed: false,
      reason: 'attestation-required',
      hardLimits: [],
      softLimits,
      missing,
    };
  }
  return {
    allowed: true,
    reason: null,
    hardLimits: [],
    softLimits,
    missing: [],
    attested: softLimits,
  };
};
