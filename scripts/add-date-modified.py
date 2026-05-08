#!/usr/bin/env python3
"""
add-date-modified.py
Adds dateModified / datePublished to all JSON-LD schema blocks to signal
content freshness to Google and LLMs.

Run from repo root:
  python scripts/add-date-modified.py [--dry-run]
"""

import os
import re
import sys
import json
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY_RUN = '--dry-run' in sys.argv

TODAY = date.today().isoformat()  # e.g. "2026-05-08"

SKIP_DIRS = {
    'admin','documents','forms','sign','node_modules','netlify',
    'pdfs','scripts','.git','.claude','assets','courses',
    'magnet','portal','blog-staging','compare','guides','links',
    'components',
}
SKIP_FILES = {'admin.html','admin-c7x9k2m.html','404.html'}

SCHEMA_RE = re.compile(
    r'(<script\s+type="application/ld\+json">)(.*?)(</script>)',
    re.DOTALL | re.IGNORECASE
)

# Types that should have dateModified
DATE_TYPES = {
    'ProfessionalService', 'LocalBusiness', 'Service',
    'WebPage', 'Article', 'BlogPosting', 'FAQPage',
    'MarketingService', 'BusinessConsultant',
}

def enrich(schema_obj):
    stype = schema_obj.get('@type', '')
    if stype not in DATE_TYPES:
        return schema_obj, False

    changed = False
    if 'dateModified' not in schema_obj:
        schema_obj['dateModified'] = TODAY
        changed = True
    if 'datePublished' not in schema_obj and stype in ('Article', 'BlogPosting', 'WebPage'):
        schema_obj['datePublished'] = TODAY
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
            return m.group(0)

        # Handle both single object and array of objects
        if isinstance(obj, list):
            new_list = []
            any_changed = False
            for item in obj:
                if isinstance(item, dict):
                    enriched, ch = enrich(item)
                    new_list.append(enriched)
                    if ch: any_changed = True
                else:
                    new_list.append(item)
            if not any_changed:
                return m.group(0)
            file_changed = True
            return open_tag + '\n' + json.dumps(new_list, indent=2) + '\n' + close_tag
        elif isinstance(obj, dict):
            obj, changed = enrich(obj)
            if not changed:
                return m.group(0)
            file_changed = True
            return open_tag + '\n' + json.dumps(obj, indent=2) + '\n' + close_tag
        else:
            return m.group(0)

    new_html = SCHEMA_RE.sub(replace_schema, html)
    if file_changed and not DRY_RUN:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_html)
    return file_changed


def walk():
    updated = 0
    skipped = 0

    for entry in os.scandir(ROOT):
        if entry.is_dir() and entry.name in SKIP_DIRS: continue
        if entry.is_file() and entry.name.endswith('.html'):
            if entry.name in SKIP_FILES: continue
            if process_file(entry.path): updated += 1
            else: skipped += 1

    for subdir in ('city-pages', 'location', 'fractional-cmo',
                   'fractional-coo', 'compare', 'guides'):
        dirpath = os.path.join(ROOT, subdir)
        if os.path.isdir(dirpath):
            for root2, dirs2, files2 in os.walk(dirpath):
                dirs2[:] = [d for d in dirs2 if d not in SKIP_DIRS]
                for fname in files2:
                    if fname.endswith('.html') and fname not in SKIP_FILES:
                        if process_file(os.path.join(root2, fname)):
                            updated += 1
                        else:
                            skipped += 1

    return updated, skipped


if __name__ == '__main__':
    print(f'Running in {"DRY-RUN" if DRY_RUN else "LIVE"} mode...')
    u, s = walk()
    print(f'dateModified added: {u}  |  Skipped: {s}')
    if DRY_RUN:
        print('Re-run without --dry-run to apply changes.')
