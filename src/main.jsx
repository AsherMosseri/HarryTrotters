import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { reloadOnceForNewVersion } from './data/store.js';
import UpdateGate from './components/UpdateGate.jsx';
import './styles.css';
import { installEmojiKeyFix } from './emojiKeyFix.js';

installEmojiKeyFix();

window.addEventListener('vite:preloadError', (e) => {
  if (reloadOnceForNewVersion()) e.preventDefault();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UpdateGate>
      <App />
    </UpdateGate>
  </StrictMode>,
);
