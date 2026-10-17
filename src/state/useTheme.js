import { create } from 'zustand';

const KEY = 'theme-mode';
export const DARK = 'dark';
export const LIGHT = 'light';

// Dark unless they chose light (storage can be blocked, so never rely on it)
const read = () => {
  try {
    return localStorage.getItem(KEY) === LIGHT ? LIGHT : DARK;
  } catch {
    return DARK;
  }
};

const PAGE_BG = { [DARK]: '#1f1f1f', [LIGHT]: '#f5f5f5' };

/** Tells the page and the browser which theme is showing */
const apply = (mode) => {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  root.style.setProperty('--page-bg', PAGE_BG[mode]);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', PAGE_BG[mode]);
};

const useTheme = create((set, get) => ({
  mode: read(),
  toggle: () => {
    const mode = get().mode === DARK ? LIGHT : DARK;
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // Not remembered, but it still changes for this visit
    }
    apply(mode);
    set({ mode });
  },
}));

/** Run once, before the first render, so nothing flashes the wrong colour */
export const initTheme = () => apply(useTheme.getState().mode);

export default useTheme;
