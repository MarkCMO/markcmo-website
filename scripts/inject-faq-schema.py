#!/usr/bin/env python3
"""
inject-faq-schema.py
Adds FAQPage JSON-LD schema to pages that have the sp-faq class.
Inserts the <script type="application/ld+json"> block inside <head>,
right before </head>.

Run from repo root:
  python scripts/inject-faq-schema.py [--dry-run]
"""

import os
import re
import sys
import json

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
ALREADY_RE    = re.compile(r'"@type"\s*:\s*"FAQPage"', re.IGNORECASE)
HEAD_CLOSE_RE = re.compile(r'(</head>)', re.IGNORECASE)

# The 6 Q&A pairs injected by inject-faq.py
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

def build_schema():
    entities = []
    for q, a in FAQ_PAIRS:
        entities.append({
            "@type": "Question",
            "name": q,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": a
            }
        })
    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": entities
    }
    return '<script type="application/ld+json">\n' + json.dumps(schema, indent=2) + '\n</script>\n'

SCHEMA_BLOCK = build_schema()

def inject_schema(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    if not HAS_FAQ_RE.search(html):
        return False
    if ALREADY_RE.search(html):
        return False
    if not HEAD_CLOSE_RE.search(html):
        return False

    new_html = HEAD_CLOSE_RE.sub(SCHEMA_BLOCK + r'\1', html, count=1)
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
            if inject_schema(entry.path):
                updated += 1
                if DRY_RUN:
                    print(f'[DRY] Would add schema: {entry.name}')
            else:
                skipped += 1
    return updated, skipped


if __name__ == '__main__':
    print(f'Running in {"DRY-RUN" if DRY_RUN else "LIVE"} mode...')
    updated, skipped = walk()
    print(f'Schema added: {updated}  |  Skipped: {skipped}')
    if DRY_RUN:
        print('Re-run without --dry-run to apply changes.')
