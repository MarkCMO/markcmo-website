// Builds the complete Netlify -> Cloudflare cross-reference using
// the data we've already pulled. Identifies:
//   - which Netlify sites have a CF Pages mirror
//   - which need to be created
//   - what custom domain each has
//   - what GitHub repo each is connected to (for git-integration step)
//
// Reads from:   inventory/netlify_sites.json + inventory/cf_pages_names.txt
// Writes to:    inventory/cross_reference.json + inventory/cross_reference.md

import { readFileSync, writeFileSync } from 'node:fs';

const sites = JSON.parse(readFileSync('inventory/netlify_sites.json', 'utf8'));
const cfNames = readFileSync('inventory/cf_pages_names.txt', 'utf8')
  .split('\n').map(s => s.trim()).filter(Boolean);
const cfSet = new Set(cfNames);

// Netlify site -> CF Pages name mapping. Most exist via fuzzy match.
// Manual overrides for known mappings where naming diverged:
const MANUAL_MAP = {
  'wetyr-aquatics': 'fast-aquatics',
  'cashpert-production': 'cashpert',
  'busbrother': 'bus-brother',
  'thedoctordirectory': 'doctor-directory',
  'aitoolboxworld': 'aitoolbox-world',
  'leadflowcash': 'leadflow-cash',
  'letsleavenow': 'lets-leave-now',
  'stockpilotvip': 'stockpilot-vip',
  'proof-of-you': 'poy-verify',
  'joseph-assise-painting': 'joseph-assise',
  'elsocontracting': 'elso-contracting',
  'resplendent-torrone-bc84df': 'wetyr',
  'money-scaling-cycle': 'money-scaling-cycle',
  'butcherbud': 'butcherbud',
};

const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const mirrored = [];
const notMirrored = [];

for (const s of sites) {
  // Check manual map first
  let cfMatch = MANUAL_MAP[s.name];
  if (!cfMatch) {
    // Try exact match against CF names
    if (cfSet.has(s.name)) cfMatch = s.name;
    // Try normalized match
    else {
      const ns = norm(s.name);
      cfMatch = cfNames.find(c => norm(c) === ns);
    }
  }

  const repo = s.build_settings?.repo_url || null;
  const branch = s.build_settings?.repo_branch || null;
  const publishDir = s.build_settings?.dir || null;
  const buildCmd = s.build_settings?.cmd || null;

  const entry = {
    netlify_name: s.name,
    netlify_id: s.id,
    custom_domain: s.custom_domain || null,
    netlify_url: `https://${s.name}.netlify.app`,
    cf_project: cfMatch || null,
    cf_url: cfMatch ? `https://${cfMatch}.pages.dev` : null,
    repo_url: repo,
    branch: branch,
    publish_dir: publishDir,
    build_cmd: buildCmd
  };

  if (cfMatch) mirrored.push(entry); else notMirrored.push(entry);
}

writeFileSync('inventory/cross_reference.json', JSON.stringify({
  total_netlify_sites: sites.length,
  total_cf_projects: cfNames.length,
  mirrored_count: mirrored.length,
  not_mirrored_count: notMirrored.length,
  mirrored,
  notMirrored
}, null, 2));

// Also write a human-readable markdown summary
const md = [
  '# Netlify → Cloudflare Pages Cross-Reference',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `- Netlify sites: **${sites.length}**`,
  `- CF Pages projects: **${cfNames.length}**`,
  `- Already mirrored: **${mirrored.length}**`,
  `- Need to create: **${notMirrored.length}**`,
  '',
  '## ✅ Already mirrored on Cloudflare',
  '',
  '| Netlify site | Custom domain | CF Pages project | Repo |',
  '|---|---|---|---|',
  ...mirrored.map(m => `| ${m.netlify_name} | ${m.custom_domain || '-'} | ${m.cf_project} | ${m.repo_url || '-'} |`),
  '',
  '## ❌ Not yet on Cloudflare',
  '',
  '### With custom domain (production-facing)',
  '',
  '| Netlify site | Custom domain | Repo | Publish dir |',
  '|---|---|---|---|',
  ...notMirrored.filter(n => n.custom_domain).map(n => `| ${n.netlify_name} | ${n.custom_domain} | ${n.repo_url || '-'} | ${n.publish_dir || '-'} |`),
  '',
  '### Without custom domain (dev/test/internal)',
  '',
  '| Netlify site | Repo | Publish dir |',
  '|---|---|---|',
  ...notMirrored.filter(n => !n.custom_domain).map(n => `| ${n.netlify_name} | ${n.repo_url || '-'} | ${n.publish_dir || '-'} |`)
].join('\n');

writeFileSync('inventory/cross_reference.md', md);

console.log('Done. Wrote:');
console.log('  inventory/cross_reference.json (' + JSON.stringify({ mirrored: mirrored.length, notMirrored: notMirrored.length }) + ')');
console.log('  inventory/cross_reference.md');
console.log();
console.log('Mirrored sites with custom domains:');
mirrored.filter(m => m.custom_domain).forEach(m => console.log('  ' + m.netlify_name.padEnd(30) + ' → ' + m.cf_project + ' [' + m.custom_domain + ']'));
console.log();
console.log('NOT yet on CF (with custom domain):');
notMirrored.filter(n => n.custom_domain).forEach(n => console.log('  ' + n.netlify_name.padEnd(30) + ' [' + n.custom_domain + ']'));
console.log();
console.log('NOT yet on CF (no custom domain - dev/test):');
notMirrored.filter(n => !n.custom_domain).forEach(n => console.log('  ' + n.netlify_name.padEnd(30)));
