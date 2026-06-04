// GET  /api/admin-data - aggregate cdb_* into the dashboard shape.
// POST /api/admin-data - { op:'advance_stage', project_id, to } persists a kanban move.
// Requires the x-cdb-admin header (set by the console after login).
import { sbSelect, sbUpdate, sbInsert, json } from './_lib.js';
import { guardAdmin, isUuid } from './_lib_security.js';

var STAGE_ORDER = ['consultation','design','proposal','contract','excavation','rebar_bonding','plumbing_electrical','inspections','shotcrete','tile_coping','equipment','decking','interior_finish','fill_startup'];

export async function onRequestGet(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false, error: 'unauthorized' }, 401);

  try {
    var since = new Date(Date.now() - 30 * 864e5).toISOString();
    var leads = await sbSelect(env, 'cdb_leads?select=*&order=created_at.desc&limit=100');
    var clients = await sbSelect(env, 'cdb_clients?select=*&order=created_at.desc&limit=200');
    var projects = await sbSelect(env, 'cdb_projects?select=*&order=stage_index.asc&limit=200');
    var events = await sbSelect(env, 'cdb_events?select=page,created_at&created_at=gte.' + since + '&limit=5000');
    var referrals = await sbSelect(env, 'cdb_referrals?select=*&order=created_at.desc&limit=100');
    var payments = await sbSelect(env, 'cdb_payments?select=*&order=created_at.desc&limit=100');
    var clientById = {}; clients.forEach(function(c){ clientById[c.id] = c; });
    var projById = {}; projects.forEach(function(p){ projById[p.id] = p; });

    // If nothing seeded yet, signal empty so the console keeps its demo data.
    if (!projects.length && !leads.length) return json({ ok: true, empty: true }, 200);

    // KPIs
    var pipelineValue = projects.filter(function(p){return p.actual_complete==null;}).reduce(function(a,p){return a+(+p.contract_value||0);},0);
    var weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    var out = {
      kpis: {
        pipeline_value: pipelineValue,
        active_projects: projects.filter(function(p){return p.actual_complete==null;}).length,
        new_leads: leads.filter(function(l){return l.created_at>weekAgo;}).length,
        consults_week: leads.filter(function(l){return l.status==='consult_booked' && l.created_at>weekAgo;}).length
      },
      projects: projects.map(function(p){ return { id:p.id, name:p.name, client:'', value:+p.contract_value||0, stage:p.stage, neighborhood:'' }; }),
      leads: leads.slice(0,40).map(function(l){ return { id:l.id, name:l.name, neighborhood:l.address||'', project:l.project_type||'', budget:l.budget||'', source:l.source||'', status:l.status, created:rel(l.created_at), resp:resp(l) }; }),
      clients: clients.map(function(c){ return { id:c.id, name:c.name, neighborhood:c.neighborhood||'', projects:1, value:0, status:c.status }; }),
      sources: tally(leads.map(function(l){return l.source||'website';})),
      funnel: funnel(leads),
      pages: tally(events.map(function(e){return e.page||'(none)';})).slice(0,6),
      referrals: referrals.map(function(r){
        var rc = r.referrer_client_id && clientById[r.referrer_client_id];
        return { id:r.id, referred:r.referred_name||'', email:r.referred_email||'', referrer:rc?rc.name:(r.referrer_code||''), code:r.referrer_code||'', status:r.status||'pending', reward:r.reward_status||'none', when:rel(r.created_at) };
      }),
      payments: payments.map(function(p){
        var c = p.client_id && clientById[p.client_id], pr = p.project_id && projById[p.project_id];
        return { id:p.id, project_id:p.project_id||null, client:c?c.name:'', project:pr?pr.name:'', draw:p.draw_label||'', draw_no:p.draw_number!=null?+p.draw_number:null, amount:+p.amount_usd||0, method:p.method||'check', status:p.status||'reported', ref:p.reference||'', due_at:p.due_at||null, when:rel(p.created_at) };
      })
    };
    return json(out, 200);
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 200); // 200 so console falls back to demo
  }
}

export async function onRequestPost(context) {
  var env = context.env, request = context.request;
  if (!(await guardAdmin(env, request))) return json({ ok: false }, 401);
  var d; try { d = await request.json(); } catch (e) { return json({ ok: false }, 400); }
  if (d.op === 'advance_stage' && d.project_id && d.to) {
    if (!isUuid(d.project_id) || STAGE_ORDER.indexOf(d.to) === -1) return json({ ok: false, error: 'bad input' }, 400);
    try {
      var idx = STAGE_ORDER.indexOf(d.to);
      await sbUpdate(env, 'cdb_projects', 'id=eq.' + d.project_id, { stage: d.to, stage_index: idx < 0 ? 0 : idx });
      await sbInsert(env, 'cdb_project_events', { project_id: d.project_id, event: 'stage_advanced', from_stage: d.from || null, to_stage: d.to });
      return json({ ok: true }, 200);
    } catch (e) { return json({ ok: false, error: String(e.message || e) }, 200); }
  }
  return json({ ok: false, error: 'unknown op' }, 400);
}

// helpers
function rel(ts){ var s=(Date.now()-new Date(ts))/1000; if(s<3600)return Math.round(s/60)+'m ago'; if(s<86400)return Math.round(s/3600)+'h ago'; return Math.round(s/86400)+'d ago'; }
function resp(l){ if(!l.responded_at)return '-'; var m=Math.round((new Date(l.responded_at)-new Date(l.created_at))/60000); return (m<1?'<1':m)+' min'; }
function tally(arr){ var m={}; arr.forEach(function(x){m[x]=(m[x]||0)+1;}); return Object.keys(m).map(function(k){return [k,m[k]];}).sort(function(a,b){return b[1]-a[1];}); }
function funnel(leads){
  var inq=leads.length, q=leads.filter(function(l){return ['qualified','consult_booked','converted'].indexOf(l.status)>-1;}).length,
      c=leads.filter(function(l){return ['consult_booked','converted'].indexOf(l.status)>-1;}).length,
      s=leads.filter(function(l){return l.status==='converted';}).length;
  function pct(n){ return inq?Math.round(n/inq*100)+'%':'0%'; }
  return [['Inquiries',inq,'100%'],['Qualified',q,pct(q)],['Consults',c,pct(c)],['Signed',s,pct(s)]];
}
