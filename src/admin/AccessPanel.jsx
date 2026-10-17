import React from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import api, { errorMessage, isUnauthorized } from '../services/admin-api';

const MODES = [
  {
    value: 'invite',
    label: 'Invite only',
    help: 'Signing up needs a code from you. Each code works once.',
  },
  {
    value: 'open',
    label: 'Open',
    help: 'Anyone can sign up (limited to 10 an hour from one connection).',
  },
  {
    value: 'closed',
    label: 'Closed',
    help: 'Nobody can sign up, whatever codes they have.',
  },
];

const when = (iso) => (iso ? new Date(iso).toLocaleString() : '');

/** Who can sign up, the invite codes you have made, and recent password resets */
export default function AccessPanel({ onUnauthorized }) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [made, setMade] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  const fail = (e) =>
    isUnauthorized(e) ? onUnauthorized() : setError(errorMessage(e));
  const load = () =>
    api
      .access()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch(fail);
  React.useEffect(() => {
    load();
  }, []);

  if (!data) return error ? <Alert type='error' title={error} /> : <Spin />;

  return (
    <>
      {error && (
        <Alert type='error' title={error} style={{ marginBottom: 16 }} />
      )}
      <Typography.Title level={5}>Who can sign up</Typography.Title>
      <Radio.Group
        value={data.mode}
        onChange={(e) =>
          api.setSignupMode(e.target.value).then(load).catch(fail)
        }
      >
        <Space orientation='vertical'>
          {MODES.map((m) => (
            <Radio key={m.value} value={m.value}>
              <b>{m.label}</b> &mdash; {m.help}
            </Radio>
          ))}
        </Space>
      </Radio.Group>

      <Typography.Title level={5} style={{ marginTop: 32 }}>
        Invite codes
      </Typography.Title>
      <Form
        layout='inline'
        style={{ marginBottom: 16, rowGap: 8 }}
        onFinish={({ note, days }) => {
          setSaving(true);
          api
            .createInvite(note ?? '', days ?? undefined)
            .then((result) => {
              setMade(result);
              return load();
            })
            .catch(fail)
            .finally(() => setSaving(false));
        }}
      >
        <Form.Item name='note'>
          <Input
            placeholder='Who is it for (your note)…'
            aria-label='Note'
            maxLength={200}
            style={{ width: 260 }}
          />
        </Form.Item>
        <Form.Item name='days'>
          <InputNumber
            min={1}
            max={365}
            precision={0}
            placeholder='Expires in (days)'
            aria-label='Expires in days'
            style={{ width: 170 }}
          />
        </Form.Item>
        <Button type='primary' htmlType='submit' loading={saving}>
          Make an invite code
        </Button>
      </Form>
      <Table
        size='small'
        rowKey='id'
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        dataSource={data.invites}
        locale={{ emptyText: 'No invite codes yet.' }}
        columns={[
          { title: 'For', dataIndex: 'note', render: (n) => n || '-' },
          { title: 'Made', dataIndex: 'createdAt', render: when },
          {
            title: 'Expires',
            dataIndex: 'expiresAt',
            render: (v) => (v ? when(v) : 'never'),
          },
          {
            title: 'State',
            dataIndex: 'state',
            render: (state, row) =>
              state === 'used' ? (
                <Tag color='green'>Used {when(row.usedAt)}</Tag>
              ) : state === 'expired' ? (
                <Tag>Expired</Tag>
              ) : (
                <Tag color='gold'>Unused</Tag>
              ),
          },
          {
            title: '',
            render: (_, row) =>
              row.state === 'unused' && (
                <Popconfirm
                  title='Remove this code?'
                  onConfirm={() =>
                    api.deleteInvite(row.id).then(load).catch(fail)
                  }
                >
                  <Button size='small' danger>
                    Remove
                  </Button>
                </Popconfirm>
              ),
          },
        ]}
      />

      <Typography.Title level={5} style={{ marginTop: 32 }}>
        Recent password resets
      </Typography.Title>
      <Table
        size='small'
        rowKey={(r) => r.at + r.username + r.type}
        pagination={{ pageSize: 8, hideOnSinglePage: true }}
        dataSource={data.events}
        locale={{ emptyText: 'Nothing yet.' }}
        columns={[
          { title: 'When', dataIndex: 'at', render: when },
          { title: 'Account', dataIndex: 'username' },
          { title: 'What', dataIndex: 'type' },
          { title: 'Detail', dataIndex: 'detail' },
        ]}
      />

      <Modal
        open={!!made}
        title='Invite code'
        onCancel={() => setMade(null)}
        footer={
          <Button type='primary' onClick={() => setMade(null)}>
            Done
          </Button>
        }
      >
        <Typography.Paragraph>
          Give this to one person. It works once
          {made?.expiresAt ? `, until ${when(made.expiresAt)}` : ''}, and you
          will not be able to see it again.
        </Typography.Paragraph>
        <Typography.Paragraph
          copyable
          code
          style={{ fontSize: 22, textAlign: 'center' }}
        >
          {made?.code}
        </Typography.Paragraph>
      </Modal>
    </>
  );
}
