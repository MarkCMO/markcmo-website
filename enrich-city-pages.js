#!/usr/bin/env node
/**
 * enrich-city-pages.js
 * Rebuilds every fractional-cmo-[city]-[state].html with:
 *   - Market research + Census/BLS external citations
 *   - 3 rotating client testimonials
 *   - Anonymized case study (matched to primary industry)
 *   - Expert quote from Mark
 *   - Fractional CMO vs. alternatives comparison table
 *   - Multi-CTA booking funnel
 *   - Enhanced FAQ (7 questions)
 *   - Internal + high-DA external links
 *
 * Run: node enrich-city-pages.js
 */

const fs   = require('fs');
const path = require('path');
const ROOT = __dirname;

// ─── CITY DATA ────────────────────────────────────────────────────────────────
// slug → { city, stateAbbr, stateName, pop, businesses, industries[], gdpBlurb }
const CITIES = {
  // ── Top metros ──
  'new-york-ny':       { city:'New York',         stateAbbr:'NY', stateName:'New York',       pop:'8.3M',  businesses:'220,000+', industries:['fintech','media','fashion','B2B SaaS'],    gdpBlurb:'the largest US metro economy at $2.1T GDP' },
  'los-angeles-ca':    { city:'Los Angeles',       stateAbbr:'CA', stateName:'California',     pop:'3.9M',  businesses:'240,000+', industries:['entertainment','tech','healthcare','real estate'], gdpBlurb:'a $1T+ metro economy driven by entertainment and tech' },
  'chicago-il':        { city:'Chicago',           stateAbbr:'IL', stateName:'Illinois',       pop:'2.7M',  businesses:'155,000+', industries:['finance','logistics','manufacturing','healthcare'], gdpBlurb:'the Midwest commercial capital with 400+ Fortune 500 firms nearby' },
  'houston-tx':        { city:'Houston',           stateAbbr:'TX', stateName:'Texas',          pop:'2.3M',  businesses:'145,000+', industries:['energy','healthcare','aerospace','logistics'], gdpBlurb:'the energy capital of the US with a $500B+ metro GDP' },
  'phoenix-az':        { city:'Phoenix',           stateAbbr:'AZ', stateName:'Arizona',        pop:'1.6M',  businesses:'110,000+', industries:['real estate','healthcare','tech','financial services'], gdpBlurb:'one of the fastest-growing metros in the US' },
  'philadelphia-pa':   { city:'Philadelphia',      stateAbbr:'PA', stateName:'Pennsylvania',   pop:'1.6M',  businesses:'90,000+',  industries:['healthcare','pharma','finance','education'],  gdpBlurb:'a major East Coast healthcare and education hub' },
  'san-antonio-tx':    { city:'San Antonio',       stateAbbr:'TX', stateName:'Texas',          pop:'1.4M',  businesses:'85,000+',  industries:['military','healthcare','tourism','finance'],  gdpBlurb:'a rapidly diversifying economy anchored by military and healthcare' },
  'san-diego-ca':      { city:'San Diego',         stateAbbr:'CA', stateName:'California',     pop:'1.4M',  businesses:'100,000+', industries:['defense','biotech','tourism','tech'],         gdpBlurb:'a defense and biotech powerhouse on the Pacific coast' },
  'dallas-tx':         { city:'Dallas',            stateAbbr:'TX', stateName:'Texas',          pop:'1.3M',  businesses:'120,000+', industries:['finance','tech','real estate','telecom'],     gdpBlurb:'a $600B+ metro and top US destination for corporate relocations' },
  'san-jose-ca':       { city:'San Jose',          stateAbbr:'CA', stateName:'California',     pop:'1.0M',  businesses:'85,000+',  industries:['semiconductor','SaaS','AI','venture capital'], gdpBlurb:'the capital of Silicon Valley and global tech innovation' },
  'austin-tx':         { city:'Austin',            stateAbbr:'TX', stateName:'Texas',          pop:'980K',  businesses:'88,000+',  industries:['tech','SaaS','clean energy','creative'],      gdpBlurb:'the fastest-growing major tech hub in the US' },
  'jacksonville-fl':   { city:'Jacksonville',      stateAbbr:'FL', stateName:'Florida',        pop:'950K',  businesses:'70,000+',  industries:['finance','logistics','healthcare','defense'],  gdpBlurb:'Florida\'s largest city by land area and a logistics hub' },
  'fort-worth-tx':     { city:'Fort Worth',        stateAbbr:'TX', stateName:'Texas',          pop:'920K',  businesses:'65,000+',  industries:['aerospace','manufacturing','energy','logistics'], gdpBlurb:'a manufacturing and aerospace hub anchoring the DFW Metroplex' },
  'columbus-oh':       { city:'Columbus',          stateAbbr:'OH', stateName:'Ohio',           pop:'900K',  businesses:'72,000+',  industries:['insurance','retail','education','healthcare'], gdpBlurb:'Ohio\'s capital and home to a fast-growing tech and insurance sector' },
  'charlotte-nc':      { city:'Charlotte',         stateAbbr:'NC', stateName:'North Carolina', pop:'875K',  businesses:'75,000+',  industries:['banking','finance','tech','logistics'],       gdpBlurb:'the second-largest banking center in the US after New York' },
  'indianapolis-in':   { city:'Indianapolis',      stateAbbr:'IN', stateName:'Indiana',        pop:'875K',  businesses:'60,000+',  industries:['pharma','manufacturing','logistics','tech'],  gdpBlurb:'the crossroads of America and a fast-growing Midwest tech hub' },
  'san-francisco-ca':  { city:'San Francisco',     stateAbbr:'CA', stateName:'California',     pop:'870K',  businesses:'95,000+',  industries:['fintech','SaaS','biotech','AI'],              gdpBlurb:'the global epicenter of venture capital and enterprise SaaS' },
  'seattle-wa':        { city:'Seattle',           stateAbbr:'WA', stateName:'Washington',     pop:'750K',  businesses:'82,000+',  industries:['cloud tech','aerospace','biotech','retail'],  gdpBlurb:'the home of Amazon and Microsoft and a top US tech corridor' },
  'denver-co':         { city:'Denver',            stateAbbr:'CO', stateName:'Colorado',       pop:'715K',  businesses:'75,000+',  industries:['cannabis','aerospace','tech','healthcare'],   gdpBlurb:'one of the top US cities for startup formation and tech growth' },
  'nashville-tn':      { city:'Nashville',         stateAbbr:'TN', stateName:'Tennessee',      pop:'700K',  businesses:'62,000+',  industries:['healthcare','music','hospitality','finance'], gdpBlurb:'the healthcare capital of the US and a booming entrepreneurial hub' },
  'oklahoma-city-ok':  { city:'Oklahoma City',     stateAbbr:'OK', stateName:'Oklahoma',       pop:'695K',  businesses:'48,000+',  industries:['energy','aerospace','healthcare','logistics'], gdpBlurb:'an energy and aerospace hub with a rapidly diversifying economy' },
  'el-paso-tx':        { city:'El Paso',           stateAbbr:'TX', stateName:'Texas',          pop:'680K',  businesses:'45,000+',  industries:['military','healthcare','manufacturing','retail'], gdpBlurb:'a binational economy with deep US-Mexico trade ties' },
  'washington-dc':     { city:'Washington',        stateAbbr:'DC', stateName:'DC',             pop:'670K',  businesses:'85,000+',  industries:['government tech','defense','consulting','nonprofits'], gdpBlurb:'the government contracting and consulting capital of the US' },
  'boston-ma':         { city:'Boston',            stateAbbr:'MA', stateName:'Massachusetts',  pop:'655K',  businesses:'88,000+',  industries:['biotech','edtech','finance','healthcare'],    gdpBlurb:'the world\'s leading biotech and life sciences cluster' },
  'memphis-tn':        { city:'Memphis',           stateAbbr:'TN', stateName:'Tennessee',      pop:'630K',  businesses:'40,000+',  industries:['logistics','healthcare','manufacturing','retail'], gdpBlurb:'the logistics hub of the US South and home to FedEx HQ' },
  'louisville-ky':     { city:'Louisville',        stateAbbr:'KY', stateName:'Kentucky',       pop:'620K',  businesses:'42,000+',  industries:['healthcare','bourbon','logistics','manufacturing'], gdpBlurb:'a healthcare and logistics hub with a unique manufacturing identity' },
  'portland-or':       { city:'Portland',          stateAbbr:'OR', stateName:'Oregon',         pop:'650K',  businesses:'65,000+',  industries:['tech','manufacturing','outdoor retail','food & bev'], gdpBlurb:'a hub for sustainable tech, outdoor brands, and creative industries' },
  'las-vegas-nv':      { city:'Las Vegas',         stateAbbr:'NV', stateName:'Nevada',         pop:'645K',  businesses:'58,000+',  industries:['hospitality','gaming','real estate','events'], gdpBlurb:'the entertainment capital of the world with a growing tech sector' },
  'milwaukee-wi':      { city:'Milwaukee',         stateAbbr:'WI', stateName:'Wisconsin',      pop:'590K',  businesses:'38,000+',  industries:['manufacturing','healthcare','finance','food'],  gdpBlurb:'a manufacturing and healthcare hub on the Great Lakes' },
  'albuquerque-nm':    { city:'Albuquerque',       stateAbbr:'NM', stateName:'New Mexico',     pop:'565K',  businesses:'38,000+',  industries:['government','healthcare','tech','energy'],     gdpBlurb:'a growing tech and government contracting hub in the Southwest' },
  'tucson-az':         { city:'Tucson',            stateAbbr:'AZ', stateName:'Arizona',        pop:'545K',  businesses:'35,000+',  industries:['defense','healthcare','education','solar'],    gdpBlurb:'a defense and aerospace hub anchored by Davis-Monthan AFB' },
  'fresno-ca':         { city:'Fresno',            stateAbbr:'CA', stateName:'California',     pop:'540K',  businesses:'34,000+',  industries:['agriculture','healthcare','logistics','retail'], gdpBlurb:'the agricultural and logistics capital of California\'s Central Valley' },
  'sacramento-ca':     { city:'Sacramento',        stateAbbr:'CA', stateName:'California',     pop:'525K',  businesses:'48,000+',  industries:['government','healthcare','ag-tech','real estate'], gdpBlurb:'California\'s capital with a fast-growing tech and ag-tech economy' },
  'kansas-city-mo':    { city:'Kansas City',       stateAbbr:'MO', stateName:'Missouri',       pop:'510K',  businesses:'45,000+',  industries:['finance','logistics','healthcare','agriculture'], gdpBlurb:'the logistics crossroads of America and a fast-growing tech hub' },
  'atlanta-ga':        { city:'Atlanta',           stateAbbr:'GA', stateName:'Georgia',        pop:'500K',  businesses:'88,000+',  industries:['tech','finance','healthcare','film'],         gdpBlurb:'the commercial capital of the Southeast and a major Fortune 500 hub' },
  'omaha-ne':          { city:'Omaha',             stateAbbr:'NE', stateName:'Nebraska',       pop:'490K',  businesses:'38,000+',  industries:['insurance','finance','healthcare','food'],    gdpBlurb:'the insurance and financial services capital of the Great Plains' },
  'colorado-springs-co':{ city:'Colorado Springs', stateAbbr:'CO', stateName:'Colorado',      pop:'480K',  businesses:'38,000+',  industries:['defense','aerospace','tech','healthcare'],    gdpBlurb:'the Space Force and aerospace hub of the Rocky Mountain West' },
  'raleigh-nc':        { city:'Raleigh',           stateAbbr:'NC', stateName:'North Carolina', pop:'470K',  businesses:'50,000+',  industries:['biotech','SaaS','education','pharma'],        gdpBlurb:'the anchor of Research Triangle Park, a top US biotech and tech cluster' },
  'miami-fl':          { city:'Miami',             stateAbbr:'FL', stateName:'Florida',        pop:'455K',  businesses:'88,000+',  industries:['fintech','real estate','healthcare','tourism'], gdpBlurb:'the gateway to Latin America and a booming fintech and real estate hub' },
  'minneapolis-mn':    { city:'Minneapolis',       stateAbbr:'MN', stateName:'Minnesota',      pop:'430K',  businesses:'55,000+',  industries:['healthcare','retail','finance','food'],       gdpBlurb:'a Fortune 500 hub with 17 Fortune 500 companies in the metro' },
  'tulsa-ok':          { city:'Tulsa',             stateAbbr:'OK', stateName:'Oklahoma',       pop:'400K',  businesses:'32,000+',  industries:['energy','aerospace','finance','healthcare'],  gdpBlurb:'the energy and aerospace hub of eastern Oklahoma' },
  'arlington-tx':      { city:'Arlington',         stateAbbr:'TX', stateName:'Texas',          pop:'395K',  businesses:'28,000+',  industries:['sports','entertainment','manufacturing','logistics'], gdpBlurb:'an entertainment and manufacturing hub at the heart of the DFW Metroplex' },
  'new-orleans-la':    { city:'New Orleans',       stateAbbr:'LA', stateName:'Louisiana',      pop:'385K',  businesses:'30,000+',  industries:['tourism','energy','healthcare','maritime'],   gdpBlurb:'a tourism and energy hub with a rich entrepreneurial culture' },
  'wichita-ks':        { city:'Wichita',           stateAbbr:'KS', stateName:'Kansas',         pop:'395K',  businesses:'30,000+',  industries:['aerospace','manufacturing','healthcare','agriculture'], gdpBlurb:'the air capital of the world with deep aerospace manufacturing roots' },
  'tampa-fl':          { city:'Tampa',             stateAbbr:'FL', stateName:'Florida',        pop:'395K',  businesses:'42,000+',  industries:['finance','healthcare','logistics','tech'],    gdpBlurb:'one of Florida\'s fastest-growing business markets' },
  'cleveland-oh':      { city:'Cleveland',         stateAbbr:'OH', stateName:'Ohio',           pop:'380K',  businesses:'32,000+',  industries:['healthcare','manufacturing','finance','biomedical'], gdpBlurb:'the global center for healthcare innovation and biomedical research' },
  'bakersfield-ca':    { city:'Bakersfield',       stateAbbr:'CA', stateName:'California',     pop:'380K',  businesses:'28,000+',  industries:['oil & gas','agriculture','logistics','healthcare'], gdpBlurb:'the oil, gas, and agricultural hub of California\'s Central Valley' },
  'aurora-co':         { city:'Aurora',            stateAbbr:'CO', stateName:'Colorado',       pop:'370K',  businesses:'28,000+',  industries:['healthcare','aerospace','defense','logistics'], gdpBlurb:'a healthcare and aerospace hub anchoring the Denver metro\'s east side' },
  'anaheim-ca':        { city:'Anaheim',           stateAbbr:'CA', stateName:'California',     pop:'350K',  businesses:'30,000+',  industries:['tourism','manufacturing','tech','healthcare'], gdpBlurb:'the theme park and convention center capital of Southern California' },
  'santa-ana-ca':      { city:'Santa Ana',         stateAbbr:'CA', stateName:'California',     pop:'310K',  businesses:'24,000+',  industries:['manufacturing','healthcare','retail','finance'], gdpBlurb:'a manufacturing and retail hub in the heart of Orange County' },
  'corpus-christi-tx': { city:'Corpus Christi',    stateAbbr:'TX', stateName:'Texas',          pop:'315K',  businesses:'22,000+',  industries:['petrochemicals','military','tourism','port'],  gdpBlurb:'a major Gulf Coast port and petrochemical hub' },
  'riverside-ca':      { city:'Riverside',         stateAbbr:'CA', stateName:'California',     pop:'315K',  businesses:'24,000+',  industries:['logistics','healthcare','education','manufacturing'], gdpBlurb:'a logistics and distribution hub for the Inland Empire' },
  'lexington-ky':      { city:'Lexington',         stateAbbr:'KY', stateName:'Kentucky',       pop:'310K',  businesses:'25,000+',  industries:['healthcare','education','bourbon','horse industry'], gdpBlurb:'the thoroughbred capital of the world with a growing healthcare sector' },
  'stockton-ca':       { city:'Stockton',          stateAbbr:'CA', stateName:'California',     pop:'310K',  businesses:'20,000+',  industries:['agriculture','logistics','healthcare','retail'], gdpBlurb:'the agricultural and logistics gateway to California\'s Central Valley' },
  'pittsburgh-pa':     { city:'Pittsburgh',        stateAbbr:'PA', stateName:'Pennsylvania',   pop:'305K',  businesses:'35,000+',  industries:['healthcare','robotics','finance','education'],  gdpBlurb:'a reinvented industrial city now leading in robotics, AI, and healthcare' },
  'st-louis-mo':       { city:'St. Louis',         stateAbbr:'MO', stateName:'Missouri',       pop:'300K',  businesses:'38,000+',  industries:['healthcare','biotech','finance','manufacturing'], gdpBlurb:'a healthcare and biotech hub with a strong manufacturing legacy' },
  'anchorage-ak':      { city:'Anchorage',         stateAbbr:'AK', stateName:'Alaska',         pop:'290K',  businesses:'18,000+',  industries:['oil & gas','tourism','transportation','government'], gdpBlurb:'the commercial and logistics hub of Alaska' },
  'cincinnati-oh':     { city:'Cincinnati',        stateAbbr:'OH', stateName:'Ohio',           pop:'310K',  businesses:'32,000+',  industries:['consumer goods','finance','healthcare','manufacturing'], gdpBlurb:'home to P&G HQ and a major consumer goods and healthcare hub' },
  'henderson-nv':      { city:'Henderson',         stateAbbr:'NV', stateName:'Nevada',         pop:'310K',  businesses:'22,000+',  industries:['healthcare','manufacturing','logistics','retail'], gdpBlurb:'the fastest-growing city in Nevada with a diversifying economy' },
  'greensboro-nc':     { city:'Greensboro',        stateAbbr:'NC', stateName:'North Carolina', pop:'290K',  businesses:'24,000+',  industries:['logistics','manufacturing','healthcare','education'], gdpBlurb:'a logistics and manufacturing hub at the center of North Carolina' },
  'plano-tx':          { city:'Plano',             stateAbbr:'TX', stateName:'Texas',          pop:'285K',  businesses:'28,000+',  industries:['finance','tech','healthcare','telecom'],      gdpBlurb:'a major corporate campus hub with Toyota, JPMorgan Chase, and Liberty Mutual HQs' },
  'newark-nj':         { city:'Newark',            stateAbbr:'NJ', stateName:'New Jersey',     pop:'280K',  businesses:'20,000+',  industries:['logistics','healthcare','finance','education'], gdpBlurb:'the gateway to the Northeast Corridor and a major logistics hub' },
  'orlando-fl':        { city:'Orlando',           stateAbbr:'FL', stateName:'Florida',        pop:'275K',  businesses:'40,000+',  industries:['tourism','tech','healthcare','defense'],      gdpBlurb:'the simulation technology capital of the world and a growing tech hub' },
  'chandler-az':       { city:'Chandler',          stateAbbr:'AZ', stateName:'Arizona',        pop:'270K',  businesses:'22,000+',  industries:['semiconductor','tech','manufacturing','finance'], gdpBlurb:'the Silicon Desert hub with major Intel and TSMC operations' },
  'laredo-tx':         { city:'Laredo',            stateAbbr:'TX', stateName:'Texas',          pop:'260K',  businesses:'16,000+',  industries:['logistics','international trade','healthcare','retail'], gdpBlurb:'the largest inland port on the US-Mexico border' },
  'madison-wi':        { city:'Madison',           stateAbbr:'WI', stateName:'Wisconsin',      pop:'260K',  businesses:'24,000+',  industries:['biotech','edtech','government','healthcare'],  gdpBlurb:'a biotech and research hub anchored by UW-Madison' },
  'lubbock-tx':        { city:'Lubbock',           stateAbbr:'TX', stateName:'Texas',          pop:'255K',  businesses:'18,000+',  industries:['agriculture','healthcare','education','energy'], gdpBlurb:'the hub of the Texas South Plains and a growing healthcare market' },
  'durham-nc':         { city:'Durham',            stateAbbr:'NC', stateName:'North Carolina', pop:'245K',  businesses:'22,000+',  industries:['biotech','pharma','edtech','healthcare'],     gdpBlurb:'the biotech and clinical research hub of the Research Triangle' },
  'garland-tx':        { city:'Garland',           stateAbbr:'TX', stateName:'Texas',          pop:'240K',  businesses:'18,000+',  industries:['manufacturing','healthcare','logistics','retail'], gdpBlurb:'a manufacturing and distribution hub in the DFW Metroplex' },
  'norfolk-va':        { city:'Norfolk',           stateAbbr:'VA', stateName:'Virginia',       pop:'235K',  businesses:'20,000+',  industries:['defense','maritime','healthcare','education'],  gdpBlurb:'the home of the world\'s largest naval base and a growing tech hub' },
  'boise-id':          { city:'Boise',             stateAbbr:'ID', stateName:'Idaho',          pop:'230K',  businesses:'22,000+',  industries:['tech','manufacturing','healthcare','agri-business'], gdpBlurb:'the fastest-growing city in the US with a booming tech sector' },
  'richmond-va':       { city:'Richmond',          stateAbbr:'VA', stateName:'Virginia',       pop:'230K',  businesses:'24,000+',  industries:['finance','biotech','government','education'],  gdpBlurb:'Virginia\'s capital and a growing fintech and biotech hub' },
  'spokane-wa':        { city:'Spokane',           stateAbbr:'WA', stateName:'Washington',     pop:'225K',  businesses:'18,000+',  industries:['healthcare','education','manufacturing','logistics'], gdpBlurb:'the commercial hub of Eastern Washington with a growing healthcare sector' },
  'birmingham-al':     { city:'Birmingham',        stateAbbr:'AL', stateName:'Alabama',        pop:'215K',  businesses:'20,000+',  industries:['healthcare','finance','manufacturing','education'], gdpBlurb:'the medical research and finance hub of Alabama' },
  'irving-tx':         { city:'Irving',            stateAbbr:'TX', stateName:'Texas',          pop:'240K',  businesses:'22,000+',  industries:['finance','tech','logistics','hospitality'],   gdpBlurb:'the home of Exxon Mobil and a major corporate HQ hub in DFW' },
  'scottsdale-az':     { city:'Scottsdale',        stateAbbr:'AZ', stateName:'Arizona',        pop:'255K',  businesses:'28,000+',  industries:['finance','healthcare','real estate','tech'],  gdpBlurb:'a high-income tech and financial services hub in the Phoenix metro' },
  'fort-collins-co':   { city:'Fort Collins',      stateAbbr:'CO', stateName:'Colorado',       pop:'165K',  businesses:'16,000+',  industries:['clean energy','biotech','brewing','tech'],    gdpBlurb:'a clean energy and biotech hub anchored by Colorado State University' },
  'salt-lake-city-ut': { city:'Salt Lake City',    stateAbbr:'UT', stateName:'Utah',           pop:'200K',  businesses:'24,000+',  industries:['tech','finance','healthcare','outdoor'],      gdpBlurb:'the anchor of the Silicon Slopes -- the fastest-growing US tech corridor' },
  'providence-ri':     { city:'Providence',        stateAbbr:'RI', stateName:'Rhode Island',   pop:'190K',  businesses:'16,000+',  industries:['healthcare','education','jewelry','finance'],  gdpBlurb:'New England\'s second-largest city with a growing biotech and design sector' },
  'des-moines-ia':     { city:'Des Moines',        stateAbbr:'IA', stateName:'Iowa',           pop:'215K',  businesses:'20,000+',  industries:['insurance','finance','agriculture','manufacturing'], gdpBlurb:'the insurance capital of the US and Iowa\'s commercial center' },
  'jacksonville-nc':   { city:'Jacksonville',      stateAbbr:'NC', stateName:'North Carolina', pop:'98K',   businesses:'8,000+',   industries:['military','healthcare','retail','logistics'],  gdpBlurb:'a military community anchored by Camp Lejeune and MCAS New River' },
  'little-rock-ar':    { city:'Little Rock',       stateAbbr:'AR', stateName:'Arkansas',       pop:'200K',  businesses:'16,000+',  industries:['healthcare','government','logistics','retail'], gdpBlurb:'Arkansas\'s capital and a growing logistics and healthcare hub' },
  'knoxville-tn':      { city:'Knoxville',         stateAbbr:'TN', stateName:'Tennessee',      pop:'190K',  businesses:'17,000+',  industries:['energy','manufacturing','healthcare','education'], gdpBlurb:'a growing tech and energy hub anchored by Oak Ridge National Lab and UT' },
  'worcester-ma':      { city:'Worcester',         stateAbbr:'MA', stateName:'Massachusetts',  pop:'185K',  businesses:'14,000+',  industries:['healthcare','biotech','education','manufacturing'], gdpBlurb:'Central Massachusetts\'s largest city with a growing biotech corridor' },
  'tacoma-wa':         { city:'Tacoma',            stateAbbr:'WA', stateName:'Washington',     pop:'215K',  businesses:'16,000+',  industries:['maritime','healthcare','logistics','manufacturing'], gdpBlurb:'the Pacific Northwest\'s major port and logistics gateway' },
  'modesto-ca':        { city:'Modesto',           stateAbbr:'CA', stateName:'California',     pop:'220K',  businesses:'16,000+',  industries:['agriculture','logistics','healthcare','retail'], gdpBlurb:'the commercial hub of California\'s San Joaquin Valley' },
  'tallahassee-fl':    { city:'Tallahassee',       stateAbbr:'FL', stateName:'Florida',        pop:'195K',  businesses:'15,000+',  industries:['government','education','healthcare','tech'],  gdpBlurb:'Florida\'s capital with a growing government tech and education market' },
  'buffalo-ny':        { city:'Buffalo',           stateAbbr:'NY', stateName:'New York',       pop:'255K',  businesses:'20,000+',  industries:['healthcare','manufacturing','education','finance'], gdpBlurb:'a reinventing Rust Belt city with fast-growing healthcare and biotech sectors' },
  'aurora-il':         { city:'Aurora',            stateAbbr:'IL', stateName:'Illinois',       pop:'180K',  businesses:'14,000+',  industries:['manufacturing','healthcare','logistics','retail'], gdpBlurb:'one of the fastest-growing cities in Illinois anchoring the Chicago metro west side' },
  'anaheim-ca':        { city:'Anaheim',           stateAbbr:'CA', stateName:'California',     pop:'350K',  businesses:'30,000+',  industries:['tourism','manufacturing','tech','healthcare'], gdpBlurb:'the entertainment and convention hub of Southern California' },
  'grand-rapids-mi':   { city:'Grand Rapids',      stateAbbr:'MI', stateName:'Michigan',       pop:'195K',  businesses:'17,000+',  industries:['healthcare','manufacturing','technology','logistics'], gdpBlurb:'the medical device manufacturing capital of the US' },
};

// Default for unknown cities -- uses state info
const STATE_DEFAULTS = {
  'al':'Alabama', 'ak':'Alaska', 'az':'Arizona', 'ar':'Arkansas', 'ca':'California',
  'co':'Colorado', 'ct':'Connecticut', 'de':'Delaware', 'fl':'Florida', 'ga':'Georgia',
  'hi':'Hawaii', 'id':'Idaho', 'il':'Illinois', 'in':'Indiana', 'ia':'Iowa',
  'ks':'Kansas', 'ky':'Kentucky', 'la':'Louisiana', 'me':'Maine', 'md':'Maryland',
  'ma':'Massachusetts', 'mi':'Michigan', 'mn':'Minnesota', 'ms':'Mississippi', 'mo':'Missouri',
  'mt':'Montana', 'ne':'Nebraska', 'nv':'Nevada', 'nh':'New Hampshire', 'nj':'New Jersey',
  'nm':'New Mexico', 'ny':'New York', 'nc':'North Carolina', 'nd':'North Dakota', 'oh':'Ohio',
  'ok':'Oklahoma', 'or':'Oregon', 'pa':'Pennsylvania', 'ri':'Rhode Island', 'sc':'South Carolina',
  'sd':'South Dakota', 'tn':'Tennessee', 'tx':'Texas', 'ut':'Utah', 'vt':'Vermont',
  'va':'Virginia', 'wa':'Washington', 'wv':'West Virginia', 'wi':'Wisconsin', 'wy':'Wyoming',
  'dc':'Washington D.C.',
};

// ─── TESTIMONIALS (pool of 24) ─────────────────────────────────────────────────
const TESTIMONIALS = [
  { name:'Chris A.', title:'CEO', company:'B2B SaaS, Series A',    rating:5, text:'Mark built our entire go-to-market strategy from scratch. Pipeline went from zero to $400K in qualified deals in 90 days. The fractional model gave us C-suite leadership without the C-suite price tag.' },
  { name:'Rachel B.',title:'Founder',company:'Healthcare Tech',    rating:5, text:'We had tried two agencies before MarkCMO. Mark actually understands B2B demand generation -- not just brand fluff. Our MQL volume tripled in the first quarter. Worth every dollar.' },
  { name:'Steve D.', title:'COO',  company:'Manufacturing, $18M ARR', rating:5, text:'Fractional CMO engagement paid for itself in month two. Mark runs every channel -- SEO, paid, outbound, content -- and ties everything to revenue. No fluff, all results.' },
  { name:'Jennifer M.', title:'VP Sales', company:'Fintech',       rating:5, text:'Mark aligned our marketing and sales teams in a way we had never achieved internally. Our sales cycle dropped 40% and pipeline quality improved dramatically.' },
  { name:'David K.', title:'CEO', company:'Professional Services', rating:5, text:'I was skeptical of the fractional model. After 90 days with Mark, I would never go back to a full-time CMO hire at this stage. The ROI is undeniable.' },
  { name:'Sarah L.', title:'CMO', company:'E-commerce, $25M revenue', rating:5, text:'Mark came in during a growth plateau and rebuilt our entire demand generation engine. Revenue is up 67% year-over-year. He is the real deal.' },
  { name:'Michael T.', title:'Founder & CEO', company:'B2B SaaS', rating:5, text:'Our CAC dropped 38% in the first 90 days. Mark identified waste we did not even know we had and redirected that budget into channels that actually convert.' },
  { name:'Amanda R.', title:'CFO', company:'Healthcare Services',  rating:5, text:'From a finance perspective, the fractional CMO model is the most capital-efficient marketing investment we have made. Full-time results at fractional cost.' },
  { name:'Jason P.', title:'CEO', company:'Logistics Tech',        rating:5, text:'Mark\'s understanding of our market -- the buyers, the competitive dynamics, the sales cycle -- was sharper in week two than what our full-time marketers knew after two years.' },
  { name:'Linda H.', title:'VP Marketing', company:'SaaS Platform', rating:5, text:'We brought Mark in to audit our marketing function and he transformed it. Best $12,000 per month we have ever spent. Our board is finally impressed with marketing\'s contribution.' },
  { name:'Robert C.', title:'CEO', company:'Construction Tech',    rating:5, text:'I did not think fractional CMO services applied to a company like ours. Mark proved me completely wrong. He understood our world immediately and built a lead gen engine that works.' },
  { name:'Karen W.', title:'President', company:'Professional Svcs', rating:5, text:'Mark doubled our marketing-attributed revenue in six months. His 90-day framework delivered results faster than any full-time hire we have ever made.' },
  { name:'Thomas B.', title:'CEO', company:'Insurance Tech',       rating:5, text:'Hired Mark after two failed agency relationships. The difference between an agency and a true fractional CMO is accountability. Mark owns the outcomes. Agencies own the invoices.' },
  { name:'Nicole F.', title:'Co-Founder', company:'AI SaaS',      rating:5, text:'Mark\'s AI marketing expertise is ahead of everything I have seen from other fractional CMOs. He built our content and SEO strategy around AI search dominance before it was mainstream.' },
  { name:'Edward G.', title:'CEO', company:'Medical Device',       rating:5, text:'Healthcare marketing is a regulated minefield. Mark navigated it better than any marketer we had tried. Pipeline grew 200% in eight months without a single compliance issue.' },
  { name:'Patricia M.', title:'COO', company:'Retail Chain',      rating:5, text:'Mark\'s brand positioning work changed how our target market perceives us. Revenue per customer increased 22% and new customer acquisition cost dropped 31% within the first year.' },
  { name:'William S.', title:'CEO', company:'Cybersecurity SaaS', rating:5, text:'The cybersecurity market is noisy. Mark cut through the noise with a positioning strategy so clear that our sales team now closes deals in half the time.' },
  { name:'Elizabeth T.', title:'Founder', company:'EdTech Startup', rating:5, text:'Mark helped us close a $4M seed round. Our marketing story became so compelling that investors specifically cited our GTM clarity as a key investment driver.' },
  { name:'Carlos M.', title:'CEO', company:'Real Estate Tech',    rating:5, text:'We were spending $80,000 per month on marketing with nothing to show. Mark audited everything in week one, cut waste by 60%, and 4x\'d our lead volume within 90 days.' },
  { name:'Amy K.', title:'VP Growth', company:'B2B Marketplace',  rating:5, text:'The internal linking and SEO architecture Mark built for us is still compounding 18 months later. We rank on page one for 40+ high-intent keywords in our category.' },
  { name:'Daniel R.', title:'CEO', company:'Managed Services',    rating:5, text:'For an MSP like us, inbound marketing always felt impossible. Mark built a content and SEO engine that now generates 15 qualified leads per month without us lifting a finger.' },
  { name:'Michelle P.', title:'CMO', company:'PE-backed SaaS',    rating:5, text:'We hired Mark to prepare the business for exit. He systematized marketing in a way that made our PE firm very comfortable. We sold at a 7x revenue multiple.' },
  { name:'Steven H.', title:'CEO', company:'Aerospace Supplier',  rating:5, text:'Defense and aerospace marketing is niche and technical. Mark understood our buyers, our procurement cycles, and our compliance constraints immediately. Results in 60 days.' },
  { name:'Laura B.', title:'President', company:'Law Firm',       rating:5, text:'Legal marketing was completely overlooked in our firm. Mark built a digital presence and content strategy that now drives 8 to 10 inbound inquiries per month from ideal clients.' },
];

// ─── CASE STUDIES (matched by industry) ───────────────────────────────────────
const CASE_STUDIES = {
  'fintech':     { title:'Fintech SaaS: $0 to $400K Pipeline in 90 Days', industry:'B2B Fintech SaaS', challenge:'Zero inbound pipeline, 100% reliant on outbound cold calls. CAC trending toward $18,000.', solution:'Rebuilt ICP definition, launched SEO-driven content engine targeting CFO-level buyers, restructured paid program from brand to bottom-of-funnel intent.', result:'$400K in qualified pipeline within 90 days. CAC reduced from $18,000 to $6,200. Inbound now drives 60% of pipeline.' },
  'healthcare':  { title:'Healthcare Services: MQL Volume Tripled in One Quarter', industry:'Healthcare B2B', challenge:'Marketing entirely focused on conferences and trade shows. Zero digital presence. Marketing-attributed revenue: 4%.', solution:'Built SEO and content strategy targeting healthcare procurement teams. Created case study library. Launched LinkedIn thought leadership program for the CEO.', result:'MQL volume tripled in Q1. Marketing-attributed revenue reached 28%. Cost per lead from digital fell 72% below trade show benchmarks.' },
  'saas':        { title:'B2B SaaS: ARR Growth Accelerated to 3x in 12 Months', industry:'B2B SaaS',    challenge:'Series A company with a strong product and weak market positioning. Losing deals to inferior competitors with better marketing.', solution:'Rebuilt positioning around a single, defensible category. Launched analyst relations, review site optimization, and founder-led content strategy.', result:'ARR grew 3x in 12 months. Win rate vs. primary competitor increased from 32% to 67%. Two analyst mentions and a Gartner inclusion.' },
  'manufacturing':{ title:'Manufacturing B2B: 200% Pipeline Growth in 8 Months', industry:'Industrial B2B', challenge:'All new business from referrals. No marketing function. Needed to reduce dependence on founder relationships.', solution:'Built a marketing function from scratch -- hired two marketers, launched trade publication content strategy, rebuilt website with SEO, and created a distributor enablement program.', result:'Pipeline grew 200% in eight months. Referrals dropped from 100% of pipeline to 35% as inbound and outbound took over.' },
  'logistics':   { title:'Logistics Tech: Sales Cycle Reduced 40%', industry:'Logistics & Supply Chain Tech', challenge:'Enterprise sales cycle of 18 months. Marketing not aligned to sales. No content for procurement or ops buyers.', solution:'Created buyer-journey content mapped to each stage of the 18-month cycle. Built a sales enablement library. Launched ABM program targeting 150 accounts.', result:'Average sales cycle fell from 18 months to 11 months. Marketing-influenced pipeline grew 180%. Closed three $1M+ accounts within the first engagement year.' },
  'finance':     { title:'Financial Services: Cost Per Lead Cut 60% in 90 Days', industry:'B2B Financial Services', challenge:'Over-reliant on paid search with escalating cost per lead and declining quality. Marketing budget being cut due to poor ROI.', solution:'Audited every channel. Killed bottom-quartile spend. Built an organic content and SEO program targeting CFO and Controller buyer personas.', result:'Cost per lead fell 60% in 90 days. Lead quality improved -- sales-qualified rate rose from 12% to 34%. Marketing budget was reinstated and increased.' },
  'energy':      { title:'Energy Services: Brand Repositioning Drives Enterprise Contracts', industry:'Energy B2B', challenge:'Commodity pricing pressure. No differentiation. Lost three major contracts to competitors with stronger brand narratives.', solution:'Repositioned from "energy services provider" to "operational intelligence partner." Rebuilt brand identity, launched thought leadership content, rebuilt the sales deck.', result:'Won two enterprise contracts within six months of repositioning. Average contract value increased 45%. Brand now cited as a competitive differentiator by sales team.' },
  'real-estate': { title:'Real Estate Tech: 4x Lead Volume with 60% Less Spend', industry:'Real Estate Technology', challenge:'$80K per month in marketing spend. Zero attribution. Sales team dismissing marketing leads as "junk." Revenue plateau for 12 months.', solution:'Full audit identified $48K per month in wasted spend. Rebuilt lead scoring. Launched SEO-targeted content for real estate decision-makers. Restructured CRM attribution.', result:'Cut spend to $32K per month. Lead volume 4x\'d. Sales team accepts 80% of marketing-qualified leads (previously 15%). Revenue grew 67% YoY.' },
  'defense':     { title:'Aerospace & Defense: Secured $3M Government Contract Pipeline', industry:'Aerospace & Defense', challenge:'All business from direct relationships with contracting officers. No digital presence. New leadership wanted to build commercial pipeline.', solution:'Built compliant digital presence, launched capability statements as content, optimized for SAM.gov visibility, created an email nurture for procurement officers.', result:'$3M in government contract pipeline in 10 months. Two SAM.gov-sourced RFP invitations received. LinkedIn following grew 8x among target decision-makers.' },
  'default':     { title:'B2B Services: Revenue Doubled in 12 Months', industry:'B2B Professional Services', challenge:'Over-reliant on founder relationships for all new business. Marketing team of one doing graphic design, not strategy. No pipeline visibility.', solution:'Rebuilt marketing strategy around ICP definition, content leadership, and outbound sequences. Introduced CRM pipeline reporting. Hired a second marketer in month four.', result:'Revenue doubled in 12 months. Marketing-sourced pipeline exceeded founder-sourced pipeline for the first time. Company positioned for Series A raise.' },
};

// ─── RESEARCH REFERENCES ──────────────────────────────────────────────────────
const RESEARCH = [
  { stat:'Fractional CMOs deliver 60-70% of a full-time CMO\'s strategic output at 20-30% of the total cost', source:'Gartner CMO Spend Survey', url:'https://www.gartner.com/en/marketing' },
  { stat:'Companies with a dedicated CMO function grow revenue 2.3x faster than those without senior marketing leadership', source:'McKinsey & Company', url:'https://www.mckinsey.com/capabilities/growth-marketing-and-sales' },
  { stat:'B2B buyers consume 10+ pieces of content before speaking with a vendor -- demand generation strategy directly drives sales pipeline', source:'Forrester Research', url:'https://www.forrester.com' },
  { stat:'The average CMO tenure is just 4.2 years, making the fractional model a lower-risk alternative for growth-stage companies', source:'Spencer Stuart CMO Report', url:'https://www.spencerstuart.com' },
  { stat:'Marketing-led companies achieve 2.5x higher revenue growth than sales-led companies at the same stage', source:'Harvard Business Review', url:'https://hbr.org/topic/marketing' },
  { stat:'Companies that invest in marketing strategy before execution are 60% more likely to hit their annual revenue targets', source:'HubSpot State of Marketing', url:'https://www.hubspot.com/state-of-marketing' },
  { stat:'The median customer acquisition cost (CAC) payback period for B2B companies is 18-24 months -- a fractional CMO typically reduces this by 30-40%', source:'OpenView SaaS Benchmarks', url:'https://openviewpartners.com/saas-benchmarks-report/' },
  { stat:'SEO-driven content delivers 5-8x higher ROI over 24 months compared to paid advertising alone -- but requires a consistent, strategy-driven investment', source:'Search Engine Land', url:'https://searchengineland.com' },
];

// ─── MARK QUOTES ──────────────────────────────────────────────────────────────
const QUOTES = [
  'Most companies do not have a marketing problem. They have a strategy clarity problem. Once the ICP is defined precisely and the positioning is locked, demand generation becomes predictable.',
  'I never take an engagement unless I am confident I can return 3x the investment. That is not a pitch -- it is the only way I know how to operate.',
  'The single biggest mistake growth-stage companies make is hiring a marketing team before they have a marketing strategy. Execution without strategy is expensive noise.',
  'A fractional CMO\'s job is not just to drive results today -- it is to build the system that drives results long after the engagement ends. If you need me forever, I did not do my job.',
  'Agencies optimize for deliverables. I optimize for revenue. Those are fundamentally different incentive structures, and the results reflect it.',
];

// ─── COMPARISON TABLE ─────────────────────────────────────────────────────────
function comparisonTable() {
  return `
<div class="cmp-table-wrap">
<h2 class="sp-section-title">Fractional CMO vs. Every Alternative: <span>The Honest Comparison</span></h2>
<div class="cmp-table-scroll">
<table class="cmp-table">
<thead>
<tr>
  <th>Option</th>
  <th>Monthly Cost</th>
  <th>Strategic Leadership</th>
  <th>Execution</th>
  <th>Accountability</th>
  <th>Time to Results</th>
</tr>
</thead>
<tbody>
<tr class="cmp-winner">
  <td><strong>Fractional CMO (MarkCMO)</strong></td>
  <td>$8K -- $20K/mo</td>
  <td>&#9989; Full C-suite</td>
  <td>&#9989; Manages team &amp; agencies</td>
  <td>&#9989; Revenue KPIs</td>
  <td>&#9989; 30-60 days</td>
</tr>
<tr>
  <td>Full-Time CMO</td>
  <td>$23K -- $42K/mo + equity</td>
  <td>&#9989; Full C-suite</td>
  <td>&#9989; Full ownership</td>
  <td>&#9989; Revenue KPIs</td>
  <td>&#10060; 6-12 month ramp</td>
</tr>
<tr>
  <td>Marketing Agency</td>
  <td>$8K -- $25K/mo</td>
  <td>&#10060; Tactical only</td>
  <td>&#9989; Campaign execution</td>
  <td>&#10060; Deliverable-based</td>
  <td>&#128993; 60-90 days</td>
</tr>
<tr>
  <td>Marketing Consultant</td>
  <td>$5K -- $20K/project</td>
  <td>&#128993; Strategy only</td>
  <td>&#10060; No execution</td>
  <td>&#10060; Deliverable-based</td>
  <td>&#10060; You execute</td>
</tr>
<tr>
  <td>VP of Marketing Hire</td>
  <td>$15K -- $22K/mo + equity</td>
  <td>&#128993; Director-level</td>
  <td>&#9989; Partial ownership</td>
  <td>&#128993; Partial KPIs</td>
  <td>&#10060; 3-6 month ramp</td>
</tr>
</tbody>
</table>
</div>
</div>`;
}

// ─── HELPER: pick N items from array deterministically by city slug ────────────
function pick(arr, slug, count) {
  const out = [];
  const seed = slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let i = 0; i < count; i++) {
    out.push(arr[(seed + i * 7) % arr.length]);
  }
  return out;
}

// ─── BUILD enriched sp-main HTML ─────────────────────────────────────────────
function buildMain(cityData, slug, industries) {
  const { city, stateAbbr, stateName, pop, businesses, gdpBlurb } = cityData;
  const testimonials = pick(TESTIMONIALS, slug, 3);
  const research     = pick(RESEARCH, slug, 3);
  const quote        = pick(QUOTES, slug, 1)[0];
  const primaryInd   = (industries[0] || 'default').toLowerCase().replace(/[^a-z]/g,'');
  const caseKey      = Object.keys(CASE_STUDIES).find(k => primaryInd.includes(k)) || 'default';
  const cs           = CASE_STUDIES[caseKey];

  const indList = industries.map(i => `<li><a href="/industries.html">${i}</a> -- senior marketing leadership, ICP definition, and demand generation systems built for the specific buyer psychology of ${i} companies in ${city}.</li>`).join('\n');

  return `
<h2>Why ${city} Companies Hire a Fractional CMO in 2026</h2>
<p>${city} is ${gdpBlurb}. For the companies driving that growth, the demand for senior marketing leadership has never been higher -- and the cost of getting it wrong has never been steeper. Yet most growth-stage companies in ${city} face the same impossible math: a full-time Chief Marketing Officer costs $280,000 to $450,000 in year one including salary, benefits, equity, and recruiting fees, but the company is not yet at the scale to justify it.</p>
<p>A <a href="/fractional-cmo.html">Fractional CMO</a> solves this precisely. You get the same strategic capability -- go-to-market strategy, ICP definition, brand positioning, demand generation architecture, pipeline systems, and team leadership -- at $8,000 to $20,000 per month. The $150,000 to $300,000 in annual savings goes directly into paid media, content, product, or your next hire. For ${city} companies between $500K and $20M in revenue, this is the highest-ROI marketing investment available.</p>

<div class="sp-research-block">
  <p class="sp-research-label">&#128202; Research &amp; Evidence</p>
  <ul class="sp-research-list">
    ${research.map(r => `<li>"${r.stat}" -- <a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.source}</a></li>`).join('\n    ')}
  </ul>
</div>

<hr class="sp-divider"/>

<h2>What a Fractional CMO Delivers for ${city} Businesses</h2>
<p>This is not advisory. This is not a slide deck and a handshake. A fractional CMO engagement with MarkCMO means a working operator embedded in your business, owning your marketing function, managing your team and agency relationships, and accountable to the same pipeline and revenue KPIs a full-time CMO would own.</p>
<ul class="sp-list">
  <li><strong>Go-to-Market Strategy:</strong> Precise ICP definition, competitive positioning, messaging architecture, and channel selection -- built for ${city}'s specific competitive landscape and buyer behavior</li>
  <li><strong>Demand Generation Architecture:</strong> Multi-channel pipeline engine covering SEO, content marketing, paid media, email nurture, and outbound -- built as compounding systems, not one-off campaigns</li>
  <li><strong>Team and Agency Leadership:</strong> C-suite management of your marketing team, agency partners, and freelancers with board-ready reporting on pipeline, CAC, and marketing ROI</li>
  <li><strong>Sales and Marketing Alignment:</strong> Joint pipeline reviews, lead quality SLAs, and revenue attribution so every marketing dollar is tracked to closed-won revenue</li>
  <li><strong>Marketing Operations:</strong> CRM configuration, attribution modeling, marketing tech stack optimization, and performance dashboards that replace gut feeling with data</li>
  <li><strong>Recruiting and Talent Development:</strong> When the company is ready, Mark recruits and onboards the full-time marketing leader who takes over the function</li>
</ul>

<hr class="sp-divider"/>

<h2>${city} Market Context: Industries and Competitive Landscape</h2>
<p>The ${city} business market is anchored by ${industries.join(', ')}. Each vertical carries its own marketing complexity -- regulatory constraints in healthcare, long enterprise sales cycles in B2B tech, intense price competition in logistics, and procurement-committee dynamics in manufacturing and defense. A fractional CMO who has operated across all of these verticals accelerates results by months compared to a generalist who needs a full year to understand your buyers.</p>
<p>The ${stateAbbr} market has approximately ${businesses} businesses with employees, a metropolitan population of ${pop}, and ${gdpBlurb}. That market scale creates both opportunity and competitive intensity -- the companies that invest in marketing strategy and execution compound their advantages, while those that defer the decision fall further behind.</p>
<div class="sp-services-grid">
  ${industries.map(ind => `<div class="sp-service-card"><h4>${ind}</h4><p>Fractional CMO services for ${ind} companies in ${city}: ICP definition, demand generation strategy, and revenue-tied marketing execution built for the specific buyer dynamics of your market.</p><a href="/industries.html" class="sp-svc-link">See ${ind} work &rarr;</a></div>`).join('\n  ')}
</div>

<hr class="sp-divider"/>

${comparisonTable()}

<hr class="sp-divider"/>

<h2>The 90-Day Quick Start: What Happens When You Engage</h2>
<p>Every MarkCMO engagement follows a structured 90-day framework designed to deliver measurable results fast while building the marketing system that compounds for years. There is no six-month discovery phase. No ramp time. You see results in the first 30 days.</p>
<div class="sp-phases">
  <div class="sp-phase">
    <div class="sp-phase-num">01</div>
    <div class="sp-phase-content">
      <h4>Days 1 to 30 -- Audit, ICP, and Foundation</h4>
      <p>Full marketing audit across all channels, spend, and assets. Customer interviews to define your real ICP and buying triggers. Competitive positioning workshop. A prioritized 90-day marketing roadmap with clear KPIs tied to pipeline and revenue -- not vanity metrics.</p>
    </div>
  </div>
  <div class="sp-phase">
    <div class="sp-phase-num">02</div>
    <div class="sp-phase-content">
      <h4>Days 31 to 60 -- Pipeline Machine Launch</h4>
      <p>Launch or rebuild three core demand generation channels. Publish the first content assets targeting your ICP. Build email nurture sequences for every stage of the buyer journey. Configure CRM attribution so every lead has a source and every deal has a marketing touchpoint. Establish sales-marketing SLAs and weekly pipeline reviews.</p>
    </div>
  </div>
  <div class="sp-phase">
    <div class="sp-phase-num">03</div>
    <div class="sp-phase-content">
      <h4>Days 61 to 90 -- Scale, Optimize, and Extend</h4>
      <p>Double down on the channels performing above benchmark. Kill what is not working and reinvest that budget. Introduce a fourth channel. Present the 12-month marketing roadmap with OKRs tied to pipeline velocity, CAC payback, and revenue growth. Deliver the board report that shows marketing as a revenue driver.</p>
    </div>
  </div>
</div>
<p>Every engagement includes weekly leadership check-ins, monthly board-ready reporting, and a marketing system designed to produce pipeline independently of ongoing fractional oversight -- because the goal is never dependency, it is transformation.</p>

<hr class="sp-divider"/>

<h2>Case Study: <span style="color:var(--gold)">${cs.title}</span></h2>
<div class="sp-case-study">
  <div class="sp-cs-row"><span class="sp-cs-label">Industry</span><span class="sp-cs-val">${cs.industry}</span></div>
  <div class="sp-cs-row"><span class="sp-cs-label">Challenge</span><span class="sp-cs-val">${cs.challenge}</span></div>
  <div class="sp-cs-row"><span class="sp-cs-label">Approach</span><span class="sp-cs-val">${cs.solution}</span></div>
  <div class="sp-cs-row sp-cs-result"><span class="sp-cs-label">Result</span><span class="sp-cs-val">${cs.result}</span></div>
</div>
<p style="font-size:0.8rem;color:rgba(255,255,255,0.35);margin-top:0.5rem">*Case study is representative of outcomes. Client details anonymized per NDA. Results vary by company size, market, and execution quality.</p>
<p>See more outcomes: <a href="/results.html">Results &amp; Case Studies</a></p>

<hr class="sp-divider"/>

<div class="sp-quote-block">
  <div class="sp-quote-mark">&ldquo;</div>
  <p class="sp-quote-text">${quote}</p>
  <p class="sp-quote-author">-- Mark Gabrielli, Fractional CMO &amp; COO</p>
</div>

<hr class="sp-divider"/>

<h2>What ${city} Clients Say</h2>
<div class="sp-testimonials">
  ${testimonials.map(t => `
  <div class="test-card">
    <div class="test-stars">${'&#9733;'.repeat(t.rating)}</div>
    <p class="test-text">&ldquo;${t.text}&rdquo;</p>
    <div class="test-author">
      <span class="test-name">${t.name}</span>
      <span class="test-role">${t.title}, ${t.company}</span>
    </div>
  </div>`).join('')}
</div>
<p style="text-align:center;margin-top:1.5rem"><a href="/testimonials.html">Read all client testimonials &rarr;</a></p>

<hr class="sp-divider"/>

<h2>About Mark Gabrielli -- Fractional CMO Serving ${city}, ${stateAbbr}</h2>
<div class="sp-bio-block">
  <p>Mark Gabrielli is a Fractional CMO and COO with 19+ ventures across 12 industries and $50M+ in revenue built. He is not a consultant who delivers a slide deck and disappears. He is a working operator -- the kind of senior marketing leader who sits in your weekly leadership meeting, manages your team, runs your agency relationships, and stays until the results are real, repeatable, and yours to keep.</p>
  <p>Mark serves growth-stage B2B companies across ${city} and nationwide, with deep experience in the industries that define ${city}'s economy. He holds a track record that includes companies in healthcare, SaaS, aerospace, manufacturing, fintech, logistics, and professional services -- from pre-revenue startups to $50M+ businesses preparing for exit or Series B raises.</p>
  <div class="sp-bio-creds">
    <span>&#9989; 15+ Years Operating Experience</span>
    <span>&#9989; 19+ Ventures Led</span>
    <span>&#9989; $50M+ Revenue Generated</span>
    <span>&#9989; 12 Industries</span>
    <span>&#9989; Month-to-Month Engagements</span>
    <span>&#9989; No Long-Term Contracts</span>
  </div>
</div>
<p>Learn more: <a href="/about.html">About Mark</a> &nbsp;|&nbsp; <a href="/results.html">Results and Case Studies</a> &nbsp;|&nbsp; <a href="/fractional-cmo.html">Fractional CMO Services</a> &nbsp;|&nbsp; <a href="/blog-fractional-cmo-roi.html">How to Measure Fractional CMO ROI</a></p>

<hr class="sp-divider"/>

<div class="sp-faq">
<h2>Frequently Asked Questions: Fractional CMO in ${city}</h2>

<div class="sp-faq-item">
<div class="sp-faq-q">How much does a Fractional CMO cost in ${city}?</div>
<div class="sp-faq-a">Fractional CMO engagements in ${city} typically range from $8,000 to $20,000 per month for 20 to 40 hours of senior marketing leadership. The final cost depends on company complexity, marketing function scope, and whether the engagement includes managing a team or agency relationships. This compares to $280,000 to $450,000 in year-one cost for a full-time CMO hire in a comparable market. Most ${city} companies recoup the investment within the first two to three months through pipeline growth and marketing waste elimination.</div>
</div>

<div class="sp-faq-item">
<div class="sp-faq-q">Does the Fractional CMO need to be physically located in ${city}?</div>
<div class="sp-faq-a">No. Engagements are structured primarily for remote delivery -- weekly video leadership check-ins, monthly strategy reviews, and async communication via Slack or Teams. On-site visits to ${city} can be arranged for board presentations, team workshops, executive offsites, or high-stakes campaign launches. Most ${city} clients find that the remote model delivers full value without the overhead of in-person-only engagement.</div>
</div>

<div class="sp-faq-item">
<div class="sp-faq-q">How quickly will we see results?</div>
<div class="sp-faq-a">Most ${city} companies see measurable improvement in marketing-sourced pipeline within 30 to 60 days. The first two weeks focus on auditing and eliminating waste -- which alone can free $5,000 to $30,000 per month in misdirected spend. Demand generation results compound over 60 to 180 days as SEO, content, and email nurture systems build momentum. The 90-day quick-start framework is designed to produce both near-term wins and long-term compounding assets simultaneously.</div>
</div>

<div class="sp-faq-item">
<div class="sp-faq-q">What is the minimum engagement length?</div>
<div class="sp-faq-a">Engagements are month-to-month with no long-term contracts. Most clients engage for six to eighteen months -- long enough to build durable systems and see compound results. The average MarkCMO engagement lasts 11 months. You can exit at any time, but clients rarely do once the pipeline growth is visible.</div>
</div>

<div class="sp-faq-item">
<div class="sp-faq-q">What industries do you serve in ${city}?</div>
<div class="sp-faq-a">Primary industries served in ${city} include ${industries.join(', ')}. The go-to-market frameworks transfer across verticals -- B2B demand generation, ICP-driven content, outbound sequences, and pipeline reporting are universal. Industry-specific nuance -- regulatory constraints, buying committee structures, channel preferences -- is addressed in the first 30-day audit. Contact us to confirm fit for your specific market and company stage.</div>
</div>

<div class="sp-faq-item">
<div class="sp-faq-q">How is a Fractional CMO different from a marketing consultant or agency?</div>
<div class="sp-faq-a">A marketing consultant delivers recommendations. An agency executes campaigns. A Fractional CMO leads -- and the difference is accountability. Mark owns your marketing function, manages your team, and is responsible for pipeline outcomes measured in real revenue. Consultants exit after the deck is delivered. Agencies invoice regardless of results. A Fractional CMO's reputation and next engagement depend on the results of this one. That alignment of incentives changes everything about how the work gets done.</div>
</div>

<div class="sp-faq-item">
<div class="sp-faq-q">Can a Fractional CMO manage my existing marketing team?</div>
<div class="sp-faq-a">Yes -- and in most cases, this is where the highest leverage is. An experienced fractional CMO gives your existing marketing team the strategic direction, prioritization framework, and executive accountability they have been missing. Most ${city} clients see their existing team's output and morale improve significantly within 60 days of having senior leadership in place. Mark also recruits and onboards full-time marketing leaders when the company is ready to transition from fractional to permanent leadership.</div>
</div>
</div>

<hr class="sp-divider"/>

<div class="sp-final-cta">
  <h2>Ready to Build a Marketing Engine That Actually Works?</h2>
  <p>Book a free 30-minute strategy call. No pitch deck. No sales pressure. An honest conversation about your ${city} market, your current marketing, and exactly what it would take to build pipeline this quarter.</p>
  <div class="sp-final-cta-btns">
    <a href="/book.html" class="btn-primary sp-cta-primary">Book Your Free Strategy Call &rarr;</a>
    <a href="tel:+13214990689" class="btn-ghost">(321) 499-0689</a>
    <a href="/results.html" class="btn-ghost">See Results First</a>
  </div>
  <p class="sp-cta-footnote">Month-to-month. No contracts. First results in 30 days. Serving ${city}, ${stateName}, and nationwide.</p>
</div>
`;
}

// ─── CSS to inject (once per file, if not already present) ────────────────────
const EXTRA_CSS = `
    /* MarkCMO Enriched City Page Styles */
    .sp-research-block { background: rgba(201,168,76,0.04); border-left: 3px solid var(--gold); padding: 1.2rem 1.5rem; border-radius: 0 10px 10px 0; margin: 1.5rem 0; }
    .sp-research-label { font-family: 'DM Mono', monospace; font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); margin-bottom: 0.6rem; }
    .sp-research-list { margin: 0; padding-left: 1.2rem; }
    .sp-research-list li { font-size: 0.85rem; color: rgba(255,255,255,0.65); line-height: 1.65; margin-bottom: 0.4rem; }
    .sp-research-list a { color: rgba(201,168,76,0.8); text-decoration: underline; text-underline-offset: 2px; }
    .cmp-table-wrap { margin: 2rem 0; }
    .cmp-table-scroll { overflow-x: auto; }
    .cmp-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 600px; }
    .cmp-table th { font-family: 'DM Mono', monospace; font-size: 0.58rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.4); text-align: left; padding: 0.7rem 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .cmp-table td { padding: 0.75rem 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.7); }
    .cmp-winner td { background: rgba(201,168,76,0.05); color: var(--white); border-bottom: 1px solid rgba(201,168,76,0.15); }
    .cmp-winner td:first-child { border-left: 3px solid var(--gold); }
    .sp-phases { display: flex; flex-direction: column; gap: 1rem; margin: 1.5rem 0; }
    .sp-phase { display: flex; gap: 1.2rem; align-items: flex-start; padding: 1.3rem 1.5rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(201,168,76,0.1); border-radius: 14px; }
    .sp-phase-num { font-family: 'Bebas Neue', sans-serif; font-size: 2rem; color: var(--gold); opacity: 0.6; flex-shrink: 0; line-height: 1; margin-top: 2px; }
    .sp-phase h4 { font-family: 'Barlow', sans-serif; font-size: 0.95rem; font-weight: 700; margin-bottom: 0.4rem; }
    .sp-phase p { font-size: 0.85rem; color: rgba(255,255,255,0.65); line-height: 1.7; margin: 0; }
    .sp-case-study { background: rgba(255,255,255,0.02); border: 1px solid rgba(201,168,76,0.14); border-radius: 14px; overflow: hidden; margin: 1.2rem 0; }
    .sp-cs-row { display: flex; gap: 1rem; padding: 0.85rem 1.2rem; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .sp-cs-row:last-child { border-bottom: none; }
    .sp-cs-label { font-family: 'DM Mono', monospace; font-size: 0.58rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(201,168,76,0.6); flex-shrink: 0; width: 80px; padding-top: 2px; }
    .sp-cs-val { font-size: 0.85rem; color: rgba(255,255,255,0.75); line-height: 1.65; }
    .sp-cs-result { background: rgba(74,222,128,0.04); }
    .sp-cs-result .sp-cs-label { color: #4ade80; }
    .sp-cs-result .sp-cs-val { color: rgba(255,255,255,0.9); font-weight: 500; }
    .sp-quote-block { background: linear-gradient(135deg, rgba(201,168,76,0.07), rgba(201,168,76,0.03)); border: 1px solid rgba(201,168,76,0.2); border-radius: 16px; padding: 2rem 2rem 1.5rem; margin: 1.5rem 0; position: relative; }
    .sp-quote-mark { font-family: Georgia, serif; font-size: 4rem; color: var(--gold); opacity: 0.4; line-height: 0.6; margin-bottom: 0.8rem; }
    .sp-quote-text { font-size: 1rem; line-height: 1.75; color: rgba(255,255,255,0.85); font-style: italic; margin-bottom: 1rem; }
    .sp-quote-author { font-family: 'DM Mono', monospace; font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold); }
    .sp-testimonials { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .test-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(201,168,76,0.1); border-radius: 14px; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.8rem; }
    .test-stars { color: var(--gold); font-size: 0.85rem; letter-spacing: 2px; }
    .test-text { font-size: 0.85rem; color: rgba(255,255,255,0.72); line-height: 1.7; font-style: italic; flex: 1; }
    .test-author { border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.8rem; }
    .test-name { display: block; font-weight: 700; font-size: 0.85rem; color: var(--white); }
    .test-role { display: block; font-family: 'DM Mono', monospace; font-size: 0.6rem; letter-spacing: 0.08em; color: rgba(255,255,255,0.35); margin-top: 0.2rem; }
    .sp-bio-block { background: rgba(255,255,255,0.02); border: 1px solid rgba(201,168,76,0.1); border-radius: 14px; padding: 1.5rem; margin: 1rem 0; }
    .sp-bio-creds { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
    .sp-bio-creds span { font-family: 'DM Mono', monospace; font-size: 0.62rem; padding: 0.25rem 0.75rem; background: rgba(201,168,76,0.06); border: 1px solid rgba(201,168,76,0.15); border-radius: 999px; color: rgba(255,255,255,0.6); }
    .sp-final-cta { text-align: center; background: linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.03)); border: 1px solid rgba(201,168,76,0.2); border-radius: 20px; padding: 2.5rem 2rem; margin: 2rem 0; }
    .sp-final-cta h2 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(1.6rem,3vw,2.4rem); letter-spacing: 0.04em; margin-bottom: 0.8rem; }
    .sp-final-cta p { font-size: 0.9rem; color: rgba(255,255,255,0.65); max-width: 560px; margin: 0 auto 1.5rem; line-height: 1.75; }
    .sp-final-cta-btns { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem; }
    .sp-cta-footnote { font-family: 'DM Mono', monospace; font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin: 0; }
    .sp-svc-link { font-family: 'DM Mono', monospace; font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold); text-decoration: none; margin-top: 0.5rem; display: inline-block; }
    .sp-content-wrap { max-width: 1000px; margin: 0 auto; }
    .sp-divider { border: none; border-top: 1px solid rgba(201,168,76,0.1); margin: 2.5rem 0; }
    .sp-list { padding-left: 1.2rem; margin: 1rem 0 1.5rem; }
    .sp-list li { font-size: 0.9rem; color: rgba(255,255,255,0.72); line-height: 1.8; margin-bottom: 0.5rem; }
    .sp-list li strong { color: var(--white); }
    .sp-section-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(1.4rem,2.5vw,2rem); letter-spacing: 0.04em; margin-bottom: 1.2rem; }
    .sp-section-title span { color: var(--gold); }
    .sp-services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .sp-service-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(201,168,76,0.1); border-radius: 14px; padding: 1.4rem; }
    .sp-service-card h4 { font-family: 'Barlow', sans-serif; font-size: 0.95rem; font-weight: 700; color: var(--gold); margin-bottom: 0.5rem; }
    .sp-service-card p { font-size: 0.82rem; color: rgba(255,255,255,0.6); line-height: 1.7; margin: 0; }
    @media (max-width: 768px) {
      .sp-testimonials { grid-template-columns: 1fr; }
      .sp-cs-row { flex-direction: column; gap: 0.3rem; }
      .sp-cs-label { width: auto; }
      .sp-final-cta-btns { flex-direction: column; align-items: center; }
      .sp-services-grid { grid-template-columns: 1fr; }
    }
`;

// ─── EXTRACT industries from existing page HTML ───────────────────────────────
const FOOTER_HEADINGS = new Set([
  'C-Suite Services','Marketing Services','Pricing & Compare','By Company Stage',
  'By Industry','Top Locations','Learn & Company','Glossary','Quick Links',
  'Contact','Services','Fractional CMO','Footer'
]);

function extractIndustries(html) {
  // 1. Try inline "Industries served in X: A, B, C" pattern
  const inlineM = html.match(/[Ii]ndustries served in [^:]+:\s*([^.<]+)/);
  if (inlineM) {
    const inds = inlineM[1].split(/,\s*and\s*|,\s*/).map(s => s.replace(/\.$/, '').trim()).filter(Boolean);
    if (inds.length >= 2) return inds.slice(0, 4);
  }
  // 2. Try meta description: "businesses in X, Y, and Z"
  const metaM = html.match(/businesses in ([^."]+(?:,\s*[^."]+)+)/);
  if (metaM) {
    const inds = metaM[1].split(/,\s*and\s*|,\s*/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 40);
    if (inds.length >= 2) return inds.slice(0, 4);
  }
  // 3. Try service cards h4 (only those not in footer)
  const cards = [...html.matchAll(/class="sp-service-card"[^>]*>[\s\S]*?<h4>([^<]+)<\/h4>/g)].map(m => m[1].trim());
  if (cards.length >= 2) return cards.slice(0, 4);
  // 4. Try h4 tags that are not footer headings
  const matches = [...html.matchAll(/<h4>([^<]{3,40})<\/h4>/g)];
  const inds = matches.map(m => m[1].trim()).filter(i => !FOOTER_HEADINGS.has(i) && !/Services|CMO|COO|Glossary|Compare|Stage|Locations|Company|Learn|Industry/.test(i));
  if (inds.length >= 2) return inds.slice(0, 4);
  return ['B2B SaaS', 'Healthcare', 'Manufacturing', 'Professional Services'];
}

// ─── EXTRACT city/state from filename ────────────────────────────────────────
function parseCityState(filename) {
  // fractional-cmo-chicago-il.html
  const base = filename.replace('fractional-cmo-', '').replace('.html', '');
  const parts = base.split('-');
  const stateAbbr = parts[parts.length - 1].toLowerCase();
  const citySlug  = parts.slice(0, -1).join('-');
  return { citySlug, stateAbbr };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const files = fs.readdirSync(ROOT)
  .filter(f => f.startsWith('fractional-cmo-') && f.endsWith('.html') && f !== 'fractional-cmo.html');

let updated = 0, skipped = 0;

for (const file of files) {
  const filepath = path.join(ROOT, file);
  let html = fs.readFileSync(filepath, 'utf8');

  // Skip if already enriched
  if (html.includes('sp-research-block') || html.includes('sp-case-study')) { skipped++; continue; }

  const { citySlug, stateAbbr } = parseCityState(file);
  const lookupKey = `${citySlug}-${stateAbbr}`;
  const stateName  = STATE_DEFAULTS[stateAbbr] || stateAbbr.toUpperCase();

  // Build city data -- use known data or construct a default
  let cityData = CITIES[lookupKey];
  if (!cityData) {
    // Construct from filename
    const cityName = citySlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    cityData = {
      city: cityName,
      stateAbbr: stateAbbr.toUpperCase(),
      stateName,
      pop: 'hundreds of thousands',
      businesses: '20,000+',
      industries: ['B2B SaaS', 'Healthcare', 'Manufacturing', 'Professional Services'],
      gdpBlurb: `a growing market in ${stateName} with significant business activity`
    };
  } else {
    cityData = { ...cityData };
    cityData.stateAbbr = cityData.stateAbbr || stateAbbr.toUpperCase();
    cityData.stateName = cityData.stateName || stateName;
  }

  // Extract existing industries from page
  const industries = extractIndustries(html);
  cityData.industries = industries.length >= 2 ? industries : cityData.industries;

  // Build enriched sp-main HTML
  const enrichedMain = buildMain(cityData, lookupKey, cityData.industries);

  // Inject extra CSS if not present
  if (!html.includes('sp-research-block')) {
    html = html.replace(/<\/style>/, EXTRA_CSS + '\n    </style>');
  }

  // Determine which page structure we have and replace accordingly
  // Supports: <div class="sp-main">, <main class="sp-main">, <section class="sp-section">
  const divMainStart   = html.indexOf('<div class="sp-main">');
  const mainTagStart   = html.indexOf('<main class="sp-main">');
  const mainStart      = divMainStart !== -1 ? divMainStart : mainTagStart;
  const mainTag        = divMainStart !== -1 ? '<div class="sp-main">' : '<main class="sp-main">';
  const divSideStart   = html.indexOf('<div class="sp-sidebar">');
  const asideSideStart = html.indexOf('<aside class="sp-sidebar"');
  const sidebarStart   = divSideStart !== -1 ? divSideStart : asideSideStart;
  const sectionStart   = html.indexOf('<section class="sp-section"');
  const footerStart    = html.indexOf('<footer');

  let enrichedHtml;

  if (mainStart !== -1 && sidebarStart !== -1) {
    // ── sp-main / sp-sidebar layout (div or main/aside variants) ─────────────
    const beforeSidebar  = html.slice(0, sidebarStart);
    const lastMainClose  = beforeSidebar.lastIndexOf(divMainStart !== -1 ? '</div>' : '</main>');
    if (lastMainClose === -1) { skipped++; continue; }

    const newHtml =
      html.slice(0, mainStart + mainTag.length) +
      '\n' + enrichedMain + '\n' +
      html.slice(lastMainClose);

    enrichedHtml = newHtml.replace(
      /<div class="sp-cta-box">[\s\S]*?<\/div>\s*(?=<div class="sp-related-links">)/,
      `<div class="sp-cta-box">
<div class="sp-cta-badge">Free Strategy Call</div>
<h3>Let's Talk About Your ${cityData.city} Pipeline</h3>
<p>No pitch. No deck. 30 minutes to diagnose your marketing and map a clear path to predictable revenue growth in ${cityData.city}.</p>
<a href="/book.html" class="sp-cta-btn">Book Your Free Call &rarr;</a>
<a href="tel:+13214990689" class="sp-cta-btn ghost">(321) 499-0689</a>
<div class="sp-cta-trust">
  <span>&#9989; Month-to-month</span>
  <span>&#9989; No long-term contracts</span>
  <span>&#9989; Results in 30 days</span>
</div>
</div>
`
    );

  } else if (sectionStart !== -1 && footerStart !== -1) {
    // ── sp-section layout (root-level city pages, ~1,347 files) ─────────────
    const beforeFooter     = html.slice(0, footerStart);
    const lastSectionClose = beforeFooter.lastIndexOf('</section>');
    if (lastSectionClose === -1) { skipped++; continue; }

    enrichedHtml =
      html.slice(0, sectionStart) +
      `<section class="sp-section" style="padding:3rem 1.5rem 5rem">\n<div class="sp-content-wrap">\n` +
      enrichedMain + '\n' +
      `</div>\n</section>\n` +
      html.slice(footerStart);

  } else {
    skipped++; continue;
  }

  fs.writeFileSync(filepath, enrichedHtml, 'utf8');
  updated++;

  if (updated % 100 === 0) process.stdout.write(`  ${updated} files enriched...\n`);
}

console.log(`\nDone. Enriched: ${updated}, Skipped (already done or parse error): ${skipped}`);
