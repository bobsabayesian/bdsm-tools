import React from 'react';
import { Typography } from 'antd';
import PageHeader from '../components/PageHeader';
import useAnalytics from '../hooks/useAnalytics';

export default function ComingSoon() {
  useAnalytics('Scene Negotiation');
  return (
    <>
      <PageHeader title='Scene Negotiation' />
      <Typography.Paragraph>Coming soon.</Typography.Paragraph>
    </>
  );
}
