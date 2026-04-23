#!/usr/bin/env python3
"""
GitHub Actions deep-scrape worker for the markcmo.com film rolodex.

Pulls the live company list from /film-rolodex (admin-gated GET), deep-crawls
each company website's About / Team / Leadership / Contact / Press pages,
regex-extracts emails / phones / "Name - Title" personnel rows / italicised
production credits, then POSTs the harvested rows back to the rolodex via
/film-rolodex-import.

Authenticates with the same admin user/pass as the rolodex UI - NO Netlify
token needed. Polite scraping baked in (1.5s delay between companies, real
User-Agent, robots.txt respected via path-allowlist only).
"""

from __future__ import annotations

import csv
import io
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlsplit

import requests

BASE        = os.environ.get('MARKCMO_BASE_URL', 'https://markcmo.com').rstrip('/')
USER        = os.environ.get('MARKCMO_ADMIN_USER', '').strip()
PASSWORD    = os.environ.get('MARKCMO_ADMIN_PASSWORD', '').strip()
LIMIT       = int(os.environ.get('SCRAPE_LIMIT') or 0) or None
ONLY_SUB    = (os.environ.get('SCRAPE_ONLY') or '').strip().lower()

UA          = 'WETYR-FilmIntel/1.0 (+mailto:info@wetyr.com)'
PATHS       = ['/', '/about', '/about-us', '/team', '/leadership', '/contact', '/press', '/news', '/films', '/work', '/slate']
PER_PAGE_TIMEOUT = 8       # seconds for a single page fetch
PER_COMPANY_DELAY = 1.0    # seconds between companies (politeness)
PER_PAGE_PARALLEL = 4      # parallel page fetches per company
MAX_BYTES_PER_PAGE = 250_000

EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b')
OBFUS_RE = re.compile(
    r'\b([A-Za-z0-9._%+\-]+)\s*(?:\[at\]|\(at\)|\{at\}|\s+at\s+)\s*([A-Za-z0-9.\-]+)\s*(?:\[dot\]|\(dot\)|\.|\s+dot\s+)\s*([A-Za-z]{2,})\b',
    re.IGNORECASE,
)
PHONE_RE = re.compile(
    r'(?:(?:\+?1[\s.\-]?)?(?:\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4})|(?:\+?\d{1,3}[\s.\-]\d{1,4}[\s.\-]\d{3,4}[\s.\-]\d{3,4})'
)
NAME_TITLE_RE = re.compile(
    r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z\'.\-]+){1,3})\s*[,\-\u2013\u2014]\s*'
    r'(Co-?Founder|Founder|President|Chair(?:man|woman|person)?|CEO|COO|CFO|CTO|CMO|'
    r'(?:Senior|Executive|VP|Vice President|EVP|SVP|Managing|General|Creative|Production|Development|Marketing|Sales|Acquisitions|Distribution|Publicity|Press)\s+'
    r'(?:Director|Producer|Partner|Executive|Manager|Officer|Counsel|Lead)?'
    r'|Director|Producer|Partner|Manager|Counsel|Agent|Publicist|Casting Director|Cinematographer|Music Supervisor|Editor)\b'
)
TITLE_QUOTE_RE = re.compile(r'(?:["\u201c]|<i>|<em>)([A-Z][^"\u201d<]{2,80})(?:["\u201d]|</i>|</em>)')

BAD_EMAIL_HOSTS = {
    'wixstatic.com', 'googleusercontent.com', 'cloudfront.net', 'imgix.net',
    'gravatar.com', 'sentry.io', '2x.png', '2x.jpg', '2x.webp', 'amazonaws.com',
}
BAD_EMAIL_LOCALS = {'noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster'}

session = requests.Session()
session.headers['User-Agent'] = UA


# ── helpers ──────────────────────────────────────────────────────────

def login() -> None:
    if not USER or not PASSWORD:
        print('FATAL: MARKCMO_ADMIN_USER / MARKCMO_ADMIN_PASSWORD env vars are required')
        sys.exit(2)
    r = session.post(
        f'{BASE}/.netlify/functions/admin-auth',
        json={'user': USER, 'pass': PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        print(f'FATAL: login failed [{r.status_code}]: {r.text[:200]}')
        sys.exit(2)
    print(f'[auth] signed in as {USER}')


def get_companies() -> list[dict]:
    r = session.get(f'{BASE}/.netlify/functions/film-rolodex', timeout=20)
    r.raise_for_status()
    j = r.json()
    if not j.get('ok'):
        raise RuntimeError(f'rolodex fetch failed: {j}')
    return j.get('companies') or []


def is_useful_email(e: str) -> bool:
    e = e.lower().strip()
    if not e or '@' not in e:
        return False
    local, _, host = e.partition('@')
    if local in BAD_EMAIL_LOCALS:
        return False
    if any(host.endswith(b) for b in BAD_EMAIL_HOSTS):
        return False
    if e.endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif')):
        return False
    return True


def is_useful_phone(p: str) -> bool:
    digits = re.sub(r'\D', '', p)
    if len(digits) < 10 or len(digits) > 15:
        return False
    if digits.startswith(('555', '000', '111', '123')):
        return False
    if digits[-7:] in {'1234567', '7654321', '0000000', '1111111'}:
        return False
    return True


def fetch_page(url: str) -> str | None:
    try:
        r = session.get(url, timeout=PER_PAGE_TIMEOUT, allow_redirects=True)
        if r.status_code != 200:
            return None
        ct = r.headers.get('content-type', '').lower()
        if 'html' not in ct and 'text' not in ct:
            return None
        return r.text[:MAX_BYTES_PER_PAGE]
    except Exception:
        return None


def crawl_company(co: dict) -> dict:
    website = (co.get('website') or '').strip()
    if not website:
        return {'company': co, 'emails': set(), 'phones': set(), 'people': [], 'productions': set(), 'pages': 0}
    base = website.rstrip('/')
    if not base.startswith('http'):
        base = 'https://' + base
    domain = urlsplit(base).netloc.lower().lstrip('www.')

    urls = [base + p for p in PATHS]
    pages: list[str] = []
    with ThreadPoolExecutor(max_workers=PER_PAGE_PARALLEL) as pool:
        futures = {pool.submit(fetch_page, u): u for u in urls}
        for fut in as_completed(futures):
            html = fut.result()
            if html:
                pages.append(html)

    emails: set[str] = set()
    phones: set[str] = set()
    productions: set[str] = set()
    people: list[tuple[str, str]] = []  # (name, title)

    for html in pages:
        for e in EMAIL_RE.findall(html):
            e = e.lower()
            if is_useful_email(e):
                emails.add(e)
        for m in OBFUS_RE.finditer(html):
            local, host, tld = m.group(1), m.group(2), m.group(3)
            e = f'{local.lower()}@{host.lower()}.{tld.lower()}'
            if is_useful_email(e):
                emails.add(e)
        for ph in PHONE_RE.findall(html):
            if is_useful_phone(ph):
                phones.add(ph.strip())
        for nm in NAME_TITLE_RE.finditer(html):
            name, title = nm.group(1).strip(), nm.group(2).strip()
            if 2 <= len(name.split()) <= 4:
                people.append((name, title))
        for tq in TITLE_QUOTE_RE.finditer(html):
            t = tq.group(1).strip()
            if 3 <= len(t) <= 80 and not t.lower().startswith(('http', 'www')):
                productions.add(t)

    # Prefer same-domain emails; if multiple, sort by likely-public ones first
    domain_emails = sorted(e for e in emails if e.endswith('@' + domain))
    other_emails  = sorted(e for e in emails if not e.endswith('@' + domain))

    # Dedupe people (case-insensitive), cap at 25 per company
    seen = {}
    deduped = []
    for n, t in people:
        k = n.lower()
        if k in seen:
            continue
        seen[k] = True
        deduped.append((n, t))
        if len(deduped) >= 25:
            break

    return {
        'company': co,
        'emails': domain_emails + other_emails,
        'phones': sorted(phones),
        'people': deduped,
        'productions': sorted(productions)[:20],
        'pages': len(pages),
        'domain': domain,
    }


# ── CSV builders ─────────────────────────────────────────────────────

def build_companies_csv(crawls: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(['name', 'website', 'email', 'phone', 'tags', 'notes'])
    for cr in crawls:
        co = cr['company']
        primary_email = (cr['emails'] or [None])[0]
        primary_phone = (cr['phones'] or [None])[0]
        prods = cr['productions']
        notes_bits = []
        if prods:
            notes_bits.append('Productions: ' + '; '.join(prods[:8]))
        notes_bits.append(f'[gh-actions deep-scraped {time.strftime("%Y-%m-%d")}]')
        # Only emit a row if we found something new worth merging
        if not (primary_email or primary_phone or prods):
            continue
        w.writerow([
            co.get('name', ''),
            co.get('website', ''),
            primary_email or co.get('email', ''),
            primary_phone or co.get('phone', ''),
            'deep-scraped',
            ' '.join(notes_bits),
        ])
    return buf.getvalue()


def build_people_csv(crawls: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(['name', 'title', 'company', 'email', 'phone', 'notes'])
    for cr in crawls:
        co = cr['company']
        domain = cr['domain']
        domain_emails = [e for e in cr['emails'] if e.endswith('@' + domain)]
        for (name, title) in cr['people']:
            # Try to match a same-domain email by first/last name pattern
            first = name.split()[0].lower()
            last  = name.split()[-1].lower()
            best_email = ''
            for e in domain_emails:
                local = e.split('@')[0].lower()
                if local in {f'{first}.{last}', f'{first[0]}.{last}', f'{first}{last}', first, last, f'{first}{last[0]}'}:
                    best_email = e
                    break
            w.writerow([
                name,
                title,
                co.get('name', ''),
                best_email,
                '',
                f'[gh-actions deep-scraped from {co.get("website","")}]',
            ])
    return buf.getvalue()


# ── importer ─────────────────────────────────────────────────────────

def import_csv(mode: str, csv_text: str) -> dict:
    rows_in_csv = csv_text.count('\n') - 1
    if rows_in_csv <= 0:
        return {'skipped': True, 'reason': 'empty CSV'}
    r = session.post(
        f'{BASE}/.netlify/functions/film-rolodex-import',
        json={'mode': mode, 'csv': csv_text},
        timeout=60,
    )
    try:
        return r.json()
    except Exception:
        return {'ok': False, 'error': f'HTTP {r.status_code}: {r.text[:200]}'}


# ── main ─────────────────────────────────────────────────────────────

def main() -> int:
    login()
    companies = get_companies()
    print(f'[load] {len(companies)} companies in rolodex')

    eligible = [c for c in companies if (c.get('website') and not c.get('_noScrape'))]
    if ONLY_SUB:
        eligible = [c for c in eligible if ONLY_SUB in (c.get('name') or '').lower()]
    if LIMIT:
        eligible = eligible[:LIMIT]
    print(f'[plan] crawling {len(eligible)} eligible companies (limit={LIMIT}, only={ONLY_SUB!r})')

    crawls: list[dict] = []
    t0 = time.time()
    for i, co in enumerate(eligible, 1):
        try:
            r = crawl_company(co)
            crawls.append(r)
            tag = []
            if r['emails']: tag.append(f"{len(r['emails'])}e")
            if r['phones']: tag.append(f"{len(r['phones'])}p")
            if r['people']: tag.append(f"{len(r['people'])}ppl")
            if r['productions']: tag.append(f"{len(r['productions'])}prod")
            print(f'[{i:>3}/{len(eligible)}] {co.get("name","?")[:50]:<50} pages={r["pages"]} {" ".join(tag) or "(nothing)"}')
        except Exception as e:
            print(f'[{i:>3}/{len(eligible)}] {co.get("name","?")[:50]:<50} ERROR {e}')
        time.sleep(PER_COMPANY_DELAY)

    print(f'[crawl] done in {time.time()-t0:.1f}s')

    # Save CSVs as artifacts
    os.makedirs('output', exist_ok=True)
    co_csv = build_companies_csv(crawls)
    pp_csv = build_people_csv(crawls)
    with open('output/companies-deep.csv', 'w', encoding='utf-8') as f: f.write(co_csv)
    with open('output/people-deep.csv',    'w', encoding='utf-8') as f: f.write(pp_csv)
    print(f'[csv] companies: {co_csv.count(chr(10))-1} rows | people: {pp_csv.count(chr(10))-1} rows')

    # Push to rolodex via import endpoint
    co_res = import_csv('companies', co_csv)
    pp_res = import_csv('people',    pp_csv)
    print(f'[import companies] {co_res}')
    print(f'[import people]    {pp_res}')

    if not co_res.get('ok', True) and not co_res.get('skipped'):
        print('FATAL: companies import failed')
        return 1
    if not pp_res.get('ok', True) and not pp_res.get('skipped'):
        print('FATAL: people import failed')
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())
