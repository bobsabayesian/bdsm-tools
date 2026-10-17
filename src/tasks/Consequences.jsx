import React from 'react';
import DynamicPage from '../components/DynamicPage';
import TaskList from './TaskList';

/** The queue of consequences added after tasks were marked not done */
export default function Consequences() {
  return (
    <DynamicPage title='Consequences'>
      {(current) => (
        <TaskList
          key={current.id}
          dynamicId={current.id}
          paused={current.status === 'paused'}
          mode='consequences'
        />
      )}
    </DynamicPage>
  );
}
