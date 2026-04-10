import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// DEBUG: Log SDK environment at startup
console.log('[App DEBUG] ===== CSP CRM Starting =====');
console.log('[App DEBUG] window.__POWER_APPS_ENVIRONMENT__:', (window as any).__POWER_APPS_ENVIRONMENT__);
console.log('[App DEBUG] window.DATAVERSE_ENDPOINT:', (window as any).DATAVERSE_ENDPOINT);
console.log('[App DEBUG] window.Xrm:', (window as any).Xrm);
console.log('[App DEBUG] window.Xrm?.WebApi:', (window as any).Xrm?.WebApi);
import('./../.power/schemas/appschemas/dataSourcesInfo').then(m => {
  console.log('[App DEBUG] dataSourcesInfo keys:', Object.keys(m.dataSourcesInfo || {}));
  const ds = m.dataSourcesInfo?.commondataserviceforapps;
  if (ds) console.log('[App DEBUG] commondataserviceforapps: exists, apis:', Object.keys(ds.apis || {}).length);
  else console.log('[App DEBUG] commondataserviceforapps: MISSING');
}).catch(e => console.log('[App DEBUG] dataSourcesInfo load failed:', e));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
