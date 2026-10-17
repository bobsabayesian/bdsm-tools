import React from 'react';
import { Alert, Badge, Button, Spin, Tabs, Typography } from 'antd';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import api from '../services/account-api';
import useAccount from '../state/useAccount';
import BodyPartsStep from './BodyPartsStep';
import BoundsStep from './BoundsStep';
import KinksStep from './KinksStep';
import MeSection from './MeSection';

const TABS = [
  { key: 'me', label: 'Me', Section: MeSection },
  { key: 'body', label: 'My Body', Section: BodyPartsStep },
  { key: 'bounds', label: "What's in bounds?", Section: BoundsStep },
  { key: 'kinks', label: 'My Kinks', Section: KinksStep, needs: 'kinks' },
];

/**
 * "About me": the permanent home of everything in a person's profile, one tab
 * each. It is exactly what the people in their dynamics see (read-only, in
 * PartnerProfile) - nothing here is hidden from them.
 */
export default function About() {
  const navigate = useNavigate();
  const { tab } = useParams();
  const { user, loaded, refresh } = useAccount();
  const [steps, setSteps] = React.useState(null);
  const [dirty, setDirty] = React.useState({});

  React.useEffect(() => {
    refresh();
  }, []);

  const loggedIn = !!user;
  React.useEffect(() => {
    if (loggedIn) {
      api
        .getProfile()
        .then((profile) => setSteps(profile.steps.map((s) => s.id)))
        .catch(() => navigate('/account'));
    }
  }, [loggedIn]);

  // Closing the tab or reloading with unsaved changes asks first
  const unsaved = Object.values(dirty).some(Boolean);
  React.useEffect(() => {
    if (!unsaved) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  if (!loaded || (user && !steps)) return <Spin size='large' />;
  if (!user) {
    return (
      <>
        <PageHeader title='About me' />
        <Alert type='info' title='Please log in to see your profile.' />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/account')}>
          Log in
        </Button>
      </>
    );
  }

  const visible = TABS.filter((t) => !t.needs || steps.includes(t.needs));
  if (!tab) return <Navigate to='/account/about/me' replace />;
  // "What's in bounds?" replaced My Equipment
  if (tab === 'equipment') {
    return <Navigate to='/account/about/bounds' replace />;
  }
  if (!visible.some((t) => t.key === tab)) {
    return <Navigate to='/account/about/me' replace />;
  }

  return (
    <>
      <PageHeader title='About me' />
      <Typography.Paragraph type='secondary' style={{ maxWidth: 640 }}>
        This is what the people you&rsquo;re in a dynamic with see about you
        &mdash; nothing here is hidden from them. Each tab saves on its own.
      </Typography.Paragraph>
      <Tabs
        activeKey={tab}
        onChange={(key) => navigate(`/account/about/${key}`)}
        items={visible.map(({ key, label, Section }) => ({
          key,
          label: (
            <Badge dot={!!dirty[key]} offset={[6, 0]} title='Unsaved changes'>
              {label}
            </Badge>
          ),
          children: (
            <Section
              embedded
              onDirty={(isDirty) =>
                setDirty((old) =>
                  old[key] === isDirty ? old : { ...old, [key]: isDirty },
                )
              }
            />
          ),
        }))}
      />
    </>
  );
}
