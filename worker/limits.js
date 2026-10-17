/**
 * How someone feels about a kink, from firmest "no" to strongest "yes".
 *
 * - hard-limit:  never assigned. The app stops anyone assigning it.
 * - soft-limit:  a reason to talk. The app does NOT block it, flag it as a
 *                choice or offer a way to click past it: whether and how is a
 *                conversation between the two people, not a setting.
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

/** Which directions can be answered for a kink (default: both) */
export const sidesFor = (sides) => {
  if (sides === 'give' || sides === 'receive') return [sides];
  return SIDES;
};

/**
 * The kinks in a task that its assignee has made a hard limit. Tasks list
 * kinks from the assignee's point of view: ones they receive and ones they give.
 *
 * `selections` are rows of { catalog, key, direction, state }.
 * The result is for the server's use only - what an assigner is told must not
 * reveal which limit was hit.
 */
export const hardLimitConflicts = (task, selections) => {
  const hard = new Set(
    selections
      .filter((row) => row.catalog === 'kinks' && row.state === 'hard-limit')
      .map((row) => `${row.key}/${row.direction}`),
  );
  return [
    ...(task.kinksReceiving ?? []).filter((key) => hard.has(`${key}/receive`)),
    ...(task.kinksGiving ?? []).filter((key) => hard.has(`${key}/give`)),
  ];
};
