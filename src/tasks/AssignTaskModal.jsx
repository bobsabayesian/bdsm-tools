import React from 'react';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import useCatalog from '../hooks/useCatalog';
import { kinkWithSide, sidesOf } from '../account/kinkText';
import { fieldDefaults, renderFields } from '../components/FieldsForm';
import api, { errorData, errorMessage } from '../services/tasks-api';
import { SoftLimitDialog } from './Attest';
import { PROOF_LABEL, requirement } from './proofs';

const asOptions = (items) =>
  items.map((i) => ({ value: i.value, label: i.label }));

const FIELD_NAME = {
  guardrails: 'guardrail tags',
  kinks: 'kinks',
  due: 'a due time',
};

const FREQUENCY = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly (same day)' },
];

// Fields that have their own sections below, so they are left out of the first
const SECTION_FIELDS = [
  'requiresBodyPart',
  'requiresBoundsBody',
  'requiresClothing',
  'requiresEquipment',
  'requiresSpaces',
  'kinksReceiving',
  'kinksGiving',
  'kinksGeneral',
];

/** The end of a day, or a given time, in the assigner's own timezone, as an instant */
const dueInstant = (mode, date, time) => {
  if (mode === 'none' || !date) return undefined;
  return new Date(
    `${date}T${mode === 'time' ? time || '09:00' : '23:59'}`,
  ).toISOString();
};

/**
 * Assigning a task: pick one from the library (with what is and is not possible
 * for this person, and why - nothing is hidden between a pair) or write your
 * own, then say when it is due. If it touches a soft limit the server asks for
 * the attestation; this screen shows the dialog and sends it.
 */
export default function AssignTaskModal({
  dynamicId,
  kind,
  partner,
  open,
  onClose,
  onAssigned,
  consequenceFor,
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const { items: bodyParts } = useCatalog('bodyParts');
  const { items: equipment } = useCatalog('equipment');
  const { items: boundsBody } = useCatalog('boundsBody');
  const { items: boundsClothing } = useCatalog('boundsClothing');
  const { items: boundsSpaces } = useCatalog('boundsSpaces');
  const { items: kinks } = useCatalog('kinks');

  const [tab, setTab] = React.useState('library');
  const [library, setLibrary] = React.useState(null);
  const [fields, setFields] = React.useState(null);
  const [blocked, setBlocked] = React.useState(null); // why nothing can be assigned yet
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState(null);
  const [dueMode, setDueMode] = React.useState('none');
  const [dueDate, setDueDate] = React.useState('');
  const [dueTime, setDueTime] = React.useState('');
  const [review, setReview] = React.useState(true);
  const [limits, setLimits] = React.useState(null); // { mine, theirs, requiredFields }
  const [repeat, setRepeat] = React.useState(false);
  const [frequency, setFrequency] = React.useState('daily');
  const [startDate, setStartDate] = React.useState('');
  const [endMode, setEndMode] = React.useState('none');
  const [endDate, setEndDate] = React.useState('');
  const [keepDays, setKeepDays] = React.useState(null); // null: the default
  const ownProof = Form.useWatch('proof', form);
  const guardrails = Form.useWatch('guardrails', form);
  const kinkTags = Form.useWatch('kinkTags', form);
  const [error, setError] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [attest, setAttest] = React.useState(null); // soft limits awaiting Yes / Cancel

  React.useEffect(() => {
    if (!open) return;
    setSelected(null);
    setSearch('');
    setError(null);
    setBlocked(null);
    setLibrary(null);
    setKeepDays(null);
    setReview(true);
    setRepeat(false);
    setFrequency('daily');
    setStartDate('');
    setEndMode('none');
    setEndDate('');
    setDueMode('none');
    api
      .assignOptions(dynamicId)
      .then(setLimits)
      .catch(() => setLimits(null));
    api
      .library(dynamicId)
      .then(setLibrary)
      .catch((e) =>
        setBlocked(
          errorData(e).code === 'profile-not-shared'
            ? errorMessage(e)
            : errorMessage(e),
        ),
      );
    api
      .taskFields(dynamicId)
      .then((defs) => {
        setFields(defs);
        form.resetFields();
        form.setFieldsValue(fieldDefaults(defs));
      })
      .catch(() => {});
  }, [open, dynamicId]);

  const label = (items, key) =>
    items.find((i) => i.value === key)?.label ?? key;
  const nameList = (items, keys) => keys.map((k) => label(items, k)).join(', ');

  const whyNot = (a) => {
    const parts = [];
    for (const reason of a.reasons) {
      if (reason.code === 'proof')
        parts.push(
          'needs photo, video or audio proof, which is not available yet',
        );
      if (reason.code === 'missing-field')
        parts.push(
          `${partner} requires a task to include ${FIELD_NAME[reason.field]}`,
        );
      if (reason.code === 'task-type')
        parts.push(
          `${partner} is not up for "${PROOF_LABEL[reason.proof]}" tasks`,
        );
      if (reason.code === 'body-part')
        parts.push(
          `needs ${nameList(bodyParts, reason.keys)}, which ${partner} has not included`,
        );
      // Everything from "What's in bounds?" is put to the same test
      for (const [code, list] of [
        ['in-bounds-body', boundsBody],
        ['clothing', boundsClothing],
        ['equipment', equipment],
        ['space', boundsSpaces],
      ]) {
        if (reason.code === code)
          parts.push(
            `needs ${nameList(list, reason.keys)}, which ${partner} has not put in bounds`,
          );
      }
    }
    if (a.hardLimits.length) {
      parts.push(
        `crosses a hard limit: ${a.hardLimits
          .map((h) =>
            kinkWithSide(
              kinks.find((k) => k.value === h.key),
              h.direction,
              h.key,
            ),
          )
          .join(', ')}`,
      );
    }
    return parts.join('; ');
  };

  const send = async (attested) => {
    setSaving(true);
    setError(null);
    try {
      const task =
        tab === 'own'
          ? await form.validateFields().then(() => taskFromForm())
          : undefined;
      const made = await api.assign(dynamicId, {
        ...(tab === 'own' ? { task } : { templateId: selected }),
        dueAt: repeat ? undefined : dueInstant(dueMode, dueDate, dueTime),
        repeat: repeat
          ? {
              frequency,
              startDate: startDate || undefined,
              endDate: endMode === 'date' ? endDate : undefined,
              tzOffset: new Date().getTimezoneOffset(),
            }
          : undefined,
        retentionDays: keepDays ?? undefined,
        requiresReview: kind === 'pair' ? review : false,
        consequenceFor: consequenceFor?.id,
        attested,
      });
      setAttest(null);
      message.success(
        made?.scheduled
          ? `Scheduled to start on ${made.startsOn}`
          : consequenceFor
            ? 'Added to the consequences queue'
            : 'Task assigned',
      );
      onAssigned();
      onClose();
    } catch (e) {
      if (e?.errorFields) return; // the form shows what is missing
      const data = errorData(e);
      if (data.code === 'attestation-required') setAttest(data.missing);
      else if (data.code === 'hard-limit') {
        setError(
          `That task crosses a hard limit: ${data.hardLimits
            .map((h) =>
              kinkWithSide(
                kinks.find((k) => k.value === h.key),
                h.direction,
                h.key,
              ),
            )
            .join(', ')}`,
        );
      } else setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // The sections that make up a task: one field for guardrails, one for kinks
  const guardrailOptions = [
    ['bodyParts', 'Body parts (My Body)', bodyParts],
    ['boundsBody', 'Anatomy', boundsBody],
    ['boundsClothing', 'Clothing & presentation', boundsClothing],
    ['equipment', 'Gear & items', equipment],
    ['boundsSpaces', 'Spaces', boundsSpaces],
  ]
    .filter(([, , items]) => items.length > 0)
    .map(([catalog, heading, items]) => ({
      label: heading,
      options: items.map((i) => ({
        value: `${catalog}/${i.value}`,
        label: i.label,
      })),
    }));
  const taskFromForm = () => {
    const {
      guardrails: tags = [],
      kinkTags: picked = [],
      ...rest
    } = form.getFieldsValue();
    const task = { ...rest };
    const GUARDRAIL_FIELD = {
      bodyParts: 'requiresBodyPart',
      boundsBody: 'requiresBoundsBody',
      boundsClothing: 'requiresClothing',
      equipment: 'requiresEquipment',
      boundsSpaces: 'requiresSpaces',
    };
    for (const tag of tags) {
      const [catalog, ...key] = tag.split('/');
      const field = GUARDRAIL_FIELD[catalog];
      task[field] = [...(task[field] ?? []), key.join('/')];
    }
    // The direction follows the person doing the task: a kink with a single
    // side goes on that side; one with two is something done to them
    for (const key of picked) {
      const sides = sidesOf(kinks.find((k) => k.value === key));
      const field =
        sides[0] === 'any'
          ? 'kinksGeneral'
          : sides.length === 1 && sides[0] === 'give'
            ? 'kinksGiving'
            : 'kinksReceiving';
      task[field] = [...(task[field] ?? []), key];
    }
    return task;
  };

  const required = limits?.requiredFields ?? [];
  // a repeating task is always due by the end of the day it is assigned
  const hasDue = repeat || (dueMode !== 'none' && !!dueDate);
  const missingParts =
    tab === 'own'
      ? required.filter(
          (f) =>
            (f === 'guardrails' && !(guardrails ?? []).length) ||
            (f === 'kinks' && !(kinkTags ?? []).length) ||
            (f === 'due' && !hasDue),
        )
      : required.includes('due') && !hasDue
        ? ['due']
        : [];
  const locked = missingParts.length > 0;
  const canAssign = tab === 'own' || !!selected;
  const chosenProof =
    tab === 'own'
      ? (ownProof ?? 'attestation')
      : (library?.find((t) => t.id === selected)?.proof ??
        (selected ? 'attestation' : null));
  const maxKeep = limits?.theirs[chosenProof] ?? 365;
  const defaultKeep = Math.min(limits?.mine[chosenProof] ?? 30, maxKeep);
  const shown = (library ?? []).filter((t) =>
    t.task.toLowerCase().includes(search.toLowerCase()),
  );
  const refOptions = {
    bodyParts: asOptions(bodyParts),
    boundsBody: asOptions(boundsBody),
    boundsClothing: asOptions(boundsClothing),
    equipment: asOptions(equipment),
    boundsSpaces: asOptions(boundsSpaces),
    kinks: asOptions(kinks),
  };

  return (
    <>
      <Modal
        open={open}
        title={
          consequenceFor
            ? `Add a consequence for \u201c${consequenceFor.task.task}\u201d`
            : kind === 'solo'
              ? 'Assign myself a task'
              : `Assign a task to ${partner}`
        }
        width={760}
        onCancel={onClose}
        destroyOnHidden
        footer={[
          <Button key='close' onClick={onClose}>
            Cancel
          </Button>,
          <Button
            key='go'
            type='primary'
            loading={saving}
            disabled={!canAssign || !!blocked || locked}
            onClick={() => send([])}
          >
            {locked ? 'Assign Task (Locked)' : 'Assign Task'}
          </Button>,
        ]}
      >
        {blocked ? (
          <Alert
            type='info'
            showIcon
            title={blocked}
            description='You can assign tasks once they have.'
          />
        ) : (
          <Space orientation='vertical' size='middle' style={{ width: '100%' }}>
            {consequenceFor && (
              <Alert
                type='info'
                showIcon
                title='It waits in the queue until you start it'
                description={`${partner ?? 'They'} can see it there. Nothing happens until you start it, and the same limits apply as for any task.`}
              />
            )}
            {error && <Alert type='error' title={error} />}
            <Tabs
              activeKey={tab}
              onChange={setTab}
              items={[
                {
                  key: 'library',
                  label: 'From the library',
                  children: !library ? (
                    <Spin />
                  ) : (
                    <>
                      <Input.Search
                        allowClear
                        placeholder='Search tasks'
                        aria-label='Search tasks'
                        style={{ marginBottom: 8 }}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {library.length === 0 && (
                        <Typography.Text type='secondary'>
                          The library is empty. Add tasks in the admin tool, or
                          write your own.
                        </Typography.Text>
                      )}
                      <List
                        size='small'
                        style={{ maxHeight: 320, overflowY: 'auto' }}
                        dataSource={shown}
                        renderItem={(item) => {
                          const a = item.availability;
                          return (
                            <List.Item
                              key={item.id}
                              style={{ opacity: a.assignable ? 1 : 0.6 }}
                            >
                              <Radio
                                checked={selected === item.id}
                                disabled={!a.assignable}
                                onChange={() => setSelected(item.id)}
                              >
                                <b>{item.task}</b>{' '}
                                <Tag>
                                  {PROOF_LABEL[item.proof ?? 'attestation']}
                                </Tag>
                                <div>
                                  <Typography.Text type='secondary'>
                                    {requirement(item)}
                                  </Typography.Text>
                                </div>
                                {a.softLimits.length > 0 && (
                                  <Tag color='orange'>
                                    touches a soft limit:{' '}
                                    {a.softLimits
                                      .map((s) =>
                                        kinkWithSide(
                                          kinks.find((k) => k.value === s.key),
                                          s.direction,
                                          s.key,
                                        ),
                                      )
                                      .join(', ')}
                                  </Tag>
                                )}
                                {!a.assignable && (
                                  <div>
                                    <Typography.Text type='secondary'>
                                      Not available: {whyNot(a)}
                                    </Typography.Text>
                                  </div>
                                )}
                              </Radio>
                            </List.Item>
                          );
                        }}
                      />
                    </>
                  ),
                },
                {
                  key: 'own',
                  label: 'Write my own',
                  children: !fields ? (
                    <Spin />
                  ) : (
                    <Form form={form} layout='vertical' preserve={false}>
                      <Typography.Title level={5} style={{ marginTop: 0 }}>
                        1. Core task definition
                      </Typography.Title>
                      {renderFields(
                        fields.filter((f) => !SECTION_FIELDS.includes(f.name)),
                        refOptions,
                      )}
                      <Typography.Title level={5}>
                        2. Required in-bounds guardrails
                      </Typography.Title>
                      <Form.Item
                        name='guardrails'
                        label='Guardrail tags'
                        extra={`Anatomy, gear, clothing and spaces this task needs. If ${partner ?? 'they'} haven\u2019t put one in bounds, the task can\u2019t be assigned.`}
                      >
                        <Select
                          mode='multiple'
                          showSearch
                          optionFilterProp='label'
                          placeholder='Search to add tags'
                          options={guardrailOptions}
                        />
                      </Form.Item>
                      <Typography.Title level={5}>
                        3. Associated kinks &amp; themes
                      </Typography.Title>
                      <Form.Item
                        name='kinkTags'
                        label='Active kinks & atmosphere'
                        extra='The direction follows the person doing the task. A kink with two sides is treated as something done to them.'
                      >
                        <Select
                          mode='multiple'
                          showSearch
                          optionFilterProp='label'
                          placeholder='Search to add kinks'
                          options={asOptions(kinks)}
                        />
                      </Form.Item>
                    </Form>
                  ),
                },
              ]}
            />

            <div>
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                {tab === 'own' ? '4. ' : ''}Scheduling &amp; automation
                (optional)
              </Typography.Title>
              <Checkbox
                checked={repeat}
                onChange={(e) => {
                  setRepeat(e.target.checked);
                  if (e.target.checked && dueMode === 'time') setDueMode('day');
                }}
              >
                Make this a recurring task
              </Checkbox>
              {repeat && (
                <Space wrap style={{ margin: '8px 0 0 24px' }}>
                  <Typography.Text>Starts</Typography.Text>
                  <Input
                    type='date'
                    aria-label='Start date'
                    value={startDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <Select
                    aria-label='Frequency'
                    style={{ width: 180 }}
                    value={frequency}
                    onChange={setFrequency}
                    options={FREQUENCY}
                  />
                  <Select
                    aria-label='End'
                    style={{ width: 160 }}
                    value={endMode}
                    onChange={setEndMode}
                    options={[
                      { value: 'none', label: 'No end date' },
                      { value: 'date', label: 'Ends on a date' },
                    ]}
                  />
                  {endMode === 'date' && (
                    <Input
                      type='date'
                      aria-label='End date'
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  )}
                </Space>
              )}
              {repeat && (
                <div style={{ marginLeft: 24 }}>
                  <Typography.Text type='secondary'>
                    {startDate
                      ? 'The first one is made on the start day'
                      : 'The first one is made now'}
                    , then one each matching day when anyone opens the tasks.
                    Each is due by the end of the day it&rsquo;s assigned. Days
                    nobody opened aren&rsquo;t made up afterwards, and you can
                    stop it at any time.
                  </Typography.Text>
                </div>
              )}
              {!repeat && (
                <>
                  <div style={{ marginTop: 12 }}>
                    <Typography.Text strong>Due window</Typography.Text>
                  </div>
                  <div>
                    <Radio.Group
                      value={dueMode}
                      onChange={(e) => setDueMode(e.target.value)}
                    >
                      <Radio value='none'>No due date</Radio>
                      <Radio value='day'>
                        {repeat
                          ? 'By the end of each day'
                          : 'By the end of a day'}
                      </Radio>
                      {!repeat && <Radio value='time'>By a time</Radio>}
                    </Radio.Group>
                  </div>
                  {dueMode !== 'none' && !repeat && (
                    <Space style={{ marginTop: 8 }}>
                      <Input
                        type='date'
                        aria-label='Due date'
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                      {dueMode === 'time' && (
                        <Input
                          type='time'
                          aria-label='Due time'
                          value={dueTime}
                          onChange={(e) => setDueTime(e.target.value)}
                        />
                      )}
                    </Space>
                  )}
                </>
              )}
            </div>

            {limits && chosenProof && chosenProof !== 'attestation' && (
              <div>
                <Typography.Text strong>
                  Keep what they submit for
                </Typography.Text>
                <div>
                  <Space>
                    <InputNumber
                      min={1}
                      max={maxKeep}
                      precision={0}
                      aria-label='Days to keep what they submit'
                      value={keepDays ?? defaultKeep}
                      onChange={(value) => setKeepDays(value)}
                    />
                    <Typography.Text>days</Typography.Text>
                  </Space>
                </div>
                <Typography.Text type='secondary'>
                  {kind === 'solo'
                    ? ''
                    : `Your default is ${limits.mine[chosenProof]} days, and ${partner} allows at most ${maxKeep} for this kind of task - the shorter always applies.`}
                </Typography.Text>
              </div>
            )}

            {locked && (
              <Alert
                type='warning'
                showIcon
                title={`Locked: ${partner ?? 'they'} requires ${missingParts.map((f) => FIELD_NAME[f]).join(', ')}`}
                description={`${partner ?? 'They'} chose this in their profile, so a task can't be assigned without it.`}
              />
            )}

            {kind === 'pair' && (
              <Checkbox
                checked={review}
                onChange={(e) => setReview(e.target.checked)}
              >
                I&rsquo;ll review it when it&rsquo;s done
              </Checkbox>
            )}
          </Space>
        )}
      </Modal>

      <SoftLimitDialog
        open={!!attest}
        limits={attest}
        partner={partner}
        onYes={() => send(attest)}
        onCancel={() => setAttest(null)}
      />
    </>
  );
}
