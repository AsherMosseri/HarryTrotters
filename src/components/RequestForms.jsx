import { useContext, useState } from 'react';
import { Icon } from './shell/icons.jsx';
import { Avatar, CloseIcon, Overlay } from './common.jsx';
import { RequestBox } from './Requests.jsx';
import { RequestChannelDialog } from './ChannelRequests.jsx';
import { PetRequestContext, RequestPetDialog } from './PetRequest.jsx';
import { StyleRequest } from './People.jsx';
import { ASK_KEYWORDS, IDEA_MAX } from '../requestCommand.js';
import { GIFT_MAX } from '../../functions/shared/coins.js';
import { parseAmount } from '../../functions/shared/amount.js';
import { coinsText } from '../../functions/shared/coinText.js';
import { EXPIRES, REASON_MAX } from '../../functions/shared/coinRequests.js';
import { coinStyled } from '../coinFormat.js';
// The Ask button's amount follows Appearance, Coin numbers.
const coinText = (n) => `${coinStyled(n)} 🪙`;
import { REQUESTS_TO } from '../config.js';
import { firstName, useEscape } from '../util.js';

// /request's forms (src/requestCommand.js decides which one opens). Each one
// is the app's existing form for that kind of request, filled in with what
// was typed: Feature idea (the 💡 idea box), Channel (Request a channel),
// Pet (Request a pet), Style (Edit profile's "Want something new?"). Coins
// is new: who, how much and why, sent to the coinRequest function.
// Workspace renders <RequestForms> when ask = { form, text, conv } is set.

const PICKS = [
  ['idea', 'bulb', 'Feature idea', `Something the app should do. It goes to ${firstName(REQUESTS_TO)}.`, 'requests'],
  ['channel', 'hash', 'Channel', 'A new chat channel, for everyone or private.', 'channelRequests'],
  ['pet', 'paw', 'Pet', 'An animal you don’t see in the pet shop.', 'requests'],
  ['style', 'sparkle', 'Style', 'A font, name effect, decoration or border.', 'requests'],
  ['coins', 'coin', 'Coins', 'Ask a teammate for Jackson coins.', 'coins'],
];

// A small window around one form (the picker, the idea box, style, coins).
function AskDialog({ title, className = '', onClose, children }) {
  useEscape(onClose);
  return (
    <Overlay>
      <div className="panel-backdrop center ask-backdrop" onClick={onClose}>
        <div className={`dialog ask req-ask ${className}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
          <div className="req-ask-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {children}
        </div>
      </div>
    </Overlay>
  );
}

function Picker({ isOn, onPick, onClose }) {
  const shown = PICKS.filter(([, , , , feature]) => isOn(feature));
  return (
    <AskDialog title="Request…" className="req-picker" onClose={onClose}>
      {shown.length ? (
        <div className="req-picks" role="list">
          {shown.map(([form, icon, label, desc]) => (
            <button key={form} className="req-pick" role="listitem" onClick={() => onPick(form)}>
              <span className="req-pick-icon" aria-hidden="true">
                <Icon name={icon} size={20} />
              </span>
              <span className="req-pick-text">
                <b>{label}</b>
                <small>{desc}</small>
              </span>
              <Icon name="chevron" size={16} className="req-pick-go" />
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">Requests are switched off right now.</p>
      )}
      <p className="muted tiny req-tip">
        Or type it: <code>/request dark mode</code>, <code>/request channel build-log</code>, <code>/request pet axolotl</code>,{' '}
        <code>/request @Cooper 25 for pizza</code>
      </p>
    </AskDialog>
  );
}

// The idea box from Feature requests. A sent idea also gets a card in the chat
// it was asked from, like /request <idea> makes.
function IdeaForm({ ask, api, onClose }) {
  const send = async (text) => {
    const id = await api.addIdea(text.slice(0, IDEA_MAX));
    if (!id) return false;
    if (ask.conv)
      await api.sendMessage(ask.conv, {
        text: `/request ${text}`.slice(0, 4000),
        cmd: { name: 'request', kind: 'idea', id: typeof id === 'string' ? id : '', text: text.slice(0, 300) },
        mentions: [],
        taskIds: [],
        replyTo: null,
        roles: [],
        everyone: false,
      });
    return true;
  };
  return (
    <AskDialog title="Request a feature" className="req-idea" onClose={onClose}>
      <p className="muted small">Everyone can 👍 it in Feature requests, and you get a notification when it’s planned or added.</p>
      <RequestBox onSend={send} autoFocus initial={ask.text || ''} />
    </AskDialog>
  );
}

// Which style kind the words are about ("a lightning name effect" -> Name effect).
export function styleKindOf(text) {
  const t = String(text || '').toLowerCase();
  if (/\bfont|typeface|letters\b/.test(t)) return 'font';
  if (/name\s*effect|glow|shimmer|neon|rainbow/.test(t)) return 'name-effect';
  if (/nameplate|plate\b/.test(t)) return 'nameplate';
  if (/decoration|ring|avatar|frame/.test(t)) return 'decoration';
  if (/border/.test(t)) return 'border';
  if (/effect|background|banner|profile/.test(t)) return 'effect';
  return t ? 'style' : 'font';
}

function StyleForm({ ask, api, onClose }) {
  const [kind, setKind] = useState(() => styleKindOf(ask.text));
  return (
    <AskDialog title="Request a style" className="req-style" onClose={onClose}>
      <StyleRequest id="style-request-ask" kind={kind} setKind={setKind} onSend={api.addRequest} initialText={(ask.text || '').slice(0, 300)} autoFocus />
    </AskDialog>
  );
}

// Coins: who, how much, why. The server checks everything again.
function CoinsForm({ ask, api, roster, actor, onClose }) {
  const people = roster.filter((n) => n !== actor.name);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Read like the chat command (functions/shared/amount.js): 25, 2k, 5qa, 2.5e40, up to a googol.
  const n = parseAmount(amount, { positive: true }) ?? NaN;
  const whole = n >= 1 && n <= GIFT_MAX;
  const ready = !!to && whole && !busy;
  const send = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    const r = await api.coinRequest({ action: 'create', conv: ask.conv, to, amount: n, reason: reason.trim() });
    setBusy(false);
    if (r?.note) return setError(r.note);
    onClose();
  };
  return (
    <AskDialog title="Ask for coins" className="req-coins" onClose={onClose}>
      <form className="req-coins-form" onSubmit={send}>
        <label className="ask-field">
          <span className="small muted">Who?</span>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)} autoFocus>
            <option value="">Pick a teammate</option>
            {people.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        {to && (
          <div className="req-coins-who">
            <Avatar name={to} size={28} /> {firstName(to)} sees Pay and Decline on the card.
          </div>
        )}
        <label className="ask-field">
          <span className="small muted">How many coins?</span>
          <input
            className="input mono"
            inputMode="numeric"
            value={amount}
            maxLength={60}
            placeholder="25"
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,+a-z]/gi, ''))}
          />
        </label>
        <label className="ask-field">
          <span className="small muted">What for? (optional)</span>
          <input className="input" value={reason} maxLength={REASON_MAX} placeholder="for pizza" onChange={(e) => setReason(e.target.value)} />
        </label>
        <p className="muted tiny">
          Any amount. It stays open for {EXPIRES / 3600000} hours; you can cancel it.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error.title}
            {error.body ? ` ${error.body}` : ''}
          </p>
        )}
        <div className="ask-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!ready}>
            {busy ? 'Asking…' : whole ? `Ask for ${coinText(n)}` : 'Ask'}
          </button>
        </div>
      </form>
    </AskDialog>
  );
}

// ask: { form: 'picker' | 'idea' | 'channel' | 'pet' | 'style' | 'coins', text, conv }.
// setAsk switches forms (the picker) and closes (null).
export function RequestForms({ ask, setAsk, actor, roster, api, channels, channelRequests, isOn }) {
  const petCtx = useContext(PetRequestContext);
  const close = () => setAsk(null);
  const form = ask.form;
  if (form === 'picker') return <Picker isOn={isOn} onClose={close} onPick={(f) => setAsk({ ...ask, form: f, text: '' })} />;
  if (form === 'idea' && isOn('requests')) return <IdeaForm ask={ask} api={api} onClose={close} />;
  if (form === 'style' && isOn('requests')) return <StyleForm ask={ask} api={api} onClose={close} />;
  if (form === 'coins' && isOn('coins')) return <CoinsForm ask={ask} api={api} roster={roster} actor={actor} onClose={close} />;
  if (form === 'pet' && petCtx?.on) return <RequestPetDialog ctx={petCtx} onClose={close} initial={ask.text || ''} />;
  if (form === 'channel' && isOn('channelRequests'))
    return (
      <RequestChannelDialog
        roster={roster}
        actor={actor}
        channels={channels}
        requests={channelRequests}
        onSend={api.requestChannel}
        onCancel={api.cancelChannelRequest}
        onClose={close}
        initialName={ask.text || ''}
      />
    );
  return null;
}
