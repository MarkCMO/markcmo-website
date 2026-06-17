// /card  -  Mark Gabrielli digital business card + one-tap vCard.
// Self-contained Pages Function (no KV, no chrome injection). Serves a
// mobile-first card at /card, and the downloadable vCard at /card?download=vcf
// (text/vcard so iOS opens the "Add to Contacts" sheet on tap).

const C = {
  name: 'Mark Gabrielli',
  first: 'Mark', last: 'Gabrielli',
  title: 'Fractional CMO & COO',
  org: 'WETYR Corp',
  brand: 'MarkCMO',
  tel: '+13219175738',
  telDisplay: '(321) 917-5738',
  email: 'mark@markcmo.com',
  site: 'https://markcmo.com',
  book: 'https://markcmo.com/book',
  linkedin: 'https://www.linkedin.com/in/marklgabrielli/',
  x: 'https://x.com/markgcmo',
  photo: 'https://markcmo.com/assets/mark-gabrielli.jpg',
  tagline: 'Senior marketing leadership for SaaS, healthcare, aerospace & B2B - without the full-time cost.',
};

function vcard() {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${C.last};${C.first};;;`,
    `FN:${C.name}`,
    `ORG:${C.org};${C.brand}`,
    `TITLE:${C.title}`,
    `TEL;TYPE=CELL,VOICE:${C.tel}`,
    `EMAIL;TYPE=WORK:${C.email}`,
    `URL:${C.site}`,
    `URL;TYPE=Book a call:${C.book}`,
    `X-SOCIALPROFILE;TYPE=linkedin:${C.linkedin}`,
    `X-SOCIALPROFILE;TYPE=twitter:${C.x}`,
    'END:VCARD',
  ].join('\r\n');
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.searchParams.get('download') === 'vcf') {
    return new Response(vcard(), {
      headers: {
        'Content-Type': 'text/vcard; charset=utf-8',
        'Content-Disposition': 'attachment; filename="Mark-Gabrielli.vcf"',
        'Cache-Control': 'no-store',
      },
    });
  }
  return new Response(html(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

function html() {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Mark Gabrielli - Fractional CMO & COO | MarkCMO</title>
<meta name="description" content="${C.name}, ${C.title}. ${C.tagline}">
<meta name="robots" content="index,follow">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="Mark Gabrielli - Fractional CMO & COO">
<meta property="og:description" content="${C.tagline}">
<meta property="og:image" content="${C.photo}">
<meta property="og:url" content="${C.site}/card">
<style>
:root{--navy:#0A0F2C;--navy2:#13183a;--gold:#C9A84C;--goldlt:#DFC06D;--ink:#f5f7fc;--muted:#9aa3c0;--line:#222a52}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
background:radial-gradient(120% 60% at 50% 0%,#16204e 0%,var(--navy) 55%,#05060f 100%);
color:var(--ink);min-height:100vh;min-height:100dvh;display:flex;justify-content:center;
padding:max(28px,env(safe-area-inset-top)) 18px max(28px,env(safe-area-inset-bottom))}
.wrap{width:100%;max-width:430px;display:flex;flex-direction:column;align-items:center}
.kick{font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);font-weight:800;margin-bottom:22px}
.photo{width:150px;height:150px;border-radius:50%;object-fit:cover;object-position:50% 22%;
border:3px solid var(--gold);box-shadow:0 12px 40px rgba(0,0,0,.45)}
h1{font-size:30px;font-weight:800;margin:20px 0 4px;text-align:center}
.title{color:var(--gold);font-weight:700;font-size:16px;letter-spacing:.02em}
.org{color:var(--muted);font-size:14px;margin-top:3px}
.tag{color:var(--muted);font-size:14px;line-height:1.5;text-align:center;margin:16px 4px 4px;max-width:360px}
.cta{width:100%;display:flex;flex-direction:column;gap:11px;margin-top:24px}
a.btn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;
padding:15px 16px;border-radius:14px;font-size:16px;font-weight:700;text-decoration:none;
border:1px solid var(--line);color:var(--ink);background:rgba(255,255,255,.04);transition:.15s}
a.btn:active{transform:scale(.985)}
a.primary{background:var(--gold);color:#1a1505;border-color:var(--gold);font-weight:800}
.row{display:flex;gap:11px}.row a.btn{flex:1}
.social{display:flex;gap:11px;margin-top:14px;width:100%}
.social a{flex:1;text-align:center;padding:13px;border-radius:14px;border:1px solid var(--line);
color:var(--muted);text-decoration:none;font-size:14px;font-weight:700;background:rgba(255,255,255,.03)}
.foot{margin-top:30px;display:flex;align-items:center;gap:9px;color:var(--muted);font-size:13px}
.m{width:26px;height:26px;border-radius:7px;background:var(--navy2);border:1px solid var(--gold);
display:flex;align-items:center;justify-content:center;color:var(--gold);font-weight:900;font-size:15px}
.foot a{color:var(--goldlt);text-decoration:none;font-weight:700}
.ico{font-size:17px}
</style></head>
<body data-master-chrome="off">
<main class="wrap">
  <div class="kick">${C.brand}</div>
  <img class="photo" src="${C.photo}" alt="${C.name}">
  <h1>${C.name}</h1>
  <div class="title">${C.title}</div>
  <div class="org">${C.org}</div>
  <p class="tag">${C.tagline}</p>
  <div class="cta">
    <a class="btn primary" href="/card?download=vcf"><span class="ico">&#128229;</span> Add to Contacts</a>
    <div class="row">
      <a class="btn" href="tel:${C.tel}"><span class="ico">&#128222;</span> Call</a>
      <a class="btn" href="mailto:${C.email}"><span class="ico">&#9993;</span> Email</a>
    </div>
    <a class="btn" href="${C.book}"><span class="ico">&#128197;</span> Book a Call</a>
    <a class="btn" href="${C.site}"><span class="ico">&#127760;</span> markcmo.com</a>
  </div>
  <div class="social">
    <a href="${C.linkedin}">LinkedIn</a>
    <a href="${C.x}">X / Twitter</a>
  </div>
  <div class="foot"><span class="m">M</span> <span>&copy; ${'{{YEAR}}'} MarkCMO &middot; <a href="${C.site}">markcmo.com</a></span></div>
</main>
</body></html>`.replace('{{YEAR}}', String(new Date().getUTCFullYear()));
}
