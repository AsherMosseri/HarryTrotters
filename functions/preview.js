// Link previews: fetch a page's start and read its title, description, and
// image. Private and internal addresses are refused, so links can't be used
// to reach anything inside Google Cloud.
import dns from 'node:dns/promises';
import net from 'node:net';

const clip = (text, n) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

function privateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return privateAddress(v6.slice(7));
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

export async function fetchPage(url, hops = 0) {
  const u = new URL(url);
  if (!['http:', 'https:'].includes(u.protocol) || (u.port && !['80', '443'].includes(u.port))) throw new Error('bad url');
  const addresses = await dns.lookup(u.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => privateAddress(a.address))) throw new Error('private address');
  const res = await fetch(u, {
    redirect: 'manual',
    signal: AbortSignal.timeout(6000),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; FTC32313-LinkPreview/1.0)', accept: 'text/html,application/xhtml+xml' },
  });
  const next = res.headers.get('location');
  if (res.status >= 300 && res.status < 400 && next && hops < 4) return fetchPage(new URL(next, u).href, hops + 1);
  if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) throw new Error(`status ${res.status}`);
  // Only the start of the page (where the <head> is).
  const reader = res.body.getReader();
  let html = '';
  const decoder = new TextDecoder();
  while (html.length < 400000) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) break;
  }
  reader.cancel().catch(() => {});
  return { html, url: u.href };
}

const decodeEntities = (t) =>
  t
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

export function readPreview(html, pageUrl) {
  const meta = {};
  for (const tag of html.match(/<meta\s[^>]*>/gi) || []) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (key && content && !(key in meta)) meta[key] = decodeEntities(content.trim());
  }
  const title = meta['og:title'] || meta['twitter:title'] || decodeEntities(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || '');
  if (!title) return null;
  let image = meta['og:image'] || meta['twitter:image'] || '';
  try {
    image = image ? new URL(image, pageUrl).href : '';
  } catch {
    image = '';
  }
  return {
    url: pageUrl,
    site: meta['og:site_name'] || new URL(pageUrl).hostname.replace(/^www\./, ''),
    title: clip(title, 140),
    description: clip(meta['og:description'] || meta['description'] || meta['twitter:description'] || '', 220),
    image: image.startsWith('https://') ? image : '',
  };
}

// The first link in a message, skipping code.
export function firstLink(text) {
  const plain = (text || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ');
  return /https?:\/\/[^\s<>()|]+[^\s<>()|.,!?:;'"]/.exec(plain)?.[0] || '';
}

