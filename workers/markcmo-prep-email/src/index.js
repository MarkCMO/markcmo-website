// markcmo-prep-email worker
//
// Receives inbound emails routed to prep@markcmo.com (and prep@wetyr.com)
// via Cloudflare Email Routing. Classifies each reply as confirmation /
// prep_details / cancellation / question, updates the matching mc_engagements
// row in Supabase, and writes an audit-log entry.
//
// Mark's directive 2026-06-09: "do not send prep received emails to me.
// you keep that internally and if something fails self heal it."
// So this worker NO LONGER emails Mark on classified replies, NO LONGER
// emails him on crashes. All signals flow into mc_engagements.metadata +
// mc_audit_log only. Mark sees the data via /admin/bookings instead of
// his inbox. Transient failures retry with backoff before being logged
// as terminal errors.
//
// The only remaining outbound is the catch-all forward of UNMATCHED
// inbound (random external email to prep@markcmo.com) to Mark's Gmail -
// this is the email-routing safety net for legit new prospects emailing
// prep@ directly, NOT a prep notification.
//
// Self-contained - no external packages. Parses the raw RFC 822 email
// using simple header + body splitting + quoted-printable decoding.

const HANDLER_VERSION = 'prep-email-v2-self-heal-no-notify-2026-06-09';

// Self-heal: retry Supabase writes with exponential backoff before
// giving up. Transient 502/504/timeout on Supabase shouldn't lose data.
async function withRetry(fn, label) {
  const delays = [0, 500, 2000]; // 3 attempts: immediate, 500ms, 2s
  let lastErr = null;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      // Don't retry on client-side errors (4xx) - only transient (5xx/network)
      const msg = (e && e.message) || String(e);
      if (/\b4\d\d\b/.test(msg) && !/\b408\b|\b429\b/.test(msg)) {
        throw e; // permanent failure
      }
    }
  }
  // All retries exhausted - log loud, no email to Mark
  console.error(`prep-email self-heal exhausted: ${label} failed after 3 attempts:`, (lastErr && lastErr.message) || lastErr);
  throw lastErr;
}

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

      // ─── Mark's personal inbound capture ───────────────────────
      // Mark's directive 2026-06-10: "make it land in mark@markcmo.com
      // instead of marklgabriellijr@gmail.com." Extended same-day to also
      // cover info@wetyr.com (fix #2). All of Mark's personal addresses
      // route through this worker and land in the /mail.html webmail.
      //
      // For mail addressed to any of Mark's mailbox addresses, store the
      // full message in mc_mailbox_messages with direction=inbound so
      // Mark sees it in his webmail Inbox at /mail.html. We do NOT
      // classify it as a prep reply; that's a separate flow for
      // prep@markcmo.com only.
      const MARKS_MAILBOXES = new Set([
        'mark@markcmo.com',
        'info@wetyr.com',
      ]);
      if (MARKS_MAILBOXES.has(audit.to)) {
        try {
          // Extract auth result headers stamped by CF Email Routing
          const authResults = (parsed.headers['authentication-results'] || '').toLowerCase();
          const spfResult = (authResults.match(/spf=([a-z]+)/) || [])[1] || null;
          const dkimResult = (authResults.match(/dkim=([a-z]+)/) || [])[1] || null;
          const dmarcResult = (authResults.match(/dmarc=([a-z]+)/) || [])[1] || null;

          const fromName = extractDisplayName(parsed.fromRaw) || '';
          const bodyText = parsed.body || '';

          await withRetry(
            () => sbInsert(env, 'mc_mailbox_messages', {
              direction: 'inbound',
              from_addr: headerFromEmail || envelopeFrom,
              from_name: fromName || null,
              to_addrs: [audit.to],
              reply_to: parsed.headers['reply-to'] || null,
              subject: audit.subject,
              body_text: bodyText.substring(0, 32000),
              body_html: (parsed.htmlBody || null),
              body_preview: bodyText.replace(/\s+/g, ' ').trim().slice(0, 240),
              raw_headers: parsed.headers || null,
              spf_result: spfResult,
              dkim_result: dkimResult,
              dmarc_result: dmarcResult,
              message_id_header: parsed.headers['message-id'] || null,
              in_reply_to: parsed.headers['in-reply-to'] || null,
              references_header: parsed.headers['references'] || null,
              metadata: { handler_version: HANDLER_VERSION, envelope_from: envelopeFrom },
            }),
            'mailbox_inbound_store',
          );
          audit.step = 'stored_in_mailbox';
        } catch (e) {
          audit.step = 'mailbox_store_failed';
          audit.error_message = (e && e.message) || String(e);
          console.error('MAILBOX_INBOUND_STORE_FAILED', JSON.stringify({
            from: audit.from, subject: audit.subject,
            error: (e && e.message) || String(e),
          }));
        }
        // Done - inbound to mark@ does NOT go through the prep classifier.
        // Return early so we skip the engagement match / classification path.
        return;
      }

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

      // If sender doesn't match any known client, this isn't a prospect
      // reply. Per Mark's directive 2026-06-09 ("do not send prep received
      // emails to me, keep internal"), we no longer forward unmatched
      // inbound to Mark's Gmail. Instead we log to audit_log so /admin
      // can surface unmatched inbound as a triage queue when Mark wants
      // to browse it. The prep@markcmo.com address is for SYSTEM replies
      // (Calendly Reply-To); external contact should use mark@markcmo.com.
      if (!engagement) {
        try {
          await withRetry(
            () => sbInsert(env, 'mc_audit_log', {
              event: 'prep_inbound_unmatched',
              payload: {
                from: audit.from,
                envelope_from: audit.envelope_from,
                to: audit.to,
                subject: audit.subject,
                body_preview: parsed.body.substring(0, 1500),
                handler_version: HANDLER_VERSION,
              },
            }),
            'unmatched_inbound_log',
          );
        } catch (e) {
          // Last-resort: structured log so it can be reconstructed from tail
          console.error('UNMATCHED_INBOUND_LOG_FAILED', JSON.stringify({
            from: audit.from,
            subject: audit.subject,
            error: (e && e.message) || String(e),
          }));
        }
        return;
      }

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

        // Self-heal: retry the engagement update on transient failures.
        // Per Mark's directive: do NOT email him on failure - just keep
        // trying and log the final outcome to audit_log.
        try {
          await withRetry(
            () => sbUpdate(env, 'mc_engagements',
              `id=eq.${encodeURIComponent(engagement.id)}`, { metadata: meta }),
            `engagement_update:${engagement.id}`,
          );
          audit.step = 'engagement_updated';
        } catch (e) {
          audit.step = 'engagement_update_failed_after_retry';
          audit.error_message = (e && e.message) || String(e);
          // The reply STILL classified successfully - the data lives in
          // the audit_log payload below even if the engagement row didn't
          // get updated. /admin/bookings can reconcile from the audit log.
        }
      }

      // Audit log (also retried - this is the durable record)
      try {
        await withRetry(
          () => sbInsert(env, 'mc_audit_log', {
            client_id: audit.client_id,
            engagement_id: audit.engagement_id,
            event: 'invitee_reply_received',
            payload: {
              from: audit.from,
              to: audit.to,
              subject: audit.subject,
              body_preview: audit.body_preview,
              body_full: parsed.body.substring(0, 8000),
              classification: audit.classification,
              classification_confidence: audit.classification_confidence,
              keyword_hits: audit.keyword_hits,
              engagement_update_step: audit.step,
              handler_version: HANDLER_VERSION,
            },
          }),
          'audit_log_insert',
        );
      } catch (e) {
        // Audit log write exhausted retries. No email. Log loud to CF
        // tail so /admin can surface this on the ops dashboard later.
        console.error('AUDIT_LOG_TERMINAL_FAILURE', JSON.stringify({
          from: audit.from,
          classification: audit.classification,
          subject: audit.subject,
          error: (e && e.message) || String(e),
        }));
      }

      // NO forwardToMark call - removed per Mark's directive.
      // Reply signals live in mc_engagements.metadata + mc_audit_log.
      // Mark sees them in /admin/bookings dashboard, not his inbox.

      audit.step = 'done';
      console.log('prep-email handled', JSON.stringify({
        from: audit.from,
        classification: audit.classification,
        engagement_id: audit.engagement_id,
      }));
    } catch (err) {
      audit.error_message = (err && err.message) || String(err);
      audit.step = 'crashed';
      // Log to CF tail for ops visibility. NO email forward to Mark
      // per his directive - "if something fails self heal it" means
      // log + retry + fix, never email.
      console.error('prep-email crashed', audit.error_message, err && err.stack);
      // One last attempt to record the crash to the audit log so it's
      // visible from /admin without checking CF tail. Best-effort, no
      // retry (we're already in the crash branch).
      try {
        await sbInsert(env, 'mc_audit_log', {
          event: 'invitee_reply_crashed',
          payload: audit,
        });
      } catch (_) {
        // Final fallback: structured JSON in CF logs so the alert can
        // be reconstructed from tail. No email.
        console.error('CRASH_AUDIT_INSERT_FAILED', JSON.stringify(audit));
      }
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

// forwardToMark() removed 2026-06-09 per Mark's directive: "do not send
// prep received emails to me. you keep that internally and if something
// fails self heal it." Classification signals now flow ONLY into
// mc_engagements.metadata + mc_audit_log, viewable via /admin/bookings.

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
