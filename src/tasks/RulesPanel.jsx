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
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import moment from 'moment';
import api, { errorMessage } from '../services/tasks-api';
import { When } from '../account/common';
import { DiscussedDialog } from './Attest';
import CommentsThread from './CommentsThread';

const day = (at) => moment(at).format('D MMMM YYYY');

/**
 * Making, changing or bringing back a rule: what it says (except when bringing
 * one back) and how many days until it can be changed. The person living under
 * the rules has a minimum, and the longer of the two applies.
 */
function RuleForm({ mode, rule, minDays, partner, open, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  const title = {
    new: 'Add a rule',
    edit: 'Change this rule',
    restore: 'Bring this rule back',
  }[mode];

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      destroyOnHidden
      okText='Continue'
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout='vertical'
        preserve={false}
        initialValues={{
          ...(rule ? { title: rule.title, body: rule.body } : {}),
          lockDays: Math.max(minDays, rule?.lockDaysRequested ?? 0),
        }}
        onFinish={onSubmit}
      >
        {mode !== 'restore' && (
          <>
            <Form.Item
              label='Title'
              name='title'
              rules={[
                { required: true, message: 'Give it a title' },
                { max: 120 },
              ]}
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
          </>
        )}
        <Form.Item
          label='Days until it can be changed'
          name='lockDays'
          extra={
            minDays > 0
              ? `${partner ? `${partner}'s` : 'The'} minimum is ${minDays} ${minDays === 1 ? 'day' : 'days'}. You can ask for longer; if you ask for less, the minimum applies. Until then you cannot change or retire it.`
              : 'Until then you cannot change or retire it.'
          }
          rules={[{ required: true, message: 'Say how many days' }]}
        >
          <InputNumber
            min={0}
            max={365}
            precision={0}
            style={{ width: 140 }}
            aria-label='Days until it can be changed'
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function RuleCard({
  rule,
  you,
  partner,
  paused,
  dynamicId,
  onEdit,
  onRetire,
  onRestore,
}) {
  const [showComments, setShowComments] = React.useState(false);
  const [count, setCount] = React.useState(rule.comments);
  const locked = rule.locked;
  const raised = rule.lockDaysApplied > rule.lockDaysRequested;
  const heldBack = locked
    ? `Can be changed from ${day(rule.lockedUntil)}`
    : null;

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
          {rule.status === 'active' &&
            (locked ? (
              <Tag color='orange'>{heldBack}</Tag>
            ) : (
              <Tag>Can be changed now</Tag>
            ))}
        </Space>
        {rule.status === 'active' && locked && raised && you.canAssign && (
          <Typography.Text type='secondary'>
            You asked for {rule.lockDaysRequested}{' '}
            {rule.lockDaysRequested === 1 ? 'day' : 'days'}; {partner}&rsquo;s
            minimum made it {rule.lockDaysApplied}.
          </Typography.Text>
        )}
        <Space wrap>
          {you.canAssign && rule.status === 'active' && !paused && (
            <>
              <Tooltip title={heldBack}>
                <span>
                  <Button
                    size='small'
                    disabled={locked}
                    onClick={() => onEdit(rule)}
                  >
                    Change
                  </Button>
                </span>
              </Tooltip>
              <Popconfirm
                title='Retire this rule?'
                description='It stays on record, marked as retired.'
                onConfirm={() => onRetire(rule)}
                disabled={locked}
              >
                <Tooltip title={heldBack}>
                  <span>
                    <Button size='small' disabled={locked}>
                      Retire
                    </Button>
                  </span>
                </Tooltip>
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
 * The dynamic's rules. They belong to the dynamic as a whole, not to any task.
 * Whoever has control sets them; the other person can comment but there is
 * nothing for them to approve. In a pair, making, changing or bringing back a
 * rule asks "Have you discussed this with your partner?", and a rule stands
 * for a number of days before it can be changed.
 */
export default function RulesPanel({ dynamicId, paused, solo }) {
  const { message } = App.useApp();
  const [data, setData] = React.useState(null);
  const [editing, setEditing] = React.useState(null); // { mode, rule }
  const [asking, setAsking] = React.useState(null); // { run } waiting for Yes / Cancel
  // Every opening of the form is its own: nothing is carried over from the last one
  const openings = React.useRef(0);
  const open = (next) => {
    openings.current += 1;
    setEditing(next);
  };

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
  const { you, rules, minDays } = data;
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
  const fail = (e) => {
    setAsking(null);
    message.error(errorMessage(e));
    load();
  };

  const save = (values, { mode, rule }) =>
    confirmThen((attested) => {
      const body = { ...values, attested };
      const request =
        mode === 'new'
          ? api.createRule(dynamicId, body)
          : mode === 'edit'
            ? api.updateRule(dynamicId, rule.id, body)
            : api.restoreRule(dynamicId, rule.id, {
                attested,
                lockDays: values.lockDays,
              });
      return request
        .then(
          done(
            {
              new: 'Rule added',
              edit: 'Rule changed',
              restore: 'Rule brought back',
            }[mode],
          ),
        )
        .catch(fail);
    });

  const card = (rule) => (
    <RuleCard
      key={rule.id}
      rule={rule}
      you={you}
      partner={you.partner}
      paused={paused}
      dynamicId={dynamicId}
      onEdit={(r) => open({ mode: 'edit', rule: r })}
      onRetire={(r) =>
        api.retireRule(dynamicId, r.id).then(done('Rule retired')).catch(fail)
      }
      onRestore={(r) => open({ mode: 'restore', rule: r })}
    />
  );

  return (
    <>
      <Alert
        type='info'
        title='Why rules'
        style={{ marginBottom: 16 }}
        description='Rules are a guiding force for stability in a dynamic. Setting smart limits on how often they can change ensures both partners understand and discuss before changes.'
      />
      {!you.canAssign && (
        <Alert
          type='info'
          showIcon
          style={{ marginBottom: 16 }}
          title={`These are ${you.partner}'s rules for the two of you`}
          description={`You can comment on any of them - there is nothing to approve. A rule stays as it is for at least ${minDays} ${minDays === 1 ? 'day' : 'days'} before it can be changed; you can change that number under About me.`}
        />
      )}
      {you.canAssign && (
        <div style={{ marginBottom: 16 }}>
          <Button
            type='primary'
            disabled={paused}
            onClick={() => open({ mode: 'new' })}
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
        key={openings.current}
        mode={editing?.mode ?? 'new'}
        rule={editing?.rule}
        minDays={minDays}
        partner={you.partner}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onSubmit={(values) => save(values, editing)}
      />
      <DiscussedDialog
        open={!!asking}
        onYes={() => asking.run(true)}
        onCancel={() => setAsking(null)}
      />
    </>
  );
}
