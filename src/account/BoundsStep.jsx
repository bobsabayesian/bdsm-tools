import React from 'react';
import { Alert, App, Button, Checkbox, Space, Spin, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import Cookies from 'js-cookie';
import PageHeader from '../components/PageHeader';
import useCatalog from '../hooks/useCatalog';
import api, { errorMessage } from '../services/account-api';

// The four lists that can be put in bounds, in the order they appear. A list
// only shows once it has something in it (spaces will, once some are added).
// `preset` is the field of a quick start that names things from that list.
const SECTIONS = [
  { catalog: 'boundsBody', title: 'Body & Anatomy', preset: 'parts' },
  {
    catalog: 'boundsClothing',
    title: 'Clothing, Underwear & Presentation',
    preset: 'clothing',
  },
  { catalog: 'equipment', title: 'Items', preset: 'equipment' },
  { catalog: 'boundsSpaces', title: 'Spaces', preset: 'spaces' },
];

const idOf = (catalog, key) => `${catalog}/${key}`;
const sameSet = (a, b) => a.size === b.size && [...a].every((id) => b.has(id));

// Headings inside a section, in the order the lists give them
function groupItems(items) {
  const groups = new Map();
  for (const item of items) {
    const name = item.group || '';
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  return [...groups];
}

/**
 * "What's in bounds?" - the one place to say which parts of the body, clothing,
 * items and spaces tasks may involve. It is about what someone wants in play,
 * not their anatomy or identity: nobody is asked about sex or gender, the quick
 * starts only ever add, and skipping is fine.
 */
export default function BoundsStep({ onDone, embedded = false, onDirty }) {
  const { message } = App.useApp();
  const lists = {
    boundsBody: useCatalog('boundsBody'),
    boundsClothing: useCatalog('boundsClothing'),
    equipment: useCatalog('equipment'),
    boundsSpaces: useCatalog('boundsSpaces'),
  };
  const { items: presets } = useCatalog('boundsPresets');
  const [chosen, setChosen] = React.useState(null); // Set of "catalog/key"
  const [saved, setSaved] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api
      .getProfile()
      .then((profile) => {
        const ids = new Set(
          SECTIONS.flatMap(({ catalog }) =>
            (profile.selections[catalog] ?? []).map(({ key }) =>
              idOf(catalog, key),
            ),
          ),
        );
        // Only the first answer counts: ticks made while this was loading must survive
        setChosen((current) => current ?? ids);
        setSaved(ids);
      })
      .catch((e) => message.error(errorMessage(e)));
  }, []);

  React.useEffect(() => {
    if (chosen && saved && onDirty) onDirty(!sameSet(chosen, saved));
  }, [chosen, saved]);

  const loading = Object.values(lists).some((l) => l.loading);
  if (chosen === null || loading) return <Spin size='large' />;

  const shown = SECTIONS.filter(
    ({ catalog }) => lists[catalog].items.length > 0,
  );
  // Anything an admin has since switched off can still be named by a quick start
  // or an earlier choice; only what is on offer can be ticked or saved
  const offered = new Set(
    shown.flatMap(({ catalog }) =>
      lists[catalog].items.map((i) => idOf(catalog, i.value)),
    ),
  );
  const add = (ids) =>
    setChosen(
      (old) => new Set([...old, ...ids.filter((id) => offered.has(id))]),
    );
  const toggle = (id, on) =>
    setChosen((old) => {
      const next = new Set(old);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // What each quick start would add - and none is offered that would add nothing
  const presetIds = (preset) =>
    SECTIONS.flatMap(({ catalog, preset: field }) =>
      (preset[field] ?? []).map((key) => idOf(catalog, key)),
    ).filter((id) => offered.has(id));
  const quickStarts = presets.filter((p) => presetIds(p).length > 0);

  const save = () => {
    setSaving(true);
    const keysFor = (catalog) =>
      [...chosen]
        .filter((id) => id.startsWith(`${catalog}/`) && offered.has(id))
        .map((id) => id.slice(catalog.length + 1));
    Promise.all(
      shown.map(({ catalog }) =>
        api.saveChoices(catalog, { keys: keysFor(catalog) }),
      ),
    )
      .then(() => {
        // The training tool on the site reads this cookie
        Cookies.set('my-equipment', keysFor('equipment').join('|'), {
          SameSite: 'Lax',
        });
        const kept = new Set([...chosen].filter((id) => offered.has(id)));
        setChosen(kept);
        setSaved(kept);
        if (embedded) message.success('Saved');
        else onDone();
      })
      .catch((e) => message.error(errorMessage(e)))
      .finally(() => setSaving(false));
  };
  const skip = () =>
    Promise.all(shown.map(({ catalog }) => api.skipStep(catalog)))
      .then(onDone)
      .catch((e) => message.error(errorMessage(e)));

  const title = "What's in bounds?";
  return (
    <>
      {embedded ? (
        <Typography.Title level={4}>{title}</Typography.Title>
      ) : (
        <PageHeader title={title} />
      )}
      <Space orientation='vertical' size='middle' style={{ maxWidth: 700 }}>
        <Typography.Paragraph>
          Tasks can involve different parts of the body, clothing, items, and
          spaces. Tick everything that&rsquo;s in bounds for your tasks. This is
          about <b>what you want in play</b>, not about who you are &mdash; you
          never need to explain your body or identity. Anything left unticked
          stays out of bounds and won&rsquo;t be part of a task.
        </Typography.Paragraph>
        <Typography.Text type='secondary'>
          The people you&rsquo;re in a dynamic with can see these choices
          &mdash; nothing is hidden between you. You can change them any time.
        </Typography.Text>
        <Alert
          type='info'
          showIcon
          title='This overlaps with My Body on purpose'
          description={
            <>
              Some of this also appears in{' '}
              {embedded ? (
                <Link to='/account/about/body'>My Body</Link>
              ) : (
                'My Body (the step before this one)'
              )}
              . That&rsquo;s deliberate: it&rsquo;s better to say something
              twice than to leave it unsaid. Tasks check each list on its own,
              so a choice in one doesn&rsquo;t count for the other.
            </>
          }
        />

        <div>
          <Typography.Title level={5} style={{ marginBottom: 0 }}>
            Quick Start
          </Typography.Title>
          <Typography.Text type='secondary'>
            (These only add to what&rsquo;s ticked, so you can mix them)
          </Typography.Text>
          <Space wrap style={{ marginTop: 8 }}>
            {quickStarts.map((preset) => (
              <Button
                key={preset.value}
                icon={<PlusOutlined />}
                onClick={() => add(presetIds(preset))}
              >
                Add: {preset.label}
              </Button>
            ))}
            <Button onClick={() => add([...offered])}>Select everything</Button>
            <Button onClick={() => setChosen(new Set())}>Clear all</Button>
          </Space>
        </div>

        {shown.map(({ catalog, title: sectionTitle }, index) => (
          <div key={catalog}>
            <Typography.Title level={4} style={{ marginBottom: 4 }}>
              {index + 1}. {sectionTitle}
            </Typography.Title>
            {groupItems(lists[catalog].items).map(([group, items]) => (
              <div key={group} style={{ marginBottom: 12 }}>
                {group && <Typography.Text strong>{group}</Typography.Text>}
                {items.map((item) => (
                  <div key={item.value}>
                    <Checkbox
                      checked={chosen.has(idOf(catalog, item.value))}
                      onChange={(e) =>
                        toggle(idOf(catalog, item.value), e.target.checked)
                      }
                    >
                      <b>{item.label}</b>
                      {item.description && (
                        <Typography.Text type='secondary'>
                          {' '}
                          <i>({item.description})</i>
                        </Typography.Text>
                      )}
                    </Checkbox>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

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
