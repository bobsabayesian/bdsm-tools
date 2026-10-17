import React from 'react';
import { Card, Space, Spin, Table, Tag, Typography } from 'antd';
import useCatalog from '../hooks/useCatalog';
import api from '../services/account-api';
import { LEVELS, LevelTag } from './limits';

const SIDE_LABEL = { give: 'giving', receive: 'receiving' };

// Items keep the catalog's order; anything an admin has since switched off is dropped
const labelled = (catalog, keys) =>
  catalog.filter((item) => keys.includes(item.value));

function Limits({ kinks, answers }) {
  const withLevel = (level) =>
    answers
      .filter((a) => a.state === level)
      .map((a) => ({ ...a, kink: kinks.find((k) => k.value === a.key) }))
      .filter((a) => a.kink);

  return (
    <Space orientation='vertical' size='small'>
      {['hard-limit', 'soft-limit'].map((level) => {
        const found = withLevel(level);
        const meta = LEVELS.find((l) => l.value === level);
        return (
          <div key={level}>
            <LevelTag level={level} />
            {found.length === 0 ? (
              <Typography.Text type='secondary'>None</Typography.Text>
            ) : (
              found.map((a) => (
                <Tag key={`${a.key}/${a.direction}`} color={meta.color}>
                  {a.kink.label} ({SIDE_LABEL[a.direction]})
                </Tag>
              ))
            )}
          </div>
        );
      })}
    </Space>
  );
}

function KinkTable({ kinks, answers }) {
  const rows = kinks
    .map((kink) => ({
      key: kink.value,
      kink,
      give: answers.find((a) => a.key === kink.value && a.direction === 'give')
        ?.state,
      receive: answers.find(
        (a) => a.key === kink.value && a.direction === 'receive',
      )?.state,
    }))
    .filter((row) => row.give || row.receive);

  const categories = [
    ...new Set(rows.map((row) => row.kink.category || 'Other')),
  ];
  const cell = (level, applies) =>
    !applies ? (
      <Typography.Text type='secondary'>n/a</Typography.Text>
    ) : level ? (
      <LevelTag level={level} />
    ) : (
      <Typography.Text type='secondary'>not decided</Typography.Text>
    );

  return categories.map((category) => (
    <div key={category} style={{ marginTop: 12 }}>
      <Typography.Text strong>{category}</Typography.Text>
      <Table
        size='small'
        pagination={false}
        showHeader
        dataSource={rows.filter(
          (row) => (row.kink.category || 'Other') === category,
        )}
        columns={[
          { title: 'Kink', dataIndex: ['kink', 'label'] },
          {
            title: 'Giving',
            render: (_, row) => cell(row.give, row.kink.sides !== 'receive'),
          },
          {
            title: 'Receiving',
            render: (_, row) => cell(row.receive, row.kink.sides !== 'give'),
          },
        ]}
      />
    </div>
  ));
}

/**
 * Everything the other person has chosen, in full - body parts and kinks,
 * limits included. Both people in a dynamic see this about each other.
 */
export default function PartnerProfile({ dynamic }) {
  const { partner } = dynamic;
  const [profile, setProfile] = React.useState(null);
  const { items: bodyParts } = useCatalog('bodyParts');
  const { items: kinks } = useCatalog('kinks');

  React.useEffect(() => {
    api
      .getPartnerProfile(dynamic.id)
      .then(setProfile)
      .catch(() => setProfile({ shared: false }));
  }, [dynamic.id]);

  if (!profile) return <Spin />;

  const intro = (
    <Typography.Text type='secondary'>
      {partner.alias} can see the same about you.
    </Typography.Text>
  );

  if (!profile.shared) {
    return (
      <Card
        size='small'
        title={`About ${partner.alias}`}
        style={{ maxWidth: 760, marginBottom: 24 }}
      >
        <Typography.Paragraph type='secondary'>
          {partner.alias} hasn&rsquo;t filled in their profile yet.
        </Typography.Paragraph>
        {intro}
      </Card>
    );
  }

  const { bodyParts: chosenParts, kinks: kinkAnswers } = profile.selections;
  const parts = labelled(
    bodyParts,
    chosenParts.map((p) => p.key),
  );
  const groups = [...new Set(parts.map((p) => p.group || 'Other'))];
  const answeredKinks = kinks.filter((k) =>
    kinkAnswers.some((a) => a.key === k.value),
  );
  const status = (step) => profile.steps?.[step];

  return (
    <Card
      size='small'
      title={`About ${partner.alias}`}
      style={{ maxWidth: 760, marginBottom: 24 }}
    >
      <Space orientation='vertical' size='middle' style={{ width: '100%' }}>
        {intro}

        {kinks.length > 0 && (
          <div>
            <Typography.Title level={5}>Limits</Typography.Title>
            {status('kinks') === 'done' ? (
              <Limits kinks={kinks} answers={kinkAnswers} />
            ) : (
              <Typography.Text type='secondary'>
                {partner.alias} hasn&rsquo;t answered the kinks yet.
              </Typography.Text>
            )}
          </div>
        )}

        <div>
          <Typography.Title level={5}>Included in tasks</Typography.Title>
          {status('bodyParts') !== 'done' ? (
            <Typography.Text type='secondary'>
              {partner.alias} hasn&rsquo;t chosen yet.
            </Typography.Text>
          ) : parts.length === 0 ? (
            <Typography.Text type='secondary'>
              Nothing &mdash; no body parts are included in tasks.
            </Typography.Text>
          ) : (
            groups.map((group) => (
              <div key={group} style={{ marginBottom: 4 }}>
                <Typography.Text type='secondary'>{group}: </Typography.Text>
                {parts
                  .filter((p) => (p.group || 'Other') === group)
                  .map((p) => (
                    <Tag key={p.value}>{p.label}</Tag>
                  ))}
              </div>
            ))
          )}
        </div>

        {status('kinks') === 'done' && answeredKinks.length > 0 && (
          <div>
            <Typography.Title level={5}>Kinks</Typography.Title>
            <KinkTable kinks={answeredKinks} answers={kinkAnswers} />
          </div>
        )}
      </Space>
    </Card>
  );
}
