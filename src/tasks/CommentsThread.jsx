import React from 'react';
import { App, Button, Input, Space, Spin, Typography } from 'antd';
import api, { errorMessage } from '../services/tasks-api';
import { When } from '../account/common';

/**
 * A little conversation under a rule or a task. Comments are how things get
 * talked about - they are not approvals and change nothing.
 */
export default function CommentsThread({
  dynamicId,
  target,
  canWrite,
  onCount,
}) {
  const { message } = App.useApp();
  const [comments, setComments] = React.useState(null);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    api
      .comments(dynamicId, target)
      .then(setComments)
      .catch((e) => message.error(errorMessage(e)));
  }, [dynamicId, target]);

  if (!comments) return <Spin size='small' />;

  const send = () => {
    setSending(true);
    api
      .comment(dynamicId, target, draft)
      .then((created) => {
        const next = [...comments, created];
        setComments(next);
        setDraft('');
        if (onCount) onCount(next.length);
      })
      .catch((e) => message.error(errorMessage(e)))
      .finally(() => setSending(false));
  };

  return (
    <Space orientation='vertical' size='small' style={{ width: '100%' }}>
      {comments.length === 0 && (
        <Typography.Text type='secondary'>No comments yet.</Typography.Text>
      )}
      {comments.map((c) => (
        <div key={c.id}>
          <Typography.Text strong>
            {c.by === 'you' ? 'You' : c.alias}
          </Typography.Text>{' '}
          <Typography.Text type='secondary'>
            <When at={c.createdAt} />
          </Typography.Text>
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {c.body}
          </Typography.Paragraph>
        </div>
      ))}
      {canWrite && (
        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            autoSize={{ minRows: 1, maxRows: 5 }}
            maxLength={2000}
            placeholder='Add a comment'
            aria-label='Add a comment'
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button loading={sending} disabled={!draft.trim()} onClick={send}>
            Send
          </Button>
        </Space.Compact>
      )}
    </Space>
  );
}
