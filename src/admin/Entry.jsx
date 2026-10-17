import React from 'react';
import { Alert, Button, Form, Input, Menu, Spin, Typography } from 'antd';
import PageHeader from '../components/PageHeader';
import api, {
  errorMessage,
  getToken,
  isUnauthorized,
  setToken,
} from '../services/admin-api';
import CatalogManager from './CatalogManager';

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

  const login = (token) =>
    api
      .getCatalogs(token)
      .then((result) => {
        setToken(token);
        setError(null);
        setCatalogs(result);
        setSelected((current) => current ?? Object.keys(result)[0]);
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
            items={Object.entries(catalogs).map(([id, { title }]) => ({
              key: id,
              label: title,
            }))}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Title level={4}>
              {catalogs[selected].title}
            </Typography.Title>
            <CatalogManager
              key={selected}
              id={selected}
              catalog={catalogs[selected]}
              catalogs={catalogs}
              onUnauthorized={() => logout('Your session is no longer valid')}
            />
          </div>
        </div>
      )}
    </>
  );
}
