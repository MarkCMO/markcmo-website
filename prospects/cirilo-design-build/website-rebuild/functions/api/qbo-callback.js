// GET /api/qbo-callback - Intuit OAuth redirect target.
// Validates the signed state, exchanges the auth code for tokens, stores them
// (with the realmId / company id), then redirects back to the admin console.
import { verifyAdmin } from './_lib_security.js';
import { qboConfig, qboRedirectUri, exchangeCode, storeTokens } from './_lib_qbo.js';

function redirect(to) { return new Response('', { status: 302, headers: { Location: to } }); }

export async function onRequestGet(context) {
  var env = context.env, request = context.request;
  var url = new URL(request.url);
  var code = url.searchParams.get('code');
  var realmId = url.searchParams.get('realmId');
  var state = url.searchParams.get('state');
  var error = url.searchParams.get('error');

  if (error) return redirect('/admin/?qbo=denied');
  if (!code || !realmId || !state) return redirect('/admin/?qbo=error');

  // Validate state was issued by our admin (anti-CSRF).
  var who = await verifyAdmin(env, state);
  if (!who) return redirect('/admin/?qbo=badstate');

  var cfg = qboConfig(env);
  if (!cfg) return redirect('/admin/?qbo=notconfigured');

  try {
    var redirectUri = qboRedirectUri(env, request);
    var tokens = await exchangeCode(cfg, code, redirectUri);
    await storeTokens(env, tokens, realmId);
    return redirect('/admin/?qbo=connected');
  } catch (e) {
    return redirect('/admin/?qbo=error');
  }
}
