import React from 'react';
import dayjs from 'dayjs';
import { Card, Statistic, Typography } from 'antd';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Open tasks fall into one of these by when they are due
export const windows = (assignments, now = Date.now()) => {
  const open = assignments.filter((a) => a.status === 'pending');
  const due = (a) => (a.dueAt ? new Date(a.dueAt).getTime() : null);
  const between = (from, to) =>
    open.filter((a) => due(a) !== null && due(a) >= from && due(a) < to);
  return {
    overdue: open.filter((a) => due(a) !== null && due(a) < now),
    next24: between(now, now + DAY),
    next48: between(now + DAY, now + 2 * DAY),
    nextWeek: between(now + 2 * DAY, now + 7 * DAY),
    undated: open.filter((a) => due(a) === null),
  };
};

export function Summary({ title, tasks, color, onDo }) {
  return (
    <Card size='small' style={{ minWidth: 220, flex: 1 }}>
      <Statistic
        title={title}
        value={tasks.length}
        styles={color ? { content: { color } } : undefined}
      />
      {tasks.slice(0, 4).map((a) => (
        <div key={a.id}>
          <Typography.Link onClick={() => onDo(a)}>
            {a.task.task}
          </Typography.Link>{' '}
          <Typography.Text type='secondary'>
            {a.dueAt ? dayjs(a.dueAt).format('ddd D MMM, h:mma') : ''}
          </Typography.Text>
        </div>
      ))}
      {tasks.length > 4 && (
        <Typography.Text type='secondary'>
          and {tasks.length - 4} more
        </Typography.Text>
      )}
    </Card>
  );
}
