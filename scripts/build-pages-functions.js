// build-pages-functions.js - Generates CF Pages Function wrappers for MarkCMO
const fs = require('fs');
const path = require('path');

const FN_DIR = 'netlify/functions';
const OUT_ROOT = 'functions';
const EXCLUDE = new Set([]);

// Hand-written native Cloudflare Pages routes (NOT generated from netlify/functions).
// The cleaner must preserve these and the generator must never overwrite them.
// Paths are relative to OUT_ROOT, forward-slash separated.
const NATIVE_ROUTES = new Set([
  'api/daily-content-email.js',
  'api/ig-autopost.js',
  'api/ig-token-refresh.js',
  'api/post-dashboard.js',
  'api/sign-engagement.js',
  'api/amzur-sign.js',
  'api/roc-intake.js',
  // Fractional acquisition funnel - native CF routes (no netlify/functions twin).
  // They import the shared engine/themes/brand libs from functions/_lib. The
  // cleaner MUST preserve them or Stage 1 qualify, Stage 2 intake, the post-call
  // dispatch, and the hosted proposal all go dark on deploy.
  'api/funnel/qualify.js',
  'api/funnel/intake.js',
  'api/funnel/call-recap.js',
  'api/funnel/dispatch.js',
  'api/funnel/proposal.js',
  // Social OAuth (TikTok + Facebook) hosted on the registered markcmo.com domain.
  'connect/tiktok.js',
  'connect/facebook.js',
  'auth/tiktok/callback.js',
  'auth/facebook/callback.js',
]);

const allFns = fs.readdirSync(FN_DIR)
  .filter(f => f.endsWith('.js') && !f.startsWith('_'))
  .map(f => f.replace(/\.js$/, ''))
  .filter(name => !EXCLUDE.has(name))
  .sort();

function generateFile(outRelPath, fnName) {
  if (NATIVE_ROUTES.has(outRelPath.replace(/\\/g, '/').replace(/^functions\//, ''))) {
    return; // never clobber a hand-written native route
  }
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

function cleanEntry(full, rel) {
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(full)) {
      cleanEntry(path.join(full, child), `${rel}/${child}`);
    }
    if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
    return;
  }
  if (NATIVE_ROUTES.has(rel.replace(/\\/g, '/'))) return; // preserve hand-written native route
  fs.rmSync(full, { force: true });
}

function cleanOldFns() {
  if (!fs.existsSync(OUT_ROOT)) return;
  for (const entry of fs.readdirSync(OUT_ROOT)) {
    if (entry === '_lib') continue;
    if (entry === '_middleware.js') continue;
    if (entry === '[[path]].js') continue; // preserve KV catch-all
    cleanEntry(path.join(OUT_ROOT, entry), entry);
  }
}
cleanOldFns();

let count = 0;
for (const name of allFns) { generateFile(`${OUT_ROOT}/api/${name}.js`, name); count++; }

// Dynamic page routes
// Routes listed here get a simple shim that dispatches to the Netlify function.
// Routes listed in HYBRID_PATTERN get a smart template that falls through to
// the KV catch-all when the request has no ?action= API parameter — this lets
// the same path serve both a rendered HTML page AND an API endpoint.
const PATTERN = [
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

// Hybrid routes: serve HTML page from KV when no ?action= param,
// dispatch to API when ?action= is present.
const HYBRID_PATTERN = [
  ['blog/[[path]].js', 'public-blog'],
];
for (const [route, handler] of HYBRID_PATTERN) {
  // Include OUT_ROOT in depth calculation so relative paths resolve correctly
  const segs = `${OUT_ROOT}/${route}`.split('/');
  const depth = segs.length - 2;
  const shimUp = '../'.repeat(depth) || './';
  const netlifyUp = '../'.repeat(depth + 1);
  const hybridTpl = `// AUTO-GENERATED hybrid route: HTML page from KV, API via ?action= param
import { dispatchSingle } from '${shimUp}_lib/netlify-shim.js';
import * as mod from '${netlifyUp}netlify/functions/${handler}.js';
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  // API calls include ?action= — dispatch to the Netlify function handler
  if (url.searchParams.has('action')) {
    return dispatchSingle(mod, context);
  }
  // No action param — serve the HTML page from KV (same logic as root [[path]].js)
  let p = url.pathname;
  if (p.startsWith('/')) p = p.slice(1);
  if (p.endsWith('/')) p = p.slice(0, -1);
  if (p.endsWith('.html')) p = p.slice(0, -5);
  if (!p) p = 'index';
  const kv = env.BLOBS_MARKCMO_PAGES_HTML;
  if (!kv) return new Response('Service unavailable', { status: 503 });
  let html = await kv.get(p, { type: 'text' });
  if (html === null) html = await kv.get(p + '.html', { type: 'text' });
  if (html !== null) {
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  }
  const notFound = await kv.get('404', { type: 'text' });
  return new Response(notFound || '<h1>404 Not Found</h1>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
`;
  fs.mkdirSync(path.dirname(`${OUT_ROOT}/${route}`), { recursive: true });
  fs.writeFileSync(`${OUT_ROOT}/${route}`, hybridTpl);
  count++;
}

// Root catch-all (functions/[[path]].js) is MANUALLY MAINTAINED in git.
// It contains schema injection, entity markup, SPA fallbacks, Netlify compat,
// and context.next() static asset fallthrough. Do NOT overwrite it here.
// If it is missing for some reason, write a minimal emergency fallback.
if (!fs.existsSync(`${OUT_ROOT}/[[path]].js`)) {
  const emergencyCatchAll = `// EMERGENCY fallback catch-all — real version is in git at functions/[[path]].js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  let p = url.pathname;
  if (p.startsWith('/')) p = p.slice(1);
  if (p.endsWith('/')) p = p.slice(0, -1);
  if (p.endsWith('.html')) p = p.slice(0, -5);
  if (!p) p = 'index';
  const kv = env.BLOBS_MARKCMO_PAGES_HTML;
  if (!kv) return new Response('Service unavailable', { status: 503 });
  let html = await kv.get(p, { type: 'text' });
  if (html === null) html = await kv.get(p + '.html', { type: 'text' });
  if (html !== null) {
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  }
  const staticResponse = await context.next();
  if (staticResponse.status !== 404) return staticResponse;
  const notFound = await kv.get('404', { type: 'text' });
  return new Response(notFound || '<h1>404 Not Found</h1>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
`;
  fs.writeFileSync(`${OUT_ROOT}/[[path]].js`, emergencyCatchAll);
  console.warn('WARNING: functions/[[path]].js was missing — wrote emergency fallback. Restore from git.');
}
count++;

console.log(`generated ${count} Pages Function files`);