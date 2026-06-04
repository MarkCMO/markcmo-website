// functions/api/roc-intake.js
// Native Cloudflare Pages Function (hand-written; listed in build-pages-functions.js NATIVE_ROUTES).
// Captures the ROC Roofing client onboarding / intake form and stores it in the
// BLOBS_DOCUMENTS KV namespace so Mark gets every answer in one place.
// Public endpoint (the client fills it out). Sends NO email. Same-origin.
//
// POST JSON: { ...all form fields }
// Returns: { ok, reference }

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: { 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
  }
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const name = (body.clientName || '').toString().trim();
  const email = (body.email || '').toString().trim();
  if (name.length < 2) return json({ error: 'Please enter your name' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Please enter a valid email' }, 400);

  const kv = env.BLOBS_DOCUMENTS;
  if (!kv) return json({ error: 'Storage unavailable' }, 503);

  const reference = (crypto.randomUUID && crypto.randomUUID()) || ('intake_' + Math.random().toString(36).slice(2));
  const serverTime = new Date().toISOString();

  // Whitelist + cap field sizes; keep everything the client sent that we expect.
  const ALLOWED = [
    'clientName','email','phone','tier',
    'gbpEmail','websiteAccess','registrar','googleAds','facebookPage','crm',
    'licenseNo','liabilityInsurance','workersComp','manufacturerCerts',
    'logoLink','photosLink','videoLink',
    'serviceArea','servicesPriority','avgJobValue','capacity','financing','warranty','differentiators','hours',
    'reviewsConsent','reviewsOwner','customerListNote',
    'trackedPhone','leadResponder','afterHours',
    'fuelFunding','fuelMinAck',
    'anythingElse',
  ];
  const data = {};
  for (const k of ALLOWED) {
    if (k in body) {
      const v = body[k];
      if (Array.isArray(v)) data[k] = v.map(x => String(x).slice(0, 200)).slice(0, 40);
      else data[k] = String(v == null ? '' : v).slice(0, 4000);
    }
  }

  const record = {
    reference,
    doc: 'rocroofing-intake',
    submittedAt: serverTime,
    ip: request.headers.get('cf-connecting-ip') || null,
    country: (request.cf && request.cf.country) || null,
    data,
  };

  try {
    await kv.put(`intake/rocroofing/${reference}`, JSON.stringify(record), {
      metadata: { clientName: name, email, submittedAt: serverTime },
    });
    await kv.put('intake/rocroofing/latest', reference);
  } catch (err) {
    return json({ error: 'Could not save your answers', detail: String(err && err.message || err) }, 500);
  }

  return json({ ok: true, reference });
}
