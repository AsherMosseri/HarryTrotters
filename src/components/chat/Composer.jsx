import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SUBTEAMS, SUBTEAM_COLORS } from '../../config.js';
import { preparePhoto } from '../../util.js';
import { Avatar, CloseIcon, StatusDot, usePeople } from '../common.jsx';
import { prefixLines, wrapSelection } from './format.jsx';
import { emojiList, loadEmoji, rememberEmoji, searchEmoji } from './emoji.js';
import { EmojiPicker, GifPicker, PollDialog, StickerPicker } from './Pickers.jsx';

// The formatting bar: [label, title, what it does].
const FORMATS = [
  ['B', 'Bold', ['wrap', '**']],
  ['I', 'Italic', ['wrap', '*']],
  ['BI', 'Bold italic', ['wrap', '***']],
  ['U', 'Underline', ['wrap', '__']],
  ['S', 'Strikethrough', ['wrap', '~~']],
  ['H1', 'Big heading', ['line', '# ']],
  ['H2', 'Medium heading', ['line', '## ']],
  ['H3', 'Small heading', ['line', '### ']],
  ['small', 'Small gray text', ['line', '-# ']],
  ['❝', 'Quote', ['line', '> ']],
  ['•', 'List', ['line', '- ']],
  ['</>', 'Code', ['wrap', '`']],
  ['{ }', 'Code block', ['wrap', '```\n', '\n```']],
  ['▒', 'Spoiler (hidden until tapped)', ['wrap', '||']],
];

export default function Composer({
  conv,
  label,
  actor,
  isManager,
  roster,
  tasks,
  api,
  replyTo,
  editing,
  onDone,
  teamEmoji,
  stickers = [],
  onManageStickers,
  onManageEmoji,
  onTyping,
  isDm,
}) {
  const people = usePeople();
  const [text, setText] = useState('');
  const [taskIds, setTaskIds] = useState([]);
  const [photo, setPhoto] = useState(null); // { file, preview }
  const [suggest, setSuggest] = useState(null); // { kind: '@' | '#' | ':', query, start, end }
  const [active, setActive] = useState(0);
  const [sending, setSending] = useState(false);
  const [panel, setPanel] = useState(null); // 'gif' | 'emoji' | 'poll'
  const [formatBar, setFormatBar] = useState(false);
  const [emojiReady, setEmojiReady] = useState(!!emojiList());
  const box = useRef(null);
  const fileInput = useRef(null);
  const anyFileInput = useRef(null);
  const [upload, setUpload] = useState(null); // { name, progress }
  const caretAfterUpdate = useRef(null);

  useEffect(() => {
    if (editing) {
      setText(editing.text || '');
      setTaskIds(editing.taskIds || []);
      box.current?.focus();
    }
  }, [editing]);
  useEffect(() => {
    if (replyTo) box.current?.focus();
  }, [replyTo]);
  // Put the cursor where it belongs after inserting text, before the next keystroke lands.
  useLayoutEffect(() => {
    const pos = caretAfterUpdate.current;
    if (pos === null || !box.current) return;
    caretAfterUpdate.current = null;
    box.current.focus();
    box.current.setSelectionRange(pos[0], pos[1]);
  }, [text]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [text]);

  const subteamMembers = (s) => roster.filter((n) => people?.infoOf(n)?.subteams?.includes(s));

  const options = useMemo(() => {
    if (!suggest) return [];
    const q = suggest.query.toLowerCase();
    if (suggest.kind === '@') {
      const out = [];
      if (!isDm && isManager && 'everyone'.startsWith(q)) out.push({ type: 'everyone', key: 'everyone', insert: '@everyone' });
      if (!isDm)
        for (const s of SUBTEAMS)
          if (
            s
              .toLowerCase()
              .split(' ')
              .some((w) => w.startsWith(q)) ||
            s.toLowerCase().startsWith(q)
          )
            out.push({ type: 'role', key: `r-${s}`, insert: `@${s}`, name: s });
      for (const n of roster)
        if (
          n
            .toLowerCase()
            .split(' ')
            .some((w) => w.startsWith(q)) ||
          n.toLowerCase().startsWith(q)
        )
          out.push({ type: 'person', key: `p-${n}`, insert: `@${n}`, name: n });
      return out.slice(0, 8);
    }
    if (suggest.kind === '#')
      return tasks
        .filter((t) => (t.title || '').toLowerCase().includes(q))
        .slice(0, 6)
        .map((t) => ({ type: 'task', key: t.id, insert: `#${t.title}`, task: t }));
    // :emoji: (team emoji first)
    const team = teamEmoji.filter((e) => e.name.startsWith(q)).map((e) => ({ type: 'team', key: `t-${e.name}`, insert: `:${e.name}:`, e }));
    const std = searchEmoji(q, 8).map((e) => ({ type: 'emoji', key: e.char, insert: e.char, char: e.char, code: e.code }));
    return [...team, ...std].slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggest, roster, tasks, teamEmoji, isManager, isDm, emojiReady]);

  const onChange = (e) => {
    const value = e.target.value;
    setText(value);
    onTyping?.();
    const caret = e.target.selectionStart;
    const before = value.slice(0, caret);
    const m = /(^|\s)([@#])([^\s@#]{0,30})$/.exec(before) || /(^|\s)(:)([a-z0-9_+-]{2,30})$/i.exec(before);
    if (m?.[2] === ':' && !emojiList()) loadEmoji().then(() => setEmojiReady(true));
    setSuggest(m ? { kind: m[2], query: m[3], start: caret - m[3].length - 1, end: caret } : null);
    setActive(0);
  };

  const insertAt = (start, end, insert) => {
    const next = text.slice(0, start) + insert + text.slice(end);
    setText(next);
    caretAfterUpdate.current = [start + insert.length, start + insert.length];
  };

  const pick = (opt) => {
    insertAt(suggest.start, suggest.end, `${opt.insert} `);
    if (opt.type === 'task') setTaskIds((ids) => [...new Set([...ids, opt.task.id])]);
    if (opt.type === 'emoji' || opt.type === 'team') rememberEmoji(opt.insert);
    setSuggest(null);
  };

  const format = ([how, before, after]) => {
    const el = box.current;
    const [s, e] = el ? [el.selectionStart, el.selectionEnd] : [text.length, text.length];
    const r = how === 'wrap' ? wrapSelection(text, s, e, before, after) : prefixLines(text, s, e, before);
    setText(r.text);
    caretAfterUpdate.current = [r.start, r.end];
  };

  const insertEmoji = (emoji) => {
    const el = box.current;
    const [s, e] = el ? [el.selectionStart, el.selectionEnd] : [text.length, text.length];
    insertAt(s, e, emoji);
    setPanel(null);
  };

  const reset = () => {
    setText('');
    setTaskIds([]);
    setPhoto(null);
    setSuggest(null);
    onDone();
  };

  const replyInfo = () => (replyTo ? { id: replyTo.id, by: replyTo.by, text: (replyTo.text || '').slice(0, 120) } : null);

  // GIFs and polls go out as their own message (keeping any reply).
  const sendExtra = async (extra) => {
    setPanel(null);
    setSending(true);
    try {
      await api.sendMessage(conv, { text: '', mentions: [], taskIds: [], replyTo: replyInfo(), ...extra });
      if (replyTo) onDone();
    } finally {
      setSending(false);
    }
  };
  const uploadGif = async (file) => {
    if (file.type !== 'image/gif') return alert('That file is not a GIF.');
    if (file.size > 8e6) return alert('That GIF is too big (8 MB max).');
    setPanel(null);
    setSending(true);
    try {
      const img = await createImageBitmap(file).catch(() => null);
      const stored = await api.uploadChatGif(conv, file);
      if (stored) await sendExtra({ gif: { source: 'upload', ...stored, width: img?.width || 0, height: img?.height || 0 } });
    } finally {
      setSending(false);
    }
  };
  // Any file up to 25 MB goes out as its own message (videos play in chat).
  const sendFile = async (f) => {
    if (f.size > 25e6) return alert('That file is too big (25 MB max).');
    setPanel(null);
    setUpload({ name: f.name, progress: 0 });
    try {
      const stored = await api.uploadChatFile(conv, f, (p) => setUpload({ name: f.name, progress: p }));
      if (stored) await api.sendMessage(conv, { text: text.trim(), mentions: [], taskIds: [], replyTo: replyInfo(), files: [stored] });
      if (stored && text.trim()) setText('');
      if (replyTo) onDone();
    } finally {
      setUpload(null);
    }
  };
  const addPhoto = async (f) => {
    const prepared = await preparePhoto(f);
    setPhoto({ file: prepared, preview: URL.createObjectURL(prepared.thumb) });
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !photo) || sending) return;
    // @Subteam pings that subteam; @everyone (team management only) pings everyone.
    const everyone = !isDm && isManager && /@everyone(?![\w])/.test(body);
    const roles = isDm ? [] : SUBTEAMS.filter((s) => body.includes(`@${s}`));
    const named = roster.filter((n) => body.includes(`@${n}`));
    const mentions = [...new Set([...named, ...roles.flatMap(subteamMembers), ...(everyone ? roster : [])])].filter(
      (n) => n !== actor.name,
    );
    const linked = taskIds.filter((id) => tasks.some((t) => t.id === id && body.includes(`#${t.title}`)));
    setSending(true);
    try {
      if (editing) {
        await api.editMessage(conv, editing.id, { text: body, mentions, taskIds: linked, roles, everyone });
      } else {
        await api.sendMessage(conv, { text: body, mentions, taskIds: linked, replyTo: replyInfo(), roles, everyone }, photo?.file);
      }
      reset();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="composer">
      {(replyTo || editing) && (
        <div className="composer-context">
          {editing ? (
            <span>✏️ Editing your message</span>
          ) : (
            <span>
              ↩ Replying to <b>{replyTo.by.split(' ')[0]}</b>: {replyTo.text?.slice(0, 80) || 'a photo'}
            </span>
          )}
          <button className="icon-btn small" onClick={reset} aria-label="Cancel">
            <CloseIcon />
          </button>
        </div>
      )}
      {photo && (
        <div className="composer-photo">
          <img src={photo.preview} alt="" />
          <button className="icon-btn small" onClick={() => setPhoto(null)} aria-label="Remove photo">
            <CloseIcon />
          </button>
        </div>
      )}
      {panel === 'gif' && <GifPicker onPick={(gif) => sendExtra({ gif })} onUpload={uploadGif} onClose={() => setPanel(null)} />}
      {panel === 'emoji' && (
        <EmojiPicker
          onPick={insertEmoji}
          onClose={() => setPanel(null)}
          teamEmoji={teamEmoji}
          canManage={isManager}
          onManage={() => {
            setPanel(null);
            onManageEmoji();
          }}
          className="composer-emoji"
        />
      )}
      {panel === 'sticker' && (
        <StickerPicker
          stickers={stickers}
          onPick={(st) => sendExtra({ sticker: { id: st.id, name: st.name, url: st.url } })}
          onClose={() => setPanel(null)}
          canManage={isManager}
          onManage={() => {
            setPanel(null);
            onManageStickers();
          }}
        />
      )}
      {upload && (
        <div className="upload-bar">
          📎 Uploading {upload.name}… {Math.round(upload.progress * 100)}%
          <span className="upload-track">
            <span style={{ width: `${upload.progress * 100}%` }} />
          </span>
        </div>
      )}
      {panel === 'poll' && <PollDialog onCreate={(poll) => sendExtra({ poll, text: '', votes: {} })} onClose={() => setPanel(null)} />}
      {suggest && options.length > 0 && (
        <ul className="suggest">
          {options.map((o, i) => (
            <li key={o.key}>
              <button className={i === active ? 'active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}>
                {o.type === 'person' && (
                  <>
                    <Avatar name={o.name} size={22} showOnline /> {o.name}
                  </>
                )}
                {o.type === 'everyone' && (
                  <>
                    <span className="suggest-icon">📢</span> @everyone <span className="muted small">notifies the whole team</span>
                  </>
                )}
                {o.type === 'role' && (
                  <>
                    <span className="suggest-icon" style={{ color: SUBTEAM_COLORS[o.name] }}>
                      ●
                    </span>{' '}
                    @{o.name} <span className="muted small">{subteamMembers(o.name).length} people</span>
                  </>
                )}
                {o.type === 'task' && (
                  <>
                    <StatusDot status={o.task.status} /> {o.task.title}
                  </>
                )}
                {o.type === 'team' && (
                  <>
                    <img className="custom-emoji" src={o.e.url} alt="" /> :{o.e.name}:
                  </>
                )}
                {o.type === 'emoji' && (
                  <>
                    <span className="suggest-icon">{o.char}</span> :{o.code}:
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {formatBar && (
        <div className="format-bar" role="toolbar" aria-label="Formatting">
          {FORMATS.map(([lab, title, how]) => (
            <button
              key={title}
              title={title}
              aria-label={title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => format(how)}
              className={`fmt-${lab.length > 2 ? 'word' : lab}`}
            >
              {lab}
            </button>
          ))}
        </div>
      )}
      <div className="composer-row">
        {!editing && (
          <>
            {/* Phones: one ＋ button with a menu; wider screens show the buttons. */}
            <button className="icon-btn show-phone" onClick={() => setPanel(panel === 'more' ? null : 'more')} aria-label="Add" title="Add">
              ＋
            </button>
            {panel === 'more' && (
              <div className="composer-more">
                <button onClick={() => (setPanel(null), fileInput.current?.click())}>📷 Photo</button>
                <button onClick={() => setPanel('gif')}>🎞 GIF</button>
                <button onClick={() => setPanel('poll')}>📊 Poll</button>
                <button onClick={() => (setPanel(null), anyFileInput.current?.click())}>📎 File or video</button>
                <button onClick={() => setPanel('sticker')}>🎫 Sticker</button>
                <button onClick={() => setPanel('emoji')}>😊 Emoji</button>
              </div>
            )}
            <button className="icon-btn hide-phone" onClick={() => fileInput.current?.click()} aria-label="Add a photo" title="Add a photo">
              📷
            </button>
            <button
              className="icon-btn gif-btn hide-phone"
              onClick={() => setPanel(panel === 'gif' ? null : 'gif')}
              aria-label="Add a GIF"
              title="GIFs"
            >
              GIF
            </button>
            <button className="icon-btn hide-phone" onClick={() => setPanel('poll')} aria-label="Make a poll" title="Poll">
              📊
            </button>
            <button
              className="icon-btn hide-phone"
              onClick={() => anyFileInput.current?.click()}
              aria-label="Attach a file"
              title="File or video (25 MB)"
            >
              📎
            </button>
            <button
              className="icon-btn hide-phone"
              onClick={() => setPanel(panel === 'sticker' ? null : 'sticker')}
              aria-label="Stickers"
              title="Stickers"
            >
              🎫
            </button>
            <input
              ref={anyFileInput}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files[0];
                e.target.value = '';
                if (f) sendFile(f);
              }}
            />
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files[0];
                e.target.value = '';
                if (f) addPhoto(f);
              }}
            />
          </>
        )}
        <textarea
          ref={box}
          rows={1}
          value={text}
          onChange={onChange}
          onPaste={(e) => {
            const f = e.clipboardData?.files?.[0];
            if (f && !editing) {
              e.preventDefault();
              if (f.type === 'image/gif') uploadGif(f);
              else if (/^image\/(jpeg|png|webp|heic)/.test(f.type)) addPhoto(f);
              else sendFile(f);
            }
          }}
          onKeyDown={(e) => {
            if (suggest && options.length) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
                return;
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                pick(options[active] || options[0]);
                return;
              }
            }
            const mod = e.metaKey || e.ctrlKey;
            if (mod && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
              e.preventDefault();
              format(['wrap', { b: '**', i: '*', u: '__' }[e.key.toLowerCase()]]);
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            } else if (e.key === 'Escape') {
              if (suggest) setSuggest(null);
              else if (editing || replyTo) reset();
            }
          }}
          placeholder={`Message ${label}`}
          title="@ to mention, # to link a task, : for emoji"
        />
        <button
          className={`icon-btn${formatBar ? ' on' : ''}`}
          onClick={() => setFormatBar(!formatBar)}
          aria-label="Text formatting"
          title="Text formatting"
        >
          <span className="aa">Aa</span>
        </button>
        <button
          className="icon-btn hide-phone"
          onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')}
          aria-label="Emoji"
          title="Emoji"
        >
          😊
        </button>
        <button className="btn primary" onClick={send} disabled={sending || (!text.trim() && !photo)}>
          {editing ? 'Save' : sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
