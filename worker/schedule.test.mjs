import test from 'node:test';
import assert from 'node:assert/strict';
import {
  endOfLocalDay,
  finished,
  localDate,
  occursOn,
  readRepeat,
  weekdayOf,
} from './schedule.js';

test("local dates follow the setter's timezone", () => {
  const at = Date.parse('2026-10-20T02:30:00Z');
  assert.equal(localDate(at, 0), '2026-10-20');
  assert.equal(
    localDate(at, 5 * 60),
    '2026-10-19',
    'UTC-5: still last evening',
  );
  assert.equal(localDate(at, -10 * 60), '2026-10-20', 'UTC+10');
  assert.equal(localDate(at, -22 * 60), '2026-10-21');
  assert.equal(weekdayOf('2026-10-20'), 2);
});

test('a local day ends at 23:59:59 where they are', () => {
  assert.equal(endOfLocalDay('2026-10-20', 0), '2026-10-20T23:59:59.000Z');
  assert.equal(endOfLocalDay('2026-10-20', 5 * 60), '2026-10-21T04:59:59.000Z');
  assert.equal(
    endOfLocalDay('2026-10-20', -10 * 60),
    '2026-10-20T13:59:59.000Z',
  );
});

test('which days a schedule covers', () => {
  const daily = {
    frequency: 'daily',
    start_date: '2026-10-20',
    end_date: '2026-10-22',
  };
  assert.equal(occursOn(daily, '2026-10-19'), false, 'before it starts');
  assert.equal(occursOn(daily, '2026-10-20'), true);
  assert.equal(occursOn(daily, '2026-10-22'), true, 'the end date counts');
  assert.equal(occursOn(daily, '2026-10-23'), false);
  assert.equal(finished(daily, '2026-10-23'), true);
  assert.equal(finished(daily, '2026-10-22'), false);
  const weekdays = {
    frequency: 'weekdays',
    start_date: '2026-10-01',
    end_date: null,
  };
  assert.equal(occursOn(weekdays, '2026-10-23'), true, 'a Friday');
  assert.equal(occursOn(weekdays, '2026-10-24'), false, 'a Saturday');
  const weekly = {
    frequency: 'weekly',
    weekday: 2,
    start_date: '2026-10-01',
    end_date: null,
  };
  assert.equal(occursOn(weekly, '2026-10-20'), true, 'a Tuesday');
  assert.equal(occursOn(weekly, '2026-10-21'), false);
  assert.equal(occursOn(weekly, '2026-10-27'), true);
});

test('reading a repeat request', () => {
  const ok = readRepeat(
    { frequency: 'weekly', tzOffset: 300, endDate: '2026-12-01' },
    '2026-10-20',
  );
  assert.equal(
    ok.repeat.weekday,
    2,
    'weekly means the same weekday as the first one',
  );
  assert.equal(ok.repeat.endDate, '2026-12-01');
  assert.equal(
    readRepeat({ frequency: 'daily', tzOffset: 0 }, '2026-10-20').repeat
      .endDate,
    null,
  );
  assert.ok(
    readRepeat({ frequency: 'hourly', tzOffset: 0 }, '2026-10-20').error,
  );
  assert.ok(
    readRepeat({ frequency: 'daily', tzOffset: 'x' }, '2026-10-20').error,
  );
  assert.ok(
    readRepeat(
      { frequency: 'daily', tzOffset: 0, endDate: '2026-10-01' },
      '2026-10-20',
    ).error,
  );
  assert.ok(
    readRepeat(
      { frequency: 'daily', tzOffset: 0, endDate: 'soon' },
      '2026-10-20',
    ).error,
  );
  assert.ok(readRepeat(undefined, '2026-10-20').error);
});
