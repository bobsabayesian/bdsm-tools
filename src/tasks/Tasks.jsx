import React from 'react';
import DynamicPage from '../components/DynamicPage';
import TaskList from './TaskList';

/**
 * Tasks: one view, with a selector at the top right for which dynamic. What you
 * can do depends on who has control in it.
 */
export default function Tasks() {
  return (
    <DynamicPage title='Tasks'>
      {(current) => (
        <TaskList
          key={current.id}
          dynamicId={current.id}
          paused={current.status === 'paused'}
        />
      )}
    </DynamicPage>
  );
}
