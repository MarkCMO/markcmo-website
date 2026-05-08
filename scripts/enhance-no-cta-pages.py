#!/usr/bin/env python3
"""
enhance-no-cta-pages.py
Adds deliverables + guarantee sections to root-level pages that have
sp-body / sp-sidebar structure but NO sp-final-cta block.

Inserts before </aside>\n</div>\n<footer> (the closing of sp-body).

Run from repo root:
  python scripts/enhance-no-cta-pages.py [--dry-run]
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

# Pages that already have sp-final-cta handled by enhance-pages.py
HAS_CTA_RE   = re.compile(r'class="sp-final-cta"', re.IGNORECASE)
# Pages already enhanced by this script
ALREADY_RE   = re.compile(r'class="sp-deliverables"', re.IGNORECASE)
# Anchor: end of sidebar → end of sp-body → start of footer
ANCHOR_RE    = re.compile(
    r'(</aside>\s*\n\s*</div>\s*\n\s*)(<footer)',
    re.IGNORECASE
)

DELIVERABLES_HTML = """\
</aside>
</div>

<div style="padding:0 6vw 0;max-width:1200px;margin:0 auto 2rem;">
<div class="sp-deliverables">
<h2>What&#39;s Included in Every Engagement</h2>
<p>No hidden scope. No surprise invoices. Every MarkCMO engagement includes the full fractional executive capability stack from day one.</p>
<div class="sp-deliv-grid">
<div class="sp-deliv-item">
<span class="sp-deliv-icon">&#127919;</span>
<h4>GTM Strategy &amp; ICP Definition</h4>
<p>Full go-to-market strategy, ideal customer profile definition, competitive positioning, and messaging architecture tailored to your market.</p>
</div>
<div class="sp-deliv-item">
<span class="sp-deliv-icon">&#128202;</span>
<h4>Demand Generation Architecture</h4>
<p>Multi-channel pipeline engine -- SEO, content, paid media, email nurture, and outbound -- built as compounding systems, not one-off campaigns.</p>
</div>
<div class="sp-deliv-item">
<span class="sp-deliv-icon">&#128101;</span>
<h4>Team &amp; Agency Leadership</h4>
<p>C-suite management of your marketing team, agency partners, and freelancers with clear accountability and performance benchmarks.</p>
</div>
<div class="sp-deliv-item">
<span class="sp-deliv-icon">&#128200;</span>
<h4>Board-Ready Reporting</h4>
<p>Weekly leadership check-ins, monthly board-ready pipeline reports, and revenue attribution dashboards wired to revenue KPIs.</p>
</div>
<div class="sp-deliv-item">
<span class="sp-deliv-icon">&#128295;</span>
<h4>Marketing Operations &amp; Tech Stack</h4>
<p>CRM configuration, attribution modeling, tech stack optimization, and performance dashboards that replace gut feeling with data.</p>
</div>
<div class="sp-deliv-item">
<span class="sp-deliv-icon">&#128260;</span>
<h4>Month-to-Month Flexibility</h4>
<p>No long-term contracts. No cancellation fees. Engage for as long as it drives results -- exit any time with zero friction.</p>
</div>
</div>
</div>

<div class="sp-guarantee">
<span class="sp-guarantee-badge">Zero Lock-In</span>
<h2>Month-to-Month. No Contracts. No Risk.</h2>
<p>Every MarkCMO engagement is structured to protect you. You stay because the results are compounding -- not because you are locked in.</p>
<div class="sp-guarantee-items">
<div class="sp-guarantee-item"><span>&#10003;</span> No long-term contracts</div>
<div class="sp-guarantee-item"><span>&#10003;</span> No cancellation fees</div>
<div class="sp-guarantee-item"><span>&#10003;</span> First results in 30 days</div>
<div class="sp-guarantee-item"><span>&#10003;</span> Transparent scope and pricing</div>
<div class="sp-guarantee-item"><span>&#10003;</span> Free GTM diagnostic first</div>
<div class="sp-guarantee-item"><span>&#10003;</span> Exit any time, no questions asked</div>
</div>
</div>
</div>

"""

def enhance_file(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    # Skip pages that already have sp-final-cta (handled by enhance-pages.py)
    if HAS_CTA_RE.search(html):
        return False
    # Skip already enhanced
    if ALREADY_RE.search(html):
        return False
    # Need the anchor
    if not ANCHOR_RE.search(html):
        return False

    new_html = ANCHOR_RE.sub(DELIVERABLES_HTML + r'\2', html, count=1)
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
            if enhance_file(entry.path):
                updated += 1
                if DRY_RUN:
                    print(f'[DRY] Would enhance: {entry.name}')
            else:
                skipped += 1
    return updated, skipped


if __name__ == '__main__':
    print(f'Running in {"DRY-RUN" if DRY_RUN else "LIVE"} mode...')
    updated, skipped = walk()
    print(f'Enhanced: {updated}  |  Skipped/no-anchor/already-done: {skipped}')
    if DRY_RUN:
        print('Re-run without --dry-run to apply changes.')
