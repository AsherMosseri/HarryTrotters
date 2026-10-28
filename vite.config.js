import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { CHANGELOG } from './src/changelog.js';

// Each build has two ids, baked into the app and published in version.json
// (with the version log), so open pages can tell what's been deployed:
// - CODE_ID changes with every build. Open pages load it quietly the next
//   time the app is in the background (UpdateGate), with no update screen.
// - BUILD_ID is the release: on GitHub, the commit that last changed the
//   version log. Open pages show the update screen only when it changes, so a
//   change that isn't in the version log ships without one.
const CODE_ID = (process.env.GITHUB_SHA || '').slice(0, 12) || Date.now().toString(36);
function lastLogCommit() {
  try {
    return execSync('git log -1 --format=%H -- src/changelog.js', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .slice(0, 12);
  } catch {
    return '';
  }
}
const BUILD_ID = (process.env.GITHUB_SHA && lastLogCommit()) || CODE_ID;

const versionFile = {
  name: 'version-file',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: BUILD_ID, code: CODE_ID, release: CHANGELOG[0].version, changelog: CHANGELOG }),
    });
  },
};

// Relative base so the build works at any GitHub Pages path.
export default defineConfig({
  plugins: [react(), versionFile],
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __CODE_ID__: JSON.stringify(CODE_ID) },
  build: { chunkSizeWarningLimit: 900 },
});
