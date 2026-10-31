import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../shell/icons.jsx';
import { DisplayName, CloseIcon, Overlay } from '../common.jsx';
import { confirmDialog, promptDialog } from '../Dialogs.jsx';
import { relTime, useEscape, useLocalStorage } from '../../util.js';
import { sameName } from '../../../functions/shared/team.js';
import { matchToScore } from '../../../functions/shared/matches.js';
import {
  RATINGS,
  TEAM_NOTES_MAX,
  balanced,
  byTeam,
  rankText,
  summarize,
  tagKind,
  tagLabel,
  teamNumberOf,
} from '../../../functions/shared/scout.js';
import { EntryForm } from './EntryForm.jsx';
import { PickList } from './Picks.jsx';
import { ScoreBadge, fmt } from './parts.jsx';

// Scout (plan item D5): every team at the event, a fast form for scouting a
// match from the stands, and the pick list for alliance selection. The teams
// and rankings come from FTC Events when it works (team management pulls
// them) and can always be typed in. Nothing here pays coins.

const TABS = [
  ['teams', 'Teams', 'team'],
  ['scout', 'Scout a match', 'scout'],
  ['picks', 'Pick list', 'order'],
];
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function useScout(api) {
  const [teams, setTeams] = useState([]);
  const [entries, setEntries] = useState([]);
  const [picks, setPicks] = useState({});
  useEffect(() => api.subscribeScoutTeams(setTeams), [api]);
  useEffect(() => api.subscribeScoutEntries(setEntries), [api]);
  useEffect(() => api.subscribeScoutPicks(setPicks), [api]);
  return { teams, entries, picks };
}

export default function ScoutView({ actor, settings, matches, api, rename }) {
  const isManager = !!actor.admin;
  const event = settings.compEvent?.code || '';
  const { teams: allTeams, entries: allEntries, picks } = useScout(api);
  const [tab, setTab] = useLocalStorage('scout-tab', 'teams');
  const [detail, setDetail] = useState(0);
  const [prefill, setPrefill] = useState(null);
  const [adding, setAdding] = useState(false);
  // This event's teams and entries (everything while no event is set).
  const teams = useMemo(
    () => allTeams.filter((t) => !event || !t.event || t.event === event).sort((a, b) => a.number - b.number),
    [allTeams, event],
  );
  const entries = useMemo(() => allEntries.filter((e) => !event || !e.event || e.event === event), [allEntries, event]);
  const grouped = useMemo(() => byTeam(entries), [entries]);
  const rows = useMemo(
    () =>
      teams.map((t) => {
        const mine = grouped.get(t.number) || [];
        const sum = summarize(mine);
        return { ...t, sum, score: balanced(sum) };
      }),
    [teams, grouped],
  );
  const mineOf = (e) => e.createdByUid === actor.uid || sameName(rename(e.createdBy || ''), actor.name);
  const canEdit = (e) => isManager || mineOf(e);

  const startScout = (team = 0, match = '') => {
    setPrefill({ team, match, n: Date.now() });
    setDetail(0);
    setTab('scout');
  };
  const eventEntries = (n) => (grouped.get(n) || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const shown = TABS.some(([id]) => id === tab) ? tab : 'teams';
  const open = rows.find((t) => t.number === detail);

  // Save an entry. Not awaited: it lands in the local cache and reaches the
  // server when there's Wi-Fi. A team that isn't on the list yet is added.
  const saveEntry = (clean) => {
    const n = clean.team;
    if (!allTeams.some((t) => t.number === n)) api.saveScoutTeam({ number: n, name: '', event, source: 'typed' });
    api.createScoutEntry({ ...clean, event });
  };

  return (
    <main className="content scout">
      <header className="sc-head">
        <div>
          <h1 className="sc-title">Scout</h1>
          <p className="muted small">
            {event ? (
              <>
                {settings.compEvent?.name || event} · <span className="mono">{teams.length}</span> teams · <span className="mono">{entries.length}</span> scouting notes
              </>
            ) : (
              'Notes and ratings on every team, and the pick list for alliance selection.'
            )}
          </p>
        </div>
      </header>
      <div className="segmented sc-tabs" role="tablist" aria-label="Scout">
        {TABS.map(([id, label, icon]) => (
          <button key={id} role="tab" aria-selected={shown === id} className={`plain-seg${shown === id ? ' on' : ''}`} onClick={() => (setTab(id), setDetail(0))}>
            <Icon name={icon} size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {shown === 'teams' &&
        (open ? (
          <TeamDetail
            team={open}
            entries={eventEntries(open.number)}
            actor={actor}
            isManager={isManager}
            canEdit={canEdit}
            rename={rename}
            api={api}
            matches={matches}
            event={event}
            onBack={() => setDetail(0)}
            onScout={() => startScout(open.number)}
            picks={picks}
          />
        ) : (
          <Teams
            rows={rows}
            settings={settings}
            isManager={isManager}
            event={event}
            api={api}
            onOpen={setDetail}
            onAdd={() => setAdding(true)}
          />
        ))}
      {shown === 'scout' && (
        <ScoutPage
          teams={rows}
          matches={matches}
          event={event}
          prefill={prefill}
          myEntries={entries.filter(mineOf)}
          onSave={saveEntry}
          onOpenTeam={(n) => (setDetail(n), setTab('teams'))}
          rename={rename}
        />
      )}
      {shown === 'picks' && (
        <PickList
          rows={rows}
          picks={picks}
          isManager={isManager}
          entries={entries}
          api={api}
          onOpenTeam={(n) => (setDetail(n), setTab('teams'))}
        />
      )}
      {adding && <AddTeam teams={allTeams} event={event} api={api} onClose={() => setAdding(false)} />}
    </main>
  );
}

// ---------- Teams ----------

const SORTS = [
  ['number', 'Number'],
  ['rank', 'Rank'],
  ['score', 'Our score'],
];

function Teams({ rows, settings, isManager, event, api, onOpen, onAdd }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useLocalStorage('scout-sort', 'number');
  const shown = useMemo(() => {
    const text = q.trim().toLowerCase();
    const list = rows.filter((t) => !text || String(t.number).startsWith(text.replace(/^#/, '')) || (t.name || '').toLowerCase().includes(text));
    const by = {
      number: (a, b) => a.number - b.number,
      rank: (a, b) => (a.rank?.rank || 999) - (b.rank?.rank || 999) || a.number - b.number,
      score: (a, b) => (b.score ?? -1) - (a.score ?? -1) || a.number - b.number,
    }[sort] || ((a, b) => a.number - b.number);
    return [...list].sort(by);
  }, [rows, q, sort]);
  return (
    <section className="sc-sec">
      <div className="sc-bar">
        <label className="sc-search">
          <Icon name="search" size={16} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Number or name" inputMode="search" aria-label="Find a team" />
        </label>
        <div className="segmented sc-sorts" role="radiogroup" aria-label="Sort by">
          {SORTS.map(([id, label]) => (
            <button key={id} role="radio" aria-checked={sort === id} className={`plain-seg${sort === id ? ' on' : ''}`} onClick={() => setSort(id)}>
              {label}
            </button>
          ))}
        </div>
        <button className="btn" onClick={onAdd}>
          <Icon name="plus" size={16} /> Add team
        </button>
      </div>
      <PullBar settings={settings} isManager={isManager} event={event} api={api} hasTeams={rows.length > 0} />
      {rows.length === 0 ? (
        <p className="sc-empty">
          {isManager
            ? 'No teams yet. Pull them from FTC Events above, or add them by hand.'
            : 'No teams yet. Team management pulls them from FTC Events; you can also add one by hand.'}
        </p>
      ) : shown.length === 0 ? (
        <p className="sc-empty">No team matches “{q}”.</p>
      ) : (
        <ul className="sc-teams">
          {shown.map((t) => (
            <li key={t.number}>
              <button className={`sc-team${t.number === 32313 ? ' us' : ''}`} onClick={() => onOpen(t.number)}>
                <span className="sc-num mono">{t.number}</span>
                <span className="sc-team-main">
                  <b>{t.name || 'No name yet'}</b>
                  <span className="muted small">
                    {t.rank?.rank ? (
                      <>
                        <span className="mono">{rankText(t.rank)}</span> · <span className="mono">{t.rank.played}</span> played
                      </>
                    ) : (
                      t.city || 'Not ranked yet'
                    )}
                  </span>
                </span>
                <span className="sc-team-side">
                  <ScoreBadge value={t.score} />
                  <span className="muted tiny">
                    <span className="mono">{t.sum.n}</span> {t.sum.n === 1 ? 'look' : 'looks'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Team management: set the event, pull the teams and rankings from FTC Events.
function PullBar({ settings, isManager, event, api, hasTeams }) {
  const [state, setState] = useState({ busy: '', text: '', tone: '' });
  const [code, setCode] = useState(event);
  useEffect(() => setCode(event), [event]);
  const saveCode = () => {
    const c = code.trim().toUpperCase();
    if (c !== event) api.saveSettings({ compEvent: { ...(settings.compEvent || {}), code: c } });
  };
  const run = async (only) => {
    if (!event) return setState({ busy: '', text: 'Type the event code first.', tone: 'warn' });
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
      return setState({ busy: '', text: 'You’re offline. Add the teams by hand for now.', tone: 'warn' });
    setState({ busy: only || 'all', text: '', tone: '' });
    try {
      const r = await api.ftcEvents({ action: 'scout', event, ...(only ? { only } : {}) });
      if (r?.notSetUp)
        setState({ busy: '', text: 'FTC Events isn’t connected yet: it needs the team’s API key, which Asher is setting up. Add the teams by hand for now.', tone: 'warn' });
      else if (r?.error) setState({ busy: '', text: r.error, tone: 'bad' });
      else
        setState({
          busy: '',
          text: `${r.teams} ${r.teams === 1 ? 'team' : 'teams'}${r.added ? ` (${r.added} new)` : ''}, ${r.ranked ? `${r.ranked} ranked` : 'no rankings yet'}.${r.note ? ` ${r.note}` : ''}`,
          tone: 'good',
        });
    } catch (e) {
      setState({ busy: '', text: e?.message || 'Couldn’t reach FTC Events. Add the teams by hand for now.', tone: 'bad' });
    }
  };
  const synced = settings.scoutSyncedAt;
  if (!isManager)
    return synced ? (
      <p className="muted small sc-pull-note">
        Teams and rankings last pulled <span className="mono">{clock(synced)}</span>. Team management refreshes them.
      </p>
    ) : null;
  return (
    <div className="sc-pull">
      {!event && (
        <label className="mf-field small sc-code">
          <span>Event code</span>
          <input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onBlur={saveCode} placeholder="USNYNYQ1" maxLength={20} />
        </label>
      )}
      <button className="btn" onClick={() => run('')} disabled={!!state.busy}>
        <Icon name="signal" size={16} /> {state.busy === 'all' ? 'Pulling…' : hasTeams ? 'Pull teams again' : 'Pull teams and rankings'}
      </button>
      {hasTeams && (
        <button className="btn" onClick={() => run('rankings')} disabled={!!state.busy}>
          <Icon name="repeat" size={16} /> {state.busy === 'rankings' ? 'Refreshing…' : 'Refresh rankings'}
        </button>
      )}
      {synced && !state.text && (
        <span className="muted small">
          Last pulled <span className="mono">{clock(synced)}</span>
        </span>
      )}
      {state.text && (
        <p className={`pm-sync-note sc-pull-msg ${state.tone}`} role="status">
          {state.text}
        </p>
      )}
    </div>
  );
}

function AddTeam({ teams, event, api, onClose }) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  useEscape(onClose);
  const n = teamNumberOf(number);
  const have = teams.some((t) => t.number === n);
  const save = () => {
    if (!n || have) return;
    api.saveScoutTeam({ number: n, name: name.trim().slice(0, 80), event, source: 'typed', ...(name.trim() ? { nameHand: true } : {}) });
    onClose();
  };
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog sc-add" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add a team">
          <div className="panel-head">
            <h2>Add a team</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <label className="mf-field">
            <span>Team number</span>
            <input className="input mono" value={number} onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} inputMode="numeric" placeholder="12345" autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />
          </label>
          <label className="mf-field">
            <span>Name (optional)</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Team name" onKeyDown={(e) => e.key === 'Enter' && save()} />
          </label>
          {have && <p className="form-error">That team is already on the list.</p>}
          <div className="sc-dialog-btns">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" onClick={save} disabled={!n || have}>
              Add team
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// ---------- Scout a match ----------

function ScoutPage({ teams, matches, event, prefill, myEntries, onSave, onOpenTeam, rename }) {
  const now = Date.now();
  const mine = useMemo(() => [...matches].filter((m) => !m.event || !event || m.event.toUpperCase() === event.toUpperCase()), [matches, event]);
  const recent = [...myEntries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
  return (
    <section className="sc-sec">
      <EntryForm
        key={prefill?.n || 0}
        teams={teams}
        matches={mine}
        initial={{ team: prefill?.team || '', match: prefill?.match || matchToScore(mine, now)?.label || '' }}
        onSave={onSave}
      />
      {recent.length > 0 && (
        <div className="sc-recent">
          <div className="sc-sub-head">
            <h2>You scouted lately</h2>
          </div>
          <ul className="sc-mini">
            {recent.map((e) => (
              <li key={e.id}>
                <button className="sc-mini-row" onClick={() => onOpenTeam(e.team)}>
                  <span className="mono sc-mini-num">{e.team}</span>
                  <span className="grow">
                    {teams.find((t) => t.number === e.team)?.name || ''}
                    <span className="muted small"> {e.match || ''}</span>
                  </span>
                  <span className="muted small">{relTime(e.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------- Team detail ----------

function RatingBars({ sum }) {
  return (
    <div className="sc-bars">
      {RATINGS.map(([id, label]) => {
        const v = sum.ratings[id];
        return (
          <div key={id} className="sc-bar-row">
            <span className="sc-bar-label">{label}</span>
            <span className="sc-bar-track" aria-hidden="true">
              <i style={{ width: `${v == null ? 0 : (v / 5) * 100}%` }} />
            </span>
            <b className="mono sc-bar-n">{fmt(v)}</b>
          </div>
        );
      })}
    </div>
  );
}

const ratingLine = (r) =>
  RATINGS.filter(([id]) => r?.[id]).map(([id, label]) => (
    <span key={id} className="sc-r">
      <span className="sc-r-l">{label.split(' ')[0].slice(0, 4)}</span>
      <b className="mono">{r[id]}</b>
    </span>
  ));

function TeamDetail({ team, entries, actor, isManager, canEdit, rename, api, matches, event, onBack, onScout, picks }) {
  const [notes, setNotes] = useState(team.notes || '');
  const [editing, setEditing] = useState(null);
  useEffect(() => setNotes(team.notes || ''), [team.notes]);
  const topTags = Object.entries(team.sum.tags).sort((a, b) => b[1] - a[1]);
  const saveNotes = () => {
    if (notes.trim() !== (team.notes || '').trim()) api.saveScoutNotes(team.number, notes.trim().slice(0, TEAM_NOTES_MAX));
  };
  const rename_ = async () => {
    const name = await promptDialog({ title: `Name for ${team.number}`, initial: team.name || '', maxLength: 80, okLabel: 'Save' });
    if (name != null) api.saveScoutTeam({ number: team.number, name: name.trim().slice(0, 80), nameHand: true });
  };
  const remove = async () => {
    if (!(await confirmDialog({ title: `Take team ${team.number} off the list?`, body: 'Their scouting notes stay.', okLabel: 'Take off', danger: true }))) return;
    api.deleteScoutTeam(team.number);
    onBack();
  };
  const delEntry = async (e) => {
    if (!(await confirmDialog({ title: 'Delete this scouting note?', okLabel: 'Delete', danger: true }))) return;
    api.deleteScoutEntry(e.id);
  };
  const pickState = (picks.dont || []).includes(team.number) ? 'dont' : (picks.taken || []).includes(team.number) ? 'taken' : (picks.order || []).includes(team.number) ? 'listed' : '';
  const toggle = (key) => {
    const list = picks[key] || [];
    api.saveScoutPicks({ [key]: list.includes(team.number) ? list.filter((n) => n !== team.number) : [...list, team.number] });
  };
  return (
    <section className="sc-detail">
      <button className="text-btn sc-back" onClick={onBack}>
        <Icon name="left" size={16} /> All teams
      </button>
      <div className="sc-d-head">
        <span className="sc-d-num mono">{team.number}</span>
        <div className="sc-d-title">
          <h2>{team.name || 'No name yet'}</h2>
          <p className="muted small">
            {team.city}
            {team.rank?.rank ? (
              <>
                {team.city ? ' · ' : ''}
                <span className="mono">{rankText(team.rank)}</span> · <span className="mono">{team.rank.played}</span> played
              </>
            ) : null}
          </p>
          {team.rank?.rank ? (
            <p className="muted small">
              Tiebreakers <span className="mono">{team.rank.tb1}</span> · <span className="mono">{team.rank.tb2}</span>
            </p>
          ) : null}
        </div>
        <ScoreBadge value={team.score} />
      </div>
      <div className="sc-d-btns">
        <button className="btn primary" onClick={onScout}>
          <Icon name="scout" size={16} /> Scout this team
        </button>
        {isManager && (
          <>
            <button className="btn" onClick={() => toggle('dont')} aria-pressed={pickState === 'dont'}>
              <Icon name="ban" size={16} /> {pickState === 'dont' ? 'Pick them again' : 'Don’t pick'}
            </button>
            <button className="btn" onClick={rename_}>
              <Icon name="edit" size={16} /> Edit name
            </button>
            <button className="btn danger-text" onClick={remove}>
              <Icon name="trash" size={16} /> Take off
            </button>
          </>
        )}
      </div>
      {pickState && (
        <p className="muted small">
          {pickState === 'dont' ? 'On the pick list as don’t pick.' : pickState === 'taken' ? 'Picked by another alliance.' : 'On the pick list.'}
        </p>
      )}

      <div className="sc-d-grid">
        <div>
          <div className="sc-sub-head">
            <h2>Our averages</h2>
            <span className="muted small">
              from <span className="mono">{team.sum.n}</span> {team.sum.n === 1 ? 'note' : 'notes'}
            </span>
          </div>
          {team.sum.n ? <RatingBars sum={team.sum} /> : <p className="sc-empty">Nobody has scouted them yet.</p>}
          {topTags.length > 0 && (
            <div className="sc-tagline">
              {topTags.map(([id, n]) => (
                <span key={id} className={`sc-tag ${tagKind(id)}`}>
                  {tagLabel(id)} <b className="mono">{n}</b>
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="sc-sub-head">
            <h2>Team notes</h2>
          </div>
          <textarea
            className="input sc-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            maxLength={TEAM_NOTES_MAX}
            rows={4}
            placeholder="What they build, how they drive, what to remember at alliance selection."
            aria-label={`Notes on team ${team.number}`}
          />
          {team.notesBy && team.notes ? (
            <p className="muted tiny">
              Last edited by <DisplayName name={team.notesBy} />
              {team.notesAt ? ` ${relTime(team.notesAt)}` : ''}
            </p>
          ) : null}
        </div>
      </div>

      <div className="sc-sub-head">
        <h2>Every look</h2>
      </div>
      {entries.length === 0 ? (
        <p className="sc-empty">Nothing yet.</p>
      ) : (
        <ul className="sc-entries">
          {entries.map((e) =>
            editing === e.id ? (
              <li key={e.id} className="sc-entry editing">
                <EntryForm
                  teams={[team]}
                  matches={matches}
                  initial={{ team: e.team, match: e.match, ratings: e.ratings, tags: e.tags, note: e.note }}
                  editing
                  onCancel={() => setEditing(null)}
                  onSave={(clean) => {
                    api.updateScoutEntry(e.id, { match: clean.match, ratings: clean.ratings, tags: clean.tags, note: clean.note });
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={e.id} className="sc-entry">
                <div className="sc-entry-top">
                  <b className="mono sc-entry-match">{e.match || 'No match'}</b>
                  <span className="muted small">
                    <DisplayName name={e.createdBy || ''} /> · {relTime(e.createdAt)}
                  </span>
                  {canEdit(e) && (
                    <span className="sc-entry-btns">
                      <button className="icon-btn" onClick={() => setEditing(e.id)} aria-label="Edit this note">
                        <Icon name="edit" size={16} />
                      </button>
                      <button className="icon-btn" onClick={() => delEntry(e)} aria-label="Delete this note">
                        <Icon name="trash" size={16} />
                      </button>
                    </span>
                  )}
                </div>
                {Object.keys(e.ratings || {}).length > 0 && <div className="sc-ratings">{ratingLine(e.ratings)}</div>}
                {(e.tags || []).length > 0 && (
                  <div className="sc-tagline">
                    {e.tags.map((t) => (
                      <span key={t} className={`sc-tag ${tagKind(t)}`}>
                        {tagLabel(t)}
                      </span>
                    ))}
                  </div>
                )}
                {e.note && <p className="sc-entry-note">{e.note}</p>}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
