// admin-project.js - admin edits the data points the Owner Suite (portal) shows.
// Ops (POST, x-cdb-admin required):
//   get           {project_id}                 -> project + its timeline events + client
//   update_project{project_id, fields}         -> cdb_projects (name, pool_type, contract_value, stage, dates)
//   add_event     {project_id, event, note, at}-> cdb_project_events (the portal timeline/feed)
//   update_event  {event_id, event?, note?, at?}
//   delete_event  {event_id}
//   update_client {client_id, fields}          -> cdb_clients (name, email, neighborhood, phone, portal_code)
import { sb, sbSelect, sbInsert, sbUpdate, json } from './_lib.js';
import { guardAdmin, isUuid } from './_lib_security.js';

var STAGE_ORDER = ['consultation','design','proposal','contract','excavation','rebar_bonding','plumbing_electrical','inspections','shotcrete','tile_coping','equipment','decking','interior_finish','fill_startup'];

// Only these columns can be written, per table (prevents arbitrary writes).
var PROJECT_FIELDS = ['name','pool_type','project_type','contract_value','stage','start_date','target_complete','target_complete_date'];
var CLIENT_FIELDS  = ['name','email','neighborhood','address','phone','portal_code','status'];

function pick(src, allowed) {
  var out = {};
  Object.keys(src || {}).forEach(function (k) { if (allowed.indexOf(k) > -1 && src[k] !== undefined) out[k] = src[k]; });
  return out;
}

function genCode(n) {
  var ch = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', o = '';
  for (var i = 0; i < n; i++) o += ch.charAt(Math.floor(Math.random() * ch.length));
  return o;
}

async function sbDelete(env, table, filter) {
  var c = sb(env);
  if (!c) throw new Error('supabase not configured');
  var r = await fetch(c.url + '/rest/v1/' + table + '?' + filter, {
    method: 'DELETE',
    headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, Prefer: 'return=minimal' }
  });
  if (!r.ok) throw new Error('delete failed ' + r.status);
  return true;
}

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!sb(env)) return json({ ok: false, error: 'Supabase not connected' }, 200);

  var d; try { d = await request.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }
  var op = d.op;

  try {
    // ── get: project + timeline + client (powers the editor) ──
    if (op === 'get') {
      if (!isUuid(d.project_id)) return json({ ok: false, error: 'bad id' }, 400);
      var pr = await sbSelect(env, 'cdb_projects?select=*&id=eq.' + d.project_id + '&limit=1');
      var project = pr && pr[0];
      if (!project) return json({ ok: false, error: 'not found' }, 404);
      var events = await sbSelect(env, 'cdb_project_events?select=*&project_id=eq.' + d.project_id + '&order=created_at.desc&limit=100');
      var client = null;
      if (project.client_id) { var cr = await sbSelect(env, 'cdb_clients?select=*&id=eq.' + project.client_id + '&limit=1'); client = cr && cr[0]; }
      return json({ ok: true, project: project, events: events || [], client: client }, 200);
    }

    // ── update_project ──
    if (op === 'update_project') {
      if (!isUuid(d.project_id)) return json({ ok: false, error: 'bad id' }, 400);
      var f = pick(d.fields, PROJECT_FIELDS);
      if (f.contract_value != null) f.contract_value = Number(f.contract_value) || 0;
      var stageChanged = false, fromStage = null;
      if (f.stage) {
        if (STAGE_ORDER.indexOf(f.stage) === -1) return json({ ok: false, error: 'bad stage' }, 400);
        var cur = await sbSelect(env, 'cdb_projects?select=stage&id=eq.' + d.project_id + '&limit=1');
        fromStage = cur && cur[0] && cur[0].stage;
        stageChanged = fromStage !== f.stage;
        f.stage_index = STAGE_ORDER.indexOf(f.stage);
      }
      if (!Object.keys(f).length) return json({ ok: false, error: 'no fields' }, 400);
      await sbUpdate(env, 'cdb_projects', 'id=eq.' + d.project_id, f);
      if (stageChanged) {
        try { await sbInsert(env, 'cdb_project_events', { project_id: d.project_id, event: 'stage_advanced', from_stage: fromStage, to_stage: f.stage }); } catch (e) {}
      }
      return json({ ok: true }, 200);
    }

    // ── add_event (timeline entry shown on the portal feed) ──
    if (op === 'add_event') {
      if (!isUuid(d.project_id)) return json({ ok: false, error: 'bad id' }, 400);
      var ev = (d.event || '').toString().trim().slice(0, 60) || 'update';
      var note = (d.note || '').toString().trim().slice(0, 280);
      var row = { project_id: d.project_id, event: ev, detail: note ? { note: note } : {} };
      if (d.at) { var t = new Date(d.at); if (!isNaN(t)) row.created_at = t.toISOString(); }
      var ins = await sbInsert(env, 'cdb_project_events', row);
      return json({ ok: true, id: ins && ins.id }, 200);
    }

    // ── update_event ──
    if (op === 'update_event') {
      if (!isUuid(d.event_id)) return json({ ok: false, error: 'bad id' }, 400);
      var patch = {};
      if (d.event != null) patch.event = d.event.toString().trim().slice(0, 60);
      if (d.note != null) patch.detail = { note: d.note.toString().trim().slice(0, 280) };
      if (d.at) { var t2 = new Date(d.at); if (!isNaN(t2)) patch.created_at = t2.toISOString(); }
      if (!Object.keys(patch).length) return json({ ok: false, error: 'no fields' }, 400);
      await sbUpdate(env, 'cdb_project_events', 'id=eq.' + d.event_id, patch);
      return json({ ok: true }, 200);
    }

    // ── delete_event ──
    if (op === 'delete_event') {
      if (!isUuid(d.event_id)) return json({ ok: false, error: 'bad id' }, 400);
      await sbDelete(env, 'cdb_project_events', 'id=eq.' + d.event_id);
      return json({ ok: true }, 200);
    }

    // ── update_client ──
    if (op === 'update_client') {
      if (!isUuid(d.client_id)) return json({ ok: false, error: 'bad id' }, 400);
      var cf = pick(d.fields, CLIENT_FIELDS);
      if (!Object.keys(cf).length) return json({ ok: false, error: 'no fields' }, 400);
      await sbUpdate(env, 'cdb_clients', 'id=eq.' + d.client_id, cf);
      return json({ ok: true }, 200);
    }

    // ── add_photo: push a progress photo to the Owner Suite gallery ──
    if (op === 'add_photo') {
      if (!isUuid(d.project_id)) return json({ ok: false, error: 'bad id' }, 400);
      var url = (d.url || '').toString().trim();
      if (!/^https?:\/\//i.test(url)) return json({ ok: false, error: 'a valid image URL (https://...) is required' }, 400);
      var prc = await sbSelect(env, 'cdb_projects?select=client_id&id=eq.' + d.project_id + '&limit=1');
      var cid = prc && prc[0] && prc[0].client_id;
      await sbInsert(env, 'cdb_documents', { project_id: d.project_id, client_id: cid || null, doc_type: 'photo', doc_name: (d.caption || 'Progress').toString().slice(0, 80), storage_path: url, metadata: { stage: (d.stage || '').toString().slice(0, 40) } });
      try { await sbInsert(env, 'cdb_project_events', { project_id: d.project_id, event: 'photo_added', detail: { note: (d.caption || 'New progress photo') } }); } catch (e) {}
      return json({ ok: true }, 200);
    }

    // ── create_client_project: one-click onboarding of a real client ──
    if (op === 'create_client_project') {
      var cn = (d.client_name || '').toString().trim();
      var pn = (d.project_name || '').toString().trim();
      if (!cn || !pn) return json({ ok: false, error: 'client name and project name are required' }, 400);
      var ce = (d.client_email || '').toString().trim().toLowerCase();
      var client = null;
      if (ce) { var ex = await sbSelect(env, 'cdb_clients?select=*&email=ilike.' + encodeURIComponent(ce) + '&limit=1'); client = ex && ex[0]; }
      if (!client) {
        client = await sbInsert(env, 'cdb_clients', {
          name: cn, email: ce || null, neighborhood: d.neighborhood || null,
          portal_code: (d.portal_code || genCode(6)), referral_code: genCode(8), status: 'active'
        });
      }
      var stage = (STAGE_ORDER.indexOf(d.stage) > -1) ? d.stage : 'consultation';
      var proj = await sbInsert(env, 'cdb_projects', {
        client_id: client.id, name: pn, project_type: d.project_type || 'Custom Pool',
        pool_type: d.pool_type || null, contract_value: Number(d.contract_value) || 0,
        stage: stage, stage_index: STAGE_ORDER.indexOf(stage),
        start_date: d.start_date || null, target_complete: d.target_complete || null
      });
      try { await sbInsert(env, 'cdb_project_events', { project_id: proj.id, event: 'project_created', detail: { note: 'Project created in admin' } }); } catch (e) {}
      return json({ ok: true, client_id: client.id, project_id: proj.id, portal_code: client.portal_code, portal_email: client.email }, 200);
    }

    return json({ ok: false, error: 'unknown op' }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 200);
  }
}

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-cdb-admin', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
