// Curated seed data for the WETYR Film Rolodex.
// PUBLIC info only - company names, public business addresses, generic
// front-desk contact info from corporate websites. NOT scraped from
// IMDbPro / Studio System (paid sources). Add private contacts via the
// admin UI / CSV import once the system is proven.
//
// Sourced from hollywood_rolodex_master.txt (compiled 2025) covering:
//  1. Major studios          11. Publicists
//  2. Indie production cos   12. Cinematographers
//  3. Talent-led prodcos     13. Post-production houses
//  4. Commercial prodcos     14. Music licensing
//  5. Financiers             15. Locations / studio lots
//  6. PE/Hedge in film       16. Guilds / unions
//  7. Talent agencies        17. Industry directories
//  8. Management cos         18. Trades (RSS sources)
//  9. Entertainment law      19. Festivals / markets
// 10. Casting directors      20. Dev notes
//
// Schema:
//   companies: { id, name, type, parent, hq, city, region, country, website,
//                phone, email, imdb, sec_cik, tags, notes, productions[],
//                scrape_paths[] (relative paths the deep-scraper should crawl) }
//   people:    { id, name, title, company, company_id, dept, email, phone,
//                linkedin, imdb, tags, notes, productions[] }

const COMPANIES = [
  // ── 1. MAJOR STUDIOS / STREAMERS ──────────────────────────────────────
  { id: 'c-universal',   name: 'Universal Pictures', type: 'studio-major', parent: 'NBCUniversal / Comcast', city: 'Universal City', region: 'CA', country: 'US', website: 'https://www.universalpictures.com', hq: '100 Universal City Plaza, Universal City, CA 91608', phone: '+1-818-777-1000', sec_cik: '0001166691', imdb: 'co0005073', tags: ['major','distrib'], scrape_paths: ['/about','/leadership','/press'] },
  { id: 'c-warner-bros', name: 'Warner Bros. Pictures', type: 'studio-major', parent: 'Warner Bros. Discovery', city: 'Burbank', region: 'CA', country: 'US', website: 'https://www.warnerbros.com', hq: '4000 Warner Blvd, Burbank, CA 91522', phone: '+1-818-954-3000', sec_cik: '0001437107', imdb: 'co0002663', tags: ['major','distrib','financier'], scrape_paths: ['/leadership','/about','/press'] },
  { id: 'c-paramount',   name: 'Paramount Pictures', type: 'studio-major', parent: 'Paramount Global', city: 'Hollywood', region: 'CA', country: 'US', website: 'https://www.paramount.com', hq: '5555 Melrose Ave, Los Angeles, CA 90038', phone: '+1-323-956-5000', sec_cik: '0000813828', imdb: 'co0023400', tags: ['major','distrib'], scrape_paths: ['/about','/leadership'] },
  { id: 'c-sony',        name: 'Sony Pictures Entertainment', type: 'studio-major', parent: 'Sony Group Corporation', city: 'Culver City', region: 'CA', country: 'US', website: 'https://www.sonypictures.com', hq: '10202 W. Washington Blvd, Culver City, CA 90232', phone: '+1-310-244-4000', imdb: 'co0026545', tags: ['major','distrib'], scrape_paths: ['/corp/about-us','/leadership'] },
  { id: 'c-disney',      name: 'Walt Disney Studios', type: 'studio-major', parent: 'The Walt Disney Company', city: 'Burbank', region: 'CA', country: 'US', website: 'https://studios.disney.com', hq: '500 S. Buena Vista St, Burbank, CA 91521', phone: '+1-818-560-1000', sec_cik: '0001744489', imdb: 'co0008970', tags: ['major','distrib'], scrape_paths: ['/about','/leadership'] },
  { id: 'c-20th-century', name: '20th Century Studios / Searchlight Pictures', type: 'studio-major', parent: 'Disney', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.searchlightpictures.com', hq: '10201 W. Pico Blvd, Los Angeles, CA 90035', imdb: 'co0017497', tags: ['major','specialty','prestige'], scrape_paths: ['/films','/news'] },
  { id: 'c-apple',       name: 'Apple Original Films', type: 'streamer', parent: 'Apple Inc.', city: 'Culver City', region: 'CA', country: 'US', website: 'https://www.apple.com/apple-tv-plus/', hq: '8777 Washington Blvd, Culver City, CA 90232', phone: '+1-408-996-1010', imdb: 'co0728595', tags: ['streamer','financier'], notes: 'Submit via agents/lawyers' },
  { id: 'c-amazon-mgm',  name: 'Amazon MGM Studios', type: 'streamer', parent: 'Amazon / MGM Holdings', city: 'Culver City', region: 'CA', country: 'US', website: 'https://studios.amazon.com', hq: '9336 W. Washington Blvd, Culver City, CA 90232', phone: '+1-310-449-3000', imdb: 'co0007143', tags: ['streamer','financier','distrib'], scrape_paths: ['/about','/team'] },
  { id: 'c-netflix',     name: 'Netflix Studios', type: 'streamer', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://about.netflix.com', hq: '5808 Sunset Blvd, Los Angeles, CA 90028', phone: '+1-310-734-2900', sec_cik: '0001065280', imdb: 'co0144901', tags: ['streamer','financier','distrib'], scrape_paths: ['/leadership','/team'] },
  { id: 'c-hbo',         name: 'HBO / Max Originals', type: 'streamer', parent: 'Warner Bros. Discovery', city: 'New York', region: 'NY', country: 'US', website: 'https://www.hbo.com', hq: '30 Hudson Yards, New York, NY 10001', phone: '+1-212-512-1000', imdb: 'co0008693', tags: ['streamer','financier'] },

  // ── 2. INDIE PRODUCTION COMPANIES (FEATURE FILM) ──────────────────────
  { id: 'c-a24',          name: 'A24', type: 'mini-major', city: 'New York', region: 'NY', country: 'US', website: 'https://a24films.com', hq: '31 W 27th St, New York, NY 10001', phone: '+1-646-568-6015', imdb: 'co0345144', tags: ['indie-distrib','financier','prestige'], scrape_paths: ['/films','/news','/about'] },
  { id: 'c-blumhouse',    name: 'Blumhouse Productions', type: 'prodco', city: 'Santa Monica', region: 'CA', country: 'US', website: 'https://www.blumhouse.com', hq: '2401 Colorado Ave, Suite 110, Santa Monica, CA 90404', phone: '+1-310-275-7222', imdb: 'co0078490', tags: ['horror','genre','prolific'], scrape_paths: ['/about','/films','/team'] },
  { id: 'c-plan-b',       name: 'Plan B Entertainment', type: 'prodco', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://www.planbentertainment.com', hq: '9150 Wilshire Blvd Suite 219, Beverly Hills, CA 90212', phone: '+1-310-275-6135', imdb: 'co0067205', tags: ['prestige'], notes: 'Brad Pitt, Dede Gardner, Jeremy Kleiner', productions: ['12 Years a Slave','Moonlight','Minari'] },
  { id: 'c-legendary',    name: 'Legendary Entertainment', type: 'prodco', city: 'Burbank', region: 'CA', country: 'US', website: 'https://www.legendary.com', hq: '2900 W. Alameda Ave Suite 1500, Burbank, CA 91505', phone: '+1-818-688-8000', imdb: 'co0159111', tags: ['financier','tentpole'], productions: ['Dune','Dark Knight','Godzilla'] },
  { id: 'c-lionsgate',    name: 'Lionsgate Films', type: 'mini-major', city: 'Santa Monica', region: 'CA', country: 'US', website: 'https://www.lionsgate.com', hq: '2700 Colorado Ave, Santa Monica, CA 90404', phone: '+1-310-449-9200', sec_cik: '0000929351', imdb: 'co0026841', tags: ['indie-distrib','financier'] },
  { id: 'c-annapurna',    name: 'Annapurna Pictures', type: 'prodco', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://annapurna.pictures', hq: '1925 Century Park East, Los Angeles, CA 90067', phone: '+1-310-724-5678', imdb: 'co0298191', tags: ['prestige','financier'], notes: 'Founder Megan Ellison', productions: ['Her','Zero Dark Thirty','Booksmart'] },
  { id: 'c-participant',  name: 'Participant Media', type: 'prodco', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://participantmedia.com', hq: '9150 Wilshire Blvd Suite 500, Beverly Hills, CA 90212', tags: ['social-impact','docs','prestige'] },
  { id: 'c-bad-robot',    name: 'Bad Robot Productions', type: 'prodco', city: 'Santa Monica', region: 'CA', country: 'US', website: 'https://badrobot.com', hq: '1221 Olympic Blvd, Santa Monica, CA 90404', phone: '+1-310-664-3456', imdb: 'co0030737', tags: ['prestige','genre'], notes: 'J.J. Abrams', productions: ['Mission Impossible','Star Wars','Cloverfield'] },
  { id: 'c-amblin',       name: 'Amblin Entertainment', type: 'prodco', city: 'Universal City', region: 'CA', country: 'US', website: 'https://amblin.com', hq: '100 Universal City Plaza, Bungalow 477, Universal City, CA 91608', tags: ['prestige'], notes: 'Steven Spielberg', productions: ['Jurassic Park','Schindlers List','E.T.'] },
  { id: 'c-imagine',      name: 'Imagine Entertainment', type: 'prodco', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://www.imagine-entertainment.com', hq: '9465 Wilshire Blvd 7th Floor, Beverly Hills, CA 90212', phone: '+1-310-858-2000', tags: ['prestige'], notes: 'Ron Howard, Brian Grazer' },
  { id: 'c-skydance',     name: 'Skydance Media', type: 'prodco', city: 'Santa Monica', region: 'CA', country: 'US', website: 'https://skydance.com', hq: '2900 Olympic Blvd, Santa Monica, CA 90404', phone: '+1-310-740-1100', imdb: 'co0249624', tags: ['financier','tentpole'], notes: 'Founder David Ellison' },
  { id: 'c-new-regency',  name: 'New Regency Productions', type: 'prodco', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://newregency.com', hq: '10201 W. Pico Blvd, Bldg 12, Los Angeles, CA 90035', tags: ['prestige','financier'] },
  { id: 'c-alcon',        name: 'Alcon Entertainment', type: 'prodco', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://alconent.com', hq: '10390 Santa Monica Blvd Suite 250, Los Angeles, CA 90025', tags: ['financier'], notes: 'Andrew Kosove, Broderick Johnson', productions: ['Blade Runner 2049','The Blind Side'] },
  { id: 'c-black-bear',   name: 'Black Bear Pictures', type: 'prodco', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://blackbearpictures.com', tags: ['financier','gap-equity'], notes: 'Founder Teddy Schwarzman' },
  { id: 'c-macro',        name: 'MACRO', type: 'prodco', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://wearemacro.co', tags: ['diverse','prestige'], notes: 'Founder Charles D. King' },
  { id: 'c-fifth-season', name: 'Fifth Season (fka Endeavor Content)', type: 'prodco', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://fifthseason.com', tags: ['financier','sales','prestige'] },

  // ── 3. TALENT-LED BOUTIQUE PRODCOS ────────────────────────────────────
  { id: 'c-luckychap',    name: 'LuckyChap Entertainment', type: 'talent-led-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://luckychapentertainment.com', tags: ['talent-led','first-look'], notes: 'Margot Robbie, Tom Ackerley, Josey McNamara, Sophia Kerr - WB deal', productions: ['Barbie','Promising Young Woman','I Tonya','Birds of Prey'] },
  { id: 'c-applebox',     name: 'Apple Box Productions', type: 'talent-led-prod', city: 'Los Angeles', region: 'CA', country: 'US', tags: ['talent-led'], notes: 'Tom Hanks - contact via CAA', productions: ['A Beautiful Day in the Neighborhood','Finch'] },
  { id: 'c-pastel',       name: 'Pastel Productions', type: 'talent-led-prod', city: 'Los Angeles', region: 'CA', country: 'US', tags: ['talent-led'], notes: 'Sydney Sweeney - contact via WME' },
  { id: 'c-outlier',      name: 'Outlier Society', type: 'talent-led-prod', city: 'Los Angeles', region: 'CA', country: 'US', tags: ['talent-led'], notes: 'Michael B. Jordan - contact via WME', productions: ['Without Remorse','Journal for Jordan'] },
  { id: 'c-bron',         name: 'BRON Studios', type: 'prodco', city: 'Burnaby', region: 'BC', country: 'CA', website: 'https://bronstudios.com', hq: '3823 Henning Dr, Burnaby, BC V5C 6P3', imdb: 'co0269708', tags: ['financier','equity-fund'] },
  { id: 'c-makeready',    name: 'MakeReady', type: 'talent-led-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://makeready.com', tags: ['talent-led','first-look'], notes: 'Brad Weston' },
  { id: 'c-two-roads',    name: 'Two Roads Picture Co.', type: 'talent-led-prod', city: 'Los Angeles', region: 'CA', country: 'US', tags: ['boutique'] },
  { id: 'c-sight-unseen', name: 'Sight Unseen Pictures', type: 'talent-led-prod', city: 'Los Angeles', region: 'CA', country: 'US', tags: ['talent-led'], notes: 'Jonathan Wang, Daniel Kaluuya - Universal first-look' },
  { id: 'c-monkeypaw',    name: 'Monkeypaw Productions', type: 'talent-led-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://monkeypaw.com', tags: ['talent-led','genre','first-look'], notes: 'Jordan Peele - Universal deal', productions: ['Get Out','Us','Nope','Candyman'] },
  { id: 'c-westbrook',    name: 'Westbrook Studios', type: 'talent-led-prod', city: 'Burbank', region: 'CA', country: 'US', website: 'https://westbrookstudios.com', tags: ['talent-led'], notes: 'Will Smith, Jada Pinkett Smith' },
  { id: 'c-hello-sunshine', name: 'Hello Sunshine', type: 'talent-led-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://hello-sunshine.com', tags: ['talent-led','female-led'], notes: 'Reese Witherspoon - Blackstone-backed' },
  { id: 'c-appian-way',   name: 'Appian Way Productions', type: 'talent-led-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://appianwayproductions.com', tags: ['talent-led'], notes: 'Leonardo DiCaprio - via CAA' },
  { id: 'c-color-force',  name: 'Color Force', type: 'talent-led-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://colorforce.com', tags: ['boutique','prestige'], notes: 'Nina Jacobson', productions: ['Hunger Games','Crazy Rich Asians'] },

  // ── 4. COMMERCIAL PRODUCTION COMPANIES ────────────────────────────────
  { id: 'c-reset',        name: 'Reset Content', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://reset.tv', tags: ['commercial','music-video'] },
  { id: 'c-park-pictures',name: 'Park Pictures', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://parkpictures.com', tags: ['commercial','award-winning'] },
  { id: 'c-prettybird',   name: 'PRETTYBIRD', type: 'commercial-prod', city: 'Culver City', region: 'CA', country: 'US', website: 'https://prettybird.com', tags: ['commercial','music-video','diverse'], notes: 'Kerstin Emhoff, Paul Hunter' },
  { id: 'c-epoch',        name: 'Epoch Films', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://epochfilms.com', tags: ['commercial'] },
  { id: 'c-hungry-man',   name: 'Hungry Man Productions', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://hungryman.com', tags: ['commercial','comedy'] },
  { id: 'c-biscuit',      name: 'Biscuit Filmworks', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://biscuitfilmworks.com', tags: ['commercial','top-tier'], notes: 'Founder Shawn Lacy - reps Noam Murro' },
  { id: 'c-tool',         name: 'Tool of North America', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://toolofna.com', tags: ['commercial','high-end'] },
  { id: 'c-stink',        name: 'Stink Films', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://stinkfilms.com', tags: ['commercial','global'] },
  { id: 'c-partizan',     name: 'Partizan', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://partizan.com', tags: ['commercial','artistic'], notes: 'Michel Gondry' },
  { id: 'c-mjz',          name: 'MJZ', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://mjz.com', tags: ['commercial','top-tier','awarded'] },
  { id: 'c-radical-media',name: 'Radical Media', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://radicalmedia.com', tags: ['commercial','docs','branded'] },
  { id: 'c-supply-demand',name: 'Supply & Demand', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://supplyandemandent.com', tags: ['commercial','automotive','tech'] },
  { id: 'c-anonymous',    name: 'Anonymous Content', type: 'commercial-prod', city: 'Culver City', region: 'CA', country: 'US', website: 'https://anonymouscontent.com', tags: ['commercial','management','prodco'] },
  { id: 'c-quriosity',    name: 'Quriosity Productions', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://quriosity.com', tags: ['commercial','diverse'] },
  { id: 'c-revolver',     name: 'Revolver Film Company', type: 'commercial-prod', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://revolverla.com', tags: ['commercial','award-winning'] },

  // ── 5. FILM FINANCIERS & SALES ────────────────────────────────────────
  { id: 'c-globalgate',   name: 'Globalgate Entertainment', type: 'financier', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://globalgate.la', tags: ['financier','intl-coproduction'] },
  { id: 'c-voltage',      name: 'Voltage Pictures', type: 'sales-agent', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://voltagepictures.com', tags: ['sales','financier','intl'], notes: 'Nicolas Chartier - Cannes/AFM regular' },
  { id: 'c-creative-wealth', name: 'Creative Wealth Media', type: 'financier', city: 'Toronto', country: 'CA', tags: ['financier','gap-financing'], notes: 'Jason Cloth' },
  { id: 'c-highland',     name: 'Highland Film Group', type: 'sales-agent', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://highlandfilmgroup.com', tags: ['sales','equity'] },
  { id: 'c-lotus',        name: 'Lotus Entertainment', type: 'sales-agent', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://lotusentertainment.net', tags: ['sales','packaging','financier'] },
  { id: 'c-comerica',     name: 'Comerica Entertainment Group', type: 'bank', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.comerica.com', tags: ['bank','production-loans','gap'] },
  { id: 'c-cnb',          name: 'City National Bank Entertainment', type: 'bank', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.cnb.com', tags: ['bank','production-finance'] },
  { id: 'c-east-west',    name: 'East West Bank Entertainment', type: 'bank', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.eastwestbank.com', tags: ['bank','indie-finance'] },
  { id: 'c-waypoint',     name: 'Waypoint Entertainment', type: 'sales-agent', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://waypointentertainment.com', tags: ['sales','packaging','financier'] },
  { id: 'c-bloom',        name: 'Bloom', type: 'sales-agent', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://bloomentertainment.com', tags: ['sales','financier','intl'] },
  { id: 'c-sierra-affinity', name: 'Sierra/Affinity', type: 'sales-agent', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://sierra-affinity.com', tags: ['sales','acquisitions'] },
  { id: 'c-cinetic',      name: 'Cinetic Media', type: 'sales-agent', city: 'New York', region: 'NY', country: 'US', website: 'https://cineticmedia.com', hq: '555 W 25th St 4th Fl, New York, NY 10001', phone: '+1-212-204-7979', tags: ['sales','financing','indie'] },
  { id: 'c-utopia',       name: 'Utopia', type: 'sales-agent', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://utopia.movie', tags: ['sales','indie-distrib'] },
  { id: 'c-mister-smith', name: 'Mister Smith Entertainment', type: 'sales-agent', city: 'London', country: 'UK', website: 'https://www.mistersmithent.com', tags: ['sales','intl'] },
  { id: 'c-filmnation',   name: 'FilmNation Entertainment', type: 'sales-agent', city: 'New York', region: 'NY', country: 'US', website: 'https://www.filmnation.com', hq: '150 W 22nd St 9th Fl, New York, NY 10011', phone: '+1-917-484-8900', tags: ['sales','financier','prestige'] },
  { id: 'c-protagonist',  name: 'Protagonist Pictures', type: 'sales-agent', city: 'London', country: 'UK', website: 'https://www.protagonistpictures.com', tags: ['sales','intl'] },
  { id: 'c-30west',       name: '30WEST', type: 'financier', city: 'New York', region: 'NY', country: 'US', website: 'https://www.30westco.com', tags: ['financier','equity'] },

  // ── 6. PE & HEDGE FUNDS IN FILM ───────────────────────────────────────
  { id: 'c-ares',         name: 'Ares Management (Entertainment)', type: 'pe-fund', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.aresmgmt.com', tags: ['pe','entertainment-vertical'] },
  { id: 'c-blackstone',   name: 'Blackstone (Entertainment)', type: 'pe-fund', city: 'New York', region: 'NY', country: 'US', website: 'https://www.blackstone.com', tags: ['pe','growing-entertainment'] },
  { id: 'c-kkr',          name: 'KKR & Co.', type: 'pe-fund', city: 'New York', region: 'NY', country: 'US', website: 'https://www.kkr.com', tags: ['pe'] },
  { id: 'c-silver-lake',  name: 'Silver Lake Partners', type: 'pe-fund', city: 'Menlo Park', region: 'CA', country: 'US', website: 'https://www.silverlake.com', tags: ['pe','endeavor-investor'] },
  { id: 'c-general-atlantic', name: 'General Atlantic', type: 'pe-fund', city: 'New York', region: 'NY', country: 'US', website: 'https://www.generalatlantic.com', tags: ['pe','candle-media'] },
  { id: 'c-nexstar',      name: 'Nexstar Media Group', type: 'pe-fund', city: 'Irving', region: 'TX', country: 'US', website: 'https://www.nexstar.tv', tags: ['media-conglomerate'] },
  { id: 'c-aleph',        name: 'Aleph (fka Sherpa Capital)', type: 'pe-fund', city: 'San Francisco', region: 'CA', country: 'US', website: 'https://aleph.vc', tags: ['vc'] },

  // ── 7. TALENT AGENCIES ────────────────────────────────────────────────
  { id: 'c-caa',          name: 'CAA (Creative Artists Agency)', type: 'agency', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.caa.com', hq: '2000 Avenue of the Stars, Los Angeles, CA 90067', phone: '+1-424-288-2000', tags: ['talent','lit','packaging','top-tier'], scrape_paths: ['/contact-us','/agents'] },
  { id: 'c-wme',          name: 'WME (William Morris Endeavor)', type: 'agency', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://www.wmeagency.com', hq: '9601 Wilshire Blvd, Beverly Hills, CA 90210', phone: '+1-310-285-9000', tags: ['talent','lit','packaging','top-tier'] },
  { id: 'c-uta',          name: 'UTA (United Talent Agency)', type: 'agency', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://www.unitedtalent.com', hq: '9336 Civic Center Dr, Beverly Hills, CA 90210', phone: '+1-310-273-6700', tags: ['talent','lit','indie-strong'] },
  { id: 'c-paradigm',     name: 'Paradigm Talent Agency', type: 'agency', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://www.paradigmagency.com', hq: '9942 Wilshire Blvd, Beverly Hills, CA 90210', phone: '+1-310-288-8000', tags: ['talent','music'] },
  { id: 'c-apa',          name: 'APA (Agency for the Performing Arts)', type: 'agency', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://www.apa-agency.com', hq: '405 S. Beverly Dr, Beverly Hills, CA 90212', phone: '+1-310-888-4200', tags: ['talent','commercial','below-the-line'] },
  { id: 'c-gersh',        name: 'The Gersh Agency', type: 'agency', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://gershagency.com', hq: '9465 Wilshire Blvd 6th Floor, Beverly Hills, CA 90212', phone: '+1-310-274-6611', tags: ['talent','lit','directing'] },
  { id: 'c-verve',        name: 'Verve Talent and Literary Agency', type: 'agency', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.vervetalent.com', tags: ['boutique','writers'] },
  { id: 'c-industry-ent', name: 'Industry Entertainment', type: 'agency', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://industryentertainment.com', tags: ['talent','lit','mid-tier'] },
  { id: 'c-cesd',         name: 'CESD Talent Agency', type: 'agency', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://cesdtalent.com', tags: ['commercial','talent'] },
  { id: 'c-msa',          name: 'McDonald Selznick Associates (MSA)', type: 'agency', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://msaagency.com', tags: ['below-the-line','directors','commercial'] },
  { id: 'c-dpn',          name: 'DPN Talent', type: 'agency', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://dpntalent.com', tags: ['commercial','talent'] },

  // ── 8. MANAGEMENT COMPANIES ───────────────────────────────────────────
  { id: 'c-3arts',        name: '3 Arts Entertainment', type: 'management', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://3arts.com', hq: '9460 Wilshire Blvd 7th Floor, Beverly Hills, CA 90212', tags: ['management','prodco'] },
  { id: 'c-mgmt-360',     name: 'Management 360', type: 'management', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://mgmt360.com', hq: '9111 Wilshire Blvd, Beverly Hills, CA 90210', phone: '+1-310-272-7000', tags: ['management','prodco'] },
  { id: 'c-lbi',          name: 'LBI Entertainment', type: 'management', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://lbient.com', tags: ['management'] },
  { id: 'c-principal',    name: 'Principal Entertainment LA', type: 'management', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://principalentertainmentla.com', tags: ['management'] },
  { id: 'c-grandview',    name: 'Grandview', type: 'management', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://grandviewent.com', tags: ['management','literary','boutique'] },
  { id: 'c-madhouse',     name: 'Madhouse Entertainment', type: 'management', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://madhouseentertainment.com', tags: ['management','literary'] },
  { id: 'c-kaplan-perrone', name: 'Kaplan/Perrone Entertainment', type: 'management', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://kaplanperrone.com', tags: ['management'] },
  { id: 'c-underground',  name: 'Underground Management', type: 'management', city: 'Los Angeles', region: 'CA', country: 'US', tags: ['management'] },
  { id: 'c-haven',        name: 'Haven Entertainment', type: 'management', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://havenentertainment.com', tags: ['management'] },
  { id: 'c-gotham-group', name: 'Gotham Group', type: 'management', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://gotham-group.com', tags: ['management','ya','literary'] },
  { id: 'c-circle',       name: 'Circle of Confusion', type: 'management', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://circleofconfusion.com', tags: ['management','genre','comic-book'] },

  // ── 9. ENTERTAINMENT LAW FIRMS ────────────────────────────────────────
  { id: 'c-loeb',         name: 'Loeb & Loeb LLP', type: 'legal', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.loeb.com', hq: '10100 Santa Monica Blvd Suite 2200, Los Angeles, CA 90067', phone: '+1-310-282-2000', tags: ['transactional','top-tier'] },
  { id: 'c-greenberg-glusker', name: 'Greenberg Glusker', type: 'legal', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.greenbergglusker.com', hq: '2049 Century Park East Suite 2600, Los Angeles, CA 90067', phone: '+1-310-553-3610', tags: ['entertainment-law'] },
  { id: 'c-ziffren',      name: 'Ziffren Brittenham LLP', type: 'legal', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.ziffrenlaw.com', hq: '1801 Century Park West, Los Angeles, CA 90067', phone: '+1-310-552-3388', tags: ['entertainment-boutique','well-connected'] },
  { id: 'c-omm',          name: 'O\'Melveny & Myers (Entertainment)', type: 'legal', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.omm.com', hq: '400 S. Hope St, Los Angeles, CA 90071', tags: ['biglaw','entertainment-group'] },
  { id: 'c-fkks',         name: 'Frankfurt Kurnit Klein & Selz', type: 'legal', city: 'New York', region: 'NY', country: 'US', website: 'https://www.fkks.com', tags: ['indie-film','advertising-law'] },
  { id: 'c-hjth',         name: 'Hansen Jacobson Teller Hoberman (HJTH)', type: 'legal', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://hjth.com', hq: '450 N. Roxbury Dr, Beverly Hills, CA 90210', phone: '+1-310-271-8777', tags: ['boutique','writer-director-clients'] },
  { id: 'c-donaldson',    name: 'Donaldson + Callif', type: 'legal', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://donaldsoncallif.com', tags: ['entertainment-boutique'] },
  { id: 'c-jackoway',     name: 'Jackoway Tyerman', type: 'legal', city: 'Los Angeles', region: 'CA', country: 'US', hq: '1925 Century Park East 22nd Floor, Los Angeles, CA 90067', tags: ['elite','writer-director-clients'] },
  { id: 'c-pryor-cashman',name: 'Pryor Cashman LLP', type: 'legal', city: 'New York', region: 'NY', country: 'US', website: 'https://www.pryorcashman.com', tags: ['entertainment-finance'] },
  { id: 'c-sloss',        name: 'Sloss Eckhouse Dasti Haynes Brennan', type: 'legal', city: 'New York', region: 'NY', country: 'US', website: 'https://slosslaw.com', hq: '170 Fifth Ave 10th Fl, New York, NY 10010', phone: '+1-212-627-9898', tags: ['indie-legal'] },

  // ── 10. CASTING DIRECTORS / FIRMS ─────────────────────────────────────
  { id: 'c-csa-society',  name: 'Casting Society of America (CSA)', type: 'casting', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.castingsociety.com', tags: ['directory','guild'], scrape_paths: ['/members'] },
  { id: 'c-breakdown',    name: 'Breakdown Services', type: 'casting', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.breakdownexpress.com', tags: ['platform','submissions'] },
  { id: 'c-casting-networks', name: 'Casting Networks', type: 'casting', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.castingnetworks.com', tags: ['platform','commercial'] },

  // ── 11. PUBLICIST FIRMS ───────────────────────────────────────────────
  { id: 'c-lede',         name: 'PMK-BNC / The Lede Company', type: 'publicist', city: 'West Hollywood', region: 'CA', country: 'US', website: 'https://theledeco.com', hq: '8687 Melrose Ave Suite G730, West Hollywood, CA 90069', tags: ['talent-pr','a-list'] },
  { id: 'c-rogers-cowan', name: 'Rogers & Cowan PMK', type: 'publicist', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.rogersandcowanpmk.com', hq: '8687 Melrose Ave 8th Fl, Los Angeles, CA 90069', phone: '+1-310-854-8200', tags: ['talent-pr','corporate','legacy'] },
  { id: 'c-id-pr',        name: 'ID PR', type: 'publicist', city: 'West Hollywood', region: 'CA', country: 'US', website: 'https://id-pr.com', hq: '8409 Santa Monica Blvd, West Hollywood, CA 90069', phone: '+1-310-309-1000', tags: ['talent-pr','awards'], notes: 'Founder Kelly Bush Novak' },
  { id: 'c-42west',       name: '42West', type: 'publicist', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://42west.net', tags: ['awards','film-pr'] },
  { id: 'c-buchwald',     name: 'Buchwald', type: 'publicist', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.buchwald.com', tags: ['agency-pr-hybrid'] },
  { id: 'c-slate-pr',     name: 'Slate PR', type: 'publicist', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://slate-pr.com', tags: ['boutique','entertainment-pr'] },
  { id: 'c-tag-pr',       name: 'The Agency Group PR', type: 'publicist', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://tagpr.com', tags: ['entertainment-pr'] },
  { id: 'c-ssm',          name: 'Sunshine Sachs Morgan & Lylis', type: 'publicist', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.sunshinesachs.com', tags: ['entertainment-pr','social-impact'] },
  { id: 'c-bwr',          name: 'Baker Winokur Ryder (BWR)', type: 'publicist', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.bwr-pr.com', tags: ['talent-pr','corporate'] },
  { id: 'c-dda-group',    name: 'DDA Group', type: 'publicist', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://ddapr.com', hq: '6464 Sunset Blvd Suite 750, Los Angeles, CA 90028', phone: '+1-323-462-7777', tags: ['film-pr','festival','intl'] },
  { id: 'c-narrative-pr', name: 'Narrative PR', type: 'publicist', city: 'Beverly Hills', region: 'CA', country: 'US', website: 'https://narrativepr.com', hq: '8500 Wilshire Blvd Suite 1010, Beverly Hills, CA 90211', phone: '+1-323-848-7100', tags: ['talent-pr','digital'] },
  { id: 'c-falco-ink',    name: 'Falco Ink.', type: 'publicist', city: 'New York', region: 'NY', country: 'US', website: 'https://falcoink.com', hq: '850 Seventh Ave Suite 1005, New York, NY 10019', phone: '+1-212-445-7100', tags: ['indie-pr','festival'] },
  { id: 'c-cinetic-marketing', name: 'Cinetic Marketing', type: 'publicist', city: 'New York', region: 'NY', country: 'US', website: 'https://cineticmarketing.com', hq: '555 W 25th St, New York, NY 10001', phone: '+1-212-204-7979', tags: ['indie-pr','strategy'] },

  // ── 12. CINEMATOGRAPHERS / DPs ────────────────────────────────────────
  { id: 'c-asc',          name: 'American Society of Cinematographers (ASC)', type: 'guild', city: 'Hollywood', region: 'CA', country: 'US', website: 'https://www.theasc.com', tags: ['guild','dp-directory'], scrape_paths: ['/asc/members'] },

  // ── 13. POST-PRODUCTION HOUSES ────────────────────────────────────────
  { id: 'c-company-3',    name: 'Company 3', type: 'post-production', city: 'Hollywood', region: 'CA', country: 'US', website: 'https://www.company3.com', hq: '1133 N. Highland Ave, Hollywood, CA 90038', tags: ['color','vfx','top-tier'], notes: 'Stefan Sonnenfeld' },
  { id: 'c-technicolor',  name: 'Technicolor / MPC', type: 'post-production', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.technicolor.com', tags: ['vfx','color','legacy'] },
  { id: 'c-framestore',   name: 'Framestore', type: 'post-production', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.framestore.com', tags: ['vfx','high-end'], productions: ['Gravity','Guardians of the Galaxy'] },
  { id: 'c-wetafx',       name: 'Weta FX', type: 'post-production', city: 'Wellington', country: 'NZ', website: 'https://www.wetafx.co.nz', tags: ['vfx','top-tier'] },
  { id: 'c-digital-domain', name: 'Digital Domain', type: 'post-production', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.digitaldomain.com', tags: ['vfx','virtual-production'] },
  { id: 'c-method',       name: 'Method Studios', type: 'post-production', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.methodstudios.com', tags: ['vfx','production-services'] },
  { id: 'c-deluxe',       name: 'Deluxe Entertainment', type: 'post-production', city: 'Burbank', region: 'CA', country: 'US', website: 'https://www.bydeluxe.com', tags: ['post','distribution','localization'] },
  { id: 'c-efilm',        name: 'EFILM', type: 'post-production', city: 'Hollywood', region: 'CA', country: 'US', website: 'https://www.efilm.com', tags: ['color','deluxe-subsidiary'] },
  { id: 'c-fotokem',      name: 'FotoKem / Cinelab', type: 'post-production', city: 'Burbank', region: 'CA', country: 'US', website: 'https://www.fotokem.com', tags: ['film-processing','post','35mm'] },
  { id: 'c-formosa',      name: 'Formosa Group', type: 'post-production', city: 'West Hollywood', region: 'CA', country: 'US', website: 'https://www.formosagroup.com', tags: ['audio-post','mixing','adr'] },
  { id: 'c-chainsaw',     name: 'Chainsaw', type: 'post-production', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.chainsawedit.com', tags: ['editorial','finishing','boutique'] },

  // ── 14. MUSIC LICENSING & SUPERVISION ─────────────────────────────────
  { id: 'c-gms',          name: 'Guild of Music Supervisors (GMS)', type: 'guild', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.guildofmusicsupervisors.com', tags: ['guild','music'], scrape_paths: ['/members'] },
  { id: 'c-musicbed',     name: 'Musicbed', type: 'music-licensing', country: 'US', website: 'https://www.musicbed.com', tags: ['music','licensing'] },
  { id: 'c-artlist',      name: 'Artlist', type: 'music-licensing', country: 'IL', website: 'https://artlist.io', tags: ['music','licensing','royalty-free'] },
  { id: 'c-soundstripe',  name: 'Soundstripe', type: 'music-licensing', country: 'US', website: 'https://www.soundstripe.com', tags: ['music','licensing'] },
  { id: 'c-sony-pub',     name: 'Sony Music Publishing', type: 'music-publisher', country: 'US', website: 'https://www.sonymusicpub.com', tags: ['music','sync','publisher','major'] },
  { id: 'c-umpg',         name: 'Universal Music Publishing Group', type: 'music-publisher', country: 'US', website: 'https://www.umpg.com', tags: ['music','sync','publisher','major'] },
  { id: 'c-warner-chappell', name: 'Warner Chappell Music', type: 'music-publisher', country: 'US', website: 'https://www.warnerchappell.com', tags: ['music','sync','publisher','major'] },
  { id: 'c-bmg',          name: 'BMG Rights Management', type: 'music-publisher', country: 'DE', website: 'https://www.bmg.com', tags: ['music','sync','publisher'] },
  { id: 'c-concord',      name: 'Concord Music', type: 'music-publisher', country: 'US', website: 'https://www.concord.com', tags: ['music','sync','publisher'] },

  // ── 15. LOCATIONS / PERMITS / STUDIO LOTS ─────────────────────────────
  { id: 'c-filmla',       name: 'FilmLA (LA County/City Film Office)', type: 'permit', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.filmla.com', phone: '+1-213-977-8600', tags: ['permits','required'] },
  { id: 'c-cfc',          name: 'California Film Commission', type: 'permit', city: 'Hollywood', region: 'CA', country: 'US', website: 'https://film.ca.gov', phone: '+1-323-860-2960', tags: ['state-permits','tax-incentives'] },
  { id: 'c-raleigh',      name: 'Raleigh Studios Hollywood', type: 'studio-lot', city: 'Hollywood', region: 'CA', country: 'US', website: 'https://www.raleighstudios.com', phone: '+1-323-466-3111', tags: ['stage','lot'] },
  { id: 'c-sunset-gower', name: 'Sunset Gower Studios', type: 'studio-lot', city: 'Hollywood', region: 'CA', country: 'US', website: 'https://www.sunsetgowerstudios.com', tags: ['stage','lot'] },
  { id: 'c-sunset-bronson', name: 'Sunset Bronson Studios', type: 'studio-lot', city: 'Hollywood', region: 'CA', country: 'US', website: 'https://www.sunsetbronsonstudios.com', tags: ['stage','lot'] },
  { id: 'c-mbs',          name: 'Manhattan Beach Studios', type: 'studio-lot', city: 'Manhattan Beach', region: 'CA', country: 'US', website: 'https://manhattanbeachstudios.com', tags: ['stage','lot'] },
  { id: 'c-culver',       name: 'The Culver Studios', type: 'studio-lot', city: 'Culver City', region: 'CA', country: 'US', website: 'https://www.theculverstudios.com', tags: ['stage','lot','historic'] },

  // ── 16. GUILDS & UNIONS ───────────────────────────────────────────────
  { id: 'c-wga',          name: 'Writers Guild of America West (WGA)', type: 'guild', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.wga.org', phone: '+1-323-951-4000', tags: ['guild','writers'] },
  { id: 'c-dga',          name: 'Directors Guild of America (DGA)', type: 'guild', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.dga.org', phone: '+1-310-289-2000', tags: ['guild','directors'] },
  { id: 'c-sag',          name: 'SAG-AFTRA', type: 'guild', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.sagaftra.org', phone: '+1-323-954-1600', tags: ['guild','actors'] },
  { id: 'c-iatse',        name: 'IATSE (International Alliance of Theatrical Stage Employees)', type: 'guild', country: 'US', website: 'https://www.iatse.net', tags: ['guild','crew','below-the-line'] },
  { id: 'c-teamsters-399',name: 'Teamsters Local 399 (Transportation)', type: 'guild', city: 'North Hollywood', region: 'CA', country: 'US', website: 'https://www.teamsters399.org', tags: ['guild','transportation'] },
  { id: 'c-ibew-40',      name: 'IBEW Local 40 (Studio Electrical)', type: 'guild', country: 'US', website: 'https://www.ibewlocal40.org', tags: ['guild','electrical'] },
  { id: 'c-afm',          name: 'American Federation of Musicians (AFM)', type: 'guild', country: 'US', website: 'https://www.afm.org', tags: ['guild','musicians'] },
  { id: 'c-aicp',         name: 'AICP (Association of Independent Commercial Producers)', type: 'guild', country: 'US', website: 'https://www.aicp.com', tags: ['guild','commercial'], scrape_paths: ['/member'] },
  { id: 'c-pga',          name: 'Producers Guild of America (PGA)', type: 'guild', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.producersguild.org', tags: ['guild','producers'], scrape_paths: ['/page/producers_directory'] },

  // ── 17. INDUSTRY DIRECTORIES (data sources) ───────────────────────────
  { id: 'c-imdbpro',      name: 'IMDbPro', type: 'directory', country: 'US', website: 'https://pro.imdb.com', tags: ['directory','paid'] },
  { id: 'c-production-weekly', name: 'Production Weekly', type: 'directory', country: 'US', website: 'https://www.productionweekly.com', tags: ['directory','newsletter','paid'] },
  { id: 'c-the-numbers',  name: 'The Numbers', type: 'directory', country: 'US', website: 'https://www.the-numbers.com', tags: ['box-office','data'] },
  { id: 'c-box-office-mojo', name: 'Box Office Mojo', type: 'directory', country: 'US', website: 'https://www.boxofficemojo.com', tags: ['box-office','data'] },
  { id: 'c-shoot-online', name: 'Shoot Online', type: 'directory', country: 'US', website: 'https://www.shootonline.com', tags: ['commercial','directory'] },
  { id: 'c-mandy',        name: 'Mandy Network', type: 'directory', country: 'US', website: 'https://www.mandy.com', tags: ['crew-directory','below-the-line'] },
  { id: 'c-stage32',      name: 'Stage 32', type: 'directory', country: 'US', website: 'https://www.stage32.com', tags: ['networking'] },
  { id: 'c-film-independent', name: 'Film Independent', type: 'directory', city: 'Los Angeles', region: 'CA', country: 'US', website: 'https://www.filmindependent.org', tags: ['membership-org','labs'] },

  // ── 18. TRADE PUBLICATIONS (RSS sources) ──────────────────────────────
  { id: 'c-deadline',     name: 'Deadline Hollywood', type: 'trade', country: 'US', website: 'https://deadline.com', tags: ['trade','rss','exec-moves'] },
  { id: 'c-variety',      name: 'Variety', type: 'trade', country: 'US', website: 'https://variety.com', tags: ['trade','rss','deals'] },
  { id: 'c-thr',          name: 'The Hollywood Reporter (THR)', type: 'trade', country: 'US', website: 'https://www.hollywoodreporter.com', tags: ['trade','rss','awards'] },
  { id: 'c-thewrap',      name: 'TheWrap', type: 'trade', country: 'US', website: 'https://www.thewrap.com', tags: ['trade','rss'] },
  { id: 'c-indiewire',    name: 'IndieWire', type: 'trade', country: 'US', website: 'https://www.indiewire.com', tags: ['trade','rss','indie-coverage'] },
  { id: 'c-screen-daily', name: 'Screen Daily', type: 'trade', country: 'UK', website: 'https://www.screendaily.com', tags: ['trade','intl','festival-coverage'] },

  // ── 19. FESTIVALS / MARKETS ───────────────────────────────────────────
  { id: 'c-sundance',     name: 'Sundance Film Festival', type: 'festival', city: 'Park City', region: 'UT', country: 'US', website: 'https://www.sundance.org', tags: ['festival','indie','acquisitions'] },
  { id: 'c-cannes',       name: 'Cannes Film Festival / Marche du Film', type: 'festival', city: 'Cannes', country: 'FR', website: 'https://www.festival-cannes.com', tags: ['festival','market','prestige'] },
  { id: 'c-afm',          name: 'American Film Market (AFM)', type: 'market', city: 'Santa Monica', region: 'CA', country: 'US', website: 'https://americanfilmmarket.com', tags: ['market','financing','distribution'] },
  { id: 'c-sxsw',         name: 'SXSW (South by Southwest)', type: 'festival', city: 'Austin', region: 'TX', country: 'US', website: 'https://www.sxsw.com', tags: ['festival','emerging','branded-content'] },
  { id: 'c-tiff',         name: 'Toronto International Film Festival (TIFF)', type: 'festival', city: 'Toronto', country: 'CA', website: 'https://www.tiff.net', tags: ['festival','oscar-launchpad'] },
  { id: 'c-tribeca',      name: 'Tribeca Festival', type: 'festival', city: 'New York', region: 'NY', country: 'US', website: 'https://tribecafilm.com', tags: ['festival','indie','branded'] },
];

// Public front-desk / publicly-listed press contacts only.
// Specific buyer/agent/exec names harvested from corporate "Leadership/Team"
// pages get added by the deep-website-scraper into the same store.
const PEOPLE = [
  { id: 'p-a24-info',       name: 'A24 General Inquiries',     title: 'General Contact',  company: 'A24',                  company_id: 'c-a24',         dept: 'general',  email: 'info@a24films.com' },
  { id: 'p-a24-press',      name: 'A24 Press',                 title: 'Press Inquiries',  company: 'A24',                  company_id: 'c-a24',         dept: 'press',    email: 'press@a24films.com' },
  { id: 'p-blumhouse-info', name: 'Blumhouse Submissions',     title: 'Submissions',      company: 'Blumhouse Productions',company_id: 'c-blumhouse',   dept: 'dev',      notes: 'Submissions accepted only via signatory agencies/managers/lawyers.' },
  { id: 'p-cinetic-info',   name: 'Cinetic Media',             title: 'Sales / Strategy', company: 'Cinetic Media',        company_id: 'c-cinetic',     dept: 'sales',    email: 'info@cineticmedia.com' },
  { id: 'p-filmnation-info',name: 'FilmNation Sales',          title: 'Intl. Sales',      company: 'FilmNation Entertainment', company_id: 'c-filmnation', dept: 'sales', email: 'info@filmnation.com' },
  { id: 'p-id-pr-info',     name: 'ID PR Press Desk',          title: 'Press Desk',       company: 'ID PR',                company_id: 'c-id-pr',       dept: 'press',    email: 'info@id-pr.com' },
  { id: 'p-falco-info',     name: 'Falco Ink Press Desk',      title: 'Press Desk',       company: 'Falco Ink.',           company_id: 'c-falco-ink',   dept: 'press',    email: 'info@falcoink.com' },
  { id: 'p-dda-info',       name: 'DDA Group Press Desk',      title: 'Press Desk',       company: 'DDA Group',            company_id: 'c-dda-group',   dept: 'press',    email: 'info@ddapr.com' },
  // Notable casting directors from master file (pinned anchors for crawler)
  { id: 'p-allison-jones',  name: 'Allison Jones',             title: 'Casting Director', company: 'Allison Jones Casting',dept: 'casting',  notes: 'Freaks and Geeks, Knocked Up, Get Out', tags: ['casting','la'] },
  { id: 'p-francine-maisler',name: 'Francine Maisler',         title: 'Casting Director', company: 'Francine Maisler Casting', dept: 'casting', notes: 'Knives Out, Marriage Story, Argo', tags: ['casting','la'] },
  { id: 'p-alexa-fogel',    name: 'Alexa L. Fogel',            title: 'Casting Director', company: 'Alexa L. Fogel Casting', dept: 'casting', notes: 'The Wire, Boardwalk Empire', tags: ['casting'] },
  { id: 'p-avy-kaufman',    name: 'Avy Kaufman',               title: 'Casting Director', company: 'Avy Kaufman Casting', dept: 'casting',  notes: 'Brokeback Mountain, The Sixth Sense', tags: ['casting'] },
  { id: 'p-randi-hiller',   name: 'Randi Hiller',              title: 'Casting Director', company: 'Randi Hiller Casting',dept: 'casting',  notes: 'Crazy Rich Asians, La La Land', tags: ['casting','la'] },
  { id: 'p-laray-mayfield', name: 'Laray Mayfield',            title: 'Casting Director', company: 'Laray Mayfield Casting', dept: 'casting', notes: 'Alien franchise, Fight Club', tags: ['casting','la'] },
  { id: 'p-sarah-finn',     name: 'Sarah Halley Finn',         title: 'Casting Director', company: 'Sarah Halley Finn Casting', dept: 'casting', notes: 'MCU - Iron Man, Avengers, Captain Marvel', tags: ['casting','la','mcu'] },
  { id: 'p-richard-hicks',  name: 'Richard Hicks',             title: 'Casting Director', company: 'Richard Hicks Casting',dept: 'casting',  notes: 'Euphoria, Assassination of Gianni Versace', tags: ['casting'] },
  // Notable DPs
  { id: 'p-roger-deakins',  name: 'Roger Deakins',             title: 'Cinematographer',  dept: 'production', notes: 'CAA - Blade Runner 2049, 1917', tags: ['dp','asc'] },
  { id: 'p-emmanuel-lubezki',name: 'Emmanuel "Chivo" Lubezki', title: 'Cinematographer',  dept: 'production', notes: 'The Revenant, Gravity, Children of Men', tags: ['dp','asc'] },
  { id: 'p-hoyte-van-hoytema', name: 'Hoyte van Hoytema',      title: 'Cinematographer',  dept: 'production', notes: 'Oppenheimer, Dunkirk, Interstellar', tags: ['dp','asc'] },
  { id: 'p-rodrigo-prieto', name: 'Rodrigo Prieto',            title: 'Cinematographer',  dept: 'production', notes: 'Barbie, The Irishman, Brokeback Mountain', tags: ['dp','asc'] },
  { id: 'p-robert-richardson',name: 'Robert Richardson',       title: 'Cinematographer',  dept: 'production', notes: 'Kill Bill, Hateful Eight, Inglourious Basterds', tags: ['dp','asc'] },
  { id: 'p-linus-sandgren', name: 'Linus Sandgren',            title: 'Cinematographer',  dept: 'production', notes: 'La La Land, No Time to Die, First Man', tags: ['dp','asc'] },
  { id: 'p-mandy-walker',   name: 'Mandy Walker',              title: 'Cinematographer',  dept: 'production', notes: 'Elvis, Mulan', tags: ['dp','asc'] },
  // Notable music supervisors
  { id: 'p-alexandra-patsavas',name: 'Alexandra Patsavas',     title: 'Music Supervisor', company: 'Chop Shop Music', dept: 'music', notes: "Grey's Anatomy, Twilight", tags: ['music-sup'] },
  { id: 'p-randall-poster', name: 'Randall Poster',            title: 'Music Supervisor', company: 'West Village Music', dept: 'music', notes: 'Wes Anderson films', tags: ['music-sup'] },
  { id: 'p-julia-michels',  name: 'Julia Michels',             title: 'Music Supervisor', dept: 'music', notes: 'Pitch Perfect, My Big Fat Greek Wedding', tags: ['music-sup'] },
];

module.exports = { COMPANIES, PEOPLE };
