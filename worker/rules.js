/**
 * How long a rule stays as it is.
 *
 * When the person with control sets (or changes) a rule they say how many days
 * until it may be changed. The person living under the rules has a minimum in
 * their profile (default 7 days); the lock is whichever is LONGER, so the
 * setter can ask for more than the minimum but never less. Until the time is
 * up the rule cannot be changed or retired. The lock is worked out when the
 * rule is set and stays as it was then, even if the minimum is changed later.
 */

export const DEFAULT_MIN_DAYS = 7;
export const MAX_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A whole number of days from 0 to a year, or null */
export const wholeDays = (value) =>
  Number.isInteger(value) && value >= 0 && value <= MAX_DAYS ? value : null;

/** { applied, lockedUntil } for a rule set `now` (ms or Date) */
export const lockFor = (requestedDays, minDays, now = Date.now()) => {
  const applied = Math.max(requestedDays, minDays);
  return {
    applied,
    lockedUntil: new Date(
      new Date(now).getTime() + applied * DAY_MS,
    ).toISOString(),
  };
};

/** Is this rule still inside its lock? (Rules with no lock recorded are free.) */
export const isLocked = (lockedUntil, now = Date.now()) =>
  !!lockedUntil && new Date(lockedUntil).getTime() > new Date(now).getTime();
