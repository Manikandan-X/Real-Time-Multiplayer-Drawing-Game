import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import App from './App';
import { ToastProvider } from './components/ToastProvider';
import { theme } from './theme';
import './index.css';

// <StrictMode> is intentionally not used: in development it mounts every
// effect twice, which would open (and immediately close) a second game socket
// and make the server announce a phantom disconnect/reconnect.
createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <ToastProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ToastProvider>
  </ThemeProvider>,
);
