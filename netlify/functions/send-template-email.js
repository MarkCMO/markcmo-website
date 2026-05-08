// ═══════════════════════════════════════════════════════════════
// send-template-email.js
//
// Admin-gated. Sends an mc_email_templates email to one (or many)
// mc_clients with {{variable}} substitution. Adds the per-client
// cc_emails to the CC list, logs a row to mc_journey_events with
// the Resend message ID so the customer-journey timeline + dashboard
// open/click stats correlate.
//
// POST body:
//   {
//     templateSlug: 'discovery-call-invite',  // OR templateId
//     clientSlug: 'wendal-enterprise',        // OR clientId
//     variables: { trigger_observation: '...', date_window: 'next Tuesday' },
//     ccOverride: ['cfo@x.com'],              // optional, defaults to client.cc_emails + Mark's gmail
//     replyTo: 'mark@markcmo.com',            // optional
//     testRecipient: 'mark@markcmo.com',      // optional, routes the email to this address instead of the client
//   }
//
// Returns: { ok, sent_to, cc, subject, resend_id, journey_id }
// ═══════════════════════════════════════════════════════════════
const { sbSelect, sbUpdate, sbInsert, isAdminAuthed, corsHeaders, buildClientCcList } = require('./_lib_supabase');

exports.handler = async (event) => {
  const headers = corsHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  if (!(await isAdminAuthed(event))) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'RESEND_API_KEY not set' }) };

  // ─── Resolve template ─────────────────────────────────────────
  let template;
  try {
    if (body.templateId) {
      const r = await sbSelect(`mc_email_templates?id=eq.${encodeURIComponent(body.templateId)}&select=*&limit=1`);
      template = r[0];
    } else if (body.templateSlug) {
      const r = await sbSelect(`mc_email_templates?slug=eq.${encodeURIComponent(body.templateSlug)}&select=*&limit=1`);
      template = r[0];
    }
  } catch (e) { return { statusCode: 500, headers, body: JSON.stringify({ error: 'Template lookup failed: ' + e.message }) }; }
  if (!template) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Template not found' }) };
  if (!template.is_active) return { statusCode: 400, headers, body: JSON.stringify({ error: `Template "${template.slug}" is inactive` }) };

  // ─── Resolve client ───────────────────────────────────────────
  let client;
  try {
    if (body.clientId) {
      const r = await sbSelect(`mc_clients?id=eq.${encodeURIComponent(body.clientId)}&select=*&limit=1`);
      client = r[0];
    } else if (body.clientSlug) {
      const r = await sbSelect(`mc_clients?slug=eq.${encodeURIComponent(body.clientSlug)}&select=*&limit=1`);
      client = r[0];
    }
  } catch (e) { return { statusCode: 500, headers, body: JSON.stringify({ error: 'Client lookup failed: ' + e.message }) }; }
  if (!client) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Client not found' }) };

  // ─── Substitute {{variables}} in subject + body + preheader ───
  const vars = {
    // sensible defaults from client
    client_legal_name: client.legal_name || '',
    client_dba: client.dba || '',
    first_name: (client.primary_contact_name || '').split(' ')[0] || 'there',
    full_name: client.primary_contact_name || '',
    title: client.primary_contact_title || '',
    email: client.primary_contact_email || '',
    company: client.dba || client.legal_name || '',
    // user overrides (anything passed in `variables` clobbers the defaults)
    ...(body.variables || {}),
  };
  // Track which vars are missing/empty so we can refuse before sending
  const missing = new Set();
  const sub = (s) => String(s || '').replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => {
    const v = vars[k];
    if (v === undefined || v === null || String(v).trim() === '') {
      missing.add(k);
      return `{{${k}}}`;
    }
    return String(v);
  });
  const subject = sub(template.subject);
  const html = sub(template.html_body);
  const preheader = template.preheader ? sub(template.preheader) : null;

  // ─── Guard: refuse to send (or dry-run) with unfilled placeholders ──
  // The user explicitly hit this bug once: a [TEST] email landed with
  // "Quick {{topic}} call?" as the subject because `topic` was unfilled.
  // Now any unfilled {{var}} in subject/preheader/body kills the send
  // with a 422 + the list of missing keys. Dry-run path skips the
  // Resend call but still surfaces the rendered subject/preview/missing
  // so the caller can show a preview UI before consenting to send.
  const dryRun = !!body.dry_run;
  if (missing.size && !body.allow_partial) {
    return {
      statusCode: dryRun ? 200 : 422,
      headers,
      body: JSON.stringify({
        ok: false,
        error: dryRun ? null : 'Unfilled template variables, refusing to send. Pass values in `variables` or set `allow_partial: true` to ignore (not recommended).',
        missing_variables: Array.from(missing),
        rendered_subject: subject,
        rendered_preheader: preheader,
        dry_run: dryRun,
        ...(dryRun ? { rendered_html: html } : {}),
      }),
    };
  }

  // ─── Dry-run: return rendered output without calling Resend ─────
  if (dryRun) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        dry_run: true,
        sent: false,
        rendered_subject: subject,
        rendered_preheader: preheader,
        rendered_html: html,
        recipient_email: client.primary_contact_email,
        cc: buildClientCcList(client),
        template_slug: template.slug,
        client_slug: client.slug,
        missing_variables: Array.from(missing),
      }),
    };
  }

  // ─── Recipients + CC ──────────────────────────────────────────
  const testMode = !!body.testRecipient;
  const recipientEmail = testMode ? body.testRecipient : client.primary_contact_email;
  if (!recipientEmail) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No recipient (client has no primary_contact_email and no testRecipient)' }) };

  let ccList;
  if (Array.isArray(body.ccOverride)) ccList = body.ccOverride;
  else ccList = buildClientCcList(client);
  ccList = ccList.filter(e => e && e !== recipientEmail);

  // ─── Wrap a hidden tracking pixel + preheader ─────────────────
  const trackUrl = `https://markcmo.com/.netlify/functions/track?t=pixel&c=${encodeURIComponent(client.slug)}`;
  const finalHtml = `${preheader ? `<div style="display:none;font-size:1px;color:#fff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ''}${html}<img src="${trackUrl}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" />`;

  // ─── Send via Resend ──────────────────────────────────────────
  let resendData;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Mark Gabrielli <mark@markcmo.com>',
        to: [recipientEmail],
        ...(ccList.length ? { cc: ccList } : {}),
        reply_to: body.replyTo || 'mark@markcmo.com',
        subject: (testMode ? '[TEST] ' : '') + subject,
        html: finalHtml,
        tags: [
          { name: 'template', value: template.slug },
          { name: 'client', value: client.slug },
          ...(testMode ? [{ name: 'mode', value: 'test' }] : []),
        ],
      }),
    });
    resendData = await res.json().catch(() => ({}));
    if (!res.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: 'Resend send failed', detail: resendData }) };
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Resend request failed: ' + e.message }) };
  }

  // ─── Bump template send_count + last_sent_at ──────────────────
  try {
    await sbUpdate('mc_email_templates', `id=eq.${template.id}`, {
      send_count: (Number(template.send_count) || 0) + 1,
      last_sent_at: new Date().toISOString(),
    });
  } catch (e) { console.warn('template counter update failed:', e.message); }

  // ─── Log to journey + audit ───────────────────────────────────
  let journeyId = null;
  try {
    const journey = await sbInsert('mc_journey_events', {
      client_id: client.id,
      category: 'email',
      event: 'email_sent',
      subject_or_url: subject,
      recipient_email: recipientEmail,
      resend_email_id: resendData?.id || null,
      raw: { template: template.slug, template_id: template.id, testMode, cc: ccList, variables: vars },
    });
    journeyId = journey?.[0]?.id || null;
  } catch (e) { console.warn('journey insert failed:', e.message); }

  try {
    await sbInsert('mc_audit_log', {
      client_id: client.id,
      event: testMode ? 'template_email_test_sent' : 'template_email_sent',
      payload: {
        template_slug: template.slug,
        template_id: template.id,
        recipient: recipientEmail,
        cc: ccList,
        subject,
        resend_id: resendData?.id,
        testMode,
      },
    });
  } catch (e) { console.warn('audit insert failed:', e.message); }

  return {
    statusCode: 200, headers,
    body: JSON.stringify({
      ok: true,
      sent_to: recipientEmail,
      cc: ccList,
      subject,
      resend_id: resendData?.id || null,
      journey_id: journeyId,
      template: template.slug,
      testMode,
    }),
  };
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
