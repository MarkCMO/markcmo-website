// course-votes.js
// GET              → returns all vote counts { votes: { courseId: count } }
// POST { courseId } → increments vote for courseId, returns updated count
// Rate-limited by IP-day fingerprint stored in bin metadata

const https = require('https');

const BIN_ID  = process.env.JSONBIN_BIN_ID;   // reuse the leads/general bin group
const API_KEY = process.env.JSONBIN_API_KEY;

// We store votes in a dedicated structure within a key
// Using JSONBIN_BIN_ID for the container bin

function jbReq(method, binId, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const req = https.request({
      hostname: 'api.jsonbin.io',
      path: `/v3/b/${binId}`,
      method,
      headers: {
        'X-Master-Key': API_KEY,
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Get or create the votes bin ID from env, fallback to creating data in general bin
const VOTES_BIN = process.env.JSONBIN_VOTES_BIN_ID || BIN_ID;

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // ── GET: return all vote counts ──────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      const data = await jbReq('GET', VOTES_BIN);
      const record = data.record || {};
      const votes = record.courseVotes || {};
      return { statusCode: 200, headers, body: JSON.stringify({ votes }) };
    } catch(e) {
      return { statusCode: 200, headers, body: JSON.stringify({ votes: {} }) };
    }
  }

  // ── POST: vote for a course ──────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    try {
      const { courseId } = JSON.parse(event.body || '{}');
      if (!courseId || typeof courseId !== 'string' || courseId.length > 40) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid courseId' }) };
      }

      // Simple IP + day based dedup (stored as a set of fingerprints)
      const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
      const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const fingerprint = `${ip}_${courseId}_${day}`;

      let record;
      try {
        const existing = await jbReq('GET', VOTES_BIN);
        record = existing.record || {};
      } catch(e) {
        record = {};
      }

      const votes = record.courseVotes || {};
      const seen = record.voteFingerprints || [];

      // Deduplicate — one vote per IP per course per day
      if (seen.includes(fingerprint)) {
        const currentCount = votes[courseId] || 0;
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, count: currentCount, alreadyVoted: true }) };
      }

      // Increment vote
      votes[courseId] = (votes[courseId] || 0) + 1;

      // Keep fingerprints list trimmed to last 5000 entries
      seen.push(fingerprint);
      if (seen.length > 5000) seen.splice(0, seen.length - 5000);

      record.courseVotes = votes;
      record.voteFingerprints = seen;
      record.lastUpdated = new Date().toISOString();

      await jbReq('PUT', VOTES_BIN, record);

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, count: votes[courseId], alreadyVoted: false }) };
    } catch(e) {
      console.error('vote error:', e);
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: 'Method not allowed' };
};
