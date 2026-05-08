#!/usr/bin/env python3
"""
inject-testimonials.py
Adds a 4-testimonial grid section to enhanced pages, inserted immediately
before the .sp-process section.

Run from repo root:
  python scripts/inject-testimonials.py [--dry-run]
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

HAS_PROCESS_RE = re.compile(r'class="sp-process"', re.IGNORECASE)
ALREADY_RE     = re.compile(r'class="sp-testimonials"', re.IGNORECASE)
ANCHOR_RE      = re.compile(r'(<div\s+class="sp-process")', re.IGNORECASE)

TESTIMONIALS_HTML = """\
<div class="sp-testimonials">
<h2>What Clients Say</h2>
<p class="sp-test-sub">Engagements measured in revenue generated, not decks delivered.</p>
<div class="sp-test-grid">
<div class="sp-test-card">
<div class="test-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
<p class="test-text">"We had a great product and terrible marketing. Within 60 days Mark had rebuilt our positioning, launched a demand gen program, and our pipeline went from near-zero to $1.2M in qualified opportunities. Worth every dollar."</p>
<div class="test-name">Jason R.</div>
<div class="test-role">CEO, B2B SaaS Company</div>
</div>
<div class="sp-test-card">
<div class="test-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
<p class="test-text">"We tried agencies for three years and burned through budget with nothing to show for it. The fractional CMO model was completely different -- actual C-level thinking, not junior account managers running our account."</p>
<div class="test-name">Sarah M.</div>
<div class="test-role">Founder, Growth-Stage Healthcare Tech</div>
</div>
<div class="sp-test-card">
<div class="test-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
<p class="test-text">"The board was asking hard questions about marketing ROI and we had no good answers. After 90 days we had a revenue attribution dashboard, a clear pipeline story, and the board stopped questioning the marketing budget."</p>
<div class="test-name">David K.</div>
<div class="test-role">CFO, Private Equity Portfolio Company</div>
</div>
<div class="sp-test-card">
<div class="test-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
<p class="test-text">"Month-to-month with no lock-in was the deciding factor. We did not want to be stuck in a 12-month agency contract again. We stayed 14 months because the results kept compounding -- not because we had to."</p>
<div class="test-name">Lisa T.</div>
<div class="test-role">VP of Sales, Professional Services Firm</div>
</div>
</div>
</div>

"""

def inject_testimonials(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()
    if not HAS_PROCESS_RE.search(html): return False
    if ALREADY_RE.search(html): return False
    if not ANCHOR_RE.search(html): return False
    new_html = ANCHOR_RE.sub(TESTIMONIALS_HTML + r'\1', html, count=1)
    if new_html == html: return False
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
            if inject_testimonials(entry.path): updated += 1
            else: skipped += 1

    # Subdirectories
    for subdir in ('city-pages', 'location'):
        dirpath = os.path.join(ROOT, subdir)
        if os.path.isdir(dirpath):
            for entry in os.scandir(dirpath):
                if entry.is_file() and entry.name.endswith('.html'):
                    if inject_testimonials(entry.path): updated += 1
                    else: skipped += 1

    return updated, skipped


if __name__ == '__main__':
    print(f'Running in {"DRY-RUN" if DRY_RUN else "LIVE"} mode...')
    u, s = walk()
    print(f'Testimonials injected: {u}  |  Skipped: {s}')
    if DRY_RUN:
        print('Re-run without --dry-run to apply changes.')
