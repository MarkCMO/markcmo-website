// founding-status.js
// Public GET endpoint - returns live founding seat counter
// Called by index.html on load to show dynamic pricing + counter
//
// Returns: { founding_active, founding_count, founding_limit, seats_remaining }

const FOUNDING_LIMIT = 500;

exports.handler = async (event) => {
  const h = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store'
  };

  const foundingBinId = process.env.JSONBIN_FOUNDING_BIN_ID;
  const apiKey = process.env.JSONBIN_API_KEY;

  // Default state if bin not configured yet
  if (!foundingBinId || !apiKey) {
    return {
      statusCode: 200,
      headers: h,
      body: JSON.stringify({
        founding_active: true,
        founding_count: 0,
        founding_limit: FOUNDING_LIMIT,
        seats_remaining: FOUNDING_LIMIT
      })
    };
  }

  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${foundingBinId}/latest`, {
      headers: { 'X-Master-Key': apiKey }
    });
    const d = await r.json();
    const rec = d.record || {};

    const count = rec.founding_count || 0;
    const active = rec.founding_active !== false; // defaults to true

    return {
      statusCode: 200,
      headers: h,
      body: JSON.stringify({
        founding_active: active,
        founding_count: count,
        founding_limit: FOUNDING_LIMIT,
        seats_remaining: Math.max(0, FOUNDING_LIMIT - count)
      })
    };
  } catch(e) {
    console.error('founding-status error:', e);
    return {
      statusCode: 200,
      headers: h,
      body: JSON.stringify({
        founding_active: true,
        founding_count: 0,
        founding_limit: FOUNDING_LIMIT,
        seats_remaining: FOUNDING_LIMIT
      })
    };
  }
};
