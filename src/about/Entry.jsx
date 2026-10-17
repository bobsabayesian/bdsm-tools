import React from 'react';
import { Typography, Collapse, Divider } from 'antd';
import { useLocation } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import ContactForm from './ContactForm';
import useAnalytics from '../hooks/useAnalytics';

export default function Entry() {
  useAnalytics('About');
  const { hash } = useLocation();

  // "Data policy" links in the footer come straight to its section
  React.useEffect(() => {
    if (!hash) return;
    document
      .getElementById(hash.slice(1))
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

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
          <Typography id='data-policy' style={{ maxWidth: 680 }}>
            <Typography.Paragraph>
              Short version: you choose what goes in, you choose who sees it,
              and you can take it out again.
            </Typography.Paragraph>
            <Typography.Title level={5}>What is stored</Typography.Title>
            <ul>
              <li>
                Your <b>username</b> and a <b>password</b> (kept only in a form
                that can&rsquo;t be turned back into the password), plus a
                recovery code kept the same way. No email address and no real
                name are needed.
              </li>
              <li>
                What you add to your <b>profile</b>: display name, pronouns,
                what you tick in body parts and what&rsquo;s in bounds, and how
                you rate each kink.
              </li>
              <li>
                What happens inside a <b>dynamic</b>: tasks, rules, comments,
                pauses, and anything submitted as proof &mdash; text, numbers,
                photos, video, audio, or a location.
              </li>
              <li>
                Messages sent from the contact form below (each has a private
                link for the conversation), and when you were last active (your
                partner sees that, as a rough &ldquo;last active&rdquo;).
              </li>
            </ul>
            <Typography.Title level={5}>Who can see it</Typography.Title>
            <Typography.Paragraph>
              Only the person you&rsquo;re in a dynamic with, and only after you
              confirm that you&rsquo;re sharing your profile. They never see
              your username or any other dynamic you&rsquo;re in. The person who
              runs this site can technically read the database, so keep anything
              you wouldn&rsquo;t want them to see out of free-text fields.
            </Typography.Paragraph>
            <Typography.Title level={5}>How long it is kept</Typography.Title>
            <Typography.Paragraph>
              For each kind of proof, you set how many days (at least one) your
              partner can see what you submit. After that it&rsquo;s hidden from
              them, and it&rsquo;s deleted for good once the longer of seven
              days or your number has passed. Photos, video and audio are
              deleted with it. A file you upload but never submit is removed
              within a day or so.
            </Typography.Paragraph>
            <Typography.Title level={5}>Taking it out</Typography.Title>
            <Typography.Paragraph>
              Either of you can pause or end a dynamic at any time. Deleting
              your account (My account, then Delete account) ends all of your
              dynamics and removes your profile and login straight away. What
              you submitted for tasks is deleted on the schedule above. The
              wording of tasks, rules and comments from ended dynamics can no
              longer be seen by anyone, but isn&rsquo;t erased automatically:
              ask for that below with &ldquo;Remove my data&rdquo; and it will
              be done.
            </Typography.Paragraph>
            <Typography.Title level={5}>Cookies and analytics</Typography.Title>
            <Typography.Paragraph>
              A cookie keeps you logged in. The site also uses Google Analytics
              to count page views (which page, roughly where from, on what kind
              of device). It isn&rsquo;t told your username or anything you type
              here.
            </Typography.Paragraph>
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
          <Typography.Paragraph style={{ maxWidth: 560 }} id='contact'>
            A question, a problem, an idea, or a request to remove your data. It
            goes straight to whoever runs the site.
          </Typography.Paragraph>
          <ContactForm />
        </Collapse.Panel>
      </Collapse>
    </React.Fragment>
  );
}
