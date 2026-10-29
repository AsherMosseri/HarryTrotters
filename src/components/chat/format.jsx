// Chat text formatting, like Discord:
//   ***bold italic***  **bold**  *italic*  __underline__  ~~strike~~  `code`  ||spoiler||
//   ```code block```   > quote   # big   ## medium   ### small   -# subtext
//   - list   1. list   [text](link)
// plus links, @mentions (people, @everyone, @Subteam), and :team_emoji:.
// Everything is rendered as React elements, never as raw HTML.
import { useState } from 'react';

const URL_RE = /https?:\/\/[^\s<>()|]+[^\s<>()|.,!?:;'"]/;

function Spoiler({ children }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      className={`spoiler${shown ? ' shown' : ''}`}
      onClick={(e) => {
        if (shown) return;
        e.stopPropagation();
        setShown(true);
      }}
      title={shown ? undefined : 'Spoiler: tap to show'}
    >
      {children}
    </span>
  );
}

// Inline patterns, in priority order when two start at the same place.
function inlineRules(ctx) {
  // Formatting switched off (Controls): only links, @mentions, and team emoji.
  const rules = ctx.plain
    ? [{ re: URL_RE, render: (m, k) => link(m[0], m[0], k) }]
    : [
        // \_ \* and friends: show the character itself (so ¯\_(ツ)_/¯ survives).
        { re: /\\([\\`*_~|#>-])/, render: (m) => m[1] },
        { re: /`([^`\n]+)`/, render: (m, k) => <code key={k}>{m[1]}</code> },
        { re: /\|\|([\s\S]+?)\|\|/, render: (m, k) => <Spoiler key={k}>{inline(m[1], ctx)}</Spoiler> },
        { re: /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/, render: (m, k) => link(m[2], inline(m[1], ctx), k) },
        { re: URL_RE, render: (m, k) => link(m[0], m[0], k) },
        {
          re: /\*\*\*([\s\S]+?)\*\*\*/,
          render: (m, k) => (
            <strong key={k}>
              <em>{inline(m[1], ctx)}</em>
            </strong>
          ),
        },
        { re: /\*\*([\s\S]+?)\*\*/, render: (m, k) => <strong key={k}>{inline(m[1], ctx)}</strong> },
        { re: /__([\s\S]+?)__/, render: (m, k) => <u key={k}>{inline(m[1], ctx)}</u> },
        { re: /~~([\s\S]+?)~~/, render: (m, k) => <s key={k}>{inline(m[1], ctx)}</s> },
        { re: /\*(?![\s*])([\s\S]*?[^\s*])\*/, render: (m, k) => <em key={k}>{inline(m[1], ctx)}</em> },
        // _italic_ only at word edges (so snake_case stays). No lookbehind: older iPads lack it.
        {
          re: /(^|[^\w])_(?![\s_])([\s\S]*?[^\s_])_(?![\w])/,
          render: (m, k) => [m[1], <em key={k}>{inline(m[2], ctx)}</em>],
        },
      ];
  if (ctx.mentionRe)
    rules.push({
      re: ctx.mentionRe,
      render: (m, k) => {
        const who = m[1];
        const role = ctx.roles?.includes(who);
        const me = who === ctx.me || (who === 'everyone' && ctx.everyoneOk) || (role && ctx.myRoles?.includes(who));
        return (
          <span
            key={k}
            className={`mention${me ? ' me' : ''}${role ? ' role' : ''}`}
            style={role && ctx.roleColor ? { '--role': ctx.roleColor(who) } : undefined}
            onClick={!role && who !== 'everyone' && ctx.onPerson ? (e) => (e.stopPropagation(), ctx.onPerson(who, e)) : undefined}
          >
            @{who}
          </span>
        );
      },
    });
  if (ctx.emoji?.size)
    rules.push({
      re: /:([a-z0-9_]{2,32}):/,
      test: (m) => ctx.emoji.has(m[1]),
      render: (m, k) => <img key={k} className="custom-emoji" src={ctx.emoji.get(m[1])} alt={m[0]} title={m[0]} />,
    });
  return rules;
}

function link(href, children, k) {
  return (
    <a key={k} href={href} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  );
}

export function inline(text, ctx) {
  const rules = ctx._rules || (ctx._rules = inlineRules(ctx));
  const out = [];
  let rest = text;
  let key = 0;
  while (rest) {
    let best = null;
    for (const rule of rules) {
      const re = new RegExp(rule.re.source, rule.re.flags.replace('g', ''));
      let m = re.exec(rest);
      // Skip matches the rule rejects (e.g. :name: that isn't a team emoji).
      let offset = 0;
      while (m && rule.test && !rule.test(m)) {
        offset += m.index + 1;
        m = re.exec(rest.slice(offset));
      }
      if (m) {
        const index = m.index + offset;
        if (!best || index < best.index) best = { m, index, rule };
      }
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.index) out.push(rest.slice(0, best.index));
    out.push(best.rule.render(best.m, `i${key++}`));
    rest = rest.slice(best.index + best.m[0].length);
  }
  return out;
}

// Splits text into blocks: code fences, quotes, headings, subtext, lists, lines.
export function parseBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^```(\w*)\s*$/.exec(line) || /^```(\w*)\s*(.+?)```\s*$/.exec(line);
    if (fence && fence[2] !== undefined) {
      blocks.push({ type: 'code', text: fence[2] });
      continue;
    }
    if (/^```/.test(line)) {
      const code = [];
      const first = line.slice(3);
      // ```text on the opening line counts as code unless it's a language name.
      if (first && !/^\w+$/.test(first)) code.push(first);
      let j = i + 1;
      while (j < lines.length && !/```\s*$/.test(lines[j])) code.push(lines[j++]);
      if (j < lines.length) {
        const last = lines[j].replace(/```\s*$/, '');
        if (last) code.push(last);
        blocks.push({ type: 'code', text: code.join('\n') });
        i = j;
        continue;
      }
      // No closing fence: show it as plain text.
    }
    const h = /^(#{1,3}) (.+)$/.exec(line);
    if (h) {
      blocks.push({ type: `h${h[1].length}`, text: h[2] });
      continue;
    }
    const sub = /^-# (.+)$/.exec(line);
    if (sub) {
      blocks.push({ type: 'sub', text: sub[1] });
      continue;
    }
    const q = /^> ?(.*)$/.exec(line);
    if (q && line.startsWith('>')) {
      const prev = blocks[blocks.length - 1];
      if (prev?.type === 'quote') prev.lines.push(q[1]);
      else blocks.push({ type: 'quote', lines: [q[1]] });
      continue;
    }
    const li = /^\s*[-*] (.+)$/.exec(line);
    const oli = /^\s*(\d{1,3})\. (.+)$/.exec(line);
    if (li || oli) {
      const type = li ? 'ul' : 'ol';
      const prev = blocks[blocks.length - 1];
      if (prev?.type === type) prev.items.push(li ? li[1] : oli[2]);
      else blocks.push({ type, items: [li ? li[1] : oli[2]], start: oli ? Number(oli[1]) : 1 });
      continue;
    }
    const prev = blocks[blocks.length - 1];
    if (prev?.type === 'p') prev.lines.push(line);
    else blocks.push({ type: 'p', lines: [line] });
  }
  return blocks;
}

function joinLines(lines, ctx) {
  return lines.flatMap((l, i) => (i ? [<br key={`b${i}`} />, ...inline(l, ctx)] : inline(l, ctx)));
}

export function renderRich(text, ctx = {}) {
  if (!text) return null;
  const local = { ...ctx, _rules: null };
  const blocks = ctx.plain ? [{ type: 'p', lines: text.split('\n') }] : parseBlocks(text);
  return blocks.map((b, i) => {
    switch (b.type) {
      case 'code':
        return (
          <pre key={i} className="md-code">
            <code>{b.text}</code>
          </pre>
        );
      case 'h1':
      case 'h2':
      case 'h3': {
        const Tag = b.type;
        return (
          <Tag key={i} className="md-h">
            {inline(b.text, local)}
          </Tag>
        );
      }
      case 'sub':
        return (
          <div key={i} className="md-sub">
            {inline(b.text, local)}
          </div>
        );
      case 'quote':
        return (
          <blockquote key={i} className="md-quote">
            {joinLines(b.lines, local)}
          </blockquote>
        );
      case 'ul':
      case 'ol': {
        const Tag = b.type;
        return (
          <Tag key={i} className="md-list" start={b.type === 'ol' && b.start !== 1 ? b.start : undefined}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it, local)}</li>
            ))}
          </Tag>
        );
      }
      default:
        return (
          <div key={i} className="md-p">
            {joinLines(b.lines, local)}
          </div>
        );
    }
  });
}

// A message that's only 1–27 emoji shows them big, like Discord.
export function isJumbo(text, emojiNames) {
  const t = (text || '').replace(/:([a-z0-9_]{2,32}):/g, (m, n) => (emojiNames?.has(n) ? '\u{1F600}' : m)).replace(/\s+/g, '');
  if (!t) return false;
  const parts = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter().segment(t)].map((s) => s.segment) : [...t];
  return parts.length <= 27 && parts.every((p) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(p));
}

// Builds the mention pattern for the people, subteams, and @everyone.
export function mentionPattern(names) {
  const sorted = [...new Set(names)].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return sorted.length ? new RegExp(`@(${sorted.join('|')})(?![\\w])`) : null;
}

// For the formatting bar: wraps the selection (or puts the cursor between the marks).
export function wrapSelection(text, start, end, before, after = before) {
  const sel = text.slice(start, end);
  const next = text.slice(0, start) + before + sel + after + text.slice(end);
  return { text: next, start: start + before.length, end: end + before.length };
}

// For headings, quotes, and lists: adds (or removes) a prefix on each selected line.
export function prefixLines(text, start, end, prefix) {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = text.indexOf('\n', end) === -1 ? text.length : text.indexOf('\n', end);
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const strip = (l) => l.replace(/^(#{1,3} |-# |> |- )/, '');
  const all = lines.every((l) => l.startsWith(prefix));
  const changed = lines.map((l) => (all ? l.slice(prefix.length) : prefix + strip(l))).join('\n');
  const next = text.slice(0, lineStart) + changed + text.slice(lineEnd);
  return { text: next, start: lineStart + changed.length, end: lineStart + changed.length };
}
