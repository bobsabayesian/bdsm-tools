import React from 'react';
import { Typography, Collapse, Divider } from 'antd';
import PageHeader from '../components/PageHeader';
import IssueLink from './IssueLink';
import useAnalytics from '../hooks/useAnalytics';

export default function Entry() {
  useAnalytics('About');
  return (
    <React.Fragment>
      <PageHeader title='About The Compliance Ledger' />
      <Typography>
        <Typography.Title level={4}>Our Core Philosophy</Typography.Title>
        <Typography.Paragraph>
          Most digital tools in modern relationships are designed to keep you
          staring at a screen. <b>The Compliance Ledger</b> operates on the
          exact opposite premise:{' '}
          <b>
            the app&rsquo;s ultimate goal is to become completely useless as
            quickly as possible.
          </b>
        </Typography.Paragraph>
        <Typography.Paragraph>
          We believe that technology should never replace real-world connection.
          Instead, the Ledger serves as a high-friction, highly structured
          sandbox designed to do one thing:{' '}
          <b>drive you back into offline, in-person communication.</b>
        </Typography.Paragraph>
        <Typography.Paragraph>
          By handling the awkwardness of boundary negotiations,
          micro-permissions, and task tracking digitally, we eliminate the
          mental load of day-to-day negotiation so that when you are together,
          the screen goes away and the dynamic takes over.
        </Typography.Paragraph>

        <Divider />
        <Typography.Title level={4}>The Paradox of Control</Typography.Title>
        <Typography.Paragraph>
          In a healthy D/s dynamic, power isn&rsquo;t a blunt
          instrument&mdash;it is a carefully calibrated architecture. The
          Compliance Ledger is built around a foundational design principle:
        </Typography.Paragraph>
        <ul>
          <li>
            <b>
              The Submissive has absolute control <i>over</i> the dynamic.
            </b>{' '}
            Through our comprehensive, granular boundaries checklist (
            <i>&ldquo;What&rsquo;s in bounds?&rdquo;</i>), the submissive
            partner acts as the sole architect of the system&rsquo;s guardrails.
            You define every anatomical zone, every toy, every physical space,
            and every psychological kink that is permitted to exist. If you
            haven’t ticked it, it can’t be assigned: hard limits are blocked
            outright, and a soft limit can only be assigned once the Dominant
            attests that you have talked about it. You control the boundaries of
            the sandbox.
          </li>
          <li>
            <b>
              The Dominant has control <i>within</i> the dynamic.
            </b>{' '}
            Once the boundaries are in place, the Dominant takes the wheel.
            Within that perimeter, they set the rules, assign the tasks, and
            keep track of how it’s going. Boundaries can be changed at any time,
            and either partner can pause or end the dynamic whenever they need
            to, no questions asked.
          </li>
        </ul>
        <Typography.Paragraph>
          By separating <b>meta-control</b> (setting the rules of engagement)
          from <b>operational control</b> (executing the dynamic within those
          rules), we eliminate guesswork, anxiety, and boundary
          violations&mdash;leaving room for trust.
        </Typography.Paragraph>

        <Divider />
        <Typography.Title level={4}>How It Works</Typography.Title>
        <ol>
          <li>
            <b>Establish the Perimeter:</b> Both partners meticulously define
            their boundaries using our exhaustive anatomical, spatial, and
            psychological checklists.
          </li>
          <li>
            <b>Automate the Friction:</b> The system generates daily protocols,
            verification requirements, and tasks drawn <i>only</i> from
            pre-approved parameters. No surprises, no accidental boundary
            crossings.
          </li>
          <li>
            <b>Execute in the Real World:</b> Use the app to log your
            compliance, submit your required photo/video/text verification, and
            keep the momentum going when you&rsquo;re apart.
          </li>
          <li>
            <b>Close the App:</b> Meet in person. Let the real dynamic begin.
          </li>
        </ol>
        <Typography.Paragraph>
          <i>
            The Compliance Ledger: Because true surrender requires absolute
            clarity, and the best part of an app is closing it.
          </i>
        </Typography.Paragraph>
      </Typography>
      <Collapse
        activeKey={['datapolicy', 'donate', 'contactus']}
        bordered={false}
        expandIcon={() => null}
        expandIconPosition='right'
      >
        <Collapse.Panel key='datapolicy' header='Data Policy'>
          <Typography>
            <Typography.Paragraph>
              Any data stored by this site is not personally identifiable unless
              the data you enter personally identifies you. If you want any of
              your data to be removed from the site I am happy to do that.
              Please raise an issue here: <IssueLink />
            </Typography.Paragraph>
            <Typography.Paragraph></Typography.Paragraph>
          </Typography>
        </Collapse.Panel>
        {/*<Collapse.Panel key="donate" header="Donate">*/}
        {/*  <Typography>*/}
        {/*    <Typography.Paragraph>*/}
        {/*      Please consider donating to me if you use any of the tools on this site. I do this*/}
        {/*      in my own time and not paid for it.*/}
        {/*    </Typography.Paragraph>*/}
        {/*  </Typography>*/}
        {/*</Collapse.Panel>*/}
        <Collapse.Panel key='contactus' header='Contact Us'>
          <Typography>
            <Typography.Paragraph>
              If you have an idea for a tool that can be added to this site, I'd
              be happy to hear it. Even if it's just an idea. Please raise an
              issue here: <IssueLink />
            </Typography.Paragraph>
            <Typography.Paragraph>
              {`If you wish to contact me for any other reason relating to this site
              you can email: `}
              <Typography.Link href='mailto:keepsafemaster@gmail.com'>
                keepsafemaster@gmail.com
              </Typography.Link>
            </Typography.Paragraph>
          </Typography>
        </Collapse.Panel>
      </Collapse>
    </React.Fragment>
  );
}
