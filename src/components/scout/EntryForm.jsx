import { useMemo, useRef, useState } from 'react';
import { Icon } from '../shell/icons.jsx';
import { sortMatches } from '../../../functions/shared/matches.js';
import { NOTE_MAX, RATINGS, TAGS, cleanEntry, entryHasContent, matchLabelOf, nextMatchLabel, teamNumberOf } from '../../../functions/shared/scout.js';

// The scouting form: big taps, nothing to wait for. Used for a new look (it
// clears itself after saving, keeping the match) and to fix an old one.
export function EntryForm({ teams, matches, initial, editing = false, onSave, onCancel }) {
  const [match, setMatch] = useState(initial.match || '');
  const [team, setTeam] = useState(initial.team ? String(initial.team) : '');
  const [ratings, setRatings] = useState(initial.ratings || {});
  const [tags, setTags] = useState(initial.tags || []);
  const [note, setNote] = useState(initial.note || '');
  const [saved, setSaved] = useState(null);
  const teamBox = useRef(null);

  const label = matchLabelOf(match);
  // A number (or #number); a name only narrows the list below.
  const n = /^#?\s*\d{1,5}$/.test(team.trim()) ? teamNumberOf(team) : 0;
  const known = teams.find((t) => t.number === n);
  const ours = useMemo(() => sortMatches(matches).filter((m) => m.label), [matches]);
  const here = ours.find((m) => m.label === label);
  // Teams in that match, when it's one of ours.
  const inMatch = here
    ? [...(here.partners || []).map((t) => [t, 'With us']), ...(here.opponents || []).map((t) => [t, 'Against us'])]
    : [];
  // Typing a number or part of a name narrows the list.
  const query = team.trim().toLowerCase();
  const found = useMemo(() => {
    if (editing || !query || (known && String(known.number) === query)) return [];
    return teams
      .filter((t) => String(t.number).startsWith(query.replace(/^#/, '')) || (t.name || '').toLowerCase().includes(query))
      .slice(0, 6);
  }, [teams, query, known, editing]);

  const clean = cleanEntry({ team: n, match, ratings, tags, note });
  const ready = !!clean.team && entryHasContent(clean);
  const rate = (id, v) => setRatings((r) => (r[id] === v ? Object.fromEntries(Object.entries(r).filter(([k]) => k !== id)) : { ...r, [id]: v }));
  const tag = (id) => setTags((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  const save = () => {
    if (!ready) return;
    onSave(clean);
    if (editing) return;
    setSaved({ team: clean.team, match: clean.match, name: known?.name || '' });
    setTeam('');
    setRatings({});
    setTags([]);
    setNote('');
    // Back to the team box for the next one.
    setTimeout(() => teamBox.current?.focus({ preventScroll: true }), 0);
    window.scrollTo?.({ top: 0 });
  };
  const step = (by) => {
    const cur = /^Q(\d+)$/.exec(label || '');
    const num = cur ? Number(cur[1]) + by : 1;
    setMatch(`Q${Math.max(1, Math.min(999, num))}`);
  };

  return (
    <div className={`sc-form${editing ? ' editing' : ''}`}>
      {!editing && (
        <>
          <div className="sc-f-row">
            <label className="mf-field small sc-match">
              <span>Match</span>
              <div className="sc-stepper">
                <button type="button" className="sc-step" onClick={() => step(-1)} aria-label="One match back">
                  <Icon name="left" size={18} />
                </button>
                <input
                  className="input mono"
                  value={match}
                  onChange={(e) => setMatch(e.target.value.toUpperCase().slice(0, 8))}
                  onBlur={() => setMatch(matchLabelOf(match) || match.trim())}
                  placeholder="Q12"
                  aria-label="Match"
                  autoCapitalize="characters"
                />
                <button type="button" className="sc-step" onClick={() => step(1)} aria-label="One match forward">
                  <Icon name="right" size={18} />
                </button>
              </div>
            </label>
            <label className="mf-field sc-team-in">
              <span>Team</span>
              <input
                ref={teamBox}
                className="input mono"
                value={team}
                onChange={(e) => setTeam(e.target.value.slice(0, 40))}
                placeholder="Number or name"
                inputMode="search"
                aria-label="Team"
              />
            </label>
          </div>
          {ours.length > 0 && (
            <div className="sc-chips" role="group" aria-label="Our matches">
              <span className="sc-chips-l">Ours</span>
              {ours.slice(0, 12).map((m) => (
                <button key={m.id} type="button" className={`sc-chip mono${m.label === label ? ' on' : ''}`} onClick={() => setMatch(m.label)}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {inMatch.length > 0 && !known && (
            <div className="sc-chips" role="group" aria-label={`Teams in ${label}`}>
              <span className="sc-chips-l">In {label}</span>
              {inMatch.map(([t, role]) => (
                <button key={t} type="button" className="sc-chip" onClick={() => setTeam(String(t))} title={role}>
                  <span className="mono">{t}</span> <span className="muted small">{role}</span>
                </button>
              ))}
            </div>
          )}
          {found.length > 0 && (
            <div className="sc-chips" role="group" aria-label="Teams">
              {found.map((t) => (
                <button key={t.number} type="button" className="sc-chip" onClick={() => setTeam(String(t.number))}>
                  <span className="mono">{t.number}</span> {t.name}
                </button>
              ))}
            </div>
          )}
          {n > 0 && !known && !found.length && <p className="muted small sc-hint">Team {n} isn’t on the list yet. It will be added when you save.</p>}
          {known && (
            <p className="sc-picked">
              <b className="mono">{known.number}</b> {known.name}
            </p>
          )}
        </>
      )}

      {RATINGS.map(([id, name]) => (
        <div key={id} className="sc-rate" role="group" aria-label={name}>
          <span className="sc-rate-l">{name}</span>
          <div className="sc-rate-btns">
            {[1, 2, 3, 4, 5].map((v) => (
              <button key={v} type="button" className={`sc-rate-btn mono${ratings[id] === v ? ' on' : ''}`} aria-pressed={ratings[id] === v} aria-label={`${name} ${v}`} onClick={() => rate(id, v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="sc-tags" role="group" aria-label="Tags">
        {TAGS.map(([id, name, kind]) => (
          <button key={id} type="button" className={`sc-tagbtn ${kind}${tags.includes(id) ? ' on' : ''}`} aria-pressed={tags.includes(id)} onClick={() => tag(id)}>
            {tags.includes(id) && <Icon name="check" size={16} />}
            {name}
          </button>
        ))}
      </div>

      <label className="mf-field">
        <span>One line</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))} placeholder="Anything to remember" maxLength={NOTE_MAX} aria-label="Note" onKeyDown={(e) => e.key === 'Enter' && save()} />
      </label>

      <div className="sc-f-foot">
        {saved && !editing && (
          <p className="sc-saved" role="status">
            <Icon name="check" size={16} /> Saved <b className="mono">{saved.team}</b>
            {saved.match ? ` in ${saved.match}` : ''}.
            {nextMatchLabel(saved.match) && (
              <button type="button" className="text-btn" onClick={() => (setMatch(nextMatchLabel(saved.match)), setSaved(null))}>
                Next match ({nextMatchLabel(saved.match)})
              </button>
            )}
          </p>
        )}
        {editing && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="btn primary sc-save" onClick={save} disabled={!ready}>
          {editing ? 'Save changes' : 'Save and next'}
        </button>
      </div>
      {!editing && !ready && <p className="muted small sc-need">{!clean.team ? 'Pick a team, then tap some ratings or tags.' : 'Tap a rating, a tag, or write a line.'}</p>}
    </div>
  );
}
