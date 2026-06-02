// _geo-lib.js - shared renderer for programmatic local pages
// (neighborhoods, ZIP codes, NC cities, near-me). Mirrors the
// service-area page design so the whole geo footprint is consistent.
// Deterministic hashPick keeps templated copy varied but stable across builds.

const SITE = 'https://cirilodb.com';

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/brand.css">`;

// Stable hash so the same slug always picks the same template (no churn).
function hashNum(seed) {
  let h = 0;
  seed = String(seed);
  for (let i = 0; i < seed.length; i++) { h = (h * 31 + seed.charCodeAt(i)) >>> 0; }
  return h;
}
function hashPick(seed, arr) { return arr[hashNum(seed) % arr.length]; }
function hashPick2(seed, arr) { return arr[((hashNum(seed + 'x') >>> 3) % arr.length)]; }

const SERVICE_CARDS = `<div class="grid grid-4">
        <a href="/custom-concrete-swimming-pools" class="card card-link"><h3 style="font-size:1.2rem;color:var(--ink);">Custom Pools</h3><p style="font-size:0.9rem;margin:0;">Gunite, vanishing edge, spas.</p></a>
        <a href="/outdoor-living-spaces" class="card card-link"><h3 style="font-size:1.2rem;color:var(--ink);">Outdoor Living</h3><p style="font-size:0.9rem;margin:0;">Kitchens, fire, hardscape.</p></a>
        <a href="/home-renovations-and-remodeling" class="card card-link"><h3 style="font-size:1.2rem;color:var(--ink);">Renovations</h3><p style="font-size:0.9rem;margin:0;">Kitchens, baths, full home.</p></a>
        <a href="/home-additions" class="card card-link"><h3 style="font-size:1.2rem;color:var(--ink);">Additions</h3><p style="font-size:0.9rem;margin:0;">Seamless expansions.</p></a>
      </div>`;

const STYLE_BLOCK = `<style>
  .faq-item { border-bottom: 1px solid var(--border); padding: var(--space-md) 0; }
  .faq-item summary { font-family: var(--font-display); font-size: 1.2rem; color: var(--ink); cursor: pointer; list-style: none; display: flex; justify-content: space-between; gap: 1rem; }
  .faq-item summary::after { content: '+'; color: var(--gold-dark); font-size: 1.5rem; }
  .faq-item[open] summary::after { content: '\\2212'; }
  .faq-item p { margin: var(--space-sm) 0 0; color: var(--body); }
  .areas-strip { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-lg); }
  .areas-links { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; }
  .areas-links a { font-family: var(--font-mono); font-size: 0.8rem; letter-spacing: 0.05em; }
  .cta-block { background: var(--navy); color: var(--white); padding: var(--space-xl); border-radius: var(--radius-lg); display: grid; grid-template-columns: 1.4fr auto; gap: var(--space-xl); align-items: center; position: relative; overflow: hidden; }
  .cta-block::before { content:''; position:absolute; inset:0; background: radial-gradient(circle at 100% 50%, rgba(171,126,55,0.18) 0%, transparent 60%); pointer-events:none; }
  .cta-block > * { position: relative; z-index: 1; }
  @media (max-width: 860px) { .cta-block { grid-template-columns: 1fr; } }
</style>`;

// Generic local page. opts:
//  title, desc, canonicalPath, eyebrow, h1, heroSub, ctaLabel,
//  bodyEyebrow, bodyH2, bodyParas[], serveLine, showServiceCards (bool),
//  faqs[[q,a]], relatedTitle, related[{href,name}],
//  ctaEyebrow, ctaH2, ctaSub, ctaBtn, trackPage, trackExtra(obj), jsonld[]
function page(o) {
  const jsonld = (o.jsonld || []).map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n');
  const faqsHtml = (o.faqs || []).map(([q, a]) => `<details class="faq-item"><summary>${q}</summary><p>${a}</p></details>`).join('\n      ');
  const relatedHtml = (o.related || []).map(r => `<a href="${r.href}">${r.name}</a>`).join('\n          ');
  const bodyParasHtml = (o.bodyParas || []).map((p, i) => i === 0
    ? `<p style="font-size:1.1rem;line-height:1.8;">${p}</p>`
    : `<p style="line-height:1.8;">${p}</p>`).join('\n      ');
  const extra = Object.assign({}, o.trackExtra || {});
  const extraJson = JSON.stringify(extra).slice(1, -1); // drop braces; may be ''
  const trackExtraStr = extraJson ? (extraJson + ',') : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${o.title}</title>
<meta name="description" content="${o.desc}">
${o.noindex ? '<meta name="robots" content="noindex,follow">\n' : ''}<link rel="canonical" href="${SITE}${o.canonicalPath}">
<meta property="og:type" content="website">
<meta property="og:title" content="${o.title}">
<meta property="og:description" content="${o.ogDesc || o.desc}">
<meta property="og:url" content="${SITE}${o.canonicalPath}">
<meta name="twitter:card" content="summary_large_image">
${jsonld}
${FONTS}
</head>
<body>
<!--#include file="_header.html" -->
<main>
  <section class="hero-dark">
    <div class="container">
      <div class="eyebrow mb-sm">${o.eyebrow}</div>
      <h1 style="font-size:var(--fs-hero);max-width:20ch;margin-bottom:var(--space-md);">${o.h1}</h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.82);max-width:660px;margin-bottom:var(--space-lg);">${o.heroSub}</p>
      <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
        <a href="${o.ctaHref || '/contact'}" class="btn btn-primary">${o.ctaLabel}</a>
        <a href="/portfolio" class="btn btn-ghost">See the Work</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container-narrow">
      <div class="eyebrow mb-sm">${o.bodyEyebrow}</div>
      <h2 class="mb-md">${o.bodyH2}</h2>
      ${bodyParasHtml}
      ${o.serveLine ? `<p style="color:var(--muted);">${o.serveLine}</p>` : ''}
    </div>
  </section>
${o.showServiceCards === false ? '' : `
  <section class="section" style="background:var(--gold-pale);padding-top:var(--space-xl);padding-bottom:var(--space-xl);">
    <div class="container">
      ${SERVICE_CARDS}
    </div>
  </section>
`}
  <section class="section">
    <div class="container-narrow">
      <div class="text-center" style="margin-bottom:var(--space-xl);">
        <div class="eyebrow mb-sm">${o.faqEyebrow || 'FAQ'}</div>
        <h2>${o.faqH2 || 'Common questions.'}</h2>
      </div>
      ${faqsHtml}
    </div>
  </section>

  <section class="section" style="padding-top:0;">
    <div class="container">
      <div class="areas-strip">
        <div class="eyebrow mb-sm">${o.relatedTitle || 'We Also Serve'}</div>
        <div class="areas-links">
          ${relatedHtml}
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0;">
    <div class="container">
      <div class="cta-block">
        <div>
          <div class="eyebrow mb-sm" style="color:var(--gold-mid);">${o.ctaEyebrow}</div>
          <h2 style="color:var(--white);margin-bottom:var(--space-sm);">${o.ctaH2}</h2>
          <p style="color:rgba(255,255,255,0.78);margin:0;max-width:520px;">${o.ctaSub}</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-sm);">
          <a href="${o.ctaHref || '/contact'}" class="btn btn-primary">${o.ctaBtn || 'Book Consultation'}</a>
          <a href="tel:+19104090648" class="btn btn-ghost">Call (910) 409-0648</a>
        </div>
      </div>
    </div>
  </section>
</main>
<!--#include file="_footer.html" -->
<script>(function(){try{var k='cdb_jsid';var s=sessionStorage.getItem(k)||('s_'+Math.random().toString(36).slice(2)+Date.now().toString(36));sessionStorage.setItem(k,s);fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:'view',page:'${o.trackPage || 'local'}',${trackExtraStr}session_id:s,url:location.pathname,title:document.title,referrer:document.referrer||null}),keepalive:true}).catch(function(){});}catch(e){}})();</script>
${STYLE_BLOCK}
</body>
</html>
`;
}

// A lighter hub/directory page (hero + arbitrary inner HTML).
function hub(o) {
  const jsonld = (o.jsonld || []).map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${o.title}</title>
<meta name="description" content="${o.desc}">
<link rel="canonical" href="${SITE}${o.canonicalPath}">
<meta property="og:type" content="website">
<meta property="og:title" content="${o.title}">
<meta property="og:description" content="${o.desc}">
<meta property="og:url" content="${SITE}${o.canonicalPath}">
<meta name="twitter:card" content="summary_large_image">
${jsonld}
${FONTS}
</head>
<body>
<!--#include file="_header.html" -->
<main>
  <section class="hero-dark">
    <div class="container">
      <div class="eyebrow mb-sm">${o.eyebrow}</div>
      <h1 style="font-size:var(--fs-hero);margin-bottom:var(--space-md);">${o.h1}</h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.82);max-width:680px;">${o.intro}</p>
    </div>
  </section>
  <section class="section">
    <div class="container">
      ${o.body}
      <div class="text-center" style="margin-top:var(--space-md);">
        <p class="text-muted">Don't see your spot? We build throughout the Charlotte metro and across North Carolina. <a href="/contact">Reach out</a> and ask.</p>
      </div>
    </div>
  </section>
</main>
<!--#include file="_footer.html" -->
<script>(function(){try{var k='cdb_jsid';var s=sessionStorage.getItem(k)||('s_'+Math.random().toString(36).slice(2)+Date.now().toString(36));sessionStorage.setItem(k,s);fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:'view',page:'${o.trackPage || 'local-hub'}',session_id:s,url:location.pathname,title:document.title,referrer:document.referrer||null}),keepalive:true}).catch(function(){});}catch(e){}})();</script>
${STYLE_BLOCK}
</body>
</html>
`;
}

module.exports = { SITE, FONTS, page, hub, hashPick, hashPick2, hashNum };
