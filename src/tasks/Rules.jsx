import React from 'react';
import DynamicPage from '../components/DynamicPage';
import RulesPanel from './RulesPanel';

/**
 * Rules: the overarching agreements of a dynamic. They are not tied to any
 * task, and once set they stand for a while before they can be changed.
 */
export default function Rules() {
  return (
    <DynamicPage title='Rules'>
      {(current) => (
        <RulesPanel
          key={current.id}
          dynamicId={current.id}
          paused={current.status === 'paused'}
          solo={current.kind === 'solo'}
        />
      )}
    </DynamicPage>
  );
}
