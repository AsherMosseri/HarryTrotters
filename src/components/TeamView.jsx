import { useMemo, useState } from 'react';
import {
  DEFAULT_GRADE,
  GRADE_DEFAULTS,
  GRADES,
  gradeLabel,
  isManagerName,
  cleanName,
  knownName,
  sameName,
  ORG_DEFAULTS,
  ORG_GROUPS,
  SUBTEAM_COLORS,
  TEAM_NAME,
  TEAM_NICKNAME,
} from '../config.js';
import { Overlay, PlusIcon } from './common.jsx';
import { personId } from '../data/diff.js';
import { todayISO } from '../milestones.js';
import { Avatar, CloseIcon } from './common.jsx';
import { relTime, useEscape } from '../util.js';
import { confirmDialog } from './Dialogs.jsx';
import { Icon } from './shell/icons.jsx';
import { lastLabText } from '../../functions/shared/activity.js';

// Team Management sits under the team name with the subteams below it;
// Secretary is a support role that hangs off to the side of Team Management.
const LEAD_GROUP = 'Team Management';
const STAFF_GROUP = 'Secretary';
const EMPTY_ROLE = { title: '', subteams: [], responsibilities: [] };

// Inactive members (functions/shared/activity.js): team management can keep
// someone active or mark them inactive; Automatic follows the 3-week rule.
const MODES = [
  ['', 'Automatic'],
  ['active', 'Keep active'],
  ['inactive', 'Inactive'],
];
// The mode a person is in now: a manual "inactive" they've clocked in since
// no longer counts, so it shows as Automatic.
const modeOf = (act) => (act?.override === 'active' ? 'active' : act?.why === 'manual' ? 'inactive' : '');
const whyText = (act) => (act.why === 'manual' ? 'Marked inactive' : act.lastAt ? 'No lab time for 3 weeks' : 'Hasn’t come to the lab yet');

function StatusField({ act, mode, setMode }) {
  const note =
    mode === 'active'
      ? 'Stays active even with no lab time.'
      : mode === 'inactive'
        ? 'Off the leaderboards, and lab check-ins and required polls don’t ask them. Nothing is deleted. Clocking in makes them active again.'
        : `Inactive after 3 weeks with no lab time.${act?.inactive && act.why === 'auto' ? ' Inactive now.' : ''}`;
  return (
    <>
      <span className="field-label">Status</span>
      <div className="segmented status-modes" role="radiogroup" aria-label="Status">
        {MODES.map(([id, label]) => (
          <button
            type="button"
            key={id || 'auto'}
            role="radio"
            aria-checked={mode === id}
            className={`plain-seg${mode === id ? ' on' : ''}`}
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="muted small status-note">
        {note} {lastLabText(act?.lastAt || 0)}.
      </p>
    </>
  );
}

// person.isNew = adding someone to the team (asks for their name).
// Managers' names are the team management list (functions/shared/team.js),
// so they can't be renamed here.
function PersonDialog({ person, taken, act, onClose, onSave, onRemove, onPerson }) {
  useEscape(onClose);
  const [name, setName] = useState(person.name || '');
  const canRename = !person.isNew && !isManagerName(person.name);
  const nameChanged = person.isNew || name.trim() !== person.name;
  const nameTaken = nameChanged && taken.some((n) => n !== person.name && sameName(n, name));
  const managerName = nameChanged && isManagerName(name);
  const nameError = nameTaken ? `${knownName(name, taken)} is already on the team.` : managerName ? 'That name belongs to a team manager.' : '';
  const [title, setTitle] = useState(person.title || '');
  const [subteams, setSubteams] = useState(person.subteams || []);
  const [resp, setResp] = useState((person.responsibilities || []).join('\n'));
  const [grade, setGrade] = useState(person.grade || DEFAULT_GRADE);
  const toggle = (s) => setSubteams(subteams.includes(s) ? subteams.filter((x) => x !== s) : [...subteams, s]);
  // Team management themselves are never inactive, so no status for them.
  const [mode, setMode] = useState(modeOf(act));

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <form
          className="dialog"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || nameError) return;
            onSave(
              {
                name: person.isNew || canRename ? cleanName(name) : person.name,
                removed: false,
                title: title.trim(),
                grade,
                subteams: ORG_GROUPS.filter((s) => subteams.includes(s)),
                responsibilities: resp
                  .split('\n')
                  .map((r) => r.replace(/^[-•*]\s*/, '').trim())
                  .filter(Boolean),
              },
              act && mode !== modeOf(act) ? mode : null,
            );
          }}
        >
          <div className="panel-head">
            {person.isNew ? (
              <h2>Add a person</h2>
            ) : (
              <button type="button" className="pd-who" onClick={() => onPerson?.(person.name)} title="Open their profile">
                <Avatar name={person.name} size={30} />
                <h2>{person.name}</h2>
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {(person.isNew || canRename) && (
            <>
              {canRename && (
                <label className="field-label" htmlFor="p-name">
                  Name
                </label>
              )}
              <input
                id="p-name"
                className="input big"
                autoFocus={person.isNew}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                maxLength={60}
              />
            </>
          )}
          {canRename && name.trim() && name.trim() !== person.name && !nameError && (
            <p className="muted small">Their tasks, milestones, and org chart entry will switch to “{name.trim()}”.</p>
          )}
          {nameError && <p className="form-error">{nameError}</p>}
          <div className="fields">
            <label className="field-label" htmlFor="p-title">
              Role
            </label>
            <input
              id="p-title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Captain, CAD Lead, Secretary"
            />
            <label className="field-label" htmlFor="p-grade">
              Grade
            </label>
            <select id="p-grade" className="input" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {gradeLabel(g)}
                </option>
              ))}
            </select>
            <span className="field-label">Subteams</span>
            <div className="assignee-picker">
              {ORG_GROUPS.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`person sub-toggle${subteams.includes(s) ? ' on' : ''}`}
                  style={{ '--c': SUBTEAM_COLORS[s] }}
                  onClick={() => toggle(s)}
                >
                  <span className="dot" /> {s}
                </button>
              ))}
            </div>
          </div>
          <label className="field-label" htmlFor="p-resp">
            Responsibilities — one per line
          </label>
          <textarea
            id="p-resp"
            className="input description"
            rows={5}
            value={resp}
            onChange={(e) => setResp(e.target.value)}
            placeholder={'Builds and maintains the intake\nKeeps the parts inventory'}
          />
          {act && <StatusField act={act} mode={mode} setMode={setMode} />}
          <div className="row gap end">
            {onRemove && (
              <button type="button" className="link-btn danger" onClick={onRemove}>
                Remove from team
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!name.trim() || !!nameError}>
              {person.isNew ? 'Add to team' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}

function MemberChip({ p, onEdit, onPerson }) {
  const inner = (
    <>
      <Avatar name={p.name} size={26} />
      <span>
        <b>{p.name}</b>
        {p.title && <small>{p.title}</small>}
      </span>
    </>
  );
  // The manager opens the editor; everyone else, the person's profile.
  return (
    <button className="org-member" onClick={() => (onEdit ? onEdit(p) : onPerson?.(p.name))}>
      {inner}
    </button>
  );
}

// Team management: new names waiting to be let in (they can't see or do
// anything until then). Approve puts them on the Roster; Turn away signs
// them out and frees the name.
function JoinRequests({ requests, api }) {
  const [busy, setBusy] = useState('');
  const answer = async (r, approve) => {
    if (
      !approve &&
      !(await confirmDialog({
        title: `Turn ${r.name} away?`,
        body: 'They’re signed out and the name is free again. They can ask again with the team code.',
        okLabel: 'Turn away',
        danger: true,
      }))
    )
      return;
    setBusy(r.id);
    await api.answerJoin(r.name, approve);
    setBusy('');
  };
  return (
    <section className="join-reqs" aria-label="Waiting to join">
      <div className="sec-head">
        <h2>
          Waiting to join <span className="mono">{requests.length}</span>
        </h2>
      </div>
      <ul>
        {requests.map((r) => (
          <li key={r.id} className="join-req">
            <Avatar name={r.name} size={34} />
            <div className="join-req-who">
              <b>{r.name}</b>
              <span>
                New name · signed in <span className="mono">{relTime(r.at)}</span>
              </span>
            </div>
            <div className="join-req-btns">
              <button className="btn" disabled={busy === r.id} onClick={() => answer(r, false)}>
                Turn away
              </button>
              <button className="btn primary" disabled={busy === r.id} onClick={() => answer(r, true)}>
                <Icon name="check" size={16} /> Approve
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small">Approve only people you know. Until then they can’t see or do anything in the app.</p>
    </section>
  );
}

// Team management: people who haven't come to the lab for 3 weeks, or who
// they marked inactive (functions/shared/activity.js), folded at the bottom.
// Teammates don't see this; for them the Roster stays as it was.
function InactiveSection({ people, activity, onEdit, onPerson, onKeep }) {
  const [busy, setBusy] = useState('');
  return (
    <details className="roster-inactive">
      <summary>
        <h2 className="team-heading">
          Inactive <span className="mono">{people.length}</span>
        </h2>
      </summary>
      <p className="muted small">
        No lab time for 3 weeks, or marked inactive. They’re off the leaderboards, and lab check-ins and required polls don’t ask them. Their
        account, coins, pets and chats stay. Clocking in makes them active again.
      </p>
      <ul className="roster-list">
        {people.map((p) => {
          const act = activity.get(p.name);
          return (
            <li key={p.name} className="roster-row roster-row-inactive">
              <button className="roster-pic" onClick={() => onPerson?.(p.name)} aria-label={`${p.name}'s profile`}>
                <Avatar name={p.name} size={34} />
              </button>
              <div className="roster-who">
                <button className="roster-name" onClick={() => onPerson?.(p.name)}>
                  {p.name}
                </button>
                <span>
                  {lastLabText(act.lastAt)} · {whyText(act)}
                </span>
              </div>
              <div className="roster-inactive-btns">
                <button
                  className="btn small-btn"
                  disabled={busy === p.name}
                  onClick={async () => {
                    setBusy(p.name);
                    await onKeep(p.name);
                    setBusy('');
                  }}
                >
                  Keep active
                </button>
                <button className="link-btn" onClick={() => onEdit(p)}>
                  Edit
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export default function TeamView({ roster, activity = new Map(), joinRequests = [], roles, tasks, api, isManager, rename, onPerson }) {
  const [editing, setEditing] = useState(null);
  const today = todayISO();

  // Starting roles, keyed by each person's current name.
  const defaults = useMemo(() => Object.fromEntries(Object.entries(ORG_DEFAULTS).map(([k, v]) => [rename(k), v])), [rename]);
  const grades = useMemo(() => Object.fromEntries(Object.entries(GRADE_DEFAULTS).map(([k, v]) => [rename(k), v])), [rename]);

  const people = useMemo(() => {
    const saved = Object.fromEntries(roles.map((r) => [r.id, r]));
    return roster.map((name) => {
      const role = saved[personId(name)] || defaults[name] || EMPTY_ROLE;
      const mine = tasks.filter((t) => t.status !== 'done' && (t.assignees || []).includes(name));
      return {
        name,
        ...(role.addedAt && { addedAt: role.addedAt }),
        title: role.title || '',
        grade: role.grade || grades[name] || DEFAULT_GRADE,
        subteams: role.subteams || [],
        responsibilities: role.responsibilities || [],
        open: mine.length,
        overdue: mine.filter((t) => t.dueDate && t.dueDate < today).length,
      };
    });
  }, [roster, roles, tasks, today, defaults, grades]);

  const inTeam = (s) => people.filter((p) => p.subteams.includes(s));
  const onEdit = isManager ? setEditing : null;
  const groups = ORG_GROUPS.filter((s) => s !== LEAD_GROUP && s !== STAFF_GROUP).map((s) => ({ name: s, members: inTeam(s) }));
  const groupBox = (name, className = '') => {
    const members = inTeam(name);
    return (
      <div className={`org-box ${className}`} style={{ '--c': SUBTEAM_COLORS[name] }}>
        <h3>{name}</h3>
        <div className="org-members">
          {members.map((p) => (
            <MemberChip key={p.name} p={p} onEdit={onEdit} onPerson={onPerson} />
          ))}
          {!members.length && <span className="muted small">No one yet</span>}
        </div>
      </div>
    );
  };
  const unassigned = people.filter((p) => !p.subteams.length);
  // Team management: inactive people fold away at the bottom.
  const actOf = (n) => (isManager && !isManagerName(n) ? activity.get(n) : null);
  const inactivePeople = isManager
    ? people.filter((p) => actOf(p.name)?.inactive).sort((a, b) => (actOf(b.name).lastAt || 0) - (actOf(a.name).lastAt || 0))
    : [];
  const listed = inactivePeople.length ? people.filter((p) => !actOf(p.name)?.inactive) : people;

  return (
    <main className="content team">
      {isManager && joinRequests.length > 0 && <JoinRequests requests={joinRequests} api={api} />}
      <section className="org">
        <div className="org-root">
          <b>{TEAM_NAME}</b>
          <span>{TEAM_NICKNAME}</span>
        </div>
        <div className="org-stem" />
        {groupBox(LEAD_GROUP, 'org-lead')}
        <div className="org-staff-row">
          <span />
          <span className="org-staff-stem" />
          <div className="org-staff">
            <span className="org-staff-line" />
            {groupBox(STAFF_GROUP, 'org-secretary')}
          </div>
        </div>
        <div className="org-stem" />
        <div className="org-branches">
          {groups.map((g) => (
            <div key={g.name} className="org-box" style={{ '--c': SUBTEAM_COLORS[g.name] }}>
              <h3>{g.name}</h3>
              <div className="org-members">
                {g.members.map((p) => (
                  <MemberChip key={p.name} p={p} onEdit={onEdit} onPerson={onPerson} />
                ))}
                {!g.members.length && <span className="muted small">No one yet</span>}
              </div>
            </div>
          ))}
        </div>
        {unassigned.length > 0 && (
          <div className="org-box org-unassigned">
            <h3>No subteam yet</h3>
            <div className="org-members">
              {unassigned.map((p) => (
                <MemberChip key={p.name} p={p} onEdit={onEdit} onPerson={onPerson} />
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="row gap team-heading-row">
        <h2 className="team-heading grow">People</h2>
        {isManager ? (
          <button className="btn primary" onClick={() => setEditing({ isNew: true, title: '', subteams: [], responsibilities: [] })}>
            <PlusIcon /> Add person
          </button>
        ) : (
          <span className="muted small">Only team management can change roles.</span>
        )}
      </div>
      <ul className="roster-list">
        {listed.map((p) => (
          <li key={p.name} className="roster-row">
            <button className="roster-pic" onClick={() => onPerson?.(p.name)} aria-label={`${p.name}'s profile`}>
              <Avatar name={p.name} size={34} />
            </button>
            <div className="roster-who">
              <button className="roster-name" onClick={() => onPerson?.(p.name)}>
                {p.name}
              </button>
              <span>
                {p.title || 'Team member'} · {gradeLabel(p.grade)}
                {actOf(p.name)?.kept && ' · Kept active'}
              </span>
            </div>
            <div className="roster-teams">
              {p.subteams.map((sub) => (
                <span key={sub} style={{ '--c': SUBTEAM_COLORS[sub] || 'var(--muted)' }}>
                  {sub}
                </span>
              ))}
            </div>
            <div className="roster-resp">{p.responsibilities.join(', ') || <span className="muted">Nothing listed</span>}</div>
            <div className="roster-tasks">
              {p.open} open
              {p.overdue > 0 && <span className="overdue-count"> · {p.overdue} overdue</span>}
            </div>
            {isManager && (
              <button className="link-btn" onClick={() => setEditing(p)}>
                Edit
              </button>
            )}
          </li>
        ))}
      </ul>

      {inactivePeople.length > 0 && (
        <InactiveSection
          people={inactivePeople}
          activity={activity}
          onEdit={setEditing}
          onPerson={onPerson}
          onKeep={(name) => api.setActiveMode(name, 'active')}
        />
      )}

      {editing && (
        <PersonDialog
          person={editing}
          taken={roster}
          act={editing.isNew ? null : actOf(editing.name)}
          onClose={() => setEditing(null)}
          onPerson={(n) => {
            setEditing(null);
            onPerson?.(n);
          }}
          onRemove={
            editing.isNew || isManagerName(editing.name)
              ? null
              : async () => {
                  if (
                    !(await confirmDialog({
                      title: `Remove ${editing.name} from the team?`,
                      body: 'They’re signed out everywhere and their password is deleted. They leave the org chart and pickers, but their messages, tasks, shifts and coins stay. If they sign in again, they wait for you to let them in.',
                      okLabel: 'Remove',
                      danger: true,
                    }))
                  )
                    return;
                  const p = editing;
                  setEditing(null);
                  await api.saveRole({
                    name: p.name,
                    title: p.title,
                    grade: p.grade,
                    subteams: p.subteams,
                    responsibilities: p.responsibilities,
                    removed: true,
                  });
                }
          }
          onSave={async (form, mode) => {
            const p = editing;
            setEditing(null);
            // When they were added (activity.js gives new people 3 weeks to come).
            const data = { ...form, addedAt: p.isNew ? Date.now() : p.addedAt };
            if (!data.addedAt) delete data.addedAt;
            if (p.isNew || data.name === p.name) await api.saveRole(data);
            else await api.renamePerson(p.name, data.name, data);
            if (mode !== null) await api.setActiveMode(data.name, mode);
          }}
        />
      )}
    </main>
  );
}
