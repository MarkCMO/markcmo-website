#!/usr/bin/env python3
"""
add-rating-schema.py
Adds AggregateRating and Offer to existing ProfessionalService JSON-LD
schema blocks across all HTML pages.

Adds:
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9",
    "reviewCount": "193", "bestRating": "5", "worstRating": "1" }
  "offers": { "@type": "Offer", "priceRange": "$8,000-$25,000/month",
    "priceCurrency": "USD" }
  "telephone": "+1-321-917-5738"
  "email": "mark@markcmo.com"
  "founder" (already sometimes present)

Skips pages that already have aggregateRating in ProfessionalService schema.

Run from repo root:
  python scripts/add-rating-schema.py [--dry-run]
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
    'magnet','portal','blog-staging','compare','guides','links',
    'components',
}
SKIP_FILES = {
    'index.html','admin.html','admin-c7x9k2m.html',
    '404.html','access-required.html','about.html',
}

SCHEMA_RE = re.compile(
    r'(<script\s+type="application/ld\+json">)(.*?)(</script>)',
    re.DOTALL | re.IGNORECASE
)

RATING = {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "reviewCount": "193",
    "bestRating": "5",
    "worstRating": "1"
}

OFFER = {
    "@type": "Offer",
    "priceRange": "$8,000 - $25,000 per month",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
}

def enrich_schema(schema_obj):
    """Add rating/offer to ProfessionalService, LocalBusiness, or Service schemas."""
    stype = schema_obj.get('@type', '')
    if stype not in ('ProfessionalService', 'LocalBusiness', 'Service',
                     'MarketingService', 'BusinessConsultant',
                     'ProfessionalService'):
        return schema_obj, False

    changed = False

    if 'aggregateRating' not in schema_obj:
        schema_obj['aggregateRating'] = RATING
        changed = True

    if 'offers' not in schema_obj:
        schema_obj['offers'] = OFFER
        changed = True

    if 'telephone' not in schema_obj:
        schema_obj['telephone'] = '+1-321-917-5738'
        changed = True

    if 'email' not in schema_obj:
        schema_obj['email'] = 'mark@markcmo.com'
        changed = True

    return schema_obj, changed


def process_file(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    file_changed = False
    new_html = html

    def replace_schema(m):
        nonlocal file_changed
        open_tag, body, close_tag = m.group(1), m.group(2), m.group(3)
        try:
            obj = json.loads(body)
        except json.JSONDecodeError:
            return m.group(0)  # leave untouched

        obj, changed = enrich_schema(obj)
        if not changed:
            return m.group(0)

        file_changed = True
        new_body = '\n' + json.dumps(obj, indent=2) + '\n'
        return open_tag + new_body + close_tag

    new_html = SCHEMA_RE.sub(replace_schema, html)

    if file_changed and not DRY_RUN:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_html)

    return file_changed


def walk():
    updated = 0
    skipped = 0

    # Root pages
    for entry in os.scandir(ROOT):
        if entry.is_dir() and entry.name in SKIP_DIRS: continue
        if entry.is_file() and entry.name.endswith('.html'):
            if entry.name in SKIP_FILES: continue
            if process_file(entry.path): updated += 1
            else: skipped += 1

    # Subdirectories
    for subdir in ('city-pages', 'location'):
        dirpath = os.path.join(ROOT, subdir)
        if os.path.isdir(dirpath):
            for entry in os.scandir(dirpath):
                if entry.is_file() and entry.name.endswith('.html'):
                    if process_file(entry.path): updated += 1
                    else: skipped += 1

    return updated, skipped


if __name__ == '__main__':
    print(f'Running in {"DRY-RUN" if DRY_RUN else "LIVE"} mode...')
    u, s = walk()
    print(f'Schema enriched: {u}  |  Skipped: {s}')
    if DRY_RUN:
        print('Re-run without --dry-run to apply changes.')
