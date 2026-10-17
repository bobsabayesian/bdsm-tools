import React from 'react';
import { Button, Modal, Typography } from 'antd';
import useCatalog from '../hooks/useCatalog';
import { kinkWithSide } from '../account/kinkText';
import { SOFT_LIMIT_ATTESTATION, SOFT_LIMIT_PROMPT } from '../account/limits';

/**
 * Shown when a task touches a soft limit. The person assigning must attest
 * (Yes) that they have talked about it, or Cancel - in which case nothing is
 * assigned. The server checks this too; this is just how it is asked.
 */
export function SoftLimitDialog({ open, limits, partner, onYes, onCancel }) {
  const { items: kinks } = useCatalog('kinks');
  const describe = (limit) =>
    kinkWithSide(
      kinks.find((k) => k.value === limit.key),
      limit.direction,
      limit.key,
    );

  return (
    <Modal
      open={open}
      title='Soft limit'
      onCancel={onCancel}
      destroyOnHidden
      mask={{ closable: false }}
      footer={[
        <Button key='yes' type='primary' onClick={onYes}>
          Yes
        </Button>,
        <Button key='cancel' onClick={onCancel}>
          Cancel
        </Button>,
      ]}
    >
      <Typography.Paragraph strong>{SOFT_LIMIT_PROMPT}</Typography.Paragraph>
      {(limits ?? []).map((limit) => (
        <Typography.Paragraph key={`${limit.key}/${limit.direction}`}>
          {limit.key ? describe(limit) : 'A soft limit'} &mdash;{' '}
          {partner ?? 'your partner'} has marked this as a soft limit.
        </Typography.Paragraph>
      ))}
      <Typography.Paragraph>{SOFT_LIMIT_ATTESTATION}</Typography.Paragraph>
    </Modal>
  );
}

/** The question asked whenever a rule is made, changed or brought back */
export function DiscussedDialog({ open, onYes, onCancel }) {
  return (
    <Modal
      open={open}
      title='Have you discussed this with your partner?'
      onCancel={onCancel}
      destroyOnHidden
      mask={{ closable: false }}
      footer={[
        <Button key='yes' type='primary' onClick={onYes}>
          Yes
        </Button>,
        <Button key='cancel' onClick={onCancel}>
          Cancel
        </Button>,
      ]}
    >
      <Typography.Paragraph>
        Rules should never be a surprise. If you choose Yes, it is recorded that
        you said you had talked about it, and your partner can see that.
      </Typography.Paragraph>
    </Modal>
  );
}
