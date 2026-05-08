const { kickoffJob } = require('./_wetyr_jobs');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'POST only' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
  if (!body.breakdown) return json(400, { ok: false, error: 'breakdown required' });
  try {
    const jobId = await kickoffJob({ kind: 'shotlist', proto: event.headers['x-forwarded-proto'] || 'https', host: event.headers.host || 'markcmo.com', body });
    return json(202, { ok: true, jobId, status: 'processing' });
  } catch (e) { return json(500, { ok: false, error: String(e.message || e) }); }
};
function cors(){return{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type'};}
function json(s,b){return{statusCode:s,headers:{'content-type':'application/json',...cors()},body:JSON.stringify(b)};}
