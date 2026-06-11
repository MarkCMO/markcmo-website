// ═══════════════════════════════════════════════════════════════
// pf-claim-prize.js  (WETYR Arena)
// A winner submits identity to claim their prize (a funded prop account).
// Gates the prize behind KYC + tax reporting (1099 when value > $600).
//
// POST { prize_id, first_name, last_name, dob, country, address }
//
// PII handling: we do NOT store raw ID/DOB/address in the DB. A real build hands
// these to a KYC provider (Persona/Veriff/etc.) and stores only the provider's
// verification reference. Here we mark the claim received, set the tax-form
// requirement, and leave kyc_verified false until the provider/admin confirms.
//
// PENDING go-live: claim-token auth (prove the caller owns the prize), KYC provider
// integration, schema.sql applied.
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbUpdate, sbInsert, corsHeaders } = require('./_lib_supabase');

const TAX_THRESHOLD_CENTS = 60000; // $600 -> 1099 reporting

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return resp(headers, 405, { error: 'POST only' });

  try {
    const b = JSON.parse(event.body || '{}');
    const { prize_id, first_name, last_name, dob, country, address } = b;
    // TODO(auth): verify a signed claim token proves this caller won prize_id.
    if (!prize_id || !first_name || !last_name || !dob || !country || !address) {
      return resp(headers, 400, { error: 'prize_id and full identity fields required' });
    }

    const prizes = await sbSelect(`pf_prizes?id=eq.${encodeURIComponent(prize_id)}&select=*`);
    if (!prizes.length) return resp(headers, 404, { error: 'prize not found' });
    const prize = prizes[0];
    if (prize.fulfillment_status === 'issued' || prize.fulfillment_status === 'redeemed') {
      return resp(headers, 409, { error: 'prize already issued', status: prize.fulfillment_status });
    }

    // Determine tax-form requirement by prize value.
    const valueCents = Number(prize.account_size_cents || 0);
    const taxStatus = valueCents > TAX_THRESHOLD_CENTS ? 'requested' : 'none';

    // Mark the claim received. kyc_verified stays false until a provider/admin confirms.
    // We store NO raw PII here, only that a claim was submitted.
    await sbUpdate('pf_prizes', `id=eq.${encodeURIComponent(prize_id)}`, {
      tax_form_status: taxStatus,
      notes: 'claim submitted; KYC pending provider/admin review',
    });

    await sbInsert('pf_audit_log', {
      trader_id: prize.trader_id, account_id: null,
      event: 'prize_claim_submitted', actor: 'trader',
      detail: { prize_id, country, tax_form: taxStatus }, // no name/DOB/address stored
    });

    return resp(headers, 200, {
      ok: true, prize_id,
      next: 'kyc_review',
      tax_form_required: taxStatus === 'requested',
      message: 'Claim received. After identity review your funded account will be issued by email.',
    });
  } catch (e) {
    return resp(headers, 500, { error: e.message });
  }
};

function resp(headers, statusCode, obj) {
  return { statusCode, headers, body: JSON.stringify(obj) };
}
