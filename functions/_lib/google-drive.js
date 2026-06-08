// _lib/google-drive.js
//
// Shared Google Drive API helpers for fetching Gemini-generated meeting
// notes after a Google Meet call ends. All calls authenticate using the
// long-lived refresh token captured by /api/google-oauth-callback during
// the one-time OAuth setup.
//
// Strategy: after a meeting ends, Google Meet's "Take Notes for Me"
// (Gemini) feature saves a Google Doc to Mark's Drive within ~5-10 min.
// The doc's title usually contains the meeting name + date. We search
// Drive for the doc, export its plain-text content, and feed that into
// the recap email personalization.
//
// Public helpers:
//   - getAccessToken(env): exchange refresh token for a short-lived
//     access token (good for ~1 hour). Cached per request.
//   - findGeminiMeetingNotes(env, { meetingTitle, endedAtIso, inviteeName }):
//     search Drive for the notes doc that matches a recent meeting.
//   - getDocPlainText(env, fileId): export a Google Doc as text/plain.
//   - extractRecapSections(plainText): parse Gemini's standard sections
//     (Summary, Action items, Discussion points, etc) into a structured
//     object the recap email can render.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

// ───── getAccessToken (refresh-token exchange) ───────────────────
export async function getAccessToken(env) {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth not configured (missing CLIENT_ID, CLIENT_SECRET, or REFRESH_TOKEN)');
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Token refresh failed (${res.status}): ${err.slice(0, 300)}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error('Token refresh succeeded but no access_token returned');
  return json.access_token;
}

// ───── findGeminiMeetingNotes (search Drive for the notes doc) ───
//
// Looks for a Google Doc that:
//   - Is a Google Doc (not a folder, image, sheet, etc)
//   - Was created/modified within +/- the meeting window (typically
//     5-30 min after the meeting ends Gemini publishes the doc)
//   - Matches the meeting title or invitee name in fullText
//
// Returns: { fileId, name, modifiedTime } | null
//
// Strategy: most Gemini docs are titled like "Notes by Gemini - {Meeting
// Title}" or include the participant's name in the filename. We do a
// broad time-windowed search then rank by name match.
export async function findGeminiMeetingNotes(env, { meetingTitle, endedAtIso, inviteeName }) {
  const token = await getAccessToken(env);
  if (!endedAtIso) return null;
  const endedMs = new Date(endedAtIso).getTime();
  if (isNaN(endedMs)) return null;
  // Search window: 5 min before meeting end to 4 hours after (Gemini
  // can take a while on long meetings; 4h is a safe upper bound)
  const windowStart = new Date(endedMs - 5 * 60 * 1000).toISOString();
  const windowEnd = new Date(endedMs + 4 * 60 * 60 * 1000).toISOString();

  // Build the q= filter for Drive v3 search
  const filters = [
    "mimeType='application/vnd.google-apps.document'",
    `modifiedTime >= '${windowStart}'`,
    `modifiedTime <= '${windowEnd}'`,
    "trashed=false",
  ];
  const q = filters.join(' and ');
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,createdTime)&orderBy=modifiedTime%20desc&pageSize=50`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Drive search failed (${res.status}): ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const candidates = data.files || [];
  if (!candidates.length) return null;

  // Rank candidates by best name match. Gemini-generated docs from
  // Google Meet typically have names containing:
  //   - The invitee's name
  //   - The meeting type/title
  //   - "Notes" or "Gemini"
  const titleLower = (meetingTitle || '').toLowerCase();
  const inviteeLower = (inviteeName || '').toLowerCase().split(' ')[0]; // first name
  const scored = candidates.map(f => {
    const n = (f.name || '').toLowerCase();
    let score = 0;
    if (n.includes('gemini')) score += 5;
    if (n.includes('notes')) score += 4;
    if (titleLower && n.includes(titleLower)) score += 3;
    if (inviteeLower && n.includes(inviteeLower)) score += 3;
    // Prefer docs created closer to (just after) the meeting end time
    const dt = new Date(f.modifiedTime || f.createdTime || 0).getTime();
    const delta = Math.abs(dt - endedMs);
    if (delta < 60 * 60 * 1000) score += 2;       // within 1 hour
    else if (delta < 2 * 60 * 60 * 1000) score += 1; // within 2 hours
    return { ...f, score };
  });
  scored.sort((a, b) => b.score - a.score);
  // Require at least one strong signal (score >= 4) to avoid grabbing
  // unrelated docs that just happened to be created at the right time.
  const winner = scored[0];
  if (!winner || winner.score < 4) return null;
  return { fileId: winner.id, name: winner.name, modifiedTime: winner.modifiedTime, score: winner.score };
}

// ───── getDocPlainText (export a Google Doc as text/plain) ───────
export async function getDocPlainText(env, fileId) {
  const token = await getAccessToken(env);
  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Drive export failed (${res.status}): ${err.slice(0, 300)}`);
  }
  return res.text();
}

// ───── extractRecapSections (parse Gemini doc structure) ─────────
//
// Gemini-generated meeting notes from Google Meet follow a consistent
// structure. We parse the headings into a structured object so the recap
// email can pull bullets without an LLM round-trip.
//
// Typical sections we extract:
//   - summary (a few sentences)
//   - keyPoints / discussionPoints (bullet list)
//   - actionItems (bullet list, possibly with assignees)
//   - decisions (if present)
//
// If parsing fails, returns { rawText } so the caller can fall back to
// the template recap or pass the raw text through an LLM.
export function extractRecapSections(plainText) {
  if (!plainText || typeof plainText !== 'string') return { rawText: '' };

  const sections = { rawText: plainText, summary: '', keyPoints: [], actionItems: [], decisions: [] };

  // Normalize line endings + split into lines
  const lines = plainText.replace(/\r\n/g, '\n').split('\n');

  // Section header detector. Gemini uses these standard heading patterns:
  //   "Summary", "Suggested next steps", "Action items", "Key points",
  //   "Discussion points", "Decisions", "Notes by Gemini"
  // Headers usually appear on their own line, sometimes followed by ":"
  const headerRegex = /^(summary|key points|key discussion points|discussion points|action items|suggested next steps|decisions|notes by gemini)\s*:?\s*$/i;
  const bulletRegex = /^\s*[-*•]\s+(.+?)\s*$/;

  let currentSection = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const headerMatch = line.match(headerRegex);
    if (headerMatch) {
      const h = headerMatch[1].toLowerCase();
      if (h === 'summary') currentSection = 'summary';
      else if (h.includes('key') || h.includes('discussion')) currentSection = 'keyPoints';
      else if (h.includes('action') || h.includes('next steps')) currentSection = 'actionItems';
      else if (h.includes('decisions')) currentSection = 'decisions';
      else currentSection = null;
      continue;
    }
    if (!currentSection) continue;

    if (currentSection === 'summary') {
      sections.summary = (sections.summary ? sections.summary + ' ' : '') + line;
    } else {
      const bulletMatch = line.match(bulletRegex);
      const text = bulletMatch ? bulletMatch[1] : line;
      if (text && text.length > 2) sections[currentSection].push(text);
    }
  }

  // Cap each list at 5 items so the recap email stays scannable
  sections.keyPoints = sections.keyPoints.slice(0, 5);
  sections.actionItems = sections.actionItems.slice(0, 5);
  sections.decisions = sections.decisions.slice(0, 5);

  return sections;
}
