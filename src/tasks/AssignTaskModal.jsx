import React from 'react';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Form,
  Input,
  List,
  Modal,
  Radio,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import useCatalog from '../hooks/useCatalog';
import { fieldDefaults, renderFields } from '../components/FieldsForm';
import api, { errorData, errorMessage } from '../services/tasks-api';
import { SoftLimitDialog } from './Attest';
import { PROOF_LABEL } from './proofs';

const SIDE = { give: 'giving', receive: 'receiving' };

const asOptions = (items) =>
  items.map((i) => ({ value: i.value, label: i.label }));

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
  const [review, setReview] = React.useState(false);
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
        parts.push('needs photo or location proof, which is not available yet');
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
        `crosses a hard limit: ${a.hardLimits.map((h) => `${label(kinks, h.key)} (${SIDE[h.direction]})`).join(', ')}`,
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
          ? await form.validateFields().then(() => form.getFieldsValue())
          : undefined;
      await api.assign(dynamicId, {
        ...(tab === 'own' ? { task } : { templateId: selected }),
        dueAt: dueInstant(dueMode, dueDate, dueTime),
        requiresReview: kind === 'pair' ? review : false,
        attested,
      });
      setAttest(null);
      message.success('Task assigned');
      onAssigned();
      onClose();
    } catch (e) {
      if (e?.errorFields) return; // the form shows what is missing
      const data = errorData(e);
      if (data.code === 'attestation-required') setAttest(data.missing);
      else if (data.code === 'hard-limit') {
        setError(
          `That task crosses a hard limit: ${data.hardLimits.map((h) => `${label(kinks, h.key)} (${SIDE[h.direction]})`).join(', ')}`,
        );
      } else setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const canAssign = tab === 'own' || !!selected;
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
          kind === 'solo'
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
            disabled={!canAssign || !!blocked}
            onClick={() => send([])}
          >
            Assign
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
                                {a.softLimits.length > 0 && (
                                  <Tag color='orange'>
                                    touches a soft limit:{' '}
                                    {a.softLimits
                                      .map(
                                        (s) =>
                                          `${label(kinks, s.key)} (${SIDE[s.direction]})`,
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
                      {renderFields(fields, refOptions)}
                    </Form>
                  ),
                },
              ]}
            />

            <div>
              <Typography.Text strong>Due</Typography.Text>
              <div>
                <Radio.Group
                  value={dueMode}
                  onChange={(e) => setDueMode(e.target.value)}
                >
                  <Radio value='none'>No due date</Radio>
                  <Radio value='day'>By the end of a day</Radio>
                  <Radio value='time'>By a time</Radio>
                </Radio.Group>
              </div>
              {dueMode !== 'none' && (
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
            </div>

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
