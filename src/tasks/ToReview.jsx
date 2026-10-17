import React from 'react';
import DynamicPage from '../components/DynamicPage';
import TaskList from './TaskList';

/** Everything that has been submitted and is waiting for the person who set it to look over */
export default function ToReview() {
  return (
    <DynamicPage title='To review'>
      {(current) => (
        <TaskList
          key={current.id}
          dynamicId={current.id}
          paused={current.status === 'paused'}
          mode='review'
        />
      )}
    </DynamicPage>
  );
}
