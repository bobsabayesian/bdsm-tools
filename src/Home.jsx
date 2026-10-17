import React from 'react';
import { Button, Divider, Space, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import useAnalytics from './hooks/useAnalytics';
import useAccount from './state/useAccount';

/**
 * Where everyone lands. Someone who is not logged in sees one line to log in,
 * sign up, or look at the tools; someone who is sees the places they use.
 */
export default function Home() {
  useAnalytics('Home');
  const navigate = useNavigate();
  const { user, loaded, refresh } = useAccount();

  React.useEffect(() => {
    refresh();
  }, []);

  return (
    <div style={{ marginTop: 30 }}>
      <Typography>
        <Typography.Title level={2}>The Compliance Ledger</Typography.Title>
        <Typography.Paragraph style={{ maxWidth: 500 }}>
          Manage your dynamic.
        </Typography.Paragraph>
      </Typography>

      {loaded && !user && (
        <Typography.Paragraph style={{ fontSize: 18 }}>
          <Space separator={<Divider orientation='vertical' />} wrap>
            <Link to='/account'>Log in</Link>
            <Link to='/account?tab=signup'>Sign up</Link>
            <Link to='/tools/scene-negotiation'>Tools</Link>
          </Space>
        </Typography.Paragraph>
      )}

      {loaded && user && (
        <>
          <Divider orientation='left' style={{ marginTop: 50 }}>
            Where to next
          </Divider>
          <Space wrap size='middle'>
            <Button size='large' onClick={() => navigate('/tasks/mine')}>
              My tasks
            </Button>
            <Button size='large' onClick={() => navigate('/tasks/review')}>
              To review
            </Button>
            <Button size='large' onClick={() => navigate('/tasks')}>
              All tasks
            </Button>
            <Button size='large' onClick={() => navigate('/rules')}>
              Rules
            </Button>
            <Button size='large' onClick={() => navigate('/account#dynamics')}>
              My dynamics
            </Button>
            <Button
              size='large'
              onClick={() => navigate('/tools/scene-negotiation')}
            >
              Tools
            </Button>
          </Space>
        </>
      )}
    </div>
  );
}
