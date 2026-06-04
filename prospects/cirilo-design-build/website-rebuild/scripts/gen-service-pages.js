// gen-service-pages.js - generates the 4 service marketing pages from structured data.
// Each page: SEO meta + Service schema + FAQ schema + hero + features + process + CTA.
// Run: node scripts/gen-service-pages.js  (writes into pages/)

const fs = require('fs');
const path = require('path');
const PAGES = path.join(__dirname, '..', 'pages');

const SITE = 'https://cirilodb.com';

// ── Service data (grounded in her real cirilodb.com copy) ───────
const SERVICES = [
  {
    slug: 'custom-concrete-swimming-pools',
    nav: 'Pools',
    title: 'Custom Concrete Pool Builder in Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Custom concrete (gunite) swimming pool builder in Charlotte, NC. Vanishing edges, integrated spas, tanning ledges, LED automation. Engineered to last 50+ years. Serving the Charlotte metro and North Carolina.',
    h1: 'Custom Concrete Swimming Pools',
    eyebrow: 'New Construction',
    lede: 'Fully customized concrete pools and spas, engineered for durability, performance, and timeless style. We turn your backyard into a private resort built to last 50+ years.',
    intro: 'Every pool is tailored to your space, your style, and how your family loves to relax and entertain. From clean modern lines to resort-style vanishing edges, we use engineered gunite construction, premium finishes, and expert craftsmanship to deliver lasting beauty. Clear communication, efficient timelines, one accountable team from design to fill day.',
    features: [
      ['Engineered Gunite Construction', 'Steel-reinforced shotcrete shells built to structural spec and inspected at every stage. The foundation of a pool that lasts decades, not years.'],
      ['Vanishing &amp; Infinity Edges', 'The signature luxury feature. Engineered catch basins and precise water-level control for the disappearing-edge effect on sloped lots and waterfront properties.'],
      ['Integrated Spas &amp; Spillovers', 'Raised or flush spas with spillover detailing, designed as part of the pool, not bolted on. Hydrotherapy jets, heaters, automation.'],
      ['Tanning Ledges &amp; Baja Shelves', 'Shallow sun shelves for loungers, umbrellas, and small children. The most-requested feature in modern luxury pools.'],
      ['Premium Interior Finishes', 'Quartz, pebble, and glass-tile finishes. We walk you through the full finishes catalog so the surface matches the design intent.'],
      ['Smart LED &amp; Automation', 'Color-changing LED, app-based control of pumps, heaters, lights, and water features. Pentair, Jandy, and Hayward equipment.'],
    ],
    faqs: [
      ['How much does a custom concrete pool cost in Charlotte?', 'Luxury custom gunite pools in the Charlotte metro typically run $100 to $250 per square foot. A fully integrated build with spa, vanishing edge, and outdoor living usually lands between $150K and $400K. We give you a clear budget range at the design consultation.'],
      ['How long does a custom pool take to build?', 'A custom concrete pool runs through 14 construction stages: excavation, rebar and bonding, plumbing, electrical, gas, inspections, shotcrete, tile and coping, equipment, decking, interior finish, fill, and final inspection. Typical timeline is 3 to 6 months from dig to fill depending on weather, permitting, and design complexity.'],
      ['Do you handle permits and HOA approval?', 'Yes. We pull the permits in our name and act as the project manager through final inspection. We also handle HOA submission and approval where required across Mecklenburg and Union counties.'],
      ['What warranty comes with the pool?', 'Every Cirilo pool includes a 10-year structural warranty on the shell, plus manufacturer warranties on all equipment. Details are on our warranty page.'],
    ],
  },
  {
    slug: 'outdoor-living-spaces',
    nav: 'Outdoor Living',
    title: 'Outdoor Living Spaces &amp; Outdoor Kitchens Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Luxury outdoor living design and build in Charlotte, NC. Outdoor kitchens, fire features, covered structures, and hardscape designed alongside your pool. Serving the Charlotte metro and North Carolina.',
    h1: 'Outdoor Living Spaces',
    eyebrow: 'Designed Alongside the Pool',
    lede: 'Thoughtfully designed outdoor environments built for living and entertaining. Outdoor kitchens, fire features, covered structures, and hardscape that complement your home and how you actually use it.',
    intro: 'Extend your living space outdoors with environments designed for both function and luxury. Whether you are hosting large gatherings or enjoying quiet family nights, every outdoor living project is customized to complement your home and lifestyle. Because we design the outdoor living and the pool together, nothing feels bolted on after the fact.',
    features: [
      ['Outdoor Kitchens', 'Durable appliances, storage, and workspaces that make cooking and entertaining outdoors genuinely convenient. Built-in grills, refrigeration, counter space, and weatherproof cabinetry.'],
      ['Fire Features', 'Firepits, fireplaces, and fire-and-water combinations that extend the season and anchor the gathering space.'],
      ['Covered Structures', 'Pergolas, pavilions, and covered patios that add shade, structure, and year-round usability to the backyard.'],
      ['Hardscape &amp; Decking', 'Travertine, porcelain pavers, and natural stone decking specified to match the pool and the architecture of the home.'],
      ['Landscape Integration', 'Planting, lighting, and grading designed so the pool and outdoor living feel like one cohesive environment, not separate projects.'],
      ['Outdoor Lighting &amp; Audio', 'Low-voltage landscape lighting and integrated audio for ambiance and function after dark.'],
    ],
    faqs: [
      ['Can you build outdoor living without a pool?', 'Yes. While we most often design outdoor living alongside a pool, we build standalone outdoor kitchens, fire features, pergolas, and hardscape projects throughout the Charlotte metro.'],
      ['Do you design the outdoor living with the pool or separately?', 'Together, always. Designing the pool and the outdoor living as one project is the difference between a backyard that feels intentional and one that feels assembled from parts. It is the core of our design-build approach.'],
      ['What outdoor kitchen brands do you use?', 'We specify premium, weather-rated appliances and cabinetry built for the Charlotte climate. We walk you through options at the design consultation based on how you cook and entertain.'],
    ],
  },
  {
    slug: 'home-renovations-and-remodeling',
    nav: 'Renovations',
    title: 'Luxury Home Renovations &amp; Remodeling Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Design-first home renovations and remodeling in Charlotte, NC. Kitchens, primary suites, bathrooms, and full-home transformations. Serving the Charlotte metro and North Carolina.',
    h1: 'Home Renovations &amp; Remodeling',
    eyebrow: 'Design-First Interiors',
    lede: 'Smart, functional renovations designed around how you actually live. From kitchen upgrades to spa-like bathrooms and full-home transformations, we combine design intent, quality materials, and skilled craftsmanship.',
    intro: 'We bring the same design-first sensibility to interior work that we bring to luxury pools. We work closely with you to bring your vision to life while keeping the process organized and transparent, so you always know what is happening and what comes next.',
    features: [
      ['Kitchen Remodels', 'Layout, cabinetry, countertops, lighting, and appliances reworked to improve everyday use and long-term value. The highest-ROI room in the house, done right.'],
      ['Primary Suite &amp; Bathrooms', 'Spa-like primary baths and suite expansions: walk-in showers, freestanding tubs, custom vanities, heated floors.'],
      ['Full-Home Transformations', 'Whole-home refreshes that update finishes, flow, and function while respecting the existing architecture.'],
      ['Flooring &amp; Finishes', 'Hardwood, tile, and premium surface work installed by skilled craftsmen, specified to match the design vision.'],
      ['Lighting &amp; Electrical', 'Recessed, accent, and architectural lighting that transforms how a space feels, planned and wired correctly.'],
      ['Transparent Project Management', 'One designer and one accountable team from concept to final walkthrough. Clear timelines, clear communication.'],
    ],
    faqs: [
      ['Do you do whole-home renovations or just single rooms?', 'Both. We take on single high-impact rooms like kitchens and primary baths as well as full-home transformations. The design-build approach is the same at any scale.'],
      ['How do you keep a renovation organized?', 'One designer and one project manager from start to finish, with clear milestone communication. You are never handed off to someone who never saw your home.'],
      ['Can you renovate while keeping the home livable?', 'In most cases yes. We phase the work and seal off active areas where possible so you can stay in the home through the renovation.'],
    ],
  },
  {
    slug: 'home-additions',
    nav: 'Additions',
    title: 'Luxury Home Additions Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Seamless luxury home additions in Charlotte, NC. Room additions, expanded living areas, and second stories engineered to blend with your existing home. Serving the Charlotte metro and North Carolina.',
    h1: 'Home Additions',
    eyebrow: 'Expand Without Compromise',
    lede: 'Seamless additions that expand your home without compromising the architecture. More space, more comfort, more value, designed to look like it was always there.',
    intro: 'Need more space without moving? Our custom home additions blend seamlessly with your existing structure while adding comfort, value, and functionality. Whether it is an expanded living area, a new bedroom, or a larger kitchen footprint, we design additions that feel original to the home. Efficient timelines, clear communication, structural work done correctly.',
    features: [
      ['Room &amp; Bedroom Additions', 'Additional bedrooms or bathrooms designed to blend seamlessly with your existing structure and layout.'],
      ['Expanded Living Areas', 'Great-room expansions and bump-outs that open up how the home lives without losing its character.'],
      ['Kitchen Footprint Expansions', 'Grow the kitchen into adjacent space with structural work that ties in cleanly to the existing home.'],
      ['Sunrooms &amp; Enclosures', 'Bright, year-round spaces that connect the indoors to the backyard and the pool.'],
      ['Engineered &amp; Permitted', 'Every addition is engineered to code and permitted in our name. We manage the structural tie-in correctly so there are no surprises.'],
      ['Architecturally Matched', 'Rooflines, finishes, and proportions matched to the existing home so the addition reads as original, not added.'],
    ],
    faqs: [
      ['Will the addition match my existing home?', 'That is the whole point. We match rooflines, finishes, and proportions so the addition reads as original architecture, not a bolt-on. This is where design-first builders separate from volume contractors.'],
      ['Do additions require permits and engineering?', 'Yes, always. Every addition is engineered to code and permitted in our name. We manage the structural tie-in to your existing home so it is done correctly and inspected properly.'],
      ['How long does a home addition take?', 'It depends on size and complexity, from a single room to a multi-room expansion. We give you a clear timeline at the design consultation and keep you updated through every milestone.'],
    ],
  },
];

// ── Page template ───────────────────────────────────────────────
function renderPage(s) {
  const otherServices = SERVICES.filter(x => x.slug !== s.slug);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": s.faqs.map(([q, a]) => ({
      "@type": "Question",
      "name": q.replace(/&amp;/g, '&'),
      "acceptedAnswer": { "@type": "Answer", "text": a.replace(/&amp;/g, '&') }
    }))
  };
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": s.h1,
    "provider": { "@type": "LocalBusiness", "name": "Cirilo Design + Build", "@id": SITE + "/#business" },
    "areaServed": { "@type": "State", "name": "North Carolina" },
    "description": s.metaDesc.replace(/&amp;/g, '&')
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${s.title}</title>
<meta name="description" content="${s.metaDesc}">
<link rel="canonical" href="${SITE}/${s.slug}">
<meta property="og:type" content="website">
<meta property="og:title" content="${s.title}">
<meta property="og:description" content="${s.metaDesc}">
<meta property="og:url" content="${SITE}/${s.slug}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(serviceSchema)}</script>
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/brand.css">
</head>
<body>

<!--#include file="_header.html" -->

<main>

  <section class="hero-dark">
    <div class="container">
      <div class="eyebrow mb-sm">${s.eyebrow}</div>
      <h1 style="font-size:var(--fs-hero);max-width:14ch;margin-bottom:var(--space-md);">${s.h1}</h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.82);max-width:620px;margin-bottom:var(--space-lg);">${s.lede}</p>
      <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
        <a href="/contact" class="btn btn-primary">Book a Design Consultation</a>
        <a href="/portfolio" class="btn btn-ghost">See the Work</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container-narrow">
      <p style="font-size:1.15rem;line-height:1.8;color:var(--body);">${s.intro}</p>
    </div>
  </section>

  <section class="section" style="padding-top:0;">
    <div class="container">
      <div class="text-center" style="max-width:640px;margin:0 auto var(--space-xl);">
        <div class="eyebrow mb-sm">What's Included</div>
        <h2>Built into every project.</h2>
      </div>
      <div class="grid grid-3">
        ${s.features.map(([title, body]) => `<div class="card" style="border-top:3px solid var(--gold-dark);">
          <h3 style="font-size:1.25rem;color:var(--ink);margin-bottom:var(--space-sm);">${title}</h3>
          <p style="font-size:0.95rem;color:var(--body);margin:0;">${body}</p>
        </div>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section class="section" style="background:var(--gold-pale);">
    <div class="container">
      <div class="text-center" style="max-width:640px;margin:0 auto var(--space-xl);">
        <div class="eyebrow mb-sm">How It Works</div>
        <h2>Design-build, one accountable team.</h2>
      </div>
      <div class="grid grid-4">
        <div class="why-card"><div class="why-num">01</div><h4 style="font-family:var(--font-display);text-transform:none;letter-spacing:0;color:var(--ink);font-size:1.2rem;">Consultation</h4><p style="font-size:0.92rem;">On-site visit. Vision, lifestyle, budget, timeline, and property assessment.</p></div>
        <div class="why-card"><div class="why-num">02</div><h4 style="font-family:var(--font-display);text-transform:none;letter-spacing:0;color:var(--ink);font-size:1.2rem;">Design</h4><p style="font-size:0.92rem;">Site evaluation, measurements, 3D concepts, revisions, and material selection.</p></div>
        <div class="why-card"><div class="why-num">03</div><h4 style="font-family:var(--font-display);text-transform:none;letter-spacing:0;color:var(--ink);font-size:1.2rem;">Build</h4><p style="font-size:0.92rem;">Permitted and engineered. One project manager from groundbreak to final inspection.</p></div>
        <div class="why-card"><div class="why-num">04</div><h4 style="font-family:var(--font-display);text-transform:none;letter-spacing:0;color:var(--ink);font-size:1.2rem;">Closeout</h4><p style="font-size:0.92rem;">Final walkthrough, orientation, warranty registration, and ongoing support.</p></div>
      </div>
      <div class="text-center" style="margin-top:var(--space-xl);">
        <a href="/process" class="btn btn-secondary">See Our Full Process</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container-narrow">
      <div class="text-center" style="margin-bottom:var(--space-xl);">
        <div class="eyebrow mb-sm">Common Questions</div>
        <h2>${s.h1} FAQ</h2>
      </div>
      ${s.faqs.map(([q, a]) => `<details class="faq-item">
        <summary>${q}</summary>
        <p>${a}</p>
      </details>`).join('\n      ')}
    </div>
  </section>

  <section class="section" style="padding-top:0;">
    <div class="container">
      <div class="cta-block">
        <div>
          <div class="eyebrow mb-sm" style="color:var(--gold-mid);">Start Here</div>
          <h2 style="color:var(--white);margin-bottom:var(--space-sm);">Book a Design Consultation</h2>
          <p style="color:rgba(255,255,255,0.78);margin:0;max-width:520px;">60 minutes on-site. We walk your property, talk through what's possible, and leave you with a clear sense of design and budget. No obligation.</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-sm);">
          <a href="/contact" class="btn btn-primary">Book Consultation</a>
          <a href="tel:+19104090648" class="btn btn-ghost">Call (910) 409-0648</a>
        </div>
      </div>
    </div>
  </section>

</main>

<!--#include file="_footer.html" -->

<script>
(function(){try{var k='cdb_jsid';var s=sessionStorage.getItem(k)||('s_'+Math.random().toString(36).slice(2)+Date.now().toString(36));sessionStorage.setItem(k,s);fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:'view',page:'service',service:'${s.slug}',session_id:s,url:location.pathname,title:document.title,referrer:document.referrer||null}),keepalive:true}).catch(function(){});}catch(e){}})();
</script>

<style>
  .cta-block { background: var(--navy); color: var(--white); padding: var(--space-xl); border-radius: var(--radius-lg); display: grid; grid-template-columns: 1.4fr auto; gap: var(--space-xl); align-items: center; position: relative; overflow: hidden; }
  .cta-block::before { content:''; position:absolute; inset:0; background: radial-gradient(circle at 100% 50%, rgba(171,126,55,0.18) 0%, transparent 60%); pointer-events:none; }
  .cta-block > * { position: relative; z-index: 1; }
  @media (max-width: 860px) { .cta-block { grid-template-columns: 1fr; } }
  .faq-item { border-bottom: 1px solid var(--border); padding: var(--space-md) 0; }
  .faq-item summary { font-family: var(--font-display); font-size: 1.2rem; color: var(--ink); cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  .faq-item summary::after { content: '+'; color: var(--gold-dark); font-size: 1.5rem; font-weight: 300; }
  .faq-item[open] summary::after { content: '\\2212'; }
  .faq-item p { margin: var(--space-sm) 0 0; color: var(--body); font-size: 0.98rem; }
  .why-card { padding: var(--space-md); }
</style>

</body>
</html>
`;
}

let count = 0;
for (const s of SERVICES) {
  fs.writeFileSync(path.join(PAGES, s.slug + '.html'), renderPage(s));
  console.log('✓', s.slug + '.html');
  count++;
}
console.log(`\n${count} service pages written to pages/`);
