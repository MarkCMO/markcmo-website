# QuickBooks Online connection - setup

The site can push customer billing into QuickBooks Online (QBO): it creates a
Customer per client, an Invoice per issued draw, and a Payment when a draw is
marked received or cleared. Check + ACH billing stays the source of truth here;
QBO is the accounting mirror.

## One-time setup (the client / account owner does this)

1. Go to https://developer.intuit.com and create an app (Production, with the
   "com.intuit.quickbooks.accounting" scope).
2. In the app's Keys & OAuth settings, add this exact Redirect URI:
   - Production: `https://cirilodb.com/api/qbo-callback`
   - (Preview/testing: `https://cirilodb-rebuild.pages.dev/api/qbo-callback`)
3. Copy the Client ID and Client Secret.
4. In Cloudflare Pages (project cirilodb-rebuild) -> Settings -> Environment
   variables, set:
   - `CDB_QBO_CLIENT_ID`      = Intuit app Client ID
   - `CDB_QBO_CLIENT_SECRET`  = Intuit app Client Secret
   - `CDB_QBO_ENV`            = `production` (or `sandbox` while testing)
   - `CDB_QBO_REDIRECT_URI`   = the exact Redirect URI from step 2
   - `CDB_QBO_ITEM_ID`        = (optional) the QBO income Item id used on invoice
                                lines. Defaults to `1` (the "Services" item that
                                exists in most sandboxes). In production, create a
                                "Pool Construction" service item and put its id here.
   - `CDB_QBO_BANK_ACCOUNT_ID`    = (optional, for vendor AP) the QBO bank/cash
                                account id that vendor payments are drawn from.
   - `CDB_QBO_EXPENSE_ACCOUNT_ID` = (optional, for vendor AP) the QBO expense
                                account id for subcontractor/vendor costs.
                                Vendor (AP) sync is skipped gracefully until both
                                of these are set. Find the ids via the QBO
                                Chart of Accounts or the /account query.
5. Apply the database schema (`docs/cdb-schema-journey.sql`) so the
   `cdb_integrations` table and the `qbo_*` mapping columns exist.

## Connecting (admin does this, once)

1. Open `/admin/`, sign in, go to the Dashboard.
2. In the "Accounting (QuickBooks)" panel click **Connect QuickBooks**.
3. Authorize the company in the Intuit window. You return to the admin with the
   connection live (company name + id shown). Tokens auto-refresh.

## Daily use

- In **Billing & Draws**, each issued/paid draw has a **Sync to QB** button, or
  use **Sync all to QuickBooks** in the Accounting panel to push everything at
  once. Syncing is idempotent (a draw already in QBO is not duplicated).
- Mapping is stored on our side: `cdb_clients.qbo_customer_id`,
  `cdb_payments.qbo_invoice_id`, `cdb_payments.qbo_payment_id`.

## Notes

- All QBO endpoints are admin-only (HMAC token) and fail gracefully: with no
  credentials set they report "not configured"; with credentials but no
  authorization they report "not connected". Nothing breaks in demo mode.
- Tokens live in Supabase (`cdb_integrations`, service-role only / RLS deny-all).
  The refresh token is long-lived (~100 days) and is rotated on each refresh.
- This is a manual-sync design (no surprise API calls). If you later want
  auto-sync on issue/payment, it is a small addition to admin-payment.js.
