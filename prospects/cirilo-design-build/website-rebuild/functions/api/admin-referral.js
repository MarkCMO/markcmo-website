// POST /api/admin-referral - admin actions on a customer referral.
//   { op:'set_status', id, status }  pending / consult / converted / rewarded
//   { op:'set_reward', id, reward }  none / pending / issued
// Advancing to 'converted' auto-flags the reward as pending (so it is not missed).
// Admin only (x-cdb-admin signed token). isUuid-gated.
import { sbUpdate, json } from './_lib.js';
import { guardAdmin, isUuid } from './_lib_security.js';

var STATUSES = ['pending', 'consult', 'converted', 'rewarded'];
var REWARDS = ['none', 'pending', 'issued'];

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false }, 401);
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }
  if (!d.id || !isUuid(d.id)) return json({ ok: false, error: 'bad id' }, 400);

  if (d.op === 'set_status') {
    if (STATUSES.indexOf(d.status) === -1) return json({ ok: false, error: 'bad status' }, 400);
    var patch = { status: d.status };
    if (d.status === 'converted') patch.reward_status = 'pending';
    if (d.status === 'rewarded') patch.reward_status = 'issued';
    try { await sbUpdate(env, 'cdb_referrals', 'id=eq.' + d.id, patch); return json({ ok: true }, 200); }
    catch (e) { return json({ ok: true, demo: true }, 200); }
  }

  if (d.op === 'set_reward') {
    if (REWARDS.indexOf(d.reward) === -1) return json({ ok: false, error: 'bad reward' }, 400);
    try { await sbUpdate(env, 'cdb_referrals', 'id=eq.' + d.id, { reward_status: d.reward }); return json({ ok: true }, 200); }
    catch (e) { return json({ ok: true, demo: true }, 200); }
  }

  return json({ ok: false, error: 'unknown op' }, 400);
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
