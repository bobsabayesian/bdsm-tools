import React from 'react';
import { Alert, Tag, Typography } from 'antd';

// Mirror SOFT_LIMIT_PROMPT / SOFT_LIMIT_ATTESTATION in worker/limits.js: what the
// person assigning a task that touches a soft limit sees, and attests to
export const SOFT_LIMIT_PROMPT =
  'Assignments should never be a surprise to your partner.';
export const SOFT_LIMIT_ATTESTATION =
  "I attest that we've talked about this soft limit.";

/** The scale, from firmest "no" to strongest "yes" (see worker/limits.js) */
export const LEVELS = [
  { value: 'hard-limit', label: 'Hard limit', color: 'red' },
  { value: 'soft-limit', label: 'Soft limit', color: 'orange' },
  { value: 'indifferent', label: 'Indifferent', color: 'default' },
  { value: 'interested', label: 'Interested', color: 'cyan' },
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
              <b>Soft limits are a conversation, not a setting.</b>{' '}
              {role === 'assigning'
                ? 'If a task touches one of your partner’s, you will be asked to attest that you have talked about it, and it is not assigned unless you do. Your attestation is recorded and your partner can see it.'
                : 'If a task touches one of yours, your partner must attest that you have talked about it before it can be given to you, and you will see that they did. If that is not true, talk to them.'}
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
            involves it. Your partners can see it, so they know.
          </Typography.Paragraph>
          <Typography.Paragraph style={{ margin: '8px 0 0' }}>
            <LevelTag level='soft-limit' />
            <b>A reason to talk.</b> When a task touches one, the person
            assigning it is shown a flag naming it: &ldquo;{SOFT_LIMIT_PROMPT}
            &rdquo; They must attest &mdash; &ldquo;{SOFT_LIMIT_ATTESTATION}
            &rdquo; &mdash; or the task is not assigned. Their attestation is
            recorded and you can see it. It is still best to tell your partner
            yourself first.
          </Typography.Paragraph>
        </>
      }
    />
  );
}
