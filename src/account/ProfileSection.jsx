import React from 'react';
import { Alert, App, Button, Card, List, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../services/account-api';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// "What's in bounds?" is four lists on one screen; say how far along it is
const BOUNDS = ['boundsBody', 'boundsClothing', 'equipment', 'boundsSpaces'];
function boundsText(steps, selections) {
  const mine = steps.filter((s) => BOUNDS.includes(s.id));
  const total = BOUNDS.reduce((n, id) => n + (selections[id]?.length ?? 0), 0);
  const counted = plural(total, 'thing', 'things') + ' in bounds';
  if (mine.every((s) => s.status === 'done')) return counted;
  if (mine.every((s) => s.status === 'skipped')) return 'Skipped for now';
  if (mine.every((s) => !s.status)) return 'Not done yet';
  return `${counted} - more to look at`;
}

/** One line per tab of About me: what is there, and a way to edit it */
function rows(profile) {
  const { steps, selections, me } = profile;
  const status = (id) => steps.find((s) => s.id === id)?.status;
  const describe = (id, summary) => {
    if (status(id) === 'done') return summary;
    return status(id) === 'skipped' ? 'Skipped for now' : 'Not done yet';
  };

  const myDetails = [me.displayName, me.pronouns.join(', ')]
    .filter(Boolean)
    .join(' · ');
  return [
    {
      tab: 'me',
      title: 'Me',
      text: myDetails || 'Not filled in yet (all optional)',
    },
    {
      tab: 'body',
      title: 'My Body',
      text: describe(
        'bodyParts',
        `${plural(selections.bodyParts.length, 'part', 'parts')} included in tasks`,
      ),
    },
    {
      tab: 'bounds',
      title: "What's in bounds?",
      text: boundsText(steps, selections),
    },
    ...(status('kinks') === undefined
      ? []
      : [
          {
            tab: 'kinks',
            title: 'My Kinks',
            text: describe(
              'kinks',
              plural(selections.kinks.length, 'answer', 'answers'),
            ),
          },
        ]),
  ];
}

/**
 * The first thing on the account page: your profile, with a clear way to edit
 * each part of it. Everything here is what the people in your dynamics see.
 */
export default function ProfileSection({ profile, onChanged }) {
  const navigate = useNavigate();
  const { message } = App.useApp();

  return (
    <section id='profile' style={{ marginBottom: 40 }}>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        My profile
      </Typography.Title>

      {profile.sharing.needsReview && (
        <Alert
          type='warning'
          showIcon
          style={{ marginBottom: 16 }}
          title='Your partners can now see your choices'
          description='You answered these when they were private. In a dynamic everything is open between you, so nothing is shown to anyone until you confirm. Take a look at your choices first if you like.'
          action={
            <Space>
              <Button size='small' onClick={() => navigate('/account/about')}>
                Review
              </Button>
              <Button
                size='small'
                type='primary'
                onClick={() =>
                  api
                    .shareProfile()
                    .then(onChanged)
                    .catch((e) => message.error(errorMessage(e)))
                }
              >
                I understand, share them
              </Button>
            </Space>
          }
        />
      )}
      {!profile.me.displayName && (
        <Alert
          type='warning'
          showIcon
          style={{ marginBottom: 16 }}
          title='Add your display name'
          description='You need a display name before you can invite someone, join a dynamic or start on your own.'
          action={
            <Button
              size='small'
              type='primary'
              onClick={() => navigate('/account/about/me')}
            >
              Add it
            </Button>
          }
        />
      )}
      {profile.nextStep && (
        <Alert
          type='info'
          showIcon
          style={{ marginBottom: 16 }}
          title='Finish setting up your profile'
          description='Tell us what you would like included in tasks and how you feel about different things. It takes a few minutes and you can change it later.'
          action={
            <Button
              size='small'
              type='primary'
              onClick={() => navigate('/account/setup')}
            >
              Set up
            </Button>
          }
        />
      )}

      <Card
        size='small'
        title='About me'
        extra={
          <Button type='primary' onClick={() => navigate('/account/about/me')}>
            Edit my profile
          </Button>
        }
      >
        <Typography.Paragraph type='secondary'>
          This is what the people in your dynamics see about you &mdash; nothing
          here is hidden from them.
        </Typography.Paragraph>
        <List
          size='small'
          dataSource={rows(profile)}
          renderItem={(row) => (
            <List.Item
              key={row.tab}
              actions={[
                <Button
                  key='edit'
                  size='small'
                  onClick={() => navigate(`/account/about/${row.tab}`)}
                >
                  Edit
                </Button>,
              ]}
            >
              <List.Item.Meta title={row.title} description={row.text} />
            </List.Item>
          )}
        />
      </Card>
    </section>
  );
}
