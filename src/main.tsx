import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

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
