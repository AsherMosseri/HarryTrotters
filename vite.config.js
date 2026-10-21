import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { CHANGELOG } from './src/changelog.js';

// Each build gets an id. It's baked into the app and also published as
// version.json (with the version log), so open pages can tell when a newer
// version has been deployed and say what's in it.
const BUILD_ID = (process.env.GITHUB_SHA || '').slice(0, 12) || Date.now().toString(36);

const versionFile = {
  name: 'version-file',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: BUILD_ID, release: CHANGELOG[0].version, changelog: CHANGELOG }),
    });
  },
};

// Relative base so the build works at any GitHub Pages path.
export default defineConfig({
  plugins: [react(), versionFile],
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  build: { chunkSizeWarningLimit: 900 },
});
