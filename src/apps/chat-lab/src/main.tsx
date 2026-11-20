import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted Poppins (bundled by Vite), so visitors' browsers never contact
// Google Fonts. Same weights/styles the Google Fonts link used to load.
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/400-italic.css';
import '@fontsource/poppins/500-italic.css';
import './index.css';
import App from './App.tsx';
import { setupPerfMarks } from './utils/perfMarks';

setupPerfMarks();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
