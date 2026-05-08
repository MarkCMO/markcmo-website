#!/usr/bin/env python3
"""
inject-process-steps.py
Adds a "How It Works" 4-step process section immediately before the
comparison table (.sp-compare) on all enhanced root + subdirectory pages.

Run from repo root:
  python scripts/inject-process-steps.py [--dry-run]
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

HAS_COMPARE_RE = re.compile(r'class="sp-compare"', re.IGNORECASE)
ALREADY_RE     = re.compile(r'class="sp-process"', re.IGNORECASE)
ANCHOR_RE      = re.compile(r'(<div\s+class="sp-compare")', re.IGNORECASE)

PROCESS_HTML = """\
<div class="sp-process">
<div class="sp-process-inner">
<h2>How It Works</h2>
<p class="sp-process-sub">From first call to compounding results -- here is exactly what the engagement looks like.</p>
<div class="sp-process-steps">
<div class="sp-process-step">
<span class="sp-step-num">01</span>
<span class="sp-step-tag">Days 0-7</span>
<h4>Free GTM Diagnostic</h4>
<p>Book a 30-minute strategy call at no cost. We audit your current marketing, revenue gaps, team structure, and the single biggest lever holding back your growth. You leave with a clear diagnosis before spending a dollar.</p>
</div>
<div class="sp-process-step">
<span class="sp-step-num">02</span>
<span class="sp-step-tag">Days 1-30</span>
<h4>Strategy Sprint</h4>
<p>We deliver your full GTM strategy, ICP definition, competitive positioning, messaging architecture, and a 90-day demand generation plan. Every deliverable is board-presentable and execution-ready from day one.</p>
</div>
<div class="sp-process-step">
<span class="sp-step-num">03</span>
<span class="sp-step-tag">Days 30-90</span>
<h4>Execute &amp; Launch</h4>
<p>Campaigns go live. We manage your marketing team, agencies, and freelancers with clear KPIs at every level. Outbound sequences launch. Pipeline starts building. You get weekly check-ins and monthly board-ready reports.</p>
</div>
<div class="sp-process-step">
<span class="sp-step-num">04</span>
<span class="sp-step-tag">Day 90+</span>
<h4>Scale &amp; Compound</h4>
<p>Systems compound. Revenue attribution is wired to real numbers. The marketing engine runs without you managing every detail. You stay because the results justify it -- not because you are locked in.</p>
</div>
</div>
</div>
</div>

"""

def inject_process(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()
    if not HAS_COMPARE_RE.search(html): return False
    if ALREADY_RE.search(html): return False
    if not ANCHOR_RE.search(html): return False
    new_html = ANCHOR_RE.sub(PROCESS_HTML + r'\1', html, count=1)
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
        if entry.is_dir() and entry.name in SKIP_DIRS:
            continue
        if entry.is_file() and entry.name.endswith('.html'):
            if entry.name in SKIP_FILES: continue
            if inject_process(entry.path):
                updated += 1
            else:
                skipped += 1

    # Subdirectories
    for subdir in ('city-pages', 'location'):
        dirpath = os.path.join(ROOT, subdir)
        if os.path.isdir(dirpath):
            for entry in os.scandir(dirpath):
                if entry.is_file() and entry.name.endswith('.html'):
                    if inject_process(entry.path):
                        updated += 1
                    else:
                        skipped += 1

    return updated, skipped


if __name__ == '__main__':
    print(f'Running in {"DRY-RUN" if DRY_RUN else "LIVE"} mode...')
    updated, skipped = walk()
    print(f'Process steps injected: {updated}  |  Skipped: {skipped}')
    if DRY_RUN:
        print('Re-run without --dry-run to apply changes.')
