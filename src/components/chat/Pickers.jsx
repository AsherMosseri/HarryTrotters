import { useEffect, useMemo, useRef, useState } from 'react';
import { GIPHY_API_KEY } from '../../config.js';
import { CloseIcon, Overlay, PlusIcon } from '../common.jsx';
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
export function EmojiPicker({ onPick, onClose, teamEmoji = [], canManage, onManage, className = '', title = '' }) {
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
    </div>
  );
}

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
export function PollDialog({ onCreate, onClose, canRequire = false }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const [required, setRequired] = useState(false);
  useEscape(onClose);
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ok = question.trim() && filled.length >= 2;
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <form
          className="dialog poll-dialog"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (!ok) return;
            onCreate({
              question: question.trim().slice(0, 200),
              multi,
              ...(required ? { required: true } : {}),
              options: filled.slice(0, 10).map((text, i) => ({ id: String.fromCharCode(97 + i), text: text.slice(0, 80) })),
            });
          }}
        >
          <div className="panel-head">
            <h2>📊 New poll</h2>
            <span className="spacer" />
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <input
            className="input big"
            autoFocus={!isTouch}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question"
          />
          {options.map((o, i) => (
            <div key={i} className="row gap">
              <input
                className="input grow"
                value={o}
                onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`Option ${i + 1}`}
              />
              {options.length > 2 && (
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
          {options.length < 10 && (
            <button type="button" className="link-btn" onClick={() => setOptions([...options, ''])}>
              ＋ Add option
            </button>
          )}
          <label className="row gap small">
            <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> Allow picking more than one
          </label>
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
            Post poll
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
