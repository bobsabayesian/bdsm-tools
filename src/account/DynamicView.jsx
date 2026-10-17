import React from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Input,
  Popconfirm,
  Space,
  Spin,
  Timeline,
  Typography,
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { SELECTED_DYNAMIC_KEY } from '../components/DynamicPage';
import PageHeader from '../components/PageHeader';
import api, { errorMessage } from '../services/account-api';
import useAccount from '../state/useAccount';
import PartnerProfile from './PartnerProfile';
import PauseEndDialog from './PauseEndDialog';
import { EventSummary, LastActive, ROLE_LABEL, StatusTag } from './common';

function MyName({ dynamic, onSaved }) {
  const { message } = App.useApp();
  const [alias, setAlias] = React.useState(dynamic.you.alias);

  return (
    <Space.Compact>
      <Input
        value={alias}
        maxLength={40}
        onChange={(e) => setAlias(e.target.value)}
        style={{ width: 200 }}
      />
      <Button
        disabled={!alias.trim() || alias.trim() === dynamic.you.alias}
        onClick={() =>
          api
            .setAlias(dynamic.id, alias)
            .then((updated) => {
              onSaved(updated);
              message.success('Saved');
            })
            .catch((e) => message.error(errorMessage(e)))
        }
      >
        Save
      </Button>
    </Space.Compact>
  );
}

export default function DynamicView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { user, loaded, refresh } = useAccount();
  const [dynamic, setDynamic] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [dialog, setDialog] = React.useState(null); // 'pause' | 'end' | null

  React.useEffect(() => {
    refresh();
  }, []);

  React.useEffect(() => {
    if (!user) return;
    api
      .getDynamic(id)
      .then(setDynamic)
      .catch((e) =>
        setError(
          e?.response?.status === 404
            ? 'This dynamic could not be found.'
            : errorMessage(e),
        ),
      );
  }, [id, user]);

  const back = () => navigate('/account');
  const act = (request, success) =>
    request
      .then((updated) => {
        setDynamic(updated);
        setDialog(null);
        if (success) message.success(success);
      })
      .catch((e) => message.error(errorMessage(e)));

  if (!loaded || (user && !dynamic && !error)) return <Spin size='large' />;
  if (!user) {
    return (
      <>
        <PageHeader title='My dynamics' onBack={back} />
        <Alert type='info' title='Please log in to see this.' />
        <Button style={{ marginTop: 16 }} onClick={back}>
          Log in
        </Button>
      </>
    );
  }
  if (error) {
    return (
      <>
        <PageHeader title='My dynamics' onBack={back} />
        <Alert type='warning' title={error} />
      </>
    );
  }

  const { status, kind, partner, you, history } = dynamic;
  const pausedByYou =
    status === 'paused' &&
    history.find((e) => e.type === 'paused')?.by === 'you';
  const title =
    kind === 'solo'
      ? 'Just me'
      : (partner?.alias ?? 'Waiting for someone to join');

  return (
    <>
      <PageHeader
        title={title}
        onBack={back}
        tags={<StatusTag status={status} />}
      />

      {status === 'paused' && (
        <Alert
          type='warning'
          showIcon
          style={{ marginBottom: 16 }}
          title={
            <EventSummary
              dynamic={dynamic}
              event={history.find((e) => e.type === 'paused')}
              showWhen
            />
          }
          description={
            pausedByYou
              ? undefined
              : 'Only the person who paused it can resume it.'
          }
        />
      )}
      {status === 'ended' && (
        <Alert
          type='info'
          showIcon
          style={{ marginBottom: 16 }}
          title={
            <EventSummary
              dynamic={dynamic}
              event={history.find((e) => e.type === 'ended')}
              showWhen
            />
          }
        />
      )}

      <Descriptions column={1} size='small' style={{ maxWidth: 520 }}>
        <Descriptions.Item label='You are'>
          {ROLE_LABEL[you.role]}
        </Descriptions.Item>
        <Descriptions.Item label='They call you'>
          {status === 'ended' ? (
            you.alias
          ) : (
            <MyName dynamic={dynamic} onSaved={setDynamic} />
          )}
        </Descriptions.Item>
        {partner && (
          <Descriptions.Item label={partner.alias}>
            <Space orientation='vertical' size={0}>
              <span>{ROLE_LABEL[partner.role]}</span>
              <LastActive dynamic={dynamic} />
            </Space>
          </Descriptions.Item>
        )}
      </Descriptions>

      <Space wrap style={{ margin: '16px 0 24px' }}>
        {status === 'active' && (
          <Button onClick={() => setDialog('pause')}>Pause</Button>
        )}
        {pausedByYou && (
          <Button type='primary' onClick={() => act(api.resume(id), 'Resumed')}>
            Resume
          </Button>
        )}
        {(status === 'active' || status === 'paused') && (
          <Button danger onClick={() => setDialog('end')}>
            End
          </Button>
        )}
        {status === 'invited' && (
          <Popconfirm
            title='Withdraw this invitation?'
            description='The code will stop working.'
            onConfirm={() =>
              api
                .withdrawInvite(id)
                .then(back)
                .catch((e) => message.error(errorMessage(e)))
            }
          >
            <Button danger>Withdraw invitation</Button>
          </Popconfirm>
        )}
      </Space>

      {partner && (status === 'active' || status === 'paused') && (
        <PartnerProfile dynamic={dynamic} />
      )}

      {(status === 'active' || status === 'paused') && (
        <Space style={{ marginBottom: 24 }}>
          {[
            ['Tasks', '/tasks'],
            ['Rules', '/rules'],
          ].map(([label, path]) => (
            <Button
              key={path}
              type={path === '/tasks' ? 'primary' : 'default'}
              onClick={() => {
                try {
                  localStorage.setItem(
                    SELECTED_DYNAMIC_KEY,
                    JSON.stringify(id),
                  );
                } catch {
                  // the selector will simply start on the first dynamic
                }
                navigate(path);
              }}
            >
              {label}
            </Button>
          ))}
        </Space>
      )}

      {history.length > 0 && (
        <>
          <Typography.Title level={5}>History</Typography.Title>
          <Timeline
            items={history.map((event) => ({
              children: (
                <EventSummary dynamic={dynamic} event={event} showWhen />
              ),
            }))}
          />
        </>
      )}

      <PauseEndDialog
        mode={dialog ?? 'pause'}
        open={!!dialog}
        onClose={() => setDialog(null)}
        onSubmit={(details) =>
          act(
            dialog === 'end' ? api.end(id, details) : api.pause(id, details),
            dialog === 'end' ? 'Ended' : 'Paused',
          )
        }
      />
    </>
  );
}
