import React from 'react';
import { Alert, Tag, Typography } from 'antd';

/** The scale, from firmest "no" to strongest "yes" (see worker/limits.js) */
export const LEVELS = [
  { value: 'hard-limit', label: 'Hard limit', color: 'red' },
  { value: 'soft-limit', label: 'Soft limit', color: 'orange' },
  { value: 'indifferent', label: 'Indifferent', color: 'default' },
  { value: 'like', label: 'Like', color: 'green' },
  { value: 'love', label: 'Love', color: 'magenta' },
];

export const LevelTag = ({ level }) => {
  const found = LEVELS.find((l) => l.value === level);
  return found ? <Tag color={found.color}>{found.label}</Tag> : null;
};

/**
 * Said to both people, wherever limits are set or tasks are assigned:
 * hard limits are handled by the app; soft limits are a conversation, never a
 * setting that can be clicked past.
 *
 * variant 'setting' - on the screen where limits are chosen
 * variant 'task'    - wherever a task is being assigned or has been received
 *                     (`role` is 'assigning' or 'receiving')
 */
export function LimitsNotice({ variant = 'setting', role }) {
  if (variant === 'task') {
    return (
      <Alert
        type='info'
        showIcon
        title='Limits'
        description={
          <>
            <Typography.Paragraph style={{ margin: 0 }}>
              {role === 'assigning'
                ? 'Tasks that cross a hard limit are never offered, so you do not need to check for them.'
                : 'A task that crosses a hard limit can never be given to you.'}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ margin: '8px 0 0' }}>
              <b>Soft limits are a conversation, not a setting.</b> The app will
              not block a task over one, and nobody can click past one.{' '}
              {role === 'assigning'
                ? 'If you are unsure whether a task touches something your partner is wary of, talk to them first.'
                : 'If a task touches something you are wary of, tell your partner.'}
            </Typography.Paragraph>
          </>
        }
      />
    );
  }

  return (
    <Alert
      type='info'
      showIcon
      title='How limits work'
      description={
        <>
          <Typography.Paragraph style={{ margin: 0 }}>
            <LevelTag level='hard-limit' />
            Never assigned. The app will not let anyone give you a task that
            involves it.
          </Typography.Paragraph>
          <Typography.Paragraph style={{ margin: '8px 0 0' }}>
            <LevelTag level='soft-limit' />
            <b>A reason to talk, not a setting.</b> The app will not block it,
            and nobody can click past it. If you choose one, tell your partner
            yourself &mdash; it is a conversation for the two of you.
          </Typography.Paragraph>
        </>
      }
    />
  );
}
