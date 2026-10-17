import React from 'react';
import { Alert, Button, Empty, Input, Space, Spin, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import api, { errorMessage } from '../services/contact-api';

const when = (iso) => new Date(iso).toLocaleString();

/**
 * Someone's private conversation with the site owner. The link is the key: no
 * account is needed, which is the point when the problem is being locked out.
 */
export default function Thread() {
  const { token } = useParams();
  const [data, setData] = React.useState(null);
  const [missing, setMissing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState(null);

  const load = () =>
    api
      .getThread(token)
      .then(setData)
      .catch((e) =>
        e?.response?.status === 404
          ? setMissing(true)
          : setError(errorMessage(e)),
      );
  React.useEffect(() => {
    load();
  }, [token]);

  if (missing) {
    return (
      <>
        <PageHeader title='Conversation' />
        <Empty description='This conversation was not found. The link may be wrong, or it may have been deleted.' />
      </>
    );
  }
  if (!data) return error ? <Alert type='error' title={error} /> : <Spin />;

  const waiting =
    data.thread.length > 0 &&
    data.thread[data.thread.length - 1].from === 'them';

  return (
    <>
      <PageHeader title='Your conversation' />
      <Space
        orientation='vertical'
        size='middle'
        style={{ maxWidth: 640, width: '100%' }}
      >
        <Typography.Text type='secondary'>
          Only people with this link can read this. Keep it somewhere safe, and
          come back to it to see replies &mdash; there is no email.
        </Typography.Text>
        {data.thread.map((t) => (
          <div
            key={t.at + t.from}
            style={{
              maxWidth: '85%',
              marginLeft: t.from === 'them' ? 'auto' : 0,
              padding: '10px 14px',
              background: t.from === 'them' ? '#3a1a1a' : '#2f2f2f',
              borderRadius: 4,
            }}
          >
            <Typography.Text type='secondary' style={{ fontSize: 13 }}>
              {t.from === 'them' ? 'You' : 'Site owner'} &middot; {when(t.at)}
            </Typography.Text>
            <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {t.body}
            </Typography.Paragraph>
          </div>
        ))}
        {waiting && (
          <Typography.Text type='secondary'>
            Waiting for a reply. Check back later.
          </Typography.Text>
        )}
        {error && <Alert type='error' title={error} />}
        <Space.Compact style={{ width: '100%' }}>
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 8 }}
            maxLength={4000}
            placeholder='Write a reply…'
            aria-label='Your reply'
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button
            type='primary'
            loading={sending}
            disabled={!draft.trim()}
            onClick={() => {
              setSending(true);
              setError(null);
              api
                .replyInThread(token, draft)
                .then((result) => {
                  setData(result);
                  setDraft('');
                })
                .catch((e) => setError(errorMessage(e)))
                .finally(() => setSending(false));
            }}
          >
            Send
          </Button>
        </Space.Compact>
      </Space>
    </>
  );
}
