// gen-service-areas.js - generates Charlotte-metro + North Carolina service-area
// pages + a region-grouped hub. Each page is locally optimized: localized
// title/meta, LocalBusiness + Service + FAQ schema for the specific area,
// neighborhood-specific intro, local FAQ, region-aware internal links.
// URL: /service-areas/<slug>/  (served from pages/service-areas/<slug>.html)
// Run: node scripts/gen-service-areas.js

const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'pages', 'service-areas');
fs.mkdirSync(OUT, { recursive: true });
const SITE = 'https://cirilodb.com';

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/brand.css">`;

// ── Region order for the hub layout ──────────────────────────────
const REGION_ORDER = [
  'Charlotte & Neighborhoods',
  'Union County',
  'Lake Norman',
  'Cabarrus County',
  'Rowan County',
  'Iredell County',
  'Catawba Valley',
  'Lincoln County',
  'Gaston County',
  'South Carolina Line',
  'Greater North Carolina',
];

// ── Areas. region groups the hub; destination flags the statewide
//    signature-project pages (honest framing: we travel for these). ──
const AREAS = [
  // ── Charlotte & Neighborhoods ──────────────────────────────────
  { slug:'charlotte', name:'Charlotte', region:'Charlotte & Neighborhoods', hook:'the heart of the Queen City', blurb:'From the established estates of the historic core to the new luxury builds across the metro, Charlotte is where Cirilo Design + Build is based and where we build the most. Custom concrete pools engineered for the Carolina climate, designed to match Charlotte architecture from traditional to modern.', neighborhoods:'Myers Park, Eastover, SouthPark, Ballantyne, Dilworth, and beyond' },
  { slug:'southpark', name:'SouthPark', region:'Charlotte & Neighborhoods', hook:'Charlotte\'s premier luxury enclave', blurb:'SouthPark homes set the standard for Charlotte luxury, and the backyards should match. We design custom pools and outdoor living for SouthPark properties that work with mature lots, established landscaping, and the high expectations of the neighborhood.', neighborhoods:'Barclay Downs, Sharon Hills, Foxcroft' },
  { slug:'myers-park', name:'Myers Park', region:'Charlotte & Neighborhoods', hook:'Charlotte\'s most prestigious address', blurb:'Myers Park\'s tree-lined streets and historic estates demand pools that respect the architecture. We specialize in custom concrete pools that feel original to these homes, working carefully within mature lots, setbacks, and the character that makes Myers Park what it is.', neighborhoods:'Eastover, Cherry, the Myers Park historic district' },
  { slug:'eastover', name:'Eastover', region:'Charlotte & Neighborhoods', hook:'Charlotte\'s old-money estates', blurb:'Eastover\'s estate lots between Myers Park and uptown carry some of Charlotte\'s most classic architecture. We build custom concrete pools that read as original to these homes, threading carefully through mature trees, established gardens, and tight historic setbacks.', neighborhoods:'Cherokee Road, Colville, Sherwood Forest' },
  { slug:'dilworth', name:'Dilworth', region:'Charlotte & Neighborhoods', hook:'Charlotte\'s first streetcar suburb', blurb:'Dilworth\'s craftsman bungalows and renovated historic homes sit on tighter, character-rich lots. We design compact, beautifully detailed pools and courtyard-style outdoor living that fit the scale of the neighborhood without overwhelming it.', neighborhoods:'Latta Park, Dilworth Road, East Boulevard' },
  { slug:'cotswold', name:'Cotswold', region:'Charlotte & Neighborhoods', hook:'established east-side luxury', blurb:'Cotswold blends mid-century homes with a wave of high-end renovations and new builds. Mature lots give us room to design pools and outdoor living that feel settled into the landscape from day one.', neighborhoods:'Sharon Amity, Sheffield Park, Cavalier' },
  { slug:'foxcroft', name:'Foxcroft', region:'Charlotte & Neighborhoods', hook:'SouthPark\'s estate enclave', blurb:'Foxcroft\'s large wooded lots are made for private, resort-scale backyards. We design custom pools, spas, and outdoor living that take full advantage of the space and seclusion these estates offer.', neighborhoods:'Carmel, Sharon View, Foxcroft East and West' },
  { slug:'quail-hollow', name:'Quail Hollow', region:'Charlotte & Neighborhoods', hook:'home of the PGA Championship course', blurb:'Quail Hollow\'s golf-course estates expect a backyard that performs. We build resort-style pools and outdoor entertaining spaces designed to match the caliber of the homes and the views around the course.', neighborhoods:'Quail Hollow Estates, Beverly Woods, Montibello' },
  { slug:'providence', name:'Providence', region:'Charlotte & Neighborhoods', hook:'south Charlotte\'s family luxury corridor', blurb:'The Providence Road corridor mixes established estates with newer custom homes. We design pools and integrated outdoor living for how Providence families actually live and entertain, from the everyday to the big summer party.', neighborhoods:'Providence Plantation, Raintree, Bevington' },
  { slug:'ballantyne', name:'Ballantyne', region:'Charlotte & Neighborhoods', hook:'south Charlotte\'s luxury growth corridor', blurb:'Ballantyne\'s newer luxury homes are ideal canvases for modern custom pools and integrated outdoor living. We build resort-style backyards designed for how Ballantyne families actually entertain.', neighborhoods:'Ballantyne Country Club, Providence, Piper Glen' },
  { slug:'matthews', name:'Matthews', region:'Charlotte & Neighborhoods', hook:'southeast Charlotte\'s established luxury', blurb:'Matthews blends established neighborhoods with strong custom-home activity. We build custom concrete pools and outdoor living designed for Matthews lots and lifestyles.', neighborhoods:'Sardis Forest, Crews, downtown Matthews' },
  { slug:'mint-hill', name:'Mint Hill', region:'Charlotte & Neighborhoods', hook:'east Mecklenburg\'s room to build', blurb:'Mint Hill\'s larger lots give us space for full outdoor complexes, pool, spa, kitchen, and fire, all designed as one environment. It is one of the best places in the county to build big without compromise.', neighborhoods:'Brightmoor, Ashe Plantation, Olde Sycamore' },
  { slug:'pineville', name:'Pineville', region:'Charlotte & Neighborhoods', hook:'south Charlotte at the state line', blurb:'Pineville puts luxury backyards minutes from SouthPark and the SC line. We design custom pools and outdoor living for Pineville\'s established and newer custom homes alike.', neighborhoods:'McCullough, the Lancaster Highway corridor, Park Road South' },
  { slug:'plaza-midwood', name:'Plaza Midwood', region:'Charlotte & Neighborhoods', hook:'Charlotte\'s eclectic historic east side', blurb:'Plaza Midwood pairs restored bungalows with bold modern infill on character-rich lots. We design compact, beautifully detailed pools and courtyard-style outdoor living that fit the scale and personality of the neighborhood.', neighborhoods:'Chantilly, Oakhurst, Commonwealth' },
  { slug:'elizabeth', name:'Elizabeth', region:'Charlotte & Neighborhoods', hook:'Charlotte\'s second-oldest neighborhood', blurb:'Elizabeth\'s historic homes near uptown sit on tighter, tree-lined lots. We build refined, smaller-footprint pools and intimate outdoor living that respect the architecture and the history of the district.', neighborhoods:'Cherry, Oakhurst, the Elizabeth historic district' },
  { slug:'sedgefield', name:'Sedgefield', region:'Charlotte & Neighborhoods', hook:'South End\'s revitalized classic', blurb:'Sedgefield\'s bungalows and infill homes near South End and LoSo are drawing a wave of high-end renovation. We design pools and outdoor living scaled to these lots and built for how this close-in neighborhood lives.', neighborhoods:'Dilworth, South End, Revolution Park' },

  // ── Union County ───────────────────────────────────────────────
  { slug:'waxhaw', name:'Waxhaw', region:'Union County', hook:'Union County luxury custom country', blurb:'Waxhaw\'s larger lots and custom estates are perfect for ambitious pool and outdoor living projects. From vanishing edges on rolling lots to full outdoor entertaining complexes, we build the kind of backyard Waxhaw acreage was made for.', neighborhoods:'Marvin, Weddington, Millbridge, Cureton' },
  { slug:'weddington', name:'Weddington', region:'Union County', hook:'Union County\'s estate community', blurb:'Weddington\'s estate lots give us room to design without compromise. Large custom pools, integrated spas, outdoor kitchens, and landscape, all designed as one cohesive backyard environment.', neighborhoods:'Marvin, Waxhaw, the Weddington estate corridor' },
  { slug:'marvin', name:'Marvin', region:'Union County', hook:'one of NC\'s most exclusive small towns', blurb:'Marvin\'s luxury estates call for pools that match the setting. We design and build custom concrete pools and outdoor living for Marvin properties with the privacy, scale, and craftsmanship the community expects.', neighborhoods:'Marvin Ridge, Waxhaw, Weddington' },
  { slug:'indian-trail', name:'Indian Trail', region:'Union County', hook:'Union County\'s fastest-growing town', blurb:'Indian Trail\'s new custom estates and growing luxury neighborhoods leave plenty of room to build. We design pools and outdoor living for Indian Trail families who want a true backyard destination.', neighborhoods:'Brandon Oaks, Shannamara, Taylor Glenn' },
  { slug:'wesley-chapel', name:'Wesley Chapel', region:'Union County', hook:'Union County estate living', blurb:'Wesley Chapel\'s large lots and custom homes are ideal for resort-scale pools and integrated outdoor living. We build for the privacy and space that draw families to this corner of Union County.', neighborhoods:'Tuscany, Quellin, Hunter Oaks' },
  { slug:'stallings', name:'Stallings', region:'Union County', hook:'where Mecklenburg meets Union', blurb:'Stallings sits right on the county line with a mix of established and new luxury homes. We design custom concrete pools and outdoor living tailored to Stallings lots and budgets.', neighborhoods:'Stevens Mill, Chestnut, Bradford' },
  { slug:'monroe', name:'Monroe', region:'Union County', hook:'Union County\'s historic seat', blurb:'Monroe combines a grand historic core with acreage and custom estates on the edges of town. The larger lots give us room for full outdoor complexes, pool, spa, kitchen, and landscape designed as one.', neighborhoods:'the Monroe historic district, Stallings, Wesley Chapel' },
  { slug:'unionville', name:'Unionville', region:'Union County', hook:'Union County country estates', blurb:'Unionville\'s acreage and custom country homes are made for ambitious backyards. We design and engineer resort-scale pools and outdoor living for the space and privacy this part of Union County offers.', neighborhoods:'Monroe, Marshville, the Unionville crossroads' },

  // ── Lake Norman ────────────────────────────────────────────────
  { slug:'lake-norman', name:'Lake Norman', region:'Lake Norman', hook:'North Carolina\'s inland sea', blurb:'Lake Norman is the premier waterfront market in the Charlotte region, and waterfront calls for pools that play off the water. We engineer for sloped lakefront lots and design vanishing-edge and infinity pools that visually merge with the lake, across every town on the shoreline.', neighborhoods:'Cornelius, Davidson, Mooresville, Denver, Sherrills Ford' },
  { slug:'davidson', name:'Davidson', region:'Lake Norman', hook:'the Lake Norman luxury north', blurb:'Davidson combines college-town charm with serious luxury real estate, much of it near Lake Norman. We build custom pools that complement Davidson homes, including waterfront and near-water properties with their own design considerations.', neighborhoods:'River Run, the Davidson lakefront, downtown Davidson' },
  { slug:'cornelius', name:'Cornelius', region:'Lake Norman', hook:'Lake Norman waterfront living', blurb:'Cornelius is Lake Norman luxury at its center. Waterfront and lake-view homes are ideal for vanishing-edge pools that play off the water. We engineer for sloped lakefront lots and design pools that extend the lake lifestyle.', neighborhoods:'The Peninsula, Robbins Park, Lake Norman waterfront' },
  { slug:'mooresville', name:'Mooresville', region:'Lake Norman', hook:'Lake Norman\'s luxury north shore', blurb:'Mooresville\'s Lake Norman estates, including The Point, are some of the most impressive properties in the region. We build custom pools worthy of these homes, engineered for waterfront lots and designed for resort-level outdoor living.', neighborhoods:'The Point, Brawley, the Mooresville lakefront' },
  { slug:'huntersville', name:'Huntersville', region:'Lake Norman', hook:'the I-77 luxury corridor', blurb:'Huntersville sits at the gateway to Lake Norman with strong luxury growth. We design custom pools and outdoor living for Huntersville\'s newer estates and established neighborhoods alike.', neighborhoods:'Skybrook, Birkdale, NorthStone' },
  { slug:'denver', name:'Denver', region:'Lake Norman', hook:'Lake Norman\'s quieter west shore', blurb:'Denver offers Lake Norman waterfront and lake-view living on the calmer west side. We build vanishing-edge and resort-style pools engineered for the sloped lots and big water views that define this stretch of the shoreline.', neighborhoods:'Sailview, Verdict Ridge, Webbs Chapel' },
  { slug:'sherrills-ford', name:'Sherrills Ford', region:'Lake Norman', hook:'Lake Norman\'s northwest waterfront', blurb:'Sherrills Ford\'s large waterfront lots are made for ambitious pool and outdoor living projects. We engineer for lakefront grade and design backyards that make the most of the wide-open water.', neighborhoods:'Northview Harbour, The Farms, Cardinal Point' },
  { slug:'terrell', name:'Terrell', region:'Lake Norman', hook:'Lake Norman\'s western waterfront', blurb:'Terrell offers some of Lake Norman\'s most generous waterfront lots on the Catawba County side. We engineer for lakefront grade and design vanishing-edge pools that open straight onto the water.', neighborhoods:'The Farms, Lake Norman west shore, Sherrills Ford' },

  // ── Cabarrus County ────────────────────────────────────────────
  { slug:'concord', name:'Concord', region:'Cabarrus County', hook:'Cabarrus County luxury', blurb:'Concord pairs established estate neighborhoods with a steady stream of new custom builds. We design custom concrete pools and outdoor living for Concord homes across that range, from classic to contemporary.', neighborhoods:'Skybrook, Christenbury, Highland Creek' },
  { slug:'harrisburg', name:'Harrisburg', region:'Cabarrus County', hook:'Cabarrus\'s custom-home growth', blurb:'Harrisburg\'s larger lots and easy Charlotte access make it a strong market for custom pools. We build resort-style backyards designed for Harrisburg families who want room to entertain.', neighborhoods:'Rocky River, Stallings Farm, Hidden Valley' },
  { slug:'kannapolis', name:'Kannapolis', region:'Cabarrus County', hook:'north Cabarrus, room to build', blurb:'Kannapolis offers space and value for homeowners ready to build a true backyard destination. We design custom concrete pools and outdoor living tailored to Kannapolis lots and goals.', neighborhoods:'Kellswater, Irish Creek, the Lake Concord corridor' },
  { slug:'mount-pleasant', name:'Mount Pleasant', region:'Cabarrus County', hook:'Cabarrus countryside luxury', blurb:'Mount Pleasant\'s acreage and custom country homes east of Concord give us room to design without compromise. Large pools, integrated spas, and full outdoor living, all built for the space.', neighborhoods:'Concord, Midland, the Mount Pleasant historic district' },

  // ── Rowan County ───────────────────────────────────────────────
  { slug:'salisbury', name:'Salisbury', region:'Rowan County', hook:'Rowan County\'s historic estates', blurb:'Salisbury\'s grand historic homes and large in-town lots call for pools that respect the architecture. We design custom concrete pools and outdoor living that feel original to these estates, working carefully within mature grounds.', neighborhoods:'West Square, Country Club Hills, Milford Hills' },
  { slug:'china-grove', name:'China Grove', region:'Rowan County', hook:'south Rowan, room to build', blurb:'China Grove\'s value acreage between Charlotte and Salisbury is ideal for ambitious backyards. We build custom pools and outdoor living designed for the space south Rowan offers.', neighborhoods:'Landis, Kannapolis, the China Grove corridor' },

  // ── Iredell County ─────────────────────────────────────────────
  { slug:'statesville', name:'Statesville', region:'Iredell County', hook:'Iredell County\'s custom-home north', blurb:'Statesville pairs established estate neighborhoods with acreage on the edges of town. The larger lots are perfect for full outdoor complexes, designed and engineered as one cohesive backyard.', neighborhoods:'the Davie Avenue historic district, the Statesville country club area, Twin Oaks' },
  { slug:'troutman', name:'Troutman', region:'Iredell County', hook:'Iredell County near Lake Norman', blurb:'Troutman\'s growing custom-home market south of Statesville sits within reach of Lake Norman. We design custom pools and outdoor living for Troutman\'s new estates and acreage homes.', neighborhoods:'Falls Cove, the Troutman corridor, the south Iredell lakefront' },

  // ── Catawba Valley ─────────────────────────────────────────────
  { slug:'hickory', name:'Hickory', region:'Catawba Valley', hook:'the Catawba Valley\'s luxury hub', blurb:'Hickory anchors the Catawba Valley with established estate neighborhoods and Lake Hickory waterfront. We design custom concrete pools and outdoor living for both, engineering for lakefront grade where the lot calls for it.', neighborhoods:'Oakwood, Kenworth, the Lake Hickory shoreline' },
  { slug:'newton', name:'Newton', region:'Catawba Valley', hook:'Catawba County custom country', blurb:'Newton\'s acreage and custom homes give us room to build big. We design resort-scale pools and integrated outdoor living for the space and privacy this part of the valley offers.', neighborhoods:'the Newton historic district, Conover, Maiden' },
  { slug:'conover', name:'Conover', region:'Catawba Valley', hook:'Catawba Valley growth', blurb:'Conover\'s new custom homes near Hickory are ideal canvases for modern pools and outdoor living. We build backyards designed for how Catawba Valley families entertain.', neighborhoods:'Hickory, Newton, the Rock Barn area' },
  { slug:'lake-hickory', name:'Lake Hickory', region:'Catawba Valley', hook:'the Catawba\'s northern lake', blurb:'Lake Hickory\'s waterfront homes are made for pools that play off the water. We engineer for sloped lakefront lots and design vanishing-edge pools that extend the on-the-water lifestyle.', neighborhoods:'Oxford, Sandy Ridge, the Lake Hickory shoreline' },

  // ── Lincoln County ─────────────────────────────────────────────
  { slug:'lincolnton', name:'Lincolnton', region:'Lincoln County', hook:'Lincoln County\'s custom country', blurb:'Lincolnton\'s acreage and historic estates west of Lake Norman give us room to design without compromise. We build custom concrete pools and full outdoor living for the scale and privacy of these properties.', neighborhoods:'the Lincolnton historic district, Boger City, Denver' },

  // ── Gaston County ──────────────────────────────────────────────
  { slug:'belmont', name:'Belmont', region:'Gaston County', hook:'the Catawba riverfront comeback', blurb:'Belmont\'s riverfront homes and revitalized historic core have made it one of the region\'s most desirable small towns. We build custom pools and outdoor living that take advantage of the water and the charm that define Belmont.', neighborhoods:'McLean, Reflection Pointe, South Point' },
  { slug:'mount-holly', name:'Mount Holly', region:'Gaston County', hook:'Gaston riverfront living', blurb:'Mount Holly\'s river and lake-adjacent homes near Mountain Island Lake are ideal for pools that connect to the water. We design and engineer for the grade and views these properties offer.', neighborhoods:'Mountain Island Lake, Tuckaseege, the Catawba riverfront' },
  { slug:'gastonia', name:'Gastonia', region:'Gaston County', hook:'Gaston County\'s luxury core', blurb:'Gastonia\'s established estate neighborhoods, including Cramer Mountain, call for backyards that match. We build custom concrete pools and outdoor living designed for Gastonia\'s finest homes.', neighborhoods:'Cramer Mountain, Gardner Park, the Country Club district' },

  // ── South Carolina Line ────────────────────────────────────────
  { slug:'tega-cay', name:'Tega Cay', region:'South Carolina Line', hook:'Lake Wylie luxury just over the SC line', blurb:'Tega Cay\'s Lake Wylie peninsula setting makes it ideal for waterfront and lake-view pools. We serve Tega Cay and the surrounding Lake Wylie communities with custom concrete pools built for the water.', neighborhoods:'The Lake Wylie peninsula, Stonecrest, Glennon' },
  { slug:'fort-mill', name:'Fort Mill SC', region:'South Carolina Line', hook:'the booming SC luxury suburb', blurb:'Fort Mill\'s rapid luxury growth just south of Charlotte makes it one of our most active expansion areas. We build custom pools and outdoor living for Fort Mill\'s new estates and established communities.', neighborhoods:'Baxter Village, Tega Cay, Springfield' },
  { slug:'lake-wylie', name:'Lake Wylie', region:'South Carolina Line', hook:'the Carolinas\' shared lake', blurb:'Lake Wylie spans the NC and SC line with some of the region\'s best waterfront. We design vanishing-edge and resort-style pools engineered for lakefront lots and built to extend the on-the-water lifestyle.', neighborhoods:'River Hills, The Palisades, Handsmill' },
  { slug:'indian-land', name:'Indian Land', region:'South Carolina Line', hook:'Lancaster County\'s boom corridor', blurb:'Indian Land\'s wave of new luxury estates just over the line has made it one of the fastest-growing markets near Charlotte. We build custom pools and outdoor living for Indian Land\'s new construction and established homes.', neighborhoods:'Sun City, Walnut Creek, Edgewater' },
  { slug:'rock-hill', name:'Rock Hill', region:'South Carolina Line', hook:'York County luxury', blurb:'Rock Hill blends established estates with new custom-home growth along the Catawba. We design custom concrete pools and outdoor living for Rock Hill homes across the range.', neighborhoods:'Baxter, India Hook, Riverwalk' },
  { slug:'clover', name:'Clover', region:'South Carolina Line', hook:'York County\'s quieter luxury', blurb:'Clover\'s acreage near Lake Wylie offers privacy and room to build just over the line. We design custom pools and full outdoor living for Clover\'s lake-adjacent estates and country homes.', neighborhoods:'Lake Wylie, Bethel, the Clover countryside' },
  { slug:'york', name:'York', region:'South Carolina Line', hook:'York County\'s historic seat', blurb:'York\'s acreage and historic homes give us room to design ambitious backyards. We build custom concrete pools and outdoor living for York properties with the scale and craftsmanship they deserve.', neighborhoods:'downtown York, Lake Wylie, the Kings Mountain area' },

  // ── Greater North Carolina (destination / signature projects) ──
  { slug:'lake-norman-waterfront', name:'Lake Norman Waterfront', region:'Lake Norman', hook:'the region\'s premier waterfront builds', blurb:'Waterfront is its own discipline. On Lake Norman\'s most demanding lakefront lots, we engineer for grade, retaining, and views, then design vanishing-edge and infinity pools that read as an extension of the lake itself.', neighborhoods:'The Point, The Peninsula, Sailview, Northview Harbour' },
  { slug:'raleigh', name:'Raleigh', region:'Greater North Carolina', destination:true, hook:'the Triangle\'s signature backyards', blurb:'Raleigh\'s luxury neighborhoods deserve pools built to the same standard as the homes. For signature projects in the Triangle, we bring the full Cirilo design-build team and our engineering-first process to your site.', neighborhoods:'North Hills, Budleigh, Five Points, Hayes Barton' },
  { slug:'cary', name:'Cary', region:'Greater North Carolina', destination:true, hook:'the Triangle\'s planned luxury', blurb:'Cary\'s master-planned estates and custom homes are ideal for fully integrated outdoor living. For destination builds in the Triangle, we bring our team and partner with vetted local trades under one accountable point of contact.', neighborhoods:'Preston, MacGregor Downs, Carolina Preserve' },
  { slug:'greensboro', name:'Greensboro', region:'Greater North Carolina', destination:true, hook:'the Triad\'s estate neighborhoods', blurb:'Greensboro\'s historic estate neighborhoods call for pools that respect the architecture and the lot. For signature Triad projects, we bring the full design-build team and our concrete-pool engineering to your property.', neighborhoods:'Irving Park, Sedgefield, New Irving Park' },
  { slug:'winston-salem', name:'Winston-Salem', region:'Greater North Carolina', destination:true, hook:'the Triad\'s old-money west', blurb:'Winston-Salem\'s established estates pair classic architecture with generous grounds. For destination builds in the Triad, we bring our design-build team and engineering-first approach to create pools that feel original to the home.', neighborhoods:'Buena Vista, Reynolda, West Highlands' },
  { slug:'asheville', name:'Asheville', region:'Greater North Carolina', destination:true, hook:'Blue Ridge mountain luxury', blurb:'Asheville\'s mountain estates present some of the most dramatic, and most demanding, sites in the state. For signature mountain builds we engineer for slope and stone and design pools that frame the Blue Ridge views.', neighborhoods:'Biltmore Forest, Montford, The Ramble' },
  { slug:'wilmington', name:'Wilmington', region:'Greater North Carolina', destination:true, hook:'the Carolina coast', blurb:'From the historic district to the island estates, Wilmington\'s coastal homes call for pools engineered for the environment. For destination coastal projects, we bring the full Cirilo team and our concrete-pool expertise to the shore.', neighborhoods:'Landfall, Figure Eight Island, Wrightsville Beach' },
  { slug:'pinehurst', name:'Pinehurst', region:'Greater North Carolina', destination:true, hook:'the home of American golf', blurb:'Pinehurst\'s Sandhills golf estates expect resort-grade backyards. For signature projects in the Sandhills, we bring the full Cirilo design-build team and our engineering-first process to create pools worthy of the setting.', neighborhoods:'the Pinehurst No. 2 corridor, CCNC, Forest Creek' },
  { slug:'highlands', name:'Highlands', region:'Greater North Carolina', destination:true, hook:'the Blue Ridge\'s luxury plateau', blurb:'Highlands\' high-elevation estates are among the most dramatic, and demanding, sites in the state. For signature mountain builds we engineer for slope and stone and design pools that frame the plateau views.', neighborhoods:'Highlands Country Club, Wildcat Cliffs, Cullasaja Club' },
  { slug:'cashiers', name:'Cashiers', region:'Greater North Carolina', destination:true, hook:'the plateau\'s estate country', blurb:'Cashiers pairs mountain luxury with some of the region\'s finest private clubs. For destination builds on the plateau we bring our team and engineer for the terrain, designing pools that sit naturally into the landscape.', neighborhoods:'Lake Toxaway, Wade Hampton, Trillium' },
  { slug:'blowing-rock', name:'Blowing Rock', region:'Greater North Carolina', destination:true, hook:'the High Country\'s resort village', blurb:'Blowing Rock\'s mountain estates near Boone call for pools built for elevation and view. For signature High Country projects we bring the full design-build team and engineer for the grade and the climate.', neighborhoods:'Chetola, Mayview, the Blowing Rock village' },
  { slug:'chapel-hill', name:'Chapel Hill', region:'Greater North Carolina', destination:true, hook:'the Triangle\'s academic luxury', blurb:'Chapel Hill\'s established estates deserve pools built to match. For destination projects in the Triangle, we bring our design-build team and concrete-pool engineering and partner with vetted local trades under one point of contact.', neighborhoods:'Gimghoul, Franklin-Rosemary, Governors Club' },
  { slug:'durham', name:'Durham', region:'Greater North Carolina', destination:true, hook:'the Triangle\'s restored grandeur', blurb:'Durham\'s historic and new luxury homes pair beautifully with custom outdoor living. For signature Triangle builds we bring the full Cirilo team and our engineering-first approach to your property.', neighborhoods:'Hope Valley, Forest Hills, Trinity Park' },
];

function relatedFor(a) {
  const same = AREAS.filter(x => x.region === a.region && x.slug !== a.slug);
  const rest = AREAS.filter(x => x.region !== a.region && x.slug !== a.slug);
  return same.concat(rest).slice(0, 10);
}

function renderArea(a) {
  const dest = !!a.destination;
  const cityName = a.name.replace(' SC', '').replace(' Waterfront', '');
  const localBiz = {
    "@context":"https://schema.org", "@type":"LocalBusiness",
    "name": `Cirilo Design + Build - ${a.name} Pool Builder`,
    "description": `Luxury custom concrete pool builder serving ${cityName}, NC and the surrounding area.`,
    "url": `${SITE}/service-areas/${a.slug}`,
    "telephone": "+1-910-409-0648",
    "areaServed": { "@type":"City", "name": cityName },
    "parentOrganization": { "@type":"LocalBusiness", "name":"Cirilo Design + Build", "@id": SITE+"/#business" }
  };
  const faqs = dest ? [
    [`Does Cirilo Design + Build take projects in ${cityName}?`, `Yes, on a select basis. We take on signature custom pool and outdoor-living projects in ${cityName} as destination builds, bringing our full design-build team and engineering-first process and partnering with vetted local trades, all under one accountable point of contact from concept to fill day.`],
    [`How much does a custom pool cost in ${cityName}?`, `Luxury custom concrete pools typically run $100 to $250 per square foot, with most fully integrated builds landing between $150,000 and $400,000. For destination projects we confirm a clear budget range up front, including any travel and logistics.`],
    [`How do I start a ${cityName} project?`, `Reach out about your project. For destination builds we start with a call and a site review, then bring the team to ${cityName} to walk through your vision, budget, and timeline.`],
  ] : [
    [`Do you build custom pools in ${cityName}?`, `Yes. Cirilo Design + Build designs and builds custom concrete pools, outdoor living, renovations, and additions throughout ${cityName} and the greater Charlotte metro. We handle permitting and HOA approval locally.`],
    [`How much does a custom pool cost in ${cityName}?`, `Luxury custom concrete pools in the ${cityName} area typically run $100 to $250 per square foot, with most fully integrated builds landing between $150,000 and $400,000. We provide a clear budget range at your on-site consultation.`],
    [`How do I get started on a pool in ${cityName}?`, `Book a design consultation. We come to your ${cityName} property, assess the site, and walk through your vision, budget, and timeline. No obligation.`],
  ];
  const faqSchema = { "@context":"https://schema.org","@type":"FAQPage","mainEntity": faqs.map(([q,ans])=>({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":ans}})) };
  const others = relatedFor(a);
  const heroSub = dest
    ? `Custom concrete pools and outdoor living for ${a.hook}. For signature projects across North Carolina, we bring the full Cirilo design-build team, engineering-first, one accountable point of contact from concept to fill day.`
    : `Custom concrete pools and outdoor living for ${a.hook}. Design-build under one roof, permitted and engineered, one accountable team from concept to fill day.`;
  const ctaLabel = dest ? `Start a ${cityName} Project` : `Book a ${cityName} Consultation`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Luxury Pool Builder in ${a.name} | Cirilo Design + Build</title>
<meta name="description" content="Custom concrete pool builder serving ${cityName}, NC. Luxury pools, outdoor living, renovations, and additions for ${cityName} homes. Design-build, permitted and engineered. ${dest ? 'Signature projects statewide.' : 'Book a consultation.'}">
<link rel="canonical" href="${SITE}/service-areas/${a.slug}">
<meta property="og:type" content="website">
<meta property="og:title" content="Luxury Pool Builder in ${a.name} | Cirilo Design + Build">
<meta property="og:description" content="Custom concrete pools and outdoor living for ${cityName} homes. Design-build, permitted, engineered.">
<meta property="og:url" content="${SITE}/service-areas/${a.slug}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(localBiz)}</script>
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
${FONTS}
</head>
<body>
<!--#include file="_header.html" -->
<main>
  <section class="hero-dark">
    <div class="container">
      <div class="eyebrow mb-sm">Serving ${a.name}</div>
      <h1 style="font-size:var(--fs-hero);max-width:18ch;margin-bottom:var(--space-md);">Luxury Pool Builder in ${a.name}</h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.82);max-width:640px;margin-bottom:var(--space-lg);">${heroSub}</p>
      <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
        <a href="/contact" class="btn btn-primary">${ctaLabel}</a>
        <a href="/portfolio" class="btn btn-ghost">See the Work</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container-narrow">
      <div class="eyebrow mb-sm">Custom Pools in ${cityName}</div>
      <h2 class="mb-md">Built for ${cityName} homes.</h2>
      <p style="font-size:1.1rem;line-height:1.8;">${a.blurb}</p>
      <p style="color:var(--muted);">Serving ${a.neighborhoods}, and the surrounding ${cityName} area.</p>
    </div>
  </section>

  <section class="section" style="background:var(--gold-pale);padding-top:var(--space-xl);padding-bottom:var(--space-xl);">
    <div class="container">
      <div class="grid grid-4">
        <a href="/custom-concrete-swimming-pools" class="card card-link"><h3 style="font-size:1.2rem;color:var(--ink);">Custom Pools</h3><p style="font-size:0.9rem;margin:0;">Gunite, vanishing edge, spas.</p></a>
        <a href="/outdoor-living-spaces" class="card card-link"><h3 style="font-size:1.2rem;color:var(--ink);">Outdoor Living</h3><p style="font-size:0.9rem;margin:0;">Kitchens, fire, hardscape.</p></a>
        <a href="/home-renovations-and-remodeling" class="card card-link"><h3 style="font-size:1.2rem;color:var(--ink);">Renovations</h3><p style="font-size:0.9rem;margin:0;">Kitchens, baths, full home.</p></a>
        <a href="/home-additions" class="card card-link"><h3 style="font-size:1.2rem;color:var(--ink);">Additions</h3><p style="font-size:0.9rem;margin:0;">Seamless expansions.</p></a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container-narrow">
      <div class="text-center" style="margin-bottom:var(--space-xl);">
        <div class="eyebrow mb-sm">${cityName} Pool FAQ</div>
        <h2>Common questions in ${cityName}.</h2>
      </div>
      ${faqs.map(([q,ans])=>`<details class="faq-item"><summary>${q}</summary><p>${ans}</p></details>`).join('\n      ')}
    </div>
  </section>

  <section class="section" style="padding-top:0;">
    <div class="container">
      <div class="areas-strip">
        <div class="eyebrow mb-sm">We Also Serve</div>
        <div class="areas-links">
          ${others.map(o=>`<a href="/service-areas/${o.slug}">${o.name}</a>`).join('\n          ')}
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0;">
    <div class="container">
      <div class="cta-block">
        <div>
          <div class="eyebrow mb-sm" style="color:var(--gold-mid);">${cityName} Projects</div>
          <h2 style="color:var(--white);margin-bottom:var(--space-sm);">Let's design your ${cityName} backyard.</h2>
          <p style="color:rgba(255,255,255,0.78);margin:0;max-width:520px;">${dest ? 'Destination and signature projects across North Carolina. Tell us about your site.' : 'On-site consultation, no obligation. We come to you.'}</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-sm);">
          <a href="/contact" class="btn btn-primary">${dest ? 'Start a Project' : 'Book Consultation'}</a>
          <a href="tel:+19104090648" class="btn btn-ghost">Call (910) 409-0648</a>
        </div>
      </div>
    </div>
  </section>
</main>
<!--#include file="_footer.html" -->
<script>(function(){try{var k='cdb_jsid';var s=sessionStorage.getItem(k)||('s_'+Math.random().toString(36).slice(2)+Date.now().toString(36));sessionStorage.setItem(k,s);fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:'view',page:'service-area',area:'${a.slug}',session_id:s,url:location.pathname,title:document.title,referrer:document.referrer||null}),keepalive:true}).catch(function(){});}catch(e){}})();</script>
<style>
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
</style>
</body>
</html>
`;
}

// ── Hub page (grouped by region) ─────────────────────────────────
function renderHub() {
  const byRegion = {};
  for (const a of AREAS) { (byRegion[a.region] = byRegion[a.region] || []).push(a); }
  const regions = REGION_ORDER.filter(r => byRegion[r] && byRegion[r].length);
  const groupsHtml = regions.map(function(r){
    return `<div style="margin-bottom:var(--space-xl);">
        <div class="eyebrow mb-sm">${r}</div>
        <div class="grid grid-3">
        ${byRegion[r].map(a=>`<a href="/service-areas/${a.slug}" class="card card-link"><h3 style="font-size:1.4rem;color:var(--ink);margin-bottom:0.35rem;">${a.name}</h3><p style="font-size:0.9rem;color:var(--muted);margin:0;">${a.hook}</p></a>`).join('\n        ')}
        </div>
      </div>`;
  }).join('\n      ');

  const itemList = { "@context":"https://schema.org","@type":"ItemList","itemListElement": AREAS.map(function(a,i){ return {"@type":"ListItem","position":i+1,"name":a.name,"url":`${SITE}/service-areas/${a.slug}`}; }) };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Service Areas | Charlotte Metro & North Carolina Pool Builder | Cirilo Design + Build</title>
<meta name="description" content="Cirilo Design + Build serves the Charlotte, NC metro with luxury custom pools and outdoor living, including SouthPark, Myers Park, Lake Norman, Waxhaw, Union County, and the SC line, plus signature projects across North Carolina.">
<link rel="canonical" href="${SITE}/service-areas/">
<meta property="og:type" content="website">
<meta property="og:title" content="Service Areas | Cirilo Design + Build">
<meta property="og:description" content="Luxury custom pools across the Charlotte metro and North Carolina.">
<meta property="og:url" content="${SITE}/service-areas/">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(itemList)}</script>
${FONTS}
</head>
<body>
<!--#include file="_header.html" -->
<main>
  <section class="hero-dark">
    <div class="container">
      <div class="eyebrow mb-sm">Where We Build</div>
      <h1 style="font-size:var(--fs-hero);margin-bottom:var(--space-md);">Service Areas</h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.82);max-width:640px;">Based in Charlotte, serving the entire metro, the Lake Norman shoreline, Union County, and the South Carolina line, plus signature projects across North Carolina. Find your area below.</p>
    </div>
  </section>
  <section class="section">
    <div class="container">
      <div class="text-center" style="max-width:640px;margin:0 auto var(--space-xl);">
        <div class="eyebrow mb-sm">Charlotte Metro & North Carolina</div>
        <h2>Communities we serve.</h2>
      </div>
      ${groupsHtml}
      <div class="text-center" style="margin-top:var(--space-md);">
        <p class="text-muted">Don't see your area? We are always expanding across North Carolina. <a href="/contact">Reach out</a> and ask.</p>
      </div>
    </div>
  </section>
</main>
<!--#include file="_footer.html" -->
<script>(function(){try{var k='cdb_jsid';var s=sessionStorage.getItem(k)||('s_'+Math.random().toString(36).slice(2)+Date.now().toString(36));sessionStorage.setItem(k,s);fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:'view',page:'service-areas-hub',session_id:s,url:location.pathname,title:document.title,referrer:document.referrer||null}),keepalive:true}).catch(function(){});}catch(e){}})();</script>
</body>
</html>
`;
}

let count = 0;
fs.writeFileSync(path.join(OUT, 'index.html'), renderHub());
console.log('OK service-areas/index.html (hub)');
count++;
for (const a of AREAS) {
  fs.writeFileSync(path.join(OUT, a.slug + '.html'), renderArea(a));
  console.log('OK service-areas/' + a.slug + '.html');
  count++;
}
console.log(`\n${count} service-area pages written (1 hub + ${AREAS.length} areas)`);
