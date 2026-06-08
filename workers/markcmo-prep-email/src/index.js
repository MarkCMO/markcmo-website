// markcmo-prep-email worker
//
// Receives inbound emails routed to prep@markcmo.com (and prep@wetyr.com
// in the future) via Cloudflare Email Routing. Classifies each reply as
// confirmation / prep_details / cancellation / question, updates the
// matching mc_engagements row in Supabase, writes an audit-log entry,
// and forwards a structured summary to mark@markcmo.com so he sees the
// reply in his inbox AND the system records the signal.
//
// This is the inbound half of the calendly booking communication system.
// The outbound side lives in functions/api/calendly-webhook.js.
//
// Self-contained - no external packages. Parses the raw RFC 822 email
// using simple header + body splitting + quoted-printable decoding.

const HANDLER_VERSION = 'prep-email-v1-2026-06-08';

export default {
  // Inbound email handler. Called by CF Email Routing when an email
  // arrives at any address routed to this worker.
  async email(message, env, ctx) {
    const audit = {
      from: '',
      to: '',
      subject: '',
      body_preview: '',
      classification: null,
      classification_confidence: null,
      engagement_id: null,
      client_id: null,
      keyword_hits: [],
      forwarded: false,
      forward_status: null,
      step: 'received',
      error_message: null,
      handler_version: HANDLER_VERSION,
    };

    try {
      // message.from is the SMTP envelope MAIL FROM, which for emails sent
      // via Resend / SES / SendGrid is typically a bounce-tracking address
      // like 0100019ea899b2a2-cd7d9856-d7ea@bounces.amazonses.com - NOT the
      // human sender. We use it only as a fallback. The real sender is in
      // the parsed "From:" header.
      const envelopeFrom = (message.from || '').toLowerCase().trim();
      audit.to = (message.to || '').toLowerCase().trim();

      const rawText = await readStreamToString(message.raw);
      const parsed = parseRfc822(rawText);
      audit.subject = (parsed.subject || '').substring(0, 200);
      audit.body_preview = parsed.body.substring(0, 300);
      audit.step = 'parsed';

      // Extract the actual sender email from the parsed "From:" header
      const headerFromEmail = extractEmailAddress(parsed.fromRaw).toLowerCase();
      audit.from = headerFromEmail || envelopeFrom;
      audit.envelope_from = envelopeFrom;

      // Look up engagement by sender email (prefer header From over envelope From)
      let engagement = null;
      let client = null;
      const senderEmail = audit.from;
      if (senderEmail) {
        const clients = await sbSelect(env,
          `mc_clients?primary_contact_email=eq.${encodeURIComponent(senderEmail)}&select=id,primary_contact_name,primary_contact_email&limit=1`);
        if (clients && clients[0]) {
          client = clients[0];
          audit.client_id = client.id;
          const engs = await sbSelect(env,
            `mc_engagements?client_id=eq.${encodeURIComponent(client.id)}&status=eq.lead&order=created_at.desc&limit=1&select=id,metadata,name`);
          if (engs && engs[0]) {
            engagement = engs[0];
            audit.engagement_id = engagement.id;
          }
        }
      }
      audit.step = engagement ? 'matched_engagement' : 'no_engagement_match';

      // Classify
      const cls = classifyReply(parsed.body, audit.subject);
      audit.classification = cls.label;
      audit.classification_confidence = cls.confidence;
      audit.keyword_hits = cls.hits;
      audit.step = 'classified';

      // Update engagement metadata
      if (engagement) {
        const meta = engagement.metadata || {};
        const nowIso = new Date().toISOString();

        if (cls.label === 'confirmation') {
          meta.attended_confirmed_at = meta.attended_confirmed_at || nowIso;
          meta.attended_confirmed_via = meta.attended_confirmed_via || 'reply_classified';
        }
        if (cls.label === 'prep_details') {
          const priorPrep = meta.prep_details || '';
          const stamped = `[${nowIso}] ${parsed.body.substring(0, 4000)}`;
          meta.prep_details = priorPrep ? `${priorPrep}\n\n---\n\n${stamped}` : stamped;
          // A substantive reply also counts as confirmation signal
          meta.attended_confirmed_at = meta.attended_confirmed_at || nowIso;
          meta.attended_confirmed_via = meta.attended_confirmed_via || 'reply_with_details';
        }
        if (cls.label === 'cancellation') {
          meta.cancel_requested_at = meta.cancel_requested_at || nowIso;
          meta.cancel_requested_via = 'reply_classified';
        }
        meta.last_reply_at = nowIso;
        meta.last_reply_classification = cls.label;
        meta.last_reply_preview = parsed.body.substring(0, 400);

        try {
          await sbUpdate(env, 'mc_engagements',
            `id=eq.${encodeURIComponent(engagement.id)}`, { metadata: meta });
          audit.step = 'engagement_updated';
        } catch (e) {
          audit.step = 'engagement_update_failed';
          audit.error_message = (e && e.message) || String(e);
        }
      }

      // Audit log
      try {
        await sbInsert(env, 'mc_audit_log', {
          client_id: audit.client_id,
          engagement_id: audit.engagement_id,
          event: 'invitee_reply_received',
          payload: {
            from: audit.from,
            to: audit.to,
            subject: audit.subject,
            body_preview: audit.body_preview,
            classification: audit.classification,
            classification_confidence: audit.classification_confidence,
            keyword_hits: audit.keyword_hits,
            handler_version: HANDLER_VERSION,
          },
        });
      } catch (_) {}

      // Forward structured summary
      try {
        await forwardToMark(env, {
          senderEmail: audit.from,
          senderName: client?.primary_contact_name || extractDisplayName(parsed.fromRaw) || audit.from,
          subject: audit.subject,
          body: parsed.body,
          classification: cls,
          engagement,
        });
        audit.forwarded = true;
      } catch (e) {
        audit.forward_status = `err: ${(e && e.message) || String(e)}`;
      }

      audit.step = 'done';
      console.log('prep-email handled', JSON.stringify({
        from: audit.from,
        classification: audit.classification,
        engagement_id: audit.engagement_id,
      }));
    } catch (err) {
      audit.error_message = (err && err.message) || String(err);
      audit.step = 'crashed';
      console.error('prep-email crashed', audit.error_message, err && err.stack);
      try {
        await message.forward('mark@markcmo.com');
      } catch (_) {}
      try {
        await sbInsert(env, 'mc_audit_log', {
          event: 'invitee_reply_crashed',
          payload: audit,
        });
      } catch (_) {}
    }
  },
};

// ───── RFC 822 parser ───────────────────────────────────────────
function parseRfc822(raw) {
  const sepIdx = raw.indexOf('\r\n\r\n');
  const altSepIdx = raw.indexOf('\n\n');
  const splitAt = sepIdx >= 0 ? sepIdx : (altSepIdx >= 0 ? altSepIdx : raw.length);
  const headerBlock = raw.substring(0, splitAt);
  const sepLen = sepIdx >= 0 ? 4 : 2;
  let body = raw.substring(splitAt + sepLen);

  const headers = {};
  const unfolded = headerBlock.replace(/\r?\n[\t ]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) headers[m[1].toLowerCase()] = m[2];
  }

  const subject = decodeMimeWord(headers['subject'] || '');
  const cte = (headers['content-transfer-encoding'] || '').toLowerCase().trim();
  if (cte === 'quoted-printable') body = decodeQuotedPrintable(body);
  else if (cte === 'base64') { try { body = atob(body.replace(/\s+/g, '')); } catch (_) {} }

  const ct = (headers['content-type'] || '').toLowerCase();
  if (ct.startsWith('multipart/')) {
    const bndMatch = ct.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
    const boundary = bndMatch ? (bndMatch[1] || bndMatch[2]) : null;
    if (boundary) {
      const part = extractFirstTextPart(body, boundary);
      if (part) body = part;
    }
  }

  if (/<[a-z][^>]*>/i.test(body)) {
    body = body.replace(/<style[\s\S]*?<\/style>/gi, '')
               .replace(/<script[\s\S]*?<\/script>/gi, '')
               .replace(/<[^>]+>/g, ' ')
               .replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&#39;/g, "'")
               .replace(/&quot;/g, '"');
  }
  body = body.replace(/\r?\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  const quoteCut = body.search(/\n>\s|\nOn\s.{0,60}wrote:\s|\n-+\s*Original Message\s*-+/i);
  if (quoteCut > 0) body = body.substring(0, quoteCut).trim();

  return {
    subject,
    fromRaw: headers['from'] || '',
    inReplyTo: headers['in-reply-to'] || '',
    body,
  };
}

function extractFirstTextPart(body, boundary) {
  const parts = body.split('--' + boundary);
  for (const part of parts) {
    if (!part || part.startsWith('--')) continue;
    const sep = part.indexOf('\r\n\r\n');
    const altSep = part.indexOf('\n\n');
    const partSplit = sep >= 0 ? sep : (altSep >= 0 ? altSep : -1);
    if (partSplit < 0) continue;
    const partHeaderBlock = part.substring(0, partSplit).toLowerCase();
    let partBody = part.substring(partSplit + (sep >= 0 ? 4 : 2));
    const partCte = (partHeaderBlock.match(/content-transfer-encoding:\s*(\S+)/i) || [, ''])[1].toLowerCase();
    if (partCte === 'quoted-printable') partBody = decodeQuotedPrintable(partBody);
    else if (partCte === 'base64') { try { partBody = atob(partBody.replace(/\s+/g, '')); } catch (_) {} }
    if (partHeaderBlock.includes('text/plain')) return partBody;
  }
  for (const part of parts) {
    if (!part || part.startsWith('--')) continue;
    const sep = part.indexOf('\r\n\r\n');
    const altSep = part.indexOf('\n\n');
    const partSplit = sep >= 0 ? sep : (altSep >= 0 ? altSep : -1);
    if (partSplit < 0) continue;
    const partHeaderBlock = part.substring(0, partSplit).toLowerCase();
    let partBody = part.substring(partSplit + (sep >= 0 ? 4 : 2));
    const partCte = (partHeaderBlock.match(/content-transfer-encoding:\s*(\S+)/i) || [, ''])[1].toLowerCase();
    if (partCte === 'quoted-printable') partBody = decodeQuotedPrintable(partBody);
    else if (partCte === 'base64') { try { partBody = atob(partBody.replace(/\s+/g, '')); } catch (_) {} }
    if (partHeaderBlock.includes('text/html')) return partBody;
  }
  return null;
}

function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeMimeWord(str) {
  return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (_, charset, enc, content) => {
    try {
      if (enc.toUpperCase() === 'B') return atob(content);
      if (enc.toUpperCase() === 'Q') {
        return content.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi,
          (__, hex) => String.fromCharCode(parseInt(hex, 16)));
      }
    } catch (_) {}
    return content;
  });
}

function extractDisplayName(fromRaw) {
  if (!fromRaw) return '';
  const m = fromRaw.match(/^([^<]+?)\s*<([^>]+)>$/) || fromRaw.match(/"([^"]+)"\s*<([^>]+)>/);
  return m ? m[1].trim().replace(/^"|"$/g, '') : '';
}

// Pull the email address out of a "From:" header value. Handles formats:
//   "Display Name" <user@example.com>
//   Display Name <user@example.com>
//   user@example.com
function extractEmailAddress(fromRaw) {
  if (!fromRaw) return '';
  // angle-bracket form
  const angle = fromRaw.match(/<\s*([^>\s]+@[^>\s]+)\s*>/);
  if (angle) return angle[1].trim();
  // bare email (anywhere in the string)
  const bare = fromRaw.match(/([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/);
  return bare ? bare[1].trim() : '';
}

async function readStreamToString(stream) {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let total = 0;
  for (const c of chunks) total += c.length;
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

// ───── classifyReply ───────────────────────────────────────────
function classifyReply(body, subject) {
  const text = (subject + ' ' + body).toLowerCase();
  const hits = [];

  const cancelWords = ['cancel', 'reschedule', "can't make it", 'cannot make it', "won't be able", 'need to push', 'something came up', 'pushing it back', 'move this', 'have to skip', 'unable to attend'];
  let cancelScore = 0;
  for (const w of cancelWords) if (text.includes(w)) { cancelScore++; hits.push(`cancel:${w}`); }

  const confirmWords = ["i'll be there", 'see you', 'see u then', 'looking forward', 'confirmed', 'confirming', "i'm in", 'i am in', 'sounds good', 'works for me', 'looking forward to it', "i'll see you", 'will attend', "i'll join", "i'll be on"];
  let confirmScore = 0;
  for (const w of confirmWords) if (text.includes(w)) { confirmScore++; hits.push(`confirm:${w}`); }

  if (cancelScore > 0) {
    return { label: 'cancellation', confidence: Math.min(1, 0.6 + cancelScore * 0.15), hits };
  }

  const bodyLen = body.trim().length;
  if (confirmScore > 0 && bodyLen < 120) {
    return { label: 'confirmation', confidence: Math.min(1, 0.5 + confirmScore * 0.15), hits };
  }

  if (bodyLen >= 60) {
    return { label: 'prep_details', confidence: bodyLen > 250 ? 0.85 : 0.6, hits };
  }

  if (/[?]/.test(body)) {
    return { label: 'question', confidence: 0.5, hits };
  }

  if (confirmScore > 0) {
    return { label: 'confirmation', confidence: Math.min(1, 0.4 + confirmScore * 0.1), hits };
  }

  return { label: 'other', confidence: 0.3, hits };
}

// ───── forwardToMark ───────────────────────────────────────────
async function forwardToMark(env, { senderEmail, senderName, subject, body, classification, engagement }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return;

  const labelColors = {
    confirmation: '#2EBA73', prep_details: '#1a4d8c', cancellation: '#e74c3c',
    question: '#C9A84C', other: '#64748B',
  };
  const labelText = {
    confirmation: '✓ CONFIRMED', prep_details: '📋 PREP DETAILS',
    cancellation: '✗ CANCELLATION REQUEST', question: '? QUESTION', other: '✉ REPLY',
  };
  const color = labelColors[classification.label] || '#64748B';
  const label = labelText[classification.label] || 'REPLY';
  const confidencePct = Math.round(classification.confidence * 100);
  const sched = engagement?.metadata?.scheduled_at || '';
  const whenStr = sched
    ? new Date(sched).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/New_York' }) + ' ET'
    : '(no matched booking)';
  const showProb = engagement ? computeShowProbability(engagement.metadata || {}) : null;
  const showProbLine = showProb != null ? `Show prob: ${showProb}%` : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border-top:4px solid ${color};">
  <div style="padding:20px 24px;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${color};margin-bottom:6px;font-weight:700;">${label}</div>
    <h1 style="font-size:18px;margin:0 0 6px;color:#0a0f2c;">${esc(senderName)}</h1>
    <div style="font-size:13px;color:#64748B;margin-bottom:4px;">${esc(senderEmail)} · ${esc(whenStr)}</div>
    <div style="font-size:11px;color:#94A3B8;margin-bottom:16px;">Confidence ${confidencePct}% · ${esc(classification.hits.slice(0, 6).join(', ') || 'no keyword hits')}${showProbLine ? ` · ${esc(showProbLine)}` : ''}</div>
    <div style="background:#F8FAFC;border-left:3px solid ${color};padding:14px 16px;border-radius:4px;font-size:14px;line-height:1.6;color:#1E293B;white-space:pre-wrap;">${esc(body.substring(0, 4000))}</div>
    ${engagement?.id ? `<div style="margin-top:14px;font-size:12px;color:#94A3B8;">Engagement <code style="background:#F1F5F9;padding:2px 6px;border-radius:3px;">${esc(engagement.id)}</code></div>` : ''}
  </div>
</div>
</body></html>`;

  const text = `${label} from ${senderName} (${senderEmail})\nFor meeting: ${whenStr}\nConfidence: ${confidencePct}%  ${showProbLine}\nKeywords: ${classification.hits.slice(0, 6).join(', ') || 'none'}\n\n---ORIGINAL---\nSubject: ${subject}\n\n${body}\n\n---\nEngagement: ${engagement?.id || '(no match)'}`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MarkCMO Prep <forms@markcmo.com>',
      to: ['mark@markcmo.com', 'marklgabriellijr@gmail.com'],
      reply_to: senderEmail || 'mark@markcmo.com',
      subject: `${label} from ${senderName}`,
      html,
      text,
      tags: [
        { name: 'category', value: 'inbound_reply_summary' },
        { name: 'classification', value: classification.label },
      ],
    }),
  });
}

function computeShowProbability(meta) {
  let score = 50;
  if (meta.attended_confirmed_at) score += 35;
  if (meta.cancel_requested_at) score -= 60;
  if (meta.last_reply_classification === 'confirmation') score += 15;
  if (meta.last_reply_classification === 'prep_details') score += 25;
  if (meta.last_reply_classification === 'cancellation') score -= 40;
  if (meta.prep_details && meta.prep_details.length > 100) score += 10;
  return Math.max(0, Math.min(100, score));
}

// ───── Supabase REST helpers ───────────────────────────────────
function sbHeaders(env) {
  const key = env.MARKCMO_SUPABASE_SERVICE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
async function sbSelect(env, path) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders(env) });
  if (!res.ok) throw new Error(`sbSelect ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function sbInsert(env, table, body) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbInsert ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function sbUpdate(env, table, filter, body) {
  const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sbUpdate ${table} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
