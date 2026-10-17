import React from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Empty,
  Modal,
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
import { PROOF_LABEL, requirement, ResponseSummary } from './proofs';
import ReviewModal from './ReviewModal';
import { Summary, windows } from './schedule';

const STATUS = {
  pending: { color: 'blue', label: 'To do' },
  submitted: { color: 'gold', label: 'Waiting for review' },
  done: { color: 'green', label: 'Done' },
  'not-done': { color: 'default', label: 'Not done' },
  cancelled: { color: 'default', label: 'Cancelled' },
};

export function TaskCard({
  a,
  you,
  paused,
  controllerAlias,
  kinks,
  onDo,
  onReview,
  onAct,
  onNotDone,
  originalTitle,
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
      extra={
        <Tag color={a.queued ? 'orange' : status.color}>
          {a.queued ? 'Queued' : status.label}
        </Tag>
      }
    >
      <Space orientation='vertical' size={4} style={{ width: '100%' }}>
        {a.consequenceFor && (
          <Alert
            type='warning'
            showIcon
            title={`Consequence for \u201c${originalTitle ?? 'an earlier task'}\u201d`}
            description={
              a.queued
                ? `${you.canAssign ? 'Waiting in the queue until you start it' : `${controllerAlias} has added this and will start it when ready`}: ${task.task}.`
                : `${task.task}.`
            }
          />
        )}
        <Typography.Text type='secondary'>{requirement(task)}</Typography.Text>
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
            <ResponseSummary
              task={task}
              response={a.response}
              mediaUrl={api.mediaUrl(dynamicId, a.id)}
            />
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
          {you.isAssignee && a.status === 'pending' && !a.queued && !paused && (
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
          {you.canAssign && a.queued && a.status === 'pending' && !paused && (
            <Popconfirm
              title='Start this now?'
              description='It becomes a task to do straight away.'
              onConfirm={() => onAct(api.startConsequence, a)}
            >
              <Button type='primary' size='small'>
                Start now
              </Button>
            </Popconfirm>
          )}
          {you.canAssign && a.status === 'pending' && !a.queued && !paused && (
            <Popconfirm
              title='Mark this as not done?'
              description='It is just a record - nothing else changes. You can add a consequence afterwards if you choose.'
              onConfirm={() => onNotDone(a)}
            >
              <Button size='small'>Mark not done</Button>
            </Popconfirm>
          )}
          {you.canAssign &&
            ['pending', 'submitted'].includes(a.status) &&
            !paused && (
              <Popconfirm
                title={
                  a.queued ? 'Remove this from the queue?' : 'Cancel this task?'
                }
                onConfirm={() => onAct(api.cancel, a)}
              >
                <Button size='small' danger>
                  {a.queued ? 'Remove' : 'Cancel'}
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

/** What the other person has coming due, in the same windows as My tasks */
function ComingDue({ assignments, waiting, partner }) {
  const w = windows(assignments);
  return (
    <div style={{ marginBottom: 24 }}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Coming due{partner ? ` from ${partner}` : ''}
      </Typography.Title>
      <Space wrap align='stretch' style={{ width: '100%' }}>
        {w.overdue.length > 0 && (
          <Summary title='Overdue' tasks={w.overdue} color='#d71616' />
        )}
        <Summary title='Next 24 hours' tasks={w.next24} />
        <Summary title='Next 48 hours' tasks={w.next48} />
        <Summary title='Next week' tasks={w.nextWeek} />
      </Space>
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        Waiting for your review ({waiting})
      </Typography.Title>
    </div>
  );
}

export default function TaskList({ dynamicId, paused, mode = 'all' }) {
  const { message } = App.useApp();
  const { items: kinks } = useCatalog('kinks');
  const [data, setData] = React.useState(null);
  const [assigning, setAssigning] = React.useState(false);
  const [doing, setDoing] = React.useState(null);
  const [reviewing, setReviewing] = React.useState(null);
  const [repeating, setRepeating] = React.useState([]);
  const [offer, setOffer] = React.useState(null); // a task just marked not done
  const [consequence, setConsequence] = React.useState(null);

  const load = () =>
    api
      .list(dynamicId)
      .then(setData)
      .then(() => api.schedules(dynamicId))
      .then(setRepeating)
      .catch((e) => message.error(errorMessage(e)));
  React.useEffect(() => {
    setData(null);
    load();
  }, [dynamicId]);

  if (!data) return <Spin size='large' />;

  const { you, assignments, dynamic } = data;
  const solo = dynamic.kind === 'solo';
  const reviewing_ = mode === 'review';
  const queue = assignments.filter((a) => a.queued && a.status === 'pending');
  const open = assignments.filter((a) =>
    reviewing_
      ? a.status === 'submitted'
      : mode === 'consequences'
        ? false
        : !a.queued && ['pending', 'submitted'].includes(a.status),
  );
  const finished =
    reviewing_ || mode === 'consequences'
      ? []
      : assignments.filter((a) => !['pending', 'submitted'].includes(a.status));
  const titleOf = (id) => assignments.find((x) => x.id === id)?.task.task;
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
      onNotDone={(x) =>
        api
          .notDone(dynamicId, x.id)
          .then(() => {
            load();
            setOffer(x);
          })
          .catch((e) => message.error(errorMessage(e)))
      }
      originalTitle={titleOf(a.consequenceFor)}
    />
  );

  return (
    <>
      {you.canAssign && !reviewing_ && (
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

      {reviewing_ && (
        <ComingDue
          assignments={assignments}
          waiting={open.length}
          partner={you.partner}
        />
      )}

      {mode === 'consequences' && (
        <Typography.Paragraph type='secondary' style={{ maxWidth: 640 }}>
          Consequences are tasks {you.canAssign ? 'you' : controllerAlias} chose
          to add after something was marked not done. Nothing is added
          automatically, both of you can see the queue, and they&rsquo;re
          started one at a time when the time is right.
        </Typography.Paragraph>
      )}

      {mode === 'consequences' ? (
        queue.length === 0 ? (
          <Empty description='No consequences are queued.' />
        ) : (
          queue.map(card)
        )
      ) : open.length === 0 ? (
        <Empty
          description={
            reviewing_
              ? 'Nothing is waiting for your review.'
              : you.canAssign
                ? 'Nothing assigned right now.'
                : `Nothing to do right now.`
          }
        />
      ) : (
        open.map(card)
      )}

      {mode === 'all' && repeating.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>
            Repeating tasks ({repeating.length})
          </Typography.Title>
          {repeating.map((r) => (
            <Card key={r.id} size='small' style={{ marginBottom: 8 }}>
              <Space
                wrap
                style={{ width: '100%', justifyContent: 'space-between' }}
              >
                <span>
                  <b>{r.task.task}</b>{' '}
                  <Tag>
                    {
                      {
                        daily: 'Daily',
                        weekdays: 'Weekdays',
                        weekly: 'Weekly',
                      }[r.frequency]
                    }
                  </Tag>
                  {r.endDate && <Tag>until {r.endDate}</Tag>}
                  {r.note && (
                    <Typography.Text type='secondary'>{r.note}</Typography.Text>
                  )}
                </span>
                {you.canAssign && !paused && (
                  <Popconfirm
                    title='Stop repeating this?'
                    description='Tasks already made stay as they are.'
                    onConfirm={() =>
                      api
                        .stopSchedule(dynamicId, r.id)
                        .then(load)
                        .catch((e) => message.error(errorMessage(e)))
                    }
                  >
                    <Button size='small'>Stop repeating</Button>
                  </Popconfirm>
                )}
              </Space>
            </Card>
          ))}
        </>
      )}

      {!reviewing_ && mode !== 'consequences' && queue.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 24 }}>
            Queued consequences ({queue.length})
          </Typography.Title>
          {queue.map(card)}
        </>
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
      <Modal
        open={!!offer}
        title={`Add a consequence for \u201c${offer?.task.task}\u201d?`}
        onCancel={() => setOffer(null)}
        footer={[
          <Button key='no' onClick={() => setOffer(null)}>
            No, leave it
          </Button>,
          <Button
            key='yes'
            type='primary'
            onClick={() => {
              setConsequence(offer);
              setOffer(null);
            }}
          >
            Add a consequence
          </Button>,
        ]}
      >
        <Typography.Paragraph>
          It&rsquo;s marked as not done. If you want, you can choose a task to
          follow it. It goes in the consequences queue, where you both can see
          it, and nothing happens until you start it.
        </Typography.Paragraph>
      </Modal>
      <AssignTaskModal
        dynamicId={dynamicId}
        kind={solo ? 'solo' : 'pair'}
        partner={you.partner}
        open={!!consequence}
        consequenceFor={consequence}
        onClose={() => setConsequence(null)}
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
