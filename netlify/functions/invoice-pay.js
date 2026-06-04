// invoice-pay.js
// Embedded ACH payment for the branded WETYR/MarkCMO invoice page.
// The invoice page (Square Web Payments SDK) sends an ACH bank-transfer token
// here; we create the payment SERVER-SIDE so the amount is never trusted from
// the client. New, self-contained function (not part of the locked pipeline).
//
// Body: { token, sample?:true, invoiceNumber?, buyerEmail? }
//   sample:true        -> charges $1.00 (live ACH test)
//   invoiceNumber:"CDB-INV-001" -> looks up amount_usd from mc_invoices
//
// ACH settles asynchronously (1-3 business days); square-webhook finalizes the
// paid state. This returns the initial Square payment status (PENDING/APPROVED).
'use strict';
const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'bad json' }) }; }

  const { token, sample, invoiceNumber, plan, buyerEmail } = body;
  if (!token) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'missing token' }) };

  // ── Fixed-price plans (server-side amounts; never trust the client) ──
  const PLANS = {
    'roc-launch-engagement':     { cents: 500000,  note: 'ROC Roofing Launch-to-Scale engagement fee' },
    'roc-foothold-engagement':   { cents: 900000,  note: 'ROC Roofing Foothold engagement fee' },
    'roc-growth-engagement':     { cents: 1200000, note: 'ROC Roofing Growth engagement fee' },
    'roc-enterprise-engagement': { cents: 1800000, note: 'ROC Roofing Enterprise engagement fee' },
    'roc-scale-balance':         { cents: 700000,  note: 'ROC Roofing engagement fee balance (Scale true-up)' },
  };

  // ── Decide amount SERVER-SIDE (never trust the client) ──
  let amountCents = null, note = '';
  if (sample === true) {
    amountCents = 100;
    note = 'WETYR embedded ACH test ($1)';
  } else if (plan && PLANS[plan]) {
    amountCents = PLANS[plan].cents;
    note = PLANS[plan].note;
  } else if (invoiceNumber) {
    try {
      const r = await fetch(
        `${process.env.MARKCMO_SUPABASE_URL}/rest/v1/mc_invoices?invoice_number=eq.${encodeURIComponent(invoiceNumber)}&status=neq.void&select=amount_usd,invoice_number&limit=1`,
        { headers: { apikey: process.env.MARKCMO_SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.MARKCMO_SUPABASE_SERVICE_KEY}` } }
      );
      const rows = await r.json();
      if (!Array.isArray(rows) || !rows.length) return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: 'invoice not found' }) };
      amountCents = Math.round(Number(rows[0].amount_usd) * 100);
      note = `WETYR invoice ${rows[0].invoice_number}`;
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'invoice lookup failed' }) };
    }
  } else {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'no invoice reference' }) };
  }

  if (!amountCents || amountCents < 100) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'invalid amount' }) };

  const base = (process.env.SQUARE_ENV || 'production').toLowerCase() === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';

  try {
    const res = await fetch(`${base}/v2/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-11-20',
        Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        source_id: token,
        amount_money: { amount: amountCents, currency: 'USD' },
        location_id: process.env.SQUARE_LOCATION_ID,
        autocomplete: true,
        note,
        ...(buyerEmail ? { buyer_email_address: buyerEmail } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = (data.errors || []).map(e => e.detail || e.code).join('; ') || `HTTP ${res.status}`;
      return { statusCode: res.status, headers, body: JSON.stringify({ ok: false, error: msg }) };
    }
    const p = data.payment || {};
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, status: p.status, paymentId: p.id }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
