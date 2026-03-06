import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { configureBoardShareFeature } from '@/lib/features/boardShare';
import { activeBoardShareFeature } from '@/lib/features/boardShare/active';

configureBoardShareFeature(activeBoardShareFeature);

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
