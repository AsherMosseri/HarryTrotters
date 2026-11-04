import { useEffect, useState } from 'react';
import { isLive } from '../../../functions/shared/arcade.js';

// The game view: a live two-player game (Battleship, tic-tac-toe, connect
// four) opened big over the chat, for the players and for anyone watching.
// A card asks for it with openGameView({ conv, m }); ChatView shows it.
export const VIEW_GAMES = ['battleship', 'tictactoe', 'connect4'];
const listeners = new Set();
export const openGameView = (o) => listeners.forEach((fn) => fn(o));
export function onOpenGameView(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The newest copy of each game card the app has seen. The chat has the card
// from the database; a move's answer (or a "sync" after the app was in the
// background) brings the card as the server wrote it, which can be ahead of
// the chat's copy for a moment, or for longer when the chat's connection is
// stale. Whichever is newer shows: a later status wins, then a higher n (the
// server counts every change to a Battleship game).
const noted = new Map();
const subs = new Set();
const RANK = { open: 0, placing: 1, playing: 2 };
const rankOf = (c) => [isLive(c.status) ? RANK[c.status] ?? 0 : 3, c.game?.n ?? -1];
function newer(a, b) {
  const x = rankOf(a);
  const y = rankOf(b);
  return x[0] > y[0] || (x[0] === y[0] && x[1] > y[1]);
}
export function noteCard(id, card) {
  if (!id || !card?.game) return;
  const old = noted.get(id);
  if (old && !newer(card, old)) return;
  noted.set(id, card);
  subs.forEach((fn) => fn());
}
// cmd from the message → the newest copy of it.
export function useFreshCmd(id, cmd) {
  const [, redraw] = useState(0);
  useEffect(() => {
    const fn = () => redraw((n) => n + 1);
    subs.add(fn);
    return () => subs.delete(fn);
  }, []);
  const local = noted.get(id);
  return local && newer(local, cmd) ? { ...cmd, game: local.game, status: local.status } : cmd;
}
