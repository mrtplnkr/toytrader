import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './tailwind.css';
import './i18n';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <App />
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Registers the service worker (src/service-worker.ts) for offline support
// and installability - no-ops outside production builds, see
// serviceWorkerRegistration.ts.
serviceWorkerRegistration.register();
