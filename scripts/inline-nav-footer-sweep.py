"""
Replace broken SSI <!--#include virtual="/_nav.html" --> and
<!--#include virtual="/_footer.html" --> directives across all pillar pages
with inline HTML matching the homepage nav + footer structure.

Cloudflare Pages doesn't process Apache/Nginx SSI, so these includes were
rendering as HTML comments (invisible) - leaving pages with no nav menu
and no footer.

This script sweeps all .html files at root + cmo-questions/ subdirectory,
replaces the includes with real inline HTML that matches markcmo.com, and
also fixes the bare breadcrumb to sit inside a navy container.
"""

import glob
import os
import sys

# Inline nav HTML matching markcmo.com homepage exactly.
# Extracted from index.html lines 1670-1702.
NAV_HTML = '''<nav class="nav" id="mainNav">
  <a href="/" class="nav-logo">
    <div class="nav-logo-avatar">
      <img src="/assets/mark-gabrielli.jpg" alt="Mark Gabrielli" onerror="this.parentElement.innerHTML='<span style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-family:Outfit,sans-serif;font-weight:900;font-size:1rem;color:#fff;background:var(--accent)\\'>M</span>'" />
    </div>
    <div class="nav-logo-text">
      <strong>Mark Gabrielli</strong>
      <span>Fractional CMO &amp; COO</span>
    </div>
  </a>
  <ul class="nav-links">
    <li><a href="/about">About</a></li>
    <li><a href="/services">Services</a></li>
    <li><a href="/magnet-framework" style="color:var(--accent);font-weight:600;">MAGNET&trade;</a></li>
    <li><a href="/results">Results</a></li>
    <li><a href="/blog">Insights</a></li>
    <li><a href="https://academy.markcmo.com" target="_blank" style="color:var(--accent);">Academy</a></li>
  </ul>
  <div class="nav-right">
    <a href="/book" class="nav-btn">Book a Free Call</a>
  </div>
  <div class="nav-hamburger" id="navHam"><span></span><span></span><span></span></div>
</nav>

<div class="mobile-drawer" id="mobileDrawer">
  <a href="/about">About</a>
  <a href="/services">Services</a>
  <a href="/magnet-framework" style="color:var(--accent);font-weight:600;">MAGNET Framework&trade;</a>
  <a href="/results">Results</a>
  <a href="/blog">Insights</a>
  <a href="https://academy.markcmo.com" target="_blank">Academy</a>
  <a href="/book" style="color:var(--accent);font-weight:700;">Book a Free Strategy Call &rarr;</a>
</div>

<script>
(function(){
  var nav = document.getElementById('mainNav');
  if (nav) window.addEventListener('scroll', function(){ nav.classList.toggle('scrolled', window.scrollY > 20); });
  var ham = document.getElementById('navHam');
  var drawer = document.getElementById('mobileDrawer');
  if (ham && drawer) {
    ham.addEventListener('click', function(){ drawer.classList.toggle('open'); });
    drawer.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ drawer.classList.remove('open'); }); });
  }
})();
</script>'''

# Inline footer HTML matching markcmo.com homepage exactly.
# Extracted from index.html lines 2824-2921.
FOOTER_HTML = '''<footer>
  <div class="footer-main">
    <div class="footer-brand">
      <div class="footer-logo-text">Mark <span>Gabrielli</span></div>
      <p class="footer-about">Fractional CMO, COO &amp; Executive Consultant. I help businesses from $1M to $100M find what's broken, build what scales, and execute what others only talk about.</p>
      <div class="footer-chips">
        <span class="footer-chip">WETYR Founder</span><span class="footer-chip">Fractional C-Suite</span>
        <span class="footer-chip">AI Strategist</span><span class="footer-chip">CST Certified</span>
      </div>
      <div class="footer-socials">
        <a href="https://www.linkedin.com/in/marklgabrielli/" target="_blank" rel="noopener" class="footer-soc">in</a>
        <a href="mailto:mark@markcmo.com" class="footer-soc">@</a>
      </div>
    </div>
    <div class="footer-col"><h4>C-Suite</h4><ul>
      <li><a href="/fractional-cmo">Fractional CMO</a></li>
      <li><a href="/fractional-coo">Fractional COO</a></li>
      <li><a href="/fractional-ceo">Fractional CEO</a></li>
      <li><a href="/fractional-cto">Fractional CTO</a></li>
      <li><a href="/fractional-cfo">Fractional CFO</a></li>
      <li><a href="/executive-advisory">Executive Advisory</a></li>
      <li><a href="/services">All Services</a></li>
    </ul></div>
    <div class="footer-col"><h4>Marketing</h4><ul>
      <li><a href="/demand-generation">Demand Generation</a></li>
      <li><a href="/lead-generation">Lead Generation</a></li>
      <li><a href="/b2b-marketing">B2B Marketing</a></li>
      <li><a href="/content-marketing">Content Marketing</a></li>
      <li><a href="/email-marketing">Email Marketing</a></li>
      <li><a href="/digital-marketing">Digital Marketing</a></li>
      <li><a href="/social-media-marketing">Social Media</a></li>
      <li><a href="/linkedin-marketing">LinkedIn Marketing</a></li>
      <li><a href="/account-based-marketing">ABM</a></li>
      <li><a href="/go-to-market-strategy">Go-to-Market</a></li>
      <li><a href="/marketing-audit">Marketing Audit</a></li>
      <li><a href="/marketing-strategy">Marketing Strategy</a></li>
    </ul></div>
    <div class="footer-col"><h4>Compare</h4><ul>
      <li><a href="/fractional-cmo-cost">CMO Cost</a></li>
      <li><a href="/compare/fractional-cmo-vs-full-time-cmo/">vs Full-Time CMO</a></li>
      <li><a href="/compare/fractional-cmo-vs-marketing-agency/">vs Agency</a></li>
      <li><a href="/compare/fractional-cmo-vs-vp-of-marketing/">vs VP of Marketing</a></li>
      <li><a href="/compare/fractional-cmo-vs-consultant/">vs Consultant</a></li>
    </ul></div>
    <div class="footer-col"><h4>By Stage</h4><ul>
      <li><a href="/fractional-cmo-pre-revenue">Pre-Revenue</a></li>
      <li><a href="/fractional-cmo-series-a">Series A</a></li>
      <li><a href="/fractional-cmo-series-b">Series B</a></li>
      <li><a href="/fractional-cmo-bootstrapped-companies">Bootstrapped</a></li>
      <li><a href="/best-fractional-cmo">Best Fractional CMO</a></li>
    </ul></div>
    <div class="footer-col"><h4>Industries</h4><ul>
      <li><a href="/fractional-cmo-saas">SaaS</a></li>
      <li><a href="/fractional-cmo-healthcare">Healthcare</a></li>
      <li><a href="/fractional-cmo-fintech">Fintech</a></li>
      <li><a href="/fractional-cmo-ai">AI Companies</a></li>
      <li><a href="/fractional-cmo-b2b">B2B</a></li>
      <li><a href="/industries">All Industries</a></li>
    </ul></div>
    <div class="footer-col"><h4>Learn</h4><ul>
      <li><a href="/magnet-framework" style="color:var(--accent);font-weight:600;">MAGNET Framework&trade;</a></li>
      <li><a href="/blog">Insights &amp; Blog</a></li>
      <li><a href="/about">About Mark</a></li>
      <li><a href="/testimonials">Testimonials</a></li>
      <li><a href="/faq">FAQ</a></li>
      <li><a href="/contact">Contact</a></li>
      <li><a href="https://academy.markcmo.com" target="_blank" style="color:var(--accent);font-weight:600;">Academy</a></li>
    </ul></div>
  </div>
  <div class="footer-bar">
    <span class="footer-copy">&copy; 2026 Mark Gabrielli &middot; markcmo.com &middot; All rights reserved.</span>
    <div class="footer-bar-links">
      <a href="https://www.linkedin.com/in/marklgabrielli/" target="_blank" rel="noopener">LinkedIn</a>
      <a href="https://x.com/markgcmo" target="_blank" rel="noopener">X / Twitter</a>
      <a href="https://medium.com/@mark_louis_gabrielli_jr" target="_blank" rel="noopener">Medium</a>
      <a href="https://www.tiktok.com/@mark.gabrielli.cmo" target="_blank" rel="noopener">TikTok</a>
    </div>
  </div>
</footer>'''

NAV_SSI = '<!--#include virtual="/_nav.html" -->'
FOOTER_SSI = '<!--#include virtual="/_footer.html" -->'

# Old breadcrumb pattern (sits on transparent main with no background container).
# Wrap it in a navy container so it doesn't look like a white bar.
OLD_BREADCRUMB = '<main style="max-width:980px;margin:0 auto;padding:2rem 1.5rem 4rem;">\n\n<nav aria-label="Breadcrumb"'
NEW_BREADCRUMB = '<main style="max-width:980px;margin:0 auto;padding:6rem 1.5rem 4rem;">\n\n<nav aria-label="Breadcrumb"'


def process_file(fn):
    try:
        content = open(fn, encoding='utf-8').read()
    except Exception as e:
        return f'READ_ERROR: {e}'

    original = content
    swaps = 0

    if NAV_SSI in content:
        content = content.replace(NAV_SSI, NAV_HTML)
        swaps += 1
    if FOOTER_SSI in content:
        content = content.replace(FOOTER_SSI, FOOTER_HTML)
        swaps += 1
    # Fix main padding so content sits below the fixed nav
    if OLD_BREADCRUMB in content:
        content = content.replace(OLD_BREADCRUMB, NEW_BREADCRUMB)
        swaps += 1

    if content != original:
        try:
            open(fn, 'w', encoding='utf-8').write(content)
            return f'OK: {swaps} swaps'
        except Exception as e:
            return f'WRITE_ERROR: {e}'
    return 'NO_CHANGE'


def main():
    files = []
    for fn in glob.glob('*.html'):
        files.append(fn)
    for fn in glob.glob('cmo-questions/*.html'):
        files.append(fn)

    stats = {'ok': 0, 'no_change': 0, 'error': 0, 'total_swaps': 0}
    for fn in files:
        result = process_file(fn)
        if result.startswith('OK'):
            stats['ok'] += 1
            try:
                stats['total_swaps'] += int(result.split(':')[1].split()[0])
            except:
                pass
        elif result == 'NO_CHANGE':
            stats['no_change'] += 1
        else:
            stats['error'] += 1
            print(f'  {fn}: {result}', file=sys.stderr)

    print(f"Files processed: {len(files)}")
    print(f"  Updated: {stats['ok']}")
    print(f"  No change: {stats['no_change']}")
    print(f"  Errors: {stats['error']}")
    print(f"  Total HTML swaps: {stats['total_swaps']}")


if __name__ == '__main__':
    main()
