import { useRef, useState } from 'react';
import { Icon } from './shell/icons.jsx';
import { CloseIcon, Overlay, PlusIcon } from './common.jsx';
import { useEscape } from '../util.js';
import { confirmDialog } from './Dialogs.jsx';
import ServerButton from './ServerButton.jsx';
import { parseDay } from '../milestones.js';
import {
  COMP_KINDS,
  COMP_LIMITS,
  cleanCode,
  compDates,
  compStatus,
  compSub,
  mergeFtcEvents,
  newCompetitionId,
  splitCompetitions,
  whenText,
  withCompetition,
} from '../competitions.js';

// The season's competitions (3.2.11), opened from the Milestones header and
// Today's countdown. Everyone sees them: upcoming ones with days to go, past
// ones folded below. Team management adds, edits and deletes them, or pulls
// the team's registered events from FTC Events. They live on
// settings/team.competitions (functions/shared/competitions.js has the rules).

function CompCard({ c, today, isManager, onEdit }) {
  const status = compStatus(c, today);
  const sub = compSub(c);
  const day = parseDay(c.start);
  return (
    <li className={`cm-card ${status}`}>
      <span className="cm-date" aria-hidden="true">
        <small>{day.toLocaleDateString(undefined, { month: 'short' })}</small>
        <b>{day.getDate()}</b>
      </span>
      <span className="cm-main">
        <span className="cm-name">{c.name}</span>
        <span className="cm-when">
          {compDates(c)}
          {whenText(c, today) && <span className={`cm-left ${status}`}>{whenText(c, today)}</span>}
        </span>
        {(sub || c.code) && (
          <span className="cm-sub">
            {sub}
            {c.code && <span className="cm-code mono">{c.code}</span>}
          </span>
        )}
        {c.note && <span className="cm-note">{c.note}</span>}
      </span>
      {isManager && (
        <button className="icon-btn small cm-edit" onClick={() => onEdit(c)} aria-label={`Edit ${c.name}`} title="Edit">
          <Icon name="edit" size={16} />
        </button>
      )}
    </li>
  );
}

function CompForm({ initial, onSave, onCancel, onDelete }) {
  const [f, setF] = useState(() => ({ name: '', kind: '', start: '', end: '', place: '', code: '', note: '', ...initial }));
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const badEnd = !!f.end && !!f.start && f.end < f.start;
  const ok = f.name.trim() && f.start && !badEnd;
  return (
    <form
      className="cm-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSave(f);
      }}
    >
      <h3 className="cm-form-title">{initial.id ? 'Edit competition' : 'New competition'}</h3>
      <div className="fields">
        <label className="field-label" htmlFor="cm-name">
          Name
        </label>
        <input
          id="cm-name"
          className="input"
          autoFocus={!initial.id}
          value={f.name}
          maxLength={COMP_LIMITS.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. NYC Qualifier"
        />
        <label className="field-label" htmlFor="cm-kind">
          Kind
        </label>
        <select id="cm-kind" className="input" value={f.kind || ''} onChange={(e) => set({ kind: e.target.value })}>
          <option value="">Competition</option>
          {COMP_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <label className="field-label" htmlFor="cm-start">
          Starts
        </label>
        <input
          id="cm-start"
          className="input"
          type="date"
          value={f.start}
          onChange={(e) => set({ start: e.target.value, ...(f.end && e.target.value && f.end < e.target.value ? { end: '' } : {}) })}
          required
        />
        <label className="field-label" htmlFor="cm-end">
          Last day
        </label>
        <div className="cm-end">
          <input id="cm-end" className="input" type="date" value={f.end || ''} min={f.start || undefined} onChange={(e) => set({ end: e.target.value })} />
          {f.end ? (
            <button type="button" className="link-btn" onClick={() => set({ end: '' })}>
              One day
            </button>
          ) : (
            <span className="muted small">Only for events longer than a day</span>
          )}
        </div>
        <label className="field-label" htmlFor="cm-place">
          Place
        </label>
        <input id="cm-place" className="input" value={f.place || ''} maxLength={COMP_LIMITS.place} onChange={(e) => set({ place: e.target.value })} placeholder="Optional" />
        <label className="field-label" htmlFor="cm-code">
          Event code
        </label>
        <input
          id="cm-code"
          className="input mono"
          value={f.code || ''}
          maxLength={COMP_LIMITS.code}
          onChange={(e) => set({ code: cleanCode(e.target.value) })}
          placeholder="Optional, from FTC Events"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
        <label className="field-label" htmlFor="cm-note">
          Note
        </label>
        <textarea id="cm-note" className="input cm-note-input" rows={2} value={f.note || ''} maxLength={COMP_LIMITS.note} onChange={(e) => set({ note: e.target.value })} placeholder="Optional: arrive by 7:30, bring the spare hub…" />
      </div>
      {badEnd && <p className="form-error">The last day is before the first.</p>}
      <div className="row gap cm-form-actions">
        {onDelete && (
          <button type="button" className="link-btn danger" onClick={onDelete}>
            Delete
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" disabled={!ok}>
          {initial.id ? 'Save' : 'Add'}
        </button>
      </div>
    </form>
  );
}

// "Add from FTC Events": the team's registered events this season, all at
// once, skipping ones already on the list (same event code).
function FtcImport({ listRef, api, save }) {
  const [state, setState] = useState({ busy: false, text: '', tone: '' });
  const run = async () => {
    setState({ busy: true, text: '', tone: '' });
    try {
      const r = await api.ftcEvents({ action: 'events' });
      if (r?.notSetUp)
        return setState({ text: 'FTC Events isn’t connected yet: it needs the team’s API key, which Asher is setting up. Add competitions by hand for now.', tone: 'warn' });
      if (r?.error) return setState({ text: r.error, tone: 'bad' });
      const events = r?.events || [];
      if (!events.length) return setState({ text: 'FTC Events has no events for us this season yet. Add them by hand, or try again once we’re registered.', tone: 'warn' });
      const { list, added, skipped } = mergeFtcEvents(listRef.current, events);
      if (added.length) await save(list);
      const already = skipped ? ` ${skipped} ${skipped === 1 ? 'was' : 'were'} already on the list.` : '';
      setState({
        text: added.length ? `Added ${added.length} ${added.length === 1 ? 'competition' : 'competitions'} from FTC Events.${already}` : `Everything from FTC Events is already on the list.`,
        tone: 'good',
      });
    } catch (e) {
      setState({ text: e?.message ? `Couldn’t get the events: ${e.message}` : 'Couldn’t reach FTC Events. Add competitions by hand for now.', tone: 'bad' });
    }
  };
  return (
    <>
      <ServerButton className="btn" onClick={run} disabled={state.busy}>
        <Icon name="signal" size={16} /> {state.busy ? 'Getting events…' : 'Add from FTC Events'}
      </ServerButton>
      {state.text && (
        <p className={`pm-sync-note cm-sync ${state.tone}`} role="status">
          {state.text}
        </p>
      )}
    </>
  );
}

export default function CompetitionsDialog({ list, today, isManager, api, onToast, onClose }) {
  const [editing, setEditing] = useState(null); // {} for a new one, or the competition
  useEscape(() => (editing ? setEditing(null) : onClose()));
  const listRef = useRef(list);
  listRef.current = list;
  const { upcoming, past } = splitCompetitions(list, today);
  const save = (next) => api.saveSettings({ competitions: next });
  const remove = async (c) => {
    if (
      !(await confirmDialog({
        title: `Delete “${c.name}”?`,
        body: `${compDates(c)}. It comes off the list for everyone.`,
        okLabel: 'Delete',
        danger: true,
      }))
    )
      return;
    await save(withCompetition(listRef.current, c.id, null));
    setEditing(null);
    onToast?.(`Deleted ${c.name}.`);
  };

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog cm-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Competitions">
          <div className="panel-head">
            <h2>Competitions</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>

          {editing ? (
            <CompForm
              key={editing.id || 'new'}
              initial={editing}
              onCancel={() => setEditing(null)}
              onDelete={editing.id ? () => remove(editing) : null}
              onSave={async (f) => {
                const id = editing.id || newCompetitionId();
                await save(withCompetition(listRef.current, id, { ...f, end: f.end && f.end > f.start ? f.end : '' }));
                setEditing(null);
                onToast?.(editing.id ? `Saved ${f.name.trim()}.` : `Added ${f.name.trim()}.`);
              }}
            />
          ) : (
            <>
              {isManager && (
                <div className="cm-actions">
                  <button className="btn primary" onClick={() => setEditing({})}>
                    <PlusIcon /> Add
                  </button>
                  <FtcImport listRef={listRef} api={api} save={save} />
                </div>
              )}

              <h3 className="cm-sec">Coming up</h3>
              {upcoming.length ? (
                <ul className="cm-list">
                  {upcoming.map((c) => (
                    <CompCard key={c.id} c={c} today={today} isManager={isManager} onEdit={setEditing} />
                  ))}
                </ul>
              ) : (
                <div className="cm-empty">
                  <p className="muted">{isManager ? 'Nothing on the calendar. Add the next competition, or pull the team’s events from FTC Events.' : 'Nothing on the calendar yet. Team management adds competitions here.'}</p>
                  {isManager && (
                    <button className="btn" onClick={() => setEditing({})}>
                      <PlusIcon /> Add the next competition
                    </button>
                  )}
                </div>
              )}

              {past.length > 0 && (
                <details className="cm-past">
                  <summary>
                    Past <span className="mono">{past.length}</span>
                  </summary>
                  <ul className="cm-list">
                    {past.map((c) => (
                      <CompCard key={c.id} c={c} today={today} isManager={isManager} onEdit={setEditing} />
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}

