// booking-intelligence.js
// ─────────────────────────────────────────────────────────────────
// Domain-level relationship intelligence for inbound Calendly bookings.
//
// Mark's directive (2026-06-09): "Christina@secondlifemac.com booked for
// Scott@secondlifemac.com but our system sent the same confirmed + context
// email as if cold. We need intelligence for return meetings from the same
// domain. We want autonomy but not robotic - request approval to avoid
// dumb emails being sent."
//
// What this module does:
//   - Look up the inviteeEmail's full-domain history in Supabase
//   - Classify the booking as cold | warm_domain | returning_person
//   - Produce a recommendation for the email system (AUTO_SEND |
//     REQUEST_APPROVAL | SUPPRESS) and a human-readable brief Mark sees
//
// What it does NOT do:
//   - Send anything. Caller fires emails / approval requests.
//   - Maintain its own DB. Read-only against mc_clients + mc_engagements
//     + mc_audit_log.
//
// Future hook (cut 2): writes decisions to mc_approval_decisions so the
// classifier can learn Mark's approve/deny patterns over time.

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
  'aol.com', 'me.com', 'mac.com', 'live.com', 'msn.com', 'ymail.com',
  'protonmail.com', 'proton.me', 'pm.me', 'gmx.com', 'gmx.us',
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'cox.net',
  'mail.com', 'mail.ru', 'qq.com', '163.com', 'inbox.com',
]);

// Audit events that count as "we already emailed someone at this domain"
// for the purpose of detecting warm-domain bookings.
const PROSPECT_FACING_EVENTS = [
  'invitee_confirmation_sent',
  'invitee_recap_sent',
  'invitee_followup_sent',
  'invitee_24h_reminder_sent',
  'invitee_1h_reminder_sent',
  'invitee_6h_reminder_sent',
  'invitee_15min_confirm_sent',
  'invitee_rebook_cta_sent',
  'gemini_recap_sent',
];

// How far back to look for "recent" prior emails / bookings
const RECENT_WINDOW_DAYS = 90;

// ───── helpers ────────────────────────────────────────────────────
const sbHeaders = (env) => ({
  apikey: env.MARKCMO_SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${env.MARKCMO_SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
});

async function sbSelectSafe(env, path) {
  try {
    const res = await fetch(`${env.MARKCMO_SUPABASE_URL}/rest/v1/${path}`, {
      headers: sbHeaders(env),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (_) {
    return [];
  }
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function safeDomain(email) {
  if (!email) return '';
  const at = email.lastIndexOf('@');
  if (at < 0) return '';
  return email.slice(at + 1).trim().toLowerCase();
}

// ───── main classifier ────────────────────────────────────────────
//
// Returns:
//   {
//     tier: 'cold' | 'cold_personal' | 'warm_domain' | 'returning_person',
//     domain: string,
//     is_personal_domain: boolean,
//     signals: {
//       same_person_prior_bookings: number,
//       same_person_last_booking_at: ISO | null,
//       other_contacts_in_domain: Array<{ email, name, status, created_at }>,
//       recent_prospect_emails_sent: number,   // last 90d to anyone @ domain
//       recent_emails_to_same_person: number,  // last 90d to this exact email
//       last_email_to_domain_at: ISO | null,
//       last_email_to_same_person_at: ISO | null,
//     },
//     recommend: 'AUTO_SEND' | 'REQUEST_APPROVAL',
//     reason: string,
//     brief: string,   // 2-4 sentence summary suitable for Mark
//   }
export async function classifyBooking(env, { inviteeEmail, inviteeName, scheduledAt }) {
  const emailLower = (inviteeEmail || '').toLowerCase();
  const domain = safeDomain(emailLower);
  const isPersonal = PERSONAL_EMAIL_DOMAINS.has(domain);

  if (!domain) {
    return {
      tier: 'cold',
      domain: '',
      is_personal_domain: false,
      signals: emptySignals(),
      recommend: 'AUTO_SEND',
      reason: 'no_domain_extractable',
      brief: 'No domain on invitee email. Treating as cold.',
    };
  }

  // Personal-email domains (gmail, yahoo, etc.) can't be used for
  // relationship inference - too many strangers share the namespace.
  // For these, we ONLY check the exact email address.
  if (isPersonal) {
    const personalIntel = await lookupSamePersonOnly(env, emailLower);
    const tier = personalIntel.same_person_prior_bookings > 0 ? 'returning_person' : 'cold_personal';
    return {
      tier,
      domain,
      is_personal_domain: true,
      signals: { ...emptySignals(), ...personalIntel },
      recommend: tier === 'returning_person' && personalIntel.recent_emails_to_same_person > 3
        ? 'REQUEST_APPROVAL'
        : 'AUTO_SEND',
      reason: tier === 'returning_person'
        ? 'returning_person_personal_domain'
        : 'first_contact_personal_domain',
      brief: buildBrief({ tier, domain, signals: personalIntel, inviteeEmail: emailLower, inviteeName }),
    };
  }

  // Business domain - look up everything we know about anyone @ domain
  const [domainClients, recentEmailsToDomain, recentEmailsToSamePerson] = await Promise.all([
    sbSelectSafe(
      env,
      `mc_clients?primary_contact_email=ilike.*@${encodeURIComponent(domain)}&select=id,primary_contact_email,primary_contact_name,status,created_at,legal_name&order=created_at.desc&limit=50`,
    ),
    sbSelectSafe(
      env,
      `mc_audit_log?event=in.(${PROSPECT_FACING_EVENTS.join(',')})&payload->>invitee_email=ilike.*@${encodeURIComponent(domain)}&created_at=gte.${daysAgo(RECENT_WINDOW_DAYS)}&select=created_at,event,payload&order=created_at.desc&limit=100`,
    ),
    sbSelectSafe(
      env,
      `mc_audit_log?event=in.(${PROSPECT_FACING_EVENTS.join(',')})&payload->>invitee_email=eq.${encodeURIComponent(emailLower)}&created_at=gte.${daysAgo(RECENT_WINDOW_DAYS)}&select=created_at,event&order=created_at.desc&limit=50`,
    ),
  ]);

  const samePersonClient = domainClients.find(c => (c.primary_contact_email || '').toLowerCase() === emailLower);
  const otherContacts = domainClients
    .filter(c => (c.primary_contact_email || '').toLowerCase() !== emailLower)
    .map(c => ({
      email: c.primary_contact_email,
      name: c.primary_contact_name || '',
      status: c.status || '',
      created_at: c.created_at,
      legal_name: c.legal_name || '',
    }));

  // Count same-person prior bookings (look at audit_log for calendly_booking_created)
  const samePersonBookings = await sbSelectSafe(
    env,
    `mc_audit_log?event=eq.calendly_booking_created&payload->>invitee_email=eq.${encodeURIComponent(emailLower)}&select=created_at,payload&order=created_at.desc&limit=10`,
  );

  const signals = {
    same_person_prior_bookings: samePersonBookings.length,
    same_person_last_booking_at: samePersonBookings[0]?.created_at || null,
    other_contacts_in_domain: otherContacts.slice(0, 10),
    other_contacts_in_domain_count: otherContacts.length,
    recent_prospect_emails_sent: recentEmailsToDomain.length,
    recent_emails_to_same_person: recentEmailsToSamePerson.length,
    last_email_to_domain_at: recentEmailsToDomain[0]?.created_at || null,
    last_email_to_same_person_at: recentEmailsToSamePerson[0]?.created_at || null,
  };

  // Classification rules
  let tier;
  let recommend;
  let reason;

  if (samePersonBookings.length > 0 || samePersonClient) {
    tier = 'returning_person';
    if (signals.recent_emails_to_same_person >= 7) {
      // We've already blasted them with 7 emails from a recent booking.
      // Another full sequence would be spam - ASK Mark first.
      recommend = 'REQUEST_APPROVAL';
      reason = 'returning_person_with_recent_high_email_volume';
    } else if (signals.same_person_prior_bookings >= 2) {
      // Frequent rebooker who knows us - ask Mark whether to send the
      // full cold-template sequence (probably he wants warm follow-up).
      recommend = 'REQUEST_APPROVAL';
      reason = 'returning_person_multiple_prior_bookings';
    } else {
      recommend = 'AUTO_SEND';
      reason = 'returning_person_single_prior_booking';
    }
  } else if (otherContacts.length > 0 || recentEmailsToDomain.length > 0) {
    // Someone NEW at a domain we already have relationships at.
    // This is the Christina-booking-Scott case. Always ask Mark.
    tier = 'warm_domain';
    recommend = 'REQUEST_APPROVAL';
    reason = otherContacts.length > 0
      ? 'warm_domain_existing_contacts'
      : 'warm_domain_recent_outbound';
  } else {
    tier = 'cold';
    recommend = 'AUTO_SEND';
    reason = 'first_contact_from_business_domain';
  }

  return {
    tier,
    domain,
    is_personal_domain: false,
    signals,
    recommend,
    reason,
    brief: buildBrief({ tier, domain, signals, inviteeEmail: emailLower, inviteeName }),
  };
}

// ───── personal-domain shortcut ───────────────────────────────────
async function lookupSamePersonOnly(env, emailLower) {
  const [sameClient, sameBookings, sameEmails] = await Promise.all([
    sbSelectSafe(
      env,
      `mc_clients?primary_contact_email=eq.${encodeURIComponent(emailLower)}&select=id,primary_contact_email,primary_contact_name,status,created_at&limit=1`,
    ),
    sbSelectSafe(
      env,
      `mc_audit_log?event=eq.calendly_booking_created&payload->>invitee_email=eq.${encodeURIComponent(emailLower)}&select=created_at&order=created_at.desc&limit=10`,
    ),
    sbSelectSafe(
      env,
      `mc_audit_log?event=in.(${PROSPECT_FACING_EVENTS.join(',')})&payload->>invitee_email=eq.${encodeURIComponent(emailLower)}&created_at=gte.${daysAgo(RECENT_WINDOW_DAYS)}&select=created_at&order=created_at.desc&limit=50`,
    ),
  ]);
  return {
    same_person_prior_bookings: sameBookings.length,
    same_person_last_booking_at: sameBookings[0]?.created_at || null,
    other_contacts_in_domain: [],
    other_contacts_in_domain_count: 0,
    recent_prospect_emails_sent: 0,
    recent_emails_to_same_person: sameEmails.length,
    last_email_to_domain_at: null,
    last_email_to_same_person_at: sameEmails[0]?.created_at || null,
  };
}

function emptySignals() {
  return {
    same_person_prior_bookings: 0,
    same_person_last_booking_at: null,
    other_contacts_in_domain: [],
    other_contacts_in_domain_count: 0,
    recent_prospect_emails_sent: 0,
    recent_emails_to_same_person: 0,
    last_email_to_domain_at: null,
    last_email_to_same_person_at: null,
  };
}

// ───── human-readable brief for Mark ──────────────────────────────
function buildBrief({ tier, domain, signals, inviteeEmail, inviteeName }) {
  const name = inviteeName || inviteeEmail;
  const lines = [];

  if (tier === 'cold' || tier === 'cold_personal') {
    lines.push(`${name} is a first-time contact${tier === 'cold' ? ` from @${domain}` : ''}.`);
    lines.push('No prior bookings, no prior emails. Treating as cold lead - sending full welcome + prep sequence.');
  } else if (tier === 'returning_person') {
    lines.push(`${name} has booked with us ${signals.same_person_prior_bookings} time(s) before.`);
    if (signals.last_email_to_same_person_at) {
      const daysAgoN = Math.floor((Date.now() - new Date(signals.last_email_to_same_person_at).getTime()) / 86400000);
      lines.push(`Last email to them: ${daysAgoN} day(s) ago. ${signals.recent_emails_to_same_person} email(s) in last 90 days.`);
    }
  } else if (tier === 'warm_domain') {
    lines.push(`${name} is NEW to us, but @${domain} is not.`);
    if (signals.other_contacts_in_domain.length > 0) {
      const others = signals.other_contacts_in_domain.slice(0, 3).map(c => `${c.name || c.email}`).join(', ');
      lines.push(`We have ${signals.other_contacts_in_domain_count} other contact(s) at @${domain}: ${others}${signals.other_contacts_in_domain_count > 3 ? '...' : ''}.`);
    }
    if (signals.recent_prospect_emails_sent > 0) {
      lines.push(`We sent ${signals.recent_prospect_emails_sent} email(s) to people @${domain} in the last 90 days.`);
    }
    lines.push('Sending the standard cold-template confirmation + prep email might be redundant or read as robotic to someone already inside this relationship.');
  }
  return lines.join(' ');
}
