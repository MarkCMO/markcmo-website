#!/usr/bin/env python3
"""
inject-cta-closer.py
Adds a bold booking CTA panel immediately before <footer> on pages that
have FAQ sections but no sp-final-cta block.

Run from repo root:
  python scripts/inject-cta-closer.py [--dry-run]
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY_RUN = '--dry-run' in sys.argv

SKIP_DIRS = {
    'admin','documents','forms','sign','node_modules','netlify',
    'pdfs','scripts','.git','.claude','assets','courses',
    'magnet','portal','blog-staging','compare','guides','links',
    'components',
}
SKIP_FILES = {
    'index.html','admin.html','admin-c7x9k2m.html',
    '404.html','access-required.html','book.html','about.html',
    'services.html','results.html','blog.html','magnet-framework.html',
    'wetyr-film.html','wetyr-films.html',
}

HAS_FAQ_RE    = re.compile(r'class="sp-faq"', re.IGNORECASE)
HAS_CTA_RE    = re.compile(r'class="sp-final-cta"', re.IGNORECASE)
ALREADY_RE    = re.compile(r'class="sp-cta-closer"', re.IGNORECASE)

CTA_HTML = """\
<div class="sp-cta-closer">
<div class="sp-cta-closer-inner">
<span class="sp-cta-closer-tag">Free 30-Min Diagnostic</span>
<h2>Ready to Build a Marketing Engine That Compounds?</h2>
<p>Book a free GTM diagnostic call. No pitch. No pressure. We review your current situation, identify the single biggest gap in your marketing, and give you a clear path forward -- whether you hire us or not.</p>
<div class="sp-cta-closer-btns">
<a href="/book.html" class="sp-cta-primary">Book Free Strategy Call</a>
<a href="/fractional-cmo.html" class="btn-ghost">Learn About Fractional CMO</a>
</div>
<div class="sp-cta-closer-trust">
<span>&#10003; No contract required</span>
<span>&#10003; First results in 30 days</span>
<span>&#10003; 4.9&#9733; rated</span>
<span>&#10003; Month-to-month</span>
</div>
</div>
</div>

"""

def inject_cta(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    # Only for pages with FAQ but no existing CTA
    if not HAS_FAQ_RE.search(html): return False
    if HAS_CTA_RE.search(html): return False
    if ALREADY_RE.search(html): return False

    footer_idx = html.rfind('<footer')
    if footer_idx < 0: return False

    new_html = html[:footer_idx] + CTA_HTML + html[footer_idx:]
    if not DRY_RUN:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_html)
    return True


def walk():
    updated = 0
    skipped = 0

    # Root pages
    for entry in os.scandir(ROOT):
        if entry.is_dir() and entry.name in SKIP_DIRS: continue
        if entry.is_file() and entry.name.endswith('.html'):
            if entry.name in SKIP_FILES: continue
            if inject_cta(entry.path): updated += 1
            else: skipped += 1

    # Subdirectories (city-pages, location)
    for subdir in ('city-pages', 'location'):
        dirpath = os.path.join(ROOT, subdir)
        if os.path.isdir(dirpath):
            for entry in os.scandir(dirpath):
                if entry.is_file() and entry.name.endswith('.html'):
                    if inject_cta(entry.path): updated += 1
                    else: skipped += 1

    return updated, skipped


if __name__ == '__main__':
    print(f'Running in {"DRY-RUN" if DRY_RUN else "LIVE"} mode...')
    u, s = walk()
    print(f'CTA closer injected: {u}  |  Skipped: {s}')
    if DRY_RUN:
        print('Re-run without --dry-run to apply changes.')
