import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { configureLoanLenderFeature } from '@/lib/features/loanLender';
import { activeLoanLenderFeature } from '@/lib/features/loanLender/active';
import { configureResearchUpgradeFeature } from '@/lib/features/researchUpgrade';
import { activeResearchUpgradeFeature } from '@/lib/features/researchUpgrade/active';
import { configureAdminFeature } from '@/lib/features/admin';

configureLoanLenderFeature(activeLoanLenderFeature);
configureResearchUpgradeFeature(activeResearchUpgradeFeature);
const Root = import.meta.env.PROD ? (
  <React.StrictMode>
    <App />
  </React.StrictMode>
) : (
  <App />
);

async function bootstrap(): Promise<void> {
  if (import.meta.env.DEV) {
    const { activeAdminFeature } = await import('@/lib/features/admin/active');
    configureAdminFeature(activeAdminFeature);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(Root);
}

void bootstrap();
