// gen-near-me.js - "near me" landing pages + an internal-link directory that
// helps search engines crawl the full geo footprint. Run: node scripts/gen-near-me.js
const fs = require('fs');
const path = require('path');
const { SITE, page } = require('./_geo-lib.js');

const PAGES = path.join(__dirname, '..', 'pages');

// Headline areas surfaced directly on the near-me pages (the hubs link to the rest).
const TOP_AREAS = [
  ['/service-areas/charlotte','Charlotte'],['/service-areas/southpark','SouthPark'],['/service-areas/myers-park','Myers Park'],
  ['/service-areas/ballantyne','Ballantyne'],['/service-areas/waxhaw','Waxhaw'],['/service-areas/weddington','Weddington'],
  ['/service-areas/lake-norman','Lake Norman'],['/service-areas/cornelius','Cornelius'],['/service-areas/mooresville','Mooresville'],
  ['/service-areas/huntersville','Huntersville'],['/service-areas/concord','Concord'],['/service-areas/matthews','Matthews'],
  ['/service-areas/fort-mill','Fort Mill'],['/service-areas/indian-land','Indian Land'],['/service-areas/belmont','Belmont'],
  ['/service-areas/marvin','Marvin'],['/service-areas/davidson','Davidson'],['/service-areas/mint-hill','Mint Hill'],
];
const HUBS = [
  ['/service-areas/','All Service Areas'],['/neighborhoods/','Charlotte Neighborhoods'],
  ['/pool-builder/','Browse by ZIP Code'],['/north-carolina/','All of North Carolina'],
];

function nearMe(o) {
  const localBiz = {
    "@context":"https://schema.org","@type":"LocalBusiness","name":"Cirilo Design + Build",
    "@id": SITE+"/#business", "description": o.desc, "url": `${SITE}${o.canonicalPath}`,
    "telephone":"+1-910-409-0648","priceRange":"$$$",
    "areaServed":[{"@type":"State","name":"North Carolina"},{"@type":"City","name":"Charlotte"}]
  };
  const faqSchema = { "@context":"https://schema.org","@type":"FAQPage","mainEntity": o.faqs.map(([q,a])=>({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}})) };
  const related = HUBS.map(([h,n])=>({href:h,name:n})).concat(TOP_AREAS.map(([h,n])=>({href:h,name:n})));
  return page({
    title: o.title, desc: o.desc, ogDesc: o.desc, canonicalPath: o.canonicalPath,
    eyebrow: 'Charlotte & North Carolina', h1: o.h1, heroSub: o.heroSub, ctaLabel: 'Book a Consultation',
    bodyEyebrow: o.bodyEyebrow, bodyH2: o.bodyH2, bodyParas: o.bodyParas,
    serveLine: 'Based in Charlotte. Serving the entire metro and across North Carolina.',
    faqEyebrow: 'Near Me FAQ', faqH2: 'What "near me" means with Cirilo.', faqs: o.faqs,
    relatedTitle: 'Find Your Area', related,
    ctaEyebrow: 'Get Started', ctaH2: o.ctaH2, ctaSub: 'On-site consultation, no obligation. We come to you.',
    ctaBtn: 'Book Consultation', trackPage: 'near-me', trackExtra: { area: o.slug },
    jsonld: [localBiz, faqSchema],
  });
}

const DEFS = [
  {
    slug: 'pool-builder-near-me', dir: 'pool-builder-near-me',
    title: 'Pool Builder Near Me | Charlotte & North Carolina | Cirilo Design + Build',
    desc: 'Searching for a pool builder near you? Cirilo Design + Build is a luxury custom concrete pool builder serving the Charlotte metro and all of North Carolina. Design-build, permitted and engineered.',
    canonicalPath: '/pool-builder-near-me',
    h1: 'Pool Builder Near Me',
    heroSub: 'If you are searching for a custom pool builder near you in the Charlotte area or anywhere in North Carolina, you have found the right team. Design-build under one roof, one accountable point of contact from concept to fill day.',
    bodyEyebrow: 'Local, Wherever You Are', bodyH2: 'A custom pool builder near you.',
    bodyParas: [
      'Cirilo Design + Build designs and builds custom concrete pools, spas, and full outdoor living across the Charlotte metro and throughout North Carolina. Wherever your home is, we bring the same engineering-first process, the same craftsmanship, and one team responsible for the whole project.',
      'Pick your area below to see local details, pricing guidance, and answers specific to your community, or just reach out and we will come walk your site.',
    ],
    ctaH2: 'Find your area and let\'s talk.',
    faqs: [
      ['How do I find a pool builder near me?','Start with your community. Use the area, neighborhood, and ZIP code directories below to find local details, then book a consultation. We come to your property anywhere in the Charlotte metro, and take signature projects across North Carolina.'],
      ['Do you serve my area?','We serve the entire Charlotte metro, Lake Norman, Union County, Cabarrus, Gaston, the South Carolina line, and build signature projects statewide. If you do not see your spot, reach out and ask.'],
      ['How much does a custom pool cost?','Luxury custom concrete pools typically run $100 to $250 per square foot, with most fully integrated builds landing between $150,000 and $400,000. We confirm a clear range at your consultation.'],
    ],
  },
  {
    slug: 'custom-pool-builder-near-me', dir: 'custom-pool-builder-near-me',
    title: 'Custom Pool Builder Near Me | Charlotte NC | Cirilo Design + Build',
    desc: 'A custom, concrete, design-build pool builder near you. Cirilo Design + Build serves Charlotte and North Carolina with gunite pools, spas, and outdoor living engineered for the Carolina climate.',
    canonicalPath: '/custom-pool-builder-near-me',
    h1: 'Custom Pool Builder Near Me',
    heroSub: 'Not a franchise and not a fiberglass drop-in. Cirilo Design + Build is a true custom, gunite, design-build pool builder serving Charlotte and North Carolina.',
    bodyEyebrow: 'Truly Custom', bodyH2: 'Custom means built for your lot.',
    bodyParas: [
      'Every Cirilo pool is engineered to the site and designed around how you live, not pulled from a catalog. Gunite construction, integrated spas and outdoor living, and finishes that match the home.',
      'Choose your area below for local detail, or reach out for an on-site consultation anywhere in the Charlotte metro and across North Carolina.',
    ],
    ctaH2: 'Design a pool that fits your home.',
    faqs: [
      ['What makes a pool builder "custom"?','A custom builder engineers each pool to your specific lot and vision rather than installing a pre-formed shell. We design pool, spa, hardscape, and landscape together as one environment.'],
      ['Do you build gunite or fiberglass pools?','We build gunite (shotcrete) concrete pools, which allow any shape, depth, and finish and are engineered for the Carolina climate.'],
      ['Where do you build?','Across the Charlotte metro and throughout North Carolina. See the directory below to find your area.'],
    ],
  },
  {
    slug: 'pool-renovation-near-me', dir: 'pool-renovation-near-me',
    title: 'Pool Renovation Near Me | Charlotte NC | Cirilo Design + Build',
    desc: 'Pool renovation and remodeling near you. Cirilo Design + Build resurfaces, redesigns, and modernizes pools across Charlotte and North Carolina.',
    canonicalPath: '/pool-renovation-near-me',
    h1: 'Pool Renovation Near Me',
    heroSub: 'Bring a dated pool back to life. Cirilo Design + Build handles resurfacing, retiling, equipment upgrades, and full redesigns across Charlotte and North Carolina.',
    bodyEyebrow: 'Renovation & Remodel', bodyH2: 'Reimagine the pool you already have.',
    bodyParas: [
      'From a clean resurface to a full backyard redesign with new decking, spa, and outdoor living, we modernize existing pools with the same engineering-first care as a new build.',
      'Find your area below or reach out for an on-site assessment anywhere in the Charlotte metro and across North Carolina.',
    ],
    ctaH2: 'Let\'s assess your pool.',
    faqs: [
      ['Do you renovate pools near me?','Yes. We handle pool renovation and remodeling throughout the Charlotte metro and across North Carolina. Use the directory below to find your area.'],
      ['What does a pool renovation include?','Anything from resurfacing and retiling to new equipment, lighting, decking, spa additions, and full redesigns. We scope it to your goals and budget.'],
      ['How much does a pool renovation cost?','It depends on scope, from a focused resurface to a complete redesign. We provide a clear range at your on-site assessment.'],
    ],
  },
  {
    slug: 'outdoor-living-near-me', dir: 'outdoor-living-near-me',
    title: 'Outdoor Living & Kitchen Builder Near Me | Charlotte NC | Cirilo Design + Build',
    desc: 'Outdoor living, outdoor kitchens, fire features, and hardscape near you. Cirilo Design + Build creates complete outdoor environments across Charlotte and North Carolina.',
    canonicalPath: '/outdoor-living-near-me',
    h1: 'Outdoor Living Near Me',
    heroSub: 'Outdoor kitchens, fire features, pergolas, and hardscape, designed as one environment with your pool. Serving Charlotte and North Carolina.',
    bodyEyebrow: 'Beyond the Pool', bodyH2: 'A complete outdoor environment.',
    bodyParas: [
      'A pool is the centerpiece, but the kitchen, fire, shade, and hardscape are what make a backyard livable all year. We design and build the whole environment as one project.',
      'Choose your area below for local detail, or reach out for an on-site consultation anywhere in the Charlotte metro and across North Carolina.',
    ],
    ctaH2: 'Design your whole backyard.',
    faqs: [
      ['Do you build outdoor kitchens near me?','Yes. We design and build outdoor kitchens, fire features, pergolas, and hardscape throughout the Charlotte metro and across North Carolina.'],
      ['Can outdoor living be built with my pool?','Absolutely, and it should be. Designing pool and outdoor living together produces a single cohesive environment and a smoother build.'],
      ['Where do you work?','Across the Charlotte metro and throughout North Carolina. Find your area in the directory below.'],
    ],
  },
];

let count = 0;
for (const d of DEFS) {
  const dir = path.join(PAGES, d.dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), nearMe(d));
  count++;
  console.log('OK /' + d.slug + '/');
}
console.log(`\n${count} near-me pages written`);
