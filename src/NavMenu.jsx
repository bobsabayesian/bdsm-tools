import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Affix } from 'antd';
import {
  FileDoneOutlined,
  QuestionCircleOutlined,
  ToolOutlined,
  InfoCircleOutlined,
  HomeOutlined,
  BulbOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

export default function NavMenu({ vertical = false }) {
  const { pathname } = useLocation();

  return (
    <Affix offsetTop={0}>
      <Menu
        mode={vertical ? 'inline' : 'horizontal'}
        selectedKeys={
          pathname === '/'
            ? '/'
            : pathname === '/tasks'
              ? ['tasks-all']
              : pathname.split('/')
        }
        defaultOpenKeys={['tasks']}
        style={{ minWidth: 0, flex: 'auto' }}
        items={[
          {
            key: '/',
            title: 'Home',
            label: <Link to='/'>Home</Link>,
            icon: <HomeOutlined />,
          },
          {
            key: 'tasks',
            title: 'Tasks',
            label: 'Tasks',
            icon: <CheckSquareOutlined />,
            children: [
              {
                key: 'tasks-all',
                title: 'All tasks',
                label: <Link to='/tasks'>All tasks</Link>,
              },
              {
                key: 'review',
                title: 'To review',
                label: <Link to='/tasks/review'>To review</Link>,
              },
              {
                key: 'mine',
                title: 'My tasks',
                label: <Link to='/tasks/mine'>My tasks</Link>,
              },
            ],
          },
          {
            key: 'rules',
            title: 'Rules',
            label: <Link to='/rules'>Rules</Link>,
            icon: <FileTextOutlined />,
          },
          {
            key: 'tools',
            title: 'Tools',
            label: 'Tools',
            icon: <ToolOutlined />,
            children: [
              {
                key: 'scene-negotiation',
                title: 'Scene Negotiation',
                label: (
                  <Link to='/tools/scene-negotiation'>Scene Negotiation</Link>
                ),
                icon: <FileDoneOutlined />,
              },
            ],
          },
          {
            key: 'about',
            title: 'About',
            label: 'About',
            icon: <BulbOutlined />,
            children: [
              {
                key: 'info',
                title: 'Information',
                label: <Link to='/about/info'>Information</Link>,
                icon: <InfoCircleOutlined />,
              },
              {
                key: 'faq',
                title: 'FAQ',
                label: <Link to='/about/faq'>FAQ</Link>,
                icon: <QuestionCircleOutlined />,
              },
            ],
          },
        ]}
      />
    </Affix>
  );
}
