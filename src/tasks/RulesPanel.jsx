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
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import api, { errorMessage } from '../services/tasks-api';
import { When } from '../account/common';
import { DiscussedDialog } from './Attest';
import CommentsThread from './CommentsThread';

function RuleForm({ rule, open, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  return (
    <Modal
      open={open}
      title={rule ? 'Change this rule' : 'Add a rule'}
      onCancel={onCancel}
      destroyOnHidden
      okText='Continue'
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout='vertical'
        initialValues={rule ?? {}}
        preserve={false}
        onFinish={onSubmit}
      >
        <Form.Item
          label='Title'
          name='title'
          rules={[{ required: true, message: 'Give it a title' }, { max: 120 }]}
        >
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item
          label='The rule'
          name='body'
          rules={[
            { required: true, message: 'Say what the rule is' },
            { max: 4000 },
          ]}
        >
          <Input.TextArea rows={6} maxLength={4000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function RuleCard({
  rule,
  you,
  paused,
  dynamicId,
  solo,
  onEdit,
  onRetire,
  onRestore,
}) {
  const [showComments, setShowComments] = React.useState(false);
  const [count, setCount] = React.useState(rule.comments);

  return (
    <Card size='small' style={{ marginBottom: 12 }} title={rule.title}>
      <Space orientation='vertical' size={4} style={{ width: '100%' }}>
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
          {rule.body}
        </Typography.Paragraph>
        <Space wrap size={4}>
          {rule.attestedAt && (
            <Tag color='green'>
              Discussed &mdash; attested <When at={rule.attestedAt} />
            </Tag>
          )}
          {rule.updatedAt !== rule.createdAt && !rule.attestedAt && (
            <Tag>
              Updated <When at={rule.updatedAt} />
            </Tag>
          )}
        </Space>
        <Space wrap>
          {you.canAssign && rule.status === 'active' && !paused && (
            <>
              <Button size='small' onClick={() => onEdit(rule)}>
                Change
              </Button>
              <Popconfirm
                title='Retire this rule?'
                description='It stays on record, marked as retired.'
                onConfirm={() => onRetire(rule)}
              >
                <Button size='small'>Retire</Button>
              </Popconfirm>
            </>
          )}
          {you.canAssign && rule.status === 'retired' && !paused && (
            <Button size='small' onClick={() => onRestore(rule)}>
              Bring back
            </Button>
          )}
          <Button
            size='small'
            type='link'
            onClick={() => setShowComments(!showComments)}
          >
            Comments ({count})
          </Button>
        </Space>
        {showComments && (
          <CommentsThread
            dynamicId={dynamicId}
            target={`rule:${rule.id}`}
            canWrite={!paused}
            onCount={setCount}
          />
        )}
      </Space>
    </Card>
  );
}

/**
 * The dynamic's rules. Whoever has control sets them; the other person can
 * comment but there is nothing for them to approve. In a pair, making, changing
 * or bringing back a rule asks "Have you discussed this with your partner?"
 */
export default function RulesPanel({ dynamicId, paused, solo }) {
  const { message } = App.useApp();
  const [data, setData] = React.useState(null);
  const [editing, setEditing] = React.useState(null); // null | 'new' | rule
  const [asking, setAsking] = React.useState(null); // { run } waiting for Yes / Cancel

  const load = () =>
    api
      .listRules(dynamicId)
      .then(setData)
      .catch((e) => message.error(errorMessage(e)));
  React.useEffect(() => {
    setData(null);
    load();
  }, [dynamicId]);

  if (!data) return <Spin size='large' />;
  const { you, rules } = data;
  const active = rules.filter((r) => r.status === 'active');
  const retired = rules.filter((r) => r.status === 'retired');

  // Ask first in a pair; in solo mode there is nobody to have discussed it with
  const confirmThen = (run) => {
    if (solo) return run(false);
    setAsking({ run });
  };
  const done = (text) => () => {
    setEditing(null);
    setAsking(null);
    message.success(text);
    return load();
  };
  const fail = (e) => message.error(errorMessage(e));

  const save = (values) =>
    confirmThen((attested) =>
      (editing === 'new'
        ? api.createRule(dynamicId, { ...values, attested })
        : api.updateRule(dynamicId, editing.id, { ...values, attested })
      )
        .then(done(editing === 'new' ? 'Rule added' : 'Rule changed'))
        .catch(fail),
    );

  const card = (rule) => (
    <RuleCard
      key={rule.id}
      rule={rule}
      you={you}
      paused={paused}
      solo={solo}
      dynamicId={dynamicId}
      onEdit={setEditing}
      onRetire={(r) =>
        api.retireRule(dynamicId, r.id).then(done('Rule retired')).catch(fail)
      }
      onRestore={(r) =>
        confirmThen((attested) =>
          api
            .restoreRule(dynamicId, r.id, attested)
            .then(done('Rule brought back'))
            .catch(fail),
        )
      }
    />
  );

  return (
    <>
      {!you.canAssign && (
        <Alert
          type='info'
          showIcon
          style={{ marginBottom: 16 }}
          title={`These are ${you.partner}'s rules for the two of you`}
          description='You can comment on any of them. There is nothing to approve - this is a place to talk, and to see what has been set.'
        />
      )}
      {you.canAssign && (
        <div style={{ marginBottom: 16 }}>
          <Button
            type='primary'
            disabled={paused}
            onClick={() => setEditing('new')}
          >
            Add a rule
          </Button>
        </div>
      )}

      {active.length === 0 ? (
        <Empty description='No rules yet.' />
      ) : (
        active.map(card)
      )}

      {retired.length > 0 && (
        <Collapse
          ghost
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'retired',
              label: `Retired (${retired.length})`,
              children: retired.map(card),
            },
          ]}
        />
      )}

      <RuleForm
        rule={editing && editing !== 'new' ? editing : null}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onSubmit={save}
      />
      <DiscussedDialog
        open={!!asking}
        onYes={() => asking.run(true)}
        onCancel={() => setAsking(null)}
      />
    </>
  );
}
