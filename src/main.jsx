import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { reloadOnceForNewVersion } from './data/store.js';
import UpdateGate from './components/UpdateGate.jsx';
import { DialogHost } from './components/Dialogs.jsx';
import './styles.css';
import './shell.css';
import { installEmojiKeyFix } from './emojiKeyFix.js';
import { installKeyboardFit, installNoPageZoom } from './keyboard.js';

installEmojiKeyFix();
installKeyboardFit();
installNoPageZoom();

window.addEventListener('vite:preloadError', (e) => {
  if (reloadOnceForNewVersion()) e.preventDefault();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UpdateGate>
      <App />
    </UpdateGate>
    {/* Confirm, alert, and prompt pop-ups (Dialogs.jsx), from anywhere in the app. */}
    <DialogHost />
  </StrictMode>,
);
