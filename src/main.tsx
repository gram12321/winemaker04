import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { configureResearchUpgradeFeature } from '@/lib/features/researchUpgrade';
import { activeResearchUpgradeFeature } from '@/lib/features/researchUpgrade/active';

configureResearchUpgradeFeature(activeResearchUpgradeFeature);

const Root = import.meta.env.PROD ? (
  <React.StrictMode>
    <App />
  </React.StrictMode>
) : (
  <App />
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  Root,
)
