#!/usr/bin/env python3
"""
enhance-subdirs-faq.py
Injects FAQ section + FAQPage JSON-LD schema into city-pages/ and location/
pages that already have sp-guarantee but no FAQ yet.

FAQ is inserted right before <footer> (after all sp-body closing tags).

Run from repo root:
  python scripts/enhance-subdirs-faq.py [--dry-run]
"""

import os
import re
import sys
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY_RUN = '--dry-run' in sys.argv

HAS_GUARANTEE_RE = re.compile(r'class="sp-guarantee"', re.IGNORECASE)
ALREADY_FAQ_RE   = re.compile(r'class="sp-faq"', re.IGNORECASE)
ALREADY_SCHEMA_RE = re.compile(r'"@type"\s*:\s*"FAQPage"', re.IGNORECASE)
HEAD_CLOSE_RE    = re.compile(r'(</head>)', re.IGNORECASE)

FAQ_PAIRS = [
    (
        "What exactly does a fractional CMO do?",
        "A fractional CMO is a senior marketing executive who embeds in your company part-time -- typically 2-3 days per week -- and operates as your chief marketing officer without the cost of a full-time hire. They own your entire marketing function: strategy, team leadership, budget oversight, agency management, and board-level reporting. The difference from a consultant is accountability. A fractional CMO is on the hook for pipeline and revenue outcomes, not just deliverables."
    ),
    (
        "How much does a fractional CMO cost?",
        "Fractional CMO pricing typically ranges from $8,000 to $25,000 per month depending on scope, company stage, and time commitment. This compares to $250,000 to $400,000 per year fully-loaded for a full-time CMO hire -- without the recruiting fees, equity dilution, or severance risk. Most MarkCMO engagements start with a discovery sprint and are structured on a month-to-month basis with no long-term contracts required."
    ),
    (
        "How quickly will I see results?",
        "Most engagements produce measurable outputs within 30 days: a GTM strategy document, ICP definition, messaging architecture, and a demand generation plan. Pipeline movement typically appears in 60-90 days as campaigns launch and outbound sequences activate. Long-term compounding results -- organic traffic, brand authority, and revenue attribution clarity -- build over 6-12 months."
    ),
    (
        "Do I have to sign a long-term contract?",
        "No. Every MarkCMO engagement is month-to-month. There are no long-term contracts, no cancellation fees, and no lock-in clauses. You stay because the results justify it -- not because you are contractually obligated. We offer a free GTM diagnostic before you commit to any paid engagement so you can validate fit before spending a dollar."
    ),
    (
        "What is the difference between a fractional CMO and a marketing consultant?",
        "A consultant delivers advice and leaves. A fractional CMO executes. They show up weekly, run your marketing standup, manage your agencies, approve campaign creative, and own the relationship with your board. They have skin in the game on your revenue numbers. Most consultants hand you a deck and disappear. A fractional CMO is accountable for what happens after the deck."
    ),
    (
        "How does the engagement start?",
        "Step one is a free 30-minute GTM diagnostic call. We review your current marketing situation, revenue goals, team structure, and the biggest gap between where you are and where you need to be. If there is a clear fit, we outline a 30-60-90 day plan and agree on scope. Most engagements are live within 5-7 business days of the diagnostic call."
    ),
]

FAQ_HTML = """\
<div class="sp-faq" style="padding:3rem 6vw;max-width:1200px;margin:0 auto;">
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
<p class="sp-faq-a">Most engagements produce measurable outputs within 30 days: a GTM strategy document, ICP definition, messaging architecture, and a demand generation plan. Pipeline movement typically appears in 60-90 days as campaigns launch and outbound sequences activate. Long-term compounding results -- organic traffic, brand authority, and revenue attribution clarity -- build over 6-12 months.</p>
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

def build_schema():
    entities = []
    for q, a in FAQ_PAIRS:
        entities.append({
            "@type": "Question",
            "name": q,
            "acceptedAnswer": {"@type": "Answer", "text": a}
        })
    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": entities
    }
    return '<script type="application/ld+json">\n' + json.dumps(schema, indent=2) + '\n</script>\n'

SCHEMA_BLOCK = build_schema()


def enhance_file(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    changed = False

    # --- inject FAQ HTML before <footer> ---
    if HAS_GUARANTEE_RE.search(html) and not ALREADY_FAQ_RE.search(html):
        footer_idx = html.rfind('<footer')
        if footer_idx > 0:
            html = html[:footer_idx] + FAQ_HTML + '\n' + html[footer_idx:]
            changed = True

    # --- inject FAQPage schema into <head> ---
    if not ALREADY_SCHEMA_RE.search(html) and ALREADY_FAQ_RE.search(html):
        if HEAD_CLOSE_RE.search(html):
            html = HEAD_CLOSE_RE.sub(SCHEMA_BLOCK + r'\1', html, count=1)
            changed = True

    if changed and not DRY_RUN:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)
    return changed


def walk():
    city_updated = loc_updated = 0

    for subdir, label in [('city-pages', 'city'), ('location', 'loc')]:
        dirpath = os.path.join(ROOT, subdir)
        for entry in os.scandir(dirpath):
            if entry.is_file() and entry.name.endswith('.html'):
                if enhance_file(entry.path):
                    if label == 'city':
                        city_updated += 1
                    else:
                        loc_updated += 1
                    if DRY_RUN:
                        print(f'[DRY] {subdir}/{entry.name}')

    return city_updated, loc_updated


if __name__ == '__main__':
    print(f'Running in {"DRY-RUN" if DRY_RUN else "LIVE"} mode...')
    cu, lu = walk()
    print(f'city-pages enhanced: {cu}')
    print(f'location enhanced:   {lu}')
    if DRY_RUN:
        print('Re-run without --dry-run to apply changes.')
