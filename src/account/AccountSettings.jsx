import React from 'react';
import {
  Alert,
  App,
  Button,
  Collapse,
  Form,
  Input,
  Space,
  Typography,
} from 'antd';
import api, { errorMessage } from '../services/account-api';
import useAccount from '../state/useAccount';

function ChangePassword() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [error, setError] = React.useState(null);

  return (
    <Form
      form={form}
      layout='vertical'
      style={{ maxWidth: 400 }}
      onFinish={({ currentPassword, newPassword }) => {
        setError(null);
        api
          .changePassword(currentPassword, newPassword)
          .then(() => {
            message.success('Password changed');
            form.resetFields();
          })
          .catch((e) => setError(errorMessage(e)));
      }}
    >
      {error && (
        <Alert type='error' message={error} style={{ marginBottom: 16 }} />
      )}
      <Form.Item
        label='Current password'
        name='currentPassword'
        rules={[{ required: true }]}
      >
        <Input.Password autoComplete='current-password' />
      </Form.Item>
      <Form.Item
        label='New password'
        name='newPassword'
        rules={[
          { required: true },
          { min: 10, message: 'At least 10 characters' },
        ]}
      >
        <Input.Password autoComplete='new-password' />
      </Form.Item>
      <Button htmlType='submit'>Change password</Button>
    </Form>
  );
}

function DeleteAccount() {
  const { modal } = App.useApp();
  const setUser = useAccount((state) => state.setUser);
  const [error, setError] = React.useState(null);
  const password = React.useRef('');

  const confirm = () =>
    modal.confirm({
      title: 'Delete your account?',
      okText: 'Delete my account',
      okButtonProps: { danger: true },
      content: (
        <>
          <Typography.Paragraph>
            This ends all of your dynamics and removes your login. The people in
            them will see that your account was deleted. It cannot be undone.
          </Typography.Paragraph>
          <Input.Password
            placeholder='Your password'
            onChange={(e) => (password.current = e.target.value)}
          />
        </>
      ),
      onOk: () =>
        api
          .deleteAccount(password.current)
          .then(() => setUser(null))
          .catch((e) => {
            setError(errorMessage(e));
            return Promise.reject(e);
          }),
    });

  return (
    <>
      {error && (
        <Alert type='error' message={error} style={{ marginBottom: 16 }} />
      )}
      <Button danger onClick={confirm}>
        Delete my account
      </Button>
    </>
  );
}

export default function AccountSettings() {
  const { user, setUser } = useAccount();

  return (
    <Collapse
      ghost
      style={{ marginTop: 32 }}
      items={[
        {
          key: 'account',
          label: `Account (${user.username})`,
          children: (
            <Space direction='vertical' size='large'>
              <Button onClick={() => api.logout().finally(() => setUser(null))}>
                Log out
              </Button>
              <ChangePassword />
              <DeleteAccount />
            </Space>
          ),
        },
      ]}
    />
  );
}
