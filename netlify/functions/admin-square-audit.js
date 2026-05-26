// netlify/functions/admin-square-audit.js
// Admin-only diagnostic: pulls current Square catalog, customers, and recent
// orders so we can:
//   1. See which products still exist (vs broken square.link URLs on the site)
//   2. Find historical paying customers to import as enrollment records
//   3. Generate fresh checkout payment links via Square's Online Checkout API
//
// Auth: same admin-auth cookie used by other admin endpoints.
// All secrets stay server-side. Response contains only product/customer
// metadata that admin already has access to via the Square dashboard.

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://markcmo.com',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
};

const COOKIE_NAME = 'mcadmin_session';
const SQUARE_VERSION = '2024-11-20';

// ── Re-use cookie verify logic from admin-auth.js ─────────────────────────
async function verifyToken(token, secret) {
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return null;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(dataB64));
    if (!ok) return null;
    const payload = JSON.parse(atob(dataB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function parseCookies(h) {
  const out = {};
  (h || '').split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  });
  return out;
}

function sqBaseUrl() {
  const env = (process.env.SQUARE_ENV || 'production').toLowerCase();
  return env === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
}

async function sqCall(method, path, body) {
  const res = await fetch(`${sqBaseUrl()}/v2${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  // ── Auth ─────────────────────────────────────────────────────────────
  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || '');
  const token = cookies[COOKIE_NAME];
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.TOKEN_SECRET || 'fallback';
  const payload = token ? await verifyToken(token, secret) : null;
  if (!payload) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Not authenticated' }) };
  }

  if (!process.env.SQUARE_ACCESS_TOKEN) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'SQUARE_ACCESS_TOKEN not configured' }) };
  }

  const type = event.queryStringParameters?.type || 'summary';
  const locationId = process.env.SQUARE_LOCATION_ID || '';
  const env = (process.env.SQUARE_ENV || 'production').toLowerCase();

  try {
    // ── CATALOG ─────────────────────────────────────────────────────
    if (type === 'catalog') {
      const r = await sqCall('GET', '/catalog/list?types=ITEM');
      if (!r.ok) return { statusCode: r.status, headers: CORS, body: JSON.stringify(r.data) };

      const items = (r.data.objects || [])
        .filter(o => o.type === 'ITEM' && !o.is_deleted)
        .map(o => {
          const itemData = o.item_data || {};
          const variations = (itemData.variations || []).map(v => {
            const vd = v.item_variation_data || {};
            const pm = vd.price_money || {};
            return {
              variation_id: v.id,
              name: vd.name || '',
              price_cents: pm.amount || 0,
              price_display: pm.amount ? `$${(pm.amount / 100).toFixed(2)}` : '—',
              currency: pm.currency || '',
            };
          });
          return {
            id: o.id,
            name: itemData.name || '',
            description: (itemData.description || '').slice(0, 200),
            variations,
            updated_at: o.updated_at,
          };
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ env, location_id: locationId, count: items.length, items }) };
    }

    // ── CUSTOMERS ───────────────────────────────────────────────────
    if (type === 'customers') {
      // Search all customers, paginate up to 500 to keep response small.
      const customers = [];
      let cursor = null;
      for (let i = 0; i < 5; i++) {
        const r = await sqCall('POST', '/customers/search', {
          query: { sort: { field: 'CREATED_AT', order: 'DESC' } },
          limit: 100,
          ...(cursor ? { cursor } : {}),
        });
        if (!r.ok) break;
        (r.data.customers || []).forEach(c => {
          customers.push({
            id: c.id,
            email: c.email_address || '',
            given_name: c.given_name || '',
            family_name: c.family_name || '',
            company: c.company_name || '',
            phone: c.phone_number || '',
            created_at: c.created_at,
            note: (c.note || '').slice(0, 100),
          });
        });
        cursor = r.data.cursor;
        if (!cursor) break;
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ env, count: customers.length, customers }) };
    }

    // ── ORDERS (paid transactions = real enrollments) ───────────────
    if (type === 'orders') {
      if (!locationId) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'SQUARE_LOCATION_ID not set' }) };
      }
      const orders = [];
      let cursor = null;
      for (let i = 0; i < 5; i++) {
        const r = await sqCall('POST', '/orders/search', {
          location_ids: [locationId],
          query: {
            filter: { state_filter: { states: ['COMPLETED'] } },
            sort: { sort_field: 'CREATED_AT', sort_order: 'DESC' },
          },
          limit: 100,
          ...(cursor ? { cursor } : {}),
        });
        if (!r.ok) break;
        (r.data.orders || []).forEach(o => {
          const total = o.total_money?.amount || 0;
          const lineItems = (o.line_items || []).map(li => ({
            name: li.name,
            qty: li.quantity,
            price_cents: li.base_price_money?.amount || 0,
          }));
          orders.push({
            id: o.id,
            created_at: o.created_at,
            state: o.state,
            customer_id: o.customer_id || '',
            total_cents: total,
            total_display: `$${(total / 100).toFixed(2)}`,
            line_items: lineItems,
          });
        });
        cursor = r.data.cursor;
        if (!cursor) break;
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ env, count: orders.length, orders }) };
    }

    // ── DELETED catalog items (with timestamps) ─────────────────────
    if (type === 'deleted') {
      // SearchCatalogObjects with include_deleted_objects:true
      const r = await sqCall('POST', '/catalog/search', {
        object_types: ['ITEM'],
        include_deleted_objects: true,
        limit: 1000,
      });
      if (!r.ok) return { statusCode: r.status, headers: CORS, body: JSON.stringify(r.data) };
      const allItems = (r.data.objects || []).filter(o => o.type === 'ITEM');
      const deleted = allItems.filter(o => o.is_deleted).map(o => ({
        id: o.id,
        name: o.item_data?.name || '',
        deleted_at: o.updated_at,
        version: o.version,
      })).sort((a, b) => (b.deleted_at || '').localeCompare(a.deleted_at || ''));
      const active = allItems.filter(o => !o.is_deleted).length;
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          active_count: active,
          deleted_count: deleted.length,
          deleted_items: deleted,
          note: 'Square does not expose which Square Account user performed the deletion. The deleted_at timestamp reflects the time the item was last updated (i.e. marked deleted).',
        }),
      };
    }

    // ── SUMMARY (default) ───────────────────────────────────────────
    const [cat, cust, ord] = await Promise.all([
      sqCall('GET', '/catalog/list?types=ITEM'),
      sqCall('POST', '/customers/search', { limit: 1 }),
      locationId ? sqCall('POST', '/orders/search', {
        location_ids: [locationId],
        query: { filter: { state_filter: { states: ['COMPLETED'] } } },
        limit: 1,
      }) : Promise.resolve({ ok: false, data: { errors: [{ detail: 'no SQUARE_LOCATION_ID' }] } }),
    ]);

    const catalog_items = cat.ok ? (cat.data.objects || []).filter(o => o.type === 'ITEM' && !o.is_deleted).length : null;
    const sample_customer_emails = cust.ok ? (cust.data.customers || []).map(c => c.email_address).filter(Boolean) : [];
    const has_completed_orders = ord.ok ? (ord.data.orders || []).length > 0 : null;

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        env,
        location_id: locationId ? `${locationId.slice(0, 4)}…${locationId.slice(-4)}` : '(missing)',
        catalog_items_total: catalog_items,
        catalog_error: cat.ok ? null : (cat.data.errors || cat.data),
        customers_reachable: cust.ok,
        customers_error: cust.ok ? null : (cust.data.errors || cust.data),
        sample_customer_emails,
        has_completed_orders,
        orders_error: ord.ok ? null : (ord.data.errors || ord.data),
        hint: 'Add ?type=catalog or ?type=customers or ?type=orders for full lists',
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: String(err.message || err) }),
    };
  }
};
