import React from 'react';
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Progress,
  Radio,
  Space,
  Typography,
} from 'antd';
import api, { errorData, errorMessage } from '../services/tasks-api';
import { questionOf } from './proofs';

/** Counts down from `seconds`, measured from when the server saw the timer start */
function Countdown({ startedAt, seconds, onDone }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, []);
  const left = Math.max(
    0,
    seconds - Math.floor((now - new Date(startedAt)) / 1000),
  );
  React.useEffect(() => {
    if (left === 0) onDone();
  }, [left === 0]);
  return (
    <Space orientation='vertical' style={{ width: '100%' }}>
      <Progress percent={Math.round(((seconds - left) / seconds) * 100)} />
      <Typography.Text strong>
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} remaining
      </Typography.Text>
    </Space>
  );
}

/** Doing a task: the screen depends on how it is proven */
export default function CompleteTaskModal({
  dynamicId,
  assignment,
  open,
  onClose,
  onChanged,
}) {
  const task = assignment?.task ?? {};
  const proof = task.proof ?? 'attestation';
  const [response, setResponse] = React.useState({});
  const [error, setError] = React.useState(null);
  const [wrong, setWrong] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [timeUp, setTimeUp] = React.useState(false);

  React.useEffect(() => {
    setResponse({});
    setError(null);
    setWrong([]);
    setTimeUp(false);
  }, [assignment?.id, open]);

  if (!assignment) return null;

  const fail = (e) => {
    setError(errorMessage(e));
    setWrong(errorData(e).incorrect ?? []);
  };
  const submit = () => {
    setSaving(true);
    setError(null);
    setWrong([]);
    api
      .submit(dynamicId, assignment.id, response)
      .then(() => {
        onChanged();
        onClose();
      })
      .catch(fail)
      .finally(() => setSaving(false));
  };
  const start = () =>
    api.start(dynamicId, assignment.id).then(onChanged).catch(fail);

  const started = proof === 'timer' && assignment.startedAt;
  const canSubmit = {
    attestation: true,
    checkin: true,
    location: typeof response.lat === 'number',
    numeric: typeof response.value === 'number',
    text: !!response.text?.trim(),
    lines: !!response.text?.trim(),
    timer: !!started && timeUp,
    choice: !!response.choice,
    quiz:
      (response.answers ?? []).filter((a) => a?.trim()).length ===
      (task.questions ?? []).length,
  }[proof];

  return (
    <Modal
      open={open}
      title={task.task}
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Button key='close' onClick={onClose}>
          Not now
        </Button>,
        <Button
          key='go'
          type='primary'
          loading={saving}
          disabled={!canSubmit}
          onClick={submit}
        >
          {proof === 'attestation' ? 'I did it' : 'Done'}
        </Button>,
      ]}
    >
      <Space orientation='vertical' size='middle' style={{ width: '100%' }}>
        {task.bonusTask && (
          <Typography.Paragraph type='secondary' style={{ margin: 0 }}>
            Bonus: {task.bonusTask}
          </Typography.Paragraph>
        )}
        {assignment.feedback && (
          <Alert
            type='info'
            showIcon
            title='Sent back'
            description={assignment.feedback}
          />
        )}
        {error && <Alert type='error' title={error} />}

        {proof === 'attestation' && (
          <Typography.Text>When you have done this, say so.</Typography.Text>
        )}

        {proof === 'numeric' && (
          <Space>
            <InputNumber
              aria-label='Number'
              min={task.minValue}
              max={task.maxValue}
              value={response.value}
              onChange={(value) => setResponse({ value: value ?? undefined })}
            />
            {task.unit && <Typography.Text>{task.unit}</Typography.Text>}
          </Space>
        )}

        {proof === 'text' && (
          <>
            {task.prompt && (
              <Typography.Paragraph>{task.prompt}</Typography.Paragraph>
            )}
            <Input.TextArea
              rows={6}
              aria-label='Your answer'
              maxLength={10000}
              showCount
              value={response.text}
              onChange={(e) => setResponse({ text: e.target.value })}
            />
            {task.minLength && (
              <Typography.Text type='secondary'>
                At least {task.minLength} characters.
              </Typography.Text>
            )}
          </>
        )}

        {proof === 'lines' && (
          <>
            <Typography.Paragraph>
              Write &ldquo;{task.phrase}&rdquo; {task.repetitions} times, one
              per line.
            </Typography.Paragraph>
            <Input.TextArea
              rows={Math.min(12, task.repetitions + 1)}
              aria-label='Lines'
              value={response.text}
              onChange={(e) => setResponse({ text: e.target.value })}
            />
          </>
        )}

        {proof === 'timer' &&
          (started ? (
            <Countdown
              startedAt={assignment.startedAt}
              seconds={task.seconds}
              onDone={() => setTimeUp(true)}
            />
          ) : (
            <>
              <Typography.Paragraph>
                This takes {Math.floor(task.seconds / 60)}m {task.seconds % 60}s
                without a break.
              </Typography.Paragraph>
              <Button type='primary' onClick={start}>
                Start the timer
              </Button>
            </>
          ))}

        {proof === 'checkin' && (
          <Typography.Paragraph>
            Checking in records the time you press the button.
            {assignment.dueAt &&
              ` It is due ${new Date(assignment.dueAt).toLocaleString()}; checking in later is noted, not refused.`}
          </Typography.Paragraph>
        )}

        {proof === 'location' && (
          <>
            <Typography.Paragraph>
              {task.place ? `Check in at ${task.place}. ` : ''}
              Your location is only shared when you press the button, and only
              with the person who assigned this.
            </Typography.Paragraph>
            <Button
              onClick={() =>
                navigator.geolocation
                  ? navigator.geolocation.getCurrentPosition(
                      ({ coords }) => {
                        setError(null);
                        setResponse({
                          lat: coords.latitude,
                          lng: coords.longitude,
                          accuracy: coords.accuracy,
                        });
                      },
                      () =>
                        setError(
                          'Could not get your location. Check that your browser is allowed to share it.',
                        ),
                    )
                  : setError('Your browser cannot share its location')
              }
            >
              {typeof response.lat === 'number'
                ? 'Location ready - share again to refresh'
                : 'Share my location'}
            </Button>
          </>
        )}

        {proof === 'choice' && (
          <Radio.Group
            value={response.choice}
            onChange={(e) => setResponse({ choice: e.target.value })}
          >
            <Space orientation='vertical'>
              {(task.choices ?? []).map((choice) => (
                <Radio key={choice} value={choice}>
                  {choice}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        )}

        {proof === 'quiz' &&
          (task.questions ?? []).map((entry, i) => (
            <div key={entry}>
              <Typography.Text>{questionOf(entry)}</Typography.Text>
              <Input
                aria-label={questionOf(entry)}
                status={wrong.includes(i) ? 'error' : undefined}
                value={response.answers?.[i] ?? ''}
                onChange={(e) => {
                  const answers = [
                    ...(response.answers ??
                      Array(task.questions.length).fill('')),
                  ];
                  answers[i] = e.target.value;
                  setResponse({ answers });
                }}
              />
            </div>
          ))}
      </Space>
    </Modal>
  );
}
