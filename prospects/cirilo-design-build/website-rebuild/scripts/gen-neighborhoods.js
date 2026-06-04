// gen-neighborhoods.js - a page for every Charlotte neighborhood.
// URL: /neighborhoods/<slug>/  + hub /neighborhoods/
// Templated-but-varied local copy (deterministic per slug), LocalBusiness +
// FAQPage schema, sector-aware internal links. Run: node scripts/gen-neighborhoods.js
const fs = require('fs');
const path = require('path');
const { SITE, page, hub, hashPick, hashPick2 } = require('./_geo-lib.js');

const OUT = path.join(__dirname, '..', 'pages', 'neighborhoods');
fs.mkdirSync(OUT, { recursive: true });

const slugify = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// sector => [neighborhood names]. Real Charlotte neighborhoods.
const SECTORS = {
  'Center City & Historic': ['Fourth Ward','Third Ward','First Ward','Second Ward','South End','Dilworth','Wilmore','Sedgefield','Wesley Heights','Cherry','Elizabeth','Plaza Midwood','NoDa','Optimist Park','Belmont','Villa Heights','Chantilly','Commonwealth','Country Club Heights'],
  'South Charlotte': ['Myers Park','Eastover','Foxcroft','Barclay Downs','Sharon Hills','SouthPark','Montford','Madison Park','Montclaire','Starmount','Quail Hollow','Beverly Woods','Mountainbrook','Carmel','Olde Providence','Providence Plantation','Raintree','Piper Glen','Ballantyne','Ardrey Kell','Blakeney','Stonecrest','Provincetowne','McAlpine','Sardis Woods','Sardis Forest','Cotswold','Oakhurst','Sheffield Park','Beverly Crest','Seven Eagles','Foxcroft East'],
  'East Charlotte': ['Eastland','Hickory Grove','Windsor Park','Shamrock Gardens','Grier Heights','Echo Hills','Idlewild','Farm Pond','Sheffield','Winterfield','Amity Gardens','Eastway','Sheffield Manor'],
  'West & Southwest': ['Ashley Park','Enderly Park','Bryant Park','Westover Hills','Wesley Heights West','Steele Creek','Berewick','Ayrsley','Yorkmount','Whitehall','Olde Whitehall','Reafield','Madison Park West','Westerly Hills','Smallwood','Seversville','Biddleville'],
  'North & University': ['University City','Newell','Prosperity Church','Highland Creek','Mallard Creek','Hidden Valley','Derita','Croft','Oakdale','Long Creek','Druid Hills','Lockwood','Camp Greene','Back Creek','Stoney Creek','Mineral Springs North','Northlake','Reames'],
  'Lake & Northwest': ['Mountain Island','Coulwood','Paw Creek','Thrift','Hovis','Whitewater','Riverbend'],
};

// neighborhood => parent context (city is Charlotte for all here).
const ALL = [];
Object.keys(SECTORS).forEach(sector => SECTORS[sector].forEach(name => {
  ALL.push({ name, slug: slugify(name), sector });
}));

const OPENERS = [
  n => `${n.name} is one of Charlotte's distinctive ${n.sectorLow} neighborhoods, and the backyards here deserve the same care as the homes.`,
  n => `In ${n.name}, a custom pool is not just an amenity, it is the centerpiece of how the home lives outdoors.`,
  n => `Homeowners in ${n.name} come to Cirilo Design + Build for one reason: a backyard that matches the quality of the house.`,
  n => `${n.name} blends Charlotte character with real demand for high-end outdoor living, and that is exactly what we build.`,
  n => `A custom concrete pool in ${n.name} turns an ordinary lot into a private resort, engineered for the Carolina climate.`,
  n => `From the first site walk to fill day, we design and build custom pools in ${n.name} as one accountable team.`,
];
const MIDDLES = [
  n => `We design and build custom concrete pools, spas, and full outdoor living, handling permitting and HOA approval locally so the process stays simple for you.`,
  n => `Every project is gunite-built and engineered for our soil and seasons, with the detailing and finishes ${n.name} homes call for.`,
  n => `Whether the lot is tight and historic or open and modern, we engineer the pool to the site rather than forcing a template onto it.`,
  n => `Pool, spa, outdoor kitchen, fire, and landscape are designed together as one environment, not bolted on piece by piece.`,
  n => `Design-build under one roof means one point of contact, one schedule, and one team responsible from concept to completion.`,
];
const CLOSERS = [
  n => `If you are planning a pool or outdoor living project in ${n.name}, we would love to walk your site.`,
  n => `When you are ready to reimagine your ${n.name} backyard, the first step is a no-obligation on-site consultation.`,
  n => `Tell us about your ${n.name} home and your vision, and we will show you what is possible on your lot.`,
];

function relatedFor(a) {
  const same = ALL.filter(x => x.sector === a.sector && x.slug !== a.slug).slice(0, 8);
  const links = same.map(x => ({ href: `/neighborhoods/${x.slug}`, name: x.name }));
  links.push({ href: '/service-areas/charlotte', name: 'Charlotte (overview)' });
  links.push({ href: '/pool-builder-near-me', name: 'Pool Builder Near Me' });
  return links;
}

function renderNeighborhood(a) {
  a.sectorLow = a.sector.toLowerCase().replace(' charlotte', '').replace(' & ', ' and ');
  const localBiz = {
    "@context":"https://schema.org","@type":"LocalBusiness",
    "name": `Cirilo Design + Build - ${a.name} Pool Builder`,
    "description": `Luxury custom concrete pool builder serving the ${a.name} neighborhood of Charlotte, NC.`,
    "url": `${SITE}/neighborhoods/${a.slug}`,
    "telephone": "+1-910-409-0648",
    "areaServed": { "@type":"Place", "name": `${a.name}, Charlotte, NC` },
    "parentOrganization": { "@type":"LocalBusiness", "name":"Cirilo Design + Build", "@id": SITE+"/#business" }
  };
  const faqs = [
    [`Do you build custom pools in ${a.name}?`, `Yes. Cirilo Design + Build designs and builds custom concrete pools, outdoor living, renovations, and additions throughout ${a.name} and across Charlotte. We handle permitting and HOA approval locally.`],
    [`How much does a custom pool cost in ${a.name}?`, `Luxury custom concrete pools in Charlotte typically run $100 to $250 per square foot, with most fully integrated builds landing between $150,000 and $400,000. We confirm a clear budget range at your on-site consultation in ${a.name}.`],
    [`How do I get started in ${a.name}?`, `Book a design consultation. We come to your ${a.name} home, assess the site, and walk through your vision, budget, and timeline. No obligation.`],
  ];
  const faqSchema = { "@context":"https://schema.org","@type":"FAQPage","mainEntity": faqs.map(([q,ans])=>({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":ans}})) };
  const bodyParas = [
    hashPick(a.slug, OPENERS)(a) + ' ' + hashPick2(a.slug, MIDDLES)(a),
    hashPick2(a.slug + 'c', CLOSERS)(a),
  ];
  return page({
    title: `Pool Builder in ${a.name}, Charlotte NC | Cirilo Design + Build`,
    desc: `Custom concrete pool builder serving ${a.name} in Charlotte, NC. Luxury pools, spas, and outdoor living, design-build, permitted and engineered. Book a consultation.`,
    ogDesc: `Custom pools and outdoor living for ${a.name}, Charlotte NC.`,
    canonicalPath: `/neighborhoods/${a.slug}`,
    eyebrow: `Charlotte / ${a.sector}`,
    h1: `Pool Builder in ${a.name}`,
    heroSub: `Custom concrete pools and outdoor living for ${a.name}, one of Charlotte's ${a.sectorLow} neighborhoods. Design-build under one roof, permitted and engineered, one accountable team from concept to fill day.`,
    ctaLabel: `Book a ${a.name} Consultation`,
    bodyEyebrow: `Custom Pools in ${a.name}`,
    bodyH2: `Built for ${a.name} homes.`,
    bodyParas,
    serveLine: `Serving ${a.name} and the surrounding ${a.sector} area of Charlotte.`,
    faqEyebrow: `${a.name} Pool FAQ`,
    faqH2: `Common questions in ${a.name}.`,
    faqs,
    relatedTitle: 'Nearby Neighborhoods',
    related: relatedFor(a),
    ctaEyebrow: `${a.name} Projects`,
    ctaH2: `Let's design your ${a.name} backyard.`,
    ctaSub: 'On-site consultation, no obligation. We come to you.',
    ctaBtn: 'Book Consultation',
    trackPage: 'neighborhood',
    trackExtra: { area: a.slug },
    jsonld: [localBiz, faqSchema],
  });
}

function renderHub() {
  const groups = Object.keys(SECTORS).map(sector => {
    const list = ALL.filter(a => a.sector === sector);
    return `<div style="margin-bottom:var(--space-xl);">
        <div class="eyebrow mb-sm">${sector}</div>
        <div class="areas-strip"><div class="areas-links">
          ${list.map(a=>`<a href="/neighborhoods/${a.slug}">${a.name}</a>`).join('\n          ')}
        </div></div>
      </div>`;
  }).join('\n      ');
  const itemList = { "@context":"https://schema.org","@type":"ItemList","itemListElement": ALL.map((a,i)=>({"@type":"ListItem","position":i+1,"name":a.name,"url":`${SITE}/neighborhoods/${a.slug}`})) };
  return hub({
    title: `Charlotte Neighborhoods We Serve | Pool Builder | Cirilo Design + Build`,
    desc: `Cirilo Design + Build builds custom pools and outdoor living in every Charlotte neighborhood, from Myers Park and SouthPark to NoDa, Ballantyne, University City, and beyond.`,
    canonicalPath: `/neighborhoods/`,
    eyebrow: 'Charlotte, By Neighborhood',
    h1: 'Charlotte Neighborhoods',
    intro: `Custom pools and outdoor living in every corner of Charlotte. Find your neighborhood below, or reach out and we will come to you.`,
    body: groups,
    trackPage: 'neighborhoods-hub',
    jsonld: [itemList],
  });
}

let count = 0;
fs.writeFileSync(path.join(OUT, 'index.html'), renderHub()); count++;
for (const a of ALL) { fs.writeFileSync(path.join(OUT, a.slug + '.html'), renderNeighborhood(a)); count++; }
console.log(`${count} neighborhood pages written (1 hub + ${ALL.length} neighborhoods)`);
