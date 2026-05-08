#!/usr/bin/env python3
"""
inject-og-tags.py
Adds Open Graph and Twitter Card meta tags to all HTML pages that
don't already have them, using the existing <title> and <meta description>.

Inserts immediately before </head>.

Run from repo root:
  python scripts/inject-og-tags.py [--dry-run]
"""

import os
import re
import sys
import html as html_module

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY_RUN = '--dry-run' in sys.argv

SKIP_DIRS = {
    'admin','documents','forms','sign','node_modules','netlify',
    'pdfs','scripts','.git','.claude','assets','courses',
    'magnet','portal','blog-staging','compare','guides','links',
    'components',
}
SKIP_FILES = {'admin.html','admin-c7x9k2m.html','404.html','access-required.html'}

ALREADY_RE    = re.compile(r'property=["\']og:title["\']', re.IGNORECASE)
TITLE_RE      = re.compile(r'<title>(.*?)</title>', re.DOTALL | re.IGNORECASE)
DESC_RE       = re.compile(
    r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']',
    re.IGNORECASE | re.DOTALL
)
CANONICAL_RE  = re.compile(
    r'<link\s+rel=["\']canonical["\']\s+href=["\'](.*?)["\']',
    re.IGNORECASE
)
HEAD_CLOSE_RE = re.compile(r'(</head>)', re.IGNORECASE)

OG_IMAGE      = 'https://markcmo.com/mark-photo.webp'
TWITTER_HANDLE = '@markgcmo'

def make_og_block(title, description, url, image):
    # Escape for attribute context
    t = html_module.escape(title, quote=True)
    d = html_module.escape(description, quote=True)
    u = html_module.escape(url, quote=True)
    i = html_module.escape(image, quote=True)
    return f'''\
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="MarkCMO"/>
<meta property="og:title" content="{t}"/>
<meta property="og:description" content="{d}"/>
<meta property="og:url" content="{u}"/>
<meta property="og:image" content="{i}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:site" content="{TWITTER_HANDLE}"/>
<meta name="twitter:title" content="{t}"/>
<meta name="twitter:description" content="{d}"/>
<meta name="twitter:image" content="{i}"/>
'''

def process_file(path, base_url='https://markcmo.com'):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        html = f.read()

    if ALREADY_RE.search(html):
        return False
    if not HEAD_CLOSE_RE.search(html):
        return False

    # Extract title
    tm = TITLE_RE.search(html)
    if not tm:
        return False
    title = re.sub(r'\s+', ' ', tm.group(1)).strip()

    # Extract description
    dm = DESC_RE.search(html)
    description = re.sub(r'\s+', ' ', dm.group(1)).strip() if dm else title[:155]

    # Extract canonical URL or build from filename
    cm = CANONICAL_RE.search(html)
    if cm:
        url = cm.group(1).strip()
    else:
        fname = os.path.basename(path)
        url = f'{base_url}/{fname}'

    og_block = make_og_block(title, description, url, OG_IMAGE)

    new_html = HEAD_CLOSE_RE.sub(og_block + r'\1', html, count=1)
    if new_html == html:
        return False

    if not DRY_RUN:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_html)
    return True


def walk():
    updated = 0
    skipped = 0

    # Root
    for entry in os.scandir(ROOT):
        if entry.is_dir() and entry.name in SKIP_DIRS: continue
        if entry.is_file() and entry.name.endswith('.html'):
            if entry.name in SKIP_FILES: continue
            if process_file(entry.path): updated += 1
            else: skipped += 1

    # Subdirectories
    for subdir in ('city-pages', 'location', 'magnet', 'fractional-cmo',
                   'fractional-coo', 'compare', 'guides'):
        dirpath = os.path.join(ROOT, subdir)
        if os.path.isdir(dirpath):
            for root2, dirs2, files2 in os.walk(dirpath):
                dirs2[:] = [d for d in dirs2 if d not in SKIP_DIRS]
                for fname in files2:
                    if fname.endswith('.html') and fname not in SKIP_FILES:
                        fpath = os.path.join(root2, fname)
                        if process_file(fpath): updated += 1
                        else: skipped += 1

    return updated, skipped


if __name__ == '__main__':
    print(f'Running in {"DRY-RUN" if DRY_RUN else "LIVE"} mode...')
    u, s = walk()
    print(f'OG tags added: {u}  |  Skipped (already have or no title): {s}')
    if DRY_RUN:
        print('Re-run without --dry-run to apply changes.')
