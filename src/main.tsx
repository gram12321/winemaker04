import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import type { AdminFeature } from '@/lib/features/admin';

function Root({ adminFeature }: { adminFeature: AdminFeature | null }) {
  return import.meta.env.PROD ? (
    <React.StrictMode>
      <App adminFeature={adminFeature} />
    </React.StrictMode>
  ) : (
    <App adminFeature={adminFeature} />
  );
}

async function bootstrap(): Promise<void> {
  const adminFeature = import.meta.env.DEV
    ? (await import('@/lib/features/admin/feature')).adminFeature
    : null;

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <Root adminFeature={adminFeature} />
  );
}

void bootstrap();
