// 3.2: which past cards move into #arcade, and which wait (functions/moveArcade.js;
// demo mode runs the same rules). No Firebase in here.
import { CASINO, ECONOMY } from './casino.js';
import { MULTI, isLive } from './arcade.js';

// Card kinds that move: every casino and arcade game, the economy commands,
// the app's coin cards, and coin requests (not ideas).
export const MOVE_KINDS = [...new Set([...CASINO, ...ECONOMY, ...MULTI, 'challenge', 'give', 'balance', 'leaderboard', 'request'])];

// Why a card stays put for now ('' if it moves). secretExists: a game still
// going; lotteryOpenId: the open lottery card.
export function skipReason(m, { secretExists = false, lotteryOpenId = '' } = {}, id = '') {
  const c = m.cmd || {};
  if (c.name === 'request' && c.kind === 'idea') return 'not coins';
  if (!MOVE_KINDS.includes(c.name)) return 'not coins';
  if (m.pinned) return 'pinned';
  if (c.name === 'challenge' && c.status === 'open') return 'challenge still open';
  if (c.name === 'request' && (c.status === 'open' || Object.values(c.rows || {}).some((r) => r?.status === 'open'))) return 'request still open';
  if (id && id === lotteryOpenId) return 'lottery still open';
  if (secretExists) return 'game still going';
  if (MULTI.includes(c.name) && c.status && isLive(c.status)) return 'game still going';
  if (CASINO.includes(c.name) && c.status === 'playing') return 'game still going';
  return '';
}

