import React from 'react';
import { Button, Input, Modal, Space, Typography } from 'antd';
import api, { errorMessage } from '../services/tasks-api';
import { ResponseSummary } from './proofs';

/** The person who set a task looks over what was submitted: approve it, or send it back */
export default function ReviewModal({
  dynamicId,
  assignment,
  open,
  onClose,
  onChanged,
  onError,
}) {
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setNote(''), [assignment?.id, open]);
  if (!assignment) return null;

  const decide = (approve) => {
    setSaving(true);
    api
      .review(dynamicId, assignment.id, approve, note || undefined)
      .then(() => {
        onChanged();
        onClose();
      })
      .catch((e) => onError(errorMessage(e)))
      .finally(() => setSaving(false));
  };

  return (
    <Modal
      open={open}
      title={`Review: ${assignment.task.task}`}
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Button key='back' loading={saving} onClick={() => decide(false)}>
          Send back
        </Button>,
        <Button
          key='ok'
          type='primary'
          loading={saving}
          onClick={() => decide(true)}
        >
          Approve
        </Button>,
      ]}
    >
      <Space orientation='vertical' size='middle' style={{ width: '100%' }}>
        <div>
          <Typography.Text type='secondary'>What was submitted</Typography.Text>
          <div>
            <ResponseSummary
              task={assignment.task}
              response={assignment.response}
            />
          </div>
        </div>
        <Input.TextArea
          rows={3}
          maxLength={2000}
          aria-label='A note (optional)'
          placeholder='A note (optional)'
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Space>
    </Modal>
  );
}
