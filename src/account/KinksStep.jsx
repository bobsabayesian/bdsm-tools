import React from 'react';
import {
  Alert,
  App,
  Button,
  Collapse,
  Input,
  Progress,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  theme,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import useCatalog from '../hooks/useCatalog';
import api, { errorMessage } from '../services/account-api';
import { sideName, sidesOf } from './kinkText';
import { LEVELS, LimitsNotice } from './limits';

const slotId = (key, side) => `${key}/${side}`;
const normalise = (answers) => JSON.stringify(Object.entries(answers).sort());

// Kinks appear under their section, in the order the catalog gives
function groupKinks(kinks) {
  const groups = new Map();
  for (const kink of kinks) {
    const name = kink.category || 'Other';
    groups.set(name, [...(groups.get(name) ?? []), kink]);
  }
  return [...groups];
}

const levelOptions = (prefix) =>
  LEVELS.map((level) => ({
    value: level.value,
    label: prefix ? `${prefix}: ${level.label}` : level.label,
  }));

/** One kink: its name and a rating for each side it has */
function KinkRow({ kink, answers, onSet }) {
  return (
    <div
      style={{
        padding: '8px 0',
        borderBottom: '1px solid rgba(128,128,128,0.15)',
      }}
    >
      <b>{kink.label}</b>
      {kink.description && (
        <Typography.Text type='secondary'>
          {' '}
          <i>({kink.description})</i>
        </Typography.Text>
      )}
      <div>
        <Space wrap style={{ marginTop: 4 }}>
          {sidesOf(kink).map((side) => {
            const name = sideName(kink, side);
            return (
              <Select
                key={side}
                allowClear
                style={{ width: 240 }}
                placeholder={name ? `${name}: not decided` : 'Not decided'}
                aria-label={name ? `${kink.label} - ${name}` : kink.label}
                value={answers[slotId(kink.value, side)]}
                onChange={(level) => onSet(kink.value, side, level)}
                options={levelOptions(name)}
              />
            );
          })}
        </Space>
      </div>
    </div>
  );
}

/**
 * Setup step and tab: how someone feels about each kink, on the five-point scale,
 * for each side it has. Leaving one blank means "not decided", which is fine.
 *
 * It is a long list, so it is made easy to take in: sections that fold away with
 * a count of what is answered, a search, "only what I haven't answered", quick
 * starts, and a way to set everything left in a section at once.
 */
export default function KinksStep({ onDone, embedded = false, onDirty }) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { items: kinks, loading } = useCatalog('kinks');
  const { items: presets } = useCatalog('kinkPresets');
  const [answers, setAnswers] = React.useState(null); // { 'key/side': level }
  const [saved, setSaved] = React.useState(null); // the same, as last saved
  const [saving, setSaving] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [onlyOpen, setOnlyOpen] = React.useState(false);
  const [bulk, setBulk] = React.useState({}); // section -> level chosen for "the rest"
  const [openSections, setOpenSections] = React.useState(null);

  React.useEffect(() => {
    api
      .getProfile()
      .then((profile) => {
        const loaded = Object.fromEntries(
          profile.selections.kinks.map(({ key, direction, state }) => [
            slotId(key, direction),
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
      if (level) next[slotId(key, side)] = level;
      else delete next[slotId(key, side)];
      return next;
    });

  // every answer there could be, and how many have been given
  const slots = kinks.flatMap((kink) =>
    sidesOf(kink).map((side) => slotId(kink.value, side)),
  );
  const answered = slots.filter((id) => answers[id]).length;

  // Quick starts: "Like", and only where nothing has been answered yet
  const applyPreset = (preset) =>
    setAnswers((old) => {
      const next = { ...old };
      for (const key of preset.kinks) {
        const kink = kinks.find((k) => k.value === key);
        if (!kink) continue;
        for (const side of sidesOf(kink)) {
          if (!next[slotId(key, side)]) next[slotId(key, side)] = 'like';
        }
      }
      return next;
    });

  // Everything left unanswered in one section
  const fillRest = (sectionKinks, level) =>
    setAnswers((old) => {
      const next = { ...old };
      for (const kink of sectionKinks) {
        for (const side of sidesOf(kink)) {
          if (!next[slotId(kink.value, side)])
            next[slotId(kink.value, side)] = level;
        }
      }
      return next;
    });

  const save = () => {
    setSaving(true);
    // Only kinks still on offer, on sides that make sense for them
    const choices = kinks.flatMap((kink) =>
      sidesOf(kink)
        .filter((side) => answers[slotId(kink.value, side)])
        .map((side) => ({
          key: kink.value,
          direction: side,
          state: answers[slotId(kink.value, side)],
        })),
    );
    api
      .saveChoices('kinks', { choices })
      .then(() => {
        const kept = Object.fromEntries(
          choices.map((c) => [slotId(c.key, c.direction), c.state]),
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

  const needle = search.trim().toLowerCase();
  const matches = (kink) =>
    (!needle ||
      kink.label.toLowerCase().includes(needle) ||
      (kink.description ?? '').toLowerCase().includes(needle)) &&
    (!onlyOpen ||
      sidesOf(kink).some((side) => !answers[slotId(kink.value, side)]));
  const sections = groupKinks(kinks);
  const filtering = !!needle || onlyOpen;

  const items = sections
    .map(([section, sectionKinks]) => {
      const visible = sectionKinks.filter(matches);
      const sectionSlots = sectionKinks.flatMap((k) =>
        sidesOf(k).map((s) => slotId(k.value, s)),
      );
      const done = sectionSlots.filter((id) => answers[id]).length;
      return {
        key: section,
        visible,
        label: (
          <span>
            <b>{section}</b>{' '}
            <Tag color={done === sectionSlots.length ? 'green' : undefined}>
              {done} of {sectionSlots.length} answered
            </Tag>
          </span>
        ),
        children: (
          <>
            <Space wrap style={{ marginBottom: 8 }}>
              <Typography.Text type='secondary'>
                Set everything I haven&rsquo;t answered here to:
              </Typography.Text>
              <Select
                size='small'
                style={{ width: 150 }}
                placeholder='Choose'
                aria-label={`Set the rest of ${section} to`}
                value={bulk[section]}
                onChange={(level) =>
                  setBulk((old) => ({ ...old, [section]: level }))
                }
                options={levelOptions('')}
              />
              <Button
                size='small'
                disabled={!bulk[section]}
                onClick={() => fillRest(sectionKinks, bulk[section])}
              >
                Apply
              </Button>
            </Space>
            {visible.map((kink) => (
              <KinkRow
                key={kink.value}
                kink={kink}
                answers={answers}
                onSet={set}
              />
            ))}
          </>
        ),
      };
    })
    .filter((item) => item.visible.length > 0);

  return (
    <>
      {embedded ? (
        <Typography.Title level={4}>
          How do you feel about these?
        </Typography.Title>
      ) : (
        <PageHeader title='How do you feel about these?' />
      )}
      <Space
        orientation='vertical'
        size='middle'
        style={{ maxWidth: 800, width: '100%' }}
      >
        <Typography.Paragraph>
          For each one, say how you feel about it &mdash; from a hard limit to
          something you love &mdash; for each side it has. Each section says
          what its sides mean. There are no right answers, and anything you
          leave blank is simply not decided.
        </Typography.Paragraph>
        <Typography.Text type='secondary'>
          The people you&rsquo;re in a dynamic with can see all of these, limits
          included &mdash; nothing is hidden between you. You can change them at
          any time.
        </Typography.Text>
        <Alert
          type='info'
          showIcon
          title='Kinks are what you like; in bounds is what you have'
          description={
            <>
              This page is how you <b>feel</b> about things.{' '}
              {embedded ? (
                <Link to='/account/about/bounds'>What&rsquo;s in bounds?</Link>
              ) : (
                <>
                  &ldquo;What&rsquo;s in bounds?&rdquo; (the step before this
                  one)
                </>
              )}{' '}
              is what&rsquo;s <b>in bounds</b> &mdash; what you have and are
              willing to use. Some things, like gags, blindfolds and rope, show
              up in both. That&rsquo;s deliberate: it&rsquo;s better to say it
              twice. Tasks check each list on its own.
            </>
          }
        />
        <LimitsNotice variant='setting' />

        <div>
          <Progress
            percent={
              slots.length ? Math.round((answered / slots.length) * 100) : 0
            }
            format={() => `${answered} of ${slots.length} answered`}
          />
        </div>

        <Space wrap>
          <Input.Search
            allowClear
            placeholder='Find a kink'
            aria-label='Find a kink'
            style={{ width: 240 }}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Space>
            <Switch
              checked={onlyOpen}
              onChange={setOnlyOpen}
              aria-label="Only show what I haven't answered"
            />
            <Typography.Text>
              Only what I haven&rsquo;t answered
            </Typography.Text>
          </Space>
        </Space>

        {presets.length > 0 && (
          <div>
            <Typography.Text strong>Quick starts</Typography.Text>{' '}
            <Typography.Text type='secondary'>
              (these mark things as &ldquo;Like&rdquo;, and only where you
              haven&rsquo;t answered yet)
            </Typography.Text>
            <Space wrap style={{ marginTop: 8 }}>
              {presets.map((preset) => (
                <Button
                  key={preset.value}
                  icon={<PlusOutlined />}
                  onClick={() => applyPreset(preset)}
                >
                  Add: {preset.label}
                </Button>
              ))}
            </Space>
          </div>
        )}

        {items.length === 0 ? (
          <Typography.Text type='secondary'>Nothing matches.</Typography.Text>
        ) : (
          <Collapse
            // open the section you are in; while searching or filtering, open them all
            activeKey={
              filtering
                ? items.map((i) => i.key)
                : (openSections ?? [items[0].key])
            }
            onChange={(keys) => setOpenSections(keys)}
            items={items.map(({ key, label, children }) => ({
              key,
              label,
              children,
            }))}
          />
        )}

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            padding: '12px 0',
            background: token.colorBgLayout,
            zIndex: 1,
          }}
        >
          <Space>
            <Button type='primary' loading={saving} onClick={save}>
              Save
            </Button>
            <Button onClick={() => setAnswers({})}>Clear all</Button>
            {!embedded && <Button onClick={skip}>Skip for now</Button>}
          </Space>
        </div>
      </Space>
    </>
  );
}
