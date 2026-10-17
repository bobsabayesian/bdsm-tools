import React from 'react';
import { useLocalStorageState } from 'ahooks';
import { Alert, Button, Empty, Select, Spin, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import api from '../services/account-api';
import useAccount from '../state/useAccount';
import RulesPanel from './RulesPanel';
import TaskList from './TaskList';

const label = (d) => (d.kind === 'solo' ? 'Just me' : d.partner.alias);

/**
 * Tasks and rules in one place. A selector at the top right chooses which
 * dynamic you are looking at; what you can do depends on who has control in it.
 */
export default function Tasks() {
  const navigate = useNavigate();
  const { user, loaded, refresh } = useAccount();
  const [dynamics, setDynamics] = React.useState(null);
  const [selected, setSelected] = useLocalStorageState('tasks-dynamic', {
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
        <PageHeader title='Tasks' />
        <Alert type='info' title='Please log in to see your tasks.' />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/account')}>
          Log in
        </Button>
      </>
    );
  }
  if (dynamics.length === 0) {
    return (
      <>
        <PageHeader title='Tasks' />
        <Empty description='Tasks live inside a dynamic. Start one on your own, or invite someone.'>
          <Button type='primary' onClick={() => navigate('/account')}>
            My dynamics
          </Button>
        </Empty>
      </>
    );
  }

  const current = dynamics.find((d) => d.id === selected) ?? dynamics[0];
  const paused = current.status === 'paused';
  const solo = current.kind === 'solo';

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
        <PageHeader title='Tasks' />
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
      {paused && (
        <Alert
          type='warning'
          showIcon
          style={{ marginBottom: 16 }}
          title='This dynamic is paused'
          description='You can read everything, but nothing can be assigned, done or changed until it is resumed.'
        />
      )}
      <Tabs
        key={current.id}
        items={[
          {
            key: 'tasks',
            label: 'Tasks',
            children: <TaskList dynamicId={current.id} paused={paused} />,
          },
          {
            key: 'rules',
            label: 'Rules',
            children: (
              <RulesPanel dynamicId={current.id} paused={paused} solo={solo} />
            ),
          },
        ]}
      />
    </>
  );
}
