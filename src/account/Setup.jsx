import React from 'react';
import { Alert, Button, Spin } from 'antd';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import api from '../services/account-api';
import useAccount from '../state/useAccount';
import BodyPartsStep from './BodyPartsStep';
import BoundsStep from './BoundsStep';
import NameStep from './NameStep';
import KinksStep from './KinksStep';

// My Body is one screen; body & anatomy, clothing, items and spaces together are
// the next one, "What's in bounds?"
const STEP_SCREENS = {
  bodyParts: BodyPartsStep,
  boundsBody: BoundsStep,
  boundsClothing: BoundsStep,
  equipment: BoundsStep,
  boundsSpaces: BoundsStep,
  kinks: KinksStep,
};
const TAB_FOR_STEP = {
  bodyParts: 'body',
  boundsBody: 'bounds',
  boundsClothing: 'bounds',
  equipment: 'bounds',
  boundsSpaces: 'bounds',
  kinks: 'kinks',
};

/**
 * /account/setup walks a new person through the steps that have not been
 * finished or skipped, one screen each. Changing things later happens on the
 * About me page (/account/about).
 */
export default function Setup() {
  const navigate = useNavigate();
  const { step } = useParams();
  const { user, loaded, refresh } = useAccount();
  const [profile, setProfile] = React.useState(null);

  React.useEffect(() => {
    refresh();
  }, []);

  const loggedIn = !!user;
  React.useEffect(() => {
    if (loggedIn)
      api
        .getProfile()
        .then(setProfile)
        .catch(() => navigate('/account'));
  }, [loggedIn]);

  // Changing a single step later happens on the About me page
  if (step)
    return (
      <Navigate to={`/account/about/${TAB_FOR_STEP[step] ?? 'me'}`} replace />
    );

  if (!loaded || (user && !profile)) return <Spin size='large' />;
  if (!user) {
    return (
      <>
        <PageHeader title='Setting up' />
        <Alert type='info' title='Please log in to set up your profile.' />
        <Button style={{ marginTop: 16 }} onClick={() => navigate('/account')}>
          Log in
        </Button>
      </>
    );
  }

  // A display name comes first: nothing else works without one
  if (!profile.me.displayName)
    return (
      <NameStep
        onDone={() =>
          api
            .getProfile()
            .then(setProfile)
            .catch(() => {})
        }
      />
    );

  // Which screen to show: the one asked for, or the first not yet dealt with
  const current = profile.nextStep;
  const Screen = STEP_SCREENS[current];
  const available = profile.steps.some((s) => s.id === current);
  if (!Screen || !available) return <Navigate to='/account' replace />;

  // When a step is done, carry on to the next unfinished one
  const onDone = () =>
    api.getProfile().then((latest) => {
      if (latest.nextStep) setProfile(latest);
      else navigate('/account');
    });

  return <Screen key={current} onDone={onDone} />;
}
