import { useEffect, useMemo, useRef, useState } from 'react';
import { GIPHY_API_KEY, ORG_GROUPS } from '../../config.js';
import { AutoTextarea, Avatar, AvatarStack, CloseIcon, Overlay, PlusIcon, usePeople } from '../common.jsx';
import { MAX_CHOICES, MAX_PEOPLE, MAX_PICK, optionLimit, personOptionId, pickRule, votesFit } from '../../../functions/shared/polls.js';
import { nameKey } from '../../../functions/shared/team.js';
import { GROUPS, emojiList, firstEmoji, loadEmoji, recentEmoji, searchEmoji, rememberEmoji } from './emoji.js';
import { isTouch } from '../../util.js';
import { Icon } from '../shell/icons.jsx';
import { confirmDialog } from '../Dialogs.jsx';

// The emoji groups' tabs, as line icons (in GROUPS order).
const GROUP_ICONS = ['smile', 'person', 'leaf', 'food', 'car', 'ball', 'bulb', 'heart', 'flag'];

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
  const [flash, setFlash] = useState(null); // { emoji } already in the list, or { full: true }
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
      // Every pick answers: added, already there (it pulses), or the list is full.
      if (editing.includes(e)) setFlash({ emoji: e, at: Date.now() });
      else if (editing.length >= QUICK_MAX) setFlash({ full: true, at: Date.now() });
      else {
        setEditing([...editing, e]);
        setFlash(null);
      }
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
          <b>
            Quick reactions <span className="quick-count mono">{editing.length}/{QUICK_MAX}</span>
          </b>
          <span className="muted small">
            Pick up to {QUICK_MAX} below. Tap one here to take it off. ({editing.length}/{QUICK_MAX})
          </span>
          <div className="quick-row">
            {editing.map((e) => (
              <button
                key={flash?.emoji === e ? `${e}-${flash.at}` : e}
                className={`quick-chip${flash?.emoji === e ? ' flash' : ''}`}
                onClick={() => {
                  setEditing(editing.filter((x) => x !== e));
                  setFlash(null);
                }}
                aria-label={`Remove ${e}`}
              >
                <QuickGlyph emoji={e} teamEmoji={teamEmoji} />
                <span className="quick-x" aria-hidden="true">
                  <CloseIcon />
                </span>
              </button>
            ))}
            {!editing.length && <span className="muted small">None yet</span>}
          </div>
          {flash?.full && <span className="quick-note">You have {QUICK_MAX}. Tap one above to take it off first.</span>}
          <div className="quick-actions">
            <button
              className="btn ghost small-btn"
              onClick={() => {
                setEditing(null);
                setFlash(null);
              }}
            >
              Cancel
            </button>
            <button
              className="btn primary small-btn"
              onClick={() => {
                onSaveQuick(editing);
                setEditing(null);
                setFlash(null);
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
            // While a keyboard is still composing (the iPad emoji keyboard's
            // search), wait for it to finish (onCompositionEnd).
            if (e.nativeEvent.isComposing) return setQ(e.target.value);
            const typed = firstEmoji(e.target.value);
            if (typed) {
              setQ('');
              pick(typed);
            } else setQ(e.target.value);
          }}
          onCompositionEnd={(e) => {
            const typed = firstEmoji(e.currentTarget.value);
            if (typed) {
              setQ('');
              pick(typed);
            }
          }}
          onKeyDown={(e) => {
            // Enter picks the first result.
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            const first = team[0] ? `:${team[0].name}:` : list[0];
            if (q.trim() && first) {
              e.preventDefault();
              setQ('');
              pick(first);
            }
          }}
          placeholder="Search, or type an emoji"
        />
        <button className="icon-btn small" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      {!q && (
        <div className="emoji-tabs">
          <button className={group === -1 ? 'active' : ''} onClick={() => setGroup(-1)} title="Recent and team" aria-label="Recent and team">
            <Icon name="clock" />
          </button>
          {GROUPS.map((g, i) => (
            <button key={g} className={group === i ? 'active' : ''} onClick={() => setGroup(i)} title={g} aria-label={g}>
              <Icon name={GROUP_ICONS[i]} />
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
                <button
                  className="link-btn danger-text"
                  onClick={async () =>
                    (await confirmDialog({
                      title: `Delete :${e.name}:?`,
                      body: 'It stops showing in messages and reactions.',
                      okLabel: 'Delete',
                      danger: true,
                    })) && api.deleteEmoji(e)
                  }
                >
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

// GIPHY search (every rating up to R, as team management chose), or trending
// when the box is empty. Shared by the chat picker and Asher's GIF lookup.
export function useGifSearch(q, limit = 24) {
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState(GIPHY_API_KEY ? 'loading' : 'off');
  useEffect(() => {
    if (!GIPHY_API_KEY) return;
    const ctrl = new AbortController();
    const t = setTimeout(
      async () => {
        setStatus('loading');
        const params = new URLSearchParams({ api_key: GIPHY_API_KEY, limit: String(limit), rating: 'r' });
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
  }, [q, limit]);
  return { results, status };
}

// GIF picker: GIPHY search when a key is set, plus uploading your own.
export function GifPicker({ onPick, onUpload, onClose }) {
  const [q, setQ] = useState('');
  const { results, status } = useGifSearch(q);
  const upload = useRef(null);
  useEscape(onClose);

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

// Create a poll: a question and either 2–10 text choices, 2–40 team members,
// or a written answer everyone types. Choices and people can allow one pick,
// several (up to N, exactly N, or any number).
// New poll, or editing one (editing: the posted poll; its choices keep their
// ids so votes stay with them, and new ones get an id no choice ever had, so
// a removed choice's votes never move to a new one; votes: the poll's votes).
// roster: the people a "people" poll can use (the team, or a DM's people).
export function PollDialog({ onCreate, onClose, canRequire = false, initialQuestion = '', editing = null, votes = null, roster = null }) {
  const people = usePeople();
  const rename = people?.rename || ((n) => n);
  const pool = useMemo(() => [...new Set((roster || people?.roster || []).map(rename))], [roster, people, rename]);
  const [question, setQuestion] = useState(editing?.question ?? initialQuestion);
  // 'choices': text options; 'people': team members; 'text': everyone writes their own answer.
  const [kind, setKind] = useState(editing?.kind === 'text' ? 'text' : editing?.kind === 'people' ? 'people' : 'choices');
  const [options, setOptions] = useState(
    editing?.kind !== 'people' && editing?.options?.length ? editing.options.map((o) => ({ ...o })) : [{ text: '' }, { text: '' }],
  );
  // People: who the options are. Editing starts from the people already in it.
  const [source, setSource] = useState(editing?.kind === 'people' ? 'pick' : 'everyone');
  const [subteam, setSubteam] = useState('');
  const [picked, setPicked] = useState(() =>
    editing?.kind === 'people' ? new Set(editing.options.map((o) => rename(o.person || o.text))) : new Set(),
  );
  const [find, setFind] = useState('');
  const [selfVote, setSelfVote] = useState(editing?.selfVote !== false);
  // How many can people pick: 'one' or 'several' (a rule + N).
  const rule0 = editing ? pickRule(editing) : { mode: 'one', n: 2 };
  const [pickKind, setPickKind] = useState(rule0.mode === 'one' ? 'one' : 'several');
  const [mode, setMode] = useState(rule0.mode === 'exact' ? 'exact' : rule0.mode === 'any' ? 'any' : 'upto');
  const [n, setN] = useState(rule0.mode === 'upto' || rule0.mode === 'exact' ? rule0.n : 2);
  // Choices, plus a box to write your own answer (or both).
  const [write, setWrite] = useState(!!editing?.write);
  const [required, setRequired] = useState(!!editing?.required);
  // Anonymous until it ends (shared/polls.js hidesVoters). Once people have
  // answered an open anonymous poll, it stays anonymous: turning it off would
  // show names they gave thinking nobody would see.
  const [anonymous, setAnonymous] = useState(!!editing?.anonymous);
  const answeredAnon =
    !!editing?.anonymous && !editing.closed && Object.entries(votes || {}).some(([, v]) => v && Object.keys(v).length > 0);
  useEscape(onClose);
  const filled = options.filter((o) => o.text.trim());

  // The subteams that have people, and who is in the list for each source.
  const subteams = useMemo(
    () => ORG_GROUPS.map((s) => [s, pool.filter((p) => people?.infoOf(p)?.subteams?.includes(s))]).filter(([, who]) => who.length),
    [pool, people],
  );
  const subteamName = subteam || subteams[0]?.[0] || '';
  const extraPicked = [...picked].filter((p) => !pool.includes(p)); // in the poll, since left the team
  const everyone = source === 'everyone' ? pool : source === 'subteam' ? (subteams.find(([s]) => s === subteamName)?.[1] ?? []) : null;
  const listPool = [...pool, ...extraPicked];
  const chosen = kind !== 'people' ? [] : everyone ? everyone : listPool.filter((p) => picked.has(p));
  const count = kind === 'people' ? chosen.length : filled.length;
  const limit = optionLimit(kind);
  const several = pickKind === 'several';
  // A new "several" choice poll that takes written answers counts your own
  // answer as one of your picks (shared/polls.js writeCounts). Old polls keep
  // writing apart, so their votes still count.
  const writePick = kind === 'choices' && write && several && (!editing || !!editing.writePick);
  // N can go up to the number of options (one fewer if people can't pick
  // themselves, one more when your own answer is a pick).
  const maxN = Math.min(MAX_PICK, count - (kind === 'people' && !selfVote ? 1 : 0) + (writePick ? 1 : 0));
  const nEff = Math.max(2, Math.min(n, Math.max(2, maxN)));
  const pickField = !several
    ? { mode: 'one', n: 1 }
    : mode === 'any'
      ? { mode: 'any', n: Math.min(count + (writePick ? 1 : 0), MAX_PICK) }
      : { mode, n: nEff };

  // Ids that are or ever were taken: the poll's choices, any choice that
  // still has votes stored, and the ones in this dialog.
  const [everUsed] = useState(() => new Set([...(editing?.options || []).map((o) => o.id), ...Object.keys(votes || {})]));
  const freeId = (used) => {
    const free = (id) => !used.has(id) && !everUsed.has(id);
    for (let i = 0; i < 26; i++) if (free(String.fromCharCode(97 + i))) return String.fromCharCode(97 + i);
    for (let i = 0; ; i++) if (free(`o${i}`)) return `o${i}`;
  };
  const nextId = () => freeId(new Set(options.map((o) => o.id).filter(Boolean)));

  // The poll this dialog would post.
  const build = () => {
    const base = { ...(editing || {}), question: question.trim().slice(0, 500), required };
    if (anonymous) base.anonymous = true;
    else delete base.anonymous;
    if (kind === 'text') return { ...base, kind: 'text', multi: false, write: false, options: [] };
    let opts;
    if (kind === 'people') {
      const had = new Map((editing?.options || []).map((o) => [nameKey(rename(o.person || o.text)), o]));
      opts = chosen.slice(0, MAX_PEOPLE).map((name) => had.get(nameKey(name)) || { id: personOptionId(name), text: name, person: name });
    } else {
      const used = new Set();
      opts = filled.slice(0, MAX_CHOICES).map((o) => {
        const id = o.id && !used.has(o.id) ? o.id : freeId(used);
        used.add(id);
        return { id, text: o.text.trim().slice(0, 200) };
      });
    }
    const out = { ...base, kind, multi: several, write: kind === 'choices' ? write : false, options: opts, pick: pickField };
    if (writePick) out.writePick = true;
    else delete out.writePick;
    if (kind === 'people') out.selfVote = selfVote;
    else delete out.selfVote;
    // An old poll saved with the same rule it always had keeps having no rule.
    if (editing && !editing.pick && pickField.mode === (editing.multi ? 'any' : 'one')) delete out.pick;
    return out;
  };

  // What stops the poll from posting (said under the button).
  const problem = (() => {
    if (!question.trim()) return 'Type a question to post.';
    if (kind === 'choices' && !(filled.length >= 2 || (write && filled.length >= 1))) return 'Add at least 2 choices.';
    if (kind === 'people' && count < 2)
      return source === 'pick' ? 'Pick at least 2 people.' : source === 'subteam' ? 'That subteam needs at least 2 people.' : 'There need to be at least 2 people.';
    if (kind === 'people' && count > MAX_PEOPLE) return `That’s ${count} people. A poll can have ${MAX_PEOPLE}. Pick a subteam or choose people.`;
    if (kind !== 'text' && several && mode !== 'any' && maxN < 2) return 'Add more options to let people pick several.';
    if (editing && votes && kind !== 'text') {
      const next = build();
      const key = (r) => `${r.mode}${r.mode === 'upto' || r.mode === 'exact' ? r.n : ''}`;
      const same = key(pickRule(next)) === key(pickRule(editing)) && next.selfVote === editing.selfVote;
      if (!same) {
        const fit = votesFit({ poll: editing, votes }, next, { rename });
        if (!fit.ok)
          return `${fit.lost.length} ${fit.lost.length === 1 ? 'person’s vote wouldn’t' : 'people’s votes wouldn’t'} count with this. Keep the old rule, or change it before people vote.`;
      }
    }
    return '';
  })();

  const shownPeople = listPool.filter((p) => !find.trim() || p.toLowerCase().includes(find.trim().toLowerCase()));
  const togglePerson = (p) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(p)) next.delete(p);
      else if (next.size < MAX_PEOPLE) next.add(p);
      return next;
    });
  const stepper = (d) => setN(Math.max(2, Math.min(Math.max(2, maxN), nEff + d)));
  const kinds = [
    ['choices', 'Choices'],
    ['people', 'People'],
    ['text', 'Written answer'],
  ];
  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <form
          className="dialog poll-dialog"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (problem) return;
            onCreate(build());
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
            {kinds.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={kind === id}
                className={`plain-seg${kind === id ? ' on' : ''}`}
                onClick={() => setKind(id)}
                disabled={!!editing && (editing.kind || 'choices') !== id}
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
            placeholder={kind === 'text' ? 'Ask a question everyone answers in their own words' : kind === 'people' ? 'Ask who (like “Who should drive?”)' : 'Ask a question'}
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
          {kind === 'choices' && options.length < MAX_CHOICES && (
            <button type="button" className="link-btn" onClick={() => setOptions([...options, { id: editing ? nextId() : undefined, text: '' }])}>
              ＋ Add option
            </button>
          )}
          {kind === 'people' && (
            <div className="poll-people-src">
              <div className="muted tiny poll-sec-label">Who can people vote for?</div>
              <div className="segmented poll-kind" role="radiogroup" aria-label="Who is in the poll">
                {[
                  ['everyone', 'Everyone'],
                  ['subteam', 'A subteam'],
                  ['pick', 'Pick people'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={source === id}
                    className={`plain-seg${source === id ? ' on' : ''}`}
                    onClick={() => setSource(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {source === 'everyone' && <p className="muted small poll-kind-hint">Everyone on the team right now, {pool.length} {pool.length === 1 ? 'person' : 'people'}.</p>}
              {source === 'subteam' && (
                <select className="input" value={subteamName} onChange={(e) => setSubteam(e.target.value)} aria-label="Subteam">
                  {subteams.map(([s, who]) => (
                    <option key={s} value={s}>
                      {s} ({who.length})
                    </option>
                  ))}
                </select>
              )}
              {source === 'pick' && (
                <div className="people-pick">
                  <input className="input" type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search people" aria-label="Search people" />
                  <div className="people-pick-list" role="group" aria-label="People in the poll">
                    {shownPeople.map((p) => (
                      <label key={p} className={`people-row${picked.has(p) ? ' on' : ''}`}>
                        <input type="checkbox" checked={picked.has(p)} onChange={() => togglePerson(p)} disabled={!picked.has(p) && picked.size >= MAX_PEOPLE} />
                        <Avatar name={p} size={28} decoration="" />
                        <span className="grow">{p}</span>
                      </label>
                    ))}
                    {!shownPeople.length && <p className="muted small">No one matches.</p>}
                  </div>
                  <div className="row gap small">
                    <span className="mono">{picked.size}</span>
                    <span className="muted">of {MAX_PEOPLE} max picked</span>
                    <span className="spacer" />
                    <button type="button" className="link-btn" onClick={() => setPicked(new Set([...picked, ...shownPeople].slice(0, MAX_PEOPLE)))}>
                      Add {find.trim() ? 'these' : 'everyone'}
                    </button>
                    <button type="button" className="link-btn" onClick={() => setPicked(new Set())} disabled={!picked.size}>
                      Clear
                    </button>
                  </div>
                </div>
              )}
              {source !== 'pick' && count > 0 && (
                <div className="row gap small">
                  <AvatarStack names={chosen} max={8} size={24} />
                  <span className="muted">
                    {count} {count === 1 ? 'person' : 'people'}
                  </span>
                </div>
              )}
              <label className="row gap small">
                <input type="checkbox" checked={selfVote} onChange={(e) => setSelfVote(e.target.checked)} /> People can vote for themselves
              </label>
            </div>
          )}
          {kind !== 'text' && (
            <fieldset className="poll-pick">
              <legend className="muted tiny poll-sec-label">How many can people pick?</legend>
              <div className="segmented poll-kind" role="radiogroup" aria-label="How many can people pick">
                {[
                  ['one', 'Just one'],
                  ['several', 'Several'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={pickKind === id}
                    className={`plain-seg${pickKind === id ? ' on' : ''}`}
                    onClick={() => setPickKind(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {several && (
                <>
                  <div className="segmented poll-kind" role="radiogroup" aria-label="Pick rule">
                    {[
                      ['upto', 'Up to'],
                      ['exact', 'Exactly'],
                      ['any', 'Any number'],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={mode === id}
                        className={`plain-seg${mode === id ? ' on' : ''}`}
                        onClick={() => setMode(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {mode !== 'any' && (
                    <div className="poll-stepper" role="group" aria-label="How many">
                      <button type="button" className="btn stepper-btn" onClick={() => stepper(-1)} disabled={nEff <= 2} aria-label="Fewer">
                        −
                      </button>
                      <span className="mono stepper-n" aria-live="polite">
                        {nEff}
                      </span>
                      <button type="button" className="btn stepper-btn" onClick={() => stepper(1)} disabled={nEff >= Math.max(2, maxN)} aria-label="More">
                        +
                      </button>
                    </div>
                  )}
                  <p className="muted small poll-kind-hint">
                    {mode === 'upto' && `People can pick 1 to ${nEff}.`}
                    {mode === 'exact' && `Exactly ${nEff}: people have to pick ${nEff} before their vote counts.`}
                    {mode === 'any' && 'People can pick as many as they like.'}
                    {writePick && ' Writing their own answer counts as one of their picks.'}
                  </p>
                </>
              )}
              {editing && votes && Object.keys(votes).length > 0 && (
                <p className="muted tiny poll-kind-hint">Votes are in, so the rule can only change if everyone’s picks still fit it.</p>
              )}
            </fieldset>
          )}
          {kind === 'choices' && (
            <label className="row gap small">
              <input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} /> Also let people write their own answer
            </label>
          )}
          <label className="row gap small poll-required-opt">
            <input type="checkbox" checked={anonymous} disabled={answeredAnon} onChange={(e) => setAnonymous(e.target.checked)} />
            <span>
              <b>Anonymous until it ends</b>
              <span className="muted">
                {answeredAnon
                  ? ' · people have answered thinking it’s anonymous, so it stays that way until it ends'
                  : ' · nobody sees who picked or wrote what until the poll ends, then the names show'}
              </span>
            </span>
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
          {problem && (
            <p className="muted small poll-problem" role="status">
              {problem}
            </p>
          )}
          <button className="btn primary big-btn" disabled={!!problem}>
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
                  onClick={async () =>
                    (await confirmDialog({ title: `Delete the “${s.name}” sticker?`, okLabel: 'Delete', danger: true })) &&
                    api.deleteSticker(s)
                  }
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
