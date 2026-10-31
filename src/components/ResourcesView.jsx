import { useState } from 'react';
import { BUILTIN_RESOURCES, LINK_KINDS, guessKind, kindOf } from '../resources.js';
import { fullTime } from '../util.js';
import ElectricalEditor, { DiagramPreview } from './ElectricalEditor.jsx';
import { useFeature } from '../controls.js';
import { Icon } from './shell/icons.jsx';
import { PlusIcon } from './common.jsx';
import { confirmDialog } from './Dialogs.jsx';

const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
const normalizeUrl = (u) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : `https://${u.trim()}`);

function LinkForm({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [url, setUrl] = useState(initial?.url || '');
  const [kind, setKind] = useState(initial?.kind || '');
  const [note, setNote] = useState(initial?.note || '');
  const shownKind = kind || guessKind(url);
  const ok = title.trim() && /\S+\.\S+/.test(url.trim());
  return (
    <form
      className="res-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        onSave({
          title: title.trim().slice(0, 120),
          url: normalizeUrl(url).slice(0, 2000),
          kind: shownKind,
          note: note.trim().slice(0, 300),
        });
      }}
    >
      <input
        className="input"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a link (Onshape, GitHub, Google Drive…)"
        aria-label="Link"
        autoFocus
      />
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Name, like “Robot CAD”"
        aria-label="Name"
        maxLength={120}
      />
      <input
        className="input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        aria-label="Note"
        maxLength={300}
      />
      <div className="segmented res-kinds" role="group" aria-label="Kind">
        {LINK_KINDS.map(([id, icon, label]) => (
          <button
            type="button"
            key={id}
            className={`plain-seg${shownKind === id ? ' on' : ''}`}
            aria-pressed={shownKind === id}
            onClick={() => setKind(id)}
          >
            <Icon name={icon} size={16} /> {label}
          </button>
        ))}
      </div>
      <div className="row gap">
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" disabled={!ok}>
          {initial ? 'Save' : 'Add link'}
        </button>
      </div>
    </form>
  );
}

// Resources: the team's own links (CAD, code, ...), the electrical diagram,
// and good FTC links.
export default function ResourcesView({ resources, diagram, actor, isManager, canEditDiagram, api }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openDiagram, setOpenDiagram] = useState(false);
  const electrical = useFeature('electrical');
  const order = LINK_KINDS.map(([k]) => k);
  const team = [...resources].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (a.at || 0) - (b.at || 0));

  return (
    <main className="content resources">
      <div className="ms-header">
        <div>
          <h1>Resources</h1>
        </div>
      </div>

      {electrical && (
        <section className="res-diagram">
          <button className="res-diagram-pic" onClick={() => setOpenDiagram(true)} aria-label="Open the electrical diagram">
            <DiagramPreview diagram={diagram} />
          </button>
          <div className="res-diagram-side">
            <h2>Electrical diagram</h2>
            <p className="muted small">
              Every motor, servo, and sensor and the hub port it plugs into.{' '}
              {canEditDiagram
                ? 'You can edit it: add parts, rename them, and rewire.'
                : 'Electrical and team management keep it up to date.'}
            </p>
            {diagram?.updatedBy && (
              <p className="muted tiny">
                Last changed by {diagram.updatedBy}
                {diagram.updatedAt ? ` · ${fullTime(diagram.updatedAt)}` : ''}
              </p>
            )}
            <button className="btn primary" onClick={() => setOpenDiagram(true)}>
              {canEditDiagram ? 'Open and edit' : 'Open'}
            </button>
          </div>
        </section>
      )}

      <section className="res-section">
        <div className="res-section-head">
          <h2>Our links</h2>
          {!adding && (
            <button className="btn" onClick={() => setAdding(true)}>
              <PlusIcon /> Add link
            </button>
          )}
        </div>
        {adding && (
          <LinkForm
            onCancel={() => setAdding(false)}
            onSave={(data) => {
              api.addResource(data);
              setAdding(false);
            }}
          />
        )}
        {team.length ? (
          <ul className="res-list">
            {team.map((r) =>
              editing === r.id ? (
                <li key={r.id}>
                  <LinkForm
                    initial={r}
                    onCancel={() => setEditing(null)}
                    onSave={(data) => {
                      api.updateResource(r.id, data);
                      setEditing(null);
                    }}
                  />
                </li>
              ) : (
                <li key={r.id} className="res-item">
                  <span className="res-icon" aria-hidden="true">
                    <Icon name={kindOf(r.kind)[1]} size={20} />
                  </span>
                  <span className="res-text">
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.title}
                    </a>
                    <span className="muted small">
                      {host(r.url)}
                      {r.note ? ` · ${r.note}` : ''}
                    </span>
                  </span>
                  {(isManager || r.byUid === actor.uid) && (
                    <span className="res-actions">
                      <button className="link-btn small" onClick={() => setEditing(r.id)}>
                        Edit
                      </button>
                      <button
                        className="link-btn small danger"
                        onClick={async () =>
                          (await confirmDialog({ title: `Remove “${r.title}”?`, okLabel: 'Remove', danger: true })) &&
                          api.deleteResource(r.id)
                        }
                      >
                        Remove
                      </button>
                    </span>
                  )}
                </li>
              ),
            )}
          </ul>
        ) : (
          !adding && (
            <p className="muted small res-empty">
              Add the robot CAD (Onshape), the code repo, and anything else the team keeps going back to. Only the team can see these.
            </p>
          )
        )}
      </section>

      <div className="res-grid">
        {BUILTIN_RESOURCES.map((s) => (
          <section key={s.title} className="res-section">
            <h2>{s.title}</h2>
            <ul className="res-list">
              {s.links.map(([title, url, note]) => (
                <li key={url} className="res-item">
                  <span className="res-text">
                    <a href={url} target="_blank" rel="noreferrer">
                      {title}
                    </a>
                    <span className="muted small">{note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {openDiagram && electrical && (
        <ElectricalEditor
          remote={diagram}
          canEdit={canEditDiagram}
          actor={actor}
          onSave={api.saveDiagram}
          onClose={() => setOpenDiagram(false)}
        />
      )}
    </main>
  );
}
