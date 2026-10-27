// The format of an ad's flow (documented in src/adFlows.js): answers,
// templates, and the checker. No imports, so a flows file can be checked alone.

export const FIELD_TYPES = ['choice', 'multi', 'slider', 'toggle', 'text', 'qty', 'when'];
export const SCENE_TYPES = ['unbox', 'tap', 'hold', 'catch', 'scratch', 'dial', 'cards', 'chat'];

export const KINDS = ['order', 'book', 'submit', 'subscribe'];
const opt = (o) => (typeof o === 'string' ? { label: o } : o);
// 4.300000001 → 4.3 for sliders with steps like 0.1.
const roundTo = (v, step = 1) => {
  const places = String(step).split('.')[1]?.length || 0;
  return Number(Number(v).toFixed(places));
};
export const optionsOf = (field) => (field.options || []).map(opt);

// Starting answers: the first option, the middle of a slider, 1, off, empty.
export function defaults(flow) {
  const out = {};
  for (const f of flow.fields || []) {
    if (f.type === 'choice') out[f.key] = optionsOf(f)[0]?.label ?? '';
    else if (f.type === 'multi') out[f.key] = [];
    else if (f.type === 'slider')
      out[f.key] = f.start ?? roundTo(Math.round(((f.min ?? 0) + (f.max ?? 10)) / 2 / (f.step || 1)) * (f.step || 1), f.step);
    else if (f.type === 'toggle') out[f.key] = false;
    else if (f.type === 'qty') out[f.key] = 1;
    else if (f.type === 'text') out[f.key] = '';
  }
  return out;
}

// How an answer reads in a sentence or a chip.
export function answerText(field, value) {
  if (field.type === 'toggle') return value ? field.on || 'Yes' : field.off || 'No';
  if (field.type === 'multi') return value?.length ? value.join(', ') : 'Nothing';
  if (field.type === 'slider') {
    const v = roundTo(value, field.step);
    const mark = field.marks?.[v];
    return mark ? `${v}${field.unit ? ` ${field.unit}` : ''} (${mark})` : `${v}${field.unit ? ` ${field.unit}` : ''}`;
  }
  if (field.type === 'qty') return `${value}${field.unit ? ` ${field.unit}` : ''}`;
  return String(value ?? '');
}

// Names and the like that keep their capital letter mid-sentence.
const KEEP_CAPS = new Set([
  'I',
  'I’m',
  'Kevin',
  'Mom',
  'Dad',
  'Ohio',
  'Asher',
  'Cooper',
  'Monday',
  'Friday',
  'Saturday',
  'Sunday',
  'Halloween',
  'OK',
  'Java',
  'Kotlin',
  'Python',
  'Blocks',
  'Inspire',
  'Think',
  'Connect',
  'Onshape',
]);
const BUILTIN = new Set(['brand', 'item', 'first', 'when', 'qty']);

// Fills {key} placeholders. An answer like "Brick" reads "the brick pillow"
// mid-sentence but stays "Brick" at the start of one; names keep their caps
// ("the Inspire Award"), and "the {x}" with an answer that brings its own
// "the"/"your"/"a" drops the extra word.
const DET = /^(the|your|my|our|a|an)\s/i;
export function fill(text, vars) {
  let out = '';
  let last = 0;
  const src = String(text || '');
  for (const m of src.matchAll(/\{(\w+)\}/g)) {
    const k = m[1];
    out += src.slice(last, m.index);
    last = m.index + m[0].length;
    if (vars[k] == null || vars[k] === '') {
      out += m[0];
      continue;
    }
    let v = String(vars[k]);
    if (BUILTIN.has(k)) {
      out += v;
      continue;
    }
    // "the" + "Your backpack" → "your backpack"
    const det = out.match(/(^|\s)(the|your|my|our|a|an)\s$/i);
    if (det && DET.test(v)) {
      const capital = /^[A-Z]/.test(det[2]);
      out = out.slice(0, out.length - det[2].length - 1);
      v = capital ? v[0].toUpperCase() + v.slice(1) : v;
      if (capital) {
        out += v;
        continue;
      }
    }
    const start = !out.trim() || /[.!?:]["”’]?\s*$/.test(out) || /(^|[.!?]\s+)[“"]$/.test(out);
    const [word, next] = v.split(/\s+/);
    const after = src.slice(last);
    if (start) out += v[0].toUpperCase() + v.slice(1);
    else if (
      (/^[A-Z][a-z’']/.test(word) || word === 'A') &&
      !KEEP_CAPS.has(word.replace(/[^\w’]/g, '')) &&
      !(next && /^[A-Z]/.test(next)) &&
      !/^\s[A-Z]/.test(after)
    )
      out += v[0].toLowerCase() + v.slice(1);
    else out += v;
  }
  return out + src.slice(last);
}

// Everything a template can use, from a flow's answers.
export function templateVars(flow, answers, extra = {}) {
  const vars = { ...extra };
  for (const f of flow.fields || []) if (f.type !== 'when') vars[f.key] = answerText(f, answers[f.key]);
  return vars;
}

// The answers as short chips for the tracker ("Pillow: Brick").
export function summaryOf(flow, answers) {
  return (flow.fields || [])
    .filter((f) => f.type !== 'when' && f.type !== 'qty' && f.type !== 'text')
    .map((f) => `${f.label.replace(/[…?:.]+$/, '')}: ${answerText(f, answers[f.key])}`)
    .slice(0, 6);
}

// Checks a flow (tests use this for every ad). Returns a list of problems.
export function checkFlow(id, flow, kind) {
  const bad = [];
  const need = (ok, msg) => !ok && bad.push(`${id}: ${msg}`);
  need(typeof flow.title === 'string' && flow.title.length > 0 && flow.title.length <= 60, 'title (1–60 chars)');
  need(typeof flow.cta === 'string' && flow.cta.length > 0 && flow.cta.length <= 30, 'cta (1–30 chars)');
  need(!flow.item || (typeof flow.item === 'string' && flow.item.length <= 50), 'item ≤ 50 chars');
  need(Array.isArray(flow.fields) && flow.fields.length >= 1 && flow.fields.length <= 5, '1–5 fields');
  const keys = new Set();
  for (const f of flow.fields || []) {
    need(FIELD_TYPES.includes(f.type), `field type ${f.type}`);
    need(typeof f.key === 'string' && /^\w+$/.test(f.key) && !keys.has(f.key), `field key ${f.key}`);
    keys.add(f.key);
    need(typeof f.label === 'string' && f.label.length > 0 && f.label.length <= 40, `field ${f.key} label (1–40)`);
    if (f.type === 'choice' || f.type === 'multi')
      need(
        optionsOf(f).length >= 2 && optionsOf(f).length <= 8 && optionsOf(f).every((o) => o.label && o.label.length <= 32),
        `field ${f.key} options (2–8, ≤ 32 chars)`,
      );
    if (f.type === 'slider') need(typeof f.min === 'number' && typeof f.max === 'number' && f.max > f.min, `field ${f.key} min/max`);
    if (f.type === 'text') need(!f.max || f.max <= 120, `field ${f.key} max ≤ 120`);
    if (f.type === 'qty') need(!f.max || f.max <= 99, `field ${f.key} max ≤ 99`);
  }
  const whens = (flow.fields || []).filter((f) => f.type === 'when').length;
  need(kind === 'book' ? whens === 1 : whens === 0, kind === 'book' ? 'a booking needs one when field' : 'only bookings have a when field');
  need((flow.fields || []).filter((f) => f.type === 'qty').length <= 1, 'at most one qty field');
  need(kind !== 'submit' || (flow.fields || []).some((f) => f.type === 'text' && f.required), 'a submission needs a required text field');
  const s = flow.scene;
  if (kind === 'submit') need(!s || s.type === 'chat', 'submissions use chat (or no scene)');
  else need(s && SCENE_TYPES.includes(s.type), `scene type ${s?.type}`);
  if (s) {
    need(!s.win || typeof s.win === 'string', 'scene win is text');
    if (s.type === 'unbox') need(!s.inside || (Array.isArray(s.inside) && s.inside.length >= 1), 'unbox inside list');
    if (s.type === 'tap') need(!s.goal || (s.goal >= 5 && s.goal <= 40), 'tap goal 5–40');
    if (s.type === 'hold') need(!s.ms || (s.ms >= 1000 && s.ms <= 6000), 'hold ms 1000–6000');
    if (s.type === 'catch') need(!s.goal || (s.goal >= 3 && s.goal <= 12), 'catch goal 3–12');
    if (s.type === 'scratch') need(Array.isArray(s.prizes) && s.prizes.length >= 1, 'scratch prizes');
    if (s.type === 'cards') need(Array.isArray(s.results) && s.results.length >= 3 && s.results.length <= 5, 'cards results 3–5');
    if (s.type === 'chat')
      need(
        Array.isArray(s.lines) &&
          s.lines.length >= 1 &&
          s.lines.length <= 4 &&
          s.lines.every((l) => l.say && l.options?.length >= 2 && l.options.length <= 4 && l.options.every((o) => o.label && o.reply)),
        'chat lines (1–4, 2–4 options each with label and reply)',
      );
  }
  if (flow.chat)
    need(
      Array.isArray(flow.chat) && flow.chat.every((l) => l.say && l.options?.length >= 2 && l.options.every((o) => o.label && o.reply)),
      'chat after the reply',
    );
  const t = flow.track || {};
  for (const [k, v] of Object.entries(t)) {
    need(
      ['packed', 'shipped', 'out', 'places', 'remind', 'review', 'replies', 'confirmed', 'twists', 'late'].includes(k),
      `track.${k} unknown`,
    );
    need(Array.isArray(v) && v.length >= 1, `track.${k} is a list`);
    if (k === 'twists' || k === 'late')
      need(
        v.every((x) => x.title && x.body),
        `track.${k} items need title and body`,
      );
  }
  return bad;
}
