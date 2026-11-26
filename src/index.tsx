import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './tailwind.css';
import './i18n';
import App from './App';
import ErrorBoundary from './components/errorBoundary';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Registers the service worker (src/service-worker.ts) for offline support
// and installability - no-ops outside production builds, see
// serviceWorkerRegistration.ts. Without onUpdate, a newly deployed version
// would just sit "waiting" forever - the old one keeps serving every open
// tab until the user manually closes all of them, which is why a version
// bump on github could ship and still show the old number for days. Instead,
// tell the waiting worker to activate immediately (service-worker.ts already
// listens for this message) and reload once it takes over.
if ('serviceWorker' in navigator) {
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });
}

serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  },
});
