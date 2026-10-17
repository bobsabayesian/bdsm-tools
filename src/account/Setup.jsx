import React from 'react';
import { Alert, Button, Spin } from 'antd';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import api from '../services/account-api';
import useAccount from '../state/useAccount';
import BodyPartsStep from './BodyPartsStep';
import KinksStep from './KinksStep';

const STEP_SCREENS = { bodyParts: BodyPartsStep, kinks: KinksStep };

/**
 * /account/setup runs through the steps that have not been finished or
 * skipped, one screen each. /account/setup/<step> opens a single step to
 * change it later.
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

  // Which screen to show: the one asked for, or the first not yet dealt with
  const current = step ?? profile.nextStep;
  const Screen = STEP_SCREENS[current];
  const available = profile.steps.some((s) => s.id === current);
  if (!Screen || !available) return <Navigate to='/account' replace />;

  // When a step is done, carry on to the next unfinished one - or, when a single
  // step was opened to change it, go back
  const onDone = () => {
    if (step) return navigate('/account');
    return api.getProfile().then((latest) => {
      if (latest.nextStep) setProfile(latest);
      else navigate('/account');
    });
  };

  return <Screen key={current} onDone={onDone} />;
}
