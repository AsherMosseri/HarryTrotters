// Each ad's own booking / order / submission / subscription: what you pick
// (fields), what it says, and the interactive thing that happens when it
// arrives, when it's time, or when they write back (scene). The flows live in
// src/flows/*.js, keyed by ad id; ads without one (Asher's own, teammates'
// spots) get a plain flow made from their action.
//
// A flow:
//   title     the form's heading ("Book 8 hours of sleep")
//   item      what it's called in the tracker (defaults to action.item)
//   fields    what you pick, in order (see FIELD_TYPES)
//   cta       the big button ("Lock in bedtime")
//   confirm   the line after you place it. {key} is that field's answer,
//             plus {qty} {item} {brand} {when} {first}
//   track     optional lines for the timeline (each a list; one is picked at
//             random, templates work): packed shipped out places remind
//             review replies confirmed, twists / late: [{ icon, title, body }]
//   scene     what you do when it arrives / when it's time (see SCENES)
//   chat      submissions: after they reply, a little conversation
//             [{ say, options: [{ label, reply }] }] (optional)
//
// Fields (every one has key and label):
//   choice  options: ['A', 'B'] or [{ label, note }] (note shows when picked);
//           big: true for emoji-sized buttons
//   multi   like choice, pick several (max)
//   slider  min max step unit, marks: { 0: 'Whisper', 10: 'Jet engine' }
//   toggle  on (text when on), off (text when off)
//   text    placeholder, max (≤ 120); required: true to need it
//   qty     max (≤ 99), unit ('bags')
//   when    the day and time picker (bookings need exactly one)
//
// Scenes (all take prompt and win; win can use the same {templates}):
//   unbox    inside: [lines] (one picked), taps (1–6)
//   tap      emoji, button, goal (5–40), stages: [lines as it fills]
//   hold     emoji, button, ms (1000–6000), stages, early (if you let go)
//   catch    emoji, goal (3–12), decoys: [emoji], speed: 'slow' | 'fast'
//   scratch  prizes: [lines] (one revealed)
//   dial     emoji, left, right (labels), hints: [cold, warm, hot]
//   cards    emoji, results: [lines] (3–5 cards; you flip one)
//   chat     lines: [{ say, options: [{ label, reply }] }] (1–4 lines)

import BASE from './flows/base.js';
import MORE from './flows/more.js';
import SEASONS from './flows/seasons.js';
import TARGETED from './flows/targeted.js';
import MORE2 from './flows/more2.js';
import { KINDS } from './flowFormat.js';

export * from './flowFormat.js';
export const FLOWS = { ...BASE, ...MORE, ...MORE2, ...SEASONS, ...TARGETED };

// Ads without a flow of their own.
function plainFlow(ad, kind) {
  const act = ad.action || {};
  const item = act.item || ad.brand;
  const fields = {
    order: [{ key: 'qty', type: 'qty', label: 'How many' }],
    book: [{ key: 'when', type: 'when', label: 'When' }],
    submit: [{ key: 'text', type: 'text', label: act.ask || 'Tell us more', placeholder: act.ask || 'Tell us more', required: true }],
    subscribe: [{ key: 'plan', type: 'choice', label: 'Plan', options: ['Monthly', 'Yearly', 'Forever'] }],
  }[kind];
  return {
    title: {
      order: `Order ${item}`,
      book: `Book with ${ad.brand}`,
      submit: act.ask || 'Tell us more',
      subscribe: `Subscribe to ${ad.brand}`,
    }[kind],
    item,
    fields,
    cta: { order: 'Place order', book: 'Confirm booking', submit: 'Submit', subscribe: 'Subscribe' }[kind],
    confirm: act.done || '',
    scene: kind === 'order' || kind === 'subscribe' ? { type: 'unbox' } : null,
  };
}

// The flow for an ad (its own, or a plain one), with its kind.
export function flowFor(ad) {
  const kind = KINDS.includes(ad.action?.kind) ? ad.action.kind : 'order';
  const own = FLOWS[ad.id];
  const flow = own ? { item: ad.action?.item || ad.brand, ...own } : plainFlow(ad, kind);
  return { ...flow, kind, custom: !!own };
}
