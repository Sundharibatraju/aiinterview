import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationProvider } from './context/NotificationContext';

// Intercept unhandled promise rejections and log/notify gracefully without breaking the UI
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Caught unhandled promise rejection:', event.reason);
  // Prevent browser default popups or console crash behavior
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </ErrorBoundary>
  </StrictMode>,
);

