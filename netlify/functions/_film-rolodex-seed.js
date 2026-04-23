// Curated seed data for the WETYR Film Rolodex.
// PUBLIC info only - company names, public business addresses, generic
// front-desk contact info from corporate websites. NOT scraped from
// IMDbPro / Studio System (paid sources). Add private contacts via the
// admin UI / CSV import once the system is proven.

// Schema:
//   companies: { id, name, type, parent, hq, city, region, country, website, phone, imdb, sec_cik, notes }
//   people:    { id, name, title, company_id, dept, email, phone, linkedin, imdb, notes }
//   tags:      free-text array per row for filtering

const COMPANIES = [
  // ── MAJORS / STREAMERS ──────────────────────────────────────────────
  { id: 'c-warner-bros', name: 'Warner Bros. Discovery', type: 'studio-major', city: 'Burbank', region: 'CA', country: 'US', website: 'https://www.wbd.com', hq: '4000 Warner Blvd, Burbank, CA 91522', phone: '+1-818-954-6000', sec_cik: '0001437107', imdb: 'co0002663', tags: ['major','distrib','financier'] },
  { id: 'c-disney',      name: 'The Walt Disney Studios', type: 'studio-major', city: 'Burbank', region: 'CA', country: 'US', website: 'https://studios.disney.com', hq: '500 S Buena Vista St, Burbank, CA 91521', phone: '+1-818-560-1000', sec_cik: '0001744489', imdb: 'co0008970', tags: ['major','distrib'] },
  { id: 'c-universal',   name: 'Universal Pictures', type: 'studio-major', parent: 'NBCUniversal / Comcast', city: 'Universal City', region: 'CA', country: 'US', website: 'https://www.universalpictures.com', hq: '100 Universal City Plaza, Universal City, CA 91608', phone: '+1-818-777-1000', sec_cik: '0001166691', imdb: 'co0005073', tags: ['major','distrib'] },
  { id: 'c-paramount',   name: 'Paramount Pictures', type: 'studio-major', city: 'Hollywood', region: 'CA', country: 'US', website: 'https://www.paramount.com', hq: '5555 Melrose Ave, Hollywood, CA 90038', phone: '+1-323-956-5000', sec_cik: '0000813828', imdb: 'co0023400', tags: ['major','distrib'] },
  { id: 'c-sony',        name: 'Sony Pictures Entertainment', type: 'studio-major', city: 'Culver City', region: 'CA', country: 'US', website: 'https://www.sonypictures.com', hq: '10202 W Washington Blvd, Culver City, CA 90232', phone: '+1-310-244-4000', imdb: 'co0026545', tags: ['major','distrib'] },
  { id: 'c-netflix',     name: 'Netflix Studios', type: 'streamer', city: 'Los Gatos', region: 'CA', country: 'US', website: 'https://about.netflix.com', hq: '5808 W Sunset Blvd, Los Angeles, CA 90028', phone: '+1-888-638-3549', sec_cik: '0001065280', imdb: 'co0144901', tags: ['streamer','financier','distrib'] },
  { id: 'c-amazon-mgm',  name: 'Amazon MGM Studios', type: 'streamer', city: 'Culver City', region: 'CA', country: 'US', website: 'https://studios.amazon.com', hq: '10250 Constellation Blvd, Los Angeles, CA 90067', phone: '+1-310-449-3000', imdb: 'co0007143', tags: ['streamer','financier','distrib'] },
  { id: 'c-apple-tv',    name: 'Apple TV+ / Apple Studios', type: 'streamer', city: 'Culver City', region: 'CA', country: 'US', website: 'https://tv.apple.com', hq: '8777 Washington Blvd, Culver City, CA 90232', phone: '+1-408-996-1010', imdb: 'co0728595', tags: ['streamer','financier'] },
  { id: 'c-hbo',         name: 'HBO / Max Originals', type: 'streamer', parent: 'Warner Bros. Discovery', city: 'New York', region: 'NY', country: 'US', website: 'https://www.hbo.com', hq: '30 Hudson Yards, New York, NY 10001', phone: '+1-212-512-1000', imdb: 'co0008693', tags: ['streamer','financier'] },

  // ── MINI-MAJORS / SPECIALTY ────────────────────────────────────────
  { id: 'c-a24',         name: 'A24', type: 'mini-major', city: 'New York', region: 'NY', country: 'US', website: 'https://a24films.com', hq: '31 W 27th St 11th Fl, New York, NY 10001', phone: '+1-646-568-6015', imdb: 'co0345144', tags: ['indie-distrib','financier','prestige'] },
  { id: 'c-neon',        name: 'NEON', type: 'mini-major', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://neonrated.com', hq: '8730 Sunset Blvd, West Hollywood, CA 90069', phone: '+1-310-734-4280', imdb: 'co0681224', tags: ['indie-distrib','financier','prestige'] },
  { id: 'c-focus-features', name: 'Focus Features', type: 'mini-major', parent: 'NBCUniversal', city: 'Universal City', region: 'CA', country: 'US', website: 'https://www.focusfeatures.com', hq: '100 Universal City Plaza, Universal City, CA 91608', phone: '+1-818-777-7373', imdb: 'co0042399', tags: ['specialty','distrib'] },
  { id: 'c-searchlight', name: 'Searchlight Pictures', type: 'mini-major', parent: 'The Walt Disney Co.', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.searchlightpictures.com', hq: '10201 W Pico Blvd, Los Angeles, CA 90064', phone: '+1-310-369-1000', imdb: 'co0017497', tags: ['specialty','distrib','prestige'] },
  { id: 'c-lionsgate',   name: 'Lionsgate', type: 'mini-major', city: 'Santa Monica', region: 'CA', country: 'US', website: 'https://www.lionsgate.com', hq: '2700 Colorado Ave, Santa Monica, CA 90404', phone: '+1-310-449-9200', sec_cik: '0000929351', imdb: 'co0026841', tags: ['indie-distrib','financier'] },
  { id: 'c-mubi',        name: 'MUBI', type: 'mini-major', city: 'New York', region: 'NY', country: 'US', website: 'https://mubi.com', hq: '147 W 24th St, New York, NY 10011', imdb: 'co0220466', tags: ['streamer','indie-distrib','prestige'] },
  { id: 'c-ifc-films',   name: 'IFC Films', type: 'mini-major', parent: 'AMC Networks', city: 'New York', region: 'NY', country: 'US', website: 'https://www.ifcfilms.com', hq: '11 Penn Plaza, New York, NY 10001', phone: '+1-646-273-7200', imdb: 'co0017902', tags: ['indie-distrib'] },
  { id: 'c-magnolia',    name: 'Magnolia Pictures', type: 'mini-major', city: 'New York', region: 'NY', country: 'US', website: 'https://www.magpictures.com', hq: '49 W 27th St 7th Fl, New York, NY 10001', phone: '+1-212-924-6701', imdb: 'co0024325', tags: ['indie-distrib'] },

  // ── PRODUCTION COMPANIES ───────────────────────────────────────────
  { id: 'c-blumhouse',   name: 'Blumhouse Productions', type: 'prodco', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.blumhouse.com', hq: '3960 Ince Blvd, Culver City, CA 90232', phone: '+1-310-275-7222', imdb: 'co0078490', tags: ['horror','genre','prolific'] },
  { id: 'c-plan-b',      name: 'Plan B Entertainment', type: 'prodco', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.planbent.com', hq: '9150 Wilshire Blvd Suite 219, Beverly Hills, CA 90212', phone: '+1-310-275-6135', imdb: 'co0067205', tags: ['prestige'] },
  { id: 'c-bron',        name: 'BRON Studios', type: 'prodco', city: 'Burnaby', region: 'BC', country: 'CA', website: 'https://bronstudios.com', hq: '3823 Henning Dr, Burnaby, BC V5C 6P3', imdb: 'co0269708', tags: ['financier'] },
  { id: 'c-imagine',     name: 'Imagine Entertainment', type: 'prodco', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://www.imagine-entertainment.com', hq: '9465 Wilshire Blvd 7th Fl, Beverly Hills, CA 90212', phone: '+1-310-858-2000', imdb: 'co0026545', tags: ['prestige'] },
  { id: 'c-bad-robot',   name: 'Bad Robot Productions', type: 'prodco', city: 'Santa Monica', region: 'CA', country: 'US', website: 'https://badrobot.com', hq: '1221 Olympic Blvd, Santa Monica, CA 90404', phone: '+1-310-664-3456', imdb: 'co0030737', tags: ['prestige','genre'] },
  { id: 'c-village-roadshow', name: 'Village Roadshow Pictures', type: 'prodco', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://vreg.com', hq: '500 S Buena Vista St, Burbank, CA 91521', phone: '+1-818-260-6000', imdb: 'co0036758', tags: ['financier'] },
  { id: 'c-skydance',    name: 'Skydance Media', type: 'prodco', city: 'Santa Monica', region: 'CA', country: 'US', website: 'https://skydance.com', hq: '5555 Melrose Ave, Hollywood, CA 90038', phone: '+1-310-740-1100', imdb: 'co0249624', tags: ['financier','tentpole'] },
  { id: 'c-legendary',   name: 'Legendary Entertainment', type: 'prodco', city: 'Burbank', region: 'CA', country: 'US', website: 'https://www.legendary.com', hq: '2900 W Alameda Ave Suite 1500, Burbank, CA 91505', phone: '+1-818-688-8000', imdb: 'co0159111', tags: ['financier','tentpole'] },
  { id: 'c-annapurna',   name: 'Annapurna Pictures', type: 'prodco', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://annapurna.pictures', hq: '812 N Highland Ave, Los Angeles, CA 90038', phone: '+1-310-724-5678', imdb: 'co0298191', tags: ['prestige','financier'] },
  { id: 'c-ghoulardi',   name: 'Ghoulardi Film Company', type: 'prodco', city: 'Los Angeles', region: 'CA', country: 'US', imdb: 'co0049658', tags: ['indie','auteur'] },
  { id: 'c-killer-films', name: 'Killer Films', type: 'prodco', city: 'New York', region: 'NY', country: 'US', website: 'https://killerfilms.com', hq: '526 W 26th St Suite 716, New York, NY 10001', phone: '+1-212-473-3950', imdb: 'co0021351', tags: ['indie','prestige'] },
  { id: 'c-protozoa',    name: 'Protozoa Pictures', type: 'prodco', city: 'New York', region: 'NY', country: 'US', website: 'https://protozoapictures.com', hq: '104 W 14th St, New York, NY 10011', imdb: 'co0010834', tags: ['indie','auteur'] },

  // ── AGENCIES (TALENT/LIT) ──────────────────────────────────────────
  { id: 'c-caa',         name: 'Creative Artists Agency (CAA)', type: 'agency', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.caa.com', hq: '2000 Avenue of the Stars, Los Angeles, CA 90067', phone: '+1-424-288-2000', tags: ['talent','lit','packaging'] },
  { id: 'c-wme',         name: 'WME (William Morris Endeavor)', type: 'agency', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://www.wmeagency.com', hq: '9601 Wilshire Blvd 3rd Fl, Beverly Hills, CA 90210', phone: '+1-310-285-9000', tags: ['talent','lit','packaging'] },
  { id: 'c-uta',         name: 'United Talent Agency (UTA)', type: 'agency', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://www.unitedtalent.com', hq: '9336 Civic Center Dr, Beverly Hills, CA 90210', phone: '+1-310-273-6700', tags: ['talent','lit'] },
  { id: 'c-paradigm',    name: 'Paradigm Talent Agency', type: 'agency', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://www.paradigmagency.com', hq: '140 N Crescent Dr, Beverly Hills, CA 90210', phone: '+1-310-288-8000', tags: ['talent','music'] },
  { id: 'c-gersh',       name: 'The Gersh Agency', type: 'agency', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://gershagency.com', hq: '9465 Wilshire Blvd 6th Fl, Beverly Hills, CA 90212', phone: '+1-310-274-6611', tags: ['talent','lit'] },
  { id: 'c-icm-stage',   name: 'Independent Artist Group (IAG)', type: 'agency', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://www.independentartistgroup.com', hq: '10250 Constellation Blvd 9th Fl, Los Angeles, CA 90067', phone: '+1-310-550-4000', tags: ['talent','lit'] },

  // ── SALES / FINANCIERS ─────────────────────────────────────────────
  { id: 'c-cinetic',     name: 'Cinetic Media', type: 'sales-agent', city: 'New York', region: 'NY', country: 'US', website: 'https://cineticmedia.com', hq: '555 W 25th St 4th Fl, New York, NY 10001', phone: '+1-212-204-7979', tags: ['sales','financing','indie'] },
  { id: 'c-utopia',      name: 'Utopia', type: 'sales-agent', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://utopia.movie', hq: '7083 Hollywood Blvd, Los Angeles, CA 90028', tags: ['sales','indie-distrib'] },
  { id: 'c-mister-smith', name: 'Mister Smith Entertainment', type: 'sales-agent', city: 'London', country: 'UK', website: 'https://www.mistersmithent.com', hq: '14 Buckingham Palace Rd, London SW1W 0QP', phone: '+44-20-7494-1724', tags: ['sales','intl'] },
  { id: 'c-fr-sales',    name: 'FilmNation Entertainment', type: 'sales-agent', city: 'New York', region: 'NY', country: 'US', website: 'https://www.filmnation.com', hq: '150 W 22nd St 9th Fl, New York, NY 10011', phone: '+1-917-484-8900', tags: ['sales','financier','prestige'] },
  { id: 'c-protagonist', name: 'Protagonist Pictures', type: 'sales-agent', city: 'London', country: 'UK', website: 'https://www.protagonistpictures.com', hq: '5th Fl, Hubert House, 437 Bury New Rd, Manchester M25 1AD', tags: ['sales','intl'] },
  { id: 'c-30west',      name: '30WEST', type: 'financier', city: 'New York', region: 'NY', country: 'US', website: 'https://www.30westco.com', hq: '36 Cooper Square 6th Fl, New York, NY 10003', tags: ['financier','equity'] },

  // ── PUBLICITY / PR ─────────────────────────────────────────────────
  { id: 'c-id-pr',       name: 'ID Public Relations', type: 'publicist', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://id-pr.com', hq: '8409 Santa Monica Blvd, West Hollywood, CA 90069', phone: '+1-310-309-1000', tags: ['talent-pr','awards'] },
  { id: 'c-narrative-pr', name: 'Narrative PR', type: 'publicist', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://narrativepr.com', hq: '8500 Wilshire Blvd Suite 1010, Beverly Hills, CA 90211', phone: '+1-323-848-7100', tags: ['talent-pr'] },
  { id: 'c-rogers-cowan', name: 'Rogers & Cowan PMK', type: 'publicist', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.rogersandcowanpmk.com', hq: '8687 Melrose Ave 8th Fl, Los Angeles, CA 90069', phone: '+1-310-854-8200', tags: ['talent-pr','corporate'] },
  { id: 'c-dda-group',   name: 'DDA Group', type: 'publicist', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://ddapr.com', hq: '6464 Sunset Blvd Suite 750, Los Angeles, CA 90028', phone: '+1-323-462-7777', tags: ['film-pr','festival'] },
  { id: 'c-falco-ink',   name: 'Falco Ink.', type: 'publicist', city: 'New York', region: 'NY', country: 'US', website: 'https://falcoink.com', hq: '850 Seventh Ave Suite 1005, New York, NY 10019', phone: '+1-212-445-7100', tags: ['indie-pr','festival'] },
  { id: 'c-cinetic-marketing', name: 'Cinetic Marketing', type: 'publicist', city: 'New York', region: 'NY', country: 'US', website: 'https://cineticmarketing.com', hq: '555 W 25th St, New York, NY 10001', phone: '+1-212-204-7979', tags: ['indie-pr','strategy'] },

  // ── COMPLETION / BONDING / LEGAL ───────────────────────────────────
  { id: 'c-fcg',         name: 'Film Finances Inc. (Completion Bond)', type: 'bond', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.ffi.com', hq: '9000 Sunset Blvd Suite 1400, West Hollywood, CA 90069', phone: '+1-310-275-7323', tags: ['completion','bond'] },
  { id: 'c-sloss-eckhouse', name: 'Sloss Eckhouse Dasti Haynes Brennan LawCo', type: 'legal', city: 'New York', region: 'NY', country: 'US', website: 'https://slosslaw.com', hq: '170 Fifth Ave 10th Fl, New York, NY 10010', phone: '+1-212-627-9898', tags: ['indie-legal'] },
];

// Public front-desk / publicly-listed press contacts only.
// Names of specific buyers, agents, executives are intentionally OMITTED here.
// Use the admin UI / CSV import to add private contacts.
const PEOPLE = [
  { id: 'p-a24-info',       name: 'A24 General Inquiries',     title: 'General Contact',  company_id: 'c-a24',         dept: 'general',  email: 'info@a24films.com' },
  { id: 'p-a24-press',      name: 'A24 Press',                 title: 'Press Inquiries',  company_id: 'c-a24',         dept: 'press',    email: 'press@a24films.com' },
  { id: 'p-neon-info',      name: 'NEON General',              title: 'General Contact',  company_id: 'c-neon',        dept: 'general',  email: 'info@neonrated.com' },
  { id: 'p-neon-press',     name: 'NEON Press',                title: 'Press Inquiries',  company_id: 'c-neon',        dept: 'press',    email: 'press@neonrated.com' },
  { id: 'p-blumhouse-info', name: 'Blumhouse Submissions',     title: 'Submissions',      company_id: 'c-blumhouse',   dept: 'dev',      notes: 'Submissions accepted only via signatory agencies/managers/lawyers.' },
  { id: 'p-killer-info',    name: 'Killer Films Submissions',  title: 'Submissions',      company_id: 'c-killer-films',dept: 'dev',      email: 'info@killerfilms.com' },
  { id: 'p-cinetic-info',   name: 'Cinetic Media',             title: 'Sales / Strategy', company_id: 'c-cinetic',     dept: 'sales',    email: 'info@cineticmedia.com' },
  { id: 'p-filmnation-info',name: 'FilmNation Sales',          title: 'Intl. Sales',      company_id: 'c-fr-sales',    dept: 'sales',    email: 'info@filmnation.com' },
  { id: 'p-id-pr-info',     name: 'ID PR Press Desk',          title: 'Press Desk',       company_id: 'c-id-pr',       dept: 'press',    email: 'info@id-pr.com' },
  { id: 'p-falco-info',     name: 'Falco Ink Press Desk',      title: 'Press Desk',       company_id: 'c-falco-ink',   dept: 'press',    email: 'info@falcoink.com' },
  { id: 'p-dda-info',       name: 'DDA Group Press Desk',      title: 'Press Desk',       company_id: 'c-dda-group',   dept: 'press',    email: 'info@ddapr.com' },
];

module.exports = { COMPANIES, PEOPLE };
