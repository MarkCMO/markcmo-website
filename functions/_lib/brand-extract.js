// functions/_lib/brand-extract.js
// ─────────────────────────────────────────────────────────────────────────────
// Pull a usable brand kit from a prospect's website so a CUSTOM proposal can be
// painted in their colors with their logo - the same hand-branded feel as the
// BBQ'n Fools / Something Fishy proposals, but assembled automatically.
//
// Returns: { name, logo, theme_color, accent, accent2, dark, light,
//            font_heading, font_body, google_fonts, palette[], source }
// Everything is best-effort; missing slots simply fall back downstream.
// Runs inside a CF Worker: bounded fetches, bounded bytes, no deps.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HTML_BYTES = 600 * 1024;
const MAX_CSS_FILES = 2;
const MAX_CSS_BYTES = 400 * 1024;
const FETCH_TIMEOUT_MS = 6000;

export async function extractBrand(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return { source: 'invalid_url' };

  let html = '';
  try {
    html = await fetchText(url, MAX_HTML_BYTES);
  } catch (e) {
    return { source: 'fetch_failed', error: String(e).slice(0, 180), domain: hostOf(url) };
  }
  if (!html) return { source: 'empty', domain: hostOf(url) };

  const base = url;
  const name = meta(html, 'og:site_name') || titleOf(html) || hostOf(url);
  const theme_color = metaName(html, 'theme-color') || null;

  // Logo candidates in priority order.
  const logo = abs(base, (
    meta(html, 'og:image') ||
    linkHref(html, /apple-touch-icon[^"']*/i) ||
    logoImg(html) ||
    linkHref(html, /(?:^|\s)icon(?:\s|$)/i) ||
    '/favicon.ico'
  ));

  // Gather color sources: inline styles in the HTML + a couple of linked CSS.
  let css = collectInlineStyles(html);
  const cssLinks = stylesheetLinks(html).slice(0, MAX_CSS_FILES);
  for (const href of cssLinks) {
    try { css += '\n' + (await fetchText(abs(base, href), MAX_CSS_BYTES)); } catch (_) {}
  }

  const colors = rankColors(css + ' ' + html, theme_color);
  const fonts = extractFonts(css, html);
  const googleFonts = googleFontsHref(html);

  return {
    name: clean(name),
    domain: hostOf(url),
    logo: logo || null,
    theme_color,
    accent: colors.accent || theme_color || null,
    accent2: colors.accent2 || null,
    dark: colors.dark || null,
    light: colors.light || '#FFFFFF',
    palette: colors.palette,
    font_heading: fonts.heading || null,
    font_body: fonts.body || null,
    google_fonts: googleFonts || null,
    source: 'ok',
  };
}

// ── fetch with cap + timeout ────────────────────────────────────────────────
async function fetchText(url, maxBytes) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarkCMO-BrandBot/1.0; +https://markcmo.com)', Accept: 'text/html,text/css,*/*' },
      cf: { cacheTtl: 300 },
    });
    if (!res.ok) throw new Error('status ' + res.status);
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > maxBytes ? buf.slice(0, maxBytes) : buf;
    return new TextDecoder('utf-8', { fatal: false }).decode(slice);
  } finally {
    clearTimeout(to);
  }
}

// ── HTML/CSS scrapers ───────────────────────────────────────────────────────
function meta(html, prop) {
  const m = html.match(new RegExp(`<meta[^>]+property=["']${esc(prop)}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
            html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${esc(prop)}["']`, 'i'));
  return m ? m[1] : null;
}
function metaName(html, name) {
  const m = html.match(new RegExp(`<meta[^>]+name=["']${esc(name)}["'][^>]+content=["']([^"']+)["']`, 'i'));
  return m ? m[1] : null;
}
function titleOf(html) {
  const m = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
  return m ? m[1].trim() : null;
}
function linkHref(html, relRe) {
  const links = html.match(/<link\b[^>]*>/gi) || [];
  for (const l of links) {
    const rel = (l.match(/rel=["']([^"']+)["']/i) || [])[1] || '';
    if (relRe.test(rel)) {
      const href = (l.match(/href=["']([^"']+)["']/i) || [])[1];
      if (href) return href;
    }
  }
  return null;
}
function logoImg(html) {
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  for (const t of imgs) {
    if (/logo/i.test(t)) {
      const src = (t.match(/src=["']([^"']+)["']/i) || [])[1];
      if (src) return src;
    }
  }
  return null;
}
function stylesheetLinks(html) {
  const out = [];
  const links = html.match(/<link\b[^>]*>/gi) || [];
  for (const l of links) {
    if (/rel=["']stylesheet["']/i.test(l) && !/fonts\.googleapis/i.test(l)) {
      const href = (l.match(/href=["']([^"']+)["']/i) || [])[1];
      if (href) out.push(href);
    }
  }
  return out;
}
function collectInlineStyles(html) {
  let s = '';
  const styles = html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi) || [];
  for (const b of styles) s += ' ' + b.replace(/<\/?style[^>]*>/gi, '');
  const inline = html.match(/style=["'][^"']+["']/gi) || [];
  for (const b of inline) s += ' ' + b;
  return s;
}
function googleFontsHref(html) {
  const links = html.match(/<link\b[^>]*>/gi) || [];
  for (const l of links) {
    if (/fonts\.googleapis\.com\/css/i.test(l)) {
      const href = (l.match(/href=["']([^"']+)["']/i) || [])[1];
      if (href) return href.startsWith('http') ? href : 'https:' + href;
    }
  }
  return null;
}
function extractFonts(css, html) {
  const fams = [];
  const re = /font-family\s*:\s*([^;}"']+)/gi;
  let m;
  const src = css + ' ' + html;
  while ((m = re.exec(src)) && fams.length < 30) {
    const fam = m[1].split(',')[0].replace(/["']/g, '').trim();
    if (fam && !/inherit|initial|unset|var\(/i.test(fam)) fams.push(fam);
  }
  // Most frequent two distinct families: heading = first, body = next different.
  const freq = {};
  fams.forEach((f) => { freq[f] = (freq[f] || 0) + 1; });
  const ranked = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
  const heading = ranked[0] ? `'${ranked[0]}', sans-serif` : null;
  const body = ranked.find((f) => f !== ranked[0]);
  return { heading, body: body ? `'${body}', sans-serif` : heading };
}

// ── color ranking ───────────────────────────────────────────────────────────
function rankColors(text, themeColor) {
  const counts = {};
  const push = (hex) => { const h = norm(hex); if (h) counts[h] = (counts[h] || 0) + 1; };

  (text.match(/#[0-9a-fA-F]{6}\b/g) || []).forEach(push);
  (text.match(/#[0-9a-fA-F]{3}\b/g) || []).forEach((h) => push('#' + h.slice(1).split('').map((c) => c + c).join('')));
  (text.match(/rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/g) || []).forEach((r) => {
    const n = r.match(/\d{1,3}/g).map(Number);
    push(rgbHex(n[0], n[1], n[2]));
  });
  if (themeColor) push(themeColor), push(themeColor), push(themeColor); // weight the declared brand color

  const all = Object.entries(counts).map(([hex, n]) => ({ hex, n, ...analyze(hex) }));
  if (!all.length) return { accent: null, accent2: null, dark: null, light: null, palette: [] };

  // Accent: the most-used reasonably saturated, mid-light color.
  const saturated = all.filter((c) => c.sat > 0.18 && c.lum > 0.06 && c.lum < 0.92).sort((a, b) => b.n - a.n);
  const accent = saturated[0]?.hex || null;
  const accent2 = saturated.find((c) => c.hex !== accent)?.hex || null;

  // Dark ground: darkest frequently-used color. Light: lightest.
  const byLum = all.slice().sort((a, b) => a.lum - b.lum);
  const dark = byLum.find((c) => c.lum < 0.18 && c.n > 1)?.hex || byLum[0]?.hex || null;
  const light = byLum[byLum.length - 1]?.hex || '#FFFFFF';

  const palette = all.sort((a, b) => b.n - a.n).slice(0, 8).map((c) => c.hex);
  return { accent, accent2, dark, light, palette };
}

function analyze(hex) {
  const c = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b);
  const sat = max === 0 ? 0 : (max - min) / max;
  return { lum, sat };
}
function hexToRgb(h) {
  const s = String(h).replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}
function rgbHex(r, g, b) { return '#' + [r, g, b].map((x) => ('0' + Math.max(0, Math.min(255, x)).toString(16)).slice(-2)).join(''); }
function norm(hex) {
  if (!hex) return null;
  let s = String(hex).trim();
  if (s.startsWith('rgb')) { const n = s.match(/\d{1,3}/g); return n ? rgbHex(+n[0], +n[1], +n[2]) : null; }
  s = s.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return /^[0-9a-fA-F]{6}$/.test(s) ? '#' + s.toLowerCase() : null;
}

// ── url helpers ─────────────────────────────────────────────────────────────
function normalizeUrl(u) {
  if (!u) return null;
  let s = String(u).trim();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { return new URL(s).toString(); } catch (_) { return null; }
}
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; } }
function abs(base, href) {
  if (!href) return null;
  try { return new URL(href, base).toString(); } catch (_) { return href; }
}
function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120); }
function esc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
