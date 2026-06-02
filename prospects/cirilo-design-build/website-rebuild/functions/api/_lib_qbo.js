// _lib_qbo.js - QuickBooks Online OAuth2 + REST helpers.
// Env (set as Cloudflare Pages secrets):
//   CDB_QBO_CLIENT_ID, CDB_QBO_CLIENT_SECRET  (from developer.intuit.com app)
//   CDB_QBO_ENV         'sandbox' (default) | 'production'
//   CDB_QBO_REDIRECT_URI must EXACTLY match the Redirect URI in the Intuit app
//   CDB_QBO_ITEM_ID     QBO income Item id for sales lines (default '1' = Services)
//   CDB_QBO_BANK_ACCOUNT_ID    QBO bank/cash account id for vendor expense (AP)
//   CDB_QBO_EXPENSE_ACCOUNT_ID QBO expense account id for vendor costs (AP)
// Tokens live in cdb_integrations (provider='quickbooks'), service-role only.
import { sb, sbSelect, sbUpdate } from './_lib.js';

export function qboConfig(env) {
  var id = env.CDB_QBO_CLIENT_ID, secret = env.CDB_QBO_CLIENT_SECRET;
  if (!id || !secret) return null;
  var mode = (env.CDB_QBO_ENV === 'production') ? 'production' : 'sandbox';
  return {
    clientId: id, clientSecret: secret, mode: mode,
    apiBase: mode === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com',
    tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    revokeUrl: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
    authUrl: 'https://appcenter.intuit.com/connect/oauth2',
    scope: 'com.intuit.quickbooks.accounting',
    itemId: env.CDB_QBO_ITEM_ID || '1',
    bankAccountId: env.CDB_QBO_BANK_ACCOUNT_ID || null,
    expenseAccountId: env.CDB_QBO_EXPENSE_ACCOUNT_ID || null,
    redirectUri: env.CDB_QBO_REDIRECT_URI || null
  };
}

// Redirect URI: prefer the configured one (must match Intuit), else derive.
export function qboRedirectUri(env, request) {
  var cfg = qboConfig(env);
  if (cfg && cfg.redirectUri) return cfg.redirectUri;
  try { return new URL(request.url).origin + '/api/qbo-callback'; } catch (e) { return null; }
}

export async function getConnection(env) {
  var c = sb(env); if (!c) return null;
  try {
    var r = await fetch(c.url + '/rest/v1/cdb_integrations?select=*&provider=eq.quickbooks&limit=1', {
      headers: { apikey: c.key, Authorization: 'Bearer ' + c.key }
    });
    if (!r.ok) return null;
    var rows = await r.json();
    return (rows && rows[0]) || null;
  } catch (e) { return null; }
}

export async function saveConnection(env, data) {
  var c = sb(env); if (!c) throw new Error('supabase env missing');
  var body = Object.assign({ provider: 'quickbooks', updated_at: new Date().toISOString() }, data);
  var r = await fetch(c.url + '/rest/v1/cdb_integrations?on_conflict=provider', {
    method: 'POST',
    headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('save integration ' + r.status + ' ' + (await r.text()));
  return (await r.json())[0];
}

export async function deleteConnection(env) {
  var c = sb(env); if (!c) return;
  try {
    await fetch(c.url + '/rest/v1/cdb_integrations?provider=eq.quickbooks', {
      method: 'DELETE', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, Prefer: 'return=minimal' }
    });
  } catch (e) {}
}

export async function exchangeCode(cfg, code, redirectUri) {
  var basic = btoa(cfg.clientId + ':' + cfg.clientSecret);
  var body = 'grant_type=authorization_code&code=' + encodeURIComponent(code) + '&redirect_uri=' + encodeURIComponent(redirectUri);
  var r = await fetch(cfg.tokenUrl, { method: 'POST', headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: body });
  if (!r.ok) throw new Error('token exchange ' + r.status + ' ' + (await r.text()));
  return r.json();
}

export async function refreshToken(cfg, refresh) {
  var basic = btoa(cfg.clientId + ':' + cfg.clientSecret);
  var body = 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refresh);
  var r = await fetch(cfg.tokenUrl, { method: 'POST', headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: body });
  if (!r.ok) throw new Error('token refresh ' + r.status);
  return r.json();
}

// Persist a freshly issued/refreshed token set.
export async function storeTokens(env, t, realmId) {
  var now = Date.now();
  return saveConnection(env, {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    realm_id: realmId,
    token_expires_at: new Date(now + ((t.expires_in || 3600) * 1000)).toISOString(),
    refresh_expires_at: new Date(now + ((t.x_refresh_token_expires_in || 8640000) * 1000)).toISOString(),
    status: 'connected'
  });
}

// Return a connection with a valid (refreshed if needed) access token.
export async function freshConnection(env, cfg, conn) {
  if (!conn) return null;
  var exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (Date.now() < exp - 120000) return conn; // still valid (2 min buffer)
  var t = await refreshToken(cfg, conn.refresh_token);
  var saved = await storeTokens(env, { access_token: t.access_token, refresh_token: t.refresh_token || conn.refresh_token, expires_in: t.expires_in, x_refresh_token_expires_in: t.x_refresh_token_expires_in }, conn.realm_id);
  return saved;
}

// Authenticated QBO REST call. path like '/customer' or '/query?query=...'.
export async function qboApi(cfg, conn, path, method, body) {
  var sep = path.indexOf('?') > -1 ? '&' : '?';
  var url = cfg.apiBase + '/v3/company/' + conn.realm_id + path + sep + 'minorversion=70';
  var r = await fetch(url, {
    method: method || 'GET',
    headers: { Authorization: 'Bearer ' + conn.access_token, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error('qbo ' + (method || 'GET') + ' ' + path + ' -> ' + r.status + ' ' + (await r.text()));
  return r.json();
}

// ── Accounts receivable: customer / invoice / payment ─────────────
export async function ensureCustomer(env, cfg, conn, client) {
  if (client.qbo_customer_id) return client.qbo_customer_id;
  var name = (client.name || client.email || 'Client').replace(/'/g, "\\'");
  var id = null;
  try {
    var q = await qboApi(cfg, conn, '/query?query=' + encodeURIComponent("select Id from Customer where DisplayName = '" + name + "'"), 'GET');
    if (q && q.QueryResponse && q.QueryResponse.Customer && q.QueryResponse.Customer[0]) id = q.QueryResponse.Customer[0].Id;
  } catch (e) {}
  if (!id) {
    var body = { DisplayName: client.name || client.email || ('Client ' + String(client.id).slice(0, 6)) };
    if (client.email) body.PrimaryEmailAddr = { Address: client.email };
    var created = await qboApi(cfg, conn, '/customer', 'POST', body);
    id = created && created.Customer && created.Customer.Id;
  }
  if (id) { try { await sbUpdate(env, 'cdb_clients', 'id=eq.' + client.id, { qbo_customer_id: id }); } catch (e) {} }
  return id;
}

export async function ensureInvoice(env, cfg, conn, pay, customerId) {
  if (pay.qbo_invoice_id) return pay.qbo_invoice_id;
  var amt = +pay.amount_usd || 0;
  var body = {
    CustomerRef: { value: customerId },
    Line: [{ Amount: amt, DetailType: 'SalesItemLineDetail', Description: pay.draw_label || ('Draw ' + (pay.draw_number || '')), SalesItemLineDetail: { ItemRef: { value: cfg.itemId }, Qty: 1, UnitPrice: amt } }],
    PrivateNote: 'Cirilo draw ' + (pay.draw_number || '') + ' (' + (pay.draw_label || '') + ')'
  };
  var created = await qboApi(cfg, conn, '/invoice', 'POST', body);
  var invId = created && created.Invoice && created.Invoice.Id;
  if (invId) { try { await sbUpdate(env, 'cdb_payments', 'id=eq.' + pay.id, { qbo_invoice_id: invId, synced_at: new Date().toISOString() }); } catch (e) {} }
  return invId;
}

export async function ensurePayment(env, cfg, conn, pay, customerId, invoiceId) {
  if (pay.qbo_payment_id) return pay.qbo_payment_id;
  if (pay.status !== 'received' && pay.status !== 'cleared') return null;
  var amt = +pay.amount_usd || 0;
  var body = {
    CustomerRef: { value: customerId }, TotalAmt: amt,
    Line: [{ Amount: amt, LinkedTxn: [{ TxnId: invoiceId, TxnType: 'Invoice' }] }],
    PrivateNote: 'Paid by ' + (pay.method || 'check') + (pay.reference ? (' ref ' + pay.reference) : '')
  };
  var created = await qboApi(cfg, conn, '/payment', 'POST', body);
  var payId = created && created.Payment && created.Payment.Id;
  if (payId) { try { await sbUpdate(env, 'cdb_payments', 'id=eq.' + pay.id, { qbo_payment_id: payId, synced_at: new Date().toISOString() }); } catch (e) {} }
  return payId;
}

export async function syncDraw(env, cfg, conn, pay) {
  var crows = await sbSelect(env, 'cdb_clients?select=*&id=eq.' + pay.client_id + '&limit=1');
  var client = crows && crows[0];
  if (!client) return { id: pay.id, ok: false, error: 'no_client' };
  var customerId = await ensureCustomer(env, cfg, conn, client);
  if (!customerId) return { id: pay.id, ok: false, error: 'no_customer' };
  var invoiceId = await ensureInvoice(env, cfg, conn, pay, customerId);
  var paymentId = await ensurePayment(env, cfg, conn, pay, customerId, invoiceId);
  return { id: pay.id, ok: true, qbo_invoice_id: invoiceId, qbo_payment_id: paymentId };
}

// ── Accounts payable: vendor / paid-assignment expense ────────────
export async function ensureVendor(env, cfg, conn, vendor) {
  if (vendor.qbo_vendor_id) return vendor.qbo_vendor_id;
  var name = (vendor.company || vendor.name || 'Vendor').replace(/'/g, "\\'");
  var id = null;
  try {
    var q = await qboApi(cfg, conn, '/query?query=' + encodeURIComponent("select Id from Vendor where DisplayName = '" + name + "'"), 'GET');
    if (q && q.QueryResponse && q.QueryResponse.Vendor && q.QueryResponse.Vendor[0]) id = q.QueryResponse.Vendor[0].Id;
  } catch (e) {}
  if (!id) {
    var body = { DisplayName: vendor.company || vendor.name || ('Vendor ' + String(vendor.id).slice(0, 6)) };
    if (vendor.email) body.PrimaryEmailAddr = { Address: vendor.email };
    var created = await qboApi(cfg, conn, '/vendor', 'POST', body);
    id = created && created.Vendor && created.Vendor.Id;
  }
  if (id) { try { await sbUpdate(env, 'cdb_vendors', 'id=eq.' + vendor.id, { qbo_vendor_id: id }); } catch (e) {} }
  return id;
}

export async function ensureVendorExpense(env, cfg, conn, a, vendorId) {
  if (a.qbo_purchase_id) return a.qbo_purchase_id;
  if (!cfg.bankAccountId || !cfg.expenseAccountId) throw new Error('needs_account_config');
  var amt = +a.paid_amount || +a.amount_usd || 0;
  if (!amt) return null;
  var body = {
    PaymentType: 'Check',
    AccountRef: { value: cfg.bankAccountId },
    EntityRef: { value: vendorId, type: 'Vendor' },
    Line: [{ Amount: amt, DetailType: 'AccountBasedExpenseLineDetail', Description: a.scope || a.stage || 'Vendor work', AccountBasedExpenseLineDetail: { AccountRef: { value: cfg.expenseAccountId } } }],
    PrivateNote: 'Cirilo vendor assignment ' + (a.id || '')
  };
  var created = await qboApi(cfg, conn, '/purchase', 'POST', body);
  var pid = created && created.Purchase && created.Purchase.Id;
  if (pid) { try { await sbUpdate(env, 'cdb_vendor_assignments', 'id=eq.' + a.id, { qbo_purchase_id: pid, synced_at: new Date().toISOString() }); } catch (e) {} }
  return pid;
}

export async function syncVendorAssignment(env, cfg, conn, a) {
  if (a.pay_status !== 'paid') return { id: a.id, ok: false, error: 'not_paid' };
  var vrows = await sbSelect(env, 'cdb_vendors?select=*&id=eq.' + a.vendor_id + '&limit=1');
  var vendor = vrows && vrows[0];
  if (!vendor) return { id: a.id, ok: false, error: 'no_vendor' };
  var vendorId = await ensureVendor(env, cfg, conn, vendor);
  if (!vendorId) return { id: a.id, ok: false, error: 'no_qbo_vendor' };
  var purchaseId = await ensureVendorExpense(env, cfg, conn, a, vendorId);
  return { id: a.id, ok: true, qbo_vendor_id: vendorId, qbo_purchase_id: purchaseId };
}

// ── Self-contained, safe auto-sync wrappers (for context.waitUntil) ──
export async function qboAutoSyncDraw(env, paymentId) {
  try {
    var cfg = qboConfig(env); if (!cfg || !sb(env)) return;
    var conn = await getConnection(env); if (!conn || conn.status !== 'connected') return;
    conn = await freshConnection(env, cfg, conn);
    var rows = await sbSelect(env, 'cdb_payments?select=*&id=eq.' + paymentId + '&limit=1');
    var pay = rows && rows[0]; if (!pay) return;
    await syncDraw(env, cfg, conn, pay);
  } catch (e) { /* best-effort */ }
}

export async function qboAutoSyncVendor(env, assignmentId) {
  try {
    var cfg = qboConfig(env); if (!cfg || !sb(env)) return;
    var conn = await getConnection(env); if (!conn || conn.status !== 'connected') return;
    conn = await freshConnection(env, cfg, conn);
    var rows = await sbSelect(env, 'cdb_vendor_assignments?select=*&id=eq.' + assignmentId + '&limit=1');
    var a = rows && rows[0]; if (!a) return;
    await syncVendorAssignment(env, cfg, conn, a);
  } catch (e) { /* best-effort */ }
}
