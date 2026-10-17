import React from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Empty,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import api, { errorMessage } from '../services/tasks-api';
import { When } from '../account/common';
import useCatalog from '../hooks/useCatalog';
import { kinkWithSide } from '../account/kinkText';
import AssignTaskModal from './AssignTaskModal';
import CommentsThread from './CommentsThread';
import CompleteTaskModal from './CompleteTaskModal';
import { PROOF_LABEL, ResponseSummary } from './proofs';
import ReviewModal from './ReviewModal';

const STATUS = {
  pending: { color: 'blue', label: 'To do' },
  submitted: { color: 'gold', label: 'Waiting for review' },
  done: { color: 'green', label: 'Done' },
  'not-done': { color: 'default', label: 'Not done' },
  cancelled: { color: 'default', label: 'Cancelled' },
};

function TaskCard({
  a,
  you,
  paused,
  controllerAlias,
  kinks,
  onDo,
  onReview,
  onAct,
  dynamicId,
}) {
  const [showComments, setShowComments] = React.useState(false);
  const [count, setCount] = React.useState(a.comments);
  const { task } = a;
  const status = a.overdue
    ? { color: 'red', label: 'Overdue' }
    : STATUS[a.status];

  return (
    <Card
      size='small'
      style={{ marginBottom: 12 }}
      title={task.task}
      extra={<Tag color={status.color}>{status.label}</Tag>}
    >
      <Space orientation='vertical' size={4} style={{ width: '100%' }}>
        {task.bonusTask && (
          <Typography.Text type='secondary'>
            Bonus: {task.bonusTask}
          </Typography.Text>
        )}
        <Space wrap size={4}>
          <Tag>{PROOF_LABEL[task.proof ?? 'attestation']}</Tag>
          {a.dueAt && (
            <Tooltip title={new Date(a.dueAt).toLocaleString()}>
              <Tag color={a.overdue ? 'red' : undefined}>
                Due <When at={a.dueAt} />
              </Tag>
            </Tooltip>
          )}
          {a.requiresReview && <Tag>Will be reviewed</Tag>}
        </Space>

        {a.attestedSoftLimits.length > 0 && (
          <Typography.Text type='secondary'>
            Soft limit talked about before assigning (
            {you.canAssign ? 'you attested' : `${controllerAlias} attested`}):{' '}
            {a.attestedSoftLimits
              .map((s) =>
                kinkWithSide(
                  kinks.find((k) => k.value === s.key),
                  s.direction,
                  s.key,
                ),
              )
              .join(', ')}
          </Typography.Text>
        )}
        {a.feedback && a.status === 'pending' && (
          <Alert
            type='info'
            showIcon
            title='Sent back'
            description={a.feedback}
          />
        )}
        {a.response && (a.status === 'done' || a.status === 'submitted') && (
          <div>
            <Typography.Text type='secondary'>Submitted: </Typography.Text>
            <ResponseSummary task={task} response={a.response} />
          </div>
        )}
        {a.responseGone && (
          <Typography.Text type='secondary'>
            {a.responseGone === 'hidden'
              ? `What was submitted is no longer shown (kept for ${a.retentionDays} ${a.retentionDays === 1 ? 'day' : 'days'}, as chosen by the person who did it).`
              : 'What was submitted has been removed.'}
          </Typography.Text>
        )}
        {a.feedback && a.status === 'done' && (
          <Typography.Text type='secondary'>Note: {a.feedback}</Typography.Text>
        )}

        <Space wrap style={{ marginTop: 4 }}>
          {you.isAssignee && a.status === 'pending' && !paused && (
            <Button type='primary' size='small' onClick={() => onDo(a)}>
              {(task.proof ?? 'attestation') === 'attestation'
                ? 'I did it'
                : 'Do it'}
            </Button>
          )}
          {you.canAssign && a.status === 'submitted' && !paused && (
            <Button type='primary' size='small' onClick={() => onReview(a)}>
              Review
            </Button>
          )}
          {you.canAssign && a.status === 'pending' && !paused && (
            <Popconfirm
              title='Mark this as not done?'
              description='It is just a record - nothing else changes.'
              onConfirm={() => onAct(api.notDone, a)}
            >
              <Button size='small'>Mark not done</Button>
            </Popconfirm>
          )}
          {you.canAssign &&
            ['pending', 'submitted'].includes(a.status) &&
            !paused && (
              <Popconfirm
                title='Cancel this task?'
                onConfirm={() => onAct(api.cancel, a)}
              >
                <Button size='small' danger>
                  Cancel
                </Button>
              </Popconfirm>
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
            target={`assignment:${a.id}`}
            canWrite={!paused}
            onCount={setCount}
          />
        )}
      </Space>
    </Card>
  );
}

export default function TaskList({ dynamicId, paused }) {
  const { message } = App.useApp();
  const { items: kinks } = useCatalog('kinks');
  const [data, setData] = React.useState(null);
  const [assigning, setAssigning] = React.useState(false);
  const [doing, setDoing] = React.useState(null);
  const [reviewing, setReviewing] = React.useState(null);

  const load = () =>
    api
      .list(dynamicId)
      .then(setData)
      .catch((e) => message.error(errorMessage(e)));
  React.useEffect(() => {
    setData(null);
    load();
  }, [dynamicId]);

  if (!data) return <Spin size='large' />;

  const { you, assignments, dynamic } = data;
  const solo = dynamic.kind === 'solo';
  const open = assignments.filter((a) =>
    ['pending', 'submitted'].includes(a.status),
  );
  const finished = assignments.filter(
    (a) => !['pending', 'submitted'].includes(a.status),
  );
  // keep a modal pointed at the freshest copy (a timer's start, say)
  const fresh = (a) => assignments.find((x) => x.id === a?.id) ?? a;

  const act = (call, a) =>
    call(dynamicId, a.id)
      .then(load)
      .catch((e) => message.error(errorMessage(e)));

  const card = (a) => (
    <TaskCard
      key={a.id}
      a={a}
      you={you}
      paused={paused}
      controllerAlias={you.partner ?? 'You'}
      kinks={kinks}
      dynamicId={dynamicId}
      onDo={setDoing}
      onReview={setReviewing}
      onAct={act}
    />
  );

  return (
    <>
      {you.canAssign && (
        <div style={{ marginBottom: 16 }}>
          <Button
            type='primary'
            disabled={paused}
            onClick={() => setAssigning(true)}
          >
            Assign a task
          </Button>
        </div>
      )}

      {open.length === 0 ? (
        <Empty
          description={
            you.canAssign
              ? 'Nothing assigned right now.'
              : `Nothing to do right now.`
          }
        />
      ) : (
        open.map(card)
      )}

      {finished.length > 0 && (
        <Collapse
          ghost
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'finished',
              label: `Finished (${finished.length})`,
              children: finished.map(card),
            },
          ]}
        />
      )}

      <AssignTaskModal
        dynamicId={dynamicId}
        kind={solo ? 'solo' : 'pair'}
        partner={you.partner}
        open={assigning}
        onClose={() => setAssigning(false)}
        onAssigned={load}
      />
      <CompleteTaskModal
        dynamicId={dynamicId}
        assignment={fresh(doing)}
        open={!!doing}
        onClose={() => setDoing(null)}
        onChanged={load}
      />
      <ReviewModal
        dynamicId={dynamicId}
        assignment={fresh(reviewing)}
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        onChanged={load}
        onError={(m) => message.error(m)}
      />
    </>
  );
}
