// /api/google-drive-test
//
// Diagnostic endpoint. After the one-time OAuth setup, hit this URL to
// verify that:
//   1. The refresh token in env vars is valid
//   2. Drive API access works
//   3. Gemini-generated note docs are searchable
//   4. The notes parser pulls out the right sections
//
// Optional query params:
//   ?since=<ISO8601>  - look for notes created since this timestamp
//                       (default: last 7 days)
//   ?title=<text>     - meeting title to match against in filenames
//   ?inviteeName=<text> - invitee first/full name to match
//   ?fileId=<id>      - if you know the doc id already, skip search and
//                       just fetch+parse this one
//
// Example:
//   /api/google-drive-test?since=2026-06-08T00:00:00Z&title=Consultation
//   /api/google-drive-test?fileId=abc123def456

import { getAccessToken, findGeminiMeetingNotes, getDocPlainText, extractRecapSections } from '../_lib/google-drive.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const result = {
    ok: false,
    steps: [],
    env_check: {
      GOOGLE_OAUTH_CLIENT_ID: !!env.GOOGLE_OAUTH_CLIENT_ID,
      GOOGLE_OAUTH_CLIENT_SECRET: !!env.GOOGLE_OAUTH_CLIENT_SECRET,
      GOOGLE_OAUTH_REFRESH_TOKEN: !!env.GOOGLE_OAUTH_REFRESH_TOKEN,
    },
  };

  try {
    // Step 1: refresh token -> access token
    result.steps.push({ step: 'getting_access_token' });
    const token = await getAccessToken(env);
    result.steps.push({ step: 'access_token_obtained', length: token.length });

    // Step 2: drive about endpoint (sanity check + identify user)
    result.steps.push({ step: 'fetching_drive_about' });
    const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!aboutRes.ok) {
      result.error = `Drive about endpoint failed: ${aboutRes.status} ${(await aboutRes.text()).slice(0, 200)}`;
      return json(result);
    }
    const about = await aboutRes.json();
    result.authorized_as = about.user?.emailAddress || '(unknown)';
    result.steps.push({ step: 'drive_about_ok' });

    // Step 3a (option A): explicit fileId provided - skip search
    const explicitFileId = url.searchParams.get('fileId');
    let fileId = null;
    if (explicitFileId) {
      fileId = explicitFileId;
      result.search_skipped = true;
    } else {
      // Step 3b (option B): search Drive for a recent Gemini doc
      const since = url.searchParams.get('since') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const title = url.searchParams.get('title') || '';
      const inviteeName = url.searchParams.get('inviteeName') || '';
      result.steps.push({ step: 'searching_drive', since, title, inviteeName });
      const found = await findGeminiMeetingNotes(env, {
        meetingTitle: title,
        endedAtIso: since,
        inviteeName,
      });
      if (!found) {
        result.steps.push({ step: 'no_gemini_doc_found', hint: 'Try a broader since= window, or list candidates below' });
        // Fallback: list recent docs so user can pick one and pass fileId=
        const listRes = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.document%27%20and%20trashed%3Dfalse&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=15', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (listRes.ok) {
          const list = await listRes.json();
          result.recent_docs_for_browsing = (list.files || []).map(f => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime }));
        }
        return json(result);
      }
      fileId = found.fileId;
      result.matched_file = found;
      result.steps.push({ step: 'gemini_doc_found', file: found });
    }

    // Step 4: export plain text
    result.steps.push({ step: 'exporting_doc_plaintext', fileId });
    const text = await getDocPlainText(env, fileId);
    result.text_length = text.length;
    result.text_preview = text.substring(0, 600);

    // Step 5: parse sections
    const parsed = extractRecapSections(text);
    result.parsed = {
      summary_preview: (parsed.summary || '').substring(0, 240),
      key_points_count: parsed.keyPoints.length,
      key_points: parsed.keyPoints,
      action_items_count: parsed.actionItems.length,
      action_items: parsed.actionItems,
      decisions_count: parsed.decisions.length,
      decisions: parsed.decisions,
    };

    result.ok = true;
    return json(result);
  } catch (err) {
    result.error = (err && err.message) || String(err);
    result.error_stack = (err && err.stack) ? String(err.stack).substring(0, 1200) : null;
    return json(result, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
