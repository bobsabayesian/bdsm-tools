import React from 'react';
import {
  App,
  Button,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd';
import useCatalog from '../hooks/useCatalog';
import api, { errorMessage } from '../services/account-api';

const PRONOUN_SUGGESTIONS = [
  'she/her',
  'he/him',
  'they/them',
  'any pronouns',
  'ask me',
];
const MAX_PRONOUNS = 10;
const MAX_PRONOUN_LENGTH = 40;

const normalise = (me) =>
  JSON.stringify([
    [...me.genders].sort(),
    me.pronouns,
    me.about.trim(),
    me.ruleChangeMinDays,
  ]);

/**
 * The optional "Me" tab: who someone is, in their own words. Everything is
 * optional and nothing depends on it. Partners can see it, like the rest.
 */
export default function MeSection({ onDirty }) {
  const { message } = App.useApp();
  const { items: genders } = useCatalog('genders');
  const [me, setMe] = React.useState(null);
  const [saved, setSaved] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api
      .getProfile()
      .then((profile) => {
        setMe((current) => current ?? profile.me);
        setSaved(normalise(profile.me));
      })
      .catch((e) => message.error(errorMessage(e)));
  }, []);

  React.useEffect(() => {
    if (me && saved && onDirty) onDirty(normalise(me) !== saved);
  }, [me, saved]);

  if (!me) return <Spin size='large' />;

  const save = () => {
    setSaving(true);
    api
      .saveMe({ ...me, about: me.about.trim() })
      .then(() => {
        const kept = { ...me, about: me.about.trim() };
        setMe(kept);
        setSaved(normalise(kept));
        message.success('Saved');
      })
      .catch((e) => message.error(errorMessage(e)))
      .finally(() => setSaving(false));
  };

  const offeredGenders = new Set(genders.map((g) => g.value));

  return (
    <>
      <Typography.Title level={4}>Me</Typography.Title>
      <Space
        orientation='vertical'
        size='middle'
        style={{ maxWidth: 640, width: '100%' }}
      >
        <Typography.Paragraph>
          Whatever you&rsquo;d like the people you&rsquo;re in a dynamic with to
          know about you. Everything here is optional, and nothing else depends
          on it.
        </Typography.Paragraph>
        <Typography.Text type='secondary'>
          They can see this &mdash; nothing is hidden between you. You can
          change it at any time.
        </Typography.Text>

        {genders.length > 0 && (
          <div>
            <Typography.Text strong>Gender</Typography.Text>
            <Typography.Paragraph type='secondary' style={{ margin: 0 }}>
              Choose any that fit, or none &mdash; you can also say it in your
              own words below.
            </Typography.Paragraph>
            <Select
              mode='multiple'
              allowClear
              style={{ width: '100%', marginTop: 4 }}
              placeholder='Not specified'
              aria-label='Gender'
              value={me.genders.filter((key) => offeredGenders.has(key))}
              onChange={(values) => setMe({ ...me, genders: values })}
              options={genders.map((g) => ({ value: g.value, label: g.label }))}
            />
          </div>
        )}

        <div>
          <Typography.Text strong>Pronouns</Typography.Text>
          <Typography.Paragraph type='secondary' style={{ margin: 0 }}>
            Pick from the suggestions or type your own.
          </Typography.Paragraph>
          <Select
            mode='tags'
            style={{ width: '100%', marginTop: 4 }}
            placeholder='Not specified'
            aria-label='Pronouns'
            tokenSeparators={[',']}
            value={me.pronouns}
            onChange={(values) =>
              setMe({
                ...me,
                pronouns: values
                  .map((v) => v.trim().slice(0, MAX_PRONOUN_LENGTH))
                  .filter(Boolean)
                  .slice(0, MAX_PRONOUNS),
              })
            }
            options={PRONOUN_SUGGESTIONS.map((value) => ({
              value,
              label: value,
            }))}
          />
        </div>

        <div>
          <Typography.Text strong>
            Things my partner should know
          </Typography.Text>
          <Input.TextArea
            rows={6}
            maxLength={2000}
            showCount
            style={{ marginTop: 4 }}
            aria-label='Things my partner should know'
            value={me.about}
            onChange={(e) => setMe({ ...me, about: e.target.value })}
            placeholder='In your own words'
          />
        </div>

        <div>
          <Typography.Text strong>Rule change minimum</Typography.Text>
          <Typography.Paragraph type='secondary' style={{ margin: 0 }}>
            When someone sets rules for the two of you, each rule stays as it is
            for at least this many days before it can be changed. They can ask
            for longer, never shorter. It only matters when you&rsquo;re the one
            living under someone&rsquo;s rules.
          </Typography.Paragraph>
          <Space style={{ marginTop: 4 }}>
            <InputNumber
              min={0}
              max={365}
              precision={0}
              aria-label='Rule change minimum (days)'
              value={me.ruleChangeMinDays}
              onChange={(value) =>
                setMe({ ...me, ruleChangeMinDays: value ?? 0 })
              }
            />
            <Typography.Text>days</Typography.Text>
          </Space>
        </div>

        <Button type='primary' loading={saving} onClick={save}>
          Save
        </Button>
      </Space>
    </>
  );
}
