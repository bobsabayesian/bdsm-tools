// Repeating tasks: which days a schedule covers, and the clock arithmetic for
// "end of day" in the setter's own timezone. Pure functions (see schedule.test.mjs).

export const FREQUENCIES = ['daily', 'weekdays', 'weekly'];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MINUTE = 60000;

/** The calendar date ("YYYY-MM-DD") at `now` for someone whose JS timezone offset is `tzOffset` minutes */
export const localDate = (now, tzOffset) =>
  new Date(now - tzOffset * MINUTE).toISOString().slice(0, 10);

/** 0 (Sunday) to 6 for a "YYYY-MM-DD" date */
export const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The instant (ISO) a local day ends: 23:59:59 for that person */
export const endOfLocalDay = (date, tzOffset) =>
  new Date(
    new Date(`${date}T23:59:59Z`).getTime() + tzOffset * MINUTE,
  ).toISOString();

/** Does the schedule produce a task on this local date? */
export const occursOn = (schedule, date) => {
  if (date < schedule.start_date) return false;
  if (schedule.end_date && date > schedule.end_date) return false;
  const day = weekdayOf(date);
  switch (schedule.frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return day >= 1 && day <= 5;
    case 'weekly':
      return day === schedule.weekday;
    default:
      return false;
  }
};

/** Has the schedule run its course by this local date? */
export const finished = (schedule, date) =>
  !!schedule.end_date && date > schedule.end_date;

/**
 * Reads the "repeat" part of a request: { frequency, startDate?, endDate?,
 * tzOffset }, given today's local date. Every repeated task is due by the end
 * of the day it is assigned. Returns { repeat } or { error }.
 */
export const readRepeat = (input, today) => {
  if (!input || typeof input !== 'object') return { error: 'Invalid repeat' };
  if (!FREQUENCIES.includes(input.frequency)) {
    return { error: 'Choose how often it repeats' };
  }
  const tzOffset = input.tzOffset;
  if (!Number.isInteger(tzOffset) || Math.abs(tzOffset) > 14 * 60) {
    return { error: 'Invalid timezone' };
  }
  let startDate = today;
  if (
    input.startDate !== undefined &&
    input.startDate !== null &&
    input.startDate !== ''
  ) {
    if (typeof input.startDate !== 'string' || !DATE.test(input.startDate)) {
      return { error: 'Invalid start date' };
    }
    if (input.startDate < today) return { error: 'The start date has passed' };
    startDate = input.startDate;
  }
  let endDate = null;
  if (
    input.endDate !== undefined &&
    input.endDate !== null &&
    input.endDate !== ''
  ) {
    if (typeof input.endDate !== 'string' || !DATE.test(input.endDate)) {
      return { error: 'Invalid end date' };
    }
    if (input.endDate < startDate) {
      return { error: 'The end date comes before the start' };
    }
    endDate = input.endDate;
  }
  return {
    repeat: {
      frequency: input.frequency,
      weekday: input.frequency === 'weekly' ? weekdayOf(startDate) : null,
      startDate,
      endDate,
      tzOffset,
    },
  };
};
