import React from 'react';
import { App, Input, Space, Typography } from 'antd';
import PageHeader from '../components/PageHeader';
import api, { errorMessage } from '../services/account-api';
import SaveActions from './SaveActions';

/** First setup step: the name the people you are in a dynamic with call you */
export default function NameStep({ onDone }) {
  const { message } = App.useApp();
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const save = () => {
    setSaving(true);
    api
      .saveDisplayName(name.trim())
      .then(onDone)
      .catch((e) => message.error(errorMessage(e)))
      .finally(() => setSaving(false));
  };

  return (
    <>
      <PageHeader title='What should people call you?' />
      <Space orientation='vertical' size='middle' style={{ maxWidth: 520 }}>
        <Typography.Paragraph>
          Your display name is what the people you&rsquo;re in a dynamic with
          see, for example &ldquo;Zak, or Sara (without an H)&rdquo;. It is
          required. It is not your title &mdash; you choose a title like
          &ldquo;Sir&rdquo; separately for each dynamic.
        </Typography.Paragraph>
        <Input
          autoFocus
          maxLength={40}
          aria-label='Display name'
          placeholder='e.g. Zak, or Sara (without an H)'
          value={name}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={() => name.trim() && save()}
        />
        <SaveActions canSave={!!name.trim()} saving={saving} onSave={save} />
      </Space>
    </>
  );
}
