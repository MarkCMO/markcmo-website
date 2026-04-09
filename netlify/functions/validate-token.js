// validate-token.js
// POST { token, courseId } → { valid, email, name, reason }
// Called by learn.html on every page load before any content renders.
// Checks token against enrollment records in JSONBin.
// Token must match the specific courseId — prevents token sharing across courses.

const https = require('https');

function jsonbinGet(binId, apiKey) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.jsonbin.io',
      path: `/v3/b/${binId}`,
      method: 'GET',
      headers: { 'X-Master-Key': apiKey, 'Content-Type': 'application/json' }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ valid: false, reason: 'Method not allowed' }) };

  let token, courseId;
  try {
    ({ token, courseId } = JSON.parse(event.body || '{}'));
  } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ valid: false, reason: 'Bad request' }) };
  }

  // Basic input sanitation
  if (!token || typeof token !== 'string' || token.length < 8 || token.length > 120) {
    return { statusCode: 200, headers, body: JSON.stringify({ valid: false, reason: 'invalid_token' }) };
  }
  if (!courseId || typeof courseId !== 'string' || courseId.length > 30) {
    return { statusCode: 200, headers, body: JSON.stringify({ valid: false, reason: 'invalid_course' }) };
  }

  const { JSONBIN_API_KEY, JSONBIN_ENROLLMENTS_BIN_ID } = process.env;
  if (!JSONBIN_API_KEY || !JSONBIN_ENROLLMENTS_BIN_ID) {
    console.error('Missing env vars');
    return { statusCode: 500, headers, body: JSON.stringify({ valid: false, reason: 'server_error' }) };
  }

  try {
    const data = await jsonbinGet(JSONBIN_ENROLLMENTS_BIN_ID, JSONBIN_API_KEY);
    // Structure: data.record = { enrollments: [...] }  (matches course-enroll.js)
    const record = data.record || data || {};
    const enrollments = Array.isArray(record) ? record : (record.enrollments || []);

    // Find enrollment by token
    const enrollment = enrollments.find(e => e.accessToken === token);

    if (!enrollment) {
      return { statusCode: 200, headers, body: JSON.stringify({ valid: false, reason: 'token_not_found' }) };
    }

    // Token must match the specific course being accessed
    // Prevents: buy CMO → share URL with ?course=cfo
    if (enrollment.courseId !== courseId) {
      return { statusCode: 200, headers, body: JSON.stringify({
        valid: false,
        reason: 'wrong_course',
        message: `This token is for ${enrollment.courseId?.toUpperCase()} — not ${courseId?.toUpperCase()}.`
      })};
    }

    // Token is valid for this course
    return { statusCode: 200, headers, body: JSON.stringify({
      valid: true,
      email: enrollment.email,
      name: enrollment.name || '',
      courseId: enrollment.courseId,
      enrolledAt: enrollment.enrolledAt
    })};

  } catch(err) {
    console.error('validate-token error:', err.message);
    // On JSONBin failure, fail CLOSED (deny access, don't open the gate)
    return { statusCode: 200, headers, body: JSON.stringify({ valid: false, reason: 'server_error' }) };
  }
};
