import React from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
} from 'antd';
import api, { errorMessage, isUnauthorized } from '../services/admin-api';

const when = (iso) => (iso ? new Date(iso).toLocaleString() : 'never');

function ResetCodeDialog({ user, onClose, onError }) {
  const [note, setNote] = React.useState('');
  const [made, setMade] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  return (
    <Modal
      open
      title={`Reset code for ${user.username}`}
      onCancel={onClose}
      footer={
        made ? (
          <Button type='primary' onClick={onClose}>
            Done
          </Button>
        ) : (
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type='primary'
              loading={saving}
              onClick={() => {
                setSaving(true);
                api
                  .createResetCode(user.id, note)
                  .then(setMade)
                  .catch(onError)
                  .finally(() => setSaving(false));
              }}
            >
              Make a reset code
            </Button>
          </Space>
        )
      }
    >
      {made ? (
        <>
          <Typography.Paragraph>
            Send this to them in their private conversation. It works once, for
            one hour (until {when(made.expiresAt)}), and you will not be able to
            see it again. Any earlier code for this account no longer works.
          </Typography.Paragraph>
          <Typography.Paragraph
            copyable
            code
            style={{ fontSize: 22, textAlign: 'center' }}
          >
            {made.code}
          </Typography.Paragraph>
        </>
      ) : (
        <>
          <Alert
            type='warning'
            showIcon
            style={{ marginBottom: 16 }}
            title='Only after you have checked it is really them'
            description='Whoever has the code can take over this account and see everything in it. Check details only the owner would know, and ask their partner to confirm.'
          />
          <Input.TextArea
            rows={3}
            maxLength={200}
            placeholder='Why you are doing this (your own note, e.g. "partner confirmed")…'
            aria-label='Note'
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </>
      )}
    </Modal>
  );
}

/** Look an account up to check it, and make a one-time code for it */
export default function AccountsPanel({ onUnauthorized, initialQuery = '' }) {
  const [query, setQuery] = React.useState(initialQuery);
  const [users, setUsers] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [resetting, setResetting] = React.useState(null);

  const fail = (e) =>
    isUnauthorized(e) ? onUnauthorized() : setError(errorMessage(e));
  const search = (q) => {
    if (q.trim().length < 2) {
      setUsers(null);
      return;
    }
    api
      .findUsers(q.trim())
      .then((list) => {
        setUsers(list);
        setError(null);
      })
      .catch(fail);
  };
  React.useEffect(() => {
    if (initialQuery) search(initialQuery);
  }, [initialQuery]);

  return (
    <>
      <Typography.Paragraph type='secondary' style={{ maxWidth: 640 }}>
        Search by username (two letters or more). To check someone is who they
        say they are, compare what they tell you with the details below, and
        look for a message from their partner that mentions them.
      </Typography.Paragraph>
      <Input.Search
        allowClear
        placeholder='Username…'
        aria-label='Username'
        style={{ maxWidth: 360, marginBottom: 16 }}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onSearch={search}
      />
      {error && (
        <Alert type='error' title={error} style={{ marginBottom: 16 }} />
      )}
      {users && users.length === 0 && <Empty description='No match.' />}
      {(users ?? []).map((u) => (
        <Card
          key={u.id}
          size='small'
          style={{ marginBottom: 12 }}
          title={
            <Space>
              <b>{u.username}</b>
              {u.displayName && <Tag>{u.displayName}</Tag>}
            </Space>
          }
          extra={
            <Button size='small' onClick={() => setResetting(u)}>
              Make a reset code…
            </Button>
          }
        >
          <Space orientation='vertical' size={4}>
            <Typography.Text>
              Joined {when(u.createdAt)} &middot; last active{' '}
              {when(u.lastActiveAt)} &middot; {u.tasks} tasks
            </Typography.Text>
            {u.dynamics.length === 0 && (
              <Typography.Text type='secondary'>No dynamics.</Typography.Text>
            )}
            {u.dynamics.map((d, i) => (
              <Typography.Text key={i}>
                {d.kind === 'solo' ? 'Solo' : d.role} as <b>{d.name}</b>
                {d.title && d.title !== d.name ? ` (${d.title})` : ''},{' '}
                {d.status}
                {d.partners.length > 0 && ' - with '}
                {d.partners.map((p, j) => (
                  <span key={j}>
                    <b>{p.name}</b>
                    {p.title && p.title !== p.name ? ` (${p.title})` : ''} [
                    {p.username}]
                  </span>
                ))}
              </Typography.Text>
            ))}
            {u.events.length > 0 && (
              <Typography.Text type='secondary'>
                History:{' '}
                {u.events
                  .map(
                    (e) =>
                      `${e.type}${e.detail ? ` (${e.detail})` : ''} ${when(e.at)}`,
                  )
                  .join('; ')}
              </Typography.Text>
            )}
          </Space>
        </Card>
      ))}
      {resetting && (
        <ResetCodeDialog
          user={resetting}
          onClose={() => {
            setResetting(null);
            search(query);
          }}
          onError={fail}
        />
      )}
    </>
  );
}
