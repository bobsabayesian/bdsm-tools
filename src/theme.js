import { theme } from 'antd';
import { DARK } from './state/useTheme';

const SHARED = {
  colorPrimary: '#d71616',
  fontFamily: "'Jost', system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontSize: 15,
  lineHeight: 1.6,
  borderRadius: 4,
  controlHeight: 38,
  padding: 20,
  paddingLG: 28,
  paddingXL: 40,
  margin: 20,
  marginLG: 28,
  marginXL: 40,
};

// Red means the brand and the main action in both themes; links are plain and
// destructive actions are orange, so a red button always means "go ahead".
const PALETTE = {
  dark: {
    algorithm: theme.darkAlgorithm,
    token: {
      colorLink: '#e8e8e8',
      colorLinkHover: '#ffffff',
      colorError: '#f0803c',
      colorTextSecondary: 'rgba(255, 255, 255, 0.7)',
      colorTextTertiary: 'rgba(255, 255, 255, 0.58)',
      colorBgLayout: '#1f1f1f',
      colorBgContainer: '#262626',
      colorBorder: '#3a3a3a',
      colorBorderSecondary: '#2f2f2f',
    },
    bar: '#1a1a1a',
  },
  light: {
    algorithm: theme.defaultAlgorithm,
    token: {
      colorLink: '#262626',
      colorLinkHover: '#000000',
      colorError: '#c2570c',
      colorTextSecondary: 'rgba(0, 0, 0, 0.68)',
      colorTextTertiary: 'rgba(0, 0, 0, 0.56)',
      colorBgLayout: '#f5f5f5',
      colorBgContainer: '#ffffff',
      colorBorder: '#d6d6d6',
      colorBorderSecondary: '#e8e8e8',
    },
    bar: '#ffffff',
  },
};

/** The ConfigProvider theme for 'dark' or 'light' */
export const themeFor = (mode) => {
  const { algorithm, token, bar } = PALETTE[mode === DARK ? 'dark' : 'light'];
  return {
    algorithm,
    token: { ...SHARED, ...token },
    components: {
      Layout: {
        headerBg: bar,
        siderBg: bar,
        triggerBg: bar,
        headerHeight: 64,
        headerPadding: '0 24px',
      },
      Menu: { itemHeight: 44, itemBg: bar, subMenuItemBg: bar },
      Card: { headerFontSize: 16 },
    },
  };
};
