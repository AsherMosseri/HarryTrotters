import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../common.jsx';
import { Icon } from './icons.jsx';
import { PitGuess } from '../Life.jsx';
import Debrief from './Debrief.jsx';
import { BatteryStrip } from '../Batteries.jsx';
import { QUEUE_CHECKLIST, STARTER_CHECKLISTS, isQueueChecklist, starterItems } from '../../checklists.js';
import { parseDay } from '../../milestones.js';
import { teamDay } from '../../../functions/shared/coins.js';
import {
  MATCH_WINDOW,
  QUEUE_LEAD,
  TEAM_TZ,
  eventMatches,
  matchToScore,
  nextMatch,
  queueTime,
  roundKey,
  sortMatches,
  typedMatch,
} from '../../../functions/shared/matches.js';

// Today on competition day: a pit screen for the drive team. The next match
// (alliance, partners, countdown), the "before queueing" checklist with its
// own countdown, the batteries (which one is in the robot, which are
// charged; the first checklist line is the battery), the drive team, quick
// score entry into the match log, and our schedule. Team management types the schedule in (or pulls it from FTC
// Events) and sets things up at the bottom. Everything works offline: reads
// come from the offline cache and writes go through when the Wi-Fi is back.

const first = (name = '') => name.split(' ')[0];
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
// 7:05, 1:02:09
function countdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
// "HH:MM" on the team's clock, for the edit form.
const hhmm = (ms) =>
  ms ? new Intl.DateTimeFormat('en-GB', { timeZone: TEAM_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms) : '';

function useNow(every = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

const ROLES = [
  ['drivers.0', 'Driver 1'],
  ['drivers.1', 'Driver 2'],
  ['coach', 'Drive coach'],
  ['human', 'Human player'],
];
const roleName = (team, key) => (key.startsWith('drivers.') ? team?.drivers?.[Number(key.split('.')[1])] : team?.[key]) || '';

function Alliance({ color, big }) {
  if (!color) return null;
  return <span className={`pm-alliance ${color}${big ? ' big' : ''}`}>{color === 'red' ? 'Red' : 'Blue'}</span>;
}

// ---------- The queue countdown and the "before queueing" checklist (D2) ----------
function QueueCard({ list, next, lead, now, actor, api, onAddList }) {
  const hand = list?.queue || null;
  const key = roundKey(next, hand);
  const at = queueTime(next, lead, hand);
  const byHand = !!(hand?.at && hand.round === key);
  const left = at ? at - now : null;
  const tone = left == null ? 'idle' : left <= 0 ? 'now' : left <= 2 * 60000 ? 'soon' : 'calm';
  const items = Object.values(list?.items || {}).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const isDone = (i) => i.done && i.doneRound === key;
  const done = items.filter(isDone).length;
  const start = (mins) => api.setChecklistQueue(list, { round: next ? next.id : `hand-${now}`, at: now + mins * 60000, by: actor.name });

  return (
    <section className="today-sec pit-sec">
      <div className="sec-head">
        <h2>Before queueing</h2>
        {list && (
          <span className="mono pm-count">
            {done}/{items.length}
          </span>
        )}
      </div>
      <div className={`qt qt-${tone}`} role="timer" aria-live="off">
        <div className="qt-main">
          <span className="qt-label">{tone === 'now' ? 'Queue now' : tone === 'idle' ? 'Queue timer' : 'Queue in'}</span>
          <span className="qt-num mono">{tone === 'idle' ? '—' : tone === 'now' ? countdown(-left) : countdown(left)}</span>
          <span className="qt-sub">
            {tone === 'idle'
              ? 'No match time to count from. Start it by hand.'
              : tone === 'now'
                ? `${byHand ? 'Called' : 'Time to go'} ${countdown(-left)} ago${next ? ` · ${next.label} at ${clock(next.time)}` : ''}`
                : byHand
                  ? `Started by ${first(hand.by)} · ${clock(at)}`
                  : `${clock(at)} · ${lead} min before ${next.label}`}
          </span>
        </div>
        {list && (
          <div className="qt-actions">
            <span className="qt-hint">By hand</span>
            {[5, 10, 15].map((m) => (
              <button key={m} className="qt-btn" onClick={() => start(m)} aria-label={`Queue in ${m} minutes`}>
                <span className="mono">{m}</span> min
              </button>
            ))}
            {byHand && next && (
              <button className="qt-btn ghost" onClick={() => api.setChecklistQueue(list, null)}>
                Use match time
              </button>
            )}
          </div>
        )}
      </div>
      {list ? (
        <ul className="qc-list">
          {items.map((i) => {
            const on = isDone(i);
            return (
              <li key={i.id}>
                <button className={`qc-item${on ? ' on' : ''}`} aria-pressed={on} onClick={() => api.tickQueueItem(list, i, !on, key)}>
                  <span className="qc-box" aria-hidden="true">
                    {on && <Icon name="check" size={22} />}
                  </span>
                  <span className="qc-text">{i.text}</span>
                  {on && i.doneBy && <span className="qc-by">{first(i.doneBy)}</span>}
                </button>
              </li>
            );
          })}
          {items.length === 0 && <p className="today-empty">The list is empty. Add items on the Checklists tab.</p>}
        </ul>
      ) : (
        <div className="pm-empty">
          <p>There’s no “{QUEUE_CHECKLIST}” checklist yet.</p>
          <button className="btn primary" onClick={onAddList}>
            <Icon name="plus" size={16} /> Add it
          </button>
        </div>
      )}
      {list && done === items.length && items.length > 0 && <p className="qc-ready">Ready to queue.</p>}
    </section>
  );
}

// ---------- Quick score entry ----------
const PERIODS = [
  ['auto', 'Auto'],
  ['teleop', 'TeleOp'],
  ['endgame', 'Endgame'],
];
function ScorePad({ matches, now, driveTeam, api }) {
  const sorted = sortMatches(matches).filter((m) => m.time);
  const started = sorted.filter((m) => m.time <= now);
  const suggested = matchToScore(matches, now) || started.at(-1) || nextMatch(matches, now);
  // A match picked in the list, or just saved, stays up for a while; then the
  // pad goes back to the match most likely to need a score.
  const [picked, setPicked] = useState(null); // { id, until }
  const match = (picked && picked.until > now && sorted.find((m) => m.id === picked.id)) || suggested;
  const [vals, setVals] = useState({ auto: '', teleop: '', endgame: '' });
  const [result, setResult] = useState('');
  const [field, setField] = useState('auto');
  const [saved, setSaved] = useState('');
  // The optional "what went wrong?" step after a score is saved (D4); asked
  // once per match on this screen, and never in the way of saving.
  const [debrief, setDebrief] = useState(null);
  const debriefed = useRef(new Set());
  // Load what's saved when the match changes.
  const loadedFor = useRef(null);
  useEffect(() => {
    if (!match || loadedFor.current === match.id) return;
    loadedFor.current = match.id;
    const o = match.ours;
    setVals({ auto: o ? String(o.auto ?? '') : '', teleop: o ? String(o.teleop ?? '') : '', endgame: o ? String(o.endgame ?? '') : '' });
    setResult(match.result || '');
    setField('auto');
  }, [match]);

  if (!sorted.length) return null;
  const n = (k) => parseInt(vals[k], 10) || 0;
  const total = n('auto') + n('teleop') + n('endgame');
  const press = (key) => {
    setSaved('');
    if (key === 'back') return setVals((v) => ({ ...v, [field]: v[field].slice(0, -1) }));
    if (key === 'next') return setField(PERIODS[(PERIODS.findIndex(([k]) => k === field) + 1) % 3][0]);
    setVals((v) => {
      const cur = v[field] === '0' ? '' : v[field];
      return cur.length >= 3 ? v : { ...v, [field]: cur + key };
    });
  };
  const save = () => {
    api.logMatchScore(match, {
      auto: n('auto'),
      teleop: n('teleop'),
      endgame: n('endgame'),
      result,
      drivers: (driveTeam?.drivers || []).filter(Boolean),
    });
    setPicked({ id: match.id, until: Date.now() + 5 * 60000 });
    setSaved(`${match.label} saved to the match log.`);
    if (!debriefed.current.has(match.id)) {
      debriefed.current.add(match.id);
      setDebrief({ match, next: sorted.find((m) => m.time > match.time && m.id !== match.id && !m.ours) || null });
    }
  };

  return (
    <section className="today-sec pit-sec">
      <div className="sec-head">
        <h2>Score</h2>
        <label className="pm-pick">
          <select
            className="input"
            aria-label="Match to score"
            value={match?.id || ''}
            onChange={(e) => {
              setPicked({ id: e.target.value, until: Date.now() + 15 * 60000 });
              setSaved('');
            }}
          >
            {sorted.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · {clock(m.time)}
                {m.ours ? ' · scored' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="sp">
        <div className="sp-fields">
          {PERIODS.map(([k, label]) => (
            <button key={k} className={`sp-field${field === k ? ' on' : ''}`} onClick={() => setField(k)} aria-pressed={field === k}>
              <span className="sp-label">
                <i className={`sw sw-${k}`} /> {label}
              </span>
              <span className="sp-val mono">{vals[k] || '0'}</span>
            </button>
          ))}
          <div className="sp-field total">
            <span className="sp-label">Total</span>
            <span className="sp-val mono">{total}</span>
          </div>
        </div>
        <div className="sp-pad" role="group" aria-label={`Number pad for ${PERIODS.find(([k]) => k === field)[1]}`}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'next'].map((k) => (
            <button key={k} className={`sp-key${k.length > 1 ? ' fn' : ''}`} onClick={() => press(k)} aria-label={k === 'back' ? 'Erase a digit' : k === 'next' ? 'Next box' : k}>
              {k === 'back' ? <Icon name="backspace" size={24} /> : k === 'next' ? 'Next' : <span className="mono">{k}</span>}
            </button>
          ))}
        </div>
        <div className="sp-foot">
          <div className="segmented sp-result" role="radiogroup" aria-label="Result">
            {[
              ['win', 'Win'],
              ['loss', 'Loss'],
              ['tie', 'Tie'],
            ].map(([id, label]) => (
              <button
                key={id}
                role="radio"
                aria-checked={result === id}
                className={`plain-seg res-${id}${result === id ? ' on' : ''}`}
                onClick={() => {
                  setResult(result === id ? '' : id);
                  setSaved('');
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="btn primary sp-save" onClick={save} disabled={!match}>
            {match?.ours ? `Update ${match.label}` : `Save ${match?.label || ''}`}
          </button>
        </div>
        {saved ? (
          <p className="sp-saved" role="status">
            <Icon name="check" size={16} /> {saved}
          </p>
        ) : (
          match?.score && (
            <p className="sp-note">
              Official: <span className="mono">Red {match.score.red} · Blue {match.score.blue}</span>
            </p>
          )
        )}
      </div>
      {debrief && <Debrief match={debrief.match} next={debrief.next} api={api} onClose={() => setDebrief(null)} />}
    </section>
  );
}

// ---------- The team's matches ----------
function MatchForm({ match, event, onSave, onDelete, onCancel }) {
  const [f, setF] = useState(() => ({
    level: match?.level || 'qual',
    number: match ? String(match.level === 'playoff' ? Math.floor(match.number / 10) || match.number : match.number) : '',
    time: hhmm(match?.time),
    alliance: match?.alliance || '',
    partners: (match?.partners || []).join(', '),
    opponents: (match?.opponents || []).join(', '),
  }));
  const [sure, setSure] = useState(false);
  const num = useRef(null);
  useEffect(() => {
    if (!match) num.current?.focus();
  }, [match]);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const day = match?.time ? teamDay(match.time) : teamDay(Date.now());
  const submit = (e) => {
    e.preventDefault();
    if (!(parseInt(f.number, 10) > 0)) return;
    const m = typedMatch({ event: event || match?.event, ...f, date: day });
    onSave(m, match?.id);
    if (!match) {
      // Ready for the next one: same alliance cleared, number one up.
      setF((x) => ({ ...x, number: '', partners: '', opponents: '', alliance: '' }));
      num.current?.focus();
    }
  };
  return (
    <form className="mf" onSubmit={submit}>
      <div className="mf-row">
        <div className="segmented" role="radiogroup" aria-label="Kind of match">
          {[
            ['qual', 'Qual'],
            ['playoff', 'Playoff'],
          ].map(([id, label]) => (
            <button type="button" key={id} role="radio" aria-checked={f.level === id} className={`plain-seg${f.level === id ? ' on' : ''}`} onClick={() => set({ level: id })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mf-row">
        <label className="mf-field small">
          <span>Match</span>
          <input ref={num} className="input mono" inputMode="numeric" pattern="[0-9]*" value={f.number} onChange={(e) => set({ number: e.target.value.replace(/\D/g, '') })} placeholder="12" required />
        </label>
        <label className="mf-field">
          <span>Time</span>
          <input className="input mono" type="time" value={f.time} onChange={(e) => set({ time: e.target.value })} />
        </label>
      </div>
      <div className="mf-row">
        <span className="mf-label">Alliance</span>
        <div className="mf-alliance">
          {['red', 'blue'].map((c) => (
            <button type="button" key={c} className={`mf-color ${c}${f.alliance === c ? ' on' : ''}`} aria-pressed={f.alliance === c} onClick={() => set({ alliance: f.alliance === c ? '' : c })}>
              {c === 'red' ? 'Red' : 'Blue'}
            </button>
          ))}
        </div>
      </div>
      <div className="mf-row">
        <label className="mf-field">
          <span>Partner</span>
          <input className="input mono" inputMode="numeric" value={f.partners} onChange={(e) => set({ partners: e.target.value })} placeholder="Team number" />
        </label>
        <label className="mf-field">
          <span>Against</span>
          <input className="input mono" inputMode="numeric" value={f.opponents} onChange={(e) => set({ opponents: e.target.value })} placeholder="1234, 5678" />
        </label>
      </div>
      <div className="row gap mf-actions">
        {onDelete &&
          (sure ? (
            <button type="button" className="btn danger" onClick={onDelete}>
              Delete {match.label}
            </button>
          ) : (
            <button type="button" className="link-btn danger" onClick={() => setSure(true)}>
              Delete
            </button>
          ))}
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={onCancel}>
          {match ? 'Cancel' : 'Done'}
        </button>
        <button className="btn primary" disabled={!(parseInt(f.number, 10) > 0)}>
          {match ? 'Save' : `Add ${f.level === 'qual' ? 'Q' : 'P'}${f.number || ''}`}
        </button>
      </div>
    </form>
  );
}

function Schedule({ matches, next, now, isManager, event, api, onSync }) {
  const [editing, setEditing] = useState(null); // 'new' or a match id
  const sorted = sortMatches(matches);
  const Row = isManager ? 'button' : 'div';
  return (
    <section className="today-sec pit-sec">
      <div className="sec-head">
        <h2>Our matches</h2>
        {isManager && editing !== 'new' && (
          <button className="text-btn" onClick={() => setEditing('new')}>
            <Icon name="plus" size={16} /> Add
          </button>
        )}
      </div>
      {isManager && editing === 'new' && (
        <MatchForm event={event} onSave={(m) => api.saveMatch(m)} onCancel={() => setEditing(null)} />
      )}
      {sorted.length ? (
        <ul className="pm-sched">
          {sorted.map((m) =>
            editing === m.id ? (
              <li key={m.id}>
                <MatchForm
                  match={m}
                  event={event}
                  onSave={(nm, oldId) => {
                    api.saveMatch(nm, oldId);
                    setEditing(null);
                  }}
                  onDelete={() => {
                    api.deleteMatch(m);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={m.id}>
                <Row
                  className={`pm-row ${m.alliance || 'none'}${next?.id === m.id ? ' next' : ''}${m.time && m.time + MATCH_WINDOW < now ? ' past' : ''}`}
                  {...(isManager ? { onClick: () => setEditing(m.id), title: 'Edit' } : {})}
                >
                  <span className="pm-row-label mono">{m.label}</span>
                  <span className="pm-row-main">
                    <span className="pm-row-time mono">{m.time ? clock(m.time) : 'No time'}</span>
                    <span className="pm-row-teams">
                      {m.partners?.length ? `with ${m.partners.join(', ')}` : ''}
                      {m.opponents?.length ? ` · vs ${m.opponents.join(', ')}` : ''}
                    </span>
                  </span>
                  {m.ours ? (
                    <span className={`pm-row-score mono ${m.result || ''}`}>
                      {m.ours.total}
                      {m.result && <small>{m.result === 'win' ? 'W' : m.result === 'loss' ? 'L' : 'T'}</small>}
                    </span>
                  ) : next?.id === m.id ? (
                    <span className="pm-row-tag">Next</span>
                  ) : null}
                </Row>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="today-empty">
          {isManager ? 'No matches yet. Add them as the schedule comes out, or pull them from FTC Events below.' : 'No matches yet. Team management adds them when the schedule is out.'}
        </p>
      )}
      {isManager && onSync}
    </section>
  );
}

// ---------- Team management's setup ----------
function Setup({ settings, competitionDate, roster, api }) {
  const event = settings.compEvent || {};
  const [code, setCode] = useState(event.code || '');
  const [name, setName] = useState(event.name || '');
  useEffect(() => {
    setCode(event.code || '');
    setName(event.name || '');
  }, [event.code, event.name]);
  const mode = settings.compMode || 'auto';
  const team = settings.driveTeam || {};
  const lead = Number(settings.queueLead) || QUEUE_LEAD;
  const saveEvent = () => {
    const c = code.trim().toUpperCase();
    if (c !== (event.code || '') || name.trim() !== (event.name || '')) api.saveSettings({ compEvent: { ...event, code: c, name: name.trim() } });
  };
  const setRole = (key, who) => {
    const next = { coach: team.coach || '', drivers: [...(team.drivers || ['', ''])], human: team.human || '' };
    if (key.startsWith('drivers.')) next.drivers[Number(key.split('.')[1])] = who;
    else next[key] = who;
    api.saveSettings({ driveTeam: next });
  };
  const dateLabel = competitionDate ? parseDay(competitionDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  return (
    <section className="today-sec pit-sec pm-setup">
      <div className="sec-head">
        <h2>Competition setup</h2>
      </div>
      <div className="mf-row">
        <span className="mf-label">Competition mode</span>
        <div className="segmented" role="radiogroup" aria-label="Competition mode">
          {[
            ['auto', `On ${dateLabel}`],
            ['on', 'On now'],
            ['off', 'Off'],
          ].map(([id, label]) => (
            <button key={id} role="radio" aria-checked={mode === id} className={`plain-seg${mode === id ? ' on' : ''}`} onClick={() => api.saveSettings({ compMode: id })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mf-row">
        <label className="mf-field small">
          <span>Event code</span>
          <input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onBlur={saveEvent} placeholder="USNYNYQ1" maxLength={20} />
        </label>
        <label className="mf-field">
          <span>Event name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveEvent} placeholder="e.g. NYC Qualifier" maxLength={120} />
        </label>
      </div>
      <div className="mf-row">
        <label className="mf-field small">
          <span>Queue lead (min)</span>
          <input
            className="input mono"
            type="number"
            min="1"
            max="60"
            inputMode="numeric"
            defaultValue={lead}
            key={lead}
            onBlur={(e) => {
              const v = Math.max(1, Math.min(60, parseInt(e.target.value, 10) || QUEUE_LEAD));
              if (v !== lead) api.saveSettings({ queueLead: v });
            }}
          />
        </label>
      </div>
      <span className="mf-label">Drive team</span>
      <div className="pm-roles">
        {ROLES.map(([key, label]) => (
          <label key={key} className="mf-field">
            <span>{label}</span>
            <select className="input" value={roleName(team, key)} onChange={(e) => setRole(key, e.target.value)}>
              <option value="">Nobody</option>
              {roster.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}

// Pull the schedule from FTC Events (team management).
function SyncButton({ settings, api }) {
  const [state, setState] = useState({ busy: false, text: '', tone: '' });
  const code = settings.compEvent?.code || '';
  const run = async () => {
    if (!code) return setState({ text: 'Type the event code in Competition setup first.', tone: 'warn' });
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
      return setState({ text: 'You’re offline. Type the matches in for now.', tone: 'warn' });
    setState({ busy: true, text: '', tone: '' });
    try {
      const r = await api.ftcEvents({ action: 'sync', event: code });
      if (r?.notSetUp)
        setState({ text: 'FTC Events isn’t connected yet: it needs the team’s API key, which Asher is setting up. Type the matches in for now.', tone: 'warn' });
      else if (r?.error) setState({ text: r.error, tone: 'bad' });
      else
        setState({
          text: r.count ? `Got ${r.count} ${r.count === 1 ? 'match' : 'matches'} from FTC Events${r.added ? ` (${r.added} new)` : ''}.` : 'FTC Events has no matches for us yet. Try again once the schedule is out.',
          tone: 'good',
        });
    } catch (e) {
      setState({ text: e?.message || 'Couldn’t reach FTC Events. Type the matches in for now.', tone: 'bad' });
    }
  };
  return (
    <div className="pm-sync">
      <button className="btn" onClick={run} disabled={state.busy}>
        <Icon name="signal" size={16} /> {state.busy ? 'Pulling…' : 'Pull from FTC Events'}
      </button>
      {settings.compSyncedAt && !state.text && <span className="muted small">Last pulled {clock(settings.compSyncedAt)}</span>}
      {state.text && (
        <p className={`pm-sync-note ${state.tone}`} role="status">
          {state.text}
        </p>
      )}
    </div>
  );
}

export default function PitScreen({ actor, settings, matches, batteries = [], checklists, roster, competition, api, predictions = [], onPerson, onUsual }) {
  const now = useNow(1000);
  const isManager = !!actor.admin;
  const event = settings.compEvent || {};
  const lead = Number(settings.queueLead) || QUEUE_LEAD;
  const list = useMemo(() => checklists.find(isQueueChecklist) || null, [checklists]);
  // This event's matches (all of them while no event is picked).
  const ours = useMemo(() => eventMatches(matches, event.code), [matches, event.code]);
  const next = nextMatch(ours, now);
  const toStart = next?.time ? next.time - now : null;
  const team = settings.driveTeam || {};
  const crew = ROLES.map(([key, label]) => [label, roleName(team, key)]).filter(([, n]) => n);
  const rank = settings.compRank;
  const done = ours.filter((m) => m.ours);
  const wins = done.filter((m) => m.result === 'win').length;
  const losses = done.filter((m) => m.result === 'loss').length;
  const ties = done.filter((m) => m.result === 'tie').length;
  const addList = () => {
    const s = STARTER_CHECKLISTS.find(isQueueChecklist);
    api.createChecklist({ title: s.title, items: starterItems(s) });
  };

  return (
    <main className="content today pit-mode">
      <header className={`pit pm-band${next?.alliance ? ` ${next.alliance}` : ''}`}>
        <div className="pit-main">
          <p className="pit-date">
            {new Date(now).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            <span> · {event.name || event.code || competition.name}</span>
          </p>
          {next ? (
            <>
              <div className="pm-next">
                <span className="pm-label mono">{next.label}</span>
                <div className="pm-next-side">
                  <Alliance color={next.alliance} big />
                  <span className="pm-at mono">{next.time ? clock(next.time) : ''}</span>
                </div>
              </div>
              <p className="pm-countdown">
                {toStart > 0 ? (
                  <>
                    <span className="pm-cd-label">Match in</span> <span className="mono">{countdown(toStart)}</span>
                  </>
                ) : (
                  <span className="pm-cd-label live">On the field now</span>
                )}
              </p>
              {(next.partners?.length > 0 || next.opponents?.length > 0) && (
                <p className="pm-teams">
                  {next.partners?.length > 0 && (
                    <>
                      With <b className="mono">{next.partners.join(', ')}</b>
                    </>
                  )}
                  {next.opponents?.length > 0 && (
                    <span className="pm-vs">
                      {' '}
                      vs <span className="mono">{next.opponents.join(', ')}</span>
                    </span>
                  )}
                </p>
              )}
            </>
          ) : (
            <h1 className="pit-title">{ours.length ? 'That’s all our matches' : 'Competition mode'}</h1>
          )}
          <p className="pm-record">
            {done.length > 0 && (
              <span>
                <span className="mono">
                  {wins}-{losses}-{ties}
                </span>{' '}
                W-L-T
              </span>
            )}
            {rank?.rank > 0 && (
              <span>
                Rank{' '}
                <span className="mono">
                  {rank.rank}
                  {rank.of ? ` of ${rank.of}` : ''}
                </span>
              </span>
            )}
          </p>
        </div>
      </header>

      <div className="today-grid pm-grid">
        <div className="today-col">
          <BatteryStrip batteries={batteries} matches={ours} api={api} isManager={isManager} />
          <QueueCard list={list} next={next} lead={lead} now={now} actor={actor} api={api} onAddList={addList} />
          <ScorePad matches={ours} now={now} driveTeam={team} api={api} />
          <PitGuess predictions={predictions} next={next} actor={actor} api={api} now={now} />
        </div>
        <div className="today-col side">
          <section className="today-sec pit-sec">
            <div className="sec-head">
              <h2>Drive team</h2>
            </div>
            {crew.length ? (
              <ul className="p-list pm-crew">
                {crew.map(([role, n]) => (
                  <li key={role}>
                    <button className="p-row" onClick={() => onPerson(n)}>
                      <Avatar name={n} size={34} />
                      <span className="grow">
                        <span className="pm-crew-name">{n}</span>
                        <span className="pm-crew-role">{role}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="today-empty">{isManager ? 'Pick the drive team in Competition setup.' : 'Team management hasn’t picked the drive team yet.'}</p>
            )}
          </section>
          <Schedule
            matches={ours}
            next={next}
            now={now}
            isManager={isManager}
            event={event.code}
            api={api}
            onSync={<SyncButton settings={settings} api={api} />}
          />
          {isManager && <Setup settings={settings} competitionDate={competition.date} roster={roster} api={api} />}
          <button className="text-btn pm-usual" onClick={onUsual}>
            Show the usual Today
          </button>
        </div>
      </div>
    </main>
  );
}
