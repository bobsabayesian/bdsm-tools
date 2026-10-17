import React from 'react';
import { Typography, Collapse } from 'antd';
import PageHeader from '../components/PageHeader';
import IssueLink from './IssueLink';
import useAnalytics from '../hooks/useAnalytics';

export default function Faq() {
  useAnalytics('FAQ');
  return (
    <React.Fragment>
      <PageHeader title='FAQ' />
      <Collapse bordered={false}>
        <Collapse.Panel key='1' header='How can I report a bug with the site?'>
          <Typography>
            <Typography.Paragraph>
              You can report bugs to me here: <IssueLink />
            </Typography.Paragraph>
          </Typography>
        </Collapse.Panel>
        <Collapse.Panel key='2' header='How can I ask for a new tool?'>
          <Typography>
            <Typography.Paragraph>
              You can ask me to implement a new tool or feature here:{' '}
              <IssueLink />
            </Typography.Paragraph>
          </Typography>
        </Collapse.Panel>
        {/*<Collapse.Panel key="3" header="This site is cool, do you accept donations?">*/}
        {/*  <Typography>*/}
        {/*    <Typography.Paragraph>*/}
        {/*      Yes, I graciously accept donations. You can donate to me here:*/}
        {/*    </Typography.Paragraph>*/}
        {/*  </Typography>*/}
        {/*</Collapse.Panel>*/}
      </Collapse>
    </React.Fragment>
  );
}
