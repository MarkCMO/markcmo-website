// build-pages-functions.js - Generates CF Pages Function wrappers for MarkCMO
const fs = require('fs');
const path = require('path');

const FN_DIR = 'netlify/functions';
const OUT_ROOT = 'functions';
const EXCLUDE = new Set([]);

const allFns = fs.readdirSync(FN_DIR)
  .filter(f => f.endsWith('.js') && !f.startsWith('_'))
  .map(f => f.replace(/\.js$/, ''))
  .filter(name => !EXCLUDE.has(name))
  .sort();

function generateFile(outRelPath, fnName) {
  const segs = outRelPath.split('/');
  const depth = segs.length - 2;
  const shimUp = '../'.repeat(depth) || './';
  const netlifyUp = '../'.repeat(depth + 1);
  const shim = `${shimUp}_lib/netlify-shim.js`;
  const handler = `${netlifyUp}netlify/functions/${fnName}.js`;
  const tpl = `// AUTO-GENERATED. Do not edit.
import { dispatchSingle } from '${shim}';
import * as mod from '${handler}';
export async function onRequest(context) { return dispatchSingle(mod, context); }
`;
  fs.mkdirSync(path.dirname(outRelPath), { recursive: true });
  fs.writeFileSync(outRelPath, tpl);
}

function cleanOldFns() {
  if (!fs.existsSync(OUT_ROOT)) return;
  for (const entry of fs.readdirSync(OUT_ROOT)) {
    if (entry === '_lib') continue;
    fs.rmSync(path.join(OUT_ROOT, entry), { recursive: true, force: true });
  }
}
cleanOldFns();

let count = 0;
for (const name of allFns) { generateFile(`${OUT_ROOT}/api/${name}.js`, name); count++; }

// Dynamic page routes
const PATTERN = [
  ['blog/[[path]].js',             'public-blog'],
  ['pay/[[path]].js',              'pay'],
  ['purchase-gate/[[path]].js',    'purchase-gate'],
  ['course-lesson/[[path]].js',    'course-lesson'],
  ['course-exam/[[path]].js',      'course-exam'],
  ['course-enroll/[[path]].js',    'course-enroll'],
  ['course-graduate/[[path]].js',  'course-graduate'],
  ['course-curriculum/[[path]].js','course-curriculum'],
  ['course-votes/[[path]].js',     'course-votes'],
  ['student-portal/[[path]].js',   'student-portal'],
  ['film-rolodex/[[path]].js',     'film-rolodex'],
  ['film-intel/[[path]].js',       'film-intel'],
  ['access/[[path]].js',           'access'],
  ['validate-token/[[path]].js',   'validate-token'],
  ['track/[[path]].js',            'track'],
  ['news-feed/[[path]].js',        'news-feed'],
];
for (const [route, handler] of PATTERN) { generateFile(`${OUT_ROOT}/${route}`, handler); count++; }

console.log(`generated ${count} Pages Function files`);