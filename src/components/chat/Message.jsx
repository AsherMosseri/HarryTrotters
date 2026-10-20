import { useState } from 'react';
import { personId } from '../../data/diff.js';
import { Avatar, StatusDot, usePeople } from '../common.jsx';
import { isJumbo, renderRich } from './format.jsx';
import { EmojiPicker } from './Pickers.jsx';
import { CUSTOM_RE } from './emoji.js';

export const QUICK_REACTIONS = ['👍', '✅', '😂', '❤️', '🔥', '👀'];
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

function Poll({ m, actor, onVote, onEnd, canEnd }) {
  const me = personId(actor.name);
  const votes = m.votes || {};
  const counts = m.poll.options.map((o) => Object.keys(votes[o.id] || {}).length);
  const voters = new Set(Object.values(votes).flatMap((v) => Object.keys(v || {})));
  const max = Math.max(1, ...counts);
  const closed = !!m.poll.closed;
  return (
    <div className="poll" onClick={(e) => e.stopPropagation()}>
      <div className="poll-q">📊 {m.poll.question}</div>
      <div className="muted tiny">
        {closed ? 'Poll ended' : m.poll.multi ? 'Pick one or more' : 'Pick one'} · {voters.size} {voters.size === 1 ? 'vote' : 'votes'}
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
      {canEnd && !closed && (
        <button className="link-btn small" onClick={onEnd}>
          End poll
        </button>
      )}
    </div>
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
}) {
  const people = usePeople();
  const [picker, setPicker] = useState(false);
  const [removing, setRemoving] = useState(false);
  const mine = m.byUid === actor.uid;
  const reactions = Object.entries(m.reactions || {}).filter(([, who]) => who && Object.keys(who).length);
  const myRoles = ctx.myRoles || [];
  // Highlight messages that ping me (not my own).
  const mentionsMe = !mine && ((m.mentions || []).includes(actor.name) || m.everyone || (m.roles || []).some((r) => myRoles.includes(r)));
  const color = people?.infoOf(m.by)?.color;
  const react = (emoji) => {
    const on = !(m.reactions?.[emoji] && m.reactions[emoji][actor.uid]);
    api.react(conv, m.id, emoji, on);
    setPicker(false);
  };
  const yt = youtubeId(m.preview?.url) || youtubeId(/https?:\/\/\S+/.exec(m.text || '')?.[0]);
  const jumbo = !m.poll && isJumbo(m.text, ctx.emoji);

  return (
    <div
      className={`msg${first ? ' first' : ''}${selected ? ' selected' : ''}${mentionsMe ? ' mentions-me' : ''}${m.pinned ? ' pinned' : ''}`}
      id={`msg-${m.id}`}
      onClick={(e) => {
        if (e.target.closest('a,button,input,.emoji-picker,.spoiler:not(.shown)')) return;
        onSelect(selected ? null : m.id);
      }}
    >
      <div className="msg-gutter">
        {first ? (
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
            <button className="name-btn" style={color ? { color } : undefined} onClick={(e) => onPerson(m.by, e)}>
              {m.by}
            </button>{' '}
            <span className="muted tiny">{timeOf(m.at)}</span>
            {m.pinned && (
              <span className="muted tiny" title={`Pinned by ${m.pinnedBy}`}>
                {' '}
                📌
              </span>
            )}
          </div>
        )}
        {m.replyTo && (
          <button className="msg-reply-quote" onClick={() => onJump(m.replyTo.id)}>
            ↩ <b>{m.replyTo.by?.split(' ')[0]}</b> {m.replyTo.text || 'a photo'}
          </button>
        )}
        {m.deleted ? (
          <div className="msg-text muted">
            <i>Message deleted</i>
          </div>
        ) : (
          <>
            {m.text && !m.poll && (
              <div className={`msg-text${jumbo ? ' jumbo' : ''}`}>
                {renderRich(m.text, ctx)}
                {m.editedAt && <span className="muted tiny edited"> (edited)</span>}
              </div>
            )}
            {m.poll && (
              <Poll
                m={m}
                actor={actor}
                canEnd={mine || isManager}
                onVote={(optionId, on) => api.vote(conv, m, optionId, on)}
                onEnd={() => api.editMessage(conv, m.id, { poll: { ...m.poll, closed: true } })}
              />
            )}
            {m.gif && <img className="msg-gif" src={m.gif.url} alt={m.gif.title || 'GIF'} loading="lazy" />}
            {m.photo && (
              <button className="msg-photo" onClick={() => onPhoto(m)} aria-label="Open photo">
                <img src={m.photo.thumbUrl || m.photo.url} alt="" loading="lazy" />
              </button>
            )}
            {yt ? (
              <YouTube id={yt} />
            ) : (
              m.preview && <LinkPreview p={m.preview} canHide={mine} onHide={() => api.hidePreview(conv, m.id)} />
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
        {reactions.length > 0 && (
          <div className="msg-reactions">
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
      {!m.deleted && (
        <div className="msg-actions" onClick={(e) => e.stopPropagation()}>
          {QUICK_REACTIONS.slice(0, 3).map((e) => (
            <button key={e} onClick={() => react(e)} aria-label={`React ${e}`}>
              {e}
            </button>
          ))}
          <button onClick={() => setPicker((p) => !p)} aria-label="More reactions" title="More reactions">
            ☺+
          </button>
          {canPost && (
            <button onClick={() => onReply(m)} title="Reply">
              ↩
            </button>
          )}
          <button onClick={() => api.pin(conv, m.id, !m.pinned)} title={m.pinned ? 'Unpin' : 'Pin to this channel'}>
            {m.pinned ? '📍' : '📌'}
          </button>
          <button onClick={() => onMakeTask(m)} title="Make a task from this message">
            ＋Task
          </button>
          {mine && !m.poll && (
            <button onClick={() => onEdit(m)} title="Edit">
              ✏️
            </button>
          )}
          {isManager && reactions.length > 0 && (
            <button onClick={() => setRemoving(true)} title="Remove reactions">
              🚫☺
            </button>
          )}
          {(mine || isManager) && (
            <button className="danger-text" onClick={() => confirm('Delete this message?') && api.deleteMessage(conv, m)} title="Delete">
              🗑
            </button>
          )}
          {picker && (
            <EmojiPicker
              onPick={react}
              onClose={() => setPicker(false)}
              teamEmoji={teamEmoji}
              canManage={isManager}
              onManage={() => {
                setPicker(false);
                onManageEmoji();
              }}
              className="reaction-picker"
            />
          )}
        </div>
      )}
    </div>
  );
}
