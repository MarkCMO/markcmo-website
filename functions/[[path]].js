/**
 * functions/[[path]].js
 * Cloudflare Pages catch-all that adapts every Netlify function handler to the
 * CF Pages onRequest format.  Wrangler/esbuild bundles all imports at build time
 * so dynamic routing works without dynamic require().
 *
 * Request flow:
 *   Browser → CF Pages edge → static file? serve it
 *                            → else → this file → find handler → run it → Response
 *
 * The Netlify function URL space is:
 *   /.netlify/functions/<name>   (direct calls from JS on the page)
 *   /pay/<id>                    (rewritten by _redirects → /.netlify/functions/pay)
 *   /track[/*]                   (rewritten by _redirects → /.netlify/functions/track)
 */

// ── Static import table ───────────────────────────────────────────────────────
// All 69 handler modules imported at build time so esbuild can tree-shake and
// bundle their CommonJS dependencies correctly.

import accessMod                       from '../netlify/functions/access.js';
import adminAuthMod                    from '../netlify/functions/admin-auth.js';
import adminBlogMod                    from '../netlify/functions/admin-blog.js';
import adminDataMod                    from '../netlify/functions/admin-data.js';
import adminEngagementDataMod          from '../netlify/functions/admin-engagement-data.js';
import adminLinksMod                   from '../netlify/functions/admin-links.js';
import adminMcWriteMod                 from '../netlify/functions/admin-mc-write.js';
import adminUploadMod                  from '../netlify/functions/admin-upload.js';
import calendlySyncHistoryMod          from '../netlify/functions/calendly-sync-history.js';
import calendlyWebhookMod              from '../netlify/functions/calendly-webhook.js';
import castingCallsMod                 from '../netlify/functions/casting-calls.js';
import clientPortalDataMod             from '../netlify/functions/client-portal-data.js';
import courseCurriculumMod             from '../netlify/functions/course-curriculum.js';
import courseEnrollMod                 from '../netlify/functions/course-enroll.js';
import courseExamMod                   from '../netlify/functions/course-exam.js';
import courseGraduateMod               from '../netlify/functions/course-graduate.js';
import courseLessonMod                 from '../netlify/functions/course-lesson.js';
import courseNotifyMod                 from '../netlify/functions/course-notify.js';
import courseVotesMod                  from '../netlify/functions/course-votes.js';
import emailDripMod                    from '../netlify/functions/email-drip.js';
import emailFormMod                    from '../netlify/functions/email-form.js';
import engagementPaymentFollowupsMod   from '../netlify/functions/engagement-payment-followups.js';
import executeDocumentMod              from '../netlify/functions/execute-document.js';
import executeEngagementDocMod         from '../netlify/functions/execute-engagement-doc.js';
import filmIntelMod                    from '../netlify/functions/film-intel.js';
import filmRolodexMod                  from '../netlify/functions/film-rolodex.js';
import filmRolodexCronMod              from '../netlify/functions/film-rolodex-cron.js';
import filmRolodexDeepCronMod          from '../netlify/functions/film-rolodex-deep-cron.js';
import filmRolodexImportMod            from '../netlify/functions/film-rolodex-import.js';
import foundingStatusMod               from '../netlify/functions/founding-status.js';
import generateEngagementDocsMod       from '../netlify/functions/generate-engagement-docs.js';
import getDocumentMod                  from '../netlify/functions/get-document.js';
import newsFeedMod                     from '../netlify/functions/news-feed.js';
import payMod                          from '../netlify/functions/pay.js';
import publicBlogMod                   from '../netlify/functions/public-blog.js';
import purchaseGateMod                 from '../netlify/functions/purchase-gate.js';
import resendWebhookMod                from '../netlify/functions/resend-webhook.js';
import scriptBudgetMod                 from '../netlify/functions/script-budget.js';
import scriptBudgetBackgroundMod       from '../netlify/functions/script-budget-background.js';
import scriptCallsheetMod              from '../netlify/functions/script-callsheet.js';
import scriptCallsheetBackgroundMod    from '../netlify/functions/script-callsheet-background.js';
import scriptDissectMod                from '../netlify/functions/script-dissect.js';
import scriptDissectBackgroundMod      from '../netlify/functions/script-dissect-background.js';
import scriptJobsMod                   from '../netlify/functions/script-jobs.js';
import scriptLocationsMod              from '../netlify/functions/script-locations.js';
import scriptLocationsBackgroundMod    from '../netlify/functions/script-locations-background.js';
import scriptOrdersMod                 from '../netlify/functions/script-orders.js';
import scriptOrdersBackgroundMod       from '../netlify/functions/script-orders-background.js';
import scriptPostMod                   from '../netlify/functions/script-post.js';
import scriptPostBackgroundMod         from '../netlify/functions/script-post-background.js';
import scriptResultMod                 from '../netlify/functions/script-result.js';
import scriptSafetyMod                 from '../netlify/functions/script-safety.js';
import scriptSafetyBackgroundMod       from '../netlify/functions/script-safety-background.js';
import scriptScheduleMod               from '../netlify/functions/script-schedule.js';
import scriptScheduleBackgroundMod     from '../netlify/functions/script-schedule-background.js';
import scriptShotlistMod               from '../netlify/functions/script-shotlist.js';
import scriptShotlistBackgroundMod     from '../netlify/functions/script-shotlist-background.js';
import scriptUploadMod                 from '../netlify/functions/script-upload.js';
import sendEngagementProposalEmailMod  from '../netlify/functions/send-engagement-proposal-email.js';
import sendTemplateEmailMod            from '../netlify/functions/send-template-email.js';
import squareInvoiceActionMod          from '../netlify/functions/square-invoice-action.js';
import squareInvoiceSyncMod            from '../netlify/functions/square-invoice-sync.js';
import squareWebhookMod                from '../netlify/functions/square-webhook.js';
import squareWebhookRegisterMod        from '../netlify/functions/square-webhook-register.js';
import studentPortalMod                from '../netlify/functions/student-portal.js';
import submitDocumentMod               from '../netlify/functions/submit-document.js';
import submitEngagementDocMod          from '../netlify/functions/submit-engagement-doc.js';
import testJsonbinMod                  from '../netlify/functions/test-jsonbin.js';
import trackMod                        from '../netlify/functions/track.js';
import updateClientMod                 from '../netlify/functions/update-client.js';
import validateTokenMod                from '../netlify/functions/validate-token.js';
import webinarSignupMod                from '../netlify/functions/webinar-signup.js';

// ── Routing table ─────────────────────────────────────────────────────────────
// Maps URL slug → handler function extracted from the CJS exports object.
function h(mod) {
  return mod && (mod.handler || mod.default?.handler || (typeof mod === 'function' ? mod : null));
}

const HANDLERS = {
  'access':                       h(accessMod),
  'admin-auth':                   h(adminAuthMod),
  'admin-blog':                   h(adminBlogMod),
  'admin-data':                   h(adminDataMod),
  'admin-engagement-data':        h(adminEngagementDataMod),
  'admin-links':                  h(adminLinksMod),
  'admin-mc-write':               h(adminMcWriteMod),
  'admin-upload':                 h(adminUploadMod),
  'calendly-sync-history':        h(calendlySyncHistoryMod),
  'calendly-webhook':             h(calendlyWebhookMod),
  'casting-calls':                h(castingCallsMod),
  'client-portal-data':           h(clientPortalDataMod),
  'course-curriculum':            h(courseCurriculumMod),
  'course-enroll':                h(courseEnrollMod),
  'course-exam':                  h(courseExamMod),
  'course-graduate':              h(courseGraduateMod),
  'course-lesson':                h(courseLessonMod),
  'course-notify':                h(courseNotifyMod),
  'course-votes':                 h(courseVotesMod),
  'email-drip':                   h(emailDripMod),
  'email-form':                   h(emailFormMod),
  'engagement-payment-followups': h(engagementPaymentFollowupsMod),
  'execute-document':             h(executeDocumentMod),
  'execute-engagement-doc':       h(executeEngagementDocMod),
  'film-intel':                   h(filmIntelMod),
  'film-rolodex':                 h(filmRolodexMod),
  'film-rolodex-cron':            h(filmRolodexCronMod),
  'film-rolodex-deep-cron':       h(filmRolodexDeepCronMod),
  'film-rolodex-import':          h(filmRolodexImportMod),
  'founding-status':              h(foundingStatusMod),
  'generate-engagement-docs':     h(generateEngagementDocsMod),
  'get-document':                 h(getDocumentMod),
  'news-feed':                    h(newsFeedMod),
  'pay':                          h(payMod),
  'public-blog':                  h(publicBlogMod),
  'purchase-gate':                h(purchaseGateMod),
  'resend-webhook':               h(resendWebhookMod),
  'script-budget':                h(scriptBudgetMod),
  'script-budget-background':     h(scriptBudgetBackgroundMod),
  'script-callsheet':             h(scriptCallsheetMod),
  'script-callsheet-background':  h(scriptCallsheetBackgroundMod),
  'script-dissect':               h(scriptDissectMod),
  'script-dissect-background':    h(scriptDissectBackgroundMod),
  'script-jobs':                  h(scriptJobsMod),
  'script-locations':             h(scriptLocationsMod),
  'script-locations-background':  h(scriptLocationsBackgroundMod),
  'script-orders':                h(scriptOrdersMod),
  'script-orders-background':     h(scriptOrdersBackgroundMod),
  'script-post':                  h(scriptPostMod),
  'script-post-background':       h(scriptPostBackgroundMod),
  'script-result':                h(scriptResultMod),
  'script-safety':                h(scriptSafetyMod),
  'script-safety-background':     h(scriptSafetyBackgroundMod),
  'script-schedule':              h(scriptScheduleMod),
  'script-schedule-background':   h(scriptScheduleBackgroundMod),
  'script-shotlist':              h(scriptShotlistMod),
  'script-shotlist-background':   h(scriptShotlistBackgroundMod),
  'script-upload':                h(scriptUploadMod),
  'send-engagement-proposal-email': h(sendEngagementProposalEmailMod),
  'send-template-email':          h(sendTemplateEmailMod),
  'square-invoice-action':        h(squareInvoiceActionMod),
  'square-invoice-sync':          h(squareInvoiceSyncMod),
  'square-webhook':               h(squareWebhookMod),
  'square-webhook-register':      h(squareWebhookRegisterMod),
  'student-portal':               h(studentPortalMod),
  'submit-document':              h(submitDocumentMod),
  'submit-engagement-doc':        h(submitEngagementDocMod),
  'test-jsonbin':                 h(testJsonbinMod),
  'track':                        h(trackMod),
  'update-client':                h(updateClientMod),
  'validate-token':               h(validateTokenMod),
  'webinar-signup':               h(webinarSignupMod),
};

// ── Env bridge ────────────────────────────────────────────────────────────────
// Netlify functions read from process.env.  CF Workers expose env via context.env.
// With nodejs_compat, process exists but process.env is not auto-populated from
// Worker bindings, so we bridge it at request start.
function bridgeEnv(cfEnv) {
  for (const [k, v] of Object.entries(cfEnv)) {
    if (typeof v === 'string') process.env[k] = v;
  }
}

// ── Request → Netlify event ───────────────────────────────────────────────────
async function toNetlifyEvent(request) {
  const url = new URL(request.url);

  const headers = {};
  for (const [k, v] of request.headers.entries()) headers[k] = v;

  const queryStringParameters = {};
  const multiValueQueryStringParameters = {};
  for (const [k, v] of url.searchParams.entries()) {
    queryStringParameters[k] = v;
    if (!multiValueQueryStringParameters[k]) multiValueQueryStringParameters[k] = [];
    multiValueQueryStringParameters[k].push(v);
  }

  let body = null;
  let isBase64Encoded = false;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const ct = (request.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('multipart/form-data') || ct.includes('application/octet-stream')) {
      const ab = await request.arrayBuffer();
      body = btoa(String.fromCharCode(...new Uint8Array(ab)));
      isBase64Encoded = true;
    } else {
      body = await request.text();
    }
  }

  return {
    httpMethod: request.method,
    path: url.pathname,
    queryStringParameters,
    multiValueQueryStringParameters,
    headers,
    body,
    isBase64Encoded,
    rawUrl: request.url,
    rawQuery: url.search.slice(1),
  };
}

// ── Netlify result → CF Response ──────────────────────────────────────────────
function toResponse(result) {
  const status  = result.statusCode || 200;
  const headers = new Headers();

  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) {
      if (Array.isArray(v)) v.forEach(val => headers.append(k, String(val)));
      else headers.set(k, String(v));
    }
  }
  if (result.multiValueHeaders) {
    for (const [k, vs] of Object.entries(result.multiValueHeaders)) {
      (vs || []).forEach(v => headers.append(k, String(v)));
    }
  }

  let body = result.body ?? '';
  if (result.isBase64Encoded && typeof body === 'string') {
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Response(bytes, { status, headers });
  }
  return new Response(body, { status, headers });
}

// ── Fake Netlify context ──────────────────────────────────────────────────────
function makeNetlifyContext(fnName) {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: fnName,
    functionVersion: '$LATEST',
    invokedFunctionArn: '',
    memoryLimitInMB: '1024',
    awsRequestId: crypto.randomUUID(),
    logGroupName: `/aws/lambda/${fnName}`,
    logStreamName: '',
    identity: undefined,
    clientContext: undefined,
    getRemainingTimeInMillis: () => 26000,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;

  // Bridge CF env → process.env so all existing Netlify code can read it
  bridgeEnv(env);

  const url   = new URL(request.url);
  const path  = url.pathname;

  // Only handle /.netlify/functions/* paths (and aliases set up in _redirects)
  const match = path.match(/^\/.netlify\/functions\/([^/?]+)/);
  if (!match) {
    // Not a function path - fall through to static file serving
    return new Response('Not found', { status: 404 });
  }

  const fnName  = match[1];
  const handler = HANDLERS[fnName];

  if (!handler) {
    return new Response(
      JSON.stringify({ error: `Function not found: ${fnName}` }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const event          = await toNetlifyEvent(request);
  const netlifyContext = makeNetlifyContext(fnName);

  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const ret = handler(event, netlifyContext, (err, res) => {
        if (err) reject(err instanceof Error ? err : new Error(String(err)));
        else resolve(res);
      });
      if (ret && typeof ret.then === 'function') ret.then(resolve).catch(reject);
    });
  } catch (err) {
    console.error(`[cf-adapter][${fnName}]`, err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return toResponse(result);
}
