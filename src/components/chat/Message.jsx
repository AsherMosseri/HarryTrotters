import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../shell/icons.jsx';
import { personId } from '../../data/diff.js';
import { CommandCard, Trotbot } from './Commands.jsx';
import { AutoTextarea, Avatar, DisplayName, Overlay, StatusDot, usePeople } from '../common.jsx';
import { borderProps } from '../../borders.js';
import { isJumbo, renderRich } from './format.jsx';
import { EmojiPicker, PollDialog, QUICK_MAX } from './Pickers.jsx';
import { CUSTOM_RE } from './emoji.js';
import { isCoinCommand, useControls } from '../../controls.js';

export const QUICK_REACTIONS = ['👍', '✅', '😂', '❤️', '🔥', '👀'];
// Your quick reactions (the picker's Edit, saved on your profile), or the first three.
const quickOf = (profile) => (Array.isArray(profile?.quickReactions) ? profile.quickReactions.slice(0, QUICK_MAX) : QUICK_REACTIONS.slice(0, 3));

// A picker that floats next to the message's buttons, above them when there's
// no room below, and always fully on screen (no scrolling the chat to reach
// it). Phones pin it near the top (CSS). A tap outside closes it.
function FloatingPicker({ anchor, onClose, children }) {
  const box = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const el = box.current;
      // The buttons can be hidden for a moment (the pointer left the message
      // when the picker opened): keep the last spot.
      if (!a || !el || (!a.width && !a.height)) return;
      if (window.innerWidth <= 760) return setPos({});
      const h = el.offsetHeight;
      const w = el.offsetWidth;
      const vh = window.visualViewport?.height || window.innerHeight;
      const below = a.bottom + 6;
      const above = a.top - 6 - h;
      const top = below + h <= vh - 8 ? below : above >= 8 ? above : Math.max(8, vh - 8 - h);
      const left = Math.min(Math.max(8, a.right - w), window.innerWidth - w - 8);
      setPos({ top, left });
    };
    place();
    const ro = new ResizeObserver(place);
    if (box.current) ro.observe(box.current);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [anchor]);
  return (
    <Overlay>
      <div className="picker-scrim" onClick={onClose} />
      <div ref={box} className="floating-picker" style={pos ? pos : { visibility: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </Overlay>
  );
}

// Whether a message still has something to show with some features switched
// off (Controls): a GIF-only message disappears when GIFs are off.
export function messageShows(m, feat) {
  if (m.cmd && isCoinCommand(m.cmd.name)) return feat('coins');
  if (m.deleted || m.cmd || (m.text && !m.poll)) return true;
  return !!(
    (m.poll && feat('polls')) ||
    (m.gif && feat('gifs')) ||
    (m.sticker && feat('stickers')) ||
    (m.files?.length && feat('files')) ||
    (m.photo && feat('photos'))
  );
}
export const timeOf = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// A YouTube link's video id, for the inline player.
export function youtubeId(url) {
  const m = /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(url || '');
  return m?.[1] || '';
}

function YouTube({ id }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="yt" onClick={(e) => e.stopPropagation()}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title="YouTube video"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button className="yt-thumb" onClick={() => setPlaying(true)} aria-label="Play video">
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
          <span className="yt-play">▶</span>
        </button>
      )}
    </div>
  );
}

function LinkPreview({ p, canHide, onHide }) {
  return (
    <div className="link-card" onClick={(e) => e.stopPropagation()}>
      <div className="grow">
        <div className="muted tiny">{p.site}</div>
        <a href={p.url} target="_blank" rel="noreferrer noopener" className="link-card-title">
          {p.title}
        </a>
        {p.description && <p className="small">{p.description}</p>}
      </div>
      {p.image && <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      {canHide && (
        <button className="icon-btn small link-card-hide" onClick={onHide} title="Remove preview" aria-label="Remove preview">
          ✕
        </button>
      )}
    </div>
  );
}

// A written-answer poll: everyone types their own answer (votes.text).
function TextPoll({ m, actor, onAnswer, onEnd, onReopen, canEnd }) {
  const answers = Object.keys(m.votes?.text || {}).length;
  const closed = !!m.poll.closed;
  return (
    <div className="poll poll-text" onClick={(e) => e.stopPropagation()}>
      <div className="poll-q">{m.poll.question}</div>
      <div className="muted tiny">
        {closed ? 'Poll ended' : 'Write your answer'} · {answers} {answers === 1 ? 'answer' : 'answers'}
        {m.poll.required && !closed && <span className="poll-required"> · Everyone has to answer</span>}
      </div>
      <WrittenAnswers m={m} actor={actor} onAnswer={onAnswer} closed={closed} />
      {canEnd && <PollControls closed={closed} onEnd={onEnd} onReopen={onReopen} />}
    </div>
  );
}

// The written answers under a poll (a written-answer poll, or a choice poll
// that also takes written answers), with a box to write or edit yours.
function WrittenAnswers({ m, actor, onAnswer, closed, optional }) {
  const me = personId(actor.name);
  const answers = Object.entries(m.votes?.text || {})
    .map(([id, a]) => ({ id, ...a }))
    .sort((a, b) => (a.at || 0) - (b.at || 0));
  const mine = m.votes?.text?.[me];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [all, setAll] = useState(false);
  const shown = all ? answers : answers.slice(0, 5);
  const save = async () => {
    await onAnswer(draft);
    setEditing(false);
  };
  return (
    <div className={optional ? 'poll-write' : undefined}>
      {optional && <div className="muted tiny poll-write-head">{closed ? 'Written answers' : 'Or write your own'}</div>}
      {!closed && (!mine || editing) && (
        <div className="poll-answer-box">
          <AutoTextarea
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={optional ? 'Your own answer' : 'Your answer'}
            maxLength={1000}
            aria-label="Your answer"
          />
          <div className="row gap">
            <button className="btn primary small-btn" disabled={!draft.trim()} onClick={save}>
              {mine ? 'Save' : 'Send'}
            </button>
            {editing && (
              <button className="btn small-btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
      {shown.length > 0 && (
        <ul className="poll-answers">
          {shown.map((a) => (
            <li key={a.id} className={a.id === me ? 'mine' : ''}>
              <Avatar name={a.name} size={22} />
              <div className="grow">
                <b className="small">{a.name}</b>
                <div className="poll-answer-text">{a.text}</div>
              </div>
              {a.id === me && !closed && !editing && (
                <button
                  className="link-btn small"
                  onClick={() => {
                    setDraft(a.text);
                    setEditing(true);
                  }}
                >
                  Edit
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {answers.length > 5 && (
        <button className="link-btn small" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${answers.length} answers`}
        </button>
      )}
    </div>
  );
}

// Ending a poll asks first; an ended poll can be reopened. For its poster
// and team management.
function PollControls({ closed, onEnd, onReopen }) {
  const [asking, setAsking] = useState(false);
  if (closed)
    return (
      <button className="link-btn small" onClick={onReopen}>
        Reopen poll
      </button>
    );
  if (!asking)
    return (
      <button className="link-btn small" onClick={() => setAsking(true)}>
        End poll
      </button>
    );
  return (
    <div className="poll-confirm" role="group" aria-label="End this poll?">
      <span className="small">End this poll? No one can vote until it’s reopened.</span>
      <button
        className="btn small-btn danger"
        onClick={() => {
          setAsking(false);
          onEnd();
        }}
      >
        End poll
      </button>
      <button className="btn small-btn" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </div>
  );
}

function Poll({ m, actor, onVote, onEnd, onReopen, canEnd, onAnswer }) {
  if (m.poll.kind === 'text') return <TextPoll m={m} actor={actor} onAnswer={onAnswer} onEnd={onEnd} onReopen={onReopen} canEnd={canEnd} />;
  return <ChoicePoll m={m} actor={actor} onVote={onVote} onEnd={onEnd} onReopen={onReopen} canEnd={canEnd} onAnswer={onAnswer} />;
}

function ChoicePoll({ m, actor, onVote, onEnd, onReopen, canEnd, onAnswer }) {
  const me = personId(actor.name);
  const votes = m.votes || {};
  const counts = m.poll.options.map((o) => Object.keys(votes[o.id] || {}).length);
  const voters = new Set(Object.values(votes).flatMap((v) => Object.keys(v || {})));
  const max = Math.max(1, ...counts);
  const closed = !!m.poll.closed;
  return (
    <div className="poll" onClick={(e) => e.stopPropagation()}>
      <div className="poll-q">{m.poll.question}</div>
      <div className="muted tiny">
        {closed ? 'Poll ended' : `${m.poll.multi ? 'Pick one or more' : 'Pick one'}${m.poll.write ? ' or write your own' : ''}`} · {voters.size}{' '}
        {voters.size === 1 ? 'vote' : 'votes'}
        {m.poll.required && !closed && <span className="poll-required"> · Everyone has to answer</span>}
      </div>
      {m.poll.options.map((o, i) => {
        const mine = !!votes[o.id]?.[me];
        const names = Object.values(votes[o.id] || {});
        return (
          <button
            key={o.id}
            className={`poll-opt${mine ? ' mine' : ''}`}
            disabled={closed}
            onClick={() => onVote(o.id, !mine)}
            title={names.join(', ') || 'No votes yet'}
          >
            <span className="poll-bar" style={{ width: `${(counts[i] / max) * 100}%`, opacity: counts[i] ? 1 : 0 }} />
            <span className="poll-check">{mine ? '✓' : ''}</span>
            <span className="grow">{o.text}</span>
            <span className="poll-voters">
              {names.slice(0, 3).map((n) => (
                <Avatar key={n} name={n} size={18} />
              ))}
            </span>
            <b>{counts[i]}</b>
          </button>
        );
      })}
      {m.poll.write && <WrittenAnswers m={m} actor={actor} onAnswer={onAnswer} closed={closed} optional />}
      {canEnd && <PollControls closed={closed} onEnd={onEnd} onReopen={onReopen} />}
    </div>
  );
}

const fmtSize = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
// A file in a message: videos and audio play inline, pictures show, anything
// else is a download card.
function Attachment({ f }) {
  const kind = f.type.split('/')[0];
  if (kind === 'video')
    return <video className="msg-video" src={f.url} controls playsInline preload="metadata" onClick={(e) => e.stopPropagation()} />;
  if (kind === 'audio') return <audio className="msg-audio" src={f.url} controls preload="metadata" onClick={(e) => e.stopPropagation()} />;
  if (kind === 'image')
    return (
      <a href={f.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        <img className="msg-image-file" src={f.url} alt={f.name} loading="lazy" />
      </a>
    );
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  return (
    <a className="file-card" href={f.url} target="_blank" rel="noreferrer" download={f.name} onClick={(e) => e.stopPropagation()}>
      <span className="file-icon">{(ext || 'file').slice(0, 4).toUpperCase()}</span>
      <span className="grow">
        <b className="file-name">{f.name}</b>
        <span className="muted tiny">{fmtSize(f.size)}</span>
      </span>
      <span className="file-dl">⬇</span>
    </a>
  );
}

// The big moment when a super reaction lands: the emoji blows up over the
// chat from the reaction, with a shockwave and a spray of little copies and
// sparks, then shrinks back into place.
function SuperBurst({ from, emoji, teamEmoji }) {
  const r = from.current?.getBoundingClientRect();
  if (!r) return null;
  return (
    <Overlay>
      <div className="super-fx" style={{ left: r.left + r.width / 2, top: r.top + r.height / 2 }} aria-hidden="true">
        <span className="super-fx-wave" />
        <span className="super-fx-wave late" />
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} className="super-fx-spark" style={{ '--a': `${i * (360 / 14)}deg`, '--d': `${90 + (i % 3) * 40}px` }} />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="super-fx-mini" style={{ '--a': `${i * 60 + 30}deg` }}>
            <ReactionGlyph emoji={emoji} teamEmoji={teamEmoji} />
          </span>
        ))}
        <span className="super-fx-big">
          <ReactionGlyph emoji={emoji} teamEmoji={teamEmoji} />
        </span>
      </div>
    </Overlay>
  );
}

// A super reaction: bursts when someone adds one (and again when you point at
// it, like replaying it).
function SuperChip({ emoji, who, mine, teamEmoji, onClick, fresh }) {
  const count = Object.keys(who).length;
  const last = useRef(count);
  const chip = useRef(null);
  // A chip that appears after the message was already showing (someone just
  // added it) starts with a burst too.
  const [burst, setBurst] = useState(fresh);
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(false), 1600);
    return () => clearTimeout(t);
  }, [burst]);
  useEffect(() => {
    if (count > last.current) setBurst(true);
    last.current = count;
  }, [count]);
  return (
    <button
      ref={chip}
      className={`reaction super${mine ? ' mine' : ''}${burst ? ' burst' : ''}`}
      title={`Super reaction: ${Object.values(who).join(', ')}`}
      onClick={onClick}
      onPointerEnter={(e) => e.pointerType === 'mouse' && !burst && setBurst(true)}
    >
      {burst && <SuperBurst from={chip} emoji={emoji} teamEmoji={teamEmoji} />}
      <span className="super-glyph">
        <ReactionGlyph emoji={emoji} teamEmoji={teamEmoji} />
        {burst && (
          <span className="burst-ring" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={{ '--a': `${i * 45}deg` }} />
            ))}
          </span>
        )}
      </span>{' '}
      {count}
    </button>
  );
}

// Shows a reaction: a normal emoji, or a team emoji's picture.
export function ReactionGlyph({ emoji, teamEmoji }) {
  const custom = CUSTOM_RE.exec(emoji);
  if (custom) {
    const e = teamEmoji.find((t) => t.name === custom[1]);
    return e ? <img className="custom-emoji" src={e.url} alt={emoji} /> : <span>{emoji}</span>;
  }
  return <span>{emoji}</span>;
}

export default function Message({
  m,
  first,
  conv,
  ctx,
  actor,
  isManager,
  canPost,
  taskById,
  selected,
  onSelect,
  api,
  teamEmoji,
  onManageEmoji,
  onReply,
  onEdit,
  onMakeTask,
  onOpenTask,
  onPhoto,
  onJump,
  onPerson,
  picking, // choosing messages to delete: a tap checks this one (if it can be deleted)
  picked,
  onPick,
  onStartPick,
  onAskDelete,
}) {
  const [picker, setPicker] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [editPoll, setEditPoll] = useState(false);
  const actionsRef = useRef(null);
  const quick = quickOf(usePeople()?.profileOf(actor.name));
  const feat = useControls().isOn;
  const mine = m.byUid === actor.uid;
  // The author's message border (Edit profile → Style → Borders).
  const frame = borderProps(usePeople()?.profileOf(m.by)?.msgBorder);
  // Team emoji off: reactions with them are hidden too. Reactions off: none.
  const shownReaction = ([emoji, who]) => who && Object.keys(who).length && (feat('teamEmoji') || !CUSTOM_RE.test(emoji));
  const reactions = feat('reactions') ? Object.entries(m.reactions || {}).filter(shownReaction) : [];
  const myRoles = ctx.myRoles || [];
  // Highlight messages that ping me (not my own).
  const mentionsMe =
    !mine &&
    feat('mentions') &&
    ((m.mentions || []).includes(actor.name) || (m.everyone && feat('everyone')) || (m.roles || []).some((r) => myRoles.includes(r)));
  const react = (emoji) => {
    if (picker === 'super') return superReact(emoji);
    const on = !(m.reactions?.[emoji] && m.reactions[emoji][actor.uid]);
    api.react(conv, m.id, emoji, on);
    setPicker(false);
  };
  const superReact = (emoji) => {
    const on = !m.supers?.[emoji]?.[actor.uid];
    api.superReact(conv, m.id, emoji, on);
    setPicker(false);
  };
  const supers = feat('reactions') ? Object.entries(m.supers || {}).filter(shownReaction) : [];
  // Set once the message has rendered, so later super reactions animate.
  const shown = useRef(false);
  useEffect(() => {
    shown.current = true;
  }, []);
  const yt = feat('linkPreviews') && (youtubeId(m.preview?.url) || youtubeId(/https?:\/\/\S+/.exec(m.text || '')?.[0]));
  const jumbo = !m.poll && isJumbo(m.text, ctx.emoji);

  return (
    <div
      className={`msg${first ? ' first' : ''}${(selected || picker) && !picking ? ' selected' : ''}${mentionsMe ? ' mentions-me' : ''}${m.pinned && feat('pins') ? ' pinned' : ''}${picking ? ' picking' : ''}${picked ? ' picked' : ''}`}
      id={`msg-${m.id}`}
      onClickCapture={(e) => {
        // Choosing messages: a tap anywhere on one checks or unchecks it.
        if (!picking) return;
        e.preventDefault();
        e.stopPropagation();
        if (mine || isManager) onPick(m);
      }}
      onClick={(e) => {
        if (e.target.closest('a,button,input,.emoji-picker,.spoiler:not(.shown)')) return;
        onSelect(selected ? null : m.id);
      }}
    >
      {picking && (mine || isManager) && (
        <span className={`msg-pick${picked ? ' on' : ''}`} aria-hidden="true">
          {picked ? '✓' : ''}
        </span>
      )}
      <div className="msg-gutter">
        {first && m.bot ? (
          <span className="cmd-bot big" aria-hidden="true">
            🤖
          </span>
        ) : first ? (
          <button className="avatar-btn" onClick={(e) => onPerson(m.by, e)} aria-label={m.by}>
            <Avatar name={m.by} size={36} />
          </button>
        ) : (
          <span className="msg-time-hover">{timeOf(m.at)}</span>
        )}
      </div>
      <div className="msg-body">
        {first && (
          <div className="msg-head">
            {m.bot ? (
              <>
                <b>Trotbot</b> <span className="cmd-tag">BOT</span>
              </>
            ) : (
              <DisplayName as="button" name={m.by} className="name-btn" onClick={(e) => onPerson(m.by, e)} />
            )}{' '}
            <span className="muted tiny">{timeOf(m.at)}</span>
            {m.pinned && feat('pins') && (
              <span className="msg-pinned" title={`Pinned by ${m.pinnedBy}`}>
                <Icon name="pin" size={13} /> Pinned
              </span>
            )}
          </div>
        )}
        {m.replyTo && feat('replies') && (
          <button className="msg-reply-quote" onClick={() => onJump(m.replyTo.id)}>
            <Icon name="reply" size={14} /> <b>{m.replyTo.by?.split(' ')[0]}</b> {m.replyTo.text || 'a photo'}
          </button>
        )}
        {m.deleted ? (
          <div className="msg-text muted">
            <i>Message deleted</i>
          </div>
        ) : (
          <>
            {m.text && !m.poll && (!m.cmd || m.cmd.name === 'me') && (
              <div className={`msg-text${jumbo ? ' jumbo' : ''}${m.cmd ? ' msg-me' : ''} ${frame.className}`} style={frame.style}>
                {m.cmd ? <em>{renderRich(m.text, ctx)}</em> : renderRich(m.text, ctx)}
                {m.editedAt && feat('editing') && <span className="muted tiny edited"> (edited)</span>}
              </div>
            )}
            {m.cmd && m.cmd.name !== 'me' && m.cmd.name !== 'wyr' && (
              <CommandCard
                m={m}
                onPerson={onPerson}
                me={actor.name}
                onMove={(move) => api.play({ action: 'move', conv, msgId: m.id, move })}
                onBuy={(n) => api.play({ action: 'run', game: 'lottery', args: [String(n)], conv })}
              />
            )}
            {m.cmd?.name === 'wyr' && <Trotbot name="wyr" />}
            {m.poll && feat('polls') && (
              <Poll
                m={m}
                actor={actor}
                canEnd={mine || isManager}
                onVote={(optionId, on) => api.vote(conv, m, optionId, on)}
                onAnswer={(text) => api.answerPoll(conv, m, text)}
                onEnd={() => api.editMessage(conv, m.id, { poll: { ...m.poll, closed: true } })}
                onReopen={() => api.editMessage(conv, m.id, { poll: { ...m.poll, closed: false } })}
              />
            )}
            {m.gif && feat('gifs') && <img className="msg-gif" src={m.gif.url} alt={m.gif.title || 'GIF'} loading="lazy" />}
            {m.sticker && feat('stickers') && (
              <img className="msg-sticker" src={m.sticker.url} alt={`Sticker: ${m.sticker.name}`} title={m.sticker.name} loading="lazy" />
            )}
            {(feat('files') ? m.files || [] : []).map((f) => (
              <Attachment key={f.path || f.url} f={f} />
            ))}
            {m.photo && feat('photos') && (
              <button className="msg-photo" onClick={() => onPhoto(m)} aria-label="Open photo">
                <img src={m.photo.thumbUrl || m.photo.url} alt="" loading="lazy" />
              </button>
            )}
            {yt ? (
              <YouTube id={yt} />
            ) : (
              m.preview && feat('linkPreviews') && <LinkPreview p={m.preview} canHide={mine} onHide={() => api.hidePreview(conv, m.id)} />
            )}
            {(m.taskIds || []).filter((id) => taskById[id]).length > 0 && (
              <div className="msg-tasks">
                {m.taskIds
                  .filter((id) => taskById[id])
                  .map((id) => (
                    <button key={id} className="task-chip" onClick={() => onOpenTask(id)}>
                      <StatusDot status={taskById[id].status} /> {taskById[id].title}
                    </button>
                  ))}
              </div>
            )}
          </>
        )}
        {(reactions.length > 0 || supers.length > 0) && (
          <div className="msg-reactions">
            {supers.map(([emoji, who]) => (
              <SuperChip
                key={`s-${emoji}`}
                fresh={shown.current}
                emoji={emoji}
                who={who}
                mine={!!who[actor.uid]}
                teamEmoji={teamEmoji}
                onClick={() => superReact(emoji)}
              />
            ))}
            {reactions.map(([emoji, who]) => (
              <button
                key={emoji}
                className={`reaction${who[actor.uid] ? ' mine' : ''}`}
                title={Object.values(who).join(', ')}
                onClick={() => react(emoji)}
              >
                <ReactionGlyph emoji={emoji} teamEmoji={teamEmoji} /> {Object.keys(who).length}
              </button>
            ))}
          </div>
        )}
        {/* Tap a message to see who reacted with what. */}
        {selected && !removing && (reactions.length > 0 || supers.length > 0) && (
          <div className="reacted-by" aria-label="Who reacted">
            {[...supers.map(([e, who]) => [e, who, true]), ...reactions.map(([e, who]) => [e, who, false])].map(([emoji, who, sup]) => (
              <div key={`${sup ? 's' : 'r'}-${emoji}`}>
                <span className="reacted-glyph">
                  <ReactionGlyph emoji={emoji} teamEmoji={teamEmoji} />
                  {sup && (
                    <span className="reacted-super" title="Super reaction">
                      <Icon name="superReact" size={12} />
                    </span>
                  )}
                </span>
                <span>{Object.values(who).join(', ')}</span>
              </div>
            ))}
          </div>
        )}
        {removing && (
          <div className="msg-reactions remove-mode">
            <span className="muted small">Remove a reaction:</span>
            {reactions.map(([emoji]) => (
              <button
                key={emoji}
                className="reaction"
                onClick={() => {
                  api.removeReaction(conv, m.id, emoji);
                  if (reactions.length <= 1) setRemoving(false);
                }}
              >
                <ReactionGlyph emoji={emoji} teamEmoji={teamEmoji} /> ✕
              </button>
            ))}
            <button className="link-btn" onClick={() => setRemoving(false)}>
              Done
            </button>
          </div>
        )}
      </div>
      {!m.deleted && !picking && (
        <div className="msg-actions" ref={actionsRef} onClick={(e) => e.stopPropagation()}>
          {feat('reactions') && (
            <>
              {quick.map((e) => (
                <button key={e} onClick={() => react(e)} aria-label={`React ${e}`}>
                  <ReactionGlyph emoji={e} teamEmoji={teamEmoji} />
                </button>
              ))}
              <button onClick={() => setPicker((p) => !p)} aria-label="More reactions" title="More reactions">
                <Icon name="smilePlus" size={18} />
              </button>
              <button
                onClick={() => setPicker((p) => (p === 'super' ? false : 'super'))}
                aria-label="Super reaction"
                title="Super reaction (animated)"
                className={picker === 'super' ? 'on' : ''}
              >
                <Icon name="superReact" size={18} />
              </button>
            </>
          )}
          {canPost && feat('replies') && (
            <button onClick={() => onReply(m)} title="Reply" aria-label="Reply">
              <Icon name="reply" size={18} />
            </button>
          )}
          {feat('pins') && (
            <button
              className={m.pinned ? 'on' : ''}
              onClick={() => api.pin(conv, m.id, !m.pinned)}
              title={m.pinned ? 'Unpin' : 'Pin to this channel'}
              aria-label={m.pinned ? 'Unpin' : 'Pin'}
            >
              <Icon name="pin" size={18} />
            </button>
          )}
          {feat('makeTask') && (
            <button onClick={() => onMakeTask(m)} title="Make a task from this message">
              <Icon name="tasks" size={18} /> Task
            </button>
          )}
          {m.poll && feat('polls') && (mine || isManager) && (
            <button onClick={() => setEditPoll(true)} title="Edit poll: question, choices, written answers" aria-label="Edit poll">
              <Icon name="edit" size={18} />
            </button>
          )}
          {mine && feat('editing') && !m.poll && !m.cmd && (
            <button onClick={() => onEdit(m)} title="Edit" aria-label="Edit">
              <Icon name="edit" size={18} />
            </button>
          )}
          {isManager && reactions.length > 0 && (
            <button onClick={() => setRemoving(true)} title="Remove reactions" aria-label="Remove reactions">
              <Icon name="smileOff" size={18} />
            </button>
          )}
          {(mine || isManager) && (
            <button onClick={() => onStartPick(m)} title="Select messages (to delete several)" aria-label="Select messages">
              <Icon name="select" size={18} />
            </button>
          )}
          {(mine || isManager) && (
            <button className="danger-text" onClick={() => onAskDelete([m])} title="Delete" aria-label="Delete">
              <Icon name="trash" size={18} />
            </button>
          )}
          {picker && feat('reactions') && (
            <FloatingPicker anchor={actionsRef} onClose={() => setPicker(false)}>
              <EmojiPicker
                title={
                  picker === 'super' ? (
                    <span className="super-title">
                      <Icon name="superReact" size={16} /> Super reaction
                    </span>
                  ) : (
                    ''
                  )
                }
                onPick={react}
                onClose={() => setPicker(false)}
                teamEmoji={teamEmoji}
                canManage={isManager}
                onManage={() => {
                  setPicker(false);
                  onManageEmoji();
                }}
                quick={picker === 'super' ? null : quick}
                onSaveQuick={(list) => api.saveProfile(actor.name, { quickReactions: list })}
                className="reaction-picker"
              />
            </FloatingPicker>
          )}
        </div>
      )}
      {editPoll && (
        <PollDialog
          editing={m.poll}
          onClose={() => setEditPoll(false)}
          onCreate={async (poll) => {
            await api.editMessage(conv, m.id, { poll });
            setEditPoll(false);
          }}
        />
      )}
    </div>
  );
}
