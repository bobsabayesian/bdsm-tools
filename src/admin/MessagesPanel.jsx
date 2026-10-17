import React from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  theme,
} from 'antd';
import api, { errorMessage, isUnauthorized } from '../services/admin-api';

const TOPIC = {
  question: 'Question',
  'data-request': 'Remove my data',
  problem: 'Problem',
  suggestion: 'Suggestion',
  other: 'Other',
};

const when = (iso) => new Date(iso).toLocaleString();

function Conversation({ message, onChanged, onGone, onLookup, onError }) {
  const { token } = theme.useToken();
  const [reply, setReply] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const run = (promise) => promise.catch(onError);

  return (
    <Card
      size='small'
      style={{ marginBottom: 12 }}
      title={
        <Space wrap>
          <Badge dot={message.waiting}>
            <Tag>{TOPIC[message.topic] ?? 'Message'}</Tag>
          </Badge>
          <Tag color={message.status === 'handled' ? 'green' : 'gold'}>
            {message.status === 'handled' ? 'Handled' : 'New'}
          </Tag>
          {message.username && <Tag color='blue'>{message.username}</Tag>}
          <Typography.Text type='secondary'>
            {when(message.received)}
          </Typography.Text>
        </Space>
      }
      extra={
        <Space>
          {message.username && (
            <Button size='small' onClick={() => onLookup(message.username)}>
              Look up account
            </Button>
          )}
          <Button
            size='small'
            onClick={() =>
              run(
                api
                  .setMessageStatus(
                    message.id,
                    message.status === 'handled' ? 'new' : 'handled',
                  )
                  .then(onChanged),
              )
            }
          >
            Mark {message.status === 'handled' ? 'new' : 'handled'}
          </Button>
          <Popconfirm
            title='Delete this conversation?'
            description='They will no longer be able to open their link.'
            onConfirm={() => run(api.deleteMessage(message.id).then(onGone))}
          >
            <Button size='small' danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      {message.replyTo && (
        <Typography.Paragraph type='secondary'>
          They asked to be answered at: <b>{message.replyTo}</b>
        </Typography.Paragraph>
      )}
      <Space orientation='vertical' size={8} style={{ width: '100%' }}>
        {message.thread.map((t) => (
          <div
            key={t.at + t.from}
            style={{
              alignSelf: t.from === 'admin' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '8px 12px',
              background:
                t.from === 'admin'
                  ? token.colorErrorBg
                  : token.colorFillSecondary,
              borderRadius: 4,
              marginLeft: t.from === 'admin' ? 'auto' : 0,
            }}
          >
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              {t.from === 'admin' ? 'You' : 'Them'} &middot; {when(t.at)}
            </Typography.Text>
            <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {t.body}
            </Typography.Paragraph>
          </div>
        ))}
      </Space>
      <Space.Compact style={{ width: '100%', marginTop: 12 }}>
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 8 }}
          maxLength={4000}
          placeholder='Write a reply…'
          aria-label='Reply'
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
        <Button
          type='primary'
          loading={sending}
          disabled={!reply.trim()}
          onClick={() => {
            setSending(true);
            run(
              api
                .replyToMessage(message.id, reply)
                .then(() => {
                  setReply('');
                  return onChanged();
                })
                .finally(() => setSending(false)),
            );
          }}
        >
          Send
        </Button>
      </Space.Compact>
    </Card>
  );
}

/** Conversations from the contact form: read them, reply, and look the sender up */
export default function MessagesPanel({ onUnauthorized, onLookup }) {
  const [messages, setMessages] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [filter, setFilter] = React.useState('open');

  const fail = (e) =>
    isUnauthorized(e) ? onUnauthorized() : setError(errorMessage(e));
  const load = () =>
    api
      .messages()
      .then((list) => {
        setMessages(list);
        setError(null);
      })
      .catch(fail);
  React.useEffect(() => {
    load();
  }, []);

  if (!messages) return error ? <Alert type='error' title={error} /> : <Spin />;

  const shown = messages.filter((m) =>
    filter === 'open' ? m.status !== 'handled' : true,
  );

  return (
    <>
      {error && (
        <Alert type='error' title={error} style={{ marginBottom: 16 }} />
      )}
      <Space style={{ marginBottom: 16 }}>
        <Button
          type={filter === 'open' ? 'primary' : 'default'}
          onClick={() => setFilter('open')}
        >
          Needs a look ({messages.filter((m) => m.status !== 'handled').length})
        </Button>
        <Button
          type={filter === 'all' ? 'primary' : 'default'}
          onClick={() => setFilter('all')}
        >
          Everything ({messages.length})
        </Button>
      </Space>
      {shown.length === 0 ? (
        <Empty description='Nothing here.' />
      ) : (
        shown.map((m) => (
          <Conversation
            key={m.id}
            message={m}
            onChanged={load}
            onGone={load}
            onLookup={onLookup}
            onError={fail}
          />
        ))
      )}
    </>
  );
}
