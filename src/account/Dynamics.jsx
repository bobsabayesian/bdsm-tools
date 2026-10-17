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
  Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../services/account-api';
import { EventSummary, LastActive, ROLE_LABEL, StatusTag } from './common';

const aliasRules = [
  { required: true, message: 'Choose a name' },
  { max: 40, message: 'At most 40 characters' },
];

function InviteModal({ open, onClose, onCreated }) {
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
          layout='vertical'
          initialValues={{ role: 'dom' }}
          onFinish={({ role, alias }) => {
            setSaving(true);
            setError(null);
            api
              .invite(role, alias)
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
            label='What should they call you in this dynamic?'
            name='alias'
            extra='Only they will see this. Your username stays private.'
            rules={aliasRules}
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

function JoinModal({ open, onClose, onJoined }) {
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
          layout='vertical'
          onFinish={({ alias }) =>
            run(
              api.joinDynamic(code, alias).then((joined) => {
                close();
                onJoined(joined);
              }),
            )
          }
        >
          <Typography.Paragraph>
            <b>{preview.inviterAlias}</b> has invited you to be the{' '}
            <b>{ROLE_LABEL[preview.yourRole]}</b>.
          </Typography.Paragraph>
          <Typography.Paragraph type='secondary'>
            In a dynamic you can see everything about each other &mdash; body
            parts, kinks and limits &mdash; and nothing is hidden between you.
          </Typography.Paragraph>
          <Form.Item
            label='What should they call you in this dynamic?'
            name='alias'
            extra='Only they will see this. Your username stays private.'
            rules={aliasRules}
          >
            <Input maxLength={40} autoFocus />
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
  const { kind, status, partner, you, lastEvent } = dynamic;
  const title =
    kind === 'solo'
      ? 'Just me'
      : status === 'invited'
        ? 'Waiting for someone to join'
        : partner.alias;

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
          You: {ROLE_LABEL[you.role]}, as &ldquo;{you.alias}&rdquo;
        </Typography.Text>
        <LastActive dynamic={dynamic} />
        {(status === 'paused' || status === 'ended') && lastEvent && (
          <EventSummary dynamic={dynamic} event={lastEvent} />
        )}
      </Space>
    </Card>
  );
}

export default function Dynamics() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [dynamics, setDynamics] = React.useState(null);
  const [inviting, setInviting] = React.useState(false);
  const [joining, setJoining] = React.useState(false);
  const [setupPending, setSetupPending] = React.useState(false);
  const [needsReview, setNeedsReview] = React.useState(false);

  const load = () =>
    api
      .listDynamics()
      .then(setDynamics)
      .catch((e) => message.error(errorMessage(e)));

  React.useEffect(() => {
    load();
    api
      .getProfile()
      .then((profile) => {
        setSetupPending(!!profile.nextStep);
        setNeedsReview(profile.sharing.needsReview);
      })
      .catch(() => {}); // the prompt is a nicety
  }, []);

  const open = (dynamic) => navigate(`/account/dynamics/${dynamic.id}`);
  const current = (dynamics ?? []).filter((d) => d.status !== 'ended');
  const ended = (dynamics ?? []).filter((d) => d.status === 'ended');

  return (
    <>
      {needsReview && (
        <Alert
          type='warning'
          showIcon
          style={{ marginBottom: 16 }}
          title='Your partners can now see your choices'
          description='You answered these when they were private. In a dynamic everything is open between you, so nothing is shown to anyone until you confirm. Take a look at your choices first if you like.'
          action={
            <Space>
              <Button size='small' onClick={() => navigate('/account/about')}>
                Review
              </Button>
              <Button
                size='small'
                type='primary'
                onClick={() =>
                  api
                    .shareProfile()
                    .then(() => setNeedsReview(false))
                    .catch((e) => message.error(errorMessage(e)))
                }
              >
                I understand, share them
              </Button>
            </Space>
          }
        />
      )}
      {setupPending && (
        <Alert
          type='info'
          showIcon
          style={{ marginBottom: 16 }}
          title='Finish setting up your profile'
          description='Tell us what you would like included in tasks and how you feel about different things. It takes a few minutes and you can change it later.'
          action={
            <Button
              size='small'
              type='primary'
              onClick={() => navigate('/account/setup')}
            >
              Set up
            </Button>
          }
        />
      )}
      <Space wrap style={{ marginBottom: 24 }}>
        <Button type='primary' onClick={() => setInviting(true)}>
          Invite someone
        </Button>
        <Button onClick={() => setJoining(true)}>Join with a code</Button>
        <Button
          disabled={(dynamics ?? []).some(
            (d) => d.kind === 'solo' && d.status !== 'ended',
          )}
          onClick={() =>
            api
              .startSolo()
              .then(open)
              .catch((e) => message.error(errorMessage(e)))
          }
        >
          Start on my own
        </Button>
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
      />
      <JoinModal
        open={joining}
        onClose={() => setJoining(false)}
        onJoined={open}
      />
    </>
  );
}
