// /ai-agents  -  AI & agents done right: the good, the bad, and owning your AI.
// Returns content HTML; site master nav/footer injected by _middleware.

const STYLE = `<style>
.pg{--navy:#0A0F2C;--navy2:#0E1438;--gold:#C9A84C;--ink:#f5f7fc;--muted:#A1A1AA;--line:rgba(255,255,255,.09);--green:#5fe39b;--red:#ff8a8a;
font-family:-apple-system,BlinkMacSystemFont,'Outfit','Segoe UI',Roboto,Arial,sans-serif;background:var(--navy);color:var(--ink)}
.pg .wrap{max-width:1040px;margin:0 auto;padding:0 24px}
.pg .hero{padding:72px 24px 56px;text-align:center;background:radial-gradient(120% 80% at 50% 0%,#16204e 0%,var(--navy) 60%)}
.pg .kick{font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);font-weight:800}
.pg h1{font-size:clamp(2rem,5vw,3.1rem);font-weight:800;margin:16px auto 14px;max-width:20ch;line-height:1.1}
.pg .lead{font-size:1.15rem;color:var(--muted);max-width:62ch;margin:0 auto 28px;line-height:1.6}
.pg .btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.pg .btn{padding:14px 26px;border-radius:10px;font-weight:700;text-decoration:none;font-size:1rem}
.pg .btn.gold{background:var(--gold);color:#1a1505}.pg .btn.ghost{border:1px solid var(--line);color:var(--ink)}
.pg section{padding:54px 0;border-top:1px solid var(--line)}
.pg h2{font-size:clamp(1.5rem,3.5vw,2.1rem);font-weight:800;margin:0 0 10px}.pg h2 .g{color:var(--gold)}
.pg p{line-height:1.7;color:#cdd2e4;margin:0 0 14px;font-size:1.04rem}
.pg .cols{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px}
.pg .col{background:var(--navy2);border:1px solid var(--line);border-radius:16px;padding:26px}
.pg .col h3{margin:0 0 14px;font-size:1.25rem}
.pg .col.good h3{color:var(--green)}.pg .col.bad h3{color:var(--red)}
.pg .col ul{margin:0;padding-left:18px}.pg .col li{margin:0 0 10px;line-height:1.55;color:#cdd2e4}
.pg .own{background:linear-gradient(180deg,var(--navy2),var(--navy));border:1px solid var(--line);border-radius:18px;padding:30px;margin-top:24px}
.pg .own .row{display:flex;gap:16px;align-items:flex-start;margin:0 0 16px}
.pg .own .num{flex:0 0 34px;height:34px;border-radius:9px;background:#13183a;border:1px solid var(--gold);color:var(--gold);font-weight:900;display:flex;align-items:center;justify-content:center}
.pg .own .row p{margin:0}
.pg .cta{text-align:center;background:linear-gradient(180deg,var(--navy2),var(--navy));border-radius:20px;padding:48px 24px;margin:54px 0}
@media(max-width:760px){.pg .cols{grid-template-columns:1fr}}
</style>`;

function html() {
  const faq = [
    ['Is AI good or bad for my business?',
     'Both, depending on how you use it. Used as a rented black box it creates dependency, recurring cost, and risk you do not control. Used as owned infrastructure - systems you build and run inside your company - it compounds into a durable, sellable asset. The technology is the same; the ownership model decides the outcome.'],
    ['What does it mean to "own your AI"?',
     'It means the logic, workflows, and automation live inside systems your company owns, rather than scattered across third-party SaaS subscriptions. You hold the intellectual property, you control the data, and you are not paying a monthly toll on your own operations.'],
    ['Do AI agents replace my team?',
     'No. Done right, agents remove the repetitive, low-judgment work so your people do higher-value work. The goal is leverage and documented process, not headcount theater.'],
  ];
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI & Agents Done Right - Own Your AI, Don't Rent It | MarkCMO</title>
<meta name="description" content="AI and agents, the good and the bad. Build internal systems your company owns instead of renting third-party software - growing enterprise value and cutting recurring cost.">
<link rel="canonical" href="https://markcmo.com/ai-agents">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:title" content="AI & Agents Done Right - Own Your AI, Don't Rent It">
<meta property="og:description" content="The same AI is an asset when you own it and a liability when you rent it.">
<meta property="og:image" content="https://markcmo.com/assets/mark-gabrielli.jpg">
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://markcmo.com/"},{"@type":"ListItem","position":2,"name":"AI & Agents","item":"https://markcmo.com/ai-agents"}]},{"@type":"Service","name":"AI & Automation Systems","serviceType":"AI Consulting","areaServed":{"@type":"Country","name":"United States"},"provider":{"@type":"Person","name":"Mark Gabrielli","url":"https://markcmo.com","jobTitle":"Fractional CMO & COO","sameAs":["https://www.linkedin.com/in/marklgabrielli/","https://x.com/markgcmo"]},"url":"https://markcmo.com/ai-agents"}]}</script>
${STYLE}</head>
<body>
<div class="pg">
  <div class="hero">
    <div class="kick">AI & Agents</div>
    <h1>The same AI is an asset when you own it - a liability when you rent it</h1>
    <p class="lead">Everyone is bolting on AI. Most are renting black boxes that add cost, dependency, and risk. I build AI and agent systems your company <strong>owns</strong> - so it becomes intellectual property on your balance sheet, not another monthly bill.</p>
    <div class="btns"><a class="btn gold" href="/book">Book a Free Strategy Call</a><a class="btn ghost" href="/systems">See How I Build</a></div>
  </div>
  <div class="wrap">
    <section>
      <h2>The good and the <span class="g">bad</span></h2>
      <p>AI is not the question. How you deploy it is. The same capability cuts in opposite directions depending on whether you rent it or own it.</p>
      <div class="cols">
        <div class="col good"><h3>The good</h3><ul>
          <li>Removes repetitive, low-judgment work so your team does higher-value work.</li>
          <li>Encodes your best people's process into systems that run 24/7.</li>
          <li>Compounds into owned intellectual property that raises enterprise value.</li>
          <li>Cuts the cost of work that used to require headcount or agencies.</li>
        </ul></div>
        <div class="col bad"><h3>The bad</h3><ul>
          <li>Rented black boxes create dependency you do not control and cannot sell.</li>
          <li>Recurring per-seat SaaS fees quietly compound into a major operating expense.</li>
          <li>Your data and workflows live on someone else's platform and pricing.</li>
          <li>"AI theater" - tools that demo well, change nothing, and add a bill.</li>
        </ul></div>
      </div>
    </section>
    <section>
      <h2>Build it internally. <span class="g">Own the IP.</span></h2>
      <p>My approach is to build the AI and automation <strong>inside your company</strong> - owned systems instead of a stack of third-party subscriptions. The difference shows up in two places that matter to any owner: <strong>enterprise value</strong> and <strong>expenses</strong>.</p>
      <div class="own">
        <div class="row"><div class="num">1</div><p><strong>You own the intellectual property.</strong> The workflows, agents, and logic are assets your company holds - they show up in a valuation and transfer in a sale. Rented tools do not.</p></div>
        <div class="row"><div class="num">2</div><p><strong>You cut recurring expense.</strong> Replacing a stack of per-seat SaaS tools with owned systems removes the monthly toll on your own operations.</p></div>
        <div class="row"><div class="num">3</div><p><strong>You control the data.</strong> Your customer data, process, and edge stay inside the business instead of training someone else's platform.</p></div>
        <div class="row"><div class="num">4</div><p><strong>It is documented.</strong> Owned systems come with the SOPs that make them repeatable, hand-off-able, and durable beyond any one person.</p></div>
      </div>
    </section>
    <section>
      <h2>I don't just advise. <span class="g">I build.</span></h2>
      <p>Plenty of consultants will hand you a deck about AI. I build the working systems - the agents, automations, and internal tooling - and the SOPs that run them. The result is leverage you own, not a strategy you still have to go execute.</p>
    </section>
    <div class="cta">
      <h2>Turn AI from a bill into an asset</h2>
      <p style="max-width:54ch;margin:0 auto 22px">Let's look at where you are renting software you could own, and what owning it would do for your value and your costs.</p>
      <a class="btn gold" href="/book">Book a Free Strategy Call</a>
    </div>
  </div>
</div>
</body></html>`;
}

export async function onRequest() {
  return new Response(html(), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
