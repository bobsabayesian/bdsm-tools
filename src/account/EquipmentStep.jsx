import React from 'react';
import { App, Button, Checkbox, Space, Spin, Typography } from 'antd';
import Cookies from 'js-cookie';
import PageHeader from '../components/PageHeader';
import useCatalog from '../hooks/useCatalog';
import api, { errorMessage } from '../services/account-api';

const sameKeys = (a, b) =>
  a.size === b.size && [...a].every((key) => b.has(key));

/** Setup step and tab: the equipment someone has (or can use). */
export default function EquipmentStep({ onDone, embedded = false, onDirty }) {
  const { message } = App.useApp();
  const { items: equipment, loading } = useCatalog('equipment');
  const [chosen, setChosen] = React.useState(null);
  const [saved, setSaved] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api
      .getProfile()
      .then((profile) => {
        const keys = new Set(
          profile.selections.equipment.map(({ key }) => key),
        );
        setChosen((current) => current ?? keys);
        setSaved(keys);
      })
      .catch((e) => message.error(errorMessage(e)));
  }, []);

  React.useEffect(() => {
    if (chosen && saved && onDirty) onDirty(!sameKeys(chosen, saved));
  }, [chosen, saved]);

  if (chosen === null || loading) return <Spin size='large' />;

  const offered = new Set(equipment.map((item) => item.value));
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
      .saveChoices('equipment', { keys })
      .then(() => {
        // The training tool on the site reads this cookie
        Cookies.set('my-equipment', keys.join('|'), { SameSite: 'Lax' });
        setChosen(new Set(keys));
        setSaved(new Set(keys));
        if (embedded) message.success('Saved');
        else onDone();
      })
      .catch((e) => message.error(errorMessage(e)))
      .finally(() => setSaving(false));
  };
  const skip = () =>
    api
      .skipStep('equipment')
      .then(onDone)
      .catch((e) => message.error(errorMessage(e)));

  return (
    <>
      {embedded ? (
        <Typography.Title level={4}>
          What equipment do you have?
        </Typography.Title>
      ) : (
        <PageHeader title='What equipment do you have?' />
      )}
      <Space orientation='vertical' size='middle' style={{ maxWidth: 640 }}>
        <Typography.Paragraph>
          Tick what you own or can use. Tasks that need something you
          don&rsquo;t have won&rsquo;t be offered to you.
        </Typography.Paragraph>
        <Typography.Text type='secondary'>
          The people you&rsquo;re in a dynamic with can see this &mdash; nothing
          is hidden between you. You can change it at any time.
        </Typography.Text>
        <Space wrap>
          <Button onClick={() => setChosen(new Set(offered))}>
            Select everything
          </Button>
          <Button onClick={() => setChosen(new Set())}>Clear all</Button>
        </Space>
        <div>
          {equipment.map((item) => (
            <div key={item.value}>
              <Checkbox
                checked={chosen.has(item.value)}
                onChange={(e) => toggle(item.value, e.target.checked)}
              >
                {item.label}
              </Checkbox>
            </div>
          ))}
        </div>
        <Space>
          <Button type='primary' loading={saving} onClick={save}>
            Save
          </Button>
          {!embedded && <Button onClick={skip}>Skip for now</Button>}
        </Space>
      </Space>
    </>
  );
}
