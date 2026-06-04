// gen-partners.js - partner program pages from the Partnership/PR playbook.
//  Public pillar pages: /partners/ hub + /partners/<pillar>/ (indexed)
//  Per-firm outreach pages: /partners/<pillar>/<firm>/ (noindex,follow)
//  Public press page: /press/
// Run: node scripts/gen-partners.js
const fs = require('fs');
const path = require('path');
const { SITE, page, hub } = require('./_geo-lib.js');

const PAGES = path.join(__dirname, '..', 'pages');
const slugify = s => s.toLowerCase().replace(/&/g, 'and').replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function offerHtml(items) {
  return '<ul style="list-style:none;padding:0;margin:var(--space-md) 0;">' + items.map(function (it) {
    return '<li style="padding:0.7rem 0 0.7rem 1.7rem;border-bottom:1px solid var(--border);position:relative;line-height:1.7;"><span style="position:absolute;left:0;top:0.7rem;color:var(--gold-dark);font-weight:700;">+</span>' + it + '</li>';
  }).join('') + '</ul>';
}

const BIZ = { "@type":"LocalBusiness", "name":"Cirilo Design + Build", "@id": SITE+"/#business" };

const PILLARS = [
  {
    slug: 'real-estate-agents', nav: 'Real Estate Agents',
    h1: 'A Backyard Tool That Helps You Close',
    heroSub: 'A referral partnership built for luxury listing agents. We give you a free 3D backyard rendering to win the listing or the offer, and a referral when your client builds.',
    bodyH2: 'What Cirilo offers agents.',
    intro: 'When a buyer walks a listing and the backyard is "almost there," they discount or they pass. We help you turn that soft spot into a selling point, with a tool you can use before listing, during negotiation, or as a closing gift.',
    offer: [
      '<strong>A free 3D pre-listing rendering</strong> (a $1,500 value). We render the backyard a property could have, so you can anchor the price, answer the objection, or gift it to the buyer at closing.',
      '<strong>A 2.5% referral</strong> on any signed contract, paid 50% at deposit and 50% at substantial completion.',
      '<strong>A co-branded showing one-pager</strong> with your name on it: "Backyard transformation by Cirilo Design + Build."',
      '<strong>48-hour priority site walks</strong> when a contingency or repair credit is on the table.',
      '<strong>An annual partner appreciation evening</strong> at a finished Cirilo project, you and a guest.',
    ],
    closing: 'No catch, and no cost to you. We never contact your client unless you introduce us, and the relationship always stays yours.',
    faqs: [
      ['What does it cost to partner?', 'Nothing. The 3D rendering is free and there is no fee to join. You earn a 2.5% referral when a client you introduce signs a build.'],
      ['Will you go around me to my client?', 'Never. We do not contact your buyer or seller unless you introduce us, and the relationship stays yours start to finish.'],
      ['How fast can I get a rendering?', 'About five business days from the time you send us the listing address and a few backyard photos.'],
    ],
    targets: [
      ['Dickens Mitchener & Associates', 'Charlotte intown: Myers Park, Eastover, and SouthPark', 'Your intown listings are exactly the homes where the backyard makes or breaks the sale.'],
      ['Cottingham Chalk', 'Charlotte luxury', 'Your agent-led, repeat-client model is the kind of relationship a backyard tool is built to support.'],
      ['Allen Tate Luxury Collection', 'Mecklenburg, Union, and Iredell', 'Your reach across the metro means more listings where a pool can lift the sale price.'],
      ['Premier Sotheby\'s International Realty', 'Lake Norman waterfront', 'Waterfront buyers expect a backyard that lives up to the view, and we engineer for exactly that.'],
      ['Ivester Jackson Distinctive Properties', 'Lake Norman and Charlotte luxury', 'Your distinctive-property roster pairs naturally with vanishing-edge and resort-style builds.'],
      ['Helen Adams Realty', 'Charlotte luxury, Myers Park and Dilworth', 'Your top producers list the kind of homes where the backyard is the last objection.'],
      ['Compass Charlotte', 'Citywide luxury', 'Your team is tech-forward, and a free 3D rendering is an easy tool to put in every agent\'s hands.'],
      ['Corcoran HM Properties', 'SouthPark and Lake Norman', 'A growing luxury brand and a referral partner who makes your listings show better.'],
      ['Costello Real Estate & Investments', 'Charlotte luxury', 'A founder-led, fast-moving firm, and a partner who turns renderings around just as fast.'],
      ['Carolina Realty Advisors', 'Waxhaw, Weddington, and Marvin', 'You own the south Mecklenburg and north Union luxury suburb, where lots are made for ambitious pools.'],
    ],
  },
  {
    slug: 'home-builders', nav: 'Custom Home Builders',
    h1: 'A Pool Sub That Hits Your Schedule',
    heroSub: 'The pool conversation usually happens too late on a custom build. We fix that with a turnkey pool spec at framing, parallel permitting, and a referral on every signed contract.',
    bodyH2: 'What Cirilo offers builders.',
    intro: 'On most custom builds the pool becomes a close-out scramble: the house is 60 days from closing and the homeowner suddenly wants a vanishing edge and a covered kitchen. We built our builder program so that never happens on your projects.',
    offer: [
      '<strong>Pool spec\'d at framing.</strong> We join your preconstruction meeting and hand you a turnkey pool spec within 7 days, ready to drop into your schedule.',
      '<strong>Coordinated permitting.</strong> We run HOA and county pool permits in parallel with your house permit. One project, one timeline.',
      '<strong>A 3% referral</strong> on signed contracts.',
      '<strong>Co-branded finished-project photography</strong> that we pay for. Both brands get the shots.',
      '<strong>First look.</strong> Your clients see Cirilo before any other pool sub bids.',
    ],
    closing: 'You stay in control of the build. We handle the pool so the homeowner hands you a backyard they love at close-out, not a surprise.',
    faqs: [
      ['How does the pool stay on my schedule?', 'We spec at framing and run permitting in parallel with your house permit, so the pool slots into your existing construction sequence instead of derailing it.'],
      ['Who manages the homeowner?', 'You do. We work as your pool partner and keep the client relationship yours unless you ask us to take point on the pool scope.'],
      ['What is the referral?', 'A 3% referral on signed contracts, plus co-branded photography we pay for.'],
    ],
    targets: [
      ['Arthur Rutenberg Homes', '$1M to $5M custom across Charlotte', 'Your custom homeowners expect a backyard on par with the house, and we deliver it on your schedule.'],
      ['Bonterra Builders', 'South Charlotte and Lake Norman', 'Your high-touch, repeat-client builds deserve a pool sub who protects the relationship.'],
      ['Plattner Custom Builders', 'Waxhaw, Weddington, and Marvin', 'You own the Union County custom map, where nearly every estate wants a pool.'],
      ['Grandfather Homes', 'Lake Norman and Mountain Island Lake', 'Waterfront builds and vanishing-edge pools are made for each other.'],
      ['Simonini Builders', 'SouthPark, Myers Park, and Eastover', 'Intown estates expect an integrated backyard. We spec it before it becomes a close-out scramble.'],
      ['Andrew Roby General Contractors', 'Charlotte luxury renovations', 'Your high-end renovations frequently open up outdoor scope. We make the pool the easy part.'],
      ['Augusta Homes', 'Waxhaw and Marvin', 'Your volume of custom homes is a steady pipeline for a turnkey pool spec.'],
      ['Pinnacle Custom Builders', 'Lake Norman waterfront', 'Lake Norman waterfront custom is our sweet spot for engineering and design.'],
    ],
  },
  {
    slug: 'landscape-architects', nav: 'Landscape Architects & Designers',
    h1: 'Spec the Pool. Keep Design Control.',
    heroSub: 'A partnership for landscape architects and designers who want the pool engineered right without giving up the vision. You design it. We make it buildable.',
    bodyH2: 'What Cirilo offers designers.',
    intro: 'Too many pool builders fight the design. We do the opposite: we put our engineering behind your vision, validate the hard parts early, and let you stay the author of the project.',
    offer: [
      '<strong>A 3% referral</strong>, and you keep design control from concept to completion.',
      '<strong>Engineering on call.</strong> Our pool engineers validate or refine your spec before you present to the client.',
      '<strong>Joint client presentations.</strong> Our design lead joins your pitch whenever a pool is in scope.',
      '<strong>Quarterly trade education</strong> at our studio: new finishes, equipment, automation, and code changes, CEU-eligible where possible.',
    ],
    closing: 'The result is a pool that belongs to your master plan, not one bolted on after the fact.',
    faqs: [
      ['Do I keep design control?', 'Yes. You remain the designer of record. We provide the engineering and construction so your vision gets built faithfully.'],
      ['Can you validate a spec before I present it?', 'That is exactly what engineering on call is for. Send us the concept and we will confirm what is buildable and flag anything before the client meeting.'],
      ['Is there trade education?', 'Yes, quarterly sessions at our studio on finishes, equipment, automation, and code, CEU-eligible where possible.'],
    ],
    targets: [
      ['CR Studio Landscape Architects', 'estate and commercial work', 'Spec a Cirilo pool into the master plan and keep full design control.'],
      ['Pursley Dixon Architecture', 'modernist custom residential', 'Modern estates treat the pool as integral, and so do we.'],
      ['Meyer Greeson Paullin Benson', 'luxury residential', 'Your estate work routinely calls for a pool. We make the engineering invisible.'],
      ['LandDesign', 'estate and master-planned', 'A Charlotte-headquartered firm and a pool partner who can scale with you.'],
      ['Charlotte Landscape Group', 'luxury residential in Myers Park and SouthPark', 'Your intown work is exactly where a beautifully engineered pool belongs.'],
      ['New Leaf Landscape Architecture', 'modern residential', 'Your contemporary sensibility pairs with our clean, modern pool design.'],
    ],
  },
  {
    slug: 'country-clubs', nav: 'Country & Yacht Clubs',
    h1: 'Member Benefits, Done With Taste',
    heroSub: 'Quiet, member-first activations for the clubs whose members are building backyards. Always member-introduced, never a hard sell.',
    bodyH2: 'What Cirilo offers clubs and members.',
    intro: 'Your members talk to each other, and the best backyard work spreads by word of mouth. We support that with member benefits and elegant activations, introduced by a member, never cold-pitched.',
    offer: [
      '<strong>Member-only pricing:</strong> a 3% benefit your club can promote to members.',
      '<strong>Member-guest and tournament sponsorships</strong>, tasteful and on-brand.',
      '<strong>Club magazine features</strong> pairing a member install case study with a clean brand placement.',
      '<strong>Private "Backyard at Dusk" evenings</strong> hosted at a recently finished member install, members and spouses.',
    ],
    closing: 'Every activation begins with a member introduction. If a member would vouch for us, we would be honored to talk.',
    faqs: [
      ['How does a partnership start?', 'With a member introduction. We do not cold-pitch clubs. If a member knows our work and would introduce us, that is the right first step.'],
      ['What is the member benefit?', 'A 3% pricing benefit your club can promote, plus member-only events and case studies featuring real member installs.'],
      ['What does an event look like?', 'A private "Backyard at Dusk" evening at a finished member install, cocktails and a reveal for members and spouses.'],
    ],
    targets: [
      ['Carmel Country Club', 'Charlotte (Carmel area)', 'A member introduction opens the door to tasteful member-guest and club-magazine activations.'],
      ['Charlotte Country Club', 'Myers Park', 'Charlotte\'s oldest club, member-introduced only. We would be honored to co-host a private evening at a member install.'],
      ['Quail Hollow Club', 'Charlotte', 'Ultra-private and worth the patience, member-introduced only.'],
      ['The Peninsula Club', 'Lake Norman, Cornelius', 'Lake Norman\'s luxury club, where pool buyers concentrate.'],
      ['Cowans Ford Country Club', 'Stanley, Lake Norman west', 'A welcoming entry point to the Lake Norman west-shore membership.'],
      ['Ballantyne Country Club', 'Ballantyne', 'South Charlotte\'s premium club and a natural fit for member benefits.'],
      ['Trump National Charlotte', 'Mooresville, Lake Norman', 'A Lake Norman luxury membership base, member-introduced.'],
      ['Lake Norman Yacht Club', 'Mooresville', 'Sailing members are waterfront homeowners, and waterfront homeowners are pool buyers.'],
    ],
  },
  {
    slug: 'luxury-brands', nav: 'Luxury Brand Co-Marketing',
    h1: 'Co-Marketing for Shared Clients',
    heroSub: 'If your clients are building luxury homes and outdoor lives, we share an audience. Let\'s co-market to it.',
    bodyH2: 'What Cirilo offers brand partners.',
    intro: 'Outdoor kitchens, furniture, automation, and waterfront living all overlap with what we build. Co-marketing puts both brands in front of the same affluent client at the moment they are spending.',
    offer: [
      '<strong>Co-marketed events</strong> at your showroom or a finished Cirilo install.',
      '<strong>Cross-referral</strong> for shared clients, both directions.',
      '<strong>Co-branded content:</strong> indoor and outdoor kitchens, smart home and smart pool, your dock and your pool.',
      '<strong>Shared photography</strong> from joint projects, both brands get the shots.',
    ],
    closing: 'One audience, two brands, twice the reach. Let\'s find the right activation.',
    faqs: [
      ['What does co-marketing involve?', 'Joint events, cross-referral for shared clients, and co-branded content and photography. We tailor the activation to your brand.'],
      ['Who is the right fit?', 'Brands serving affluent homeowners building or upgrading luxury homes: appliances, outdoor furnishings, automation, marine, and luxury auto.'],
      ['How do we start?', 'A short call to find one activation worth piloting, then we build from there.'],
    ],
    targets: [
      ['Queen City Audio Video & Appliance', 'Sub-Zero and Wolf dealer', 'Outdoor kitchens are our scope and your pipeline, a natural co-marketed event.'],
      ['Restoration Hardware Outdoor', 'SouthPark', 'Your outdoor-furniture buyer is our pool-deck buyer. Co-branded reveals work beautifully.'],
      ['Pursuit Boats and MarineMax', 'Lake Norman', 'Waterfront boaters are waterfront pool buyers. Let\'s co-host a Lake Norman luxury-living event.'],
      ['Smart Home of the Carolinas', 'Crestron and Control4', 'Pool automation cross-sells smart home. A bundled smart-home-and-smart-pool package is an easy win.'],
      ['Mercedes-Benz of South Charlotte', 'luxury auto', 'A matching demographic and a natural private viewing event at a finished install.'],
      ['The Inn at Pinehurst', 'concierge channel', 'Your concierge can hand relocating executives a luxury Charlotte vendor they trust.'],
    ],
  },
];

const pillarBySlug = {};
PILLARS.forEach(p => pillarBySlug[p.slug] = p);

function pillarRelated(current) {
  const links = PILLARS.filter(p => p.slug !== current.slug).map(p => ({ href: `/partners/${p.slug}`, name: p.nav }));
  if (current.slug === 'real-estate-agents') links.unshift({ href: '/partners/rendering-request', name: 'Free 3D Rendering' });
  links.push({ href: '/press', name: 'Press & Media' });
  links.push({ href: '/partners/', name: 'All Partner Programs' });
  return links;
}

function renderPillar(p) {
  const isRE = p.slug === 'real-estate-agents';
  const ctaHref = isRE ? '/partners/rendering-request' : '/partners/apply';
  const ctaLabel = isRE ? 'Request a Free Rendering' : 'Become a Partner';
  const service = { "@context":"https://schema.org","@type":"Service","serviceType":`Pool builder partner program for ${p.nav}`,"provider": BIZ,"areaServed":{"@type":"State","name":"North Carolina"},"url":`${SITE}/partners/${p.slug}` };
  const faqSchema = { "@context":"https://schema.org","@type":"FAQPage","mainEntity": p.faqs.map(([q,a])=>({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}})) };
  return page({
    title: `${p.nav} Partner Program | Cirilo Design + Build`,
    desc: `${p.heroSub}`,
    canonicalPath: `/partners/${p.slug}`,
    eyebrow: 'Partner Program',
    h1: p.h1,
    heroSub: p.heroSub,
    ctaLabel: ctaLabel,
    ctaHref: ctaHref,
    bodyEyebrow: 'The Offer',
    bodyH2: p.bodyH2,
    bodyParas: [p.intro, offerHtml(p.offer), p.closing],
    showServiceCards: false,
    faqEyebrow: 'Partner FAQ',
    faqH2: 'Partner questions, answered.',
    faqs: p.faqs,
    relatedTitle: 'More Ways to Partner',
    related: pillarRelated(p),
    ctaEyebrow: 'Partner With Cirilo',
    ctaH2: isRE ? 'Send us a listing. We will render it.' : 'Let\'s build a referral relationship.',
    ctaSub: isRE ? 'Free 3D rendering, about five business days. We come to you.' : 'Tell us about your business and we will set up a 20-minute call.',
    ctaBtn: ctaLabel,
    trackPage: 'partner',
    trackExtra: { area: p.slug },
    jsonld: [service, faqSchema],
  });
}

function renderTarget(p, t) {
  const [name, territory, note] = t;
  const tslug = slugify(name);
  const related = p.targets.filter(x => x[0] !== name).slice(0, 8).map(x => ({ href: `/partners/${p.slug}/${slugify(x[0])}`, name: x[0] }));
  related.unshift({ href: `/partners/${p.slug}`, name: `${p.nav} Program` });
  return page({
    noindex: true,
    title: `Cirilo Design + Build x ${name} | Referral Partnership`,
    desc: `A referral partnership proposal for ${name}. ${note}`,
    canonicalPath: `/partners/${p.slug}/${tslug}`,
    eyebrow: 'A Partnership Proposal',
    h1: `Cirilo Design + Build and ${name}`,
    heroSub: `${note} Here is what a partnership with Cirilo Design + Build could look like for ${name}${territory ? `, working across ${territory}` : ''}.`,
    ctaLabel: 'Start the Conversation',
    bodyEyebrow: 'What You Get',
    bodyH2: `Built for ${name}.`,
    bodyParas: [`${p.intro}`, offerHtml(p.offer), p.closing],
    showServiceCards: false,
    faqEyebrow: 'Partner FAQ',
    faqH2: 'Partner questions, answered.',
    faqs: p.faqs,
    relatedTitle: `More ${p.nav}`,
    related,
    ctaEyebrow: 'Let\'s Talk',
    ctaH2: `Let's build something with ${name}.`,
    ctaSub: 'A 20-minute call is all it takes to get started.',
    ctaBtn: 'Start the Conversation',
    ctaHref: '/partners/apply',
    trackPage: 'partner-target',
    trackExtra: { area: tslug },
    jsonld: [],
  });
}

function renderHub() {
  const cards = PILLARS.map(p => `<a href="/partners/${p.slug}" class="card card-link"><h3 style="font-size:1.4rem;color:var(--ink);margin-bottom:0.35rem;">${p.nav}</h3><p style="font-size:0.92rem;color:var(--muted);margin:0;">${p.h1}</p></a>`).join('\n        ');
  const body = `<div class="text-center" style="max-width:640px;margin:0 auto var(--space-xl);">
        <div class="eyebrow mb-sm">Six Ways to Grow Together</div>
        <h2>Partner programs.</h2>
        <p class="text-muted" style="margin-top:var(--space-sm);">The referral channel no Charlotte pool builder runs systematically. Choose the program that fits your business.</p>
      </div>
      <div class="grid grid-3">
        ${cards}
        <a href="/press" class="card card-link"><h3 style="font-size:1.4rem;color:var(--ink);margin-bottom:0.35rem;">Press &amp; Media</h3><p style="font-size:0.92rem;color:var(--muted);margin:0;">Press kit, founder story, and media contact.</p></a>
      </div>`;
  const itemList = { "@context":"https://schema.org","@type":"ItemList","itemListElement": PILLARS.map((p,i)=>({"@type":"ListItem","position":i+1,"name":p.nav,"url":`${SITE}/partners/${p.slug}`})) };
  return hub({
    title: `Partner With Cirilo Design + Build | Referral & Co-Marketing Programs`,
    desc: `Referral and co-marketing partnerships for luxury real estate agents, custom home builders, landscape architects, country clubs, and luxury brands in Charlotte and across North Carolina.`,
    canonicalPath: `/partners/`,
    eyebrow: 'Partner Program',
    h1: 'Partner With Cirilo',
    intro: 'Real estate agents, builders, designers, clubs, and luxury brands: when your clients build a backyard with us, everyone wins. Explore the programs below.',
    body,
    trackPage: 'partners-hub',
    jsonld: [itemList],
  });
}

function renderPress() {
  const facts = [
    '<strong>Based in Charlotte, NC,</strong> serving the entire metro and across North Carolina.',
    '<strong>Founded by Ramon and Tiffany Cirilo,</strong> a husband-and-wife team. Ramon leads design and build; Tiffany leads the client experience.',
    '<strong>What we build:</strong> custom concrete (gunite) pools, spas, and full outdoor living, design-build under one roof.',
    '<strong>Project range:</strong> roughly $85,000 for a starter custom pool to $400,000-plus for an integrated infinity-edge backyard.',
    '<strong>Media assets:</strong> high-resolution project photography and interviews available on request, with rights granted for features.',
    '<strong>Press contact:</strong> (910) 409-0648, via our <a href="/contact">contact page</a>.',
  ];
  const angles = [
    '<strong>The economics.</strong> What a luxury pool actually costs in Charlotte, transparent tiers and line items in a notoriously opaque industry.',
    '<strong>The local builder.</strong> A husband-and-wife, design-first family business competing with national franchises.',
    '<strong>The trends.</strong> Wellness pools and cold plunges, vanishing edges on Lake Norman, and minimalist modern design for new-money buyers.',
    '<strong>The case study.</strong> A single signature install, profiled in detail across architecture, engineering, finishes, and photography.',
    '<strong>The expert.</strong> Informed commentary for any home, garden, or real estate story that touches outdoor living.',
  ];
  const faqs = [
    ['Where is Cirilo Design + Build based?', 'Charlotte, North Carolina. We serve the entire Charlotte metro and take signature projects across the state.'],
    ['Who founded the company?', 'Ramon and Tiffany Cirilo, a husband-and-wife team. Ramon leads design and construction; Tiffany leads the client experience.'],
    ['How do I request photos or an interview?', 'Reach us at (910) 409-0648 or through our contact page. We provide high-resolution photography and interviews with rights granted for features.'],
  ];
  const faqSchema = { "@context":"https://schema.org","@type":"FAQPage","mainEntity": faqs.map(([q,a])=>({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}})) };
  const org = { "@context":"https://schema.org","@type":"Organization","name":"Cirilo Design + Build","url":SITE,"telephone":"+1-910-409-0648","founder":[{"@type":"Person","name":"Ramon Cirilo"},{"@type":"Person","name":"Tiffany Cirilo"}],"areaServed":{"@type":"State","name":"North Carolina"} };
  return page({
    title: `Press & Media | Cirilo Design + Build`,
    desc: `Press kit, founder story, and media contact for Cirilo Design + Build, a husband-and-wife luxury custom pool builder in Charlotte, NC.`,
    canonicalPath: `/press`,
    eyebrow: 'Press & Media',
    h1: 'Press & Media',
    heroSub: 'The story, the facts, and the contact for journalists and editors covering Charlotte design, real estate, and outdoor living.',
    ctaLabel: 'Contact for Press',
    bodyEyebrow: 'About Cirilo',
    bodyH2: 'The facts, in one place.',
    bodyParas: [
      'Cirilo Design + Build is a husband-and-wife, design-first custom pool builder in Charlotte. We are happy to provide photography, real numbers, and interviews for stories on luxury home building, real estate, and outdoor living.',
      offerHtml(facts),
      '<strong>Story angles we can support:</strong>',
      offerHtml(angles),
    ],
    showServiceCards: false,
    faqEyebrow: 'Press FAQ',
    faqH2: 'For journalists and editors.',
    faqs,
    relatedTitle: 'Explore',
    related: [
      { href: '/portfolio', name: 'Portfolio' },
      { href: '/about', name: 'About Cirilo' },
      { href: '/partners/', name: 'Partner Programs' },
      { href: '/contact', name: 'Contact' },
    ],
    ctaEyebrow: 'Working on a story?',
    ctaH2: 'We will make it easy.',
    ctaSub: 'Full press kit, photography rights, and a half-day at a finished install. Reach out any time.',
    ctaBtn: 'Contact for Press',
    trackPage: 'press',
    trackExtra: { area: 'press' },
    jsonld: [org, faqSchema],
  });
}

let count = 0, targets = 0;
// hub
fs.mkdirSync(path.join(PAGES, 'partners'), { recursive: true });
fs.writeFileSync(path.join(PAGES, 'partners', 'index.html'), renderHub()); count++;
// press
fs.mkdirSync(path.join(PAGES, 'press'), { recursive: true });
fs.writeFileSync(path.join(PAGES, 'press', 'index.html'), renderPress()); count++;
// pillars + targets
for (const p of PILLARS) {
  const dir = path.join(PAGES, 'partners', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), renderPillar(p)); count++;
  for (const t of p.targets) {
    fs.writeFileSync(path.join(dir, slugify(t[0]) + '.html'), renderTarget(p, t)); count++; targets++;
  }
}
console.log(`${count} partner pages written (hub + press + ${PILLARS.length} pillars + ${targets} firm outreach pages)`);
