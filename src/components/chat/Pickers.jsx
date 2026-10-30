import { useEffect, useMemo, useRef, useState } from 'react';
import { GIPHY_API_KEY } from '../../config.js';
import { AutoTextarea, CloseIcon, Overlay, PlusIcon } from '../common.jsx';
import { GROUPS, GROUP_ICONS, emojiList, firstEmoji, loadEmoji, recentEmoji, searchEmoji, rememberEmoji } from './emoji.js';
import { isTouch } from '../../util.js';

function useEscape(onClose) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

// Every emoji, searchable, plus the team's own (:name:). onPick gets the emoji
// character, or ':name:' for a team emoji.
// quick / onSaveQuick (reactions only): your quick reactions, shown under the
// grid with an Edit mode where picks add to them (up to QUICK_MAX).
export const QUICK_MAX = 5;
export function EmojiPicker({ onPick, onClose, teamEmoji = [], canManage, onManage, className = '', title = '', quick, onSaveQuick }) {
  const [editing, setEditing] = useState(null); // your quick reactions while editing them
  const [ready, setReady] = useState(!!emojiList());
  const [q, setQ] = useState('');
  const [group, setGroup] = useState(-1); // -1 = recent + team
  const grid = useRef(null);
  useEscape(onClose);
  useEffect(() => {
    loadEmoji().then(() => setReady(true));
  }, []);
  useEffect(() => grid.current?.scrollTo(0, 0), [group, q]);

  const pick = (e) => {
    if (editing) {
      if (!editing.includes(e) && editing.length < QUICK_MAX) setEditing([...editing, e]);
      return;
    }
    rememberEmoji(e);
    onPick(e);
  };
  const team = teamEmoji.filter((e) => !q || e.name.includes(q.toLowerCase().replace(/:/g, '')));
  const list = useMemo(() => {
    if (!ready) return [];
    if (q.trim()) return searchEmoji(q, 120).map((e) => e.char);
    if (group === -1) return recentEmoji().filter((e) => !e.startsWith(':'));
    return emojiList()
      .filter((e) => e[2] === group)
      .map((e) => e[0]);
  }, [ready, q, group]);
  const recentTeam = group === -1 && !q ? recentEmoji().filter((e) => e.startsWith(':')) : [];

  return (
    <div className={`emoji-picker big ${className}`} onClick={(e) => e.stopPropagation()}>
      {title && <div className="picker-title">{title}</div>}
      {editing && (
        <div className="quick-edit">
          <b>Quick reactions</b>
          <span className="muted small">
            Pick up to {QUICK_MAX} below. Tap one here to take it off. ({editing.length}/{QUICK_MAX})
          </span>
          <div className="quick-row">
            {editing.map((e) => (
              <button key={e} className="quick-chip" onClick={() => setEditing(editing.filter((x) => x !== e))} aria-label={`Remove ${e}`}>
                <QuickGlyph emoji={e} teamEmoji={teamEmoji} />
                <span className="quick-x" aria-hidden="true">
                  ×
                </span>
              </button>
            ))}
            {!editing.length && <span className="muted small">None yet</span>}
            <span className="spacer" />
            <button className="link-btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              className="btn primary small-btn"
              onClick={() => {
                onSaveQuick(editing);
                setEditing(null);
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}
      <div className="row gap-sm">
        <input
          className="input grow"
          autoFocus={!isTouch}
          value={q}
          onChange={(e) => {
            // Typed an actual emoji (emoji keyboard, Globe + E): that's the pick.
            const typed = firstEmoji(e.target.value);
            if (typed) {
              setQ('');
              pick(typed);
            } else setQ(e.target.value);
          }}
          placeholder="Search, or type an emoji"
        />
        <button className="icon-btn small" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      {!q && (
        <div className="emoji-tabs">
          <button className={group === -1 ? 'active' : ''} onClick={() => setGroup(-1)} title="Recent and team">
            🕘
          </button>
          {GROUPS.map((g, i) => (
            <button key={g} className={group === i ? 'active' : ''} onClick={() => setGroup(i)} title={g}>
              {GROUP_ICONS[i]}
            </button>
          ))}
        </div>
      )}
      <div className="emoji-scroll" ref={grid}>
        {(group === -1 || q) && (team.length > 0 || canManage) && (
          <>
            <h4>Team emoji</h4>
            <div className="emoji-grid">
              {team.map((e) => (
                <button key={e.id} onClick={() => pick(`:${e.name}:`)} title={`:${e.name}:`}>
                  <img src={e.url} alt={`:${e.name}:`} />
                </button>
              ))}
              {canManage && !q && (
                <button className="emoji-add" onClick={onManage} title="Add or remove team emoji">
                  <PlusIcon size={18} />
                </button>
              )}
            </div>
          </>
        )}
        {!q && group === -1 && <h4>Recent</h4>}
        {!q && group >= 0 && <h4>{GROUPS[group]}</h4>}
        <div className="emoji-grid">
          {recentTeam.map((code) => {
            const e = teamEmoji.find((t) => `:${t.name}:` === code);
            return e ? (
              <button key={code} onClick={() => pick(code)} title={code}>
                <img src={e.url} alt={code} />
              </button>
            ) : null;
          })}
          {list.map((e) => (
            <button key={e} onClick={() => pick(e)}>
              {e}
            </button>
          ))}
        </div>
        {!ready && <p className="muted small">Loading emoji…</p>}
        {ready && !list.length && q && !team.length && <p className="muted small">No emoji found.</p>}
        {ready && !list.length && !q && group === -1 && !recentTeam.length && (
          <p className="muted small">Emoji you use will show up here. Pick a category above.</p>
        )}
      </div>
      {quick && onSaveQuick && !editing && (
        <div className="quick-foot">
          <span className="muted small">Quick reactions</span>
          {quick.map((e) => (
            <span key={e} className="quick-glyph">
              <QuickGlyph emoji={e} teamEmoji={teamEmoji} />
            </span>
          ))}
          <span className="spacer" />
          <button className="link-btn" onClick={() => setEditing([...quick])}>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}

const QuickGlyph = ({ emoji, teamEmoji }) => {
  const team = emoji.startsWith(':') && teamEmoji.find((t) => `:${t.name}:` === emoji);
  return team ? <img className="custom-emoji" src={team.url} alt={emoji} /> : emoji;
};

// Team management: add and remove :team_emoji:.
export function EmojiManager({ teamEmoji, api, onClose }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEscape(onClose);
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');

  const add = async () => {
    setErr('');
    if (clean.length < 2) return setErr('Use a name with at least 2 letters or numbers.');
    if (teamEmoji.some((e) => e.name === clean)) return setErr(`:${clean}: already exists.`);
    setBusy(true);
    try {
      await api.addEmoji(clean, await shrinkEmoji(file));
      setName('');
      setFile(null);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Team emoji">
          <div className="panel-head">
            <h2>Team emoji</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <p className="muted small">
            Everyone can use these in messages and reactions as :name:. Square pictures work best; GIFs stay animated.
          </p>
          <div className="row gap">
            <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, like robot or harry" />
            <label className="btn">
              {file ? '✓ Picture' : 'Picture…'}
              <input
                type="file"
                accept="image/png,image/gif,image/jpeg,image/webp"
                hidden
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
            </label>
            <button className="btn primary" onClick={add} disabled={busy || !file || !clean}>
              {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
          {clean && <p className="muted small">Type it as :{clean}:</p>}
          {err && <p className="form-error">{err}</p>}
          <div className="emoji-admin-list">
            {teamEmoji.map((e) => (
              <div key={e.id} className="row gap">
                <img className="custom-emoji big" src={e.url} alt="" />
                <span className="grow">:{e.name}:</span>
                <span className="muted small">{e.by?.split(' ')[0]}</span>
                <button className="link-btn danger-text" onClick={() => confirm(`Delete :${e.name}:?`) && api.deleteEmoji(e)}>
                  Delete
                </button>
              </div>
            ))}
            {!teamEmoji.length && <p className="muted small">No team emoji yet.</p>}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// Still pictures become 128px PNGs; GIFs are kept as they are (up to 1 MB).
async function shrinkEmoji(file) {
  if (file.type === 'image/gif') {
    if (file.size > 1024 * 1024) throw new Error('That GIF is too big (1 MB max).');
    return file;
  }
  const bmp = await createImageBitmap(file);
  const size = 128;
  const k = Math.min(1, size / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return new File([blob], 'emoji.png', { type: 'image/png' });
}

// GIF picker: GIPHY search (G-rated) when a key is set, plus uploading your own.
export function GifPicker({ onPick, onUpload, onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState(GIPHY_API_KEY ? 'loading' : 'off');
  const upload = useRef(null);
  useEscape(onClose);

  useEffect(() => {
    if (!GIPHY_API_KEY) return;
    const ctrl = new AbortController();
    const t = setTimeout(
      async () => {
        setStatus('loading');
        // Every rating GIPHY has (up to R), as team management chose.
        const params = new URLSearchParams({ api_key: GIPHY_API_KEY, limit: '24', rating: 'r' });
        if (q.trim()) params.set('q', q.trim());
        try {
          const res = await fetch(`https://api.giphy.com/v1/gifs/${q.trim() ? 'search' : 'trending'}?${params}`, { signal: ctrl.signal });
          if (!res.ok) throw new Error(String(res.status));
          const { data } = await res.json();
          setResults(data);
          setStatus('ready');
        } catch (e) {
          if (e.name !== 'AbortError') setStatus('error');
        }
      },
      q ? 350 : 0,
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div className="gif-picker">
      <div className="row gap">
        {GIPHY_API_KEY ? (
          <input className="input grow" autoFocus={!isTouch} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIFs" />
        ) : (
          <span className="muted small grow">GIF search turns on once team management adds a GIPHY key. You can still upload a GIF.</span>
        )}
        <button className="btn" onClick={() => upload.current?.click()}>
          Upload GIF
        </button>
        <input
          ref={upload}
          type="file"
          accept="image/gif"
          hidden
          onChange={(e) => {
            const f = e.target.files[0];
            e.target.value = '';
            if (f) onUpload(f);
          }}
        />
        <button className="icon-btn small" onClick={onClose} aria-label="Close GIFs">
          <CloseIcon />
        </button>
      </div>
      {GIPHY_API_KEY && (
        <>
          <div className="gif-grid">
            {results.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  const img = g.images.downsized || g.images.original;
                  onPick({ source: 'giphy', id: g.id, title: g.title, url: img.url, width: Number(img.width), height: Number(img.height) });
                }}
                aria-label={g.title || 'GIF'}
              >
                <img src={g.images.fixed_width_small?.url || g.images.fixed_width.url} alt="" loading="lazy" />
              </button>
            ))}
            {status === 'loading' && !results.length && <p className="muted small">Loading…</p>}
            {status === 'error' && <p className="muted small">Couldn't reach GIPHY. Check the connection or the API key.</p>}
            {status === 'ready' && !results.length && <p className="muted small">No GIFs found.</p>}
          </div>
          <p className="giphy-credit">Powered by GIPHY</p>
        </>
      )}
    </div>
  );
}

// Create a poll: a question, 2–10 options, one or several choices.
// New poll, or editing one (editing: the posted poll; its choices keep their
// ids so votes stay with them, and new ones get the next free id).
export function PollDialog({ onCreate, onClose, canRequire = false, initialQuestion = '', editing = null }) {
  const [question, setQuestion] = useState(editing?.question ?? initialQuestion);
  // 'choices': pick from options; 'text': everyone writes their own answer.
  const [kind, setKind] = useState(editing?.kind === 'text' ? 'text' : 'choices');
  const [options, setOptions] = useState(editing?.options?.length ? editing.options.map((o) => ({ ...o })) : [{ text: '' }, { text: '' }]);
  const [multi, setMulti] = useState(!!editing?.multi);
  // Choices, plus a box to write your own answer (or both).
  const [write, setWrite] = useState(!!editing?.write);
  const [required, setRequired] = useState(!!editing?.required);
  useEscape(onClose);
  const filled = options.filter((o) => o.text.trim());
  const ok = question.trim() && (kind === 'text' || filled.length >= 2 || (write && filled.length >= 1));
  const nextId = () => {
    const used = new Set(options.map((o) => o.id).filter(Boolean));
    for (let i = 0; i < 26; i++) if (!used.has(String.fromCharCode(97 + i))) return String.fromCharCode(97 + i);
    return `o${Date.now().toString(36)}`;
  };
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <form
          className="dialog poll-dialog"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (!ok) return;
            const used = new Set();
            const ids = filled.slice(0, 10).map((o) => {
              let id = o.id;
              for (let i = 0; !id || used.has(id); i++) id = String.fromCharCode(97 + i);
              used.add(id);
              return { id, text: o.text.trim().slice(0, 200) };
            });
            onCreate({
              ...(editing || {}),
              question: question.trim().slice(0, 500),
              required,
              ...(kind === 'text' ? { kind: 'text', multi: false, write: false, options: [] } : { kind: 'choices', multi, write, options: ids }),
            });
          }}
        >
          <div className="panel-head">
            <h2>{editing ? 'Edit poll' : 'New poll'}</h2>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="segmented poll-kind" role="radiogroup" aria-label="Kind of poll">
            {[
              ['choices', 'Choices'],
              ['text', 'Written answer'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={kind === id}
                className={`plain-seg${kind === id ? ' on' : ''}`}
                onClick={() => setKind(id)}
                disabled={!!editing && editing.kind !== id && (id === 'text' || editing.kind === 'text')}
              >
                {label}
              </button>
            ))}
          </div>
          <AutoTextarea
            className="input big"
            autoFocus={!isTouch}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={kind === 'text' ? 'Ask a question everyone answers in their own words' : 'Ask a question'}
            maxLength={500}
          />
          {kind === 'text' && <p className="muted small poll-kind-hint">Everyone types their own answer. Answers show under the poll.</p>}
          {kind === 'choices' &&
            options.map((o, i) => (
              <div key={o.id || `new${i}`} className="row gap">
                <AutoTextarea
                  className="input grow"
                  value={o.text}
                  onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  placeholder={`Option ${i + 1}`}
                  maxLength={200}
                />
                {options.length > (write ? 1 : 2) && (
                  <button
                    type="button"
                    className="icon-btn small"
                    onClick={() => setOptions(options.filter((_, j) => j !== i))}
                    aria-label="Remove option"
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            ))}
          {kind === 'choices' && options.length < 10 && (
            <button type="button" className="link-btn" onClick={() => setOptions([...options, { id: editing ? nextId() : undefined, text: '' }])}>
              ＋ Add option
            </button>
          )}
          {kind === 'choices' && (
            <label className="row gap small">
              <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> Allow picking more than one
            </label>
          )}
          {kind === 'choices' && (
            <label className="row gap small">
              <input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} /> Also let people write their own answer
            </label>
          )}
          {canRequire && (
            <label className="row gap small poll-required-opt">
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
              <span>
                <b>Everyone has to answer</b>
                <span className="muted"> · like a lab check-in, the app asks when they open it until they vote</span>
              </span>
            </label>
          )}
          <button className="btn primary big-btn" disabled={!ok}>
            {editing ? 'Save poll' : 'Post poll'}
          </button>
        </form>
      </div>
    </Overlay>
  );
}

// /standup: three quick questions, posted as one card.
export function StandupDialog({ onPost, onClose }) {
  const [answers, setAnswers] = useState({ yesterday: '', today: '', blockers: '' });
  useEscape(onClose);
  const ok = answers.yesterday.trim() || answers.today.trim();
  const fields = [
    ['yesterday', 'What did you get done last time?', 'Wired the intake motors'],
    ['today', 'What are you working on today?', 'Tuning the arm PID'],
    ['blockers', 'Anything blocking you?', 'Nothing (or: waiting on the new servo)'],
  ];
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <form
          className="dialog poll-dialog standup-dialog"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) onPost(Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.trim().slice(0, 300)])));
          }}
        >
          <div className="panel-head">
            <h2>Standup</h2>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {fields.map(([k, label, hint], i) => (
            <label key={k} className="standup-field">
              <span>{label}</span>
              <textarea
                className="input"
                rows={2}
                autoFocus={i === 0 && !isTouch}
                value={answers[k]}
                onChange={(e) => setAnswers({ ...answers, [k]: e.target.value })}
                placeholder={hint}
              />
            </label>
          ))}
          <button className="btn primary big-btn" disabled={!ok}>
            Post standup
          </button>
        </form>
      </div>
    </Overlay>
  );
}

// Team stickers: tap one to send it. Team management adds and removes them.
export function StickerPicker({ stickers, onPick, onClose, canManage, onManage }) {
  const [q, setQ] = useState('');
  useEscape(onClose);
  const shown = stickers.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="emoji-picker big sticker-picker" onClick={(e) => e.stopPropagation()}>
      <div className="row gap-sm">
        <input className="input grow" autoFocus={!isTouch} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stickers" />
        <button className="icon-btn small" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      <div className="emoji-scroll">
        <div className="sticker-grid">
          {shown.map((s) => (
            <button key={s.id} onClick={() => onPick(s)} title={s.name}>
              <img src={s.url} alt={s.name} loading="lazy" />
            </button>
          ))}
          {canManage && !q && (
            <button className="emoji-add sticker-add" onClick={onManage} title="Add or remove stickers">
              <PlusIcon size={26} />
            </button>
          )}
        </div>
        {!stickers.length && (
          <p className="muted small">No stickers yet.{canManage ? ' Tap ＋ to add the first one.' : ' Team management can add some.'}</p>
        )}
      </div>
    </div>
  );
}

// Still pictures become 320px PNGs; GIFs stay animated (up to 2 MB).
async function shrinkSticker(file) {
  if (file.type === 'image/gif') {
    if (file.size > 2e6) throw new Error('That GIF is too big for a sticker (2 MB max).');
    return file;
  }
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return new File([blob], 'sticker.png', { type: 'image/png' });
}

export function StickerManager({ stickers, api, onClose }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEscape(onClose);
  const add = async () => {
    setErr('');
    setBusy(true);
    try {
      await api.addSticker(name.trim().slice(0, 30) || 'sticker', await shrinkSticker(file));
      setName('');
      setFile(null);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Team stickers">
          <div className="panel-head">
            <h2>Team stickers</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <p className="muted small">
            Stickers are sent as a big picture. PNGs with a see-through background look best; GIFs stay animated.
          </p>
          <div className="row gap">
            <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, like robot dance" />
            <label className="btn">
              {file ? '✓ Picture' : 'Picture…'}
              <input
                type="file"
                accept="image/png,image/gif,image/jpeg,image/webp"
                hidden
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
            </label>
            <button className="btn primary" onClick={add} disabled={busy || !file}>
              {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
          {err && <p className="form-error">{err}</p>}
          <div className="sticker-grid admin">
            {stickers.map((s) => (
              <div key={s.id} className="sticker-admin">
                <img src={s.url} alt={s.name} />
                <span className="tiny">{s.name}</span>
                <button
                  className="link-btn danger-text tiny"
                  onClick={() => confirm(`Delete the "${s.name}" sticker?`) && api.deleteSticker(s)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Overlay>
  );
}
