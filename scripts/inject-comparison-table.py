#!/usr/bin/env python3
"""
inject-comparison-table.py
Adds a MarkCMO vs Alternatives comparison table to root-level pages that
already have FAQ sections. Inserts immediately before the sp-faq div.

The .cmp-table and .cmp-winner CSS classes are already defined in style.css.

Run from repo root:
  python scripts/inject-comparison-table.py [--dry-run]
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

HAS_FAQ_RE    = re.compile(r'class="sp-faq"', re.IGNORECASE)
ALREADY_RE    = re.compile(r'class="sp-compare"', re.IGNORECASE)
# Insert immediately before <div class="sp-faq"
ANCHOR_RE     = re.compile(r'(<div\s+class="sp-faq")', re.IGNORECASE)

TABLE_HTML = """\
<div class="sp-compare" style="padding:0 6vw 2rem;max-width:1200px;margin:0 auto;">
<h2 style="color:#ffffff;margin-bottom:0.5rem;">MarkCMO vs Your Alternatives</h2>
<p style="color:rgba(255,255,255,0.55);font-size:0.88rem;margin-bottom:1.5rem;">How fractional executive leadership stacks up against every other option on the table.</p>
<div class="cmp-table-scroll">
<table class="cmp-table">
<thead>
<tr>
<th style="text-align:left;min-width:180px;">Factor</th>
<th style="background:rgba(201,168,76,0.12);border-top:2px solid #C9A84C;">MarkCMO<br><span style="font-weight:400;font-size:0.75em;opacity:0.8;">Fractional CMO</span></th>
<th>Full-Time CMO<br><span style="font-weight:400;font-size:0.75em;opacity:0.7;">In-House Hire</span></th>
<th>Marketing Agency<br><span style="font-weight:400;font-size:0.75em;opacity:0.7;">Retainer Model</span></th>
<th>Consultant<br><span style="font-weight:400;font-size:0.75em;opacity:0.7;">Independent</span></th>
</tr>
</thead>
<tbody>
<tr class="cmp-winner">
<td>Monthly Cost</td>
<td>$8K-$15K</td>
<td>$22K-$38K+ (salary + benefits + equity)</td>
<td>$8K-$30K (narrow scope)</td>
<td>$5K-$20K (advice only)</td>
</tr>
<tr>
<td>Time to Start</td>
<td style="color:#C9A84C;font-weight:600;">5-7 business days</td>
<td>3-6 months recruiting</td>
<td>2-4 weeks onboarding</td>
<td>1-2 weeks</td>
</tr>
<tr class="cmp-winner">
<td>C-Suite Accountability</td>
<td>Full revenue ownership</td>
<td>Full revenue ownership</td>
<td>Channel-level only</td>
<td>Advice, no accountability</td>
</tr>
<tr>
<td>Commitment Required</td>
<td style="color:#C9A84C;font-weight:600;">Month-to-month</td>
<td>12-24 month salary commitment</td>
<td>3-12 month retainer</td>
<td>Variable, project-based</td>
</tr>
<tr class="cmp-winner">
<td>Board-Ready Reporting</td>
<td>Included every engagement</td>
<td>Depends on hire quality</td>
<td>Rarely included</td>
<td>Not standard</td>
</tr>
<tr>
<td>Team + Agency Leadership</td>
<td style="color:#C9A84C;font-weight:600;">Full C-suite management</td>
<td>Full C-suite management</td>
<td>Self-directed only</td>
<td>Not included</td>
</tr>
<tr class="cmp-winner">
<td>Revenue Attribution</td>
<td>Built-in pipeline dashboards</td>
<td>Varies by hire</td>
<td>Rarely available</td>
<td>Not standard</td>
</tr>
<tr>
<td>Risk if Underperforms</td>
<td style="color:#C9A84C;font-weight:600;">Cancel any time, zero fees</td>
<td>Severance + equity + legal</td>
<td>Contract lock-in</td>
<td>Project walk-away</td>
</tr>
<tr class="cmp-winner">
<td>First Results</td>
<td>30 days (strategy + plan)</td>
<td>90-180 days (ramp time)</td>
<td>60-90 days (campaign build)</td>
<td>30 days (doc delivery)</td>
</tr>
</tbody>
</table>
</div>
</div>

"""

def inject_table(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    if not HAS_FAQ_RE.search(html):
        return False
    if ALREADY_RE.search(html):
        return False
    if not ANCHOR_RE.search(html):
        return False

    new_html = ANCHOR_RE.sub(TABLE_HTML + r'\1', html, count=1)
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
            if inject_table(entry.path):
                updated += 1
                if DRY_RUN:
                    print(f'[DRY] {entry.name}')
            else:
                skipped += 1
    return updated, skipped


if __name__ == '__main__':
    print(f'Running in {"DRY-RUN" if DRY_RUN else "LIVE"} mode...')
    updated, skipped = walk()
    print(f'Table injected: {updated}  |  Skipped: {skipped}')
    if DRY_RUN:
        print('Re-run without --dry-run to apply changes.')
