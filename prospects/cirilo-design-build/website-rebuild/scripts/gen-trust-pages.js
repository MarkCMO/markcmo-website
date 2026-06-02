// gen-trust-pages.js - generates the 4 audit-fix trust pages:
// /process, /financing, /warranty, /faq
// These close the trust gaps the audit flagged (Phase 0 gate item #3).
// Run: node scripts/gen-trust-pages.js

const fs = require('fs');
const path = require('path');
const PAGES = path.join(__dirname, '..', 'pages');
const SITE = 'https://cirilodb.com';

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/brand.css">`;

const TRACK = (page) => `<script>(function(){try{var k='cdb_jsid';var s=sessionStorage.getItem(k)||('s_'+Math.random().toString(36).slice(2)+Date.now().toString(36));sessionStorage.setItem(k,s);fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:'view',page:'${page}',session_id:s,url:location.pathname,title:document.title,referrer:document.referrer||null}),keepalive:true}).catch(function(){});}catch(e){}})();</script>`;

const CTA = `<section class="section" style="padding-top:0;">
    <div class="container">
      <div class="cta-block">
        <div>
          <div class="eyebrow mb-sm" style="color:var(--gold-mid);">Start Here</div>
          <h2 style="color:var(--white);margin-bottom:var(--space-sm);">Book a Design Consultation</h2>
          <p style="color:rgba(255,255,255,0.78);margin:0;max-width:520px;">60 minutes on-site. Vision, budget, timeline, and what's possible for your property. No obligation.</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-sm);">
          <a href="/contact" class="btn btn-primary">Book Consultation</a>
          <a href="tel:+19104090648" class="btn btn-ghost">Call (910) 409-0648</a>
        </div>
      </div>
    </div>
  </section>`;

const CTA_STYLE = `.cta-block { background: var(--navy); color: var(--white); padding: var(--space-xl); border-radius: var(--radius-lg); display: grid; grid-template-columns: 1.4fr auto; gap: var(--space-xl); align-items: center; position: relative; overflow: hidden; }
  .cta-block::before { content:''; position:absolute; inset:0; background: radial-gradient(circle at 100% 50%, rgba(171,126,55,0.18) 0%, transparent 60%); pointer-events:none; }
  .cta-block > * { position: relative; z-index: 1; }
  @media (max-width: 860px) { .cta-block { grid-template-columns: 1fr; } }`;

// ─────────────────────────────────────────────────────────────
// 1. PROCESS - the 14-stage timeline (also the "what to expect")
// ─────────────────────────────────────────────────────────────
const STAGES = [
  ['Design Consultation', 'On-site visit. We assess your property, discuss vision, lifestyle, budget, and timeline, and identify access, drainage, and setback considerations.'],
  ['Design &amp; 3D Concepts', 'Site evaluation, measurements, and 3D renderings in Pool Studio. We refine through revisions until the design is right.'],
  ['Proposal &amp; Material Selection', 'Final design plans, scope of work, pricing, timeline, and finishes. You see exactly what you are getting before anything breaks ground.'],
  ['Contract &amp; Permitting', 'Contract signed, deposit collected. We pull permits in our name and handle HOA approval. You work through us for the entire build.'],
  ['Excavation', 'The dig. Layout staked, pool shape excavated to engineered spec.'],
  ['Rebar &amp; Bonding', 'Steel reinforcement cage tied and electrically bonded for safety and structural integrity.'],
  ['Plumbing &amp; Electrical Rough-In', 'Long plumbing runs, returns, skimmers, and electrical conduit installed before the shell.'],
  ['Inspections', 'County inspections at each required stage. Nothing proceeds until it passes.'],
  ['Shotcrete / Gunite Shell', 'The structural concrete shell sprayed and hand-formed. This is the pool that lasts 50+ years.'],
  ['Tile &amp; Coping', 'Waterline tile and coping installed. The detail work that defines the look.'],
  ['Equipment Installation', 'Pumps, heaters, filters, automation, and lighting set and wired.'],
  ['Decking', 'Travertine, pavers, or stone decking installed around the pool.'],
  ['Interior Finish', 'Plaster, pebble, or quartz interior applied. The surface you actually touch.'],
  ['Fill, Startup &amp; Orientation', 'Pool filled, equipment started, water balanced, and a full homeowner orientation. Final inspection and warranty registration.'],
];

const processPage = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Our Process | How We Build | Cirilo Design + Build Charlotte NC</title>
<meta name="description" content="The Cirilo Design + Build process from design consultation through fill day. 14 construction stages, permitted and engineered, one accountable team. Charlotte, NC.">
<link rel="canonical" href="${SITE}/process">
<meta property="og:type" content="website">
<meta property="og:title" content="Our Process | Cirilo Design + Build">
<meta property="og:description" content="14 construction stages from design to fill day. Permitted, engineered, one accountable team.">
<meta property="og:url" content="${SITE}/process">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
</head>
<body>
<!--#include file="_header.html" -->
<main>
  <section class="hero-dark">
    <div class="container">
      <div class="eyebrow mb-sm">How We Build</div>
      <h1 style="font-size:var(--fs-hero);max-width:14ch;margin-bottom:var(--space-md);">Our Process</h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.82);max-width:640px;">From the first consultation to the day you swim, you work with one accountable team. Here is exactly what to expect, stage by stage.</p>
    </div>
  </section>

  <section class="section">
    <div class="container-narrow">
      <div class="timeline">
        ${STAGES.map((s, i) => `<div class="tl-item">
          <div class="tl-num">${String(i+1).padStart(2,'0')}</div>
          <div class="tl-body">
            <h3>${s[0]}</h3>
            <p>${s[1]}</p>
          </div>
        </div>`).join('\n        ')}
      </div>
      <div class="process-note">
        <p><strong>Typical timeline:</strong> 3 to 6 months from dig to fill for a custom concrete pool, depending on design complexity, weather, and permitting. We give you a milestone schedule at contract and keep you updated at every stage. Once we are engaged, you will be able to see your project status, photos, and documents in your own client portal.</p>
      </div>
    </div>
  </section>

  ${CTA}
</main>
<!--#include file="_footer.html" -->
${TRACK('process')}
<style>
  .timeline { position: relative; padding-left: 0; }
  .tl-item { display: grid; grid-template-columns: 64px 1fr; gap: var(--space-md); padding: var(--space-md) 0; border-bottom: 1px solid var(--border); }
  .tl-item:last-child { border-bottom: none; }
  .tl-num { font-family: var(--font-display); font-size: 2rem; font-weight: 600; color: var(--gold-dark); line-height: 1; }
  .tl-body h3 { font-size: 1.3rem; color: var(--ink); margin-bottom: 0.35rem; }
  .tl-body p { margin: 0; color: var(--body); font-size: 0.98rem; }
  .process-note { background: var(--gold-pale); border-radius: var(--radius-lg); padding: var(--space-lg); margin-top: var(--space-xl); }
  .process-note p { margin: 0; }
  ${CTA_STYLE}
</style>
</body>
</html>
`;

// ─────────────────────────────────────────────────────────────
// 2. FINANCING - Lyon Financial + partners
// ─────────────────────────────────────────────────────────────
const financingPage = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pool Financing | Cirilo Design + Build Charlotte NC</title>
<meta name="description" content="Flexible pool and outdoor living financing through Lyon Financial and trusted lending partners. Finance your custom pool project in Charlotte, NC. Cirilo Design + Build.">
<link rel="canonical" href="${SITE}/financing">
<meta property="og:type" content="website">
<meta property="og:title" content="Pool Financing | Cirilo Design + Build">
<meta property="og:description" content="Flexible financing for custom pools and outdoor living through trusted lending partners.">
<meta property="og:url" content="${SITE}/financing">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
</head>
<body>
<!--#include file="_header.html" -->
<main>
  <section class="hero-dark">
    <div class="container">
      <div class="eyebrow mb-sm">Make It Achievable</div>
      <h1 style="font-size:var(--fs-hero);max-width:16ch;margin-bottom:var(--space-md);">Pool &amp; Outdoor Living Financing</h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.82);max-width:640px;">A custom pool is a long-term investment in your home and your lifestyle. We work with trusted lending partners so you can build the project you actually want, on terms that work for you.</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="grid grid-2" style="align-items:start;gap:var(--space-2xl);">
        <div>
          <div class="eyebrow mb-sm">Lending Partners</div>
          <h2 class="mb-md">Financing built for pools.</h2>
          <p>Pool and outdoor living projects qualify for specialized financing that traditional home-improvement loans often do not match. Our lending partners specialize in exactly this kind of project, with options designed around custom construction timelines and draw schedules.</p>
          <div class="finance-card">
            <h3>Lyon Financial</h3>
            <p>The industry standard for pool financing. Loan amounts up to and beyond luxury custom budgets, competitive rates, and a fast online application. No prepayment penalties on most products.</p>
            <a href="https://www.lyonfinancial.net" target="_blank" rel="noopener" class="btn btn-secondary">Apply with Lyon Financial</a>
          </div>
          <p style="font-size:0.9rem;color:var(--muted);margin-top:var(--space-md);">Additional partners including HFS Financial and LightStream available depending on project scope and your preferences. We will walk you through the best fit at your consultation.</p>
        </div>
        <div>
          <div class="finance-side">
            <h4>Why Finance a Pool?</h4>
            <ul class="check-list">
              <li>Build the full project now instead of phasing it over years</li>
              <li>Preserve cash and investment capital</li>
              <li>Add value and enjoyment to your home immediately</li>
              <li>Fixed monthly payments you can plan around</li>
              <li>Pool financing often beats HELOC and credit-card rates</li>
            </ul>
            <h4 style="margin-top:var(--space-lg);">What You'll Need</h4>
            <ul class="check-list">
              <li>Basic personal and income information</li>
              <li>Project estimate (we provide this at proposal)</li>
              <li>A few minutes for the online application</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>

  ${CTA}
</main>
<!--#include file="_footer.html" -->
${TRACK('financing')}
<style>
  .finance-card { background: var(--white); border: 1px solid var(--border); border-left: 3px solid var(--gold-dark); border-radius: var(--radius-lg); padding: var(--space-lg); margin: var(--space-lg) 0; }
  .finance-card h3 { color: var(--ink); margin-bottom: var(--space-sm); }
  .finance-side { background: var(--gold-pale); border-radius: var(--radius-lg); padding: var(--space-lg); }
  .finance-side h4 { font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.15em; color: var(--gold-dark); margin-bottom: var(--space-sm); }
  .check-list { list-style: none; margin: 0; }
  .check-list li { padding: 0.4rem 0 0.4rem 1.6rem; position: relative; font-size: 0.95rem; }
  .check-list li::before { content: '\\2713'; position: absolute; left: 0; color: var(--gold-dark); font-weight: 700; }
  ${CTA_STYLE}
</style>
</body>
</html>
`;

// ─────────────────────────────────────────────────────────────
// 3. WARRANTY - 10-yr structural
// ─────────────────────────────────────────────────────────────
const warrantyPage = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Warranty | 10-Year Structural | Cirilo Design + Build Charlotte NC</title>
<meta name="description" content="Cirilo Design + Build backs every custom concrete pool with a 10-year structural warranty plus manufacturer warranties on all equipment. Charlotte, NC.">
<link rel="canonical" href="${SITE}/warranty">
<meta property="og:type" content="website">
<meta property="og:title" content="Warranty | Cirilo Design + Build">
<meta property="og:description" content="10-year structural warranty on the pool shell plus full manufacturer equipment warranties.">
<meta property="og:url" content="${SITE}/warranty">
<meta name="twitter:card" content="summary_large_image">
${FONTS}
</head>
<body>
<!--#include file="_header.html" -->
<main>
  <section class="hero-dark">
    <div class="container">
      <div class="eyebrow mb-sm">We Stand Behind It</div>
      <h1 style="font-size:var(--fs-hero);max-width:14ch;margin-bottom:var(--space-md);">10-Year Structural Warranty</h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.82);max-width:640px;">We build pools to last 50+ years and we back the structure for a decade. Our mission is to deliver work we are proud to stand behind, and the warranty is how we put that in writing.</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="grid grid-3">
        <div class="card" style="border-top:3px solid var(--gold-dark);">
          <h3 style="color:var(--ink);font-size:1.3rem;margin-bottom:var(--space-sm);">10-Year Structural</h3>
          <p style="margin:0;">The gunite shell is warranted against structural defects for 10 years. This is the bones of the pool, the part that has to be right.</p>
        </div>
        <div class="card" style="border-top:3px solid var(--gold-dark);">
          <h3 style="color:var(--ink);font-size:1.3rem;margin-bottom:var(--space-sm);">Equipment Warranties</h3>
          <p style="margin:0;">Pumps, heaters, filters, automation, and lighting carry full manufacturer warranties (Pentair, Jandy, Hayward). We register every component for you at closeout.</p>
        </div>
        <div class="card" style="border-top:3px solid var(--gold-dark);">
          <h3 style="color:var(--ink);font-size:1.3rem;margin-bottom:var(--space-sm);">Workmanship</h3>
          <p style="margin:0;">Our installation workmanship is warranted so that finishes, tile, coping, and decking are installed to standard and built to hold up.</p>
        </div>
      </div>

      <div class="warranty-detail">
        <div class="eyebrow mb-sm">The Details</div>
        <h2 class="mb-md">What the warranty covers.</h2>
        <p>Every Cirilo Design + Build custom concrete pool includes a written limited warranty provided at project closeout. Coverage includes:</p>
        <ul class="check-list">
          <li><strong>Structural shell:</strong> 10 years against structural defects in the gunite shell under normal use and proper maintenance.</li>
          <li><strong>Equipment:</strong> full manufacturer warranty terms on all installed equipment, registered in your name.</li>
          <li><strong>Workmanship:</strong> installation workmanship warranty on tile, coping, decking, and finish application.</li>
        </ul>
        <p style="font-size:0.9rem;color:var(--muted);margin-top:var(--space-md);">Specific terms, coverage periods, and maintenance requirements are detailed in the written warranty document provided with your project. Proper water chemistry and routine maintenance are required to keep coverage in force. Ask us for a copy of the full warranty terms at your consultation.</p>
      </div>
    </div>
  </section>

  ${CTA}
</main>
<!--#include file="_footer.html" -->
${TRACK('warranty')}
<style>
  .warranty-detail { background: var(--gold-pale); border-radius: var(--radius-lg); padding: var(--space-xl); margin-top: var(--space-xl); }
  .check-list { list-style: none; margin: var(--space-sm) 0; }
  .check-list li { padding: 0.5rem 0 0.5rem 1.6rem; position: relative; }
  .check-list li::before { content: '\\2713'; position: absolute; left: 0; color: var(--gold-dark); font-weight: 700; }
  ${CTA_STYLE}
</style>
</body>
</html>
`;

// ─────────────────────────────────────────────────────────────
// 4. FAQ - buyer FAQ with FAQ schema
// ─────────────────────────────────────────────────────────────
const FAQS = [
  ['How much does a custom pool cost in Charlotte?', 'Luxury custom concrete pools in the Charlotte metro typically run $100 to $250 per square foot. A fully integrated build with spa, vanishing edge, and outdoor living usually lands between $150,000 and $400,000. We give you a clear budget range at your design consultation, before any commitment.'],
  ['How long does it take to build a pool?', 'A custom concrete pool runs through 14 construction stages and typically takes 3 to 6 months from excavation to fill, depending on design complexity, weather, and permitting. We provide a milestone schedule at contract.'],
  ['Do you handle permits and HOA approval?', 'Yes. We pull permits in our name and act as the project manager through final inspection. We also handle HOA submission and approval across Mecklenburg and Union counties.'],
  ['Where do you build?', 'We are based in Charlotte and serve the entire Charlotte metro, including SouthPark, Myers Park, Ballantyne, Waxhaw, Weddington, Marvin, Davidson, Cornelius, Mooresville, Huntersville, and Matthews. We are expanding across North Carolina.'],
  ['What kind of pools do you build?', 'Custom concrete (gunite) pools only, including vanishing and infinity edges, integrated spas, tanning ledges, and resort-style features. We do new construction, not vinyl or fiberglass.'],
  ['Do you offer financing?', 'Yes. We work with Lyon Financial and other trusted lending partners who specialize in pool and outdoor living financing. See our financing page for details.'],
  ['What warranty do you provide?', 'Every pool includes a 10-year structural warranty on the shell, full manufacturer warranties on all equipment, and a workmanship warranty. See our warranty page for full details.'],
  ['Can you design the outdoor living and pool together?', 'Always. Designing the pool and the surrounding outdoor living as one project is the core of our design-build approach. It is the difference between a backyard that feels intentional and one assembled from separate parts.'],
  ['Do I work with the same person the whole time?', 'Yes. As a family-owned design-build studio, you work directly with us from design through closeout. You are never handed off to a project manager who never met you.'],
  ['How do I get started?', 'Book a design consultation. We come to your property for about 60 minutes, assess the site, talk through your vision, budget, and timeline, and leave you with a clear sense of what is possible. No obligation.'],
];
const faqSchema = {
  "@context": "https://schema.org", "@type": "FAQPage",
  "mainEntity": FAQS.map(([q,a]) => ({ "@type":"Question", "name":q.replace(/&amp;/g,'&'), "acceptedAnswer":{"@type":"Answer","text":a.replace(/&amp;/g,'&')} }))
};

const faqPage = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FAQ | Custom Pool Builder Questions | Cirilo Design + Build Charlotte NC</title>
<meta name="description" content="Answers to common questions about building a custom luxury pool in Charlotte, NC: cost, timeline, permits, financing, warranty, and service area. Cirilo Design + Build.">
<link rel="canonical" href="${SITE}/faq">
<meta property="og:type" content="website">
<meta property="og:title" content="FAQ | Cirilo Design + Build">
<meta property="og:description" content="Cost, timeline, permits, financing, warranty, and more. Common custom pool questions answered.">
<meta property="og:url" content="${SITE}/faq">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
${FONTS}
</head>
<body>
<!--#include file="_header.html" -->
<main>
  <section class="hero-dark">
    <div class="container">
      <div class="eyebrow mb-sm">Common Questions</div>
      <h1 style="font-size:var(--fs-hero);max-width:14ch;margin-bottom:var(--space-md);">Frequently Asked Questions</h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.82);max-width:640px;">Everything we get asked most about building a custom luxury pool in Charlotte. Don't see your question? <a href="/contact" style="color:var(--gold-mid);">Reach out</a> and we'll answer it.</p>
    </div>
  </section>

  <section class="section">
    <div class="container-narrow">
      ${FAQS.map(([q,a]) => `<details class="faq-item">
        <summary>${q}</summary>
        <p>${a}</p>
      </details>`).join('\n      ')}
    </div>
  </section>

  ${CTA}
</main>
<!--#include file="_footer.html" -->
${TRACK('faq')}
<style>
  .faq-item { border-bottom: 1px solid var(--border); padding: var(--space-md) 0; }
  .faq-item summary { font-family: var(--font-display); font-size: 1.25rem; color: var(--ink); cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  .faq-item summary::after { content: '+'; color: var(--gold-dark); font-size: 1.6rem; font-weight: 300; flex-shrink: 0; }
  .faq-item[open] summary::after { content: '\\2212'; }
  .faq-item p { margin: var(--space-sm) 0 0; color: var(--body); font-size: 1rem; line-height: 1.7; }
  ${CTA_STYLE}
</style>
</body>
</html>
`;

// ── Write all 4 ──────────────────────────────────────────────
const pages = { 'process': processPage, 'financing': financingPage, 'warranty': warrantyPage, 'faq': faqPage };
let count = 0;
for (const [slug, html] of Object.entries(pages)) {
  fs.writeFileSync(path.join(PAGES, slug + '.html'), html);
  console.log('✓', slug + '.html');
  count++;
}
console.log(`\n${count} trust pages written to pages/`);
