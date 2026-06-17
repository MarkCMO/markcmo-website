// /systems  -  "I don't just advise. I build." Enterprise systems startup to exit.
// Returns content HTML; site master nav/footer injected by _middleware.

const STYLE = `<style>
.pg{--navy:#0A0F2C;--navy2:#0E1438;--gold:#C9A84C;--ink:#f5f7fc;--muted:#A1A1AA;--line:rgba(255,255,255,.09);
font-family:-apple-system,BlinkMacSystemFont,'Outfit','Segoe UI',Roboto,Arial,sans-serif;background:var(--navy);color:var(--ink)}
.pg .wrap{max-width:1040px;margin:0 auto;padding:0 24px}
.pg .hero{padding:74px 24px 56px;text-align:center;background:radial-gradient(120% 80% at 50% 0%,#16204e 0%,var(--navy) 60%)}
.pg .kick{font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);font-weight:800}
.pg h1{font-size:clamp(2.1rem,5.5vw,3.4rem);font-weight:800;margin:16px auto 14px;max-width:18ch;line-height:1.08}
.pg h1 .g{color:var(--gold)}
.pg .lead{font-size:1.15rem;color:var(--muted);max-width:60ch;margin:0 auto 28px;line-height:1.6}
.pg .btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.pg .btn{padding:14px 26px;border-radius:10px;font-weight:700;text-decoration:none;font-size:1rem}
.pg .btn.gold{background:var(--gold);color:#1a1505}.pg .btn.ghost{border:1px solid var(--line);color:var(--ink)}
.pg section{padding:54px 0;border-top:1px solid var(--line)}
.pg h2{font-size:clamp(1.5rem,3.5vw,2.1rem);font-weight:800;margin:0 0 10px}.pg h2 .g{color:var(--gold)}
.pg p{line-height:1.7;color:#cdd2e4;margin:0 0 14px;font-size:1.04rem}
.pg .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:24px}
.pg .card{background:var(--navy2);border:1px solid var(--line);border-radius:16px;padding:26px}
.pg .card h3{font-size:1.18rem;margin:0 0 8px;color:#fff}.pg .card p{font-size:.98rem;margin:0}
.pg .stage{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:24px}
.pg .stage .s{background:var(--navy2);border:1px solid var(--line);border-radius:14px;padding:20px;text-align:center}
.pg .stage .s .n{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:800}
.pg .stage .s h4{margin:8px 0 6px;font-size:1.05rem}.pg .stage .s p{font-size:.9rem;margin:0;color:var(--muted)}
.pg .cta{text-align:center;background:linear-gradient(180deg,var(--navy2),var(--navy));border-radius:20px;padding:48px 24px;margin:54px 0}
@media(max-width:760px){.pg .grid{grid-template-columns:1fr}.pg .stage{grid-template-columns:1fr 1fr}}
</style>`;

function html() {
  const faq = [
    ['What does "I build, not just advise" mean?',
     'Most consultants deliver a strategy and leave you to execute it. I build the actual systems - the marketing engine, the automations and AI agents, the operating processes - and the SOPs that run them, then stay until they work. You end up with owned infrastructure, not a document.'],
    ['What kind of systems do you build?',
     'Go-to-market and demand generation engines, marketing and revenue operations, internal AI and automation, reporting and dashboards, and the documented SOPs that make all of it repeatable. Built in-house so the company owns the IP.'],
    ['How does this increase enterprise value?',
     'Buyers pay for businesses that run on systems, not on a founder. Documented, owned, transferable systems and SOPs reduce key-person risk and recurring cost, which directly raises the multiple a company sells for.'],
    ['Do you work from startup all the way to exit?',
     'Yes. From early-stage foundation-building through scaling, to preparing the operational and marketing systems that make a company clean, valuable, and sellable at exit.'],
  ];
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>I Don't Just Advise, I Build - Enterprise Systems from Startup to Exit | MarkCMO</title>
<meta name="description" content="Mark Gabrielli builds enterprise systems and internal SOPs from startup to exit - owned infrastructure that increases company value and cuts cost, not just a strategy deck.">
<link rel="canonical" href="https://markcmo.com/systems">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:title" content="I Don't Just Advise, I Build - Enterprise Systems from Startup to Exit">
<meta property="og:description" content="Owned systems and SOPs that raise enterprise value, from startup to exit.">
<meta property="og:image" content="https://markcmo.com/assets/mark-gabrielli.jpg">
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
${STYLE}</head>
<body>
<div class="pg">
  <div class="hero">
    <div class="kick">Build, Don't Just Advise</div>
    <h1>I don't just advise. <span class="g">I build.</span></h1>
    <p class="lead">I build enterprise systems from startup to exit - owned infrastructure and documented SOPs that grow the value of the company and cut its costs. Not a strategy deck you still have to go execute. The working system, and the process that runs it.</p>
    <div class="btns"><a class="btn gold" href="/book">Book a Free Strategy Call</a><a class="btn ghost" href="/ai-agents">Own Your AI</a></div>
  </div>
  <div class="wrap">
    <section>
      <h2>Advice ends in a deck. <span class="g">I end in a system.</span></h2>
      <p>A strategy you cannot execute is a cost, not an asset. I operate inside the business as a fractional CMO and COO and build the things that actually run it: the marketing engine, the revenue operations, the AI and automation, and the SOPs that make all of it repeatable without me.</p>
      <p>Everything is built to be <strong>owned</strong>. The company holds the intellectual property, the processes are documented, and the result is infrastructure that keeps producing after the engagement ends.</p>
    </section>
    <section>
      <h2>What I <span class="g">build</span></h2>
      <div class="grid">
        <div class="card"><h3>Go-to-market & demand engine</h3><p>Positioning, ICP, messaging, and a demand-generation system that produces pipeline on repeat - not one-off campaigns.</p></div>
        <div class="card"><h3>Marketing & revenue operations</h3><p>The tooling, tracking, and workflow that turn marketing into a measurable revenue function instead of a cost center.</p></div>
        <div class="card"><h3>Internal AI & automation</h3><p>Owned agents and automations that remove repetitive work and lower cost - built in-house so you own the IP, not a SaaS bill. <a style="color:var(--gold)" href="/ai-agents">More on owning your AI</a>.</p></div>
        <div class="card"><h3>SOPs & operating system</h3><p>Documented standard operating procedures so the business runs on process, reduces key-person risk, and is ready to hand off or sell.</p></div>
      </div>
    </section>
    <section>
      <h2>From <span class="g">startup to exit</span></h2>
      <div class="stage">
        <div class="s"><div class="n">Startup</div><h4>Foundation</h4><p>Positioning, first systems, the right operating habits from day one.</p></div>
        <div class="s"><div class="n">Growth</div><h4>Scale</h4><p>Demand engine, RevOps, and automation that scale without scaling headcount linearly.</p></div>
        <div class="s"><div class="n">Maturity</div><h4>Systemize</h4><p>SOPs and owned infrastructure that take the founder out of the critical path.</p></div>
        <div class="s"><div class="n">Exit</div><h4>Value</h4><p>Clean, documented, transferable systems that raise the multiple at sale.</p></div>
      </div>
    </section>
    <section>
      <h2>Why owned systems <span class="g">raise value</span></h2>
      <p>Acquirers and investors pay for businesses that run on systems, not on a person. Owned, documented infrastructure does three things to a valuation at once: it <strong>reduces key-person risk</strong>, it <strong>cuts recurring expense</strong> by replacing rented software, and it creates <strong>transferable intellectual property</strong> the buyer is actually purchasing. That is the difference between selling a job and selling a company.</p>
    </section>
    <div class="cta">
      <h2>Build the system. Own the value.</h2>
      <p style="max-width:52ch;margin:0 auto 22px">Tell me where the business is - startup, scaling, or heading toward exit - and I'll show you the systems worth building first.</p>
      <a class="btn gold" href="/book">Book a Free Strategy Call</a>
    </div>
  </div>
</div>
</body></html>`;
}

export async function onRequest() {
  return new Response(html(), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
