import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../shell/icons.jsx';
import { SUBTEAMS, SUBTEAM_COLORS } from '../../config.js';
import { useControls } from '../../controls.js';
import { preparePhoto } from '../../util.js';
import { Avatar, CloseIcon, PlusIcon, StatusDot, usePeople } from '../common.jsx';
import { prefixLines, wrapSelection } from './format.jsx';
import { emojiList, loadEmoji, rememberEmoji, searchEmoji } from './emoji.js';
import { EmojiPicker, GifPicker, PollDialog, StandupDialog, StickerPicker } from './Pickers.jsx';
import { matchCommands, parseCommand, runCommand } from '../../commands.js';
import { CommandOption } from './Commands.jsx';
import { relTime } from '../../util.js';

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

// Unsent messages, per conversation, on this device: they're still there when
// you come back from another channel or tab.
const DRAFTS = 'chat-drafts';
const readDrafts = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS)) || {};
  } catch {
    return {};
  }
};
const saveDraft = (conv, text) => {
  try {
    const all = readDrafts();
    if (text.trim()) all[conv] = text;
    else delete all[conv];
    localStorage.setItem(DRAFTS, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
};

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
  teamEmoji: allTeamEmoji,
  stickers = [],
  onManageStickers,
  onManageEmoji,
  onTyping,
  isDm,
  // Slash commands: onNote shows a note only you see; useCommand ("/name ")
  // fills the box (from /help).
  onNote = () => {},
  useCommand,
}) {
  const people = usePeople();
  // Asher's Controls: features switched off don't show up here at all.
  const feat = useControls().isOn;
  const teamEmoji = feat('teamEmoji') ? allTeamEmoji : [];
  const [text, setText] = useState(() => readDrafts()[conv] || '');
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
  const [pollQuestion, setPollQuestion] = useState('');
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
  // A command picked from /help.
  useEffect(() => {
    if (!useCommand) return;
    const t = `/${useCommand.name} `;
    setText(t);
    caretAfterUpdate.current = [t.length, t.length];
  }, [useCommand]);
  // Put the cursor where it belongs after inserting text, before the next keystroke lands.
  useLayoutEffect(() => {
    const pos = caretAfterUpdate.current;
    if (pos === null || !box.current) return;
    caretAfterUpdate.current = null;
    box.current.focus();
    box.current.setSelectionRange(pos[0], pos[1]);
  }, [text]);
  useEffect(() => {
    if (!editing) saveDraft(conv, text);
  }, [conv, text, editing]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    // Empty: one line. Safari counts a wrapped placeholder in scrollHeight.
    el.style.height = text ? Math.min(el.scrollHeight, 200) + 'px' : '';
  }, [text]);
  // The phone ＋ menu closes when you tap anywhere else or press Escape.
  const moreMenu = useRef(null);
  const moreBtn = useRef(null);
  useEffect(() => {
    if (panel !== 'more') return;
    const away = (e) => !moreMenu.current?.contains(e.target) && !moreBtn.current?.contains(e.target) && setPanel(null);
    const esc = (e) => e.key === 'Escape' && setPanel(null);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [panel]);

  const subteamMembers = (s) => roster.filter((n) => people?.infoOf(n)?.subteams?.includes(s));

  const options = useMemo(() => {
    if (!suggest) return [];
    const q = suggest.query.toLowerCase();
    if (suggest.kind === '/')
      return matchCommands(q, api.team().commandCfg).map((c) => ({ type: 'cmd', key: c.name, insert: `/${c.name}`, c }));
    if (suggest.kind === '@') {
      if (!feat('mentions')) return [];
      const out = [];
      if (!isDm && isManager && feat('everyone') && 'everyone'.startsWith(q))
        out.push({ type: 'everyone', key: 'everyone', insert: '@everyone' });
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
    // "/" at the very start: the command menu.
    const slash = !editing && /^\/([a-z0-9]{0,20})$/i.exec(before);
    if (slash) {
      setSuggest({ kind: '/', query: slash[1], start: 0, end: caret });
      setActive(0);
      return;
    }
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
    // After editing a message, your unsent draft comes back.
    setText(editing ? readDrafts()[conv] || '' : '');
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

  // Trotbot's side of a command (see commands.js).
  const runSlash = async (parsed) => {
    setSending(true);
    try {
      const team = api.team();
      const result = await runCommand(parsed, {
        actor,
        roster,
        ...team,
        conv,
        tasks,
        subteam: team.subteamOf(conv),
        createTask: api.create,
        ping: api.ping,
        whois: api.whois,
        countdown: api.countdown,
        setAfk: (reason) => api.saveProfile(actor.name, { afk: { reason, since: Date.now() } }),
        addReminder: (at, what) => api.addReminder({ at, text: what, conv }),
        play: (game, args) => api.play({ action: 'run', game, args, conv, replyTo: replyInfo() }),
        wallet: api.wallet,
        richest: api.richest,
        gift: api.gift,
      });
      if (result.post) {
        await api.sendMessage(conv, { mentions: [], taskIds: [], replyTo: replyInfo(), roles: [], everyone: false, ...result.post });
        reset();
      } else if (result.note) {
        onNote(result.note);
        reset();
      } else if (result.done) {
        reset();
      } else if (result.standup) {
        setText('');
        setSuggest(null);
        setPanel('standup');
      } else if (result.poll !== undefined) {
        setText('');
        setSuggest(null);
        setPollQuestion(result.poll);
        setPanel('poll');
      }
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !photo) || sending) return;
    const parsed = !editing && !photo && parseCommand(body);
    if (parsed) return runSlash(parsed);
    // @Subteam pings that subteam; @everyone (team management only) pings everyone.
    const everyone = !isDm && isManager && feat('everyone') && /@everyone(?![\w])/.test(body);
    const roles = isDm || !feat('mentions') ? [] : SUBTEAMS.filter((s) => body.includes(`@${s}`));
    const named = feat('mentions') ? roster.filter((n) => body.includes(`@${n}`)) : [];
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
        // AFK: you're back once you talk; and anyone you @ who's away gets mentioned.
        if (people?.profileOf(actor.name)?.afk) {
          api.saveProfile(actor.name, { afk: null });
          onNote({ title: '👋 Welcome back!', body: 'I removed your AFK.' });
        }
        for (const n of named) {
          const afk = n !== actor.name && people?.profileOf(n)?.afk;
          if (afk)
            onNote({
              title: `💤 ${n.split(' ')[0]} is AFK: ${afk.reason}`,
              body: `Since ${relTime(afk.since)}. They’ll see it when they’re back.`,
            });
        }
      }
      reset();
    } finally {
      setSending(false);
    }
  };

  const cmdHint = !editing && text.startsWith('/') ? parseCommand(text.split(/\s/)[0])?.cmd : null;

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
      {panel === 'poll' && (
        <PollDialog
          initialQuestion={pollQuestion}
          canRequire={conv === 'announcements'}
          onCreate={(poll) => sendExtra({ poll, text: '', votes: {} })}
          onClose={() => {
            setPanel(null);
            setPollQuestion('');
          }}
        />
      )}
      {panel === 'standup' && (
        <StandupDialog
          onPost={(standup) =>
            sendExtra({
              text: '/standup',
              cmd: { name: 'standup', ...standup, day: new Date().toLocaleDateString(undefined, { weekday: 'long' }) },
            })
          }
          onClose={() => setPanel(null)}
        />
      )}
      {suggest && options.length > 0 && (
        <ul className={`suggest${suggest.kind === '/' ? ' suggest-cmds' : ''}`}>
          {options.map((o, i) => (
            <li key={o.key}>
              <button className={i === active ? 'active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}>
                {o.type === 'cmd' && <CommandOption c={o.c} />}
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
      {!suggest && cmdHint && (
        <div className="cmd-hint">
          <code>/{cmdHint.name}</code>
          {cmdHint.args && <span className="cmd-opt-args">{cmdHint.args}</span>}
          <span className="muted small">{cmdHint.desc}</span>
        </div>
      )}
      {formatBar && feat('formatting') && (
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
            <button
              ref={moreBtn}
              className="icon-btn show-phone"
              onClick={() => setPanel(panel === 'more' ? null : 'more')}
              aria-label="Add"
              title="Add"
            >
              <PlusIcon size={20} />
            </button>
            {panel === 'more' && (
              <div className="composer-more" ref={moreMenu}>
                {feat('photos') && (
                  <button onClick={() => (setPanel(null), fileInput.current?.click())}>
                    <Icon name="camera" /> Photo
                  </button>
                )}
                {feat('gifs') && <button onClick={() => setPanel('gif')}>🎞 GIF</button>}
                {feat('polls') && (
                  <button onClick={() => setPanel('poll')}>
                    <Icon name="poll" /> Poll
                  </button>
                )}
                {feat('files') && (
                  <button onClick={() => (setPanel(null), anyFileInput.current?.click())}>
                    <Icon name="clip" /> File or video
                  </button>
                )}
                {feat('stickers') && (
                  <button onClick={() => setPanel('sticker')}>
                    <Icon name="sticker" /> Sticker
                  </button>
                )}
                <button onClick={() => setPanel('emoji')}>
                  <Icon name="smile" /> Emoji
                </button>
              </div>
            )}
            {feat('photos') && (
              <button
                className="icon-btn hide-phone"
                onClick={() => fileInput.current?.click()}
                aria-label="Add a photo"
                title="Add a photo"
              >
                <Icon name="camera" />
              </button>
            )}
            {feat('gifs') && (
              <button
                className="icon-btn gif-btn hide-phone"
                onClick={() => setPanel(panel === 'gif' ? null : 'gif')}
                aria-label="Add a GIF"
                title="GIFs"
              >
                GIF
              </button>
            )}
            {feat('polls') && (
              <button className="icon-btn hide-phone" onClick={() => setPanel('poll')} aria-label="Make a poll" title="Poll">
                <Icon name="poll" />
              </button>
            )}
            {feat('files') && (
              <button
                className="icon-btn hide-phone"
                onClick={() => anyFileInput.current?.click()}
                aria-label="Attach a file"
                title="File or video (25 MB)"
              >
                <Icon name="clip" />
              </button>
            )}
            {feat('stickers') && (
              <button
                className="icon-btn hide-phone"
                onClick={() => setPanel(panel === 'sticker' ? null : 'sticker')}
                aria-label="Stickers"
                title="Stickers"
              >
                <Icon name="sticker" />
              </button>
            )}
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
          enterKeyHint="send"
          value={text}
          onChange={onChange}
          onPaste={(e) => {
            const f = e.clipboardData?.files?.[0];
            if (!f || editing) return;
            const how = f.type === 'image/gif' ? 'gifs' : /^image\/(jpeg|png|webp|heic)/.test(f.type) ? 'photos' : 'files';
            if (!feat(how)) return;
            e.preventDefault();
            if (how === 'gifs') uploadGif(f);
            else if (how === 'photos') addPhoto(f);
            else sendFile(f);
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
                const opt = options[active] || options[0];
                // "/ping" + Enter: it's complete and needs nothing more, so send it.
                if (e.key === 'Enter' && opt.type === 'cmd' && opt.c.name === suggest.query.toLowerCase() && !opt.c.args) {
                  setSuggest(null);
                  send();
                } else pick(opt);
                return;
              }
            }
            const mod = e.metaKey || e.ctrlKey;
            if (mod && feat('formatting') && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
              e.preventDefault();
              format(['wrap', { b: '**', i: '*', u: '__' }[e.key.toLowerCase()]]);
            } else if (e.key === 'Enter' && !e.shiftKey) {
              // Return sends; Shift+Return makes a new line.
              e.preventDefault();
              send();
            } else if (e.key === 'Escape') {
              if (suggest) setSuggest(null);
              else if (editing || replyTo) reset();
            }
          }}
          placeholder={`Message ${label}`}
          title="/ for commands, @ to mention, # to link a task, : for emoji"
        />
        {feat('formatting') && (
          <button
            className={`icon-btn${formatBar ? ' on' : ''}`}
            onClick={() => setFormatBar(!formatBar)}
            aria-label="Text formatting"
            title="Text formatting"
          >
            <span className="aa">Aa</span>
          </button>
        )}
        <button
          className="icon-btn hide-phone"
          onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')}
          aria-label="Emoji"
          title="Emoji"
        >
          <Icon name="smile" />
        </button>
        <button className="btn primary" onClick={send} disabled={sending || (!text.trim() && !photo)}>
          {editing ? 'Save' : sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
