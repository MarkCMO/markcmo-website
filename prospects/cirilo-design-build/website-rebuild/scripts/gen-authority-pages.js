// gen-authority-pages.js - generates the SEO authority cluster: a /guides/ hub
// plus in-depth topic pages under /guides/<slug>. Each spoke targets Charlotte, NC
// and North Carolina, and links to siblings + core service pages (hub-and-spoke).
// Each page: Article + BreadcrumbList + FAQPage schema, hero, depth sections,
// feature grid, local NC block, FAQ, related guides, CTA. Matches brand template.
// Run: node scripts/gen-authority-pages.js   (writes into pages/guides/)

const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'pages', 'guides');
const SITE = 'https://cirilodb.com';

// ── Topic cluster data (Charlotte / NC authority pages) ─────────────
const TOPICS = [
  {
    slug: 'concrete-pool-construction',
    nav: 'Concrete Pools',
    eyebrow: 'Authority Guide',
    h1: 'Concrete (Gunite) Pool Construction in Charlotte, NC',
    title: 'Concrete Pool Construction Charlotte NC: Gunite Builder Guide | Cirilo Design + Build',
    metaDesc: 'How custom concrete (gunite) pools are engineered and built in Charlotte, NC. The 14-stage process, concrete vs fiberglass vs vinyl, costs, permits, and what separates a 50-year shell from a cheap one. Serving the Charlotte metro and North Carolina.',
    lede: 'Concrete is the only pool material you can shape into anything and trust for 50 years. Here is exactly how a gunite pool is engineered, poured, and finished, and why the concrete company you choose matters more than any single feature.',
    intro: 'A concrete pool is not poured like a driveway. It is a steel-reinforced, engineered shell sprayed under pressure, cured, and finished in layers. Done right, it outlasts the house around it. Done cheaply, it cracks, leaks, and stains within a few seasons. This guide walks through the real construction process we follow on every Charlotte build, so you can tell a serious concrete pool company from a volume contractor.',
    sections: [
      ['Gunite vs shotcrete: what is actually sprayed into your backyard',
        '<p>Both gunite and shotcrete are pneumatically applied concrete. The difference is when the water is added. Gunite mixes dry material with water at the nozzle, which gives an experienced crew tight control over consistency on vertical walls and tight radii. Shotcrete arrives pre-mixed. For complex luxury shapes, vanishing edges, and raised spas, we favor gunite for the control it gives the crew at the nozzle. Either way, the shell is only as strong as the steel inside it and the crew spraying it.</p>'],
      ['The 14 stages, and where corners get cut',
        '<p>A real concrete pool runs through excavation, steel and bonding, plumbing, electrical, gas, pre-gunite inspection, gunite shell, tile and coping, decking, interior finish, equipment set, fill, start-up, and final inspection. The two stages homeowners never see are the two that decide the next 30 years: the steel cage and the pre-gunite inspection. We photograph rebar spacing and bonding at every build and hold the inspection before a single yard of concrete is sprayed. A company that rushes past those stages is building you a future repair bill.</p>'],
      ['Concrete vs fiberglass vs vinyl in the Carolina climate',
        '<p>Fiberglass is fast and fine for simple shapes, but you are limited to a manufactured mold and a fixed size. Vinyl liners are the cheapest up front and the most expensive over time, because the liner is a wear part that gets replaced. Concrete is the premium path: any shape, any depth, integrated spas and edges, and a structural shell engineered for North Carolina soil and freeze-thaw cycles. For a luxury build that holds its value, concrete is the only material that does not put a ceiling on the design.</p>'],
    ],
    features: [
      ['Engineered Steel Cage', 'Reinforcing steel placed and tied to structural spec, then bonded to a grounding grid for electrical safety. Inspected and photographed before gunite.'],
      ['Pressure-Sprayed Shell', 'Gunite applied by an experienced nozzle crew, carved to the design, then cured properly so it reaches full structural strength.'],
      ['Premium Interior Finishes', 'Quartz, pebble, and glass-tile surfaces selected from the full catalog so the finish matches the design intent and the Carolina light.'],
      ['Integrated Edges and Spas', 'Vanishing edges, spillover spas, and tanning ledges built into the shell, not added on later as a weak point.'],
      ['Permits and Inspections', 'Pulled in our name across Mecklenburg and Union counties, with every required inspection passed on the record.'],
      ['10-Year Structural Warranty', 'Every Cirilo shell carries a 10-year structural warranty, plus manufacturer warranties on all equipment.'],
    ],
    faqs: [
      ['How much does a concrete pool cost in Charlotte, NC?', 'Custom gunite pools in the Charlotte metro typically run $100 to $250 per square foot. A fully integrated build with spa, edge detail, and surrounding outdoor living usually lands between $150K and $400K. You get a clear budget range at the design consultation.'],
      ['How long does a concrete pool take to build?', 'Plan on 3 to 6 months from excavation to fill, depending on weather, permitting, and design complexity. The shell cures and is built up in stages, which is what makes concrete durable. Faster is not better with structural concrete.'],
      ['Do concrete pools crack in North Carolina winters?', 'A properly engineered, steel-reinforced shell built on correctly compacted soil handles Carolina freeze-thaw cycles for decades. Cracking almost always traces back to skipped steel, poor soil prep, or a rushed pour, which is exactly why the steel cage and pre-gunite inspection matter.'],
      ['What should I ask a concrete pool company before signing?', 'Ask who pulls the permit, whether they photograph the steel and pass a pre-gunite inspection, what the structural warranty covers, and who your single point of contact is from dig to fill. If those answers are vague, keep looking.'],
    ],
    related: ['3d-pool-design', 'hot-tubs-and-spas', 'pool-landscaping'],
  },
  {
    slug: '3d-pool-design',
    nav: '3D Design',
    eyebrow: 'Authority Guide',
    h1: '3D Pool Design and CAD Renderings in Charlotte, NC',
    title: '3D Pool Design and CAD Renderings Charlotte NC | Cirilo Design + Build',
    metaDesc: 'See your pool before you build it. How 3D CAD design and photorealistic renderings turn a Charlotte, NC backyard into a buildable plan, catch problems early, and lock budget before excavation. Serving the Charlotte metro and North Carolina.',
    lede: 'The most expensive pool is the one you change halfway through the build. 3D design fixes that. We model your entire backyard in CAD first, so you walk the finished space before we ever break ground.',
    intro: 'A flat sketch hides the things that cost money: grade changes, sight lines, how the spa spills into the pool, where the sun falls at 6pm. We design every Cirilo project in 3D so you make decisions looking at a photorealistic model of your real yard, not your imagination. It is faster, it is cheaper, and it is the difference between a pool that fits the home and one that fights it.',
    sections: [
      ['From site survey to buildable CAD model',
        '<p>Design starts with measurements, not pictures. We capture the property, the grade, the home elevations, setbacks, and easements, then build a to-scale 3D model of your actual backyard. Because the model is built on real survey data, what you approve is what gets permitted and built. The render is not marketing art. It is the construction plan, dressed up enough that you can actually picture living in it.</p>'],
      ['Walk the space before you spend a dollar on concrete',
        '<p>In the 3D model we test the things that matter: where the tanning ledge catches afternoon sun, how the vanishing edge reads from the kitchen window, whether the outdoor kitchen blocks the view of the water, how decking flows to the back door. Moving a spa three feet in CAD is free. Moving it after the steel is set is a change order. Designing in 3D moves every expensive decision to the cheapest possible moment.</p>'],
      ['Materials, lighting, and the final look',
        '<p>We render interior finishes, coping, decking, tile, and water features in the model so you compare real options side by side, and we simulate the LED lighting scheme so you see the pool at night, not just at noon. By the time you sign, there are no surprises about color, texture, or how it all comes together. The render becomes the shared reference everyone on the build is working toward.</p>'],
    ],
    features: [
      ['To-Scale Site Modeling', 'Your real backyard, grade, and home elevations modeled from survey data so the design is buildable, not just pretty.'],
      ['Photorealistic Renderings', 'See finishes, water features, and decking in context before anything is ordered or poured.'],
      ['Day and Night Views', 'We simulate the LED and landscape lighting scheme so you approve how the pool looks after dark.'],
      ['Material Comparisons', 'Swap tile, coping, decking, and interior finishes in the model to compare real options side by side.'],
      ['Fewer Change Orders', 'Every expensive decision gets made in CAD, where changes are free, not mid-build where they are not.'],
      ['One Shared Plan', 'The approved model becomes the reference the whole build team works from, so nothing gets lost in translation.'],
    ],
    faqs: [
      ['Do I get 3D renderings of my actual backyard?', 'Yes. We model your real property from survey measurements, so the renderings show your yard, your home, and your grade, not a generic template. What you approve is what we permit and build.'],
      ['Does 3D design cost extra?', 'Design is part of our design-build process, not an upsell tacked on later. We review the scope and design fee at your consultation so it is clear from the start.'],
      ['Can you show the pool at night with the lighting on?', 'Yes. We simulate the LED pool lighting and low-voltage landscape lighting in the model so you can approve the nighttime look before any fixtures are installed.'],
      ['How many revisions do I get?', 'We refine the design with you until it is right. Catching changes in the model is exactly the point, so we would rather revise the CAD than revise the concrete.'],
    ],
    related: ['concrete-pool-construction', 'pool-landscaping', 'outdoor-kitchens'],
  },
  {
    slug: 'pool-landscaping',
    nav: 'Pool Landscaping',
    eyebrow: 'Authority Guide',
    h1: 'Pool Landscaping and Poolscapes in Charlotte, NC',
    title: 'Pool Landscaping and Poolscape Design Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Landscaping designed around the pool, not after it. Privacy plantings, hardscape, grading, drainage, and lighting for Charlotte, NC backyards. The plants that thrive poolside in North Carolina and the ones that do not. Serving the Charlotte metro and NC.',
    lede: 'A great pool in a bare yard still looks unfinished. The landscaping is what turns a pool into a private resort, and the best poolscapes are designed at the same time as the pool, not bolted on at the end.',
    intro: 'Landscaping around a pool has rules that ordinary yard plantings do not. The wrong tree drops leaves and stains the deck. The wrong grade sends runoff into the pool. The wrong plant near the water needs constant cleanup. We design the poolscape alongside the pool so privacy, plantings, hardscape, drainage, and lighting all work together from day one.',
    sections: [
      ['Plants that belong near a Carolina pool',
        '<p>Poolside planting is about low litter, no invasive roots, and year-round structure. In the Charlotte climate we lean on evergreens and clumping plants that give privacy without dropping debris into the water: things like cryptomeria, hollies, ornamental grasses, and clumping bamboo where a fast screen is needed. We keep heavy fruit and flower droppers and aggressive surface-rooting trees away from the deck and the equipment. The goal is a lush, private backyard that does not turn into a daily skimming chore.</p>'],
      ['Hardscape, grading, and drainage',
        '<p>Water has to go somewhere. Before any plant goes in, the grade around the pool is set to move stormwater away from the shell, the deck, and the house. Travertine, porcelain pavers, and natural stone are specified to match the pool and stay cool and slip-resistant underfoot. Retaining walls and terracing turn a sloped Charlotte lot into usable, level outdoor rooms instead of a hillside you cannot use.</p>'],
      ['Privacy, lighting, and the finished feel',
        '<p>Privacy is the most requested poolscape feature, and it is a design problem, not just a fence. Layered plantings, structures, and grade changes screen neighbors without walling the yard in. After dark, low-voltage landscape lighting and integrated pool LEDs turn the backyard into a usable evening space and make the whole design read as one intentional environment rather than separate projects stitched together.</p>'],
    ],
    features: [
      ['Privacy Screening', 'Layered evergreen plantings and clumping screens that give privacy without dropping debris into the pool.'],
      ['Low-Litter Plant Palette', 'Species chosen for the Charlotte climate that look lush poolside without creating a daily cleanup chore.'],
      ['Grading and Drainage', 'The grade is set to carry stormwater away from the shell, deck, and home before anything is planted.'],
      ['Hardscape and Decking', 'Travertine, porcelain, and natural stone specified to match the pool and stay cool and slip-resistant.'],
      ['Retaining Walls and Terracing', 'Sloped lots turned into level, usable outdoor rooms instead of unusable hillside.'],
      ['Landscape Lighting', 'Low-voltage lighting that extends the usable hours and ties the whole backyard together at night.'],
    ],
    faqs: [
      ['What are the best plants to put around a pool in North Carolina?', 'Low-litter evergreens and clumping plants work best: cryptomeria, hollies, ornamental grasses, and clumping bamboo for fast privacy. We avoid heavy leaf and fruit droppers and aggressive surface-rooting trees near the deck and equipment.'],
      ['Should landscaping be designed with the pool or after?', 'With the pool, always. Grading, drainage, privacy, and hardscape are far cheaper and far better when they are part of the original design instead of a fix after the fact.'],
      ['Can you landscape a sloped Charlotte backyard for a pool?', 'Yes. Retaining walls, terracing, and proper grading turn a slope into level, usable outdoor rooms. Sloped lots are also where vanishing-edge pools look their best.'],
      ['Do you handle drainage so water stays out of the pool?', 'Yes. Setting the grade to move stormwater away from the pool, deck, and home is one of the first things we design, before any planting goes in.'],
    ],
    related: ['concrete-pool-construction', 'pergolas-and-shade-structures', 'outdoor-kitchens'],
  },
  {
    slug: 'pergolas-and-shade-structures',
    nav: 'Pergolas',
    eyebrow: 'Authority Guide',
    h1: 'Pergolas, Pavilions and Shade Structures in Charlotte, NC',
    title: 'Pergolas and Shade Structures Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Pergolas, pavilions, and louvered shade structures for Charlotte, NC pools and patios. Materials, footings, louvered roofs, and how to build shade that survives Carolina sun and storms. Serving the Charlotte metro and North Carolina.',
    lede: 'Shade is what makes a Carolina backyard usable from June to September. A well-built pergola or pavilion anchors the outdoor living space and extends the hours you actually spend outside.',
    intro: 'A pergola is more than a decoration. It defines the outdoor room, carries lighting and fans, and turns a hot patio into a place you want to sit at 3pm in July. The difference between a structure that lasts and one that sags is in the footings, the materials, and how it is engineered for Carolina sun, wind, and afternoon storms. Here is how we build shade that holds up.',
    sections: [
      ['Pergola vs pavilion vs louvered roof',
        '<p>A pergola is an open-rafter structure that filters light and carries vines, fans, and lighting. A pavilion has a solid roof and gives true rain protection, which turns it into a year-round outdoor room. A louvered, adjustable roof is the premium option: pivoting slats let you dial in sun or shade and close tight when a Carolina storm rolls through. Which one is right depends on how you want to use the space and how much weather protection you need.</p>'],
      ['Materials and footings that survive the climate',
        '<p>Cedar and other timbers look beautiful but need maintenance. Powder-coated aluminum and engineered composites give the clean lines with far less upkeep and no rot. Whatever the material, the structure is only as sound as its footings. We set posts on engineered footings below frost depth and anchor them to handle wind load, because a shade structure that is not properly footed becomes a hazard in the first big storm.</p>'],
      ['Built into the outdoor living plan',
        '<p>A pergola should not look like it landed in the yard. We design shade structures as part of the overall outdoor living plan so proportions, materials, and rooflines relate to the home and the pool. Integrated lighting, ceiling fans, heaters, and even outdoor kitchens are planned into the structure from the start, with the wiring and gas runs roughed in before anything is finished.</p>'],
    ],
    features: [
      ['Open Pergolas', 'Architectural rafter structures that filter light and carry fans, heaters, and lighting over a patio or pool deck.'],
      ['Solid-Roof Pavilions', 'True rain protection that turns a patio into a year-round outdoor room.'],
      ['Louvered Roof Systems', 'Adjustable slats that dial in sun or shade and close tight against Carolina storms.'],
      ['Engineered Footings', 'Posts set on footings below frost depth and anchored for wind load, so the structure stays sound.'],
      ['Low-Maintenance Materials', 'Powder-coated aluminum and composites that give clean lines without rot or constant upkeep.'],
      ['Integrated Utilities', 'Lighting, fans, heaters, and gas roughed in during construction, not surface-mounted later.'],
    ],
    faqs: [
      ['Do I need a permit for a pergola in Charlotte?', 'Often yes, especially for attached structures, solid roofs, or anything with electrical or gas. We handle permitting in our name and build to code so the structure passes inspection and is safe.'],
      ['What is the best material for a pergola in North Carolina?', 'Powder-coated aluminum and engineered composites hold up best with the least maintenance in the Carolina climate. Cedar and timber look great but need ongoing sealing and care.'],
      ['What is the difference between a pergola and a pavilion?', 'A pergola has an open rafter roof that filters light. A pavilion has a solid roof for full rain protection. A louvered roof gives you both, with slats you can open or close.'],
      ['Can you add a pergola with an outdoor kitchen or fans?', 'Yes. We design shade structures with lighting, fans, heaters, and outdoor kitchens planned in, and rough the wiring and gas before finishing so nothing is bolted on afterward.'],
    ],
    related: ['outdoor-kitchens', 'pool-houses-and-cabanas', 'pool-landscaping'],
  },
  {
    slug: 'outdoor-kitchens',
    nav: 'Outdoor Kitchens',
    eyebrow: 'Authority Guide',
    h1: 'Outdoor Kitchens and Built-In Grills in Charlotte, NC',
    title: 'Outdoor Kitchens Charlotte NC: Design and Build Guide | Cirilo Design + Build',
    metaDesc: 'How to design an outdoor kitchen that works in Charlotte, NC: layout, weatherproof cabinetry, appliances, gas, water, and power, and the build mistakes that ruin them. Designed alongside your pool and patio. Serving the Charlotte metro and North Carolina.',
    lede: 'An outdoor kitchen is where the backyard actually gets used. Build it right and you cook, host, and live outside. Build it wrong and it becomes an expensive grill surround that rusts.',
    intro: 'A real outdoor kitchen is a small building project: it needs gas, water, power, drainage, and weatherproof materials that survive Carolina humidity and sun. The brands matter, but the layout and the rough-ins matter more. This guide covers how we design outdoor kitchens that earn their footprint, designed alongside the pool and shade structure so the whole space works as one.',
    sections: [
      ['Layout: the working triangle, outdoors',
        '<p>The same logic that makes an indoor kitchen work applies outside. The grill, the prep counter, and the cold storage should form an efficient triangle, with enough landing space on each side of the grill to actually cook. We plan the layout around how you entertain: a bar-height counter that seats guests, a prep zone that keeps the cook in the conversation, and traffic flow that does not cross the pool deck. Get the layout right and the appliances are easy.</p>'],
      ['Appliances, gas, water, and power',
        '<p>Built-in grills, side burners, refrigeration, ice makers, and ventilation all need to be rated for outdoor use and sized for how you cook. More importantly, they need the right rough-ins: a properly sized gas line, GFCI-protected power, a water supply and drain for the sink, and ventilation where a grill sits under a roof. We design and permit these utilities up front, because retrofitting gas and water into a finished kitchen is painful and expensive.</p>'],
      ['Weatherproof materials for the Carolina climate',
        '<p>Outdoor cabinetry is where corners get cut and where failures show up first. We specify marine-grade or stainless cabinetry, stone or porcelain countertops, and finishes that handle humidity, UV, and temperature swings without warping, rusting, or fading. The counters are sloped subtly to shed water, and everything is built to be hosed down and left in the weather, because that is exactly what an outdoor kitchen has to survive.</p>'],
    ],
    features: [
      ['Entertaining-First Layout', 'Grill, prep, and cold storage arranged for real cooking, with seating that keeps the cook in the conversation.'],
      ['Built-In Grills and Burners', 'Outdoor-rated grills, side burners, and ventilation sized to how you actually cook.'],
      ['Refrigeration and Ice', 'Outdoor refrigerators, ice makers, and beverage centers so nobody has to run inside.'],
      ['Proper Rough-Ins', 'Correctly sized gas, GFCI power, water, and drainage designed and permitted before the build.'],
      ['Weatherproof Cabinetry', 'Marine-grade or stainless cabinetry and stone counters built to live outdoors in the Carolina climate.'],
      ['Designed With the Pool', 'Planned alongside the pool and shade structure so sight lines, traffic, and materials all line up.'],
    ],
    faqs: [
      ['How much does an outdoor kitchen cost in Charlotte?', 'It ranges widely with size and appliances, from a focused grill-and-counter setup to a full kitchen with refrigeration, sink, and bar seating. We give you a clear budget range at the consultation based on how you cook and entertain.'],
      ['Do outdoor kitchens need gas and water lines?', 'For a full kitchen, yes. A built-in grill usually wants a dedicated gas line, and a sink needs water and drainage. We design and permit these rough-ins up front so they are not an expensive retrofit later.'],
      ['What materials hold up best outdoors in North Carolina?', 'Stainless and marine-grade cabinetry with stone or porcelain counters handle Carolina humidity, sun, and temperature swings best. Ordinary indoor-grade materials warp, rust, and fade quickly outdoors.'],
      ['Can you build the outdoor kitchen under a pergola or pavilion?', 'Yes, and it is a great pairing. When a grill sits under a roof we plan the ventilation and clearances correctly so it is safe and comfortable to cook in any weather.'],
    ],
    related: ['pergolas-and-shade-structures', 'pool-landscaping', 'pool-houses-and-cabanas'],
  },
  {
    slug: 'hot-tubs-and-spas',
    nav: 'Hot Tubs & Spas',
    eyebrow: 'Authority Guide',
    h1: 'Hot Tubs, Spas and Jacuzzis in Charlotte, NC',
    title: 'Hot Tubs, Spas and Jacuzzis Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Integrated gunite spas vs portable hot tubs in Charlotte, NC. Spillover spas, hydrotherapy, heaters, automation, and the pad, power, and placement a hot tub really needs. Designed into your pool or built standalone. Serving the Charlotte metro and NC.',
    lede: 'A spa is the most-used part of most backyards, because it works year-round. The question is whether to build it into the pool as a gunite spillover spa or set a portable hot tub, and the right answer depends on how you want to live.',
    intro: 'In the Charlotte climate a spa earns its keep across all four seasons. The decision is integrated versus portable. An integrated gunite spa is engineered as part of the pool, spills into it, and shares the design language. A portable hot tub is faster and movable but always reads as a separate appliance. This guide covers both, plus the pad, power, and placement details people skip and regret.',
    sections: [
      ['Integrated gunite spas vs portable hot tubs',
        '<p>An integrated spa is built from the same steel and gunite as the pool, finished in the same materials, and designed to spill over into the pool as a water feature. It looks like it was always part of the design, because it was. A portable hot tub is a self-contained unit you set on a pad. It costs less up front and can move if you do, but it never disappears into the design the way a built-in spa does. For a luxury build, the integrated spillover spa is almost always the right call.</p>'],
      ['Hydrotherapy, heaters, and automation',
        '<p>The experience comes down to the jets, the heat, and the controls. We design seating and jet placement around hydrotherapy, not just looks, and size the heater so the spa is ready when you want it, not an hour later. Automation ties the spa into the same app that runs the pool, so you can heat it from your phone on the drive home. Pentair, Jandy, and Hayward equipment give reliable, serviceable control over temperature, jets, and lighting.</p>'],
      ['The pad, power, and placement people forget',
        '<p>A portable hot tub is heavy when full, so it needs a proper engineered pad, not a wood deck that was not built for the load. It needs a dedicated, GFCI-protected circuit run by a licensed electrician. And placement matters: close enough to the house for cold-weather use, private from neighbors, and positioned so the view from inside the tub is the pool or the garden, not the trash cans. We plan all of this so the spa is safe, comfortable, and actually used.</p>'],
    ],
    features: [
      ['Spillover Gunite Spas', 'Built into the pool from the same shell and finishes, spilling over as a water feature.'],
      ['Hydrotherapy Jet Design', 'Seating and jets placed for real therapy, not just appearance.'],
      ['Right-Sized Heaters', 'Heating sized so the spa is ready when you are, across all four Carolina seasons.'],
      ['Smart Automation', 'Heat and control the spa from the same app that runs the pool, including from your phone.'],
      ['Engineered Pads and Power', 'Proper load-rated pads and dedicated GFCI circuits for portable hot tubs, installed to code.'],
      ['Considered Placement', 'Positioned for privacy, cold-weather access, and the best view from inside the spa.'],
    ],
    faqs: [
      ['Is an integrated spa better than a portable hot tub?', 'For a luxury build, usually yes. An integrated gunite spa shares the pool design, spills over as a water feature, and looks built-in because it is. A portable hot tub costs less and can move, but always reads as a separate appliance.'],
      ['Can you add a spa to an existing pool?', 'In many cases yes, depending on the pool, the equipment pad, and the space. We assess the existing build and tell you honestly what is possible and what it involves.'],
      ['What does a hot tub need for installation?', 'A portable hot tub needs a load-rated pad, a dedicated GFCI-protected circuit installed by a licensed electrician, and smart placement for privacy and access. A built-in spa is engineered and permitted as part of the pool.'],
      ['Do spas work year-round in North Carolina?', 'Yes, that is the point. A properly heated spa is comfortable through Carolina winters, which is why it often ends up the most-used part of the backyard.'],
    ],
    related: ['concrete-pool-construction', '3d-pool-design', 'pool-houses-and-cabanas'],
  },
  {
    slug: 'pool-houses-and-cabanas',
    nav: 'Pool Houses',
    eyebrow: 'Authority Guide',
    h1: 'Pool Houses, Cabanas and Casitas in Charlotte, NC',
    title: 'Pool Houses and Cabanas Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Pool houses, cabanas, and casitas for Charlotte, NC backyards: changing rooms, full baths, kitchenettes, guest suites, and pool-equipment integration. Permitted, engineered, and matched to your home. Serving the Charlotte metro and North Carolina.',
    lede: 'A pool house is what turns a backyard into a retreat you never have to leave. From a simple cabana with a changing room to a full guest casita, it is the structure that keeps wet feet, guests, and gear out of the main house.',
    intro: 'The most practical luxury in a backyard is a place to change, use a bathroom, grab a drink, and store the pool gear without tracking through the house. A pool house can be as simple as a covered cabana or as complete as a casita with a full bath, kitchenette, and guest suite. Either way it is a permitted building, and it should look like it belongs to the home. Here is how we approach it.',
    sections: [
      ['From cabana to full casita',
        '<p>The right structure depends on how you live. A cabana gives shade, seating, and a changing area, ideal for keeping the party outside. Add a half bath and a beverage station and it becomes the backyard hub. A full casita goes further: a complete bathroom, a kitchenette, climate control, and a guest suite that doubles as a home office or in-law space. We scope it to your needs and your lot, because an oversized pool house wastes yard and budget, and an undersized one gets outgrown fast.</p>'],
      ['Baths, kitchenettes, and equipment integration',
        '<p>Plumbing is what separates a shed from a pool house. A pool bath that opens to the deck keeps wet feet out of the home. A kitchenette or bar keeps food and drinks outside. And the pool house is the natural place to conceal the pool equipment pad, with proper ventilation and access, so the pumps and heaters are hidden and quiet instead of sitting in view along the side yard. We plan all of this together so the structure works as hard as it looks.</p>'],
      ['Permitted, engineered, and architecturally matched',
        '<p>A pool house with plumbing and power is a real building that needs permits, engineering, and inspections, and it ties into your existing utilities. Just as important, it should match the home. We carry the rooflines, materials, and proportions of the house into the pool house so it reads as original architecture, not a kit dropped in the corner of the yard. That match is what makes a backyard feel designed instead of assembled.</p>'],
    ],
    features: [
      ['Cabanas and Changing Rooms', 'Shade, seating, and a place to change that keeps the party outside and the house dry.'],
      ['Pool Baths', 'A full or half bath opening to the deck so wet feet never come through the main house.'],
      ['Kitchenettes and Bars', 'Beverage stations and kitchenettes that keep food, drinks, and guests in the backyard.'],
      ['Guest Casitas', 'Climate-controlled suites that double as guest space, home office, or in-law quarters.'],
      ['Hidden Equipment Pad', 'The pool equipment concealed with proper ventilation and access, out of sight and quieter.'],
      ['Architecturally Matched', 'Rooflines, materials, and proportions carried from the home so the structure looks original.'],
    ],
    faqs: [
      ['Does a pool house need a permit in Charlotte?', 'Yes. Any structure with plumbing, electrical, or HVAC is a permitted building. We handle permitting, engineering, and inspections and tie into your existing utilities correctly.'],
      ['What is the difference between a cabana and a casita?', 'A cabana is an open or semi-open shade structure with seating and often a changing area. A casita is a fully enclosed, climate-controlled building, frequently with a bathroom, kitchenette, and guest suite.'],
      ['Can the pool house hide the pool equipment?', 'Yes, and it is a smart use of the structure. We can build in a ventilated, accessible equipment room so the pumps and heaters are concealed and quieter instead of sitting in the side yard.'],
      ['Will the pool house match my home?', 'That is the goal. We carry your home rooflines, materials, and proportions into the design so the pool house reads as original architecture, not an add-on.'],
    ],
    related: ['backyard-structures', 'pergolas-and-shade-structures', 'outdoor-kitchens'],
  },
  {
    slug: 'backyard-structures',
    nav: 'Backyard Structures',
    eyebrow: 'Authority Guide',
    h1: 'Chicken Coops, Sheds and Backyard Structures in Charlotte, NC',
    title: 'Custom Chicken Coops and Backyard Structures Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Custom chicken coops, sheds, she-sheds, studios, and outdoor dwellings for Charlotte, NC properties. Predator-proof coops, permitted structures, and buildings matched to your home and landscape. Serving the Charlotte metro and North Carolina.',
    lede: 'Backyards are getting more ambitious. Beyond the pool, homeowners want chicken coops, garden sheds, studios, and outdoor dwellings that are built well and look intentional, not like a big-box kit in the corner of the yard.',
    intro: 'The same design-build discipline that produces a great pool produces a great backyard structure. Whether it is a predator-proof chicken coop, a finished she-shed or studio, a garden and storage shed, or a small outdoor dwelling, the difference is in the foundation, the materials, and whether it was designed to match the property. This guide covers the outdoor structures Charlotte homeowners are asking for and how to build them right.',
    sections: [
      ['Custom chicken coops that actually hold up',
        '<p>Backyard chickens are popular across the Charlotte metro, and a good coop is more than a box with a roof. It needs to be predator-proof, with hardware cloth instead of flimsy chicken wire, a secure latching system, and a buried or aproned perimeter so nothing digs in. It needs ventilation without drafts, easy-clean surfaces, accessible nesting boxes, and a run sized for the flock. We build coops that are genuinely functional for the birds and attractive enough that you are happy to see them from the house, matched to the home and landscape.</p>'],
      ['Sheds, she-sheds, and studios',
        '<p>A shed can be pure storage or a finished room. A garden and storage shed keeps tools, mowers, and pool gear organized and dry on a proper foundation. A she-shed, studio, or home office goes further with insulation, power, lighting, and finishes that make it a real, year-round space. The build details that matter are the same as any structure: a foundation that does not shift, framing and roofing that shed Carolina weather, and proportions and materials that relate to the main home.</p>'],
      ['Permitting, placement, and matching the property',
        '<p>Small does not mean unregulated. Setbacks, size limits, electrical, and sometimes HOA approval apply to backyard structures, and the rules vary across Mecklenburg and Union counties. We confirm what your property and HOA allow, handle permitting where it is required, and place the structure so it works with the yard, the pool, and the sight lines from the house. Then we match the materials and rooflines to the home so it looks like part of a plan, because it is.</p>'],
    ],
    features: [
      ['Predator-Proof Coops', 'Hardware cloth, secure latches, and dig-proof perimeters that actually keep a flock safe.'],
      ['Functional Coop Design', 'Proper ventilation, easy-clean surfaces, accessible nesting boxes, and a right-sized run.'],
      ['Garden and Storage Sheds', 'Organized, dry storage for tools, mowers, and pool gear on a foundation that does not shift.'],
      ['She-Sheds and Studios', 'Insulated, powered, finished outbuildings that work as year-round studios or offices.'],
      ['Permitting and Setbacks', 'We confirm county and HOA rules and permit the structure where it is required.'],
      ['Matched to the Property', 'Materials and rooflines tied to the home so the structure looks designed, not dropped in.'],
    ],
    faqs: [
      ['Can you build a custom chicken coop in the Charlotte area?', 'Yes. We build predator-proof, functional, good-looking coops matched to your home and landscape, with hardware cloth, secure latching, dig-proof perimeters, proper ventilation, and accessible nesting boxes.'],
      ['Do backyard structures need permits in North Carolina?', 'It depends on size, use, and whether they have electrical or plumbing, and rules differ across counties and HOAs. We confirm what your property allows and handle permitting where it is required.'],
      ['Can a shed be finished as a studio or office?', 'Yes. With insulation, power, lighting, and proper finishes, an outbuilding becomes a year-round studio, home office, or she-shed rather than just storage.'],
      ['Will the structure match my house and pool area?', 'That is how we design. We match materials, rooflines, and proportions to your home so coops, sheds, and outbuildings look like an intentional part of the property.'],
    ],
    related: ['pool-houses-and-cabanas', 'pergolas-and-shade-structures', 'pool-landscaping'],
  },
  {
    slug: 'vanishing-edge-pools',
    nav: 'Vanishing-Edge Pools',
    eyebrow: 'Authority Guide',
    h1: 'Vanishing-Edge and Infinity Pools in Charlotte, NC',
    title: 'Vanishing-Edge and Infinity Pools Charlotte NC | Cirilo Design + Build',
    metaDesc: 'How vanishing-edge (infinity) pools actually work, why they need a sloped lot, and what they cost to engineer in Charlotte, NC. The catch basin, weir wall, and surge tank explained. Serving the Charlotte metro and North Carolina.',
    lede: 'The disappearing edge is the single most dramatic feature in luxury pool design. It is also the least forgiving to build. Done right it turns a view into the centerpiece of the home. Done wrong it floods, stains, and never looks level.',
    intro: 'A vanishing edge, also called an infinity edge or negative edge, makes the water look like it spills into the horizon. The illusion depends on a precisely level weir wall, a hidden catch basin, and a surge system sized to keep up. None of that is decorative. It is hydraulic engineering, and it is where this feature separates real pool builders from the rest. Here is how it works and what it takes in a Charlotte backyard.',
    sections: [
      ['How the disappearing edge actually works',
        '<p>Water flows over a razor-level wall called the weir, falls into a hidden catch basin below, and is pumped back into the pool in a continuous loop. The edge looks endless because the catch basin sits out of sight. The whole effect lives or dies on one thing: the weir wall must be level to a tiny tolerance. A wall that is off by even a fraction reads as crooked water, which is the one mistake you can never hide. We build the weir with that tolerance as the priority, not an afterthought.</p>'],
      ['Why it needs the right lot',
        '<p>Vanishing edges look best where the land falls away: sloped lots, ridgelines, and properties with a view to borrow. That is also where they make engineering sense, because the catch basin and the drop need room below the edge. On a flat lot a true vanishing edge is possible but harder to justify, and a perimeter-overflow or slot edge is often the smarter luxury move. We assess the grade and the view at the consultation and tell you honestly which edge detail fits the property.</p>'],
      ['Engineering, surge, and cost',
        '<p>The catch basin has to hold the surge: every gallon that is on the wall, plus what sloshes over when people get in. Undersize it and the basin runs dry and the pump sucks air. We size the basin and the surge capacity to the pool, spec a dedicated edge pump, and engineer the structure for the extra water load. A vanishing edge adds meaningfully to the budget because it is a second hydraulic system, but it is the feature that defines a hillside luxury build.</p>'],
      ],
    features: [
      ['Razor-Level Weir Wall', 'The edge built to a tight tolerance, because crooked water is the one flaw you cannot disguise.'],
      ['Hidden Catch Basin', 'A concealed lower basin sized to hold the full surge so the effect runs continuously and quietly.'],
      ['Dedicated Edge Pump', 'A separate, correctly sized pump and plumbing loop that keeps the wall flowing without starving the main system.'],
      ['Surge and Auto-Fill', 'Surge capacity and automated water leveling engineered so the edge performs through use and evaporation.'],
      ['Slope and View Analysis', 'We assess grade and sight lines to confirm the lot suits a true vanishing edge before you commit.'],
      ['Engineered Structure', 'The shell and edge engineered for the extra water load, permitted and inspected like any structural element.'],
    ],
    faqs: [
      ['How much more does a vanishing-edge pool cost?', 'A vanishing edge adds a second hydraulic system: a catch basin, a dedicated pump, extra plumbing, and more structural work. It is a meaningful premium over a standard pool. We give you a clear range at the consultation once we see the lot.'],
      ['Do I need a sloped lot for an infinity pool?', 'A true vanishing edge works best on a sloped lot or one with a view to borrow, because the catch basin needs room below the edge. On flat lots a perimeter-overflow or slot edge often gives a similar luxury effect.'],
      ['Why do some infinity edges look crooked?', 'Almost always a weir wall that is not perfectly level. The edge must be built to a very tight tolerance. Getting that right is the entire craft of the feature, and it is what we prioritize.'],
      ['Are vanishing-edge pools loud?', 'Properly engineered, the water sound is a gentle, pleasant feature. Noise problems come from an undersized basin or a poorly tuned edge pump, which correct sizing prevents.'],
    ],
    related: ['concrete-pool-construction', '3d-pool-design', 'water-features-and-tanning-ledges'],
  },
  {
    slug: 'plunge-pools',
    nav: 'Plunge Pools',
    eyebrow: 'Authority Guide',
    h1: 'Plunge Pools and Spools in Charlotte, NC',
    title: 'Plunge Pools and Spools Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Plunge pools and spools for small Charlotte, NC backyards: compact luxury, cold plunge and heated options, cost, and how they fit lots a full pool cannot. Designed and built in concrete. Serving the Charlotte metro and North Carolina.',
    lede: 'Not every backyard has room for a full pool, and not everyone wants one. A plunge pool delivers the luxury, the water, and the design impact in a fraction of the footprint, and it is one of the smartest uses of a small lot.',
    intro: 'A plunge pool is a compact pool built for cooling off, relaxing, and looking beautiful rather than swimming laps. A spool blends a spa and a pool into one small vessel you can heat for a soak or run cool in summer. Both are perfect for tight Charlotte lots, courtyards, and modern homes where a full pool would overwhelm the space. Built in concrete, they carry the same finishes and features as a large pool, just scaled to fit.',
    sections: [
      ['Plunge pool vs spool vs cold plunge',
        '<p>A plunge pool is a small pool, typically deeper than it is long, designed to stand in, cool off, and relax. A spool is a hybrid: a small vessel with spa jets and a heater that doubles as a cool pool in summer and a warm soak in winter. A dedicated cold plunge takes it further with a chiller for recovery and wellness routines. We help you pick based on how you want to use the water and what your lot allows.</p>'],
      ['Why they fit small Charlotte lots',
        '<p>Plunge pools and spools shine exactly where full pools do not fit: narrow side yards, courtyards, sloped lots, and modern infill homes. Because the footprint is small, more of the budget goes into finishes, edges, and features, so a compact pool can feel more luxurious per square foot than a large one. They also leave room for outdoor living, plantings, and a structure, instead of swallowing the whole yard.</p>'],
      ['Heating, chilling, and year-round use',
        '<p>The compact size is an advantage for temperature control. A small body of water heats fast and cheap, so a heated plunge or spool is genuinely usable through Carolina winters. Add a chiller and the same vessel becomes a true cold plunge in summer. With smart automation you set it from your phone, which makes a plunge pool one of the most-used features in the backyard relative to its size.</p>'],
      ],
    features: [
      ['Compact Concrete Build', 'Engineered gunite construction and premium finishes, scaled to fit small lots and courtyards.'],
      ['Spool Option', 'A spa-and-pool hybrid with jets and a heater for a warm soak or a cool dip from one vessel.'],
      ['Cold Plunge Ready', 'Add a chiller for recovery and wellness routines alongside the relaxation.'],
      ['Fast, Affordable Heating', 'A small volume heats quickly and cheaply, so it stays usable across all four seasons.'],
      ['Big-Pool Features', 'Tanning ledges, jets, LED lighting, and water features, just scaled to the space.'],
      ['Room Left Over', 'A small footprint leaves space for outdoor living, plantings, and structures.'],
    ],
    faqs: [
      ['How much does a plunge pool cost in Charlotte?', 'Plunge pools cost less than a full pool because of the smaller footprint, though premium finishes and features narrow the gap. We give you a clear budget range at the consultation based on size, finish, and equipment.'],
      ['What is the difference between a plunge pool and a spool?', 'A plunge pool is a small pool for cooling off and relaxing. A spool is a hybrid with spa jets and a heater, so it works as a warm soak or a cool pool from a single small vessel.'],
      ['Can a plunge pool be heated for winter?', 'Yes, and it is one of the advantages. A small volume heats quickly and inexpensively, so a heated plunge or spool is comfortable through Carolina winters.'],
      ['Do plunge pools work on small or sloped lots?', 'They are ideal for them. Narrow side yards, courtyards, and sloped lots that cannot fit a full pool are exactly where plunge pools and spools make the most sense.'],
    ],
    related: ['hot-tubs-and-spas', 'concrete-pool-construction', 'pool-landscaping'],
  },
  {
    slug: 'fire-features',
    nav: 'Fire Features',
    eyebrow: 'Authority Guide',
    h1: 'Fire Pits, Fireplaces and Fire Features in Charlotte, NC',
    title: 'Fire Pits and Outdoor Fireplaces Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Fire pits, outdoor fireplaces, and fire-and-water features for Charlotte, NC backyards. Gas vs wood, placement, gas lines, and how fire extends the Carolina season. Designed with your pool and patio. Serving the Charlotte metro and North Carolina.',
    lede: 'Fire is what keeps a Carolina backyard alive after the sun goes down and into the shoulder seasons. The right fire feature anchors the gathering space and gives the whole design a focal point.',
    intro: 'A fire feature does two jobs: it extends the months you use the backyard, and it gives people a place to gather around. The choice between a fire pit, a built-in fireplace, and a fire-and-water combination comes down to how you entertain and how the feature relates to the pool and seating. As with everything outdoors, the gas line, placement, and materials are what make it safe and lasting.',
    sections: [
      ['Fire pit vs fireplace vs fire-and-water',
        '<p>A fire pit is social and open: people sit around it, and it works on a patio or by the pool. A built-in outdoor fireplace is architectural, throws heat in one direction, and anchors a seating area or an outdoor room, often under a pavilion. Fire-and-water features, like fire bowls that spill into the pool, are the showpiece option that ties the two elements together. Many luxury backyards use more than one, a pit for gathering and a fireplace or bowls for drama.</p>'],
      ['Gas vs wood, and the lines that feed them',
        '<p>Natural gas and propane give instant, clean, controllable flame with no hauling, ash, or smoke, which is why most luxury features run on gas. Wood-burning has its appeal for a true fireplace but means storage, cleanup, and smoke considerations. Gas features need a correctly sized line and a safe ignition system, designed and permitted up front. Running gas to a feature after the patio is finished is expensive, so we plan it into the build from the start.</p>'],
      ['Placement, materials, and the season',
        '<p>Placement is a safety and comfort decision: enough clearance from structures and seating, downwind of the main gathering area, and positioned so the fire and the pool both read from the key sight lines. Materials are specified to take direct heat without cracking or discoloring. Done well, a fire feature pushes the usable backyard season from a few summer months into spring and fall evenings, which is where a lot of the real enjoyment happens.</p>'],
      ],
    features: [
      ['Gathering Fire Pits', 'Open, social fire pits sized for seating, built for the patio or the pool deck.'],
      ['Outdoor Fireplaces', 'Architectural built-in fireplaces that anchor a seating area or outdoor room.'],
      ['Fire-and-Water Features', 'Fire bowls and spillover details that tie the fire and the pool together as one showpiece.'],
      ['Gas or Wood', 'Clean, instant gas or a true wood-burning hearth, designed for how you want to use it.'],
      ['Proper Gas and Ignition', 'Correctly sized gas lines and safe ignition, designed and permitted before the patio goes in.'],
      ['Heat-Rated Materials', 'Surfaces specified to take direct flame without cracking, staining, or discoloring.'],
    ],
    faqs: [
      ['Do I need a permit and a gas line for a fire feature?', 'A gas fire feature needs a correctly sized gas line and a safe ignition system, and usually a permit. We design and permit the gas up front, because adding it after the patio is finished is costly.'],
      ['Is gas or wood better for an outdoor fireplace?', 'Most luxury features use gas for instant, clean, controllable flame with no ash or smoke. Wood has appeal for a true fireplace but means storage, cleanup, and smoke to manage.'],
      ['Can you build a fire feature into the pool?', 'Yes. Fire bowls and fire-and-water details that spill into the pool are a striking way to connect the two elements, and we design them together so it looks intentional.'],
      ['Will a fire feature really extend the season?', 'Yes. A good fire feature makes spring and fall evenings comfortable, pushing the usable backyard well beyond the summer months in the Carolina climate.'],
    ],
    related: ['outdoor-kitchens', 'pergolas-and-shade-structures', 'water-features-and-tanning-ledges'],
  },
  {
    slug: 'pool-automation',
    nav: 'Pool Automation',
    eyebrow: 'Authority Guide',
    h1: 'Smart Pool Automation and LED Lighting in Charlotte, NC',
    title: 'Smart Pool Automation and LED Lighting Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Run your pool from your phone. Smart pool automation, color LED lighting, variable-speed pumps, and energy savings for Charlotte, NC pools. Pentair, Jandy, and Hayward systems. Serving the Charlotte metro and North Carolina.',
    lede: 'A modern luxury pool runs from your phone. Automation turns a pool from a chore into a tap: set the temperature, the lights, the spa, and the water features from anywhere, and let the system handle the rest.',
    intro: 'Pool automation ties the pumps, heater, lights, spa, and water features into one app-controlled system. Beyond convenience, the real wins are energy savings from variable-speed pumps and consistent water chemistry from automated equipment. We design the automation in from the start, because retrofitting a smart system onto a pool that was not wired for it is a compromise. Here is what a well-automated pool looks like.',
    sections: [
      ['One app for the whole backyard',
        '<p>The control system, from Pentair, Jandy, or Hayward, lets you run the pool and spa from your phone: heat the spa on the drive home, schedule the lights, turn on the water features for guests, and adjust the pump without touching the equipment pad. Everything lives in one app, and the same system can fold in landscape lighting and other backyard equipment. The result is a pool you actually use more, because using it is effortless.</p>'],
      ['Color LED lighting, day and night',
        '<p>Color-changing LED transforms the pool after dark and uses a fraction of the energy of old lighting. We design lighting schemes, in-pool LEDs, water-feature lighting, and low-voltage landscape lighting, so the backyard has a deliberate nighttime look, not just a single floodlight. Scenes can be saved and recalled, so one tap sets the mood for a quiet evening or a party.</p>'],
      ['Variable-speed pumps and real energy savings',
        '<p>The pump is the biggest energy user in most pools. A variable-speed pump runs slow and quiet most of the time and only ramps up when needed, which can cut pump energy use dramatically compared to old single-speed pumps. Paired with automated scheduling and efficient heating, a smart pool is meaningfully cheaper to run. We spec the equipment for efficiency and serviceability, not just the lowest install price.</p>'],
      ],
    features: [
      ['App Control', 'Run pumps, heater, spa, lights, and water features from your phone, from anywhere.'],
      ['Color LED Schemes', 'In-pool and landscape LED lighting designed as one nighttime scene, with saved presets.'],
      ['Variable-Speed Pumps', 'Quiet, efficient pumps that cut energy use compared to old single-speed equipment.'],
      ['Spa-From-Your-Phone', 'Heat the spa on the way home so it is ready when you arrive.'],
      ['Automated Chemistry Ready', 'Equipment set up for consistent, low-effort water care.'],
      ['Trusted Equipment', 'Pentair, Jandy, and Hayward systems chosen for reliability and serviceability.'],
    ],
    faqs: [
      ['Can I control my pool from my phone?', 'Yes. A modern automation system from Pentair, Jandy, or Hayward lets you control the pump, heater, spa, lights, and water features from an app, including heating the spa before you get home.'],
      ['Does pool automation save money?', 'It can. Variable-speed pumps and automated scheduling cut energy use significantly compared to old single-speed equipment, and consistent automated operation reduces waste and wear.'],
      ['Can automation be added to an existing pool?', 'Often yes, depending on the existing equipment and wiring. It is cleaner and more capable when designed in from the start, but many pools can be upgraded. We assess what is possible.'],
      ['What lighting options are there?', 'Color-changing LED for the pool, plus water-feature and low-voltage landscape lighting, designed as one scheme with saved scenes you can recall with a tap.'],
    ],
    related: ['concrete-pool-construction', 'water-features-and-tanning-ledges', 'pool-renovation-and-resurfacing'],
  },
  {
    slug: 'saltwater-vs-chlorine',
    nav: 'Saltwater vs Chlorine',
    eyebrow: 'Authority Guide',
    h1: 'Saltwater vs Chlorine Pools in Charlotte, NC',
    title: 'Saltwater vs Chlorine Pools Charlotte NC: Which Is Better? | Cirilo Design + Build',
    metaDesc: 'Saltwater vs chlorine pools compared for Charlotte, NC: feel, maintenance, cost, and equipment. How a salt system actually makes chlorine, and which is right for your build. Serving the Charlotte metro and North Carolina.',
    lede: 'It is the most common question we get: saltwater or chlorine? The honest answer is that a saltwater pool is a chlorine pool. The difference is how the chlorine gets made, and that changes the feel, the upkeep, and the cost in ways worth understanding.',
    intro: 'A saltwater pool does not mean no chlorine. A salt chlorine generator converts dissolved salt into chlorine automatically, so you are not handling chlorine tablets or liquid. The water is gentler, the maintenance is steadier, and the upfront equipment costs more. A traditional chlorine pool costs less to install and gives you direct control. Neither is wrong. Here is how to choose for a Carolina build.',
    sections: [
      ['How a saltwater system actually works',
        '<p>You add salt to the water, and a salt cell uses electrolysis to turn it into chlorine on demand, then the chlorine reverts to salt and the cycle repeats. So the pool is still sanitized by chlorine, you just are not buying and dosing it by hand. The water feels softer and less harsh on skin, eyes, and swimwear, which is the main reason people love saltwater pools. The salt level is far lower than seawater, closer to a soft tear than the ocean.</p>'],
      ['Maintenance, feel, and equipment life',
        '<p>Saltwater pools deliver chlorine steadily, so the water chemistry tends to stay more stable with less daily attention, though they are not maintenance-free. The trade-off is the salt cell, which is a wear part that gets replaced every several years, and salt can be tougher on some metals, stone, and equipment if the build does not account for it. We spec compatible materials and equipment so a saltwater pool stays gentle on the pool, not just the swimmers.</p>'],
      ['Cost and which one to choose',
        '<p>A saltwater system costs more up front for the generator and cell, and has the periodic cell replacement, but saves on the ongoing purchase of chlorine. A traditional chlorine pool is cheaper to install and gives you direct, immediate control over sanitizer levels. For a luxury build where comfort and low-effort upkeep matter, most of our clients choose saltwater. For a tighter budget or specific water needs, chlorine still makes sense. We help you weigh it against your build and your priorities.</p>'],
      ],
    features: [
      ['Salt Chlorine Generation', 'A salt cell that makes chlorine automatically, so you are not handling tablets or liquid.'],
      ['Softer Water Feel', 'Gentler on skin, eyes, and swimwear, the top reason owners prefer saltwater.'],
      ['Steadier Chemistry', 'Chlorine delivered consistently for more stable water with less daily fuss.'],
      ['Compatible Materials', 'Finishes, stone, and equipment specified to handle salt so the pool stays protected.'],
      ['Chlorine Option', 'Traditional chlorine for a lower install cost and direct sanitizer control.'],
      ['Honest Guidance', 'We match the system to your budget, priorities, and how you will use the pool.'],
    ],
    faqs: [
      ['Is a saltwater pool chlorine-free?', 'No. A saltwater pool still uses chlorine, but a salt cell makes it automatically from dissolved salt, so you are not handling chlorine by hand. The water just feels softer and gentler.'],
      ['Is saltwater or chlorine cheaper?', 'Chlorine pools cost less to install. Saltwater systems cost more up front and have a salt cell to replace periodically, but save on buying chlorine over time.'],
      ['Does saltwater damage the pool?', 'It can be harder on some metals, stone, and equipment if the build does not plan for it. We spec salt-compatible materials and equipment so a saltwater pool stays protected.'],
      ['Which should I choose for my Charlotte pool?', 'Most luxury clients choose saltwater for the softer feel and steadier upkeep. Chlorine makes sense on a tighter budget or for specific needs. We help you decide based on your build.'],
    ],
    related: ['pool-automation', 'concrete-pool-construction', 'pool-renovation-and-resurfacing'],
  },
  {
    slug: 'pool-renovation-and-resurfacing',
    nav: 'Pool Renovation',
    eyebrow: 'Authority Guide',
    h1: 'Pool Renovation and Resurfacing in Charlotte, NC',
    title: 'Pool Renovation and Resurfacing Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Renovate or resurface an aging pool in Charlotte, NC: replastering, new tile and coping, equipment upgrades, and full remodels. The signs it is time and what it costs. Serving the Charlotte metro and North Carolina.',
    lede: 'An aging pool does not have to be replaced to feel new. The right renovation, fresh interior finish, new tile and coping, modern equipment, brings a tired pool back to life and updates the whole backyard around it.',
    intro: 'Concrete pools are built to last decades, but the surface finish, tile, and equipment are wear items that eventually show their age. A renovation can be as focused as a replaster or as complete as a full redesign with new edges, decking, and automation. Knowing what actually needs work, and what is just cosmetic, is where a design-build team saves you money. Here is how we approach bringing an older Charlotte pool back to life.',
    sections: [
      ['The signs it is time to renovate',
        '<p>Rough or stained plaster, chipping or falling tile, cracked coping, rising water bills from a leak, and old, loud, inefficient equipment are the usual signals. Surface stains and roughness mean the interior finish is near the end of its life. Equipment that predates variable-speed pumps and automation is costing you money every month it runs. We assess the shell, the surface, the tile and coping, and the equipment separately, so you fix what needs fixing and do not pay for what does not.</p>'],
      ['Resurfacing, tile, coping, and decking',
        '<p>Resurfacing replaces the interior finish, the single biggest change to how a pool looks and feels, with modern quartz, pebble, or glass-tile surfaces. New waterline tile and coping sharpen the edges and update the style. Refinishing or replacing the decking ties it all together. Done together, these turn a dated pool into one that looks current without touching the structural shell, which is usually still sound.</p>'],
      ['Equipment, automation, and full remodels',
        '<p>A renovation is the ideal time to upgrade to a variable-speed pump, a modern heater, LED lighting, a salt system, and app-based automation, cutting running costs and adding convenience. For a bigger transformation, we can redesign the pool itself: add a tanning ledge, a spa, a vanishing edge, or new water features, and rework the surrounding outdoor living. We scope the renovation to your goals and budget, from a straightforward resurface to a complete backyard reinvention.</p>'],
      ],
    features: [
      ['Interior Resurfacing', 'New quartz, pebble, or glass-tile finishes that transform how the pool looks and feels.'],
      ['New Tile and Coping', 'Fresh waterline tile and coping to sharpen the edges and update the style.'],
      ['Decking Refresh', 'Refinished or replaced decking to tie the renovated pool into the whole backyard.'],
      ['Equipment Upgrades', 'Variable-speed pumps, modern heaters, and LED lighting that cut running costs.'],
      ['Add Modern Features', 'Tanning ledges, spas, vanishing edges, and water features added to an existing pool.'],
      ['Smart Automation', 'App-based control and salt systems retrofitted during the renovation.'],
    ],
    faqs: [
      ['How often does a concrete pool need resurfacing?', 'Interior finishes typically last many years before they roughen or stain and need replacing. Quartz and pebble finishes last longer than basic plaster. We assess the surface and tell you honestly where it stands.'],
      ['Can you add a spa or tanning ledge to an existing pool?', 'In many cases yes. A renovation is a great time to add a spa, a tanning ledge, a vanishing edge, or water features, depending on the existing pool and space. We assess what is feasible.'],
      ['How much does a pool renovation cost in Charlotte?', 'It ranges from a focused resurface to a full redesign with new features and equipment. We scope it to your goals and give a clear range after assessing the pool.'],
      ['Is it cheaper to renovate or replace a pool?', 'Renovating is almost always far less than replacing, because the structural shell is usually still sound. Most aging pools need surface, tile, and equipment work, not a new shell.'],
    ],
    related: ['concrete-pool-construction', 'pool-automation', 'saltwater-vs-chlorine'],
  },
  {
    slug: 'water-features-and-tanning-ledges',
    nav: 'Water Features',
    eyebrow: 'Authority Guide',
    h1: 'Tanning Ledges and Water Features in Charlotte, NC',
    title: 'Tanning Ledges and Pool Water Features Charlotte NC | Cirilo Design + Build',
    metaDesc: 'Tanning ledges, bubblers, deck jets, sheer descents, scuppers, and grottos for Charlotte, NC pools. The features that turn a pool into a resort, and how they are built in. Serving the Charlotte metro and North Carolina.',
    lede: 'The features are what separate a pool from a resort. A tanning ledge, the right water effects, and considered detailing turn a rectangle of water into a place you never want to leave.',
    intro: 'Water features are the jewelry of a pool: the tanning ledge you lounge on, the bubblers and deck jets that delight kids and catch the light, the sheer descents and scuppers that add sound and movement. The key is that they are engineered into the shell, not added on, so they perform and last. Here are the features our Charlotte clients ask for and how they come together.',
    sections: [
      ['Tanning ledges and Baja shelves',
        '<p>A tanning ledge, also called a Baja shelf or sun shelf, is a shallow shelf at the pool entry, usually a few inches deep, for loungers, umbrellas, and small children. It is the single most requested feature in modern luxury pools, because it is where adults relax and kids play safely. We build it into the shell at the right depth and width, often with bubblers and an umbrella sleeve, so it is a destination, not an afterthought.</p>'],
      ['Bubblers, deck jets, and laminar flows',
        '<p>Bubblers sit on the tanning ledge and push a gentle column of water up, which is mesmerizing for kids and beautiful when lit at night. Deck jets and laminar flows arc clean ropes of water into the pool from the deck, adding movement and sound without clutter. Lit with LED, they become a nighttime show. These are plumbed and wired during the build, so they need to be planned in from the design stage.</p>'],
      ['Sheer descents, scuppers, and grottos',
        '<p>Sheer descents pour a wide, smooth sheet of water from a raised wall, and scuppers send water through spouts from a raised spa or bond beam, both adding the sound of moving water that makes a backyard feel like a retreat. Grottos, rock features, and spillover spas push the resort feel further. Every one of these is a structural and plumbing decision made early, which is exactly why designing all the features together, in 3D, pays off.</p>'],
      ],
    features: [
      ['Tanning Ledges', 'Shallow sun shelves for loungers, umbrellas, and small children, built into the shell at the right depth.'],
      ['Bubblers', 'Gentle water columns on the ledge that delight kids and glow at night.'],
      ['Deck Jets and Laminars', 'Clean arcs of water from the deck that add movement and sound without clutter.'],
      ['Sheer Descents', 'Wide, smooth sheets of water from a raised wall for a dramatic, soothing effect.'],
      ['Scuppers and Spillovers', 'Spouts and spa spillovers that bring the sound of moving water to the backyard.'],
      ['Grottos and Rock Features', 'Resort-style features designed and engineered into the pool, not bolted on.'],
    ],
    faqs: [
      ['What is a tanning ledge?', 'A tanning ledge, also called a Baja or sun shelf, is a shallow shelf at the pool entry, usually a few inches deep, for loungers, umbrellas, and small children. It is the most requested feature in modern luxury pools.'],
      ['Can water features be added to an existing pool?', 'Some can during a renovation, but most water features are plumbed and wired into the shell, so they are best designed in from the start. We tell you what is feasible to add later.'],
      ['Do water features use a lot of energy?', 'Modern variable-speed pumps and efficient design keep water features economical, and they can run on schedules and automation so they are only on when you want them.'],
      ['Are tanning ledges safe for small children?', 'Yes, that is part of their appeal. The shallow depth lets small children play within reach, while adults relax on the same shelf. We build them to the right depth and width for both.'],
    ],
    related: ['concrete-pool-construction', '3d-pool-design', 'pool-automation'],
  },
];

const BY_SLUG = Object.fromEntries(TOPICS.map(t => [t.slug, t]));

// ── Spoke page template ─────────────────────────────────────────────
function renderTopic(s) {
  const url = `${SITE}/guides/${s.slug}`;
  const clean = str => String(str).replace(/&amp;/g, '&');
  const faqSchema = {
    "@context": "https://schema.org", "@type": "FAQPage",
    "mainEntity": s.faqs.map(([q, a]) => ({ "@type": "Question", "name": clean(q), "acceptedAnswer": { "@type": "Answer", "text": clean(a) } }))
  };
  const articleSchema = {
    "@context": "https://schema.org", "@type": "Article",
    "headline": clean(s.h1),
    "about": clean(s.nav),
    "description": clean(s.metaDesc),
    "author": { "@type": "Organization", "name": "Cirilo Design + Build" },
    "publisher": { "@type": "Organization", "name": "Cirilo Design + Build", "@id": SITE + "/#org" },
    "areaServed": { "@type": "State", "name": "North Carolina" },
    "mainEntityOfPage": url
  };
  const crumbSchema = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": "Guides", "item": SITE + "/guides/" },
      { "@type": "ListItem", "position": 3, "name": clean(s.nav), "item": url }
    ]
  };
  const related = (s.related || []).map(r => BY_SLUG[r]).filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${s.title}</title>
<meta name="description" content="${s.metaDesc}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${s.title}">
<meta property="og:description" content="${s.metaDesc}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
<script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
<script type="application/ld+json">${JSON.stringify(crumbSchema)}</script>
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
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/guides/">Guides</a> <span>/</span> <span>${s.nav}</span></nav>
      <div class="eyebrow mb-sm">${s.eyebrow}</div>
      <h1 style="font-size:var(--fs-hero);max-width:18ch;margin-bottom:var(--space-md);">${s.h1}</h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.82);max-width:640px;margin-bottom:var(--space-lg);">${s.lede}</p>
      <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;">
        <a href="/book" class="btn btn-primary">Book a Design Consultation</a>
        <a href="/portfolio" class="btn btn-ghost">See the Work</a>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container-narrow">
      <p style="font-size:1.15rem;line-height:1.8;color:var(--body);">${s.intro}</p>
    </div>
  </section>

  ${s.sections.map(([h2, body], i) => `<section class="section" style="${i % 2 === 1 ? 'background:var(--gold-pale);' : 'padding-top:0;'}">
    <div class="container-narrow">
      <h2 style="margin-bottom:var(--space-md);">${h2}</h2>
      ${body}
    </div>
  </section>`).join('\n  ')}

  <section class="section">
    <div class="container">
      <div class="text-center" style="max-width:640px;margin:0 auto var(--space-xl);">
        <div class="eyebrow mb-sm">What We Do</div>
        <h2>The details that matter.</h2>
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
    <div class="container-narrow text-center">
      <div class="eyebrow mb-sm">Charlotte and North Carolina</div>
      <h2 style="margin-bottom:var(--space-md);">Built for Carolina backyards.</h2>
      <p style="font-size:1.08rem;line-height:1.8;color:var(--body);">We design and build across the Charlotte metro and the surrounding North Carolina communities, from SouthPark, Myers Park, and Eastover to Ballantyne, Waxhaw, Weddington, and Lake Norman. Every project is permitted and engineered for local soil, code, and climate, with one accountable team from design to final walkthrough. <a href="/service-areas/">See our service areas</a>.</p>
    </div>
  </section>

  <section class="section">
    <div class="container-narrow">
      <div class="text-center" style="margin-bottom:var(--space-xl);">
        <div class="eyebrow mb-sm">Common Questions</div>
        <h2>${s.nav} FAQ</h2>
      </div>
      ${s.faqs.map(([q, a]) => `<details class="faq-item">
        <summary>${q}</summary>
        <p>${a}</p>
      </details>`).join('\n      ')}
    </div>
  </section>

  ${related.length ? `<section class="section" style="padding-top:0;">
    <div class="container">
      <div class="text-center" style="max-width:640px;margin:0 auto var(--space-xl);">
        <div class="eyebrow mb-sm">Keep Reading</div>
        <h2>Related guides.</h2>
      </div>
      <div class="grid grid-3">
        ${related.map(r => `<a href="/guides/${r.slug}" class="card" style="border-top:3px solid var(--gold-dark);text-decoration:none;display:block;">
          <h3 style="font-size:1.2rem;color:var(--ink);margin-bottom:var(--space-sm);">${r.nav}</h3>
          <p style="font-size:0.95rem;color:var(--body);margin:0;">${r.lede.split('.')[0]}.</p>
        </a>`).join('\n        ')}
      </div>
    </div>
  </section>` : ''}

  <section class="section" style="padding-top:0;">
    <div class="container">
      <div class="cta-block">
        <div>
          <div class="eyebrow mb-sm" style="color:var(--gold-mid);">Start Here</div>
          <h2 style="color:var(--white);margin-bottom:var(--space-sm);">Book a Design Consultation</h2>
          <p style="color:rgba(255,255,255,0.78);margin:0;max-width:520px;">60 minutes on-site. We walk your property, talk through what is possible, and leave you with a clear sense of design and budget. No obligation.</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-sm);">
          <a href="/book" class="btn btn-primary">Book Consultation</a>
          <a href="tel:+19104090648" class="btn btn-ghost">Call (910) 409-0648</a>
        </div>
      </div>
    </div>
  </section>

</main>

<!--#include file="_footer.html" -->

${SHARED_STYLE}

</body>
</html>
`;
}

// ── Hub page template (/guides/) ────────────────────────────────────
function renderHub() {
  const url = `${SITE}/guides/`;
  const itemList = {
    "@context": "https://schema.org", "@type": "ItemList",
    "itemListElement": TOPICS.map((t, i) => ({ "@type": "ListItem", "position": i + 1, "name": String(t.nav), "url": `${SITE}/guides/${t.slug}` }))
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Outdoor Living Guides: Pools, Outdoor Kitchens and More | Cirilo Design + Build</title>
<meta name="description" content="In-depth guides to designing and building luxury outdoor spaces in Charlotte, NC: concrete pools, 3D design, pool landscaping, pergolas, outdoor kitchens, hot tubs, pool houses, and custom backyard structures. Serving the Charlotte metro and North Carolina.">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="Outdoor Living Guides | Cirilo Design + Build">
<meta property="og:description" content="In-depth guides to designing and building luxury outdoor spaces in Charlotte, NC.">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(itemList)}</script>
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
      <div class="eyebrow mb-sm">Resource Library</div>
      <h1 style="font-size:var(--fs-hero);max-width:16ch;margin-bottom:var(--space-md);">Outdoor Living Guides</h1>
      <p style="font-size:1.2rem;color:rgba(255,255,255,0.82);max-width:640px;margin-bottom:var(--space-lg);">Straight answers on designing and building luxury outdoor spaces in Charlotte and across North Carolina. How it is engineered, what it costs, and what separates work that lasts from work that does not.</p>
      <a href="/book" class="btn btn-primary">Book a Design Consultation</a>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="grid grid-3">
        ${TOPICS.map(t => `<a href="/guides/${t.slug}" class="card" style="border-top:3px solid var(--gold-dark);text-decoration:none;display:block;">
          <div class="eyebrow mb-sm" style="color:var(--gold-dark);">${t.nav}</div>
          <h3 style="font-size:1.3rem;color:var(--ink);margin-bottom:var(--space-sm);">${t.h1.replace(' in Charlotte, NC', '')}</h3>
          <p style="font-size:0.95rem;color:var(--body);margin:0;">${t.lede.split('.')[0]}.</p>
        </a>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0;">
    <div class="container">
      <div class="cta-block">
        <div>
          <div class="eyebrow mb-sm" style="color:var(--gold-mid);">Start Here</div>
          <h2 style="color:var(--white);margin-bottom:var(--space-sm);">Ready to design your backyard?</h2>
          <p style="color:rgba(255,255,255,0.78);margin:0;max-width:520px;">One accountable design-build team for pools, outdoor living, and every structure around them. Book a consultation and we will walk your property together.</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-sm);">
          <a href="/book" class="btn btn-primary">Book Consultation</a>
          <a href="tel:+19104090648" class="btn btn-ghost">Call (910) 409-0648</a>
        </div>
      </div>
    </div>
  </section>

</main>

<!--#include file="_footer.html" -->

${SHARED_STYLE}

</body>
</html>
`;
}

// ── Shared inline styles (crumbs + faq + cta), matches service pages ─
const SHARED_STYLE = `<style>
  .crumbs { font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-bottom: var(--space-md); }
  .crumbs a { color: rgba(255,255,255,0.75); border-bottom: none; }
  .crumbs a:hover { color: var(--gold-mid); }
  .crumbs span { margin: 0 0.4rem; }
  .cta-block { background: var(--navy); color: var(--white); padding: var(--space-xl); border-radius: var(--radius-lg); display: grid; grid-template-columns: 1.4fr auto; gap: var(--space-xl); align-items: center; position: relative; overflow: hidden; }
  .cta-block::before { content:''; position:absolute; inset:0; background: radial-gradient(circle at 100% 50%, rgba(171,126,55,0.18) 0%, transparent 60%); pointer-events:none; }
  .cta-block > * { position: relative; z-index: 1; }
  @media (max-width: 860px) { .cta-block { grid-template-columns: 1fr; } }
  .faq-item { border-bottom: 1px solid var(--border); padding: var(--space-md) 0; }
  .faq-item summary { font-family: var(--font-display); font-size: 1.2rem; color: var(--ink); cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  .faq-item summary::after { content: '+'; color: var(--gold-dark); font-size: 1.5rem; font-weight: 300; }
  .faq-item[open] summary::after { content: '\\2212'; }
  .faq-item p { margin: var(--space-sm) 0 0; color: var(--body); font-size: 0.98rem; }
  a.card:hover { box-shadow: var(--shadow-lg, 0 12px 32px rgba(14,27,42,0.12)); transform: translateY(-2px); transition: all .2s ease; }
</style>`;

// ── Write all pages ─────────────────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true });
let count = 0;
fs.writeFileSync(path.join(OUT, 'index.html'), renderHub());
console.log('✓ guides/index.html (hub)');
count++;
for (const t of TOPICS) {
  fs.writeFileSync(path.join(OUT, t.slug + '.html'), renderTopic(t));
  console.log('✓ guides/' + t.slug + '.html');
  count++;
}
console.log(`\n${count} authority pages written to pages/guides/`);
