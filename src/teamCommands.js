// What the team slash commands (/task, /overdue, /match…) read out of what you
// typed, and the numbers they show. No React or Firebase in here.

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayISO = (now = Date.now()) => iso(new Date(now));
export const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00`) - new Date(`${a}T12:00`)) / 86400000);

// A due date word: today, tomorrow, friday, fri, 11/14, 2026-11-14 → ISO, or null.
export function dueFrom(word, now = Date.now()) {
  const w = word.toLowerCase().replace(/[.,]$/, '');
  const d = new Date(now);
  if (w === 'today') return iso(d);
  if (w === 'tomorrow' || w === 'tmrw') {
    d.setDate(d.getDate() + 1);
    return iso(d);
  }
  const day = DAYS.indexOf(w) >= 0 ? DAYS.indexOf(w) : SHORT.indexOf(w);
  if (day >= 0) {
    d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7 || 7));
    return iso(d);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w;
  const md = /^(\d{1,2})\/(\d{1,2})$/.exec(w);
  if (md && +md[1] >= 1 && +md[1] <= 12 && +md[2] >= 1 && +md[2] <= 31) {
    const out = new Date(d.getFullYear(), +md[1] - 1, +md[2]);
    // Earlier this year means next year.
    if (iso(out) < iso(d)) out.setFullYear(out.getFullYear() + 1);
    return iso(out);
  }
  return null;
}

const PRIORITY = { '!urgent': 'urgent', '!!!': 'urgent', '!high': 'high', '!!': 'high', '!low': 'low', '!medium': 'medium' };

// "/task Fix the intake @Cooper Mlezcko by friday !high"
//   → { title: 'Fix the intake', assignees: ['Cooper Mlezcko'], dueDate: '…', priority: 'high' }
export function parseTask(text, roster, me, now = Date.now()) {
  let rest = ` ${text} `;
  const assignees = [];
  for (const n of [...roster].sort((a, b) => b.length - a.length)) {
    const at = rest.toLowerCase().indexOf(`@${n.toLowerCase()}`);
    if (at >= 0) {
      assignees.push(n);
      rest = rest.slice(0, at) + rest.slice(at + n.length + 1);
    }
  }
  // "@me", and "@cooper" (first names)
  rest = rest.replace(/@(\S+)/g, (all, w) => {
    const n = w.toLowerCase() === 'me' ? me : roster.find((r) => r.toLowerCase().split(' ')[0] === w.toLowerCase());
    if (!n) return all;
    assignees.push(n);
    return '';
  });
  let priority = 'medium';
  rest = rest.replace(/(^|\s)(!urgent|!high|!low|!medium|!!!|!!)(?=\s)/gi, (all, sp, p) => {
    priority = PRIORITY[p.toLowerCase()];
    return sp;
  });
  let dueDate = '';
  const words = rest.trim().split(/\s+/).filter(Boolean);
  for (let k = words.length - 1; k >= Math.max(0, words.length - 3); k--) {
    const due = dueFrom(words[k], now);
    if (!due) continue;
    dueDate = due;
    const cut = k > 0 && /^(by|due|on)$/i.test(words[k - 1]) ? k - 1 : k;
    words.splice(cut, k - cut + 1);
    break;
  }
  return { title: words.join(' ').replace(/\s+/g, ' ').trim().slice(0, 140), assignees: [...new Set(assignees)], dueDate, priority };
}

// Open tasks past their due date, latest first.
export function overdueTasks(tasks, now = Date.now()) {
  const today = todayISO(now);
  return (tasks || [])
    .filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < today)
    .map((t) => ({ id: t.id, title: t.title || 'Untitled', late: daysBetween(t.dueDate, today), who: t.assignees || [] }))
    .sort((a, b) => b.late - a.late);
}

// "/match 20 45 15 win #7", "20/45/15 L", "auto 20 teleop 45 endgame 15"
export function parseMatch(text) {
  const t = ` ${text.toLowerCase()} `;
  const named = (k) => +(new RegExp(`${k}\\s*:?\\s*(\\d+)`).exec(t)?.[1] ?? NaN);
  let [auto, teleop, endgame] = [named('auto'), named('tele(?:op)?'), named('end(?:game)?')];
  const nums = t
    .replace(/#\s*\d+/g, ' ')
    .replace(/(auto|tele(?:op)?|end(?:game)?)\s*:?\s*\d+/g, ' ')
    .match(/\d+/g);
  if ([auto, teleop, endgame].some(Number.isNaN)) {
    if (!nums || nums.length < 3) return null;
    [auto, teleop, endgame] = nums.slice(0, 3).map(Number);
  }
  const result = /\b(win|won|w)\b/.test(t)
    ? 'win'
    : /\b(loss|lost|lose|l)\b/.test(t)
      ? 'loss'
      : /\b(tie|tied|t|draw)\b/.test(t)
        ? 'tie'
        : '';
  const matchNumber = /#\s*(\d+)/.exec(t)?.[1] || '';
  return { auto, teleop, endgame, result, matchNumber };
}

// The season so far: wins-losses-ties, best and average score.
export function seasonRecord(runs) {
  const matches = (runs || []).filter((r) => r.type === 'match');
  const total = (r) => (Number(r.auto) || 0) + (Number(r.teleop) || 0) + (Number(r.endgame) || 0);
  const count = (x) => matches.filter((r) => r.result === x).length;
  const scores = matches.map(total);
  return {
    played: matches.length,
    wins: count('win'),
    losses: count('loss'),
    ties: count('tie'),
    best: scores.length ? Math.max(...scores) : 0,
    avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
  };
}
