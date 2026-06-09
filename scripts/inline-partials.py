#!/usr/bin/env python
"""Re-inline partials/master-*.html into functions/_middleware.js.

Updates the existing MASTER_NAV_HTML and MASTER_FOOTER_HTML constants.
Run after editing either partial file.
"""
import os, re

base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(base)

with open('partials/master-nav.html', encoding='utf-8') as f: nav = f.read()
with open('partials/master-footer.html', encoding='utf-8') as f: foot = f.read()
with open('functions/_middleware.js', encoding='utf-8') as f: mw = f.read()


def to_js(s):
    BT = chr(96)  # backtick
    BS = chr(92)  # backslash
    return BT + s.replace(BS, BS + BS).replace(BT, BS + BT).replace('${', BS + '${') + BT


nav_lit = to_js(nav)
foot_lit = to_js(foot)

# Replace MASTER_NAV_HTML constant
m_nav = re.search(r'const MASTER_NAV_HTML = `', mw)
if not m_nav:
    raise SystemExit('MASTER_NAV_HTML marker not found')
# Find the matching closing backtick (accounting for nested backticks via JS escapes)
start = m_nav.end() - 1  # position of opening backtick
depth = 0
i = start + 1
while i < len(mw):
    c = mw[i]
    if c == chr(92) and i + 1 < len(mw):
        i += 2  # skip escaped char
        continue
    if c == chr(96):
        break
    i += 1
nav_end = i  # position of closing backtick
mw = mw[:start] + nav_lit + mw[nav_end + 1:]

# Replace MASTER_FOOTER_HTML constant
m_foot = re.search(r'const MASTER_FOOTER_HTML = `', mw)
if not m_foot:
    raise SystemExit('MASTER_FOOTER_HTML marker not found')
start = m_foot.end() - 1
i = start + 1
while i < len(mw):
    c = mw[i]
    if c == chr(92) and i + 1 < len(mw):
        i += 2
        continue
    if c == chr(96):
        break
    i += 1
foot_end = i
mw = mw[:start] + foot_lit + mw[foot_end + 1:]

with open('functions/_middleware.js', 'w', encoding='utf-8') as f:
    f.write(mw)
print('inlined nav', len(nav), 'chars + footer', len(foot), 'chars')
print('middleware:', len(mw), 'chars')
