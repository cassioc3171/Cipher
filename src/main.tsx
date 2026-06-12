import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Bootstrap i18n before React renders so the first paint has the right locale
// and the right <html lang>/<html dir>. The side effects of the import set up
// the global i18next instance.
import './i18n';
import './tutorial/tutorial.css';
import { TutorialProvider } from './tutorial/TutorialContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TutorialProvider>
      <App />
    </TutorialProvider>
  </StrictMode>,
);
