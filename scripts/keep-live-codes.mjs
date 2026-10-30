// The team code (and, before 3.0, the manager codes) live only in the
// published Firestore rules (never on GitHub). Before a deploy, copy them from
// the live rules into firestore.rules so publishing the new rules keeps them.
// A code firestore.rules no longer has (the manager codes, since passwords)
// is skipped.
// Needs TOKEN (a Google access token). Never prints the codes.
import { readFileSync, writeFileSync } from 'node:fs';

const PROJECT = 'ftc-32313-tasks';
const api = async (path) => {
  const res = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, { headers: { Authorization: `Bearer ${process.env.TOKEN}` } });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
};

const PARTS = {
  teamCode: /function teamCode\(\)\s*\{\s*return\s*'[^']*';\s*\}/,
  managerCodes: /function managerCodes\(\)\s*\{\s*return\s*\{[^}]*\};\s*\}/,
};

const release = await api(`projects/${PROJECT}/releases/cloud.firestore`);
const ruleset = await api(release.rulesetName);
const live = ruleset.source.files.map((f) => f.content).join('\n');

let rules = readFileSync('firestore.rules', 'utf8');
for (const [name, re] of Object.entries(PARTS)) {
  if (!re.test(rules)) continue; // not used anymore
  const found = live.match(re)?.[0];
  if (!found || found.includes('CHANGE-ME')) {
    console.error(`Couldn't find the real ${name}() in the published rules, so nothing was deployed.`);
    process.exit(1);
  }
  rules = rules.replace(re, () => found);
}
if (rules.includes('CHANGE-ME')) throw new Error('firestore.rules still has a placeholder code');
writeFileSync('firestore.rules', rules);
console.log('Kept the live team and manager codes.');
