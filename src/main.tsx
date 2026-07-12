import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { configureLoanLenderFeature } from '@/lib/features/loanLender';
import { activeLoanLenderFeature } from '@/lib/features/loanLender/active';
import { configureResearchUpgradeFeature } from '@/lib/features/researchUpgrade';
import { activeResearchUpgradeFeature } from '@/lib/features/researchUpgrade/active';
import { configureAdminFeature } from '@/lib/features/admin';
import { activeAdminFeature } from '@/lib/features/admin/active';

configureLoanLenderFeature(activeLoanLenderFeature);
configureResearchUpgradeFeature(activeResearchUpgradeFeature);
configureAdminFeature(activeAdminFeature);

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
