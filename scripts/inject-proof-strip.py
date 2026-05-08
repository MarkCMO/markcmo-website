#!/usr/bin/env python3
"""
inject-proof-strip.py
Injects a social-proof strip between the hero section and sp-body on root-level
city/service pages.  Looks for the pattern:

    </section>          ← end of sp-hero
    <div class="sp-body">   ← start of content body

and inserts the proof strip HTML between them.

Run from repo root:
  python scripts/inject-proof-strip.py [--dry-run]
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY_RUN = '--dry-run' in sys.argv

SKIP_DIRS = {
    'admin','documents','forms','sign','node_modules','netlify',
    'pdfs','scripts','.git','.claude','assets','courses',
    'city-pages','location','magnet','portal','blog-staging',
    'fractional-cmo','fractional-coo','compare','guides','links',
    'components',
}
SKIP_FILES = {
    'index.html','admin.html','admin-c7x9k2m.html',
    '404.html','access-required.html','book.html','about.html',
    'services.html','results.html','blog.html','magnet-framework.html',
    'wetyr-film.html','wetyr-films.html',
}

# Anchor: end of hero section immediately followed by sp-body div
# Handles optional whitespace / newlines between them
ANCHOR_RE = re.compile(
    r'(</section>\s*\n)(\s*<div\s+class="sp-body")',
    re.IGNORECASE
)
ALREADY_RE = re.compile(r'class="sp-proof-strip"', re.IGNORECASE)

PROOF_STRIP = """\
<div class="sp-proof-strip">
<div class="sp-proof-item">
<span class="sp-proof-num">4.9&#9733;</span>
<span class="sp-proof-label">193 Reviews</span>
</div>
<div class="sp-proof-item">
<span class="sp-proof-num">90%</span>
<span class="sp-proof-label">Retention Rate</span>
</div>
<div class="sp-proof-item">
<span class="sp-proof-num">19+</span>
<span class="sp-proof-label">Ventures Built</span>
</div>
<div class="sp-proof-item">
<span class="sp-proof-num">$50M+</span>
<span class="sp-proof-label">Revenue Generated</span>
</div>
<div class="sp-proof-item">
<span class="sp-proof-num">30</span>
<span class="sp-proof-label">Days to First Results</span>
</div>
</div>
"""

def inject_file(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    if not ANCHOR_RE.search(html):
        return False
    if ALREADY_RE.search(html):
        return False

    new_html = ANCHOR_RE.sub(
        r'\1' + PROOF_STRIP + r'\2',
        html,
        count=1
    )

    if new_html == html:
        return False

    if not DRY_RUN:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_html)
    return True


def walk():
    updated = 0
    skipped = 0
    for entry in os.scandir(ROOT):
        if entry.is_dir() and entry.name in SKIP_DIRS:
            continue
        if entry.is_file() and entry.name.endswith('.html'):
            if entry.name in SKIP_FILES:
                continue
            if inject_file(entry.path):
                updated += 1
                if DRY_RUN:
                    print(f'[DRY] Would inject: {entry.name}')
            else:
                skipped += 1
    return updated, skipped


if __name__ == '__main__':
    print(f'Running in {"DRY-RUN" if DRY_RUN else "LIVE"} mode...')
    updated, skipped = walk()
    print(f'Injected: {updated}  |  No anchor / already done: {skipped}')
    if DRY_RUN:
        print('Re-run without --dry-run to apply changes.')
