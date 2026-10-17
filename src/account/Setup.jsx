import React from 'react';
import { Alert, App, Button, Checkbox, Space, Spin, Typography } from 'antd';
import Cookies from 'js-cookie';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import useCatalog from '../hooks/useCatalog';
import api, { errorMessage } from '../services/account-api';
import useAccount from '../state/useAccount';

const LAST_GROUP = 'Other';

function groupParts(parts) {
  const groups = new Map();
  for (const part of parts) {
    const name = part.group || LAST_GROUP;
    groups.set(name, [...(groups.get(name) ?? []), part]);
  }
  return [...groups].sort(([a], [b]) =>
    a === LAST_GROUP ? 1 : b === LAST_GROUP ? -1 : a.localeCompare(b),
  );
}

/**
 * First setup step: which body parts to include in tasks.
 *
 * Deliberately about what someone wants *included*, not what they "have":
 * nobody is asked about their anatomy, sex or gender, and the quick-starts
 * only ever add parts, so they can be mixed freely.
 */
export default function Setup() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { user, loaded, refresh } = useAccount();
  const { items: parts, loading: loadingParts } = useCatalog('bodyParts');
  const { items: presets } = useCatalog('bodyPartPresets');
  const [chosen, setChosen] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    refresh();
  }, []);

  React.useEffect(() => {
    if (!user) return;
    api
      .getProfile()
      .then((profile) =>
        setChosen(new Set(profile.selections.bodyParts.map(({ key }) => key))),
      )
      .catch((e) => message.error(errorMessage(e)));
  }, [user]);

  if (!loaded || (user && (chosen === null || loadingParts))) {
    return <Spin size='large' />;
  }
  if (!user) {
    return (
      <>
        <PageHeader title='Setting up' />
        <Alert type='info' message='Please log in to set up your profile.' />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/account')}>
          Log in
        </Button>
      </>
    );
  }

  const finish = () => navigate('/account');
  const add = (keys) => setChosen((old) => new Set([...old, ...keys]));
  const toggle = (key, on) =>
    setChosen((old) => {
      const next = new Set(old);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const save = () => {
    setSaving(true);
    const keys = [...chosen];
    api
      .saveChoices('bodyParts', keys)
      .then(() => {
        // The training tool on the site reads this cookie
        Cookies.set('body-parts', keys.join('|'), { SameSite: 'Lax' });
        finish();
      })
      .catch((e) => message.error(errorMessage(e)))
      .finally(() => setSaving(false));
  };
  const skip = () =>
    api
      .skipStep('bodyParts')
      .then(finish)
      .catch((e) => message.error(errorMessage(e)));

  return (
    <>
      <PageHeader title='What would you like included?' />
      <Space direction='vertical' size='middle' style={{ maxWidth: 640 }}>
        <Typography.Paragraph>
          Tasks can involve different parts of the body. Tick the ones
          you&rsquo;re happy to have included. This is about what you want in
          play, not about who you are &mdash; you never need to explain your
          body or identity. Anything left unticked won&rsquo;t be part of a
          task.
        </Typography.Paragraph>
        <Typography.Text type='secondary'>
          Only you can see these choices, and you can change them any time.
        </Typography.Text>

        <div>
          <Typography.Text strong>Quick start</Typography.Text>{' '}
          <Typography.Text type='secondary'>
            (these only add to what&rsquo;s ticked, so you can mix them)
          </Typography.Text>
          <Space wrap style={{ marginTop: 8 }}>
            {presets.map((preset) => (
              <Button key={preset.value} onClick={() => add(preset.parts)}>
                Add: {preset.label}
              </Button>
            ))}
            <Button onClick={() => add(parts.map((part) => part.value))}>
              Select everything
            </Button>
            <Button onClick={() => setChosen(new Set())}>Clear all</Button>
          </Space>
        </div>

        {groupParts(parts).map(([group, items]) => (
          <div key={group}>
            <Typography.Text strong>{group}</Typography.Text>
            <div>
              {items.map((part) => (
                <div key={part.value}>
                  <Checkbox
                    checked={chosen.has(part.value)}
                    onChange={(e) => toggle(part.value, e.target.checked)}
                  >
                    {part.label}
                  </Checkbox>
                </div>
              ))}
            </div>
          </div>
        ))}

        <Space>
          <Button type='primary' loading={saving} onClick={save}>
            Save
          </Button>
          <Button onClick={skip}>Skip for now</Button>
        </Space>
      </Space>
    </>
  );
}
