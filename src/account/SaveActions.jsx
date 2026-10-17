import React from 'react';
import { Button, Space } from 'antd';

/**
 * Save (and, during first-time setup, Skip). Save is only active once there is
 * something to save, and the same buttons sit at the top and the bottom of long
 * screens so nobody has to scroll to find them.
 */
export default function SaveActions({ canSave, saving, onSave, onSkip }) {
  return (
    <Space>
      <Button
        type='primary'
        disabled={!canSave}
        loading={saving}
        onClick={onSave}
      >
        Save
      </Button>
      {onSkip && <Button onClick={onSkip}>Skip for now</Button>}
    </Space>
  );
}
