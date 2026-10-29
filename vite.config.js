import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { CHANGELOG } from './src/changelog.js';

// Each build has two ids, baked into the app and published in version.json
// (with the version log), so open pages can tell what's been deployed:
// - CODE_ID changes with every build. Open pages load it quietly the next
//   time the app is in the background (UpdateGate), with no update screen.
// - BUILD_ID is the release: on GitHub, the last commit that changed the
//   version log or src/updateNow.js. Open pages show the update screen only
//   when it changes, so a change in neither ships without one. A bump of
//   updateNow.js alone is a plain update: just an Update button.
const CODE_ID = (process.env.GITHUB_SHA || '').slice(0, 12) || Date.now().toString(36);
function lastCommit(...paths) {
  try {
    return execSync(`git log -1 --format=%H -- ${paths.join(' ')}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .slice(0, 12);
  } catch {
    return '';
  }
}
const RELEASE_COMMIT = process.env.GITHUB_SHA ? lastCommit('src/changelog.js', 'src/updateNow.js') : '';
const BUILD_ID = RELEASE_COMMIT || CODE_ID;
const PLAIN = !!RELEASE_COMMIT && RELEASE_COMMIT !== lastCommit('src/changelog.js');

const versionFile = {
  name: 'version-file',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      // A plain update leaves out the version and its log, so even older
      // pages show no version number or what's new.
      source: JSON.stringify(
        PLAIN
          ? { version: BUILD_ID, code: CODE_ID, plain: true }
          : { version: BUILD_ID, code: CODE_ID, release: CHANGELOG[0].version, changelog: CHANGELOG },
      ),
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
