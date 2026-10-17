import React from 'react';
import {
  App,
  Button,
  Checkbox,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd';
import { PROOF_LABELS, TASK_FIELD_LABELS } from './retention';
import SaveActions from './SaveActions';
import { scrollToTop } from '../util';
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
    me.displayName,
    [...me.genders].sort(),
    me.pronouns,
    me.about.trim(),
    me.ruleChangeMinDays,
    me.dataRetention,
    [...me.unwillingTaskTypes].sort(),
    [...me.requiredTaskFields].sort(),
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
  const [roles, setRoles] = React.useState(null); // roles held in open dynamics

  React.useEffect(() => {
    api
      .listDynamics()
      .then((list) =>
        setRoles(
          new Set(
            list.filter((d) => d.status !== 'ended').map((d) => d.you.role),
          ),
        ),
      )
      .catch(() => setRoles(new Set()));
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
        scrollToTop();
        message.success('Saved');
      })
      .catch((e) => message.error(errorMessage(e)))
      .finally(() => setSaving(false));
  };

  const canSave = !!me.displayName?.trim() && normalise(me) !== saved;
  // Which explanations apply depends on the roles they hold (both if unsure)
  const known = roles && roles.size > 0;
  const showSub = !known || roles.has('sub') || roles.has('self');
  const showDom = !known || roles.has('dom') || roles.has('self');
  const offeredGenders = new Set(genders.map((g) => g.value));

  return (
    <>
      <Space
        orientation='vertical'
        size='middle'
        style={{ maxWidth: 640, width: '100%' }}
      >
        <SaveActions canSave={canSave} saving={saving} onSave={save} />
        <Typography.Text type='secondary'>
          They can see this &mdash; nothing is hidden between you. You can
          change it at any time.
        </Typography.Text>

        <div>
          <Typography.Text strong>Display name (required)</Typography.Text>
          <Typography.Paragraph type='secondary' style={{ margin: 0 }}>
            What the people you&rsquo;re in a dynamic with call you, for example
            &ldquo;Zak, or Sara (without an H)&rdquo;. It is not your title:
            titles like &ldquo;Sir&rdquo; are chosen separately for each
            dynamic. You can use a different name in each dynamic too.
          </Typography.Paragraph>
          <Input
            maxLength={40}
            style={{ marginTop: 4, maxWidth: 320 }}
            aria-label='Display name'
            placeholder='e.g. Zak, or Sara (without an H)'
            autoComplete='nickname'
            value={me.displayName ?? ''}
            onChange={(e) => setMe({ ...me, displayName: e.target.value })}
          />
        </div>

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

        {showSub && (
          <div>
            <Typography.Text strong>
              Task types I&rsquo;m up for
            </Typography.Text>
            <Typography.Paragraph type='secondary' style={{ margin: 0 }}>
              Untick any kind of task you don&rsquo;t want to be given. Tasks of
              that kind can&rsquo;t be assigned to you, and the person setting
              tasks can see why. Tick them again whenever you like.
            </Typography.Paragraph>
            <Space orientation='vertical' size={0} style={{ marginTop: 4 }}>
              {Object.entries(PROOF_LABELS).map(([kind, label]) => (
                <Checkbox
                  key={kind}
                  checked={!me.unwillingTaskTypes.includes(kind)}
                  onChange={(e) =>
                    setMe({
                      ...me,
                      unwillingTaskTypes: e.target.checked
                        ? me.unwillingTaskTypes.filter((k) => k !== kind)
                        : [...me.unwillingTaskTypes, kind],
                    })
                  }
                >
                  {label}
                </Checkbox>
              ))}
            </Space>
          </div>
        )}

        {showSub && (
          <div>
            <Typography.Text strong>What a task must include</Typography.Text>
            <Typography.Paragraph type='secondary' style={{ margin: 0 }}>
              Tick the parts you want filled in before a task can be assigned to
              you. The person setting tasks sees the button locked until
              they&rsquo;ve done it, so you always know what you&rsquo;re being
              asked to do.
            </Typography.Paragraph>
            <Space orientation='vertical' size={0} style={{ marginTop: 4 }}>
              {Object.entries(TASK_FIELD_LABELS).map(([field, label]) => (
                <Checkbox
                  key={field}
                  checked={me.requiredTaskFields.includes(field)}
                  onChange={(e) =>
                    setMe({
                      ...me,
                      requiredTaskFields: e.target.checked
                        ? [...me.requiredTaskFields, field]
                        : me.requiredTaskFields.filter((f) => f !== field),
                    })
                  }
                >
                  {label}
                </Checkbox>
              ))}
            </Space>
          </div>
        )}

        <div>
          <Typography.Text strong>Data retention</Typography.Text>
          {showSub && (
            <Typography.Paragraph type='secondary' style={{ margin: 0 }}>
              <b>When you&rsquo;re given tasks:</b> the person who set a task
              can see what you submit for this many days, depending on the kind
              of proof. After that it is hidden from them, and a few days later
              removed altogether (never sooner than a week, so nothing
              disappears by accident). You always see your own. This is the most
              they can choose for you.
            </Typography.Paragraph>
          )}
          {showDom && (
            <Typography.Paragraph type='secondary' style={{ margin: 0 }}>
              <b>When you set tasks:</b> a new task defaults to keeping what
              your partner submits for this many days, depending on the kind of
              proof. You can change it for each task, and it never goes over the
              maximum your partner has set &mdash; the shorter of the two always
              applies.
            </Typography.Paragraph>
          )}
          <Typography.Paragraph type='secondary' style={{ margin: 0 }}>
            The shortest is 1 day. Changes only apply to tasks set after you
            make them.
          </Typography.Paragraph>
          <Space orientation='vertical' size={4} style={{ marginTop: 4 }}>
            {Object.entries(PROOF_LABELS).map(([kind, label]) => (
              <Space key={kind}>
                <InputNumber
                  min={1}
                  max={365}
                  precision={0}
                  aria-label={`${label} (days)`}
                  value={me.dataRetention[kind]}
                  onChange={(value) =>
                    setMe({
                      ...me,
                      dataRetention: {
                        ...me.dataRetention,
                        [kind]: value ?? 1,
                      },
                    })
                  }
                />
                <Typography.Text>days &mdash; {label}</Typography.Text>
              </Space>
            ))}
          </Space>
        </div>

        <SaveActions canSave={canSave} saving={saving} onSave={save} />
      </Space>
    </>
  );
}
