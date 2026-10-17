import React from 'react';
import { Tag, Tooltip, Typography } from 'antd';
import moment from 'moment';

export const ROLE_LABEL = { dom: 'Dominant', sub: 'Submissive', self: 'Solo' };

export const REASONS = [
  { value: 'break', label: 'I need a break' },
  { value: 'not-working', label: "This isn't working for me" },
  { value: 'something-happened', label: 'Something happened' },
  { value: 'not-okay', label: "I'm not okay" },
];
const REASON_LABEL = {
  ...Object.fromEntries(REASONS.map(({ value, label }) => [value, label])),
  'account-deleted': 'Their account was deleted',
};

const STATUS = {
  invited: { color: 'blue', label: 'Waiting for them to join' },
  active: { color: 'green', label: 'Active' },
  paused: { color: 'gold', label: 'Paused' },
  ended: { color: 'default', label: 'Ended' },
};

export const StatusTag = ({ status }) => (
  <Tag color={STATUS[status].color}>{STATUS[status].label}</Tag>
);

const exact = (when) => moment(when).format('dddd D MMMM YYYY, HH:mm');

export const When = ({ at }) =>
  at ? (
    <Tooltip title={exact(at)}>
      <span>{moment(at).fromNow()}</span>
    </Tooltip>
  ) : null;

/** The other person's last-active time: live while the dynamic runs, frozen once it has ended */
export function LastActive({ dynamic }) {
  const { partner, status } = dynamic;
  if (!partner || !partner.lastActive) return null;
  return (
    <Typography.Text type='secondary'>
      {status === 'ended' ? 'Last active before this ended: ' : 'Last active: '}
      <When at={partner.lastActive} />
    </Typography.Text>
  );
}

const WHO = (dynamic) => ({
  you: 'You',
  them: dynamic.partner ? dynamic.partner.alias : 'They',
  system: 'It',
});

const VERB = { paused: 'paused', resumed: 'resumed', ended: 'ended' };

/** "Sir paused this - I need a break", with the note quoted underneath */
export function EventSummary({ dynamic, event, showWhen = false }) {
  if (!event) return null;
  const who = WHO(dynamic)[event.by];
  const verb =
    event.by === 'system' ? 'was resumed automatically' : VERB[event.type];
  return (
    <div>
      <Typography.Text>
        {who} {verb}
        {event.type !== 'resumed' && event.by !== 'system' ? ' this' : ''}
        {event.reason ? ` - ${REASON_LABEL[event.reason] ?? event.reason}` : ''}
        {showWhen && (
          <>
            {' '}
            (<When at={event.at} />)
          </>
        )}
      </Typography.Text>
      {event.note && (
        <Typography.Paragraph
          type='secondary'
          style={{ margin: '4px 0 0 12px', whiteSpace: 'pre-wrap' }}
        >
          &ldquo;{event.note}&rdquo;
        </Typography.Paragraph>
      )}
      {event.type === 'paused' && event.resumeOn && (
        <Typography.Paragraph type='secondary' style={{ margin: '4px 0 0' }}>
          Resumes on {moment(event.resumeOn).format('D MMMM YYYY')}
        </Typography.Paragraph>
      )}
    </div>
  );
}
