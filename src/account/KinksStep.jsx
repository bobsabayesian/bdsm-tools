import React from 'react';
import { App, Button, Select, Space, Spin, Typography } from 'antd';
import PageHeader from '../components/PageHeader';
import useCatalog from '../hooks/useCatalog';
import api, { errorMessage } from '../services/account-api';
import { LEVELS, LimitsNotice } from './limits';

const SIDES = [
  { value: 'give', label: 'Giving' },
  { value: 'receive', label: 'Receiving' },
];

const sidesFor = (kink) =>
  kink.sides === 'give' || kink.sides === 'receive'
    ? SIDES.filter((side) => side.value === kink.sides)
    : SIDES;

// Kinks appear under their category, in the order the catalog gives
function groupKinks(kinks) {
  const groups = new Map();
  for (const kink of kinks) {
    const name = kink.category || 'Other';
    groups.set(name, [...(groups.get(name) ?? []), kink]);
  }
  return [...groups];
}

const keyOf = (key, side) => `${key}/${side}`;

/**
 * Setup step: how someone feels about each kink, separately for giving and
 * receiving. Leaving one blank means "not decided", which is fine.
 */
const normalise = (answers) => JSON.stringify(Object.entries(answers).sort());

export default function KinksStep({ onDone, embedded = false, onDirty }) {
  const { message } = App.useApp();
  const { items: kinks, loading } = useCatalog('kinks');
  const [answers, setAnswers] = React.useState(null); // { 'key/side': level }
  const [saved, setSaved] = React.useState(null); // the same, as last saved
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api
      .getProfile()
      .then((profile) => {
        const loaded = Object.fromEntries(
          profile.selections.kinks.map(({ key, direction, state }) => [
            keyOf(key, direction),
            state,
          ]),
        );
        setAnswers((current) => current ?? loaded);
        setSaved(normalise(loaded));
      })
      .catch((e) => message.error(errorMessage(e)));
  }, []);

  React.useEffect(() => {
    if (answers && saved && onDirty) onDirty(normalise(answers) !== saved);
  }, [answers, saved]);

  if (answers === null || loading) return <Spin size='large' />;

  const set = (key, side, level) =>
    setAnswers((old) => {
      const next = { ...old };
      if (level) next[keyOf(key, side)] = level;
      else delete next[keyOf(key, side)];
      return next;
    });

  const save = () => {
    setSaving(true);
    // Only kinks still on offer, on sides that make sense for them
    const choices = kinks.flatMap((kink) =>
      sidesFor(kink)
        .filter((side) => answers[keyOf(kink.value, side.value)])
        .map((side) => ({
          key: kink.value,
          direction: side.value,
          state: answers[keyOf(kink.value, side.value)],
        })),
    );
    api
      .saveChoices('kinks', { choices })
      .then(() => {
        const kept = Object.fromEntries(
          choices.map((c) => [keyOf(c.key, c.direction), c.state]),
        );
        setAnswers(kept);
        setSaved(normalise(kept));
        if (embedded) message.success('Saved');
        else onDone();
      })
      .catch((e) => message.error(errorMessage(e)))
      .finally(() => setSaving(false));
  };
  const skip = () =>
    api
      .skipStep('kinks')
      .then(onDone)
      .catch((e) => message.error(errorMessage(e)));

  return (
    <>
      {embedded ? (
        <Typography.Title level={4}>
          How do you feel about these?
        </Typography.Title>
      ) : (
        <PageHeader title='How do you feel about these?' />
      )}
      <Space orientation='vertical' size='middle' style={{ maxWidth: 760 }}>
        <Typography.Paragraph>
          For each one, say how you feel about <b>giving</b> it and about{' '}
          <b>receiving</b> it. There are no right answers, and anything you
          leave blank is simply not decided.
        </Typography.Paragraph>
        <Typography.Text type='secondary'>
          The people you&rsquo;re in a dynamic with can see all of these, limits
          included &mdash; nothing is hidden between you. You can change them at
          any time.
        </Typography.Text>
        <LimitsNotice variant='setting' />

        {groupKinks(kinks).map(([category, items]) => (
          <div key={category}>
            <Typography.Title level={5}>{category}</Typography.Title>
            {items.map((kink) => (
              <div key={kink.value} style={{ marginBottom: 16 }}>
                <b>{kink.label}</b>
                {kink.description && (
                  <Typography.Text type='secondary'>
                    {' '}
                    <i>({kink.description})</i>
                  </Typography.Text>
                )}
                <div>
                  <Space wrap style={{ marginTop: 4 }}>
                    {sidesFor(kink).map((side) => (
                      <Select
                        key={side.value}
                        allowClear
                        style={{ width: 230 }}
                        placeholder={`${side.label}: not decided`}
                        aria-label={`${kink.label} - ${side.label}`}
                        value={answers[keyOf(kink.value, side.value)]}
                        onChange={(level) => set(kink.value, side.value, level)}
                        options={LEVELS.map((level) => ({
                          value: level.value,
                          label: `${side.label}: ${level.label}`,
                        }))}
                      />
                    ))}
                  </Space>
                </div>
              </div>
            ))}
          </div>
        ))}

        <Space>
          <Button type='primary' loading={saving} onClick={save}>
            Save
          </Button>
          <Button onClick={() => setAnswers({})}>Clear all</Button>
          {!embedded && <Button onClick={skip}>Skip for now</Button>}
        </Space>
      </Space>
    </>
  );
}
