// Who did what in a run or match: the drive team's roles. The pit screen's
// drive team (settings.driveTeam: drivers[0], drivers[1], coach, human) fills
// them in for a new run; each run keeps its own (run.roles).
export const RUN_ROLES = [
  ['driver', 'Driver', 'D'],
  ['operator', 'Operator', 'O'],
  ['coach', 'Coach', 'C'],
  ['human', 'Human player', 'H'],
];
const EMPTY = { driver: '', operator: '', coach: '', human: '' };

// The pit screen's drive team, as run roles.
export const rolesFromTeam = (t = {}) => ({
  driver: t.drivers?.[0] || '',
  operator: t.drivers?.[1] || '',
  coach: t.coach || '',
  human: t.human || '',
});

// A run's roles, or null for an older run that only listed its drivers.
export const rolesOf = (run) => (run?.roles && Object.values(run.roles).some(Boolean) ? { ...EMPTY, ...run.roles } : null);

// The drivers list older screens and stats read: whoever drove and operated.
export const driversOf = (roles) => [...new Set([roles.driver, roles.operator].filter(Boolean))];

// Per person: how many runs in each role, and the average total of the runs
// they drove. runs: [{ roles, total }].
export function roleCounts(runs) {
  const by = new Map();
  for (const r of runs) {
    const roles = rolesOf(r.run);
    if (!roles) continue;
    for (const [key] of RUN_ROLES) {
      const n = roles[key];
      if (!n) continue;
      const p = by.get(n) || { name: n, driver: 0, operator: 0, coach: 0, human: 0, driven: [] };
      p[key] += 1;
      if (key === 'driver') p.driven.push(r.total);
      by.set(n, p);
    }
  }
  return [...by.values()]
    .map((p) => ({ ...p, avgDriven: p.driven.length ? Math.round(p.driven.reduce((s, x) => s + x, 0) / p.driven.length) : null }))
    .sort((a, b) => b.driver + b.operator + b.coach + b.human - (a.driver + a.operator + a.coach + a.human) || a.name.localeCompare(b.name));
}
