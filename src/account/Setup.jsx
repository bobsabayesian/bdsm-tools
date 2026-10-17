import React from 'react';
import { Alert, App, Button, Checkbox, Space, Spin, Typography } from 'antd';
import Cookies from 'js-cookie';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import useCatalog from '../hooks/useCatalog';
import api, { errorMessage } from '../services/account-api';
import useAccount from '../state/useAccount';

// Groups appear in the order their first part does (the catalog is already in order)
function groupParts(parts) {
  const groups = new Map();
  for (const part of parts) {
    const name = part.group || 'Other';
    groups.set(name, [...(groups.get(name) ?? []), part]);
  }
  return [...groups];
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

  const loggedIn = !!user;
  React.useEffect(() => {
    if (!loggedIn) return;
    api
      .getProfile()
      .then((profile) =>
        // Only the first answer counts: ticks made while this was loading must survive
        setChosen(
          (current) =>
            current ??
            new Set(profile.selections.bodyParts.map(({ key }) => key)),
        ),
      )
      .catch((e) => message.error(errorMessage(e)));
  }, [loggedIn]);

  if (!loaded || (user && (chosen === null || loadingParts))) {
    return <Spin size='large' />;
  }
  if (!user) {
    return (
      <>
        <PageHeader title='Setting up' />
        <Alert type='info' title='Please log in to set up your profile.' />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/account')}>
          Log in
        </Button>
      </>
    );
  }

  const finish = () => navigate('/account');
  // A part an admin has switched off can still be named by a preset or an
  // earlier choice; only parts on offer can be ticked or saved
  const offered = new Set(parts.map((part) => part.value));
  const add = (keys) =>
    setChosen(
      (old) => new Set([...old, ...keys.filter((key) => offered.has(key))]),
    );
  const toggle = (key, on) =>
    setChosen((old) => {
      const next = new Set(old);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const save = () => {
    setSaving(true);
    const keys = [...chosen].filter((key) => offered.has(key));
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
      <PageHeader title='What would you like included in your tasks?' />
      <Space orientation='vertical' size='middle' style={{ maxWidth: 640 }}>
        <Typography.Paragraph>
          Tasks can involve different parts of your body, voice, or personal
          presentation. Tick the ones you&rsquo;re happy to have included. This
          is strictly about <b>what you want in play</b>, not about who you are
          &mdash; you never need to explain your body or identity. Anything left
          unticked won&rsquo;t be part of a task.
        </Typography.Paragraph>
        <Typography.Text type='secondary'>
          Only you can see these choices, and you can change them at any time.
        </Typography.Text>

        <div>
          <Typography.Text strong>Quick start</Typography.Text>{' '}
          <Typography.Text type='secondary'>
            (shortcuts only add to what&rsquo;s already ticked, so you can mix
            and match freely)
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
                    <b>{part.label}</b>
                    {part.description && (
                      <Typography.Text type='secondary'>
                        {' '}
                        <i>({part.description})</i>
                      </Typography.Text>
                    )}
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
