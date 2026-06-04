// POST /api/portal-onboard - convert a signed proposal into a live client.
// Creates (or updates) a cdb_clients row with a generated portal access code,
// creates the cdb_projects record at the 'contract' stage, files a signed
// contract document, and logs the stage event. Returns the access code so the
// proposal page can hand the homeowner straight into the Owner's Suite.
//
// Graceful: if Supabase is unset, returns ok with demo:true and a sample code
// so the flow can be demonstrated end to end before the database is wired.
import { sb, sbSelect, sbInsert, sbUpdate, json } from './_lib.js';

function genCode() {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', out = '';
  for (var i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  var d;
  try { d = await request.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }

  var email = (d.email || '').trim().toLowerCase();
  var name = (d.name || '').trim();
  if (!email || !name) return json({ ok: false, error: 'name and email required' }, 400);

  var code = genCode();
  var refCode = genCode();
  var contractValue = d.contract_value != null ? +d.contract_value : null;

  try {
    // Find or create the client, stamping the portal access + referral codes.
    var rows = await sbSelect(env, 'cdb_clients?select=*&email=ilike.' + encodeURIComponent(email) + '&limit=1');
    var client = rows && rows[0];
    if (client) {
      var upd = { portal_code: code, name: name, status: 'active' };
      if (!client.referral_code) upd.referral_code = refCode;
      await sbUpdate(env, 'cdb_clients', 'id=eq.' + client.id, upd);
    } else {
      client = await sbInsert(env, 'cdb_clients', {
        name: name, email: email, phone: d.phone || null, address: d.address || null,
        neighborhood: d.neighborhood || null, portal_code: code, referral_code: refCode, status: 'active'
      });
    }

    // Create the project at the contract stage.
    var proj = await sbInsert(env, 'cdb_projects', {
      client_id: client.id, name: d.project_name || (name + ' Project'),
      project_type: d.project_type || 'Custom Pool', pool_type: d.pool_type || null,
      contract_value: contractValue, stage: 'contract', stage_index: 3
    });

    // Set up the billing schedule (standard luxury-pool draws) as 'scheduled'
    // rows. Admin issues each one to bill it. Check/ACH only for now.
    if (contractValue && contractValue > 0) {
      try {
        var sched = [
          { t: 'Deposit', pct: 0.15 }, { t: 'Excavation', pct: 0.20 }, { t: 'Shotcrete shell', pct: 0.25 },
          { t: 'Tile, coping and equipment', pct: 0.20 }, { t: 'Final, on completion', pct: 0.20 }
        ];
        for (var si = 0; si < sched.length; si++) {
          await sbInsert(env, 'cdb_payments', {
            project_id: proj.id, client_id: client.id,
            draw_label: sched[si].t, draw_number: si + 1,
            amount_usd: Math.round(contractValue * sched[si].pct),
            method: 'check', status: 'scheduled'
          });
        }
      } catch (e) { /* non-fatal */ }
    }

    // File the signed contract + log the event.
    await sbInsert(env, 'cdb_documents', {
      project_id: proj.id, client_id: client.id, doc_type: 'contract',
      doc_name: 'Construction Agreement', status: 'signed',
      signed_at: new Date().toISOString(), amount_usd: contractValue,
      metadata: { signed_name: name }
    });

    // Persist the captured signature image to the document vault (best effort).
    if (d.signature && typeof d.signature === 'string' && d.signature.indexOf('data:image') === 0) {
      try {
        var cc = sb(env);
        if (cc) {
          var b64 = d.signature.replace(/^data:[^;]+;base64,/, '');
          var binS = atob(b64), lenS = binS.length, bytesS = new Uint8Array(lenS);
          for (var si = 0; si < lenS; si++) bytesS[si] = binS.charCodeAt(si);
          if (bytesS.length <= 2 * 1024 * 1024) {
            var sigPath = 'client/' + client.id + '/' + Date.now() + '_signature.png';
            var upS = await fetch(cc.url + '/storage/v1/object/cdb-files/' + encodeURI(sigPath), {
              method: 'POST',
              headers: { apikey: cc.key, Authorization: 'Bearer ' + cc.key, 'Content-Type': 'image/png', 'x-upsert': 'true' },
              body: bytesS
            });
            if (upS.ok) {
              await sbInsert(env, 'cdb_documents', {
                project_id: proj.id, client_id: client.id, doc_type: 'signature',
                doc_name: 'Signature (' + name + ')', status: 'signed',
                storage_path: 'cdb-files/' + sigPath, signed_at: new Date().toISOString(),
                uploaded_by: 'client', mime: 'image/png', size_bytes: bytesS.length
              });
            }
          }
        }
      } catch (e) {}
    }
    await sbInsert(env, 'cdb_project_events', {
      project_id: proj.id, event: 'stage_advanced', from_stage: 'proposal', to_stage: 'contract',
      detail: { note: 'Proposal accepted and signed by ' + name }
    });

    // Mark the originating proposal signed (if this came from a per-client link).
    if (d.proposal_slug) {
      try { await sbUpdate(env, 'cdb_proposals', 'slug=eq.' + encodeURIComponent(d.proposal_slug), { status: 'signed', signed_at: new Date().toISOString() }); } catch (e) {}
    }

    return json({ ok: true, code: code, email: email, portal_url: '/portal/' }, 200);
  } catch (e) {
    // Supabase unset or transient error: preview onboarding so the flow demos.
    return json({ ok: true, demo: true, code: code, email: email, portal_url: '/portal/' }, 200);
  }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
