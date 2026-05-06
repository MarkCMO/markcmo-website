// course-graduate.js - Save & retrieve graduates
const https = require('https');

const BIN_ID = process.env.JSONBIN_GRADS_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

function jsonbin(method, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : null;
    const opts = {
      hostname: 'api.jsonbin.io',
      path: `/v3/b/${BIN_ID}`,
      method,
      headers: {
        'X-Master-Key': API_KEY,
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
      }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // GET - return all graduates
  if (event.httpMethod === 'GET') {
    try {
      const data = await jsonbin('GET');
      return { statusCode: 200, headers, body: JSON.stringify(data.record || { graduates: [] }) };
    } catch (e) {
      return { statusCode: 200, headers, body: JSON.stringify({ graduates: [] }) };
    }
  }

  // POST - add new graduate
  if (event.httpMethod === 'POST') {
    try {
      const grad = JSON.parse(event.body);
      let current;
      try {
        const existing = await jsonbin('GET');
        current = existing.record || { graduates: [] };
      } catch (e) {
        current = { graduates: [] };
      }

      // Prevent duplicates - same name + course
      const isDup = current.graduates.some(g =>
        g.name === grad.name && g.course === grad.course
      );
      if (!isDup) {
        // Truncate photo to max ~200KB to keep JSONBin within limits
        let photo = grad.photo || null;
        if (photo && photo.length > 200000) photo = null;
        current.graduates.unshift({
          name: grad.name || '',
          course: grad.course || '',
          courseTitle: grad.courseTitle || '',
          gpa: grad.gpa || null,
          letter: grad.letter || '',
          designation: grad.designation || '',
          diplomaNumber: grad.diplomaNumber || `MCA-${Date.now()}`,
          completedAt: grad.completedAt || new Date().toISOString(),
          linkedin: grad.linkedin || '',
          company: grad.company || '',
          photo: photo,
          addedAt: new Date().toISOString()
        });
      }

      await jsonbin('PUT', current);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, diplomaNumber: current.graduates[0]?.diplomaNumber }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: 'Method not allowed' };
};
