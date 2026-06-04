// Minimal Supabase (PostgREST) helper for the social token store (ESM).
// Isolated env vars (SOCIAL_SUPABASE_*) so this NEVER collides with markcmo.com's
// own Supabase. Points at the shared MarkChat project / markchat schema, which
// markchat-cron also reads for cross-posting.

function creds(env) {
  const url = env.SOCIAL_SUPABASE_URL;
  const key = env.SOCIAL_SUPABASE_SERVICE_KEY || env.SOCIAL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SOCIAL_SUPABASE_URL / SOCIAL_SUPABASE_SERVICE_KEY not set");
  return { url, key };
}

function profileHeader(env, method) {
  const schema = env.SOCIAL_SUPABASE_SCHEMA || "markchat";
  if (!schema || schema === "public") return {};
  const isRead = method === "GET" || method === "HEAD";
  return { [isRead ? "Accept-Profile" : "Content-Profile"]: schema };
}

export async function sb(env, path, { method = "GET", body, headers = {}, prefer } = {}) {
  const { url, key } = creds(env);
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...profileHeader(env, method),
      ...(prefer ? { Prefer: prefer } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`Supabase ${method} ${path} failed: ${res.status} ${text}`);
    err.status = res.status; err.body = data; throw err;
  }
  return data;
}

function buildQuery(filters = {}, opts = {}) {
  const params = new URLSearchParams();
  for (const [col, expr] of Object.entries(filters)) {
    if (expr === undefined || expr === null) continue;
    params.append(col, expr);
  }
  if (opts.select) params.append("select", opts.select);
  if (opts.order) params.append("order", opts.order);
  if (opts.limit != null) params.append("limit", String(opts.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function select(env, table, filters = {}, opts = {}) {
  const rows = await sb(env, `${table}${buildQuery(filters, opts)}`);
  return Array.isArray(rows) ? rows : rows ? [rows] : [];
}

export async function upsert(env, table, row, onConflict) {
  const path = onConflict ? `${table}?on_conflict=${onConflict}` : table;
  const rows = await sb(env, path, {
    method: "POST",
    body: row,
    prefer: "resolution=merge-duplicates,return=representation",
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function update(env, table, filters, patch) {
  const rows = await sb(env, `${table}${buildQuery(filters)}`, {
    method: "PATCH",
    body: patch,
    prefer: "return=representation",
  });
  return Array.isArray(rows) ? rows : rows ? [rows] : [];
}
