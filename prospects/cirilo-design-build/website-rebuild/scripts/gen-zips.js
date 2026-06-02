// gen-zips.js - a page for every Charlotte-metro ZIP code.
// URL: /pool-builder/<zip>/  + hub /pool-builder/
// Each ZIP maps to its place + city, cross-links to the matching area page,
// and lists nearby ZIPs. LocalBusiness + FAQPage schema. Templated variation.
// Run: node scripts/gen-zips.js
const fs = require('fs');
const path = require('path');
const { SITE, page, hub, hashPick, hashPick2 } = require('./_geo-lib.js');

const OUT = path.join(__dirname, '..', 'pages', 'pool-builder');
fs.mkdirSync(OUT, { recursive: true });

// zip, place (neighborhoods/area), city, region, svc (matching area slug or '')
const ZIPS = [
  // ── Charlotte (Mecklenburg) ──
  ['28202','Uptown and Center City','Charlotte','Charlotte','charlotte'],
  ['28203','South End and Dilworth','Charlotte','Charlotte','dilworth'],
  ['28204','Elizabeth and Cherry','Charlotte','Charlotte','elizabeth'],
  ['28205','Plaza Midwood and NoDa','Charlotte','Charlotte','plaza-midwood'],
  ['28206','NoDa and Druid Hills','Charlotte','Charlotte','charlotte'],
  ['28207','Myers Park and Eastover','Charlotte','Charlotte','myers-park'],
  ['28208','West Charlotte and Ashley Park','Charlotte','Charlotte','charlotte'],
  ['28209','Madison Park and Montford','Charlotte','Charlotte','charlotte'],
  ['28210','SouthPark and Quail Hollow','Charlotte','Charlotte','southpark'],
  ['28211','Cotswold and Foxcroft','Charlotte','Charlotte','cotswold'],
  ['28212','East Charlotte and Idlewild','Charlotte','Charlotte','charlotte'],
  ['28213','University City North','Charlotte','Charlotte','charlotte'],
  ['28214','Mountain Island and Coulwood','Charlotte','Charlotte','charlotte'],
  ['28215','Hickory Grove and Windsor Park','Charlotte','Charlotte','charlotte'],
  ['28216','Northwest Charlotte and Oakdale','Charlotte','Charlotte','charlotte'],
  ['28217','Yorkmount and Southwest Charlotte','Charlotte','Charlotte','charlotte'],
  ['28226','Carmel and Sardis','Charlotte','Charlotte','quail-hollow'],
  ['28227','East Charlotte and Mint Hill','Charlotte','Charlotte','mint-hill'],
  ['28262','University City','Charlotte','Charlotte','charlotte'],
  ['28269','Highland Creek and North Charlotte','Charlotte','Charlotte','charlotte'],
  ['28270','Sardis and Providence','Charlotte','Charlotte','providence'],
  ['28273','Steele Creek','Charlotte','Charlotte','charlotte'],
  ['28277','Ballantyne and Piper Glen','Charlotte','Charlotte','ballantyne'],
  ['28278','Steele Creek and Lake Wylie side','Charlotte','Charlotte','charlotte'],
  // ── Mecklenburg towns ──
  ['28078','Huntersville','Huntersville','Lake Norman','huntersville'],
  ['28031','Cornelius','Cornelius','Lake Norman','cornelius'],
  ['28036','Davidson','Davidson','Lake Norman','davidson'],
  ['28105','Matthews','Matthews','Charlotte','matthews'],
  ['28134','Pineville','Pineville','Charlotte','pineville'],
  ['28104','Weddington and Wesley Chapel','Weddington','Union County','weddington'],
  // ── Union County ──
  ['28173','Waxhaw and Marvin','Waxhaw','Union County','waxhaw'],
  ['28079','Indian Trail','Indian Trail','Union County','indian-trail'],
  ['28110','Monroe','Monroe','Union County','monroe'],
  ['28112','South Monroe','Monroe','Union County','monroe'],
  ['28108','Mineral Springs','Mineral Springs','Union County','unionville'],
  // ── Cabarrus County ──
  ['28025','Concord','Concord','Cabarrus County','concord'],
  ['28027','West Concord','Concord','Cabarrus County','concord'],
  ['28075','Harrisburg','Harrisburg','Cabarrus County','harrisburg'],
  ['28081','Kannapolis','Kannapolis','Cabarrus County','kannapolis'],
  ['28083','East Kannapolis','Kannapolis','Cabarrus County','kannapolis'],
  ['28107','Midland','Midland','Cabarrus County','mount-pleasant'],
  ['28124','Mount Pleasant','Mount Pleasant','Cabarrus County','mount-pleasant'],
  // ── Gaston County ──
  ['28012','Belmont','Belmont','Gaston County','belmont'],
  ['28054','Gastonia','Gastonia','Gaston County','gastonia'],
  ['28056','South Gastonia','Gastonia','Gaston County','gastonia'],
  ['28052','West Gastonia','Gastonia','Gaston County','gastonia'],
  ['28120','Mount Holly','Mount Holly','Gaston County','mount-holly'],
  ['28164','Stanley','Stanley','Gaston County','mount-holly'],
  ['28021','Cherryville','Cherryville','Gaston County','gastonia'],
  // ── Lake Norman / Iredell ──
  ['28115','Mooresville','Mooresville','Lake Norman','mooresville'],
  ['28117','Lake Norman Mooresville','Mooresville','Lake Norman','mooresville'],
  ['28037','Denver','Denver','Lake Norman','denver'],
  ['28673','Sherrills Ford','Sherrills Ford','Lake Norman','sherrills-ford'],
  ['28166','Troutman','Troutman','Iredell County','troutman'],
  ['28625','Statesville','Statesville','Iredell County','statesville'],
  ['28677','West Statesville','Statesville','Iredell County','statesville'],
  // ── Rowan County ──
  ['28144','Salisbury','Salisbury','Rowan County','salisbury'],
  ['28146','South Salisbury','Salisbury','Rowan County','salisbury'],
  ['28147','West Salisbury','Salisbury','Rowan County','salisbury'],
  ['28023','China Grove','China Grove','Rowan County','china-grove'],
  // ── Lincoln / Catawba ──
  ['28092','Lincolnton','Lincolnton','Lincoln County','lincolnton'],
  ['28601','Hickory','Hickory','Catawba Valley','hickory'],
  ['28602','Southwest Hickory','Hickory','Catawba Valley','hickory'],
  ['28658','Newton','Newton','Catawba Valley','newton'],
  ['28613','Conover','Conover','Catawba Valley','conover'],
  // ── South Carolina line ──
  ['29707','Indian Land','Indian Land','South Carolina Line','indian-land'],
  ['29708','Fort Mill and Tega Cay','Fort Mill','South Carolina Line','fort-mill'],
  ['29715','Fort Mill','Fort Mill','South Carolina Line','fort-mill'],
  ['29710','Lake Wylie and Clover','Lake Wylie','South Carolina Line','lake-wylie'],
  ['29730','Rock Hill','Rock Hill','South Carolina Line','rock-hill'],
  ['29732','Northwest Rock Hill','Rock Hill','South Carolina Line','rock-hill'],
  ['29745','York','York','South Carolina Line','york'],
].map(([zip, place, city, region, svc]) => ({ zip, place, city, region, svc }));

const OPENERS = [
  z => `Looking for a custom pool builder in ${z.zip}? Cirilo Design + Build serves ${z.place} and the rest of ${z.city}.`,
  z => `The ${z.zip} ZIP code covers ${z.place}, and the backyards here deserve a pool built to match the homes.`,
  z => `In ${z.zip} (${z.place}, ${z.city}), a custom concrete pool turns the backyard into a private resort.`,
  z => `Homeowners across ${z.zip} trust Cirilo Design + Build for custom pools and outdoor living in ${z.place}.`,
];
const MIDDLES = [
  z => `We design and build custom concrete pools, spas, outdoor kitchens, and full outdoor living, handling permitting and HOA approval throughout ${z.city}.`,
  z => `Every project is gunite-built and engineered for the Carolina climate, with one accountable team from concept to fill day.`,
  z => `Pool, spa, hardscape, fire, and landscape are designed together as one environment, tailored to your ${z.place} lot.`,
  z => `Design-build under one roof means one point of contact and one schedule for your entire ${z.place} project.`,
];

function relatedFor(z) {
  const same = ZIPS.filter(x => x.region === z.region && x.zip !== z.zip).slice(0, 7);
  const links = same.map(x => ({ href: `/pool-builder/${x.zip}`, name: `${x.zip} ${x.city}` }));
  if (z.svc) links.unshift({ href: `/service-areas/${z.svc}`, name: `${z.city} (area guide)` });
  links.push({ href: '/pool-builder-near-me', name: 'Pool Builder Near Me' });
  return links;
}

function renderZip(z) {
  const cityState = z.region === 'South Carolina Line' ? `${z.city}, SC` : `${z.city}, NC`;
  const localBiz = {
    "@context":"https://schema.org","@type":"LocalBusiness",
    "name": `Cirilo Design + Build - Pool Builder ${z.zip}`,
    "description": `Luxury custom concrete pool builder serving ZIP code ${z.zip} (${z.place}) in ${cityState}.`,
    "url": `${SITE}/pool-builder/${z.zip}`,
    "telephone": "+1-910-409-0648",
    "areaServed": { "@type":"PostalCodeSpecification", "postalCode": z.zip, "addressCountry": "US" },
    "parentOrganization": { "@type":"LocalBusiness", "name":"Cirilo Design + Build", "@id": SITE+"/#business" }
  };
  const faqs = [
    [`Do you build custom pools in ${z.zip}?`, `Yes. Cirilo Design + Build designs and builds custom concrete pools, outdoor living, renovations, and additions throughout ${z.zip} (${z.place}) and the rest of ${z.city}. We handle permitting and HOA approval locally.`],
    [`How much does a custom pool cost in ${z.zip}?`, `Luxury custom concrete pools in the ${z.city} area typically run $100 to $250 per square foot, with most fully integrated builds landing between $150,000 and $400,000. We confirm a clear budget range at your on-site consultation.`],
    [`How do I get started in ${z.zip}?`, `Book a design consultation. We come to your ${z.place} property in ${z.zip}, assess the site, and walk through your vision, budget, and timeline. No obligation.`],
  ];
  const faqSchema = { "@context":"https://schema.org","@type":"FAQPage","mainEntity": faqs.map(([q,ans])=>({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":ans}})) };
  const bodyParas = [
    hashPick(z.zip, OPENERS)(z) + ' ' + hashPick2(z.zip, MIDDLES)(z),
    z.svc ? `For a full overview of pools and outdoor living in this area, see our <a href="/service-areas/${z.svc}">${z.city} area guide</a>. When you are ready, we will come walk your site in ${z.zip}.` : `When you are ready, we will come walk your site in ${z.zip} and show you what is possible on your lot.`,
  ];
  return page({
    title: `Pool Builder ${z.zip} | ${z.place}, ${z.city} | Cirilo Design + Build`,
    desc: `Custom concrete pool builder in ${z.zip} (${z.place}, ${cityState}). Luxury pools, spas, and outdoor living, design-build, permitted and engineered. Book a consultation.`,
    ogDesc: `Custom pools and outdoor living in ${z.zip}, ${z.place}.`,
    canonicalPath: `/pool-builder/${z.zip}`,
    eyebrow: `${z.city} / ${z.region}`,
    h1: `Pool Builder in ${z.zip}`,
    heroSub: `Custom concrete pools and outdoor living for ${z.place} in ${cityState}. Design-build under one roof, permitted and engineered, one accountable team from concept to fill day.`,
    ctaLabel: `Book a Consultation`,
    bodyEyebrow: `Custom Pools in ${z.zip}`,
    bodyH2: `Serving ${z.place}.`,
    bodyParas,
    serveLine: `ZIP ${z.zip}, covering ${z.place} and the surrounding ${z.city} area.`,
    faqEyebrow: `${z.zip} Pool FAQ`,
    faqH2: `Common questions in ${z.zip}.`,
    faqs,
    relatedTitle: 'Nearby ZIP Codes',
    related: relatedFor(z),
    ctaEyebrow: `${z.zip} Projects`,
    ctaH2: `Let's design your ${z.city} backyard.`,
    ctaSub: 'On-site consultation, no obligation. We come to you.',
    ctaBtn: 'Book Consultation',
    trackPage: 'zip',
    trackExtra: { area: z.zip },
    jsonld: [localBiz, faqSchema],
  });
}

function renderHub() {
  const regions = [];
  ZIPS.forEach(z => { if (regions.indexOf(z.region) === -1) regions.push(z.region); });
  const groups = regions.map(region => {
    const list = ZIPS.filter(z => z.region === region);
    return `<div style="margin-bottom:var(--space-xl);">
        <div class="eyebrow mb-sm">${region}</div>
        <div class="areas-strip"><div class="areas-links">
          ${list.map(z=>`<a href="/pool-builder/${z.zip}">${z.zip} ${z.place}</a>`).join('\n          ')}
        </div></div>
      </div>`;
  }).join('\n      ');
  const itemList = { "@context":"https://schema.org","@type":"ItemList","itemListElement": ZIPS.map((z,i)=>({"@type":"ListItem","position":i+1,"name":`${z.zip} ${z.place}`,"url":`${SITE}/pool-builder/${z.zip}`})) };
  return hub({
    title: `Pool Builder by ZIP Code | Charlotte Metro & NC | Cirilo Design + Build`,
    desc: `Find a custom pool builder by ZIP code across the Charlotte metro and North Carolina. Cirilo Design + Build serves every ZIP from Uptown to Lake Norman, Union County, and the SC line.`,
    canonicalPath: `/pool-builder/`,
    eyebrow: 'By ZIP Code',
    h1: 'Pool Builder by ZIP Code',
    intro: `Custom pools and outdoor living across the Charlotte metro and North Carolina, organized by ZIP code. Find yours below.`,
    body: groups,
    trackPage: 'zips-hub',
    jsonld: [itemList],
  });
}

let count = 0;
fs.writeFileSync(path.join(OUT, 'index.html'), renderHub()); count++;
for (const z of ZIPS) { fs.writeFileSync(path.join(OUT, z.zip + '.html'), renderZip(z)); count++; }
console.log(`${count} ZIP pages written (1 hub + ${ZIPS.length} ZIPs)`);
