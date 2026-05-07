# CLAUDE.md — markcmo.com operating guide

> **Read the DESIGN LOCK section before touching any HTML or CSS file. Violating it has caused hours of lost work and user frustration.**

---

## DESIGN LOCK — Dark Navy/Gold Template is PERMANENT

Mark locked the markcmo.com visual design on 2026-05-07 after repeated incidents where Claude applied the wrong (white/blue) template.

**THE ONLY ALLOWED TEMPLATE IS: DARK NAVY BACKGROUND + GOLD ACCENT.**

### Exact design tokens — homepage (`index.html`)

These are the canonical values. Do not change them. Do not "update them to match a newer file." These ARE the standard.

```css
:root {
  --bg:           #0A0F2C;   /* deep navy — page/hero background */
  --bg2:          #050919;   /* darker navy — alternating section bg */
  --bg3:          #0E1438;   /* mid-navy — card backgrounds */
  --card:         #0F1535;   /* card background */
  --border:       rgba(255,255,255,0.08);
  --accent:       #C9A84C;   /* GOLD — primary accent, never blue */
  --accent2:      #DFC06D;   /* lighter gold */
  --accent-glow:  rgba(201,168,76,0.25);
  --cyan:         #00C4CC;   /* secondary accent (used sparingly) */
  --text:         #FFFFFF;   /* primary text */
  --text2:        #A1A1AA;   /* secondary text */
  --text3:        #52525B;   /* muted/tertiary text */
}
```

### Design tokens — MAGNET subpages (`magnet-*.html`)

All magnet pages use a slightly darker variant. This must be in the internal `<style>` block of each page:

```css
:root {
  --bg:     #070c16;
  --bg2:    #0b1120;
  --bg3:    #111827;
  --accent: #C9A84C;
  --text:   #f1f3f7;
  --text2:  #9aa3b2;
  --text3:  #5c6473;
  --border: rgba(255,255,255,0.07);
}
```

### Typography

- **Headings**: `'Outfit', sans-serif` (weights 300–900, Google Fonts)
- **Body/CTA/UI**: `'Space Grotesk', sans-serif` (weights 400–700, Google Fonts)
- Google Fonts link: `https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap`
- `theme-color` meta: `#0A0F2C`

### Nav structure

```html
<nav class="nav">
  <!-- Logo (left) -->
  <a class="nav-logo" href="index.html">
    <div class="nav-logo-avatar"><img ...></div>
    <div class="nav-logo-text">
      <strong>Mark Gabrielli</strong>
      <span>Fractional CMO &amp; COO</span>
    </div>
  </a>
  <!-- Links (right) -->
  <div class="nav-right">
    <ul class="nav-links">
      <li><a href="about.html">About</a></li>
      <li><a href="services.html">Services</a></li>
      <li><a href="magnet-framework.html" style="color:var(--accent);font-weight:600;">MAGNET&trade;</a></li>
      <li><a href="results.html">Results</a></li>
      <li><a href="blog.html">Insights</a></li>
      <li><a href="https://academy.markcmo.com">Academy</a></li>
    </ul>
    <a href="book.html" class="nav-btn">Book a Free Call</a>
  </div>
  <!-- Hamburger (mobile) -->
  <div class="nav-hamburger" id="navHam"><span></span><span></span><span></span></div>
</nav>
<!-- Mobile drawer -->
<div class="mobile-drawer" id="mobileDrawer">...</div>
```

Nav CSS:
- `height: 64px`, `padding: 0 5vw`
- `background: rgba(10,15,44,0.85)`, `backdrop-filter: blur(20px)`
- `border-bottom: 1px solid var(--border)`
- Links: `font-size: 0.875rem`, `font-weight: 500`, `color: var(--text2)`
- CTA button `.nav-btn`: `background: var(--accent)`, `color: #fff`, `border-radius: 8px`

### MAGNET link color rule

The MAGNET nav link always uses `style="color:var(--accent);font-weight:600;"` — gold, not default link color.

---

## TRADEMARK RULE — Always use HTML entities

**NEVER store raw ™ characters in any HTML file.** The raw UTF-8 bytes E2 84 A2 (U+2122) are served as Windows-1252 by some browsers/servers and render as `â„¢`.

Always use:
- `&trade;` — preferred
- `&#x2122;` — acceptable alternative

**ZERO tolerance for raw ™ bytes in any .html file in this project.**

To audit: `python3 -c "f=open('file.html','rb');c=f.read();f.close();print(c.count(b'\xe2\x84\xa2'),'raw TM bytes')"`

To fix all garbled bytes (â„¢ stored as literal chars C3 A2 E2 80 9E C2 A2):
```python
garbled = b'\xc3\xa2\xe2\x80\x9e\xc2\xa2'
content.replace(garbled, b'&trade;')
```

---

## THE FORBIDDEN TEMPLATE — style.css

`style.css` is a **LIGHT/BLUE** legacy stylesheet. Do NOT let it be the sole CSS source for any dark page.

style.css `:root` contains:
- `--white: #FFFFFF`, `body { background: var(--white); }` — WHITE background
- `--gold: #2563EB` — this is BLUE, not gold (misleadingly named)
- Fonts: `Barlow`, `Bebas Neue`, `DM Mono` — NOT the dark template fonts

style.css may be linked for shared infrastructure (nav breakpoints, form resets) but EVERY page that uses the dark navy/gold theme MUST have its own `<style>` block with the `:root` override above style.css. The internal `:root` OVERRIDES the white theme.

**Rule: linking `<link rel="stylesheet" href="style.css">` alone = white page. Always add the internal `:root` dark block.**

---

## RULE #-1 — `index.html` is LOCKED

Mark explicitly said on 2026-05-07: "that is it. do not let that ever change again."

Do **NOT**:
- Replace index.html content with any other page's template
- Change the body background, hero copy, nav structure, or section layout
- Restyle index.html "to match" another page
- Inject CSS overrides or BRAND-LOCK blocks

You **MAY**:
- Fix typos, broken links, trademark entities, schema.org bugs
- Update SEO metadata only if Mark explicitly asks
- Add new content sections only if Mark names them explicitly

**If Mark asks for a styling change to the homepage, stop and re-quote this rule before editing.**

---

## RULE #0 — Never send email without explicit consent

Never trigger any Resend call, even as a test:
- `send-engagement-proposal-email` — even with `testRecipient`
- `send-template-email`
- Any direct Resend API call

Smoke tests: use `dry_run: true` or ask Mark first.

---

## RULE #1 — Never run `netlify deploy --prod` directly. Use safe-deploy.sh.

```bash
bash scripts/safe-deploy.sh "your deploy message"
```

The script snapshots uncommitted WIP to a `auto-wip/*` branch, verifies sync with `origin/main`, then deploys. Skipping it has overwritten Mark's uncommitted work. Multiple times.

---

## RULE #2 — Two worktrees. Always check both.

```
parent:  C:/Users/13219/Desktop/MarkCMO Website/MarkCMO.com/
child:   C:/Users/13219/Desktop/MarkCMO Website/MarkCMO.com/.claude/worktrees/<branch>/
```

Mark works in the parent. Claude works in child worktrees. Before any deploy: `git status --short` in parent.

---

## Project overview

Static site + Netlify Functions at https://markcmo.com. Site ID: `609d74ca-5f2a-4caa-aa7c-3f6922a7bcb4`. Publish dir: `.` (root). `pretty_urls = true`.

### Key pages
- `index.html` — homepage (dark navy/gold, LOCKED)
- `magnet-framework.html` — MAGNET Framework overview
- `magnet-map.html`, `magnet-architect.html`, `magnet-generate.html`, `magnet-nurture.html`, `magnet-engineer.html`, `magnet-track.html` — MAGNET letter subpages
- `about.html`, `services.html`, `results.html`, `blog.html`, `book.html`, `contact.html`, `faq.html`
- All blog posts: `blog-*.html`
- `admin.html` — legacy admin console (light/blue theme, intentional)

### Netlify Functions (Supabase + Square + Resend engagement pipeline)
See the worktree CLAUDE.md at `.claude/worktrees/stoic-raman-9cafcb/CLAUDE.md` for full function reference and Supabase schema.

### Supabase: CLIPOS project, ref `saoomfwycegflxelggxv`

### IndexNow key: `70abe020d62240838dd426d99f0e5852`
Submit URL: `https://api.indexnow.org/indexnow`
POST body: `{"host":"markcmo.com","key":"70abe020d62240838dd426d99f0e5852","keyLocation":"https://markcmo.com/70abe020d62240838dd426d99f0e5852.txt","urlList":["https://markcmo.com/page.html"]}`

---

## Contextual link style

Gold inline links (for internal cross-linking): `style="color:#C9A84C;text-decoration:none;font-weight:600;"`

---

## Things that have happened before — do not repeat

1. **Homepage accidentally overwritten** — a PowerShell copy pasted magnet-framework.html content into index.html. Mark caught it and fixed it manually. **Never copy file contents using PowerShell ReadAllText without verifying the source path is exactly correct.**
2. **Trademark garbling** — raw ™ bytes (E2 84 A2) render as `â„¢` in browsers that treat the file as Windows-1252. Fix: always use `&trade;`.
3. **White/blue template on dark pages** — linking only style.css with no `:root` override produces a white background and blue "gold" accents. Always inject the dark `:root` block in any magnet or dark page.
4. **Site reverted twice** — deploys from a worktree that didn't have Mark's uncommitted parent WIP. Fix: use `safe-deploy.sh`.
5. **Hardcoded admin credentials** in `admin.html` client-side JS — known issue, do not fix without Mark's explicit instruction.
