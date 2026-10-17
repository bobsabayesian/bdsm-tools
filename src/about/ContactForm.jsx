import React from 'react';
import { Alert, Button, Checkbox, Form, Input, Select } from 'antd';
import api, { errorMessage } from '../services/contact-api';
import useAccount from '../state/useAccount';

// Kept in step with CONTACT_TOPICS in worker/catalogs.js
const TOPICS = [
  { value: 'question', label: 'A question' },
  { value: 'data-request', label: 'Remove my data' },
  { value: 'problem', label: 'Report a problem' },
  { value: 'suggestion', label: 'A suggestion' },
  { value: 'other', label: 'Something else' },
];

/** A short form that sends a message to whoever runs the site */
export default function ContactForm() {
  const { user } = useAccount();
  const [form] = Form.useForm();
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState(null);

  if (sent) {
    return (
      <Alert
        type='success'
        showIcon
        title='Thanks, your message is in.'
        description='If you left a way to reply, that is where the answer will go.'
        action={
          <Button
            size='small'
            onClick={() => {
              form.resetFields();
              setSent(false);
            }}
          >
            Send another
          </Button>
        }
      />
    );
  }

  return (
    <Form
      form={form}
      layout='vertical'
      style={{ maxWidth: 560 }}
      initialValues={{ topic: 'question' }}
      onFinish={(values) => {
        setSending(true);
        setError(null);
        api
          .send(values)
          .then(() => setSent(true))
          .catch((e) => setError(errorMessage(e)))
          .finally(() => setSending(false));
      }}
    >
      {error && (
        <Alert type='error' title={error} style={{ marginBottom: 16 }} />
      )}
      <Form.Item
        label='What is it about?'
        name='topic'
        rules={[{ required: true, message: 'Choose a topic' }]}
      >
        <Select options={TOPICS} />
      </Form.Item>
      <Form.Item
        label='Your message'
        name='message'
        rules={[
          { required: true, message: 'Write your message' },
          { min: 5, message: 'Please write a little more' },
          { max: 4000, message: 'That is too long (4000 characters at most)' },
        ]}
      >
        <Input.TextArea
          autoSize={{ minRows: 5, maxRows: 14 }}
          maxLength={4000}
          showCount
          autoComplete='off'
        />
      </Form.Item>
      <Form.Item
        label='Reply to (optional)'
        name='replyTo'
        extra='An email address, or anything else you check. Leave it empty if you do not want a reply.'
        rules={[{ max: 200, message: 'At most 200 characters' }]}
      >
        <Input autoComplete='email' spellCheck={false} />
      </Form.Item>
      {user && (
        <Form.Item name='includeUsername' valuePropName='checked'>
          <Checkbox>
            Include my username, so my account can be found (for data requests)
          </Checkbox>
        </Form.Item>
      )}
      {/* Bots fill this in; people never see it */}
      <div
        aria-hidden='true'
        style={{
          position: 'absolute',
          left: -9999,
          height: 0,
          overflow: 'hidden',
        }}
      >
        <Form.Item name='website' label='Leave this empty'>
          <Input tabIndex={-1} autoComplete='off' />
        </Form.Item>
      </div>
      <Button type='primary' htmlType='submit' loading={sending}>
        Send message
      </Button>
    </Form>
  );
}
