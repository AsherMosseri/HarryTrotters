import { useState } from 'react';
import { Avatar, CloseIcon, Overlay } from './common.jsx';
import { Row, Switch } from './Ads.jsx';
import { COMMANDS, GROUPS } from '../commands.js';
import { ALWAYS_ON, whereFor } from '../../functions/shared/commandRules.js';
import { ICON as ARCADE_ICON, LABEL as ARCADE_LABEL } from '../../functions/shared/arcade.js';
import { useEscape } from '../util.js';

// Asher's 🤖 Commands page: turn slash commands on and off, pick the channels
// each group works in, and see how the casino is doing. Saved to
// settings/team → commands (functions/shared/commandRules.js reads it).

const GAMES = {
  slots: ['🎰', 'Slots'],
  dice: ['🎲', 'Dice'],
  coinflip: ['🪙', 'Coin flip'],
  roulette: ['🎡', 'Roulette'],
  blackjack: ['🃏', 'Blackjack'],
  crash: ['🚀', 'Crash'],
  mines: ['💣', 'Mines'],
  highlow: ['🔼', 'High-low'],
  ...Object.fromEntries(Object.keys(ARCADE_LABEL).map((k) => [k, [ARCADE_ICON[k], ARCADE_LABEL[k]]])),
};
const coins = (n) => `${n.toLocaleString()} 🪙`;
const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString()}`;

// Everyone's casino numbers added up (bank docs: stats and stats.games).
export function houseNumbers(bank) {
  const people = Object.entries(bank || {}).map(([name, b]) => ({
    name,
    net: b.net || 0,
    played: b.stats?.played || 0,
    won: b.stats?.won || 0,
    lost: b.stats?.lost || 0,
    games: b.stats?.games || {},
  }));
  const sum = (k) => people.reduce((t, p) => t + p[k], 0);
  const games = {};
  for (const p of people)
    for (const [g, s] of Object.entries(p.games)) {
      const t = (games[g] ||= { played: 0, won: 0, lost: 0 });
      t.played += s.played || 0;
      t.won += s.won || 0;
      t.lost += s.lost || 0;
    }
  const won = sum('won');
  const lost = sum('lost');
  const ranked = people.filter((p) => p.played).map((p) => ({ name: p.name, result: p.won - p.lost, played: p.played }));
  return {
    played: sum('played'),
    won,
    lost,
    house: lost - won,
    // Everything else banks hold: /daily, /work, /beg, trivia and hangman prizes.
    economy: sum('net') - (won - lost),
    games: Object.entries(games)
      .map(([g, t]) => ({ g, ...t, house: t.lost - t.won }))
      .sort((a, b) => b.played - a.played),
    winners: [...ranked].sort((a, b) => b.result - a.result).slice(0, 5),
    losers: [...ranked].sort((a, b) => a.result - b.result).slice(0, 5),
  };
}

export default function CommandsPage({ cfg = {}, channels, bank, lottery, onSave, onClose }) {
  useEscape(onClose);
  const [tab, setTab] = useState('on');
  const off = cfg.off || [];
  const where = (g) => whereFor(g, cfg);
  // Always save every group's channels, so nothing old is left behind.
  const save = (patch) => {
    const next = { off, where: Object.fromEntries(GROUPS.map(([g]) => [g, where(g)])), ...patch };
    onSave(next);
  };
  const setOn = (names, on) => save({ off: on ? off.filter((n) => !names.includes(n)) : [...new Set([...off, ...names])] });
  const setWhere = (g, list) => save({ where: { ...Object.fromEntries(GROUPS.map(([k]) => [k, where(k)])), [g]: list } });
  const chans = channels.filter((c) => c.id !== 'announcements');
  const h = houseNumbers(bank);
  const offCount = off.filter((n) => !ALWAYS_ON.includes(n)).length;

  return (
    <Overlay>
      <div className="panel-backdrop center" onClick={onClose}>
        <div className="dialog ads-settings cmd-admin" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Commands">
          <div className="panel-head">
            <h2>Commands</h2>
            <span className="spacer" />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="ads-pause">
            <div className="grow">
              <b>{offCount ? `${COMMANDS.length - offCount} of ${COMMANDS.length} commands on` : `All ${COMMANDS.length} commands on`}</b>
              <span className="muted small">Changes apply right away, for everyone.</span>
            </div>
          </div>
          <div className="segmented ads-tabs" role="tablist">
            {[
              ['on', 'On / off'],
              ['where', 'Where'],
              ['house', 'Casino'],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`plain-seg${tab === id ? ' on' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ads-body">
            {tab === 'on' &&
              GROUPS.map(([g, label]) => {
                const list = COMMANDS.filter((c) => c.group === g);
                const names = list.map((c) => c.name).filter((n) => !ALWAYS_ON.includes(n));
                const allOn = names.every((n) => !off.includes(n));
                return (
                  <section key={g} className="cmd-admin-group">
                    <div className="cmd-admin-head">
                      <h4>{label}</h4>
                      <span className="spacer" />
                      <button className="link-btn small" onClick={() => setOn(names, !allOn)}>
                        {allOn ? 'Turn all off' : 'Turn all on'}
                      </button>
                    </div>
                    {list.map((c) => (
                      <div key={c.name} className={`cmd-admin-row${off.includes(c.name) ? ' off' : ''}`}>
                        <code>/{c.name}</code>
                        <span className="muted small grow">{c.desc}</span>
                        {ALWAYS_ON.includes(c.name) ? (
                          <span className="muted tiny">always on</span>
                        ) : (
                          <Switch checked={!off.includes(c.name)} onChange={(v) => setOn([c.name], v)} label={`/${c.name} on`} />
                        )}
                      </div>
                    ))}
                  </section>
                );
              })}

            {tab === 'where' && (
              <>
                <p className="muted small">Pick the channels each kind of command works in. Anywhere includes DMs.</p>
                {GROUPS.map(([g, label]) => {
                  const w = where(g);
                  return (
                    <section key={g} className="cmd-admin-group">
                      <Row title={label} hint={w ? (w.length ? w.map((c) => `#${c}`).join(', ') : 'Nowhere') : 'Anywhere'}>
                        <Switch checked={!w} onChange={(v) => setWhere(g, v ? null : ['arcade'])} label={`${label} anywhere`} />
                      </Row>
                      {w && (
                        <div className="ads-people">
                          {chans.map((c) => {
                            const on = w.includes(c.id);
                            return (
                              <button
                                key={c.id}
                                className={`chip${on ? ' on' : ''}`}
                                aria-pressed={on}
                                onClick={() => setWhere(g, on ? w.filter((x) => x !== c.id) : [...w, c.id])}
                              >
                                {on ? '✓ ' : ''}#{c.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </>
            )}

            {tab === 'house' && (
              <>
                <div className="cmd-house">
                  <div>
                    <span className="muted small">House profit</span>
                    <b className={`cmd-big ${h.house >= 0 ? 'pos' : 'neg'}`}>{signed(h.house)} 🪙</b>
                  </div>
                  <div>
                    <span className="muted small">Games played</span>
                    <b className="cmd-big">{h.played.toLocaleString()}</b>
                  </div>
                  <div>
                    <span className="muted small">Players won</span>
                    <b className="cmd-big">{coins(h.won)}</b>
                  </div>
                  <div>
                    <span className="muted small">Players lost</span>
                    <b className="cmd-big">{coins(h.lost)}</b>
                  </div>
                </div>
                <div className="muted small">
                  /daily, /work, /beg, and game prizes have handed out {coins(Math.max(0, h.economy))} so far.
                  {lottery?.pot ? ` The lottery pot is ${coins(lottery.pot)}.` : ''}
                </div>
                <h4>By game</h4>
                {h.games.length ? (
                  <table className="cmd-house-table">
                    <thead>
                      <tr>
                        <th>Game</th>
                        <th>Played</th>
                        <th>Paid out</th>
                        <th>Taken in</th>
                        <th>House</th>
                      </tr>
                    </thead>
                    <tbody>
                      {h.games.map((r) => (
                        <tr key={r.g}>
                          <td>
                            {GAMES[r.g]?.[0]} {GAMES[r.g]?.[1] || r.g}
                          </td>
                          <td>{r.played}</td>
                          <td>{r.won.toLocaleString()}</td>
                          <td>{r.lost.toLocaleString()}</td>
                          <td className={r.house >= 0 ? 'pos' : 'neg'}>{signed(r.house)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted small">No games yet (per-game numbers start with version 2.62).</p>
                )}
                <p className="muted tiny">
                  Player-vs-player bets move coins between people, so they even out; games against Trotbot count for the house.
                </p>
                <div className="cmd-house-lists">
                  {[
                    ['Biggest winners', h.winners.filter((p) => p.result > 0)],
                    ['Biggest losers', h.losers.filter((p) => p.result < 0)],
                  ].map(([title, list]) => (
                    <div key={title}>
                      <h4>{title}</h4>
                      {list.length ? (
                        <ol className="cmd-leaders">
                          {list.map((p) => (
                            <li key={p.name}>
                              <Avatar name={p.name} size={22} />
                              <span className="grow">{p.name}</span>
                              <b className={p.result >= 0 ? 'pos' : 'neg'}>{signed(p.result)}</b>
                              <span className="muted tiny">{p.played} games</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="muted small">Nobody yet.</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  );
}
