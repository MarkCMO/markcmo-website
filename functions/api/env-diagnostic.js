// /api/env-diagnostic
//
// Reports which env vars the CF Pages function runtime can actually see.
// Doesn't expose values - just presence + length. Lets us verify that
// secrets set in the Pages dashboard are actually bound to the running
// deployment.
//
// Auth: protected by ?key=<value> matching ADMIN_DIAG_KEY env var, or
// open if no ADMIN_DIAG_KEY is set (fine for one-off debugging).
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Gate behind a key if one is configured
  const diagKey = env.ADMIN_DIAG_KEY;
  if (diagKey && url.searchParams.get('key') !== diagKey) {
    return new Response(JSON.stringify({ error: 'ADMIN_DIAG_KEY required as ?key=' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const interesting = [
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'GOOGLE_OAUTH_REFRESH_TOKEN',
    'CLOUDFLARE_EMAIL',
    'CLOUDFLARE_API_KEY',
    'CLOUDFLARE_API_TOKEN',
    'CF_ACCOUNT_ID',
    'MARKCMO_SUPABASE_URL',
    'MARKCMO_SUPABASE_SERVICE_KEY',
    'RESEND_API_KEY',
    'CALENDLY_SIGNING_KEY',
    'CALENDLY_API_TOKEN',
  ];

  const result = {
    timestamp: new Date().toISOString(),
    runtime_visible: {},
    all_env_keys_count: env ? Object.keys(env).length : 0,
    all_env_keys: env ? Object.keys(env).sort() : [],
  };

  for (const k of interesting) {
    const v = env ? env[k] : undefined;
    if (v === undefined || v === null) {
      result.runtime_visible[k] = 'MISSING';
    } else if (typeof v === 'string') {
      result.runtime_visible[k] = `OK (length=${v.length})`;
    } else {
      result.runtime_visible[k] = `OK (type=${typeof v})`;
    }
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
