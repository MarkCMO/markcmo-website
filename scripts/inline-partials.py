#!/usr/bin/env python
"""Inline partials/master-*.html into functions/_middleware.js."""
import sys, os

base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(base)

with open('partials/master-nav.html', encoding='utf-8') as f: nav = f.read()
with open('partials/master-footer.html', encoding='utf-8') as f: foot = f.read()
with open('functions/_middleware.js', encoding='utf-8') as f: mw = f.read()

def to_js(s):
    return chr(96) + s.replace(chr(92), chr(92)+chr(92)).replace(chr(96), chr(92)+chr(96)).replace('${', chr(92)+'${') + chr(96)

nav_lit = to_js(nav)
foot_lit = to_js(foot)

start_marker = 'let _navPartial = null;'
end_marker = 'async function getMasterFooter(env) {'
s_idx = mw.find(start_marker)
e_idx_start = mw.find(end_marker)
e_idx_end_brace = mw.find('\n}', e_idx_start)
if s_idx < 0 or e_idx_start < 0 or e_idx_end_brace < 0:
    raise SystemExit('markers not found')

new_block = (
    '// Inlined partials - single source of truth.\n'
    '// To edit nav/footer, modify partials/master-nav.html or master-footer.html\n'
    '// and re-run: python scripts/inline-partials.py\n'
    'const MASTER_NAV_HTML = ' + nav_lit + ';\n\n'
    'const MASTER_FOOTER_HTML = ' + foot_lit + ';\n\n'
    'function getMasterNav() { return MASTER_NAV_HTML; }\n'
    'function getMasterFooter() { return MASTER_FOOTER_HTML; }'
)

mw_new = mw[:s_idx] + new_block + mw[e_idx_end_brace + 2:]
mw_new = mw_new.replace('getMasterNav(env)', 'getMasterNav()')
mw_new = mw_new.replace('getMasterFooter(env)', 'getMasterFooter()')

with open('functions/_middleware.js', 'w', encoding='utf-8') as f:
    f.write(mw_new)

print('inlined nav', len(nav), 'chars + footer', len(foot), 'chars')
print('middleware:', len(mw_new), 'chars')
