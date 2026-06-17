// /seo-aeo-geo  -  Search everywhere: SEO + AEO + GEO capability page.
// Returns content HTML; the site master nav/footer are injected by _middleware.

const STYLE = `<style>
.pg{--navy:#0A0F2C;--navy2:#0E1438;--gold:#C9A84C;--ink:#f5f7fc;--muted:#A1A1AA;--line:rgba(255,255,255,.09);
font-family:-apple-system,BlinkMacSystemFont,'Outfit','Segoe UI',Roboto,Arial,sans-serif;background:var(--navy);color:var(--ink)}
.pg .wrap{max-width:1040px;margin:0 auto;padding:0 24px}
.pg .hero{padding:72px 24px 56px;text-align:center;background:radial-gradient(120% 80% at 50% 0%,#16204e 0%,var(--navy) 60%)}
.pg .kick{font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);font-weight:800}
.pg h1{font-size:clamp(2rem,5vw,3.1rem);font-weight:800;margin:16px auto 14px;max-width:18ch;line-height:1.1}
.pg .lead{font-size:1.15rem;color:var(--muted);max-width:60ch;margin:0 auto 28px;line-height:1.6}
.pg .btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.pg .btn{padding:14px 26px;border-radius:10px;font-weight:700;text-decoration:none;font-size:1rem}
.pg .btn.gold{background:var(--gold);color:#1a1505}
.pg .btn.ghost{border:1px solid var(--line);color:var(--ink)}
.pg section{padding:54px 0;border-top:1px solid var(--line)}
.pg h2{font-size:clamp(1.5rem,3.5vw,2.1rem);font-weight:800;margin:0 0 10px}
.pg h2 .g{color:var(--gold)}
.pg p{line-height:1.7;color:#cdd2e4;margin:0 0 14px;font-size:1.04rem}
.pg .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:26px}
.pg .card{background:var(--navy2);border:1px solid var(--line);border-radius:16px;padding:26px}
.pg .card h3{font-size:1.2rem;margin:0 0 8px;color:#fff}
.pg .card .tag{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:800;margin-bottom:10px}
.pg .card p{font-size:.97rem;margin:0}
.pg .faq{max-width:780px}
.pg .faq details{border-bottom:1px solid var(--line);padding:16px 0}
.pg .faq summary{font-weight:700;font-size:1.08rem;cursor:pointer;color:#fff;list-style:none}
.pg .faq summary::-webkit-details-marker{display:none}
.pg .faq details p{margin:12px 0 0}
.pg .cta{text-align:center;background:linear-gradient(180deg,var(--navy2),var(--navy));border-radius:20px;padding:48px 24px;margin:54px 0}
@media(max-width:760px){.pg .grid{grid-template-columns:1fr}}
</style>`;

const FAQ = [
  ['What is the difference between SEO, AEO, and GEO?',
   'SEO (search engine optimization) is about ranking in traditional Google and Bing results. AEO (answer engine optimization) is about being the cited answer in AI assistants like ChatGPT, Perplexity, and Claude. GEO (generative engine optimization) is about appearing inside AI-generated overviews such as Google AI Overviews. They overlap, but each rewards different signals, so a modern strategy has to win all three at once.'],
  ['Why do I need AEO and GEO if I already do SEO?',
   'Search is splitting into two front ends. People still type queries into Google, but a fast-growing share now ask an AI assistant and never see a list of blue links. If your content is not structured to be quoted and cited by those models, you are invisible to that audience even when your SEO is strong.'],
  ['How do you get a brand cited by ChatGPT or Perplexity?',
   'AI engines cite sources they can extract cleanly and trust. That means definition-led writing, quotable factual passages, statistics with sources, FAQ and schema markup, a clear entity for the brand, and corroboration from third-party sites. We build all of that into the content and the site structure.'],
  ['How long does it take to see results?',
   'Technical and on-page fixes can move AI Overview and answer-engine visibility in weeks because those systems re-crawl quickly. Traditional ranking gains compound over a few months. The off-site authority work that lifts both runs in parallel.'],
];

function html() {
  const faqHtml = FAQ.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('');
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SEO, AEO & GEO - Get Found on Google AND AI Search | MarkCMO</title>
<meta name="description" content="SEO ranks you on Google. AEO gets you cited by ChatGPT and Perplexity. GEO puts you inside AI Overviews. Mark Gabrielli builds the strategy that wins all three.">
<link rel="canonical" href="https://markcmo.com/seo-aeo-geo">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:title" content="SEO, AEO & GEO - Get Found on Google AND AI Search">
<meta property="og:description" content="Win traditional search and AI search at the same time.">
<meta property="og:image" content="https://markcmo.com/og-seo-aeo-geo.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://markcmo.com/og-seo-aeo-geo.png">
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://markcmo.com/"},{"@type":"ListItem","position":2,"name":"SEO, AEO & GEO","item":"https://markcmo.com/seo-aeo-geo"}]},{"@type":"Service","name":"Search Optimization (SEO, AEO, GEO)","serviceType":"Search Engine Optimization","areaServed":{"@type":"Country","name":"United States"},"provider":{"@type":"Person","name":"Mark Gabrielli","url":"https://markcmo.com","jobTitle":"Fractional CMO & COO","sameAs":["https://www.linkedin.com/in/marklgabrielli/","https://x.com/markgcmo"]},"url":"https://markcmo.com/seo-aeo-geo"}]}</script>
${STYLE}</head>
<body>
<div class="pg">
  <div class="hero">
    <div class="kick">Search Everywhere</div>
    <h1>Get found on Google <span style="color:var(--gold)">and</span> in AI search</h1>
    <p class="lead">Buyers no longer just Google you. They ask ChatGPT, Perplexity, and Google's AI Overview. Winning today means three disciplines at once: <strong>SEO</strong>, <strong>AEO</strong>, and <strong>GEO</strong>. I build the system that wins all three.</p>
    <div class="btns"><a class="btn gold" href="/book">Book a Free Strategy Call</a><a class="btn ghost" href="/card">My Card</a></div>
  </div>
  <div class="wrap">
    <section>
      <h2>Three disciplines, <span class="g">one system</span></h2>
      <div class="grid">
        <div class="card"><div class="tag">SEO</div><h3>Search Engine Optimization</h3><p>Rank in classic Google and Bing results. Technical health, topical authority, on-page structure, and the off-site authority that actually moves competitive terms.</p></div>
        <div class="card"><div class="tag">AEO</div><h3>Answer Engine Optimization</h3><p>Become the source ChatGPT, Perplexity, and Claude quote when a buyer asks about your category. Definition-led, quotable, schema-rich, entity-clear content.</p></div>
        <div class="card"><div class="tag">GEO</div><h3>Generative Engine Optimization</h3><p>Appear inside Google AI Overviews and generative answers. The formatting, statistics, and structured data that get a brand pulled into the AI's response.</p></div>
      </div>
    </section>
    <section>
      <h2>Why this matters <span class="g">now</span></h2>
      <p>Search is splitting into two front ends. A large and growing share of buyers ask an AI assistant and never scroll a page of links. If your content is not built to be cited by those models, you are invisible to that audience even when your traditional rankings are strong.</p>
      <p>The reverse is also true: chasing AI visibility while ignoring core SEO leaves the highest-intent commercial searches on the table. The two are not separate projects. They are one system, and they share the same foundation: clean technical structure, genuinely useful content, a clear brand entity, and real third-party authority.</p>
    </section>
    <section>
      <h2>How I <span class="g">build it</span></h2>
      <p><strong>Technical and structural foundation</strong> - crawlability, schema, sitemaps, Core Web Vitals, and AI-crawler access so every engine can read and trust the site.</p>
      <p><strong>Content engineered for citation</strong> - answer-first writing, statistical anchors, comparison and FAQ pages, and entity clarity so the content is quotable by both Google and the LLMs.</p>
      <p><strong>Off-site authority</strong> - the citations, mentions, and entity signals that decide who wins the competitive terms in both classic search and AI answers.</p>
      <p><strong>Measurement</strong> - tracking rankings, AI Overview presence, and answer-engine citations together, not in silos.</p>
    </section>
    <section class="faq">
      <h2>Common <span class="g">questions</span></h2>
      ${faqHtml}
    </section>
    <div class="cta">
      <h2>Own the answer, not just the ranking</h2>
      <p style="max-width:52ch;margin:0 auto 22px">Let's map where you show up across Google and AI search today, and the fastest path to the top of both.</p>
      <a class="btn gold" href="/book">Book a Free Strategy Call</a>
    </div>
  </div>
</div>
</body></html>`;
}

export async function onRequest() {
  return new Response(html(), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
