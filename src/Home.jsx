import React from 'react';
import { Typography, Divider, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import useAnalytics from './hooks/useAnalytics';

export default function Home() {
  useAnalytics('Home');
  const navigate = useNavigate();
  return (
    <div style={{ marginTop: 30 }}>
      <Typography>
        <Typography.Title level={2}>The Compliance Ledger</Typography.Title>
        <Typography.Paragraph style={{ maxWidth: 500 }}>
          Manage your dynamic.
        </Typography.Paragraph>
      </Typography>
      <Divider orientation='left' style={{ marginTop: 50 }}>
        Featured Tools
      </Divider>
      <div className='flex'>
        <Button
          size='large'
          style={{ marginRight: 40 }}
          onClick={() => navigate('/tools/scene-negotiation')}
        >
          Scene Negotiations
        </Button>
      </div>
    </div>
  );
}
