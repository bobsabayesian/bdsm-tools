import React from 'react';
import { Button, Form, Input, Modal, Radio, Typography } from 'antd';
import moment from 'moment';
import { REASONS } from './common';

const COPY = {
  pause: {
    title: 'Pause this dynamic?',
    statement: 'This is not a substitute for a discussion.',
    intro:
      'Pausing stops everything where it is. Nothing is lost - it is all kept as it is until it is resumed. Your partner will see that you paused it.',
    action: 'Yes',
    cancel: 'Cancel',
  },
  end: {
    title: 'End this dynamic',
    intro:
      'You can leave at any time and nobody has to agree. After this they will no longer see when you are active.',
    action: 'End it',
    cancel: 'Never mind',
  },
};

/**
 * The same prompt for pausing and ending. Saying why is invited but never
 * required - a compulsory reason would be a way of being kept in.
 */
export default function PauseEndDialog({ mode, open, onClose, onSubmit }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = React.useState(false);
  const copy = COPY[mode];

  const submit = ({ reason, note, resumeOn }) => {
    setSaving(true);
    onSubmit({
      reason: reason || undefined,
      note: note || undefined,
      // A date picked here means the start of that day for this person
      resumeOn: resumeOn
        ? new Date(`${resumeOn}T00:00`).toISOString()
        : undefined,
    }).finally(() => setSaving(false));
  };

  return (
    <Modal
      open={open}
      title={copy.title}
      onCancel={onClose}
      destroyOnHidden
      footer={(() => {
        const cancel = (
          <Button key='cancel' onClick={onClose}>
            {copy.cancel}
          </Button>
        );
        const go = (
          <Button
            key='go'
            type='primary'
            danger={mode === 'end'}
            loading={saving}
            onClick={() => form.submit()}
          >
            {copy.action}
          </Button>
        );
        // Pausing reads "Yes / Cancel", like the other questions in the app
        return mode === 'pause' ? [go, cancel] : [cancel, go];
      })()}
    >
      {copy.statement && (
        <Typography.Paragraph strong style={{ fontSize: 18 }}>
          {copy.statement}
        </Typography.Paragraph>
      )}
      <Typography.Paragraph>{copy.intro}</Typography.Paragraph>
      <Form form={form} layout='vertical' onFinish={submit} preserve={false}>
        <Form.Item
          name='reason'
          label='Want to tell them why?'
          extra='Entirely optional - you can skip this and just continue.'
        >
          <Radio.Group>
            {REASONS.map(({ value, label }) => (
              <Radio.Button key={value} value={value}>
                {label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>
        <Form.Item name='note' label='Anything you would like them to know'>
          <Input.TextArea
            rows={3}
            maxLength={1000}
            showCount
            placeholder='In your own words, if you want to'
          />
        </Form.Item>
        {mode === 'pause' && (
          <Form.Item
            name='resumeOn'
            label='Resume on'
            extra='Optional. Otherwise it stays paused until you resume it.'
          >
            <Input
              type='date'
              min={moment().add(1, 'day').format('YYYY-MM-DD')}
              style={{ width: 200 }}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
