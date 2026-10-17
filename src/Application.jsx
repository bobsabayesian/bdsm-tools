import React from 'react';
import {
  App,
  ConfigProvider,
  Layout,
  Spin,
  Button,
  Result,
  Alert,
  theme,
} from 'antd';
import moment from 'moment';
import { useLocalStorageState } from 'ahooks';
import {
  BrowserRouter as Router,
  Routes as Routing,
  Route,
  Outlet,
  useLocation,
  useMatch,
} from 'react-router-dom';
import ReactGA from 'react-ga4';
import { BrowserView, isMobile } from 'react-device-detect';
import Header from './Header';
import NavMenu from './NavMenu';
import ConsentModal from './components/ConsentModal';
import { convertMongoTimestamp } from './util';
import UpdateChecker from './UpdateChecker';
import api from './services/feature-flag-api';
import ComingSoon from './scene-negotiation/ComingSoon';
import MobileUserWarning from './components/MobileUserWarning';
import Landing from './landing/Landing';
import { themeFor } from './theme';
import useTheme from './state/useTheme';
import useAccount from './state/useAccount';

ReactGA.initialize('G-SKBSEEBLCP');

const AdminEntry = React.lazy(
  () => import(/* webpackChunkName: "Admin" */ './admin/Entry'),
);

const AccountEntry = React.lazy(
  () => import(/* webpackChunkName: "Account" */ './account/Entry'),
);

const RulesEntry = React.lazy(
  () => import(/* webpackChunkName: "Tasks" */ './tasks/Rules'),
);

const ThreadEntry = React.lazy(
  () => import(/* webpackChunkName: "About" */ './about/Thread'),
);
const ToReviewEntry = React.lazy(
  () => import(/* webpackChunkName: "Tasks" */ './tasks/ToReview'),
);
const ConsequencesEntry = React.lazy(
  () => import(/* webpackChunkName: "Tasks" */ './tasks/Consequences'),
);
const MyTasksEntry = React.lazy(
  () => import(/* webpackChunkName: "Tasks" */ './tasks/MyTasks'),
);
const TasksEntry = React.lazy(
  () => import(/* webpackChunkName: "Tasks" */ './tasks/Tasks'),
);

const AboutMeEntry = React.lazy(
  () => import(/* webpackChunkName: "Account" */ './account/About'),
);

const SetupEntry = React.lazy(
  () => import(/* webpackChunkName: "Account" */ './account/Setup'),
);

const DynamicView = React.lazy(
  () => import(/* webpackChunkName: "Account" */ './account/DynamicView'),
);

const AboutEntry = React.lazy(
  () =>
    import(
      /* webpackChunkName: "About", webpackPrefetch: true */ './about/Entry'
    ),
);

const FaqEntry = React.lazy(
  () =>
    import(/* webpackChunkName: "FAQ", webpackPrefetch: true */ './about/Faq'),
);

const Home = React.lazy(
  () => import(/* webpackChunkName: "Home", webpackPrefetch: true */ './Home'),
);

export default function Application() {
  return (
    <Router>
      <Routing>
        <Route path='/' element={<ConsentModal />} />
      </Routing>
      <Routing>
        <Route path='/' element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path='admin' element={<AdminEntry />} />
          <Route path='account' element={<AccountEntry />} />
          <Route path='tasks' element={<TasksEntry />} />
          <Route path='tasks/review' element={<ToReviewEntry />} />
          <Route path='tasks/mine' element={<MyTasksEntry />} />
          <Route path='tasks/consequences' element={<ConsequencesEntry />} />
          <Route path='rules' element={<RulesEntry />} />
          <Route path='account/about' element={<AboutMeEntry />} />
          <Route path='account/about/:tab' element={<AboutMeEntry />} />
          <Route path='account/setup' element={<SetupEntry />} />
          <Route path='account/setup/:step' element={<SetupEntry />} />
          <Route path='account/dynamics/:id' element={<DynamicView />} />
          <Route path='contact/:token' element={<ThreadEntry />} />
          <Route path='about/faq' element={<FaqEntry />} />
          <Route path='about/info' element={<AboutEntry />} />
          <Route path='tools' element={<FeatureFlagLayout />}>
            <Route path='scene-negotiation' element={<ComingSoon />} />
          </Route>
        </Route>
      </Routing>
    </Router>
  );
}

function AppLayout() {
  const mode = useTheme((state) => state.mode);
  const { pathname } = useLocation();
  const { user, loaded, refresh } = useAccount();

  React.useEffect(() => {
    refresh();
  }, []);

  // Someone who is not logged in lands on a page of their own, outside the app's frame
  if (pathname === '/') {
    if (!loaded)
      return (
        <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }} />
      );
    if (!user) return <Landing />;
  }

  return (
    <ConfigProvider theme={themeFor(mode)}>
      <App>
        <a href='#main-content' className='skip-link'>
          Skip to content
        </a>
        <Layout className='fullpage hideoverflow'>
          <Layout.Header className='header'>
            <Header />
          </Layout.Header>
          <Layout.Content className='fullpage-w' style={{ paddingTop: 64 }}>
            <Layout>
              <Layout.Sider width={250} collapsible collapsed={isMobile}>
                <NavMenu vertical />
              </Layout.Sider>
              <Layout.Content
                className='content'
                id='main-content'
                tabIndex={-1}
              >
                <React.Suspense fallback={<Spin size='large' />}>
                  <Alert.ErrorBoundary>
                    <Outlet />
                  </Alert.ErrorBoundary>
                </React.Suspense>
              </Layout.Content>
            </Layout>
          </Layout.Content>
        </Layout>
        <UpdateChecker />
        <MobileUserWarning />
      </App>
    </ConfigProvider>
  );
}

function FeatureFlagLayout() {
  const { params } = useMatch('/tools/:id/*');

  const [id, setId] = React.useState(null);
  const [flag, setFlag] = React.useState(null);

  const [isDev] = useLocalStorageState('__dev__', {
    defaultValue: false,
  });
  const error = (e) => {
    console.error(e);
    setFlag({
      enabled: false,
      lastChanged: moment(),
      reason:
        'An error occurred when fetching this feature flag. Check the console for more details.',
    });
  };

  const check = (cache) => {
    ReactGA.event('feature_flag_check', { feature: params.id, cache });

    setFlag(null);
    if (cache) {
      return api.getFeatureFlag(params.id).then(setFlag).catch(error);
    }
    return api.getFeatureFlagNoCache(params.id).then(setFlag).catch(error);
  };

  React.useEffect(() => {
    setId(null);
    check(true).then(() => setId(params.id));
  }, [params.id]);

  if (!flag || id !== params.id) return <Spin size='large' />;
  if (flag.enabled) return <Outlet />;

  const time = convertMongoTimestamp(flag.lastChanged).format(
    'Do MMMM YYYY [at] hh:mm:ss',
  );
  return (
    <Result
      status='error'
      title='This feature has been disabled'
      subTitle={`The feature has been disabled since the ${time}. The reason given is: ${flag.reason}`}
      extra={[
        <Button key='check-again' onClick={() => check(false)}>
          Check again
        </Button>,
        isDev && (
          <Button key='bypass' onClick={() => setFlag({ enabled: true })}>
            Bypass
          </Button>
        ),
      ]}
    />
  );
}
