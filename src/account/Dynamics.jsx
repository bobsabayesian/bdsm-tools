import React from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Empty,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Spin,
  Tooltip,
  Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../services/account-api';
import {
  dynamicTitle,
  EventSummary,
  LastActive,
  ROLE_LABEL,
  StatusTag,
} from './common';

const aliasRules = [
  { required: true, message: 'Choose a name' },
  { max: 40, message: 'At most 40 characters' },
];

function InviteModal({ open, onClose, onCreated, displayName }) {
  const [invite, setInvite] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  const close = () => {
    setInvite(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      title='Invite someone'
      onCancel={close}
      destroyOnHidden
      footer={
        invite ? (
          <Button type='primary' onClick={close}>
            Done
          </Button>
        ) : null
      }
    >
      {invite ? (
        <>
          <Typography.Paragraph>
            Share this code with them privately. It works once and expires in 7
            days. It will not be shown again, but you can invite them again if
            you lose it. Remember: you and they will be able to see everything
            about each other here &mdash; body parts, kinks and limits.
          </Typography.Paragraph>
          <Typography.Paragraph
            copyable
            code
            style={{ fontSize: 22, textAlign: 'center' }}
          >
            {invite.code}
          </Typography.Paragraph>
        </>
      ) : (
        <Form
          // starts again if the saved name turns up after the dialog opened
          key={displayName}
          layout='vertical'
          initialValues={{ role: 'dom', name: displayName || undefined }}
          onFinish={({ role, name, alias }) => {
            setSaving(true);
            setError(null);
            api
              .invite(role, name, alias)
              .then((created) => {
                setInvite(created);
                onCreated();
              })
              .catch((e) => setError(errorMessage(e)))
              .finally(() => setSaving(false));
          }}
        >
          {error && (
            <Alert type='error' title={error} style={{ marginBottom: 16 }} />
          )}
          <Form.Item label='You will be the' name='role'>
            <Radio.Group>
              <Radio.Button value='dom'>Dominant</Radio.Button>
              <Radio.Button value='sub'>Submissive</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            label='Your name here'
            name='name'
            extra='What they call you. Only they will see this; your username stays private.'
            rules={aliasRules}
          >
            <Input maxLength={40} />
          </Form.Item>
          <Form.Item
            label='Your title'
            name='alias'
            extra='For example Sir, Mistress or Kitten.'
            rules={[
              { required: true, message: 'Choose a title' },
              { max: 40, message: 'At most 40 characters' },
            ]}
          >
            <Input maxLength={40} />
          </Form.Item>
          <Button type='primary' htmlType='submit' loading={saving}>
            Create invitation
          </Button>
        </Form>
      )}
    </Modal>
  );
}

function JoinModal({ open, onClose, onJoined, displayName }) {
  const [preview, setPreview] = React.useState(null);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  const close = () => {
    setPreview(null);
    setCode('');
    setError(null);
    onClose();
  };
  const run = (request) => {
    setSaving(true);
    setError(null);
    request
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setSaving(false));
  };

  return (
    <Modal
      open={open}
      title='Join with a code'
      onCancel={close}
      destroyOnHidden
      footer={null}
    >
      {error && (
        <Alert type='error' title={error} style={{ marginBottom: 16 }} />
      )}
      {!preview ? (
        <Form
          layout='vertical'
          onFinish={() => run(api.previewInvite(code).then(setPreview))}
        >
          <Form.Item label='Invitation code' required>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder='XXXX-XXXX-XXXX-XXXX'
              autoComplete='off'
            />
          </Form.Item>
          <Button
            type='primary'
            htmlType='submit'
            loading={saving}
            disabled={!code.trim()}
          >
            Continue
          </Button>
        </Form>
      ) : (
        <Form
          key={displayName}
          layout='vertical'
          initialValues={{ name: displayName || undefined }}
          onFinish={({ name, alias }) =>
            run(
              api.joinDynamic(code, name, alias).then((joined) => {
                close();
                onJoined(joined);
              }),
            )
          }
        >
          <Typography.Paragraph>
            <b>{preview.inviterName}</b> has invited you to be the{' '}
            <b>{ROLE_LABEL[preview.yourRole]}</b>.
          </Typography.Paragraph>
          <Typography.Paragraph type='secondary'>
            In a dynamic you can see everything about each other &mdash; body
            parts, kinks and limits &mdash; and nothing is hidden between you.
          </Typography.Paragraph>
          <Form.Item
            label='Your name here'
            name='name'
            extra='What they call you. Only they will see this; your username stays private.'
            rules={aliasRules}
          >
            <Input maxLength={40} autoFocus />
          </Form.Item>
          <Form.Item
            label='Your title'
            name='alias'
            extra='For example Sir, Mistress or Kitten.'
            rules={[
              { required: true, message: 'Choose a title' },
              { max: 40, message: 'At most 40 characters' },
            ]}
          >
            <Input maxLength={40} />
          </Form.Item>
          <Space>
            <Button type='primary' htmlType='submit' loading={saving}>
              Join
            </Button>
            <Button onClick={() => setPreview(null)}>Back</Button>
          </Space>
        </Form>
      )}
    </Modal>
  );
}

function DynamicCard({ dynamic, onOpen }) {
  const { status, you, lastEvent } = dynamic;
  const title = dynamicTitle(dynamic);

  return (
    <Card
      hoverable
      size='small'
      onClick={onOpen}
      title={title}
      extra={<StatusTag status={status} />}
      style={{ marginBottom: 12 }}
    >
      <Space orientation='vertical' size={2} style={{ width: '100%' }}>
        <Typography.Text type='secondary'>
          You: {ROLE_LABEL[you.role]}
        </Typography.Text>
        <LastActive dynamic={dynamic} />
        {(status === 'paused' || status === 'ended') && lastEvent && (
          <EventSummary dynamic={dynamic} event={lastEvent} />
        )}
      </Space>
    </Card>
  );
}

export default function Dynamics({ displayName = '' }) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [dynamics, setDynamics] = React.useState(null);
  const [inviting, setInviting] = React.useState(false);
  const [joining, setJoining] = React.useState(false);

  const load = () =>
    api
      .listDynamics()
      .then(setDynamics)
      .catch((e) => message.error(errorMessage(e)));

  React.useEffect(() => {
    load();
  }, []);

  const open = (dynamic) => navigate(`/account/dynamics/${dynamic.id}`);
  const current = (dynamics ?? []).filter((d) => d.status !== 'ended');
  const ended = (dynamics ?? []).filter((d) => d.status === 'ended');
  const soloExists = (dynamics ?? []).some(
    (d) => d.kind === 'solo' && d.status !== 'ended',
  );

  return (
    <section id='dynamics'>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        My dynamics
      </Typography.Title>
      <Space wrap style={{ marginBottom: 24 }}>
        <Tooltip
          title={
            displayName
              ? 'Make a one-time code to give your partner (it expires in 7 days). You choose whether you are the dominant or the submissive; they get the other role.'
              : 'Add your display name first (Edit my profile, then Me).'
          }
        >
          <span>
            <Button
              type='primary'
              disabled={!displayName}
              onClick={() => setInviting(true)}
            >
              Invite someone
            </Button>
          </span>
        </Tooltip>
        <Tooltip
          title={
            displayName
              ? 'Enter a code your partner gave you to join the dynamic they started.'
              : 'Add your display name first (Edit my profile, then Me).'
          }
        >
          <span>
            <Button disabled={!displayName} onClick={() => setJoining(true)}>
              Join with a code
            </Button>
          </span>
        </Tooltip>
        <Tooltip
          title={
            !displayName
              ? 'Add your display name first (Edit my profile, then Me).'
              : soloExists
                ? 'You already have a solo dynamic.'
                : 'Just you: you assign yourself tasks and keep your own ledger. Nobody else sees it, and you can start a dynamic with someone later.'
          }
        >
          <span>
            <Button
              disabled={!displayName || soloExists}
              onClick={() =>
                api
                  .startSolo(displayName)
                  .then(open)
                  .catch((e) => message.error(errorMessage(e)))
              }
            >
              Start on my own
            </Button>
          </span>
        </Tooltip>
      </Space>

      {dynamics === null ? (
        <Spin size='large' />
      ) : (
        <>
          {current.length === 0 && (
            <Empty description='No dynamics yet. Invite someone, join with a code, or start on your own.' />
          )}
          {current.map((d) => (
            <DynamicCard key={d.id} dynamic={d} onOpen={() => open(d)} />
          ))}
          {ended.length > 0 && (
            <Collapse
              ghost
              items={[
                {
                  key: 'ended',
                  label: `Ended (${ended.length})`,
                  children: ended.map((d) => (
                    <DynamicCard
                      key={d.id}
                      dynamic={d}
                      onOpen={() => open(d)}
                    />
                  )),
                },
              ]}
            />
          )}
        </>
      )}

      <InviteModal
        open={inviting}
        onClose={() => setInviting(false)}
        onCreated={load}
        displayName={displayName}
      />
      <JoinModal
        open={joining}
        onClose={() => setJoining(false)}
        onJoined={open}
        displayName={displayName}
      />
    </section>
  );
}
