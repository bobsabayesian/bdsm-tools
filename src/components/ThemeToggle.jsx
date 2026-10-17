import React from 'react';
import { Button, Tooltip } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import useTheme, { DARK } from '../state/useTheme';

/** Dark by default; one press switches, and the choice is remembered */
export default function ThemeToggle({ className, style }) {
  const mode = useTheme((state) => state.mode);
  const toggle = useTheme((state) => state.toggle);
  const label = mode === DARK ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <Tooltip title={label}>
      <Button
        type='text'
        className={className}
        style={style}
        aria-label={label}
        icon={mode === DARK ? <SunOutlined /> : <MoonOutlined />}
        onClick={toggle}
      />
    </Tooltip>
  );
}
