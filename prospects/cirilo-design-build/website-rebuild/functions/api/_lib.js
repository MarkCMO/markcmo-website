// Shared Supabase REST helpers for Cirilo Pages Functions.
// Uses the CLIPOS project (cdb_* tables) via service-role key.
// Env (set as CF Pages secrets): MARKCMO_SUPABASE_URL, MARKCMO_SUPABASE_SERVICE_KEY

export function sb(env) {
  var url = env.MARKCMO_SUPABASE_URL;
  var key = env.MARKCMO_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return { url: url, key: key };
}

export async function sbInsert(env, table, body) {
  var c = sb(env); if (!c) throw new Error('supabase env missing');
  var res = await fetch(c.url + '/rest/v1/' + table, {
    method: 'POST',
    headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('insert ' + table + ' -> ' + res.status + ' ' + (await res.text()));
  return (await res.json())[0];
}

export async function sbSelect(env, path) {
  var c = sb(env); if (!c) throw new Error('supabase env missing');
  var res = await fetch(c.url + '/rest/v1/' + path, { headers: { apikey: c.key, Authorization: 'Bearer ' + c.key } });
  if (!res.ok) throw new Error('select ' + path + ' -> ' + res.status);
  return res.json();
}

export async function sbUpdate(env, table, filter, body) {
  var c = sb(env); if (!c) throw new Error('supabase env missing');
  var res = await fetch(c.url + '/rest/v1/' + table + '?' + filter, {
    method: 'PATCH',
    headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('update ' + table + ' -> ' + res.status);
  return res.json();
}

export function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || null;
}
