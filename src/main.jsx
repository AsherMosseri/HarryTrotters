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
import { installAnim } from './motion.js';
import { registerOffline } from './offline.js';

installEmojiKeyFix();
installKeyboardFit();
installNoPageZoom();
installAnim();
registerOffline();

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
