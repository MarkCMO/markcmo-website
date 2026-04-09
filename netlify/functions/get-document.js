const crypto = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

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
    return { statusCode: 410, headers: CORS, body: JSON.stringify({ error: 'Link expired (30-day limit)' }) };
  }

  // If PDF is stored in JSONBin, fetch it and include in response
  let pdfBase64 = null;
  if (payload.binId && process.env.JSONBIN_API_KEY) {
    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${payload.binId}/latest`, {
        headers: { 'X-Master-Key': process.env.JSONBIN_API_KEY },
      });
      const binData = await res.json();
      pdfBase64 = binData.record?.pdfBase64 || null;
      if (pdfBase64) console.log('Retrieved PDF from JSONBin:', payload.binId);
    } catch (e) {
      console.warn('JSONBin fetch error:', e.message);
    }
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ...data, status: 'pending', pdfBase64 }),
  };
};
