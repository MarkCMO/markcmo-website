// Store + retrieve connected TikTok/Facebook accounts in the shared MarkChat
// social_accounts table (markchat schema). ESM, used by markcmo.com's OAuth
// callbacks. markchat-cron reads the same rows to do the actual cross-posting.
import * as db from "./social-supabase.mjs";

// Persist (insert or update on platform+external_id) a connected account.
export async function saveAccount(env, row) {
  const payload = { ...row, updated_at: new Date().toISOString() };
  return db.upsert(env, "social_accounts", payload, "platform,external_id");
}

// Most-recently-connected account for a platform.
export async function getAccount(env, platform) {
  const rows = await db.select(
    env,
    "social_accounts",
    { platform: `eq.${platform}`, status: "eq.connected" },
    { order: "updated_at.desc", limit: 1 }
  );
  return rows[0] || null;
}
