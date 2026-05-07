// netlify/functions/admin-data.js
// Unified admin data proxy — serves both markcmo.com AND academy.markcmo.com data
// Protected by a simple token check matching admin credentials

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://markcmo.com',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
};

async function supabaseQuery(url, key, table, params = '') {
  const res = await fetch(`${url}/rest/v1/${table}${params}`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    }
  });
  if (!res.ok) throw new Error(`Supabase ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabasePost(url, key, table, body, method = 'POST') {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Supabase ${table} ${method} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function jsonbinGet(binId, apiKey) {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: { 'X-Master-Key': apiKey, 'X-Bin-Meta': 'false' }
  });
  if (!res.ok) throw new Error(`JSONBin GET failed: ${res.status}`);
  return res.json();
}

async function jsonbinPut(binId, apiKey, data) {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`JSONBin PUT failed: ${res.status}`);
  return res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const {
    JSONBIN_API_KEY,
    ADMIN_SECRET,
    // markcmo.com bins
    JSONBIN_BIN_ID,
    JSONBIN_DRIP_BIN_ID,
    JSONBIN_DOCS_BIN_ID,
    // academy.markcmo.com bins
    JSONBIN_ENROLLMENTS_BIN_ID,
    JSONBIN_GRADS_BIN_ID,
    JSONBIN_VOTES_BIN_ID,
    JSONBIN_FOUNDING_BIN_ID,
    JSONBIN_INTL_BIN_ID,
    JSONBIN_NOTIFY_BIN_ID,
    // MarkCMO Supabase (CRM/Engagements/Invoices)
    MARKCMO_SUPABASE_URL,
    MARKCMO_SUPABASE_SERVICE_KEY,
  } = process.env;
  const SB_URL = MARKCMO_SUPABASE_URL;
  const SB_KEY = MARKCMO_SUPABASE_SERVICE_KEY;

  // ── BIN MAP: all data types across both sites ────────────────────────────
  const BIN_MAP = {
    // markcmo.com
    leads:       { id: JSONBIN_BIN_ID,           key: 'leads' },
    queue:       { id: JSONBIN_DRIP_BIN_ID,       key: 'queue' },
    docs:        { id: JSONBIN_DOCS_BIN_ID,       key: 'docs' },
    // academy.markcmo.com
    enrollments: { id: JSONBIN_ENROLLMENTS_BIN_ID, key: 'enrollments' },
    graduates:   { id: JSONBIN_GRADS_BIN_ID,      key: 'graduates' },
    votes:       { id: JSONBIN_VOTES_BIN_ID,      key: 'votes' },
    founding:    { id: JSONBIN_FOUNDING_BIN_ID,   key: 'founding' },
    intl:        { id: JSONBIN_INTL_BIN_ID,       key: 'waitlist' },
    notify:      { id: JSONBIN_NOTIFY_BIN_ID,     key: 'courseNotifySignups' },
  };

  if (event.httpMethod === 'GET') {
    const type = event.queryStringParameters?.type;
    // Return ADMIN_SECRET so admin panel can auto-populate it
    if (type === 'secret') {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ secret: ADMIN_SECRET || '' }) };
    }
    // Proxy: fetch notify signups from academy with secret injected
    if (type === 'notify') {
      try {
        const r = await fetch(`https://academy.markcmo.com/course-notify?adminSecret=${encodeURIComponent(ADMIN_SECRET || '')}`);
        const d = await r.json();
        return { statusCode: r.status, headers: CORS, body: JSON.stringify(d) };
      } catch(err) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
      }
    }
    // Proxy: votes (public, no auth needed)
    if (type === 'votes') {
      try {
        const r = await fetch('https://academy.markcmo.com/course-votes');
        const d = await r.json();
        return { statusCode: 200, headers: CORS, body: JSON.stringify(d) };
      } catch(err) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
      }
    }
    // Proxy: intl waitlist (admin, secret injected server-side)
    if (type === 'intl') {
      try {
        const r = await fetch(`https://academy.markcmo.com/international-waitlist?adminSecret=${encodeURIComponent(ADMIN_SECRET || '')}`);
        const d = await r.json();
        return { statusCode: r.status, headers: CORS, body: JSON.stringify(d) };
      } catch(err) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
      }
    }
    // ── Supabase: CRM Clients ─────────────────────────────────────────────────
    if (type === 'clients') {
      try {
        const rows = await supabaseQuery(SB_URL, SB_KEY, 'mc_clients', '?order=created_at.desc');
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ clients: rows }) };
      } catch(err) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
      }
    }
    // ── Supabase: Engagements ─────────────────────────────────────────────────
    if (type === 'engagements') {
      try {
        const rows = await supabaseQuery(SB_URL, SB_KEY, 'mc_engagements', '?order=created_at.desc&select=*,mc_clients(company_name,contact_name,email)');
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ engagements: rows }) };
      } catch(err) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
      }
    }
    // ── Supabase: Invoices ────────────────────────────────────────────────────
    if (type === 'invoices') {
      try {
        const rows = await supabaseQuery(SB_URL, SB_KEY, 'mc_invoices', '?order=created_at.desc&select=*,mc_engagements(title,mc_clients(company_name))');
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ invoices: rows }) };
      } catch(err) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
      }
    }
    // ── Supabase: Documents ───────────────────────────────────────────────────
    if (type === 'supadocs') {
      try {
        const rows = await supabaseQuery(SB_URL, SB_KEY, 'mc_documents', '?order=created_at.desc&select=*,mc_engagements(title,mc_clients(company_name))');
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ supadocs: rows }) };
      } catch(err) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
      }
    }
    // ── Supabase: Audit Log ───────────────────────────────────────────────────
    if (type === 'audit') {
      try {
        const rows = await supabaseQuery(SB_URL, SB_KEY, 'mc_audit_log', '?order=created_at.desc&limit=200');
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ audit: rows }) };
      } catch(err) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
      }
    }

    const bin = BIN_MAP[type];
    if (!bin || !bin.id) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown type or missing bin ID: ${type}` }) };
    }
    try {
      const record = await jsonbinGet(bin.id, JSONBIN_API_KEY);
      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({ [bin.key]: record[bin.key] || record || [] })
      };
    } catch(err) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: CORS, body: 'Invalid JSON' }; }

    // ── Proxy: forward launch/notify actions to academy with secret injected ──
    if (body.action === 'approve-intl') {
      try {
        const r = await fetch('https://academy.markcmo.com/international-waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, adminSecret: ADMIN_SECRET })
        });
        const d = await r.json();
        return { statusCode: r.status, headers: CORS, body: JSON.stringify(d) };
      } catch(err) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
      }
    }
    if (body.action === 'launch' || body.action === 'notify-list') {
      try {
        if (!ADMIN_SECRET) {
          return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'ADMIN_SECRET not configured on markcmo.com — set it in Netlify environment variables' }) };
        }
        const proxyBody = { ...body, adminSecret: ADMIN_SECRET };
        const r = await fetch('https://academy.markcmo.com/course-notify', {
          method: body.action === 'notify-list' ? 'GET' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body.action === 'notify-list' ? undefined : JSON.stringify(proxyBody)
        });
        const d = await r.json();
        return { statusCode: r.status, headers: CORS, body: JSON.stringify(d) };
      } catch(err) {
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
      }
    }

    const bin = BIN_MAP[body.type];
    if (!bin || !bin.id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Unknown type' }) };

    try {
      const current = await jsonbinGet(bin.id, JSONBIN_API_KEY);
      const arr = current[bin.key] || current || [];
      // Upsert by id/email or append
      let updated;
      if (body.action === 'delete' && body.id) {
        updated = arr.filter(item => item.id !== body.id && item.email !== body.id);
      } else if (body.action === 'update' && body.item) {
        const idx = arr.findIndex(i => i.id === body.item.id || i.email === body.item.email);
        updated = idx >= 0 ? arr.map((i,n) => n===idx ? {...i,...body.item} : i) : [...arr, body.item];
      } else if (body.data !== undefined) {
        updated = body.data;
      } else {
        updated = arr;
      }
      const payload = bin.key ? { [bin.key]: updated } : updated;
      await jsonbinPut(bin.id, JSONBIN_API_KEY, payload);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    } catch(err) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers: CORS, body: 'Method not allowed' };
};
