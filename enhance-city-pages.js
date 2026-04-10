#!/usr/bin/env node
/**
 * enhance-city-pages.js
 * Adds nearby-city internal links + enhanced FAQ schema to all location pages.
 * Run: node enhance-city-pages.js
 */

const fs = require('fs');
const path = require('path');

const LOC_DIR = path.join(__dirname, 'location');

// ── State → cities mapping (slugs matching actual filenames) ──────────────────
const STATE_CITIES = {
  'alabama': ['birmingham','huntsville','mobile','montgomery','tuscaloosa'],
  'alaska': ['anchorage','fairbanks','juneau'],
  'arizona': ['chandler','gilbert','glendale','mesa','peoria','phoenix','scottsdale','tempe','tucson'],
  'arkansas': ['fayetteville','little-rock'],
  'california': ['anaheim','bakersfield','chula-vista','fresno','irvine','long-beach','los-angeles','modesto','oakland','riverside','sacramento','san-diego','san-francisco','san-jose','santa-ana','stockton'],
  'colorado': ['aurora','colorado-springs','denver','fort-collins'],
  'connecticut': ['bridgeport','hartford','new-haven','stamford'],
  'delaware': ['dover','wilmington'],
  'florida': ['cape-coral','clearwater','fort-lauderdale','hialeah','jacksonville','miami','miami-gardens','miramar','orlando','pembroke-pines','port-st-lucie','st-petersburg','sunrise','tallahassee','tampa'],
  'georgia': ['atlanta','augusta','columbus','macon','savannah'],
  'hawaii': ['honolulu','hilo'],
  'idaho': ['boise','nampa'],
  'illinois': ['aurora','chicago','joliet','naperville','peoria','rockford','springfield'],
  'indiana': ['evansville','fort-wayne','indianapolis','south-bend'],
  'iowa': ['cedar-rapids','des-moines'],
  'kansas': ['kansas-city','overland-park','topeka','wichita'],
  'kentucky': ['bowling-green','lexington','louisville'],
  'louisiana': ['baton-rouge','new-orleans','shreveport'],
  'maine': ['portland'],
  'maryland': ['baltimore','columbia','frederick'],
  'massachusetts': ['boston','cambridge','lowell','springfield','worcester'],
  'michigan': ['ann-arbor','detroit','grand-rapids','lansing','sterling-heights','warren'],
  'minnesota': ['minneapolis','rochester','saint-paul'],
  'mississippi': ['gulfport','jackson'],
  'missouri': ['kansas-city','saint-louis','springfield'],
  'montana': ['billings','missoula'],
  'nebraska': ['lincoln','omaha'],
  'nevada': ['henderson','las-vegas','reno'],
  'new-hampshire': ['concord','manchester','nashua'],
  'new-jersey': ['jersey-city','newark','paterson'],
  'new-mexico': ['albuquerque','las-cruces','santa-fe'],
  'new-york': ['buffalo','new-york-city','rochester','syracuse','yonkers'],
  'north-carolina': ['charlotte','durham','greensboro','raleigh','winston-salem'],
  'north-dakota': ['bismarck','fargo'],
  'ohio': ['akron','cincinnati','cleveland','columbus','dayton','toledo'],
  'oklahoma': ['norman','oklahoma-city','tulsa'],
  'oregon': ['eugene','portland','salem'],
  'pennsylvania': ['allentown','erie','philadelphia','pittsburgh'],
  'rhode-island': ['cranston','providence','warwick'],
  'south-carolina': ['charleston','columbia','north-charleston'],
  'south-dakota': ['rapid-city','sioux-falls'],
  'tennessee': ['chattanooga','clarksville','knoxville','memphis','nashville'],
  'texas': ['arlington','austin','corpus-christi','dallas','el-paso','fort-worth','houston','irving','laredo','lubbock','plano','san-antonio'],
  'utah': ['provo','salt-lake-city','west-valley-city'],
  'vermont': ['burlington'],
  'virginia': ['alexandria','chesapeake','norfolk','richmond','virginia-beach'],
  'washington': ['bellevue','seattle','spokane','tacoma'],
  'west-virginia': ['charleston','huntington'],
  'wisconsin': ['green-bay','madison','milwaukee'],
  'wyoming': ['casper','cheyenne'],
};

// Prettify a slug → "Kansas City"
function prettify(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Find which state owns a city slug
function getStateForCity(citySlug) {
  for (const [state, cities] of Object.entries(STATE_CITIES)) {
    if (cities.includes(citySlug)) return state;
  }
  return null;
}

// Get nearby cities for a city slug (up to 5, excluding itself)
function getNearbyCities(citySlug, stateSlug) {
  const stateCities = STATE_CITIES[stateSlug] || [];
  return stateCities.filter(c => c !== citySlug).slice(0, 5);
}

// ── Nearby section HTML ───────────────────────────────────────────────────────
function nearbySection(citySlug, stateSlug, nearbyCities) {
  const stateName = prettify(stateSlug);
  const cityName  = prettify(citySlug);
  const links = nearbyCities.map(c =>
    `<a href="/location/fractional-cmo-${c}" class="loc-nearby-link">Fractional CMO ${prettify(c)}</a>`
  ).join('\n        ');
  const stateLink = `<a href="/location/fractional-cmo-${stateSlug}" class="loc-nearby-link">Fractional CMO ${stateName} (state)</a>`;

  return `
<section class="loc-nearby">
  <div class="loc-nearby-inner">
    <p class="loc-nearby-label">Also Serving ${stateName}</p>
    <div class="loc-nearby-links">
        ${stateLink}
        ${links}
    </div>
  </div>
</section>
`;
}

// ── FAQ schema for city pages ─────────────────────────────────────────────────
function faqSchema(cityName, stateName) {
  return `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How much does a fractional CMO cost in ${cityName}?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Fractional CMO engagements in ${cityName} typically range from $4,000 to $15,000 per month depending on scope and hours. This compares to $280,000-$420,000 per year for a full-time CMO hire. Mark Gabrielli offers month-to-month engagements with no long-term contracts."
      }
    },
    {
      "@type": "Question",
      "name": "Does Mark Gabrielli work with companies in ${cityName}, ${stateName}?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Mark Gabrielli provides fractional CMO and COO services to growth-stage companies across ${cityName} and the broader ${stateName} market. Engagements are primarily remote with on-site availability for key strategy sessions and board meetings."
      }
    },
    {
      "@type": "Question",
      "name": "What industries does Mark serve in ${cityName}?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Mark Gabrielli has fractional CMO experience across B2B SaaS, healthcare, aerospace, manufacturing, professional services, and tech startups. He works with companies generating $500K to $50M in revenue that need senior marketing leadership without the full-time executive cost."
      }
    }
  ]
}
</script>`;
}

// ── CSS to inject once (only if not already present) ─────────────────────────
const NEARBY_CSS = `
    .loc-nearby { padding: 2.5rem 6vw; background: rgba(201,168,76,0.03); border-top: 1px solid rgba(201,168,76,0.1); }
    .loc-nearby-inner { max-width: 1100px; margin: 0 auto; }
    .loc-nearby-label { font-family: 'DM Mono', monospace; font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(201,168,76,0.6); margin-bottom: 1rem; }
    .loc-nearby-links { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .loc-nearby-link { font-family: 'DM Mono', monospace; font-size: 0.7rem; padding: 0.35rem 0.9rem; border: 1px solid rgba(201,168,76,0.18); color: rgba(255,255,255,0.6); text-decoration: none; border-radius: 999px; transition: all 0.18s; }
    .loc-nearby-link:hover { border-color: rgba(201,168,76,0.5); color: var(--gold); }
`;

// ── Main processing ───────────────────────────────────────────────────────────
const files = fs.readdirSync(LOC_DIR).filter(f => f.endsWith('.html'));
let updated = 0, skipped = 0;

for (const file of files) {
  const filepath = path.join(LOC_DIR, file);
  let html = fs.readFileSync(filepath, 'utf8');

  // Skip if already processed
  if (html.includes('loc-nearby')) { skipped++; continue; }

  // Extract city and state from filename: fractional-cmo-chicago.html → chicago
  const base = file.replace('fractional-cmo-', '').replace('.html', '');

  // Determine if state page or city page
  let citySlug, stateSlug;
  const stateKeys = Object.keys(STATE_CITIES);

  if (stateKeys.includes(base)) {
    // State page — link to top cities in that state
    stateSlug = base;
    citySlug = null;
  } else {
    citySlug = base;
    stateSlug = getStateForCity(base);
  }

  if (!stateSlug) { skipped++; continue; }

  const cityName  = citySlug  ? prettify(citySlug)  : prettify(stateSlug);
  const stateName = prettify(stateSlug);

  // Build nearby links
  let nearbyCities;
  if (citySlug) {
    nearbyCities = getNearbyCities(citySlug, stateSlug);
  } else {
    // State page — link to top 5 cities
    nearbyCities = (STATE_CITIES[stateSlug] || []).slice(0, 5);
  }

  const nearbySectionHtml = nearbySection(citySlug || stateSlug, stateSlug, nearbyCities);
  const faqSchemaHtml = faqSchema(cityName, stateName);

  // Inject CSS into <style> block
  html = html.replace(/(<style>[\s\S]*?)(\.loc-cta\s*\{)/,
    (m, p1, p2) => p1 + NEARBY_CSS + '\n    ' + p2
  );
  // Fallback: append to existing <style>
  if (!html.includes('.loc-nearby')) {
    html = html.replace(/<\/style>/, NEARBY_CSS + '\n    </style>');
  }

  // Inject nearby section before <footer>
  html = html.replace('<footer', nearbySectionHtml + '<footer');

  // Inject FAQ schema before </body>
  html = html.replace('</body>', faqSchemaHtml + '\n</body>');

  fs.writeFileSync(filepath, html, 'utf8');
  updated++;
}

console.log(`Done. Updated: ${updated}, Skipped (already done or unmapped): ${skipped}`);
