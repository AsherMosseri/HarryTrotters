import { useMemo, useState } from 'react';
import {
  DEFAULT_GRADE,
  GRADE_DEFAULTS,
  GRADES,
  gradeLabel,
  isManagerName,
  ORG_DEFAULTS,
  ORG_GROUPS,
  SUBTEAM_COLORS,
  TEAM_NAME,
  TEAM_NICKNAME,
} from '../config.js';
import { PlusIcon } from './common.jsx';
import { personId } from '../data/diff.js';
import { todayISO } from '../milestones.js';
import { Avatar, CloseIcon } from './common.jsx';

// Team Management sits under the team name with the subteams below it;
// Secretary is a support role that hangs off to the side of Team Management.
const LEAD_GROUP = 'Team Management';
const STAFF_GROUP = 'Secretary';
const EMPTY_ROLE = { title: '', subteams: [], responsibilities: [] };

function SubteamPill({ name }) {
  return (
    <span className="sub-pill" style={{ '--c': SUBTEAM_COLORS[name] || 'var(--accent)' }}>
      {name}
    </span>
  );
}

// person.isNew = adding someone to the team (asks for their name).
// Managers' names are tied to their manager codes in the security rules, so
// they can't be renamed here.
function PersonDialog({ person, taken, onClose, onSave, onRemove }) {
  const [name, setName] = useState(person.name || '');
  const canRename = !person.isNew && !isManagerName(person.name);
  const nameChanged = person.isNew || name.trim() !== person.name;
  const nameTaken = nameChanged && taken.some((n) => n !== person.name && n.toLowerCase() === name.trim().toLowerCase());
  const managerName = nameChanged && isManagerName(name);
  const nameError = nameTaken ? `${name.trim()} is already on the team.` : managerName ? 'That name belongs to a team manager.' : '';
  const [title, setTitle] = useState(person.title || '');
  const [subteams, setSubteams] = useState(person.subteams || []);
  const [resp, setResp] = useState((person.responsibilities || []).join('\n'));
  const [grade, setGrade] = useState(person.grade || DEFAULT_GRADE);
  const toggle = (s) => setSubteams(subteams.includes(s) ? subteams.filter((x) => x !== s) : [...subteams, s]);

  return (
    <div className="panel-backdrop center" onClick={onClose}>
      <form
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || nameError) return;
          onSave({
            name: person.isNew || canRename ? name.trim() : person.name,
            removed: false,
            title: title.trim(),
            grade,
            subteams: ORG_GROUPS.filter((s) => subteams.includes(s)),
            responsibilities: resp
              .split('\n')
              .map((r) => r.replace(/^[-•*]\s*/, '').trim())
              .filter(Boolean),
          });
        }}
      >
        <div className="panel-head">
          {person.isNew ? <h2>Add a person</h2> : <Avatar name={person.name} size={30} />}
          {!person.isNew && <h2>{person.name}</h2>}
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
  );
}

function MemberChip({ p, onEdit }) {
  const inner = (
    <>
      <Avatar name={p.name} size={26} />
      <span>
        <b>{p.name}</b>
        {p.title && <small>{p.title}</small>}
      </span>
    </>
  );
  // Only the manager can open the editor.
  return onEdit ? (
    <button className="org-member" onClick={() => onEdit(p)}>
      {inner}
    </button>
  ) : (
    <div className="org-member">{inner}</div>
  );
}

export default function TeamView({ roster, roles, tasks, api, isManager, rename }) {
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
            <MemberChip key={p.name} p={p} onEdit={onEdit} />
          ))}
          {!members.length && <span className="muted small">No one yet</span>}
        </div>
      </div>
    );
  };
  const unassigned = people.filter((p) => !p.subteams.length);

  return (
    <main className="content team">
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
                  <MemberChip key={p.name} p={p} onEdit={onEdit} />
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
                <MemberChip key={p.name} p={p} onEdit={onEdit} />
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="row gap team-heading-row">
        <h2 className="team-heading grow">Responsibilities</h2>
        {isManager ? (
          <button className="btn primary" onClick={() => setEditing({ isNew: true, title: '', subteams: [], responsibilities: [] })}>
            <PlusIcon /> Add person
          </button>
        ) : (
          <span className="muted small">Only team management can change roles.</span>
        )}
      </div>
      <section className="people-grid">
        {people.map((p) => (
          <article key={p.name} className="person-card">
            <header>
              <Avatar name={p.name} size={40} />
              <div className="grow">
                <h3>{p.name}</h3>
                <div className="muted small">
                  {p.title || 'Team member'} · {gradeLabel(p.grade)}
                </div>
              </div>
              {isManager && (
                <button className="link-btn" onClick={() => setEditing(p)}>
                  Edit
                </button>
              )}
            </header>
            <div className="sub-pills">
              {p.subteams.map((s) => (
                <SubteamPill key={s} name={s} />
              ))}
            </div>
            {p.responsibilities.length ? (
              <ul className="resp">
                {p.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No responsibilities listed yet.</p>
            )}
            <footer className="small">
              <span className="muted">
                {p.open} open task{p.open === 1 ? '' : 's'}
              </span>
              {p.overdue > 0 && <span className="overdue-count">{p.overdue} overdue</span>}
            </footer>
          </article>
        ))}
      </section>

      {editing && (
        <PersonDialog
          person={editing}
          taken={roster}
          onClose={() => setEditing(null)}
          onRemove={
            editing.isNew || isManagerName(editing.name)
              ? null
              : async () => {
                  if (
                    !confirm(`Remove ${editing.name} from the team? Their tasks stay, but they disappear from the org chart and pickers.`)
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
          onSave={async (data) => {
            const p = editing;
            setEditing(null);
            if (p.isNew || data.name === p.name) await api.saveRole(data);
            else await api.renamePerson(p.name, data.name, data);
          }}
        />
      )}
    </main>
  );
}
