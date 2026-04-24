/**
 * retheme-html.js
 * Replaces hardcoded dark/gold inline style colors in all HTML files
 * with the new light-professional palette.
 *
 * Swaps:
 *  Gold hex   #C9A84C / #c9a84c / #e2c06e / #e8c14a  → #2563EB (blue)
 *  Gold rgba  rgba(201,168,76,X)                       → rgba(37,99,235,X)
 *  Dark card bg  #1c1c1c / #141414 / #1a1a1a / #2a2a2a → #FFFFFF
 *  Dark body bg  background:#0a0a0a / #0d0d0d          → background:#F8FAFC
 *  Dark text on gold buttons  color:#0a0a0a / #000      → color:#FFFFFF
 *  Off-black section bg  #111111                        → #F8FAFC
 *
 * Does NOT touch <head> or <script> or <style> tags (only inline style="")
 */

const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const EXTS = ['.html'];

// ── Replacement rules (applied in order) ──────────────────────────────────
// Each rule: { find: RegExp, replace: string|function }
// All operate only on content inside style="..." attribute values.

const RULES = [
  // Gold hex → blue
  { find: /#[Cc]9[Aa]84[Cc]/g,            replace: '#2563EB' },
  { find: /#[Ee]2[Cc]06[Ee]/g,            replace: '#3B82F6' },
  { find: /#[Ee]8[Cc]1[4-9][A-Fa-f0-9]/g, replace: '#3B82F6' },
  { find: /#9[Aa]71[Cc]0/g,               replace: '#1D4ED8' },
  { find: /#[Dd]4[Aa]84[Cc]/g,            replace: '#2563EB' },
  { find: /#[Bb]8923[Ee]/g,               replace: '#2563EB' },

  // Gold rgba → blue rgba (preserve alpha)
  {
    find: /rgba\(\s*201\s*,\s*168\s*,\s*76\s*,\s*([\d.]+)\s*\)/g,
    replace: (_, a) => `rgba(37,99,235,${a})`
  },

  // Dark charcoal/graphite card backgrounds → white
  { find: /background\s*:\s*#1[Cc]1[Cc]1[Cc]/g,  replace: 'background:#FFFFFF' },
  { find: /background\s*:\s*#1[Aa]1[Aa]1[Aa]/g,  replace: 'background:#FFFFFF' },
  { find: /background\s*:\s*#1[Ff]1[Ff]1[Ff]/g,  replace: 'background:#FFFFFF' },
  { find: /background\s*:\s*#141414/g,            replace: 'background:#FFFFFF' },
  { find: /background\s*:\s*#1[45]1[45]20/g,      replace: 'background:#FFFFFF' },
  { find: /background\s*:\s*#2[Aa]2[Aa]2[Aa]/g,  replace: 'background:#F8FAFC' },

  // Dark body/section backgrounds → off-white
  { find: /background\s*:\s*#0[Aa]0[Aa]0[Aa]/g,  replace: 'background:#F8FAFC' },
  { find: /background\s*:\s*#0[Dd]0[Dd]0[Dd]/g,  replace: 'background:#F8FAFC' },
  { find: /background\s*:\s*#111(?:111)?(?!\d)/g, replace: 'background:#F8FAFC' },

  // Dark text color on gold buttons → white (color:#0a0a0a or #000)
  { find: /color\s*:\s*#0[Aa]0[Aa]0[Aa]/g,       replace: 'color:#FFFFFF' },
  { find: /color\s*:\s*#000(?:000)?(?!\d)/g,      replace: 'color:#1E293B' },
];

// ── Walk directory ─────────────────────────────────────────────────────────
function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (EXTS.includes(path.extname(entry.name).toLowerCase())) results.push(full);
  }
  return results;
}

// ── Apply rules only inside style="..." attributes ─────────────────────────
function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace content inside style="..." only
  const result = original.replace(/style="([^"]*)"/g, (match, styleVal) => {
    let newVal = styleVal;
    for (const rule of RULES) {
      newVal = newVal.replace(rule.find, rule.replace);
    }
    if (newVal !== styleVal) { changed = true; }
    return `style="${newVal}"`;
  });

  if (changed) {
    fs.writeFileSync(filePath, result, 'utf8');
    return true;
  }
  return false;
}

// ── Main ───────────────────────────────────────────────────────────────────
const files = walk(ROOT);
let updated = 0, skipped = 0;

for (const f of files) {
  try {
    if (processFile(f)) { updated++; console.log('Updated:', path.relative(ROOT, f)); }
    else skipped++;
  } catch (e) {
    console.error('Error:', f, e.message);
  }
}

console.log(`\nDone. ${updated} files updated, ${skipped} unchanged.`);
