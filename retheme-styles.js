/**
 * retheme-styles.js
 * Patches embedded <style> blocks inside HTML files.
 * Targets only: index.html (and any other top-level pages with embedded CSS)
 *
 * Strategy:
 *  1. Replace :root variable block with new light-pro palette
 *  2. Override body background to white
 *  3. Replace gold color references with blue
 *  4. Replace dark card/section backgrounds with light equivalents
 *  5. Keep hero sections dark (--navy)
 */

const fs   = require('fs');
const path = require('path');

// Files to process (by name, relative to script dir)
const TARGETS = ['index.html'];

const ROOT = __dirname;

// ── New :root block ────────────────────────────────────────────────────────
const NEW_ROOT = `    :root {
      --black: #0A1628;
      --off-black: #0F2040;
      --charcoal: #FFFFFF;
      --graphite: #F1F5F9;
      --gold: #2563EB;
      --gold-light: #3B82F6;
      --gold-pale: #EFF6FF;
      --white: #FFFFFF;
      --cream: #F1F5F9;
      --mid: #64748B;
      --light-grey: #475569;
      /* new aliases */
      --blue: #2563EB;
      --blue-hover: #1D4ED8;
      --blue-pale: #EFF6FF;
      --orange: #F97316;
      --orange-hover: #EA6C0A;
      --text: #1E293B;
      --text-mid: #64748B;
      --border: #E2E8F0;
      --navy: #0A1628;
    }`;

// ── CSS rules inside <style> blocks ──────────────────────────────────────
// These are regex/string replacements applied to the text inside <style>...</style>
const STYLE_RULES = [
  // Replace :root block
  {
    find: /:root\s*\{[^}]*\}/s,
    replace: NEW_ROOT
  },

  // Body: change black bg to white, gold text to dark
  {
    find: /body\s*\{([^}]*)background:\s*var\(--black\)([^}]*)\}/s,
    replace: (_, pre, post) => `body {${pre}background: #FFFFFF${post}}`
  },
  {
    find: /body\s*\{([^}]*)color:\s*var\(--white\)([^}]*)\}/s,
    replace: (_, pre, post) => `body {${pre}color: #1E293B${post}}`
  },

  // Ticker: gold bg → blue gradient
  {
    find: /\.ticker\s*\{([^}]*)background:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.ticker {${pre}background: linear-gradient(90deg, #1D4ED8 0%, #3B82F6 50%, #1D4ED8 100%)${post}}`
  },
  // Ticker item text: was --black (on gold bg), now white (on blue bg)
  {
    find: /\.ticker-item\s*\{([^}]*)color:\s*var\(--black\)([^}]*)\}/s,
    replace: (_, pre, post) => `.ticker-item {${pre}color: #FFFFFF${post}}`
  },
  {
    find: /\.ticker-sep\s*\{([^}]*)color:\s*rgba\(0,0,0,[^)]+\)([^}]*)\}/s,
    replace: (_, pre, post) => `.ticker-sep {${pre}color: rgba(255,255,255,0.4)${post}}`
  },

  // About section: off-black → off-white
  {
    find: /#about\s*\{([^}]*)background:\s*var\(--off-black\)([^}]*)\}/s,
    replace: (_, pre, post) => `#about {${pre}background: #F8FAFC${post}}`
  },

  // Services: black → white
  {
    find: /#services\s*\{([^}]*)background:\s*var\(--black\)([^}]*)\}/s,
    replace: (_, pre, post) => `#services {${pre}background: #FFFFFF${post}}`
  },

  // Proof/results: charcoal → light
  {
    find: /#proof\s*\{([^}]*)background:\s*var\(--charcoal\)([^}]*)\}/s,
    replace: (_, pre, post) => `#proof {${pre}background: #F8FAFC${post}}`
  },
  {
    find: /#results\s*\{([^}]*)background:\s*var\(--black\)([^}]*)\}/s,
    replace: (_, pre, post) => `#results {${pre}background: #FFFFFF${post}}`
  },
  {
    find: /#testimonials\s*\{([^}]*)background:\s*var\(--off-black\)([^}]*)\}/s,
    replace: (_, pre, post) => `#testimonials {${pre}background: #F8FAFC${post}}`
  },
  {
    find: /#contact\s*\{([^}]*)background:\s*var\(--black\)([^}]*)\}/s,
    replace: (_, pre, post) => `#contact {${pre}background: #FFFFFF${post}}`
  },

  // Cards: charcoal bg → white
  {
    find: /background:\s*var\(--charcoal\)/g,
    replace: 'background: #FFFFFF'
  },
  {
    find: /background:\s*var\(--off-black\)/g,
    replace: 'background: #F8FAFC'
  },

  // Section h2 color: var(--white) → dark
  {
    find: /h2\s*\{([^}]*)color:\s*var\(--white\)([^}]*)\}/gs,
    replace: (_, pre, post) => `h2 {${pre}color: #1E293B${post}}`
  },
  // h3 in cards etc
  {
    find: /\.service-card\s+h3\s*\{([^}]*)color:\s*var\(--white\)([^}]*)\}/s,
    replace: (_, pre, post) => `.service-card h3 {${pre}color: #1E293B${post}}`
  },

  // Text: --light-grey → slate (on white bg these need to be darker)
  // Keep as CSS var — the new --light-grey is already slate-500

  // Proof number: --gold → --orange for energy
  {
    find: /\.proof-num\s*\{([^}]*)color:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.proof-num {${pre}color: #F97316${post}}`
  },

  // Hero stat: gold → orange
  {
    find: /\.hero-stat-num\s*\{([^}]*)color:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.hero-stat-num {${pre}color: #F97316${post}}`
  },

  // about-card: gold title → blue
  {
    find: /\.about-card-title\s*\{([^}]*)color:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.about-card-title {${pre}color: #2563EB${post}}`
  },

  // Primary button: gold bg → blue
  {
    find: /\.btn-primary\s*\{([^}]*)background:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.btn-primary {${pre}background: #2563EB${post}}`
  },
  {
    find: /\.btn-primary\s*\{([^}]*)color:\s*var\(--black\)([^}]*)\}/s,
    replace: (_, pre, post) => `.btn-primary {${pre}color: #FFFFFF${post}}`
  },
  {
    find: /\.btn-primary\s*\{([^}]*)box-shadow:[^;]+rgba\(201,168,76[^)]+\)([^}]*)\}/s,
    replace: (_, pre, post) => `.btn-primary {${pre}box-shadow: 0 4px 20px rgba(37,99,235,0.3)${post}}`
  },
  {
    find: /\.btn-primary:hover\s*\{([^}]*)background:\s*var\(--gold-light\)([^}]*)\}/s,
    replace: (_, pre, post) => `.btn-primary:hover {${pre}background: #1D4ED8${post}}`
  },

  // Ghost button: gold → blue
  {
    find: /\.btn-ghost\s*\{([^}]*)border:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.btn-ghost {${pre}border: 1.5px solid rgba(37,99,235,0.4);${post}}`
  },
  {
    find: /\.btn-ghost\s*\{([^}]*)color:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.btn-ghost {${pre}color: #2563EB${post}}`
  },

  // Proof/services borders: rgba(201,168,76,...) → rgba(37,99,235,...) or var(--border)
  {
    find: /rgba\(201,168,76,0\.1[25]?\)/g,
    replace: 'rgba(37,99,235,0.12)'
  },
  {
    find: /rgba\(201,168,76,0\.[0-9]+\)/g,
    replace: (m) => {
      // Extract alpha
      const match = m.match(/0\.([\d]+)/);
      const alpha = match ? parseFloat('0.' + match[1]) : 0.1;
      return `rgba(37,99,235,${alpha.toFixed(2)})`;
    }
  },

  // Service card hover: rgba(201,168,76,...) → blue-pale
  {
    find: /\.service-card:hover\s*\{([^}]*)background:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.service-card:hover {${pre}background: #EFF6FF;${post}}`
  },

  // Hero portrait frame: gold border → blue
  {
    find: /\.hero-portrait-frame::before\s*\{([^}]*)border:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.hero-portrait-frame::before {${pre}border: 2px solid rgba(37,99,235,0.3);${post}}`
  },
  {
    find: /\.hero-portrait-frame::after\s*\{([^}]*)background:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.hero-portrait-frame::after {${pre}background: rgba(37,99,235,0.06);${post}}`
  },
  {
    find: /\.hero-portrait-frame\s*\{([^}]*)background:\s*#0a0a0a([^}]*)\}/s,
    replace: (_, pre, post) => `.hero-portrait-frame {${pre}background: #0A1628${post}}`
  },

  // Hero stats border: gold → slate
  {
    find: /\.hero-stats\s*\{([^}]*)border:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.hero-stats {${pre}border: 1px solid #E2E8F0;${post}}`
  },
  {
    find: /\.hero-stat\s*\{([^}]*)border-right:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.hero-stat {${pre}border-right: 1px solid #E2E8F0;${post}}`
  },

  // Portrait icon: gold → blue
  {
    find: /\.portrait-icon\s*\{([^}]*)background:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.portrait-icon {${pre}background: rgba(37,99,235,0.08);${post}}`
  },
  {
    find: /\.portrait-icon\s*\{([^}]*)border:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.portrait-icon {${pre}border: 2px solid rgba(37,99,235,0.25);${post}}`
  },

  // Nav: gold active/hover → blue
  {
    find: /\.nav-links a:hover[^{]*\{([^}]*)color:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.nav-links a:hover { ${pre}color: #2563EB${post}}`
  },

  // Service features arrow: gold → blue
  {
    find: /\.service-features li::before\s*\{([^}]*)color:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.service-features li::before {${pre}color: #2563EB${post}}`
  },

  // Section label: gold → blue
  {
    find: /\.section-label\s*\{([^}]*)color:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.section-label {${pre}color: #2563EB${post}}`
  },
  {
    find: /\.section-label::after\s*\{([^}]*)background:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.section-label::after {${pre}background: #2563EB${post}}`
  },

  // Hero eyebrow: gold → blue
  {
    find: /\.hero-eyebrow\s*\{([^}]*)color:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.hero-eyebrow {${pre}color: #3B82F6${post}}`
  },
  {
    find: /\.hero-eyebrow::before\s*\{([^}]*)background:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.hero-eyebrow::before {${pre}background: #3B82F6${post}}`
  },

  // h1 em: gold → orange
  {
    find: /h1\s+em\s*\{[^}]*color:\s*var\(--gold\)[^}]*\}/s,
    replace: 'h1 em { font-style: normal; color: #F97316; }'
  },

  // h2 em: gold → blue
  {
    find: /h2\s+em\s*\{[^}]*color:\s*var\(--gold\)[^}]*\}/s,
    replace: 'h2 em { font-style: normal; color: #2563EB; }'
  },

  // skill-tag: gold → blue
  {
    find: /\.skill-tag\s*\{([^}]*)color:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.skill-tag {${pre}color: #2563EB${post}}`
  },

  // service-num: gold → blue muted
  {
    find: /\.service-num\s*\{([^}]*)color:\s*var\(--gold\)([^}]*)\}/s,
    replace: (_, pre, post) => `.service-num {${pre}color: #2563EB${post}}`
  },

  // proof border: gold → slate
  {
    find: /#proof\s*\{([^}]*)border-top:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `#proof {${pre}border-top: 1px solid #E2E8F0;${post}}`
  },
  {
    find: /#proof\s*\{([^}]*)border-bottom:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `#proof {${pre}border-bottom: 1px solid #E2E8F0;${post}}`
  },
  {
    find: /\.proof-grid\s*\{([^}]*)border:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.proof-grid {${pre}border: 1px solid #E2E8F0;${post}}`
  },
  {
    find: /\.proof-item\s*\{([^}]*)border-right:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.proof-item {${pre}border-right: 1px solid #E2E8F0;${post}}`
  },

  // services-grid border: gold → slate
  {
    find: /\.services-grid\s*\{([^}]*)border:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.services-grid {${pre}border: 1px solid #E2E8F0;${post}}`
  },
  {
    find: /\.service-card\s*\{([^}]*)border-right:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.service-card {${pre}border-right: 1px solid #E2E8F0;${post}}`
  },

  // service features: gold border → slate
  {
    find: /\.service-features li\s*\{([^}]*)border-bottom:[^;]+rgba\(255,255,255[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.service-features li {${pre}border-bottom: 1px solid #E2E8F0;${post}}`
  },

  // about-card: gold border → slate
  {
    find: /\.about-card\s*\{([^}]*)border:[^;]+rgba\(201,168,76[^;]+;([^}]*)\}/s,
    replace: (_, pre, post) => `.about-card {${pre}border: 1px solid #E2E8F0;${post}}`
  },
];

// ── Apply replacements inside <style> blocks ──────────────────────────────
function processStyleBlocks(html) {
  return html.replace(/<style>([\s\S]*?)<\/style>/g, (match, css) => {
    let newCss = css;
    for (const rule of STYLE_RULES) {
      if (typeof rule.replace === 'function') {
        newCss = newCss.replace(rule.find, rule.replace);
      } else {
        newCss = newCss.replace(rule.find, rule.replace);
      }
    }
    return `<style>${newCss}</style>`;
  });
}

// ── Main ─────────────────────────────────────────────────────────────────
for (const target of TARGETS) {
  const filePath = path.join(ROOT, target);
  if (!fs.existsSync(filePath)) { console.warn('Not found:', target); continue; }
  const original = fs.readFileSync(filePath, 'utf8');
  const result   = processStyleBlocks(original);
  if (result !== original) {
    fs.writeFileSync(filePath, result, 'utf8');
    console.log('Updated:', target);
  } else {
    console.log('No changes:', target);
  }
}
console.log('Done.');
