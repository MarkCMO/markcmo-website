// ═══════════════════════════════════════════════════════════════
// get-document.js
// Validates an HMAC-signed token and returns the doc metadata + PDF.
//
// Two token versions:
//   v1 (legacy): payload contains { binId } -> fetch from JSONBin
//   v2 (Supabase): payload contains { v: 2, pdfPath } -> fetch from
//                  Supabase Storage in the markcmo-engagement-docs bucket.
// ═══════════════════════════════════════════════════════════════
const crypto = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const STORAGE_BUCKET = 'markcmo-engagement-docs';

async function fetchPdfFromSupabase(pdfPath) {
  // Namespaced to avoid collision with existing SUPABASE_* vars (different project)
  const url = process.env.MARKCMO_SUPABASE_URL;
  const key = process.env.MARKCMO_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.warn('MARKCMO_SUPABASE_* env vars missing; cannot fetch v2 PDF');
    return null;
  }
  try {
    const res = await fetch(`${url}/storage/v1/object/${STORAGE_BUCKET}/${pdfPath}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.warn('Supabase storage fetch failed:', res.status, await res.text());
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString('base64');
  } catch (e) {
    console.warn('Supabase storage fetch error:', e.message);
    return null;
  }
}

async function fetchPdfFromJsonbin(binId) {
  if (!process.env.JSONBIN_API_KEY) return null;
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { 'X-Master-Key': process.env.JSONBIN_API_KEY },
    });
    const binData = await res.json();
    return binData.record?.pdfBase64 || null;
  } catch (e) {
    console.warn('JSONBin fetch error:', e.message);
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const token = event.queryStringParameters?.token;
  if (!token) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing token' }) };

  let payload;
  try { payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')); }
  catch (e) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid token format' }) }; }

  const { hmac, ...data } = payload;
  const secret = process.env.TOKEN_SECRET || 'markcmo-signing-secret-change-me';
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex');
  if (hmac !== expected) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid or tampered token' }) };

  if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) {
    return { statusCode: 410, headers: CORS, body: JSON.stringify({ error: 'Link expired' }) };
  }

  // Fetch PDF based on token version
  let pdfBase64 = null;
  if (payload.v === 2 && payload.pdfPath) {
    pdfBase64 = await fetchPdfFromSupabase(payload.pdfPath);
    if (pdfBase64) console.log('Retrieved PDF from Supabase Storage:', payload.pdfPath);
  } else if (payload.binId) {
    pdfBase64 = await fetchPdfFromJsonbin(payload.binId);
    if (pdfBase64) console.log('Retrieved PDF from JSONBin:', payload.binId);
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ...data, status: 'pending', pdfBase64 }),
  };
};
