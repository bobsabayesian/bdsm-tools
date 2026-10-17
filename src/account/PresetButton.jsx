import React from 'react';
import { Button } from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';

/**
 * A quick start. It says what it will do: "Add: X" while any of X is missing
 * (so a half-ticked one adds the rest), and "Remove: X" once all of it is in.
 */
export default function PresetButton({ label, active, onAdd, onRemove }) {
  return (
    <Button
      icon={active ? <MinusOutlined /> : <PlusOutlined />}
      onClick={active ? onRemove : onAdd}
    >
      {active ? 'Remove' : 'Add'}: {label}
    </Button>
  );
}
