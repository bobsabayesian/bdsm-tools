import React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Spin,
  Tabs,
  Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import api, { errorMessage } from '../services/account-api';
import useAccount from '../state/useAccount';
import AccountSettings from './AccountSettings';
import Dynamics from './Dynamics';

const passwordRules = [
  { required: true, message: 'Enter a password' },
  { min: 10, message: 'At least 10 characters' },
];

/** Shows a form's request error, and runs `action` with its values */
function useSubmit(action) {
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const submit = (values) => {
    setLoading(true);
    setError(null);
    action(values)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  };
  return { error, loading, submit };
}

function AuthForm({ name, action, button, children }) {
  const { error, loading, submit } = useSubmit(action);
  return (
    <Form
      name={name}
      layout='vertical'
      onFinish={submit}
      style={{ maxWidth: 400 }}
    >
      {error && (
        <Alert type='error' message={error} style={{ marginBottom: 16 }} />
      )}
      {children}
      <Button type='primary' htmlType='submit' loading={loading}>
        {button}
      </Button>
    </Form>
  );
}

const Username = () => (
  <Form.Item
    label='Username'
    name='username'
    rules={[{ required: true, message: 'Enter a username' }]}
  >
    <Input autoComplete='username' />
  </Form.Item>
);

function AuthForms({ onAuthenticated }) {
  return (
    <Tabs
      items={[
        {
          key: 'login',
          label: 'Log in',
          children: (
            <AuthForm
              name='login'
              button='Log in'
              action={({ username, password }) =>
                api
                  .login(username, password)
                  .then(() => onAuthenticated(username))
              }
            >
              <Username />
              <Form.Item
                label='Password'
                name='password'
                rules={[{ required: true, message: 'Enter your password' }]}
              >
                <Input.Password autoComplete='current-password' />
              </Form.Item>
            </AuthForm>
          ),
        },
        {
          key: 'signup',
          label: 'Create account',
          children: (
            <AuthForm
              name='signup'
              button='Create account'
              action={({ username, password }) =>
                api
                  .signup(username, password)
                  .then(({ recoveryCode }) =>
                    onAuthenticated(username, recoveryCode, '/account/setup'),
                  )
              }
            >
              <Typography.Paragraph type='secondary'>
                No email needed. Your username is private: the people you share
                a dynamic with never see it, only the name you choose for each
                one.
              </Typography.Paragraph>
              <Form.Item
                label='Username'
                name='username'
                extra='3-32 letters, numbers, dots, dashes or underscores'
                rules={[
                  { required: true, message: 'Choose a username' },
                  {
                    pattern: /^[a-z0-9][a-z0-9_.-]{2,31}$/i,
                    message:
                      'Use 3-32 letters, numbers, dots, dashes or underscores',
                  },
                ]}
              >
                <Input autoComplete='username' />
              </Form.Item>
              <Form.Item label='Password' name='password' rules={passwordRules}>
                <Input.Password autoComplete='new-password' />
              </Form.Item>
            </AuthForm>
          ),
        },
        {
          key: 'recover',
          label: 'Forgot password',
          children: (
            <AuthForm
              name='recover'
              button='Reset password'
              action={({ username, recoveryCode, newPassword }) =>
                api
                  .recover(username, recoveryCode, newPassword)
                  .then((result) =>
                    onAuthenticated(username, result.recoveryCode),
                  )
              }
            >
              <Typography.Paragraph type='secondary'>
                Use the recovery code you were shown when you created your
                account.
              </Typography.Paragraph>
              <Username />
              <Form.Item
                label='Recovery code'
                name='recoveryCode'
                rules={[
                  { required: true, message: 'Enter your recovery code' },
                ]}
              >
                <Input autoComplete='off' />
              </Form.Item>
              <Form.Item
                label='New password'
                name='newPassword'
                rules={passwordRules}
              >
                <Input.Password autoComplete='new-password' />
              </Form.Item>
            </AuthForm>
          ),
        },
      ]}
    />
  );
}

function RecoveryCodeModal({ code, onDone }) {
  const [saved, setSaved] = React.useState(false);
  return (
    <Modal
      open
      title='Keep your recovery code safe'
      closable={false}
      maskClosable={false}
      keyboard={false}
      cancelButtonProps={{ style: { display: 'none' } }}
      okText='Continue'
      okButtonProps={{ disabled: !saved }}
      onOk={onDone}
    >
      <Typography.Paragraph>
        There is no email on your account, so this code is the only way back in
        if you forget your password. We cannot reset it for you, and it will not
        be shown again.
      </Typography.Paragraph>
      <Typography.Paragraph
        copyable
        code
        style={{ fontSize: 20, textAlign: 'center' }}
      >
        {code}
      </Typography.Paragraph>
      <Checkbox checked={saved} onChange={(e) => setSaved(e.target.checked)}>
        I have saved it somewhere safe
      </Checkbox>
    </Modal>
  );
}

export default function Entry() {
  const { user, loaded, refresh, setUser } = useAccount();
  const navigate = useNavigate();
  const [recoveryCode, setRecoveryCode] = React.useState(null);
  const [then, setThen] = React.useState(null); // where to go once the code is saved

  React.useEffect(() => {
    refresh();
  }, []);

  return (
    <>
      <PageHeader title='My dynamics' />
      {!loaded ? (
        <Spin size='large' />
      ) : user ? (
        <>
          <Dynamics />
          <AccountSettings />
        </>
      ) : (
        <AuthForms
          onAuthenticated={(username, code, next) => {
            if (code) setRecoveryCode(code);
            setThen(next ?? null);
            setUser({ username });
          }}
        />
      )}
      {recoveryCode && (
        <RecoveryCodeModal
          code={recoveryCode}
          onDone={() => {
            setRecoveryCode(null);
            if (then) navigate(then);
          }}
        />
      )}
    </>
  );
}
