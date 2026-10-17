// Data retention: the person doing a task chooses, per kind of proof, how many
// days their partner can see what they submitted. It only limits what the other
// person sees; it never blocks or penalises anything.
//
// The server also deletes the submission for good, but never sooner than a week
// ("just in case"), or the person's own number if that is longer.

export const PROOF_KINDS = [
  'attestation',
  'media',
  'numeric',
  'text',
  'lines',
  'timer',
  'choice',
  'quiz',
  'checkin',
  'location',
];
export const DEFAULT_DAYS = 30;
export const MIN_DAYS = 1;
export const MAX_DAYS = 365;
export const DELETE_FLOOR_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const whole = (value) =>
  Number.isInteger(value) && value >= MIN_DAYS && value <= MAX_DAYS;

/** The stored overrides, as an object (bad data counts as none) */
export const parsePolicy = (text) => {
  try {
    const value = JSON.parse(text ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
};

/** Days for one kind of proof, filling in the default */
export const daysFor = (policy, proof) =>
  whole(policy?.[proof]) ? policy[proof] : DEFAULT_DAYS;

/** Every kind of proof with its days - what a person sees and edits */
export const fullPolicy = (policy) =>
  Object.fromEntries(PROOF_KINDS.map((kind) => [kind, daysFor(policy, kind)]));

/** The new overrides from a request ({ kind: days }), or null if invalid */
export const readPolicy = (input, current = {}) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const next = { ...current };
  for (const [kind, days] of Object.entries(input)) {
    if (!PROOF_KINDS.includes(kind) || !whole(days)) return null;
    next[kind] = days;
  }
  return next;
};

/** Days after submitting that the submission is removed altogether */
export const deleteAfterDays = (days) => Math.max(DELETE_FLOOR_DAYS, days);

/**
 * What a viewer can see of a submission:
 *   'visible'  - everything
 *   'hidden'   - the partner's window has passed (the person who did it still sees it)
 *   'deleted'  - gone for everyone
 * `submittedAt` is an ISO date; a task with no recorded days keeps the default.
 */
export const visibility = ({
  submittedAt,
  days,
  isOwner,
  now = Date.now(),
}) => {
  if (!submittedAt) return 'visible';
  const kept = whole(days) ? days : DEFAULT_DAYS;
  const age = now - new Date(submittedAt).getTime();
  if (age > deleteAfterDays(kept) * DAY_MS) return 'deleted';
  if (!isOwner && age > kept * DAY_MS) return 'hidden';
  return 'visible';
};

const EXPIRED = `response IS NOT NULL AND submitted_at IS NOT NULL
         AND julianday('now') - julianday(submitted_at)
             > max(?, COALESCE(retention_days, ?))`;

/** Deletes submissions past their deletion date (and their files). Run daily. */
export const purgeExpired = async (env) => {
  const { DB: db, MEDIA: files } = env;
  if (files) {
    const { results } = await db
      .prepare(
        `SELECT id, dynamic_id FROM assignments
         WHERE ${EXPIRED} AND json_extract(task, '$.proof') = 'media'`,
      )
      .bind(DELETE_FLOOR_DAYS, DEFAULT_DAYS)
      .all();
    await Promise.all(
      results.map((r) => files.delete(`dynamics/${r.dynamic_id}/${r.id}`)),
    );
  }
  return db
    .prepare(`UPDATE assignments SET response = NULL WHERE ${EXPIRED}`)
    .bind(DELETE_FLOOR_DAYS, DEFAULT_DAYS)
    .run();
};
