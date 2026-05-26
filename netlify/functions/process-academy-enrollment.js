// netlify/functions/process-academy-enrollment.js
// Realtime equivalent of the hourly academy-enrollment-reconcile cron, but
// scoped to a single email. Used by the post-Square-checkout /thank-you page
// to enroll a paid customer IMMEDIATELY rather than waiting up to 60 min.
//
// POST { email } (public — Square is the gate, no admin auth required)
//   1. Search Square customers by email
//   2. List that customer's subscriptions; require at least one ACTIVE
//      academy-plan subscription
//   3. If found, write an All-Access enrollment to JSONBin + send welcome
//      email (calls the academy's course-enroll with courseId=membership)
//   4. Return { ok, enrolled, course_count, accessToken, alreadyEnrolled }
//
// GET ?email=... -> just checks status (does NOT create enrollment).
//   Used by /thank-you to poll for cron-created enrollments without
//   duplicate-creating them.
//
// Returns 402 Payment Required if email has no ACTIVE academy subscription.

const SQUARE_API = 'https://connect.squareup.com/v2';
const SQUARE_VERSION = '2024-11-20';

// Active academy plan variation IDs (matches academy-enrollment-reconcile.js)
const ACADEMY_VARIATIONS = {
  '2FXFF44DSP2F7YHKD33YZ6KX': 'monthly',
  'WXXLU4TIVVPZ7KYXCVTGH4Z6': 'annual',
};

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

async function sq(path, init = {}) {
  const r = await fetch(SQUARE_API + path, {
    ...init,
    headers: {
      'Authorization': 'Bearer ' + process.env.SQUARE_ACCESS_TOKEN,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

async function findActiveAcademySubscription(email) {
  if (!email) return null;
  // 1. Search Square customers by email
  const custRes = await sq('/customers/search', {
    method: 'POST',
    body: JSON.stringify({
      query: { filter: { email_address: { exact: email } } },
      limit: 5,
    }),
  });
  if (!custRes.ok) return null;
  const customers = custRes.body.customers || [];
  if (!customers.length) return null;

  // 2. For each matching customer, list active academy subscriptions
  for (const customer of customers) {
    const subRes = await sq('/subscriptions/search', {
      method: 'POST',
      body: JSON.stringify({ query: { filter: { customer_ids: [customer.id] } } }),
    });
    if (!subRes.ok) continue;
    const subs = subRes.body.subscriptions || [];
    const active = subs.find(s =>
      s.status === 'ACTIVE' && ACADEMY_VARIATIONS[s.plan_variation_id]
    );
    if (active) {
      return {
        customer,
        subscription: active,
        plan: ACADEMY_VARIATIONS[active.plan_variation_id],
      };
    }
  }
  return null;
}

async function jbGet(binId) {
  const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: { 'X-Master-Key': process.env.JSONBIN_API_KEY, 'X-Bin-Meta': 'false' },
  });
  if (!r.ok) throw new Error(`JSONBin GET failed: ${r.status}`);
  return r.json();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  // ── GET: status-only lookup (no create) ───────────────────────────────────
  if (event.httpMethod === 'GET') {
    const email = (event.queryStringParameters?.email || '').trim().toLowerCase();
    if (!email) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'email required' }) };
    }
    try {
      const data = await jbGet(process.env.JSONBIN_ENROLLMENTS_BIN_ID);
      const enrollments = (data.enrollments || data.record?.enrollments || []).filter(
        e => (e.email || '').toLowerCase() === email
      );
      const hasMembership = enrollments.some(e => e.courseId === 'membership');
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          enrolled: enrollments.length > 0,
          isMember: hasMembership,
          courseCount: enrollments.filter(e => e.courseId !== 'membership').length,
          accessToken: enrollments[0]?.accessToken || null,
          membershipExpires: enrollments.find(e => e.membershipExpires)?.membershipExpires || null,
        }),
      };
    } catch (e) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: e.message }) };
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'POST only' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  if (!email) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'email required' }) };
  }

  if (!process.env.SQUARE_ACCESS_TOKEN) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'Square not configured' }) };
  }

  // ── Check if already enrolled (cron may have beat us) ──────────────────────
  try {
    const data = await jbGet(process.env.JSONBIN_ENROLLMENTS_BIN_ID);
    const existing = (data.enrollments || data.record?.enrollments || []).filter(
      e => (e.email || '').toLowerCase() === email && e.courseId === 'membership'
    );
    if (existing.length > 0) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: true,
          alreadyEnrolled: true,
          accessToken: existing[0].accessToken,
          membershipExpires: existing[0].membershipExpires || null,
        }),
      };
    }
  } catch (e) {
    console.warn('Pre-check enrollment lookup failed:', e.message);
  }

  // ── Verify active Square subscription ──────────────────────────────────────
  const verification = await findActiveAcademySubscription(email);
  if (!verification) {
    return {
      statusCode: 402,
      headers: CORS,
      body: JSON.stringify({
        ok: false,
        error: 'No active subscription',
        message: 'We could not find a Square subscription for ' + email + '. If you just paid, try again in 30 seconds. If you used a different email at checkout, please enter that one instead.',
      }),
    };
  }

  // ── Call academy course-enroll (membership path → all-access) ──────────────
  // Hit the academy.markcmo.com endpoint directly with internal source flag.
  const enrollName = name
    || [verification.customer.given_name, verification.customer.family_name].filter(Boolean).join(' ')
    || email.split('@')[0];

  try {
    const r = await fetch('https://academy.markcmo.com/.netlify/functions/course-enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: enrollName,
        email,
        courseId: 'membership',
        membershipPlan: verification.plan,
        ref: 'purchase',
        source: 'thank-you-page-realtime',
      }),
    });
    const enrollData = await r.json().catch(() => ({}));
    if (!r.ok || !enrollData.ok) {
      return {
        statusCode: 502,
        headers: CORS,
        body: JSON.stringify({
          error: 'Enrollment failed downstream',
          detail: enrollData,
        }),
      };
    }
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        alreadyEnrolled: false,
        plan: verification.plan,
        accessToken: enrollData.accessToken,
        membershipExpires: enrollData.membershipExpires,
        courseCount: enrollData.courseCount || 23,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Enrollment call failed', message: e.message }),
    };
  }
};
