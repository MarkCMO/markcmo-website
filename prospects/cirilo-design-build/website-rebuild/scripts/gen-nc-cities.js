// gen-nc-cities.js - statewide NC city pages (the long tail not already in
// /service-areas/). URL: /north-carolina/<slug>/  + hub /north-carolina/
// Outer-Charlotte-region towns are local; the rest are framed honestly as
// destination / signature projects. Templated variation, LocalBusiness + FAQ.
// Run: node scripts/gen-nc-cities.js
const fs = require('fs');
const path = require('path');
const { SITE, page, hub, hashPick, hashPick2 } = require('./_geo-lib.js');

const OUT = path.join(__dirname, '..', 'pages', 'north-carolina');
fs.mkdirSync(OUT, { recursive: true });
const slugify = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// region => { destination, cities[] }
const REGIONS = {
  'Greater Charlotte (Outer)': { destination: false, cities: ['Shelby','Kings Mountain','Cherryville','Bessemer City','Stanley','Dallas','Lowell','Locust','Stanfield','Oakboro','Albemarle','Norwood','Wadesboro','Marshville','Wingate','Midland','Maiden','Lake Park','Fairview'] },
  'The Triangle': { destination: true, cities: ['Apex','Morrisville','Wake Forest','Holly Springs','Fuquay-Varina','Garner','Clayton','Knightdale','Wendell','Zebulon','Hillsborough','Pittsboro','Carrboro','Smithfield'] },
  'The Triad': { destination: true, cities: ['High Point','Burlington','Kernersville','Clemmons','Lewisville','Asheboro','Thomasville','Lexington','Graham','Mebane','Reidsville','Eden','Summerfield','Oak Ridge','Jamestown'] },
  'Sandhills': { destination: true, cities: ['Southern Pines','Aberdeen','Sanford','Fayetteville','Laurinburg','Lumberton','Rockingham','Hamlet'] },
  'Western NC & Mountains': { destination: true, cities: ['Hendersonville','Boone','Brevard','Waynesville','Black Mountain','Lake Lure','Morganton','Lenoir','Marion','Banner Elk','Sylva','Franklin','Cullowhee','Valdese','Forest City','Rutherfordton','Weaverville','Hudson'] },
  'Eastern NC & The Coast': { destination: true, cities: ['Wrightsville Beach','Carolina Beach','Southport','Leland','Hampstead','New Bern','Morehead City','Beaufort','Emerald Isle','Jacksonville','Greenville','Washington','Edenton','Nags Head','Kitty Hawk','Kill Devil Hills','Manteo','Elizabeth City','Kinston','Goldsboro','Rocky Mount','Wilson','Tarboro','Dunn','Clinton','Whiteville'] },
};

const ALL = [];
Object.keys(REGIONS).forEach(region => REGIONS[region].cities.forEach(name => {
  ALL.push({ name, slug: slugify(name), region, destination: REGIONS[region].destination });
}));

const LOCAL_OPEN = [
  c => `${c.name} sits within easy reach of our Charlotte base, and we build custom pools here regularly.`,
  c => `A custom concrete pool in ${c.name} turns the backyard into a private resort, engineered for the Carolina climate.`,
  c => `Homeowners in ${c.name} come to Cirilo Design + Build for a backyard that matches the quality of the home.`,
  c => `In ${c.name}, we design and build custom pools and full outdoor living as one accountable team.`,
];
const LOCAL_MID = [
  c => `We handle design, engineering, permitting, and HOA approval locally, with one point of contact from concept to fill day.`,
  c => `Every pool is gunite-built and engineered for our soil and seasons, with the detailing fine homes call for.`,
  c => `Pool, spa, outdoor kitchen, fire, and landscape are designed together as one cohesive environment.`,
];
const DEST_OPEN = [
  c => `Cirilo Design + Build takes on select signature pool and outdoor-living projects in ${c.name}.`,
  c => `For homeowners in ${c.name} who want a truly custom concrete pool, we bring our full design-build team to your site.`,
  c => `${c.name} is one of the destinations where we build signature projects across North Carolina.`,
];
const DEST_MID = [
  c => `On destination builds we bring our engineering-first process and partner with vetted local trades, all under one accountable point of contact.`,
  c => `We confirm a clear scope, budget, and timeline up front, including travel and logistics, so a ${c.name} project runs as smoothly as a local one.`,
  c => `From concept and 3D design to fill day, the same team that builds our Charlotte projects builds your ${c.name} pool.`,
];

function relatedFor(c) {
  const same = ALL.filter(x => x.region === c.region && x.slug !== c.slug).slice(0, 8);
  const links = same.map(x => ({ href: `/north-carolina/${x.slug}`, name: x.name }));
  links.push({ href: '/service-areas/', name: 'All Service Areas' });
  links.push({ href: '/pool-builder-near-me', name: 'Pool Builder Near Me' });
  return links;
}

function renderCity(c) {
  const localBiz = {
    "@context":"https://schema.org","@type":"LocalBusiness",
    "name": `Cirilo Design + Build - ${c.name} Pool Builder`,
    "description": `Luxury custom concrete pool builder serving ${c.name}, NC.`,
    "url": `${SITE}/north-carolina/${c.slug}`,
    "telephone": "+1-910-409-0648",
    "areaServed": { "@type":"City", "name": c.name },
    "parentOrganization": { "@type":"LocalBusiness", "name":"Cirilo Design + Build", "@id": SITE+"/#business" }
  };
  const faqs = c.destination ? [
    [`Does Cirilo Design + Build take projects in ${c.name}?`, `Yes, on a select basis. We take on signature custom pool and outdoor-living projects in ${c.name} as destination builds, bringing our full design-build team and partnering with vetted local trades under one accountable point of contact.`],
    [`How much does a custom pool cost in ${c.name}?`, `Luxury custom concrete pools typically run $100 to $250 per square foot, with most fully integrated builds landing between $150,000 and $400,000. For destination projects we confirm a clear budget range up front, including travel and logistics.`],
    [`How do I start a ${c.name} project?`, `Reach out about your project. For destination builds we start with a call and a site review, then bring the team to ${c.name}.`],
  ] : [
    [`Do you build custom pools in ${c.name}?`, `Yes. Cirilo Design + Build designs and builds custom concrete pools, outdoor living, renovations, and additions in ${c.name} and the surrounding area. We handle permitting and HOA approval locally.`],
    [`How much does a custom pool cost in ${c.name}?`, `Luxury custom concrete pools in the ${c.name} area typically run $100 to $250 per square foot, with most fully integrated builds landing between $150,000 and $400,000. We provide a clear budget range at your on-site consultation.`],
    [`How do I get started on a pool in ${c.name}?`, `Book a design consultation. We come to your ${c.name} property, assess the site, and walk through your vision, budget, and timeline. No obligation.`],
  ];
  const faqSchema = { "@context":"https://schema.org","@type":"FAQPage","mainEntity": faqs.map(([q,ans])=>({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":ans}})) };
  const open = c.destination ? hashPick(c.slug, DEST_OPEN) : hashPick(c.slug, LOCAL_OPEN);
  const mid = c.destination ? hashPick2(c.slug, DEST_MID) : hashPick2(c.slug, LOCAL_MID);
  const bodyParas = [
    open(c) + ' ' + mid(c),
    c.destination
      ? `Tell us about your ${c.name} home and your vision, and we will scope a signature build worthy of the setting.`
      : `If you are planning a pool or outdoor living project in ${c.name}, we would love to walk your site.`,
  ];
  return page({
    title: `Pool Builder in ${c.name}, NC | Cirilo Design + Build`,
    desc: `Custom concrete pool builder serving ${c.name}, NC. Luxury pools, spas, and outdoor living, design-build, permitted and engineered. ${c.destination ? 'Signature projects statewide.' : 'Book a consultation.'}`,
    ogDesc: `Custom pools and outdoor living for ${c.name}, NC.`,
    canonicalPath: `/north-carolina/${c.slug}`,
    eyebrow: `North Carolina / ${c.region}`,
    h1: `Pool Builder in ${c.name}`,
    heroSub: c.destination
      ? `Custom concrete pools and outdoor living in ${c.name}. For signature projects across North Carolina, we bring the full Cirilo design-build team, engineering-first, one accountable point of contact from concept to fill day.`
      : `Custom concrete pools and outdoor living in ${c.name}. Design-build under one roof, permitted and engineered, one accountable team from concept to fill day.`,
    ctaLabel: c.destination ? `Start a ${c.name} Project` : `Book a ${c.name} Consultation`,
    bodyEyebrow: `Custom Pools in ${c.name}`,
    bodyH2: `Built for ${c.name} homes.`,
    bodyParas,
    serveLine: `Serving ${c.name} and the surrounding ${c.region} area.`,
    faqEyebrow: `${c.name} Pool FAQ`,
    faqH2: `Common questions in ${c.name}.`,
    faqs,
    relatedTitle: 'Nearby in North Carolina',
    related: relatedFor(c),
    ctaEyebrow: `${c.name} Projects`,
    ctaH2: `Let's design your ${c.name} backyard.`,
    ctaSub: c.destination ? 'Destination and signature projects across North Carolina. Tell us about your site.' : 'On-site consultation, no obligation. We come to you.',
    ctaBtn: c.destination ? 'Start a Project' : 'Book Consultation',
    trackPage: 'nc-city',
    trackExtra: { area: c.slug },
    jsonld: [localBiz, faqSchema],
  });
}

function renderHub() {
  const groups = Object.keys(REGIONS).map(region => {
    const list = ALL.filter(c => c.region === region);
    return `<div style="margin-bottom:var(--space-xl);">
        <div class="eyebrow mb-sm">${region}</div>
        <div class="areas-strip"><div class="areas-links">
          ${list.map(c=>`<a href="/north-carolina/${c.slug}">${c.name}</a>`).join('\n          ')}
        </div></div>
      </div>`;
  }).join('\n      ');
  const itemList = { "@context":"https://schema.org","@type":"ItemList","itemListElement": ALL.map((c,i)=>({"@type":"ListItem","position":i+1,"name":c.name,"url":`${SITE}/north-carolina/${c.slug}`})) };
  return hub({
    title: `North Carolina Pool Builder | Statewide Service | Cirilo Design + Build`,
    desc: `Cirilo Design + Build builds custom pools and outdoor living across North Carolina, from the Charlotte metro to the Triangle, Triad, Sandhills, mountains, and coast.`,
    canonicalPath: `/north-carolina/`,
    eyebrow: 'Across North Carolina',
    h1: 'North Carolina Pool Builder',
    intro: `Based in Charlotte, building across North Carolina. Find your city below, or reach out about a signature project anywhere in the state.`,
    body: groups,
    trackPage: 'nc-cities-hub',
    jsonld: [itemList],
  });
}

let count = 0;
fs.writeFileSync(path.join(OUT, 'index.html'), renderHub()); count++;
for (const c of ALL) { fs.writeFileSync(path.join(OUT, c.slug + '.html'), renderCity(c)); count++; }
console.log(`${count} NC city pages written (1 hub + ${ALL.length} cities)`);
