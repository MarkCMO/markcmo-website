// functions/api/sign-engagement.js
// Native Cloudflare Pages Function (hand-written; listed in build-pages-functions.js NATIVE_ROUTES).
// Stores a digital signature for a client engagement document into the BLOBS_DOCUMENTS KV namespace.
// Public endpoint (the signer is not an admin). Sends NO email. Same-origin only.
//
// POST JSON:
//   { doc, party, signerName, signerTitle, tier, signatureType, signatureData, consent, signedAt, agreementUrl }
// Returns: { ok, reference, signedAt }

const ALLOWED_DOCS = new Set(['rocroofing-engagement']);
const ALLOWED_PARTIES = new Set(['client', 'provider']);

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

  const { doc, party, signerName, signerTitle, tier, signatureType, signatureData, consent, signedAt, agreementUrl } = body || {};

  // ── Validation ────────────────────────────────────────────────
  if (!ALLOWED_DOCS.has(doc)) return json({ error: 'Unknown document' }, 400);
  if (!ALLOWED_PARTIES.has(party)) return json({ error: 'Unknown party' }, 400);
  if (!signerName || String(signerName).trim().length < 2) return json({ error: 'Signer name required' }, 400);
  if (consent !== true) return json({ error: 'Consent to electronic signature is required' }, 400);
  if (!signatureData || typeof signatureData !== 'string' || signatureData.length > 2_000_000) {
    return json({ error: 'Valid signature image required' }, 400);
  }

  const kv = env.BLOBS_DOCUMENTS;
  if (!kv) return json({ error: 'Storage unavailable' }, 503);

  const reference = (crypto.randomUUID && crypto.randomUUID()) || `sig_${Math.random().toString(36).slice(2)}`;
  const serverTime = new Date().toISOString();
  const ip = request.headers.get('cf-connecting-ip') || null;
  const ua = request.headers.get('user-agent') || null;
  const country = (request.cf && request.cf.country) || null;

  const record = {
    reference,
    doc,
    party,
    signerName: String(signerName).trim().slice(0, 200),
    signerTitle: signerTitle ? String(signerTitle).trim().slice(0, 200) : null,
    tier: tier ? String(tier).slice(0, 60) : null,
    signatureType: signatureType === 'draw' ? 'draw' : 'type',
    signatureData: signatureData, // data URL (PNG)
    consent: true,
    agreementUrl: agreementUrl ? String(agreementUrl).slice(0, 300) : null,
    clientSignedAt: signedAt || null,
    serverSignedAt: serverTime,
    ip,
    country,
    userAgent: ua,
  };

  const key = `signatures/${doc}/${party}/${reference}`;
  try {
    await kv.put(key, JSON.stringify(record), {
      metadata: { doc, party, signerName: record.signerName, serverSignedAt: serverTime },
    });
    // Lightweight pointer to the most recent signature per party (handy for retrieval).
    await kv.put(`signatures/${doc}/latest-${party}`, reference);
  } catch (err) {
    return json({ error: 'Could not record signature', detail: String(err && err.message || err) }, 500);
  }

  return json({ ok: true, reference, signedAt: serverTime });
}
