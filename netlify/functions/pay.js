// ═══════════════════════════════════════════════════════════════
// pay.js
//
// Tracking redirect for Square payment-invoice links. We send the
// client `/pay/{mc_invoices.id}` instead of the raw Square URL so
// every click is logged to mc_journey_events before we 302 to
// Square. Useful for: "did the client see the invoice?", attribution
// of which channel (email reminder vs admin Send Payment Request)
// drove the open, and per-client journey timeline.
//
// _redirects rule maps:  /pay/* → /.netlify/functions/pay?id=:splat
// Direct call also OK:    /.netlify/functions/pay?id=<uuid>
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbInsert } = require('./_lib_supabase');

exports.handler = async (event) => {
  const q = event.queryStringParameters || {};
  const id = (q.id || '').trim();
  const ip = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || event.headers?.['x-real-ip'] || null;
  const ua = event.headers?.['user-agent'] || null;
  const referrer = event.headers?.referer || event.headers?.Referer || null;
  const source = q.src || null;  // optional attribution: email | reminder | sms | admin

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return notFound('Invalid invoice ID');
  }

  let invoice;
  try {
    const rows = await sbSelect(
      `mc_invoices?id=eq.${encodeURIComponent(id)}&select=id,square_invoice_url,status,amount_usd,is_test,engagement_id,mc_engagements(id,client_id,mc_clients(id,slug))`
    );
    invoice = rows[0];
  } catch (e) {
    console.error('pay.js lookup failed:', e.message);
    return notFound('Lookup failed');
  }

  if (!invoice) return notFound('Invoice not found');
  if (!invoice.square_invoice_url) return notFound('No payment link on this invoice yet');

  // Log the click before redirecting
  try {
    await sbInsert('mc_journey_events', {
      client_id: invoice.mc_engagements?.client_id || invoice.mc_engagements?.mc_clients?.id || null,
      engagement_id: invoice.engagement_id,
      invoice_id: invoice.id,
      category: 'payment_link',
      event: 'payment_link_click',
      subject_or_url: invoice.square_invoice_url,
      ip, user_agent: ua, referrer,
      raw: {
        source,
        amount_usd: invoice.amount_usd,
        invoice_status: invoice.status,
        is_test: invoice.is_test,
      },
    });
  } catch (e) { console.warn('payment_link_click insert failed:', e.message); }

  // Netlify merges request query string into Location when the destination
  // has none. Square's invoice URLs already have a path but no query, so
  // append a tracking marker to prevent param leak.
  const sqUrl = invoice.square_invoice_url;
  const finalUrl = sqUrl.includes('?') ? sqUrl : sqUrl + '?_mc=' + Date.now().toString(36);
  return {
    statusCode: 302,
    headers: { Location: finalUrl, 'Cache-Control': 'no-store' },
    body: '',
  };
};

function notFound(message) {
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: `<!doctype html><meta charset="utf-8"><title>Payment link not found</title>
<style>body{font-family:-apple-system,Arial,sans-serif;color:#1E293B;background:#F8FAFC;margin:0;padding:40px;display:flex;align-items:center;justify-content:center;min-height:100vh}
.box{max-width:480px;background:#fff;padding:32px;border-radius:14px;box-shadow:0 8px 24px rgba(10,22,40,0.08);text-align:center}
h1{font-family:'Bebas Neue',Impact,sans-serif;font-size:1.6rem;color:#0A1628;margin:0 0 12px;letter-spacing:0.02em;font-weight:400}
p{margin:0 0 14px;line-height:1.5;color:#475569}
a{color:#2563EB;text-decoration:none;font-weight:600}</style>
<div class="box">
  <h1>Payment Link Not Found</h1>
  <p>${escapeHtml(message)}.</p>
  <p>Please reply to the email you received, or reach out to <a href="mailto:mark@markcmo.com">mark@markcmo.com</a>.</p>
</div>`,
  };
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
