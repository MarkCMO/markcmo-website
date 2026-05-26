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

// Academy plan variation IDs across BOTH Square apps (legacy MarkCMO +
// new MarkCMO Academy). Subscriptions from either app are honored.
const ACADEMY_VARIATIONS = {
  // Old MarkCMO app (where Robert + Khang live)
  '2FXFF44DSP2F7YHKD33YZ6KX': 'monthly',
  'WXXLU4TIVVPZ7KYXCVTGH4Z6': 'annual',
  // New MarkCMO Academy app (all new signups)
  'GNBQIPQB5O6TAI73ZEGDGZ7H': 'monthly',
  'DT5FZDFTEBFSWYF6G6SISIWC': 'annual',
};

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

// Try both Square app tokens. Same merchant, two apps (old MarkCMO +
// new MarkCMO Academy). A token only sees its own app's resources, so
// we query both and merge.
async function sqWithToken(token, path, init = {}) {
  const r = await fetch(SQUARE_API + path, {
    ...init,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}
async function sq(path, init = {}) {
  // For backward compat — prefer academy token, fall through to legacy.
  const academy = process.env.SQUARE_ACADEMY_ACCESS_TOKEN;
  const legacy  = process.env.SQUARE_ACCESS_TOKEN;
  if (academy) {
    const r = await sqWithToken(academy, path, init);
    if (r.ok) return r;
  }
  if (legacy) return sqWithToken(legacy, path, init);
  return { ok: false, status: 503, body: { errors: [{ detail: 'No Square access token configured' }] } };
}

async function findActiveAcademySubscription(email) {
  if (!email) return null;
  // Search BOTH Square apps. Both tokens must be tried independently because
  // a token can only see customers + subscriptions from its own app.
  const tokens = [
    process.env.SQUARE_ACADEMY_ACCESS_TOKEN,
    process.env.SQUARE_ACCESS_TOKEN,
  ].filter(Boolean);

  for (const token of tokens) {
    const custRes = await sqWithToken(token, '/customers/search', {
      method: 'POST',
      body: JSON.stringify({
        query: { filter: { email_address: { exact: email } } },
        limit: 5,
      }),
    });
    if (!custRes.ok) continue;
    const customers = custRes.body.customers || [];

    for (const customer of customers) {
      const subRes = await sqWithToken(token, '/subscriptions/search', {
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
          sourceApp: token === process.env.SQUARE_ACADEMY_ACCESS_TOKEN ? 'academy' : 'legacy',
        };
      }
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
      const membership = enrollments.find(e => e.courseId === 'membership' || e.viaMembership);
      const indivCourses = enrollments.filter(e => e.courseId !== 'membership');
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          enrolled: enrollments.length > 0,
          isMember: !!membership,
          courseCount: indivCourses.length,
          accessToken: (membership || enrollments[0])?.accessToken || null,
          membershipExpires: membership?.membershipExpires || null,
          courses: indivCourses.map(e => ({
            id: e.courseId,
            title: e.courseTitle || e.courseId,
          })),
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

  // ── Check if already enrolled (cron OR Whop webhook may have beat us) ─────
  // This covers BOTH membership buyers (Square -> webhook -> course-enroll)
  // AND individual course buyers (Whop -> whop-webhook -> course-enroll).
  // Either way the source of truth is JSONBin enrollments.
  try {
    const data = await jbGet(process.env.JSONBIN_ENROLLMENTS_BIN_ID);
    const all = (data.enrollments || data.record?.enrollments || []);
    const mine = all.filter(e => (e.email || '').toLowerCase() === email);
    if (mine.length > 0) {
      const membership = mine.find(e => e.courseId === 'membership' || e.viaMembership);
      const indivCourses = mine.filter(e => e.courseId !== 'membership');
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: true,
          alreadyEnrolled: true,
          isMember: !!membership,
          accessToken: (membership || mine[0]).accessToken,
          membershipExpires: membership?.membershipExpires || null,
          courseCount: indivCourses.length,
          courses: indivCourses.map(e => ({
            id: e.courseId,
            title: e.courseTitle || e.courseId,
          })),
        }),
      };
    }
  } catch (e) {
    console.warn('Pre-check enrollment lookup failed:', e.message);
  }

  // ── No JSONBin enrollment yet -> verify Square subscription ────────────────
  // (Individual Whop buyers should already be enrolled by the time they hit
  // this endpoint because the Whop webhook fires immediately on payment. If
  // they end up here, they're a membership buyer whose Square webhook hasn't
  // fired yet OR a no-payment self-enroll attempt — Square verification gates
  // both cases.)
  if (!process.env.SQUARE_ACCESS_TOKEN && !process.env.SQUARE_ACADEMY_ACCESS_TOKEN) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'Square not configured' }) };
  }
  const verification = await findActiveAcademySubscription(email);
  if (!verification) {
    return {
      statusCode: 402,
      headers: CORS,
      body: JSON.stringify({
        ok: false,
        error: 'No active subscription',
        message: 'We could not find a Square subscription or course purchase for ' + email + '. If you just paid, try again in 30 seconds. If you used a different email at checkout, please enter that one instead.',
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
