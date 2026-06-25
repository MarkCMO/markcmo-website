// functions/_lib/funnel-themes.js
// ─────────────────────────────────────────────────────────────────────────────
// Theme system for the productized funnel. Each call gets a tailored look:
// the recap email lets Mark pick a palette per client (warm/feminine for one
// client, deeper/bolder for another, premium-neutral as the house default).
// The chosen theme paints the prospect's intake page AND their hosted proposal,
// so the whole experience feels built for them, not stamped out.
//
// Pure data + helpers. No I/O. The same palette renders identically on the
// intake page (via returned CSS vars) and the proposal renderer.
// ─────────────────────────────────────────────────────────────────────────────

// Every theme provides the full variable set the funnel pages read, so a page
// just swaps :root and nothing else changes.
export const THEMES = {
  premium_neutral: {
    label: 'Premium Neutral (house)',
    note: 'MarkCMO navy + gold. Safe default, works for anyone.',
    fonts: { heading: "'Outfit', sans-serif", body: "'Space Grotesk', sans-serif" },
    googleFonts: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap',
    vars: {
      '--bg': '#0A0F2C', '--bg2': '#0D1330', '--bg3': '#141a3d', '--border': 'rgba(201,168,76,.18)',
      '--text': '#ffffff', '--text2': 'rgba(255,255,255,.82)', '--text3': 'rgba(255,255,255,.55)',
      '--accent': '#C9A84C', '--accent2': '#E2C878', '--on-accent': '#0A0F2C',
    },
  },
  warm_feminine: {
    label: 'Warm & Feminine',
    note: 'Soft cream ground, rose-gold and blush. Recommended when the buyer reads warm/feminine.',
    fonts: { heading: "'Fraunces', Georgia, serif", body: "'Outfit', sans-serif" },
    googleFonts: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&display=swap',
    vars: {
      '--bg': '#FBF6F1', '--bg2': '#F6ECE4', '--bg3': '#FFFFFF', '--border': 'rgba(180,120,110,.22)',
      '--text': '#3A2A2A', '--text2': '#6B5450', '--text3': '#9A817C',
      '--accent': '#C2756B', '--accent2': '#D8A48C', '--on-accent': '#FFFFFF',
    },
  },
  bold_masculine: {
    label: 'Bold & Masculine',
    note: 'Near-black ground, deep oxblood and gold. Recommended when the buyer reads bold/masculine.',
    fonts: { heading: "'Oswald', sans-serif", body: "'Inter', sans-serif" },
    googleFonts: 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap',
    vars: {
      '--bg': '#0E0E10', '--bg2': '#16161A', '--bg3': '#1D1D22', '--border': 'rgba(200,168,76,.16)',
      '--text': '#F4F2EE', '--text2': 'rgba(244,242,238,.78)', '--text3': 'rgba(244,242,238,.5)',
      '--accent': '#B23A2E', '--accent2': '#C9A84C', '--on-accent': '#FFFFFF',
    },
  },
  vibrant_growth: {
    label: 'Vibrant Growth',
    note: 'Deep emerald with a bright signal accent. Good for DTC / SaaS energy.',
    fonts: { heading: "'Outfit', sans-serif", body: "'Inter', sans-serif" },
    googleFonts: 'https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800;900&family=Inter:wght@400;500;600&display=swap',
    vars: {
      '--bg': '#06231C', '--bg2': '#0A2E25', '--bg3': '#0F3A2F', '--border': 'rgba(80,220,170,.2)',
      '--text': '#EAFBF4', '--text2': 'rgba(234,251,244,.8)', '--text3': 'rgba(234,251,244,.52)',
      '--accent': '#2BD49A', '--accent2': '#7CF0C6', '--on-accent': '#06231C',
    },
  },
  executive_slate: {
    label: 'Executive Slate',
    note: 'Graphite + steel-blue + gold. Boardroom feel for enterprise / M&A.',
    fonts: { heading: "'Outfit', sans-serif", body: "'Space Grotesk', sans-serif" },
    googleFonts: 'https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800;900&family=Space+Grotesk:wght@400;500;600&display=swap',
    vars: {
      '--bg': '#10141B', '--bg2': '#161C25', '--bg3': '#1D2531', '--border': 'rgba(120,150,180,.2)',
      '--text': '#F1F4F8', '--text2': 'rgba(241,244,248,.78)', '--text3': 'rgba(241,244,248,.5)',
      '--accent': '#5B8BB5', '--accent2': '#C9A84C', '--on-accent': '#10141B',
    },
  },
};

export const DEFAULT_THEME = 'premium_neutral';

export function themeVars(key) {
  const t = THEMES[key] || THEMES[DEFAULT_THEME];
  return { vars: t.vars, fonts: t.fonts, googleFonts: t.googleFonts, label: t.label };
}

// CSS string to inject into <style> on the intake page / proposal page.
export function themeCss(key) {
  const t = THEMES[key] || THEMES[DEFAULT_THEME];
  const lines = Object.entries(t.vars).map(([k, v]) => `${k}:${v};`).join('');
  return `:root{${lines}--font-heading:${t.fonts.heading};--font-body:${t.fonts.body};}`;
}

// A custom (client-branded) palette derived from a brand kit becomes a theme
// on the fly. Falls back to neutral where the kit is missing a slot.
export function themeFromBrandKit(kit = {}) {
  const base = THEMES[DEFAULT_THEME].vars;
  const accent = kit.accent || base['--accent'];
  const dark = kit.dark || base['--bg'];
  const light = kit.light || '#FFFFFF';
  const onDark = isLight(dark) ? '#1a1a1a' : '#FFFFFF';
  return {
    label: 'Client brand',
    vars: {
      '--bg': dark, '--bg2': shade(dark, 0.06), '--bg3': shade(dark, 0.12),
      '--border': hexA(accent, 0.22),
      '--text': onDark, '--text2': hexA(onDark, 0.8), '--text3': hexA(onDark, 0.52),
      '--accent': accent, '--accent2': kit.accent2 || tint(accent, 0.3), '--on-accent': isLight(accent) ? '#1a1a1a' : '#FFFFFF',
    },
    fonts: { heading: kit.font_heading || THEMES[DEFAULT_THEME].fonts.heading, body: kit.font_body || THEMES[DEFAULT_THEME].fonts.body },
    googleFonts: kit.google_fonts || THEMES[DEFAULT_THEME].googleFonts,
  };
}

// Heuristic suggestion shown in the recap email. Mark always overrides by
// clicking a different button - this is just a sensible default per client.
export function suggestTheme({ firstName = '', segment = '', growth_stage = '' } = {}) {
  const g = guessGender(firstName);
  if (segment === 'ENTERPRISE_B2B' || growth_stage === 'SUCCESSION' || growth_stage === 'ACQUIRING') return 'executive_slate';
  if (g === 'female') return 'warm_feminine';
  if (g === 'male') return 'bold_masculine';
  if (segment === 'DTC_CONSUMER' || segment === 'GROWTH_SAAS') return 'vibrant_growth';
  return DEFAULT_THEME;
}

export function themeButtons() {
  // `text` is the theme's own foreground color so a button label stays readable
  // on its background (dark text on the light warm theme, white on dark themes).
  return Object.entries(THEMES).map(([key, t]) => ({ key, label: t.label, note: t.note, accent: t.vars['--accent'], bg: t.vars['--bg'], text: t.vars['--text'] }));
}

// ── tiny color helpers (no deps) ────────────────────────────────────────────
function hexToRgb(h) {
  if (!h) return null;
  let s = String(h).replace('#', '').trim();
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
}
function isLight(h) {
  const c = hexToRgb(h);
  if (!c) return false;
  return (c.r * 299 + c.g * 587 + c.b * 114) / 1000 > 150;
}
function hexA(h, a) {
  const c = hexToRgb(h);
  if (!c) return `rgba(255,255,255,${a})`;
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}
function shade(h, amt) {
  const c = hexToRgb(h);
  if (!c) return h;
  const f = (x) => Math.max(0, Math.min(255, Math.round(x + (isLight(h) ? -1 : 1) * amt * 255)));
  return rgbToHex(f(c.r), f(c.g), f(c.b));
}
function tint(h, amt) {
  const c = hexToRgb(h);
  if (!c) return h;
  const f = (x) => Math.max(0, Math.min(255, Math.round(x + (255 - x) * amt)));
  return rgbToHex(f(c.r), f(c.g), f(c.b));
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((x) => ('0' + x.toString(16)).slice(-2)).join('');
}
function guessGender(name) {
  const n = String(name || '').trim().toLowerCase().split(/\s+/)[0];
  if (!n) return 'unknown';
  const female = ['mary','jennifer','linda','patricia','elizabeth','susan','jessica','sarah','karen','lisa','nancy','betty','sandra','margaret','ashley','kimberly','emily','donna','michelle','carol','amanda','melissa','deborah','stephanie','rebecca','laura','sharon','cynthia','kathleen','amy','angela','shirley','anna','brenda','pamela','emma','nicole','helen','samantha','katherine','christine','debra','rachel','carolyn','janet','maria','olivia','heather','diane','julie','victoria','kelly','christina','joan','evelyn','grace','sophia','ava','isabella','mia','abigail','natalie','kurt'];
  const male = ['james','john','robert','michael','william','david','richard','joseph','thomas','charles','christopher','daniel','matthew','anthony','mark','donald','steven','paul','andrew','joshua','kenneth','kevin','brian','george','timothy','ronald','edward','jason','jeffrey','ryan','jacob','gary','nicholas','eric','jonathan','stephen','larry','justin','scott','brandon','frank','benjamin','gregory','samuel','raymond','patrick','jack','dennis','jerry','grant','josh'];
  if (female.includes(n)) return 'female';
  if (male.includes(n)) return 'male';
  return 'unknown';
}
