import React from 'react';
import * as ReactDOM from 'react-dom/client';
import './style/index.less';
import Application from './Application';

if (process.env.VERSION !== 'development') {
  const { protocol } = window.location;
  if (protocol !== 'https:') {
    window.location.protocol = 'https:';
  }
}

// The typeface: connect early, and show text in a fallback until it arrives
for (const [rel, href, crossOrigin] of [
  ['preconnect', 'https://fonts.googleapis.com'],
  ['preconnect', 'https://fonts.gstatic.com', 'anonymous'],
  [
    'stylesheet',
    'https://fonts.googleapis.com/css2?family=Jost:wght@400;500;700&display=swap',
  ],
]) {
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (crossOrigin) link.crossOrigin = crossOrigin;
  document.head.appendChild(link);
}

const rootElement = document.createElement('div');
rootElement.id = 'application-root-node';
rootElement.className = 'app-root';
document.body.appendChild(rootElement);

const root = ReactDOM.createRoot(rootElement);

root.render(<Application />);
