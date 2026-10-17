import React from 'react';
import { Alert, Button, Form, Input, Menu, Spin, Typography } from 'antd';
import PageHeader from '../components/PageHeader';
import api, {
  errorMessage,
  getToken,
  isUnauthorized,
  setToken,
} from '../services/admin-api';
import AccessPanel from './AccessPanel';
import AccountsPanel from './AccountsPanel';
import CatalogManager from './CatalogManager';
import MessagesPanel from './MessagesPanel';

// Screens of their own, ahead of the lists of things the site offers
const SCREENS = {
  messages: 'Messages',
  accounts: 'Accounts',
  access: 'Sign-ups & codes',
};

function Login({ onLogin, error }) {
  const [loading, setLoading] = React.useState(false);

  return (
    <Form
      layout='vertical'
      style={{ maxWidth: 400 }}
      onFinish={({ token }) => {
        setLoading(true);
        onLogin(token).finally(() => setLoading(false));
      }}
    >
      {error && (
        <Alert type='error' title={error} style={{ marginBottom: 16 }} />
      )}
      <Form.Item
        label='Admin token'
        name='token'
        rules={[{ required: true, message: 'Enter the admin token' }]}
      >
        <Input.Password autoFocus autoComplete='off' />
      </Form.Item>
      <Button type='primary' htmlType='submit' loading={loading}>
        Log in
      </Button>
    </Form>
  );
}

export default function Entry() {
  const [catalogs, setCatalogs] = React.useState(null);
  const [loading, setLoading] = React.useState(!!getToken());
  const [error, setError] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [lookup, setLookup] = React.useState('');

  const login = (token) =>
    api
      .getCatalogs(token)
      .then((result) => {
        setToken(token);
        setError(null);
        setCatalogs(result);
        setSelected((current) => current ?? 'messages');
      })
      .catch((e) => {
        setToken(null);
        setError(isUnauthorized(e) ? 'Invalid admin token' : errorMessage(e));
      });

  const logout = (message = null) => {
    setToken(null);
    setCatalogs(null);
    setError(message);
  };

  React.useEffect(() => {
    const token = getToken();
    if (token) login(token).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title='Admin'
        tags={
          catalogs && (
            <Button size='small' onClick={() => logout()}>
              Log out
            </Button>
          )
        }
      />
      {loading ? (
        <Spin size='large' />
      ) : !catalogs ? (
        <Login onLogin={login} error={error} />
      ) : (
        <div className='flex' style={{ gap: 24, alignItems: 'flex-start' }}>
          <Menu
            style={{ width: 240, flexShrink: 0 }}
            selectedKeys={[selected]}
            onClick={({ key }) => setSelected(key)}
            items={[
              ...Object.entries(SCREENS).map(([key, label]) => ({
                key,
                label,
              })),
              { type: 'divider' },
              ...Object.entries(catalogs).map(([id, { title }]) => ({
                key: id,
                label: title,
              })),
            ]}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Title level={4}>
              {SCREENS[selected] ?? catalogs[selected]?.title}
            </Typography.Title>
            {selected === 'messages' && (
              <MessagesPanel
                onUnauthorized={() => logout('Your session is no longer valid')}
                onLookup={(username) => {
                  setLookup(username);
                  setSelected('accounts');
                }}
              />
            )}
            {selected === 'accounts' && (
              <AccountsPanel
                key={lookup}
                initialQuery={lookup}
                onUnauthorized={() => logout('Your session is no longer valid')}
              />
            )}
            {selected === 'access' && (
              <AccessPanel
                onUnauthorized={() => logout('Your session is no longer valid')}
              />
            )}
            {catalogs[selected] && (
              <CatalogManager
                key={selected}
                id={selected}
                catalog={catalogs[selected]}
                catalogs={catalogs}
                onUnauthorized={() => logout('Your session is no longer valid')}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
