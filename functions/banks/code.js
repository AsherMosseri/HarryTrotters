// Fix the bug (G5): turns the snippets in code-java.js and code-blocks.js
// into questions. Each question shows `lines` with exactly one broken line;
// `bugLine` is its index (0-based) and `fixed` is the correct line.
import { JAVA } from './code-java.js';
import { BLOCKS } from './code-blocks.js';

const problems = [];
function build(lang, bases) {
  const out = [];
  for (const base of bases) {
    const lines = base.code.split('\n');
    base.bugs.forEach(([find, broken, explain, difficulty], k) => {
      const hits = lines.map((l, i) => (l.includes(find) ? i : -1)).filter((i) => i >= 0);
      if (hits.length !== 1) problems.push(`${base.key} bug ${k}: "${find}" matches ${hits.length} lines`);
      const at = hits[0] ?? 0;
      const indent = lines[at].match(/^\s*/)[0];
      const shown = [...lines];
      shown[at] = indent + broken;
      if (shown[at] === lines[at]) problems.push(`${base.key} bug ${k}: broken line is unchanged`);
      // A broken line equal to another line would make two right answers.
      if (shown.filter((l) => l === shown[at]).length > 1) problems.push(`${base.key} bug ${k}: broken line repeats another line`);
      out.push({
        id: `c-${base.key}-${k + 1}`,
        bank: 'code',
        kind: 'bug',
        lang,
        difficulty,
        prompt: `${base.task} One line has a bug: which one?`,
        lines: shown,
        bugLine: at,
        fixed: lines[at],
        explain,
      });
    });
  }
  return out;
}

export const CODE = [...build('java', JAVA), ...build('blocks', BLOCKS)];
if (problems.length) throw new Error(problems.join('\n'));
