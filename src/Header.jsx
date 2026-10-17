import React from 'react';
import { Tag, Affix, Button, Space, Typography } from 'antd';
import PageHeader from './components/PageHeader';
import { DeploymentUnitOutlined, LogoutOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from './services/account-api';
import useAccount from './state/useAccount';

function AccountStatus() {
  const navigate = useNavigate();
  const { user, loaded, refresh, setUser } = useAccount();

  React.useEffect(() => {
    refresh();
  }, []);

  if (!loaded) return null;
  if (!user) return <Link to='/account'>Log in</Link>;

  return (
    <Space size='middle' wrap>
      <Link to='/account/about'>My profile</Link>
      <Link to='/account'>My dynamics</Link>
      <Typography.Text type='secondary'>{user.username}</Typography.Text>
      <Button
        size='small'
        icon={<LogoutOutlined />}
        onClick={() =>
          api.logout().finally(() => {
            setUser(null);
            navigate('/account');
          })
        }
      >
        Log out
      </Button>
    </Space>
  );
}

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const back = () => navigate('/');
  return (
    <Affix offsetTop={0}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <PageHeader
          title='BDSM Tools'
          onBack={pathname !== '/' ? back : undefined}
          tags={<Tag color='red'>{process.env.VERSION}</Tag>}
          avatar={{ icon: <DeploymentUnitOutlined /> }}
          style={{ margin: 0 }}
        />
        <div style={{ marginLeft: 'auto' }}>
          <AccountStatus />
        </div>
      </div>
    </Affix>
  );
}
