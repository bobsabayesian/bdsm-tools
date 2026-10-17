import React from 'react';
import { Typography, Collapse } from 'antd';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import useAnalytics from '../hooks/useAnalytics';

const contact = <Link to='/about/info#contact'>Contact Us</Link>;

export default function Faq() {
  useAnalytics('FAQ');
  return (
    <React.Fragment>
      <PageHeader title='FAQ' />
      <Collapse bordered={false}>
        <Collapse.Panel
          key='1'
          header='How can I report a problem with the site?'
        >
          <Typography>
            <Typography.Paragraph>
              Use {contact} and choose &ldquo;Report a problem&rdquo;. You get a
              private link to the conversation, so you can see the answer and
              reply.
            </Typography.Paragraph>
          </Typography>
        </Collapse.Panel>
        <Collapse.Panel key='2' header='How can I ask for a new feature?'>
          <Typography>
            <Typography.Paragraph>
              Use {contact} and choose &ldquo;A suggestion&rdquo;. Even a rough
              idea is welcome.
            </Typography.Paragraph>
          </Typography>
        </Collapse.Panel>
        <Collapse.Panel key='3' header='What if I am locked out of my account?'>
          <Typography>
            <Typography.Paragraph>
              There is no email address on your account, so there is no
              &ldquo;email me a link&rdquo;. You have two ways back in:
            </Typography.Paragraph>
            <ol>
              <li>
                <b>Your recovery code.</b> It was shown once when you created
                your account. On the log-in page, choose &ldquo;Forgot
                password&rdquo;, then enter your username, the code and a new
                password.
              </li>
              <li>
                <b>A reset code from the site owner.</b> If you have lost the
                recovery code too, write to us through {contact}. You will get a
                private link to a conversation (no account needed). Once we are
                sure it is you (see the next question), we send a one-time reset
                code in that conversation. It works once, for one hour, in the
                same &ldquo;Forgot password&rdquo; form.
              </li>
            </ol>
            <Typography.Paragraph>
              Using either code logs you out everywhere else and gives you a new
              recovery code. Everything in your account stays as it was.
            </Typography.Paragraph>
          </Typography>
        </Collapse.Panel>
        <Collapse.Panel
          key='4'
          header='How do you stop someone taking over my account?'
        >
          <Typography>
            <Typography.Paragraph>
              An account holds private things, so a reset is never handed out on
              someone&rsquo;s say-so. Before making a reset code we check two
              things:
            </Typography.Paragraph>
            <ul>
              <li>
                <b>Details from your account</b> that only you would know: the
                name and title you use in your dynamic, roughly when you joined,
                what you have done in it lately.
              </li>
              <li>
                <b>Your partner confirming it is you.</b> They message us from
                their own logged-in account (ticking &ldquo;include my
                username&rdquo; on the contact form), and we check that their
                dynamic really is with the person asking. If you are on your
                own, with no partner, we ask for more detail.
              </li>
            </ul>
            <Typography.Paragraph>
              If we cannot be sure it is you, we do not reset the account.
              Losing an account is better than giving your private life to the
              wrong person. Every reset is recorded, and the code is stored only
              as a hash, so nobody can read one back afterwards.
            </Typography.Paragraph>
          </Typography>
        </Collapse.Panel>
      </Collapse>
    </React.Fragment>
  );
}
