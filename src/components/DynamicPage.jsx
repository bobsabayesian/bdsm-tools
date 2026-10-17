import React from 'react';
import { useLocalStorageState } from 'ahooks';
import { Alert, Button, Empty, Select, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../services/account-api';
import useAccount from '../state/useAccount';
import PageHeader from './PageHeader';

export const SELECTED_DYNAMIC_KEY = 'selected-dynamic';

const label = (d) => (d.kind === 'solo' ? 'Just me' : d.partner.alias);

/**
 * A page about one dynamic at a time, with a selector at the top right for
 * which one. Shared by Tasks and Rules, which remember the same choice.
 * `children` is called with the chosen dynamic ({ id, kind, status, ... }).
 */
export default function DynamicPage({ title, children }) {
  const navigate = useNavigate();
  const { user, loaded, refresh } = useAccount();
  const [dynamics, setDynamics] = React.useState(null);
  const [selected, setSelected] = useLocalStorageState(SELECTED_DYNAMIC_KEY, {
    defaultValue: null,
  });

  React.useEffect(() => {
    refresh();
  }, []);

  const loggedIn = !!user;
  React.useEffect(() => {
    if (!loggedIn) return;
    api
      .listDynamics()
      .then((all) =>
        setDynamics(
          all.filter((d) => d.status === 'active' || d.status === 'paused'),
        ),
      )
      .catch(() => setDynamics([]));
  }, [loggedIn]);

  if (!loaded || (user && !dynamics)) return <Spin size='large' />;
  if (!user) {
    return (
      <>
        <PageHeader title={title} />
        <Alert
          type='info'
          title={`Please log in to see your ${title.toLowerCase()}.`}
        />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/account')}>
          Log in
        </Button>
      </>
    );
  }
  if (dynamics.length === 0) {
    return (
      <>
        <PageHeader title={title} />
        <Empty
          description={`${title} live inside a dynamic. Start one on your own, or invite someone.`}
        >
          <Button type='primary' onClick={() => navigate('/account')}>
            My dynamics
          </Button>
        </Empty>
      </>
    );
  }

  const current = dynamics.find((d) => d.id === selected) ?? dynamics[0];

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <PageHeader title={title} />
        <Select
          aria-label='Dynamic'
          style={{ minWidth: 220 }}
          value={current.id}
          onChange={setSelected}
          options={dynamics.map((d) => ({
            value: d.id,
            label: d.status === 'paused' ? `${label(d)} (paused)` : label(d),
          }))}
        />
      </div>
      {current.status === 'paused' && (
        <Alert
          type='warning'
          showIcon
          style={{ marginBottom: 16 }}
          title='This dynamic is paused'
          description='You can read everything, but nothing can be assigned, done or changed until it is resumed.'
        />
      )}
      {children(current)}
    </>
  );
}
