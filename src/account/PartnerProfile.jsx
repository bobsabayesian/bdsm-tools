import React from 'react';
import { Card, Space, Spin, Table, Tabs, Tag, Typography } from 'antd';
import useCatalog from '../hooks/useCatalog';
import api from '../services/account-api';
import { kinkWithSide, sideName } from './kinkText';
import { LEVELS, LevelTag } from './limits';

// The lists on "What's in bounds?" - a partner sees them all
const BOUNDS = ['boundsBody', 'boundsClothing', 'equipment', 'boundsSpaces'];

// Items keep the catalog's order; anything an admin has since switched off is dropped
const labelled = (catalog, keys) =>
  catalog.filter((item) => keys.includes(item.value));

const Nothing = ({ children }) => (
  <Typography.Text type='secondary'>{children}</Typography.Text>
);

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
              <Nothing>None</Nothing>
            ) : (
              found.map((a) => (
                <Tag key={`${a.key}/${a.direction}`} color={meta.color}>
                  {kinkWithSide(a.kink, a.direction)}
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
  const answer = (kink, direction) =>
    answers.find((a) => a.key === kink.value && a.direction === direction)
      ?.state;
  const rows = kinks
    .map((kink) => ({
      key: kink.value,
      kink,
      give: answer(kink, 'give'),
      receive: answer(kink, 'receive'),
      any: answer(kink, 'any'),
    }))
    .filter((row) => row.give || row.receive || row.any);

  const categories = [
    ...new Set(rows.map((row) => row.kink.category || 'Other')),
  ];
  const cell = (level, applies) => {
    if (!applies) return <Nothing>n/a</Nothing>;
    return level ? <LevelTag level={level} /> : <Nothing>not decided</Nothing>;
  };

  return categories.map((category) => {
    const inCategory = rows.filter(
      (row) => (row.kink.category || 'Other') === category,
    );
    // A section names its own sides ("As Dominant" / "As submissive"), or has none
    const first = inCategory[0].kink;
    const oneAnswer = inCategory.every((row) => row.kink.sides === 'any');
    return (
      <div key={category} style={{ marginTop: 12 }}>
        <Typography.Text strong>{category}</Typography.Text>
        <Table
          size='small'
          pagination={false}
          dataSource={inCategory}
          columns={[
            { title: 'Kink', dataIndex: ['kink', 'label'] },
            ...(oneAnswer
              ? [{ title: 'Feeling', render: (_, row) => cell(row.any, true) }]
              : [
                  {
                    title: sideName(first, 'give'),
                    render: (_, row) =>
                      cell(
                        row.give,
                        row.kink.sides !== 'receive' &&
                          row.kink.sides !== 'any',
                      ),
                  },
                  {
                    title: sideName(first, 'receive'),
                    render: (_, row) =>
                      cell(
                        row.receive,
                        row.kink.sides !== 'give' && row.kink.sides !== 'any',
                      ),
                  },
                ]),
          ]}
        />
      </div>
    );
  });
}

/**
 * Everything the other person has chosen, in full - the same tabs as their own
 * "About me", read-only. Limits are always shown first. Both people in a
 * dynamic see this about each other.
 */
export default function PartnerProfile({ dynamic }) {
  const { partner } = dynamic;
  const [profile, setProfile] = React.useState(null);
  const { items: bodyParts } = useCatalog('bodyParts');
  const { items: equipment } = useCatalog('equipment');
  const inBounds = {
    boundsBody: useCatalog('boundsBody').items,
    boundsClothing: useCatalog('boundsClothing').items,
    boundsSpaces: useCatalog('boundsSpaces').items,
  };
  const { items: kinks } = useCatalog('kinks');
  const { items: genders } = useCatalog('genders');

  React.useEffect(() => {
    api
      .getPartnerProfile(dynamic.id)
      .then(setProfile)
      .catch(() => setProfile({ shared: false }));
  }, [dynamic.id]);

  const cardStyle = { maxWidth: 760, marginBottom: 24 };
  const title = `About ${partner.alias}`;
  const intro = (
    <Typography.Text type='secondary'>
      {partner.alias} can see the same about you.
    </Typography.Text>
  );

  if (!profile) return <Spin />;
  if (!profile.shared) {
    return (
      <Card size='small' title={title} style={cardStyle}>
        <Typography.Paragraph type='secondary'>
          {partner.alias} hasn&rsquo;t filled in their profile yet.
        </Typography.Paragraph>
        {intro}
      </Card>
    );
  }

  const { me, steps, selections } = profile;
  const parts = labelled(
    bodyParts,
    selections.bodyParts.map((p) => p.key),
  );
  const groups = [...new Set(parts.map((p) => p.group || 'Other'))];
  const myGenders = labelled(genders, me.genders);
  const answeredKinks = kinks.filter((k) =>
    selections.kinks.some((a) => a.key === k.value),
  );
  const nobody = `${partner.alias} hasn’t chosen yet.`;

  const items = [
    {
      key: 'me',
      label: 'Me',
      children: (
        <Space orientation='vertical' size='small'>
          {myGenders.length > 0 && (
            <div>
              <Typography.Text type='secondary'>Gender: </Typography.Text>
              {myGenders.map((g) => (
                <Tag key={g.value}>{g.label}</Tag>
              ))}
            </div>
          )}
          {me.pronouns.length > 0 && (
            <div>
              <Typography.Text type='secondary'>Pronouns: </Typography.Text>
              {me.pronouns.map((p) => (
                <Tag key={p}>{p}</Tag>
              ))}
            </div>
          )}
          {me.about && (
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
              {me.about}
            </Typography.Paragraph>
          )}
          {myGenders.length === 0 && me.pronouns.length === 0 && !me.about && (
            <Nothing>
              {partner.alias} hasn&rsquo;t shared anything else here.
            </Nothing>
          )}
          <div>
            <Typography.Text type='secondary'>
              Rule change minimum:{' '}
            </Typography.Text>
            <Tag>
              {me.ruleChangeMinDays}{' '}
              {me.ruleChangeMinDays === 1 ? 'day' : 'days'}
            </Tag>
          </div>
        </Space>
      ),
    },
    {
      key: 'body',
      label: 'Body',
      children:
        steps.bodyParts !== 'done' ? (
          <Nothing>{nobody}</Nothing>
        ) : parts.length === 0 ? (
          <Nothing>
            Nothing &mdash; no body parts are included in tasks.
          </Nothing>
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
        ),
    },
    {
      key: 'bounds',
      label: "What's in bounds?",
      children: !BOUNDS.some((s) => steps[s] === 'done') ? (
        <Nothing>{nobody}</Nothing>
      ) : (
        <Space orientation='vertical' size='middle' style={{ width: '100%' }}>
          {[
            ['boundsBody', 'Body & Anatomy'],
            ['boundsClothing', 'Clothing, Underwear & Presentation'],
            ['equipment', 'Items'],
            ['boundsSpaces', 'Spaces'],
          ]
            .filter(
              ([id]) =>
                (id === 'equipment' ? equipment : inBounds[id]).length > 0,
            )
            .map(([id, title]) => {
              const list = id === 'equipment' ? equipment : inBounds[id];
              const chosen = labelled(
                list,
                selections[id].map((x) => x.key),
              );
              return (
                <div key={id}>
                  <Typography.Text strong>{title}</Typography.Text>
                  <div>
                    {chosen.length === 0 ? (
                      <Nothing>Nothing in bounds.</Nothing>
                    ) : (
                      [...new Set(chosen.map((i) => i.group || ''))].map(
                        (group) => (
                          <div key={group} style={{ marginBottom: 4 }}>
                            {group && (
                              <Typography.Text type='secondary'>
                                {group}:{' '}
                              </Typography.Text>
                            )}
                            {chosen
                              .filter((i) => (i.group || '') === group)
                              .map((i) => (
                                <Tag key={i.value}>{i.label}</Tag>
                              ))}
                          </div>
                        ),
                      )
                    )}
                  </div>
                </div>
              );
            })}
        </Space>
      ),
    },
    ...(kinks.length > 0
      ? [
          {
            key: 'kinks',
            label: 'Kinks',
            children:
              steps.kinks !== 'done' ? (
                <Nothing>
                  {partner.alias} hasn&rsquo;t answered the kinks yet.
                </Nothing>
              ) : answeredKinks.length === 0 ? (
                <Nothing>No answers.</Nothing>
              ) : (
                <KinkTable kinks={answeredKinks} answers={selections.kinks} />
              ),
          },
        ]
      : []),
  ];

  return (
    <Card size='small' title={title} style={cardStyle}>
      <Space orientation='vertical' size='middle' style={{ width: '100%' }}>
        {intro}
        {kinks.length > 0 && steps.kinks === 'done' && (
          <div>
            <Typography.Title level={5}>Limits</Typography.Title>
            <Limits kinks={kinks} answers={selections.kinks} />
          </div>
        )}
        <Tabs items={items} />
      </Space>
    </Card>
  );
}
