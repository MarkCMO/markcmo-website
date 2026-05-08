#!/usr/bin/env python3
"""
inject-faq.py
Adds an FAQ section with 6 common fractional CMO/COO questions to root-level
city/service pages.

Insertion strategy:
  - Pages WITH sp-final-cta: insert after sp-guarantee, before sp-final-cta
  - Pages WITHOUT sp-final-cta: insert after sp-guarantee, before <footer>

Run from repo root:
  python scripts/inject-faq.py [--dry-run]
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

ALREADY_RE = re.compile(r'class="sp-faq"', re.IGNORECASE)
HAS_GUARANTEE_RE = re.compile(r'class="sp-guarantee"', re.IGNORECASE)

# Pattern 1: after sp-guarantee closing div, before sp-final-cta
# The guarantee section ends with </div>\n\n and then sp-final-cta starts
ANCHOR_CTA_RE = re.compile(
    r'(</div>\s*\n\s*\n\s*)(<div\s+class="sp-final-cta")',
    re.IGNORECASE
)

# Pattern 2: after guarantee closing wrapper div, before <footer>
# The no-cta pages wrap deliverables in a padding div, closing </div>\n\n<footer>
ANCHOR_FOOTER_RE = re.compile(
    r'(</div>\s*\n\s*\n\s*)(<footer)',
    re.IGNORECASE
)

FAQ_HTML = """\
<div class="sp-faq" style="padding:0 6vw;max-width:1200px;margin:0 auto 2rem;">
<h2>Frequently Asked Questions</h2>
<div class="sp-faq-item">
<p class="sp-faq-q">What exactly does a fractional CMO do?</p>
<p class="sp-faq-a">A fractional CMO is a senior marketing executive who embeds in your company part-time -- typically 2-3 days per week -- and operates as your chief marketing officer without the cost of a full-time hire. They own your entire marketing function: strategy, team leadership, budget oversight, agency management, and board-level reporting. The difference from a consultant is accountability. A fractional CMO is on the hook for pipeline and revenue outcomes, not just deliverables.</p>
</div>
<div class="sp-faq-item">
<p class="sp-faq-q">How much does a fractional CMO cost?</p>
<p class="sp-faq-a">Fractional CMO pricing typically ranges from $8,000 to $25,000 per month depending on scope, company stage, and time commitment. This compares to $250,000 to $400,000 per year fully-loaded for a full-time CMO hire -- without the recruiting fees, equity dilution, or severance risk. Most MarkCMO engagements start with a discovery sprint and are structured on a month-to-month basis with no long-term contracts required.</p>
</div>
<div class="sp-faq-item">
<p class="sp-faq-q">How quickly will I see results?</p>
<p class="sp-faq-a">Most engagements produce measurable outputs within 30 days: a GTM strategy document, ICP definition, messaging architecture, and a demand generation plan. Pipeline movement typically appears in 60-90 days as campaigns launch and outbound sequences activate. Long-term compounding results -- organic traffic, brand authority, and revenue attribution clarity -- build over 6-12 months. We do not promise overnight miracles; we promise a disciplined system that compounds.</p>
</div>
<div class="sp-faq-item">
<p class="sp-faq-q">Do I have to sign a long-term contract?</p>
<p class="sp-faq-a">No. Every MarkCMO engagement is month-to-month. There are no long-term contracts, no cancellation fees, and no lock-in clauses. You stay because the results justify it -- not because you are contractually obligated. We offer a free GTM diagnostic before you commit to any paid engagement so you can validate fit before spending a dollar.</p>
</div>
<div class="sp-faq-item">
<p class="sp-faq-q">What is the difference between a fractional CMO and a marketing consultant?</p>
<p class="sp-faq-a">A consultant delivers advice and leaves. A fractional CMO executes. They show up weekly, run your marketing standup, manage your agencies, approve campaign creative, and own the relationship with your board. They have skin in the game on your revenue numbers. Most consultants hand you a deck and disappear. A fractional CMO is accountable for what happens after the deck.</p>
</div>
<div class="sp-faq-item">
<p class="sp-faq-q">How does the engagement start?</p>
<p class="sp-faq-a">Step one is a free 30-minute GTM diagnostic call. We review your current marketing situation, revenue goals, team structure, and the biggest gap between where you are and where you need to be. If there is a clear fit, we outline a 30-60-90 day plan and agree on scope. Most engagements are live within 5-7 business days of the diagnostic call.</p>
</div>
</div>

"""

def inject_faq(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    # Must have guarantee section (means deliverables were already added)
    if not HAS_GUARANTEE_RE.search(html):
        return False
    # Skip already done
    if ALREADY_RE.search(html):
        return False

    # Try inserting before sp-final-cta first
    if ANCHOR_CTA_RE.search(html):
        new_html = ANCHOR_CTA_RE.sub(
            r'\1' + FAQ_HTML + r'\2',
            html,
            count=1
        )
    elif ANCHOR_FOOTER_RE.search(html):
        new_html = ANCHOR_FOOTER_RE.sub(
            r'\1' + FAQ_HTML + r'\2',
            html,
            count=1
        )
    else:
        return False

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
            if inject_faq(entry.path):
                updated += 1
                if DRY_RUN:
                    print(f'[DRY] Would inject FAQ: {entry.name}')
            else:
                skipped += 1
    return updated, skipped


if __name__ == '__main__':
    print(f'Running in {"DRY-RUN" if DRY_RUN else "LIVE"} mode...')
    updated, skipped = walk()
    print(f'Injected FAQ: {updated}  |  Skipped/no-guarantee/already-done: {skipped}')
    if DRY_RUN:
        print('Re-run without --dry-run to apply changes.')
