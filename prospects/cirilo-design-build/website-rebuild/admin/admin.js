/* ════════════════════════════════════════════════════════════
   Cirilo Admin Console - client logic
   Login gate, view routing, 14-stage kanban (drag-to-advance),
   leads/clients tables, analytics. Runs on demo data, swaps to
   live /api/admin-data when the endpoint responds.
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── 14 canonical stages ──────────────────────────────────────
  var STAGES = [
    { key:'consultation', name:'Consultation' },
    { key:'design', name:'Design' },
    { key:'proposal', name:'Proposal' },
    { key:'contract', name:'Contract' },
    { key:'excavation', name:'Excavation' },
    { key:'rebar_bonding', name:'Rebar & Bonding' },
    { key:'plumbing_electrical', name:'Plumbing / Electrical' },
    { key:'inspections', name:'Inspections' },
    { key:'shotcrete', name:'Shotcrete / Gunite' },
    { key:'tile_coping', name:'Tile & Coping' },
    { key:'equipment', name:'Equipment' },
    { key:'decking', name:'Decking' },
    { key:'interior_finish', name:'Interior Finish' },
    { key:'fill_startup', name:'Fill & Startup' }
  ];
  var stageIndex = {}; STAGES.forEach(function(s,i){ stageIndex[s.key]=i; });

  // ── Demo data (used until live API responds) ──────────────────
  var DEMO = {
    live: false,
    kpis: { pipeline_value: 1620000, active_projects: 7, new_leads: 5, consults_week: 3 },
    projects: [
      { id:'d1', name:'Myers Park Vanishing Edge', client:'The Harrisons', value:385000, stage:'shotcrete', neighborhood:'Myers Park' },
      { id:'d2', name:'Lake Norman Infinity Spa', client:'Becker Residence', value:420000, stage:'design', neighborhood:'Cornelius' },
      { id:'d3', name:'Waxhaw Resort Backyard', client:'Patel Family', value:265000, stage:'excavation', neighborhood:'Waxhaw' },
      { id:'d4', name:'SouthPark Modern Plunge', client:'Alvarez', value:155000, stage:'proposal', neighborhood:'SouthPark' },
      { id:'d5', name:'Ballantyne Outdoor Living', client:'The Coles', value:198000, stage:'tile_coping', neighborhood:'Ballantyne' },
      { id:'d6', name:'Davidson Lakefront Build', client:'Nguyen Estate', value:310000, stage:'contract', neighborhood:'Davidson' },
      { id:'d7', name:'Weddington Estate Pool', client:'Sutton', value:287000, stage:'interior_finish', neighborhood:'Weddington' }
    ],
    leads: [
      { id:'l1', name:'Robert Kingsley', neighborhood:'Myers Park', project:'Custom Pool', budget:'$250K-$400K', source:'Google LSA', status:'new', created:'2h ago', resp:'1 min' },
      { id:'l2', name:'Dana Whitfield', neighborhood:'Lake Norman', project:'Pool + Outdoor', budget:'$400K+', source:'Referral', status:'qualified', created:'1d ago', resp:'3 min' },
      { id:'l3', name:'Marcus Reed', neighborhood:'Waxhaw', project:'Custom Pool', budget:'$150K-$250K', source:'Google Search', status:'consult', created:'2d ago', resp:'2 min' },
      { id:'l4', name:'Priya Anand', neighborhood:'SouthPark', project:'Renovation', budget:'Not sure', source:'Houzz', status:'contacted', created:'3d ago', resp:'8 min' },
      { id:'l5', name:'The Bensons', neighborhood:'Davidson', project:'Pool + Outdoor', budget:'$250K-$400K', source:'Meta', status:'new', created:'4d ago', resp:'1 min' }
    ],
    clients: [
      { id:'c1', name:'The Harrisons', neighborhood:'Myers Park', projects:1, value:385000, status:'active' },
      { id:'c2', name:'Becker Residence', neighborhood:'Cornelius', projects:1, value:420000, status:'active' },
      { id:'c3', name:'Sutton', neighborhood:'Weddington', projects:1, value:287000, status:'active' },
      { id:'c4', name:'The Caldwells', neighborhood:'SouthPark', projects:2, value:540000, status:'complete' }
    ],
    sources: [ ['Google LSA',34],['Referral',28],['Google Search',19],['Houzz',11],['Meta',8] ],
    funnel: [ ['Inquiries',42,'100%'],['Qualified Consults',15,'36%'],['Proposals Sent',9,'21%'],['Signed Contracts',4,'10%'] ],
    pages: [ ['/ (home)',1240],['/portfolio',680],['/custom-concrete-swimming-pools',520],['/service-areas/myers-park',310],['/book',290],['/contact',280],['/about',240] ],
    referrals: [
      { referred:'Robert Kingsley', email:'rk@example.com', referrer:'The Harrisons', code:'HARR4821', status:'consult', when:'2d ago' },
      { referred:'Dana Whitfield', email:'dana@example.com', referrer:'Becker Residence', code:'BECK2207', status:'converted', when:'1w ago' },
      { referred:'Marcus Reed', email:'mreed@example.com', referrer:'The Harrisons', code:'HARR4821', status:'pending', when:'3d ago' }
    ],
    payments: [
      { id:'p1', client:'The Harrisons', project:'Myers Park Vanishing Edge', draw:'Draw 3 - Shotcrete', amount:78000, method:'check', status:'reported', when:'2d ago', ref:'check #1042' },
      { id:'p2', client:'Sutton', project:'Weddington Estate Pool', draw:'Draw 4 - Tile & Equipment', amount:57400, method:'ach', status:'received', when:'1w ago', ref:'ACH 88123' }
    ]
  };

  var DATA = DEMO;

  // ── Money fmt ─────────────────────────────────────────────────
  function money(n){ return '$' + (n>=1000000 ? (n/1000000).toFixed(2)+'M' : Math.round(n/1000)+'K'); }

  // ── UI kit: toasts, form modal, confirm ───────────────────────
  function copyText(t){ try{ if(navigator.clipboard) navigator.clipboard.writeText(t); }catch(e){} }
  function mcToast(msg,type){
    var wrap=document.getElementById('mc-toasts'); if(!wrap) return;
    var t=document.createElement('div'); t.className='mc-toast'+(type?(' '+type):'');
    var ico=type==='success'?'&#10003;':(type==='error'?'&#9888;':'&#8226;');
    t.innerHTML='<span class="mt-ico">'+ico+'</span><span>'+msg+'</span><span class="mt-x">&times;</span>';
    t.querySelector('.mt-x').onclick=function(){ t.remove(); };
    wrap.appendChild(t);
    setTimeout(function(){ t.style.transition='opacity .3s'; t.style.opacity='0'; setTimeout(function(){t.remove();},320); },4200);
  }
  function mcModalForm(opts){
    return new Promise(function(resolve){
      var modal=document.getElementById('mc-modal');
      document.getElementById('mc-title').textContent=opts.title||'';
      var sub=document.getElementById('mc-sub'); if(opts.sub){sub.textContent=opts.sub;sub.style.display='block';}else{sub.style.display='none';}
      var err=document.getElementById('mc-err'); err.style.display='none';
      var fields=opts.fields||[];
      document.getElementById('mc-fields').innerHTML=fields.map(function(f){
        var input;
        if(f.type==='textarea') input='<textarea id="mcf-'+f.name+'" rows="'+(f.rows||3)+'" placeholder="'+(f.placeholder||'')+'">'+(f.value||'')+'</textarea>';
        else if(f.type==='select') input='<select id="mcf-'+f.name+'">'+(f.options||[]).map(function(o){var v=(o&&typeof o==='object')?o.value:o; var l=(o&&typeof o==='object')?o.label:o; return '<option value="'+v+'"'+(String(f.value)===String(v)?' selected':'')+'>'+l+'</option>';}).join('')+'</select>';
        else input='<input id="mcf-'+f.name+'" type="'+(f.type||'text')+'" placeholder="'+(f.placeholder||'')+'" value="'+(f.value||'')+'">';
        return '<div class="mfield"><label>'+f.label+(f.required?' *':'')+'</label>'+input+'</div>';
      }).join('');
      document.getElementById('mc-ok').textContent=opts.submitLabel||'Save';
      modal.classList.add('on');
      var first=document.querySelector('#mc-fields input,#mc-fields textarea'); if(first) setTimeout(function(){first.focus();},60);
      function close(val){ modal.classList.remove('on'); document.getElementById('mc-ok').onclick=null; document.getElementById('mc-cancel').onclick=null; resolve(val); }
      document.getElementById('mc-cancel').onclick=function(){ close(null); };
      document.getElementById('mc-ok').onclick=function(){
        var out={},ok=true;
        fields.forEach(function(f){ var el=document.getElementById('mcf-'+f.name); var v=el?el.value.trim():''; if(f.required&&!v) ok=false; out[f.name]=v; });
        if(!ok){ err.textContent='Please complete the required fields.'; err.style.display='block'; return; }
        close(out);
      };
    });
  }
  function mcConfirm(opts){
    return new Promise(function(resolve){
      var modal=document.getElementById('mc-modal');
      document.getElementById('mc-title').textContent=opts.title||'Are you sure?';
      var sub=document.getElementById('mc-sub'); if(opts.message){sub.textContent=opts.message;sub.style.display='block';}else{sub.style.display='none';}
      document.getElementById('mc-err').style.display='none';
      document.getElementById('mc-fields').innerHTML='';
      document.getElementById('mc-ok').textContent=opts.confirmLabel||'Confirm';
      modal.classList.add('on');
      function close(val){ modal.classList.remove('on'); document.getElementById('mc-ok').onclick=null; document.getElementById('mc-cancel').onclick=null; resolve(val); }
      document.getElementById('mc-cancel').onclick=function(){ close(false); };
      document.getElementById('mc-ok').onclick=function(){ close(true); };
    });
  }

  // ── Login ─────────────────────────────────────────────────────
  window.doLogin = function(){
    var email=document.getElementById('li-email').value.trim();
    var pass=document.getElementById('li-pass').value;
    var err=document.getElementById('login-err');
    err.style.display='none';
    if(!email || !pass){ err.textContent='Enter your email and password.'; err.style.display='block'; return; }
    // Real server auth only. No client-side bypass.
    fetch('/api/admin-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,password:pass})})
      .then(function(r){ return r.json().then(function(j){ return { httpOk:r.ok, status:r.status, j:j }; }); })
      .then(function(res){
        if(res.httpOk && res.j && res.j.ok){
          if(res.j.token){ sessionStorage.setItem('cdb_admin', res.j.token); }
          sessionStorage.setItem('cdb_admin_email', res.j.email||email);
          enter(res.j.email||email); return;
        }
        if(res.status===503){ err.textContent='Login is not configured yet. Set CDB_ADMIN_PASS.'; }
        else { err.textContent='Incorrect email or password.'; }
        err.style.display='block';
      })
      .catch(function(){ err.textContent='Could not reach the server. Please try again.'; err.style.display='block'; });
  };
  function enter(email){
    // cdb_admin holds the signed session token (set by doLogin); never overwrite it here.
    var who=email||sessionStorage.getItem('cdb_admin_email')||'';
    document.getElementById('login').style.display='none';
    document.getElementById('app').style.display='block';
    if(who && who.indexOf('mark')>-1) document.getElementById('who').textContent='Mark Gabrielli';
    loadData();
    loadVendorsAdmin();
    loadActivity();
    loadDocs();
    loadProposals();
    loadPartners();
    loadRenderings();
    loadHealth();
    loadQbo();
    qboFlash();
  }
  window.logout=function(){ sessionStorage.removeItem('cdb_admin'); sessionStorage.removeItem('cdb_admin_email'); location.reload(); };

  // ── View routing ──────────────────────────────────────────────
  document.querySelectorAll('.sb-nav a').forEach(function(a){
    a.addEventListener('click',function(){
      document.querySelectorAll('.sb-nav a').forEach(function(x){x.classList.remove('active');});
      a.classList.add('active');
      var v=a.dataset.view;
      document.querySelectorAll('.view').forEach(function(x){x.classList.remove('active');});
      document.getElementById('view-'+v).classList.add('active');
      document.getElementById('view-title').textContent=a.textContent.trim();
      var sb=document.querySelector('.sidebar'); if(sb) sb.classList.remove('open');
    });
  });

  // ── Load (try live, fall back to demo) ────────────────────────
  function loadData(){
    fetch('/api/admin-data',{headers:{'x-cdb-admin':sessionStorage.getItem('cdb_admin')||''}})
      .then(function(r){ return r.ok ? r.json() : Promise.reject(); })
      .then(function(d){ if(d && d.projects){ DATA=Object.assign({live:true},d); badgeLive(); } render(); })
      .catch(function(){ DATA=DEMO; render(); });
  }
  function badgeLive(){ var b=document.getElementById('data-badge'); b.textContent='Live'; b.classList.add('live-badge'); }

  // ── Render everything ─────────────────────────────────────────
  function render(){ renderKpis(); renderKanban('mini-kanban',true); renderKanban('full-kanban',false); renderDashLeads(); renderLeads(); renderClients(); renderAnalytics(); renderReferrals(); renderPayments(); renderEmail(); renderVendorsAdmin(); renderFinancials(); renderNeedsAttention(); }
  function renderFinancials(){
    var el=document.getElementById('fin-table'); if(!el) return;
    var projects=DATA.projects||[], pays=DATA.payments||[], assigns=(typeof VDATA!=='undefined'?(VDATA.assignments||[]):[]);
    var map={};
    function row(k){ if(!map[k]) map[k]={name:k||'(unassigned)',contract:0,billed:0,collected:0,outstanding:0,vcommit:0,vpaid:0}; return map[k]; }
    projects.forEach(function(p){ var r=row(p.name); r.contract+=+p.value||0; });
    pays.forEach(function(p){ var r=row(p.project||''); var amt=+p.amount||0; if(p.status!=='scheduled'&&p.status!=='void'){ r.billed+=amt; if(p.status==='received'||p.status==='cleared') r.collected+=amt; } });
    assigns.forEach(function(a){ var r=row(a.project||''); r.vcommit+=(+a.amount||0); if(a.pay_status==='paid') r.vpaid+=(+a.amount||0); });
    var rows=Object.keys(map).map(function(k){return map[k];}).filter(function(r){return r.contract||r.billed||r.vcommit;});
    rows.forEach(function(r){ r.outstanding=r.billed-r.collected; r.margin=r.contract-r.vcommit; r.marginPct=r.contract?Math.round(r.margin/r.contract*100):0; });
    rows.sort(function(a,b){ return (b.contract||0)-(a.contract||0); });
    var T={contract:0,billed:0,collected:0,outstanding:0,vcommit:0,vpaid:0,margin:0};
    rows.forEach(function(r){ T.contract+=r.contract;T.billed+=r.billed;T.collected+=r.collected;T.outstanding+=r.outstanding;T.vcommit+=r.vcommit;T.vpaid+=r.vpaid;T.margin+=r.margin; });
    kpiCards('fin-kpis',[['Contract Value',money(T.contract),'Across projects'],['Collected',money(T.collected),'Received or cleared'],['Outstanding',money(T.outstanding),'Billed, not yet paid'],['Vendor Cost',money(T.vcommit),money(T.vpaid)+' paid'],['Gross Margin',money(T.margin),(T.contract?Math.round(T.margin/T.contract*100):0)+'% of contract']]);
    if(!rows.length){ el.innerHTML='<p class="empty">No project financials yet. They populate as projects are signed and billed.</p>'; return; }
    el.innerHTML='<table><thead><tr><th>Project</th><th>Contract</th><th>Billed</th><th>Collected</th><th>Outstanding</th><th>Vendor Cost</th><th>Gross Margin</th></tr></thead><tbody>'+rows.map(function(r){
      var mc=r.marginPct>=40?'converted':(r.marginPct>=25?'consult':'lost');
      return '<tr><td><strong>'+r.name+'</strong></td><td class="mono">'+money(r.contract)+'</td><td class="mono">'+money(r.billed)+'</td><td class="mono">'+money(r.collected)+'</td><td class="mono">'+money(r.outstanding)+'</td><td class="mono">'+money(r.vcommit)+'</td><td class="mono">'+money(r.margin)+' '+statusPill(mc)+' '+r.marginPct+'%</td></tr>';
    }).join('')+'<tr style="border-top:2px solid var(--line);font-weight:700;"><td>Total</td><td class="mono">'+money(T.contract)+'</td><td class="mono">'+money(T.billed)+'</td><td class="mono">'+money(T.collected)+'</td><td class="mono">'+money(T.outstanding)+'</td><td class="mono">'+money(T.vcommit)+'</td><td class="mono">'+money(T.margin)+'</td></tr></tbody></table>';
  }

  window.gotoView=function(v){ var a=document.querySelector('.sb-nav a[data-view="'+v+'"]'); if(a) a.click(); };
  function renderNeedsAttention(){
    var panel=document.getElementById('attn-panel'), list=document.getElementById('attn-list'); if(!panel||!list) return;
    var items=[];
    var newLeads=(DATA.leads||[]).filter(function(l){return l.status==='new';}).length;
    if(newLeads) items.push({t:newLeads+' new lead'+(newLeads>1?'s':'')+' to respond to',v:'leads',cta:'View'});
    var repPays=(DATA.payments||[]).filter(function(p){return p.status==='reported';}).length;
    if(repPays) items.push({t:repPays+' payment'+(repPays>1?'s':'')+' awaiting your confirmation',v:'payments',cta:'Confirm'});
    var sentProps=(typeof PROPOSALS!=='undefined'?PROPOSALS:[]).filter(function(p){return p.status==='sent';}).length;
    if(sentProps) items.push({t:sentProps+' proposal'+(sentProps>1?'s':'')+' awaiting signature',v:'proposals',cta:'View'});
    var bidsCount=(typeof VDATA!=='undefined'?(VDATA.bids||[]):[]).filter(function(b){return b.status==='submitted';}).length;
    if(bidsCount) items.push({t:bidsCount+' vendor bid'+(bidsCount>1?'s':'')+' to review',v:'vendors',cta:'Review'});
    var unpaid=(typeof VDATA!=='undefined'?(VDATA.assignments||[]):[]).filter(function(a){return a.status==='complete'&&a.pay_status!=='paid';}).length;
    if(unpaid) items.push({t:unpaid+' completed vendor job'+(unpaid>1?'s':'')+' to pay',v:'vendors',cta:'Pay'});
    var pendVen=(typeof VDATA!=='undefined'?(VDATA.vendors||[]):[]).filter(function(v){return v.status==='pending';}).length;
    if(pendVen) items.push({t:pendVen+' vendor application'+(pendVen>1?'s':'')+' to review',v:'vendors',cta:'Review'});
    var newPartners=(typeof PARTNERS!=='undefined'?PARTNERS:[]).filter(function(p){return p.status==='new';}).length;
    if(newPartners) items.push({t:newPartners+' partner application'+(newPartners>1?'s':'')+' to review',v:'partners',cta:'Review'});
    var newRenders=(typeof RENDERINGS!=='undefined'?RENDERINGS:[]).filter(function(r){return r.status==='new';}).length;
    if(newRenders) items.push({t:newRenders+' rendering request'+(newRenders>1?'s':'')+' to start',v:'partners',cta:'View'});
    var rewardsDue=(DATA.referrals||[]).filter(function(r){return r.reward==='pending';}).length;
    if(rewardsDue) items.push({t:rewardsDue+' referral reward'+(rewardsDue>1?'s':'')+' to send',v:'referrals',cta:'View'});
    if(!items.length){ panel.style.display='none'; return; }
    panel.style.display='block';
    list.innerHTML=items.map(function(i){ return '<div class="attn-row"><span class="attn-dot"></span><span class="attn-t">'+i.t+'</span><button class="attn-cta" onclick="gotoView(\''+i.v+'\')">'+i.cta+'</button></div>'; }).join('');
  }

  var EMAIL_TEMPLATES=[
    { key:'consult_confirm', name:'Consultation confirmation', subject:'Your Cirilo consultation request', trigger:'Sent when a consultation is requested' },
    { key:'consult_followup', name:'Consultation follow-up', subject:'Following up on your pool project', trigger:'24h to 21d after an open lead goes quiet' },
    { key:'proposal_sent', name:'Proposal delivered', subject:'Your Cirilo proposal is ready', trigger:'When a proposal link is sent' },
    { key:'proposal_followup', name:'Proposal follow-up', subject:'A quick note on your proposal', trigger:'A few days after a proposal is sent, unsigned' },
    { key:'welcome', name:'Welcome to your Owner Suite', subject:'Welcome to Cirilo, your project is open', trigger:'On signature / onboarding' },
    { key:'payment_reminder', name:'Draw payment reminder', subject:'A friendly reminder on your draw', trigger:'72h after a reported draw is unconfirmed' }
  ];
  function renderEmail(){
    var el=document.getElementById('email-templates'); if(!el) return;
    el.innerHTML='<table><thead><tr><th>Template</th><th>Subject</th><th>Trigger</th></tr></thead><tbody>'+
      EMAIL_TEMPLATES.map(function(t){ return '<tr><td><strong>'+t.name+'</strong><br><span class="mono" style="font-size:0.72rem;color:var(--muted);">'+t.key+'</span></td><td>'+t.subject+'</td><td style="color:var(--muted);font-size:0.85rem;">'+t.trigger+'</td></tr>'; }).join('')+
      '</tbody></table>';
  }
  window.previewFollowups=function(){
    var q=document.getElementById('email-queue'); q.innerHTML='<p class="empty">Computing due follow-ups...</p>';
    fetch('/api/email-followups',{headers:{'x-cdb-admin':sessionStorage.getItem('cdb_admin')||''}})
      .then(function(r){return r.json();})
      .then(function(j){
        var due=(j&&j.due)||[];
        if(!due.length){ q.innerHTML='<p class="empty">No follow-ups due right now.'+(j&&j.note?(' '+j.note):'')+'</p>'; return; }
        q.innerHTML='<table><thead><tr><th>To</th><th>Template</th><th>Why</th></tr></thead><tbody>'+
          due.map(function(d){ return '<tr><td>'+(d.to||d.draw||'(client)')+'</td><td><span class="mono">'+d.template+'</span></td><td style="color:var(--muted);font-size:0.85rem;">'+(d.reason||'')+'</td></tr>'; }).join('')+
          '</tbody></table><p style="color:var(--muted);font-size:0.8rem;margin-top:12px;padding:0 16px;">Dry run. '+((j&&j.note)||'No emails were sent.')+'</p>';
      })
      .catch(function(){ q.innerHTML='<p class="empty">Could not load the follow-up queue.</p>'; });
  };

  function kpiCards(elId, items){
    var el=document.getElementById(elId); if(!el) return;
    el.innerHTML=items.map(function(x){ return '<div class="kpi"><div class="label">'+x[0]+'</div><div class="val">'+x[1]+'</div><div class="delta up">'+x[2]+'</div></div>'; }).join('');
  }
  function methodPill(m){ return '<span class="pill '+(m==='ach'?'qualified':'contacted')+'">'+(m==='ach'?'ACH':'Check')+'</span>'; }

  // ── Proposals (per-client) ────────────────────────────────────
  var PROPOSAL_DEMO=[
    {slug:'harrington-ab12',client_name:'The Harrington Residence',title:'Myers Park Vanishing Edge',value:312000,status:'signed',when:'2026-04-12'},
    {slug:'becker-9f3k',client_name:'Becker Residence',title:'Lake Norman Infinity Spa',value:420000,status:'sent',when:'2026-05-28'}
  ];
  var PROPOSALS=PROPOSAL_DEMO;
  function loadProposals(){
    fetch('/api/admin-proposal',{headers:{'x-cdb-admin':sessionStorage.getItem('cdb_admin')||''}})
      .then(function(r){ return r.ok?r.json():Promise.reject(); })
      .then(function(d){ if(d&&d.items&&d.items.length){ PROPOSALS=d.items; } renderProposals(); renderNeedsAttention(); })
      .catch(function(){ renderProposals(); renderNeedsAttention(); });
  }
  function proposalUrl(slug){ return location.origin+'/proposal?c='+slug; }
  function renderProposals(){
    var el=document.getElementById('proposals-table'); if(!el) return;
    el.innerHTML='<table><thead><tr><th>Client</th><th>Title</th><th>Value</th><th>Status</th><th>Link</th></tr></thead><tbody>'+
      (PROPOSALS||[]).map(function(p){
        var st=p.status==='signed'?'converted':((p.status==='sent'||p.status==='viewed')?'consult':'new');
        return '<tr><td><strong>'+p.client_name+'</strong></td><td>'+p.title+'</td><td class="mono">'+money(p.value)+'</td><td>'+statusPill(st)+' '+(p.status||'')+'</td><td><a href="'+proposalUrl(p.slug)+'" target="_blank" rel="noopener" style="color:var(--gold-dark);">Open</a> &middot; <button class="kcount" style="cursor:pointer;border:none;" onclick="copyProposal(\''+p.slug+'\')">Copy</button></td></tr>';
      }).join('')+'</tbody></table>';
  }
  window.copyProposal=function(slug){ copyText(proposalUrl(slug)); mcToast('Proposal link copied to clipboard.','success'); };
  window.createProposal=function(){
    mcModalForm({title:'New Proposal',sub:'Creates a unique link to send your prospect.',submitLabel:'Create & copy link',fields:[
      {name:'client_name',label:'Client name',required:true,placeholder:'The Harrington Residence'},
      {name:'title',label:'Project title',required:true,placeholder:'Myers Park Vanishing Edge'},
      {name:'client_email',label:'Client email',type:'email',placeholder:'client@email.com'},
      {name:'neighborhood',label:'Neighborhood / location',placeholder:'Myers Park, Charlotte'},
      {name:'contract_value',label:'Contract value (USD)',type:'number',placeholder:'312000'},
      {name:'vision',label:'One-line vision',type:'textarea'}
    ]}).then(function(v){ if(!v) return;
      fetch('/api/admin-proposal',{method:'POST',headers:{'Content-Type':'application/json','x-cdb-admin':sessionStorage.getItem('cdb_admin')||''},body:JSON.stringify({op:'create',client_name:v.client_name,title:v.title,client_email:v.client_email,neighborhood:v.neighborhood,contract_value:v.contract_value?+v.contract_value:null,vision:v.vision})})
        .then(function(r){return r.json();}).then(function(j){
          if(j&&j.ok){ var u=location.origin+j.url; PROPOSALS=[{slug:j.slug,client_name:v.client_name,title:v.title,value:v.contract_value?+v.contract_value:0,status:'sent',when:'just now'}].concat(PROPOSALS); renderProposals(); copyText(u); mcToast('Proposal created. Link copied to clipboard.','success'); }
          else mcToast('Could not create proposal.','error');
        }).catch(function(){ mcToast('Could not reach the server.','error'); });
    });
  };

  // ── Document vault ────────────────────────────────────────────
  var DOC_DEMO=[
    {name:'Construction Agreement.pdf',type:'contract',by:'admin',status:'executed',url:null,when:'2026-04-12'},
    {name:'3D Rendering Set.pdf',type:'plan',by:'admin',status:'signed',url:null,when:'2026-04-09'},
    {name:'County Permit MC-2026-4471.pdf',type:'permit',by:'admin',status:'signed',url:null,when:'2026-05-02'},
    {name:'Apex Gunite COI.pdf',type:'vendor_doc',by:'vendor',status:'uploaded',url:null,when:'2026-05-20'},
    {name:'Survey + plot plan.pdf',type:'client_upload',by:'client',status:'uploaded',url:null,when:'2026-04-05'}
  ];
  var DOCS=DOC_DEMO;
  function fmtDate(s){ return s||''; }
  function loadDocs(){
    fetch('/api/doc-list',{headers:{'x-cdb-admin':sessionStorage.getItem('cdb_admin')||''}})
      .then(function(r){ return r.ok?r.json():Promise.reject(); })
      .then(function(d){ if(d&&d.items&&d.items.length){ DOCS=d.items; } renderDocs(); })
      .catch(function(){ renderDocs(); });
  }
  function renderDocs(){
    var el=document.getElementById('documents-list'); if(!el) return;
    el.innerHTML='<table><thead><tr><th>Document</th><th>Type</th><th>Source</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>'+
      (DOCS||[]).map(function(d){
        var dl=d.url?('<a href="'+d.url+'" target="_blank" rel="noopener" style="color:var(--gold-dark);">Download</a>'):'<span style="color:var(--muted);font-size:0.78rem;">n/a</span>';
        var del=d.id?(' &middot; <button class="kcount" style="cursor:pointer;border:none;color:#b42318;" onclick="adminDocDelete(\''+d.id+'\',\''+String(d.name||'').replace(/[\\\\\'"]/g,'')+'\')">Delete</button>'):'';
        return '<tr data-doc-id="'+(d.id||'')+'"><td><strong>'+d.name+'</strong></td><td>'+(d.type||'').replace(/_/g,' ')+'</td><td>'+(d.by||'')+'</td><td>'+statusPill(d.status==='executed'||d.status==='signed'?'converted':'contacted')+' '+(d.status||'')+'</td><td>'+(d.when||'')+'</td><td>'+dl+del+'</td></tr>';
      }).join('')+'</tbody></table>';
  }
  window.adminDocDelete=function(id,name){
    mcConfirm({title:'Delete document',message:'Permanently remove "'+(name||'this document')+'" from the vault? This cannot be undone.',confirmLabel:'Delete'}).then(function(ok){
      if(!ok) return;
      fetch('/api/doc-delete',{method:'POST',headers:{'Content-Type':'application/json','x-cdb-admin':sessionStorage.getItem('cdb_admin')||''},body:JSON.stringify({id:id})})
        .then(function(r){return r.json();}).then(function(j){
          if(j&&j.ok){ DOCS=(DOCS||[]).filter(function(x){return x.id!==id;}); renderDocs(); mcToast('Document deleted.','success'); }
          else mcToast('Could not delete document.','error');
        }).catch(function(){ mcToast('Could not reach the server.','error'); });
    });
  };
  window.adminDocUpload=function(input){
    var file=input.files&&input.files[0]; if(!file) return;
    var st=document.getElementById('admin-doc-status');
    if(file.size>10*1024*1024){ st.textContent='File too large (10MB max).'; return; }
    st.textContent='Uploading '+file.name+'...';
    var r=new FileReader(); r.onload=function(){
      fetch('/api/doc-upload',{method:'POST',headers:{'Content-Type':'application/json','x-cdb-admin':sessionStorage.getItem('cdb_admin')||''},body:JSON.stringify({filename:file.name,content_base64:String(r.result),mime:file.type,doc_type:'admin_upload',doc_name:file.name})})
        .then(function(rr){return rr.json();}).then(function(j){
          if(j&&j.ok){ st.textContent='Uploaded: '+file.name; DOCS=[{name:file.name,type:'admin_upload',by:'admin',status:'uploaded',url:null,when:'just now'}].concat(DOCS); renderDocs(); }
          else { st.textContent='Upload could not be saved.'; }
          input.value='';
        }).catch(function(){ st.textContent='Upload failed.'; input.value=''; });
    }; r.readAsDataURL(file);
  };

  // ── Activity feed (notifications center) ──────────────────────
  var ACTIVITY_DEMO=[
    {type:'payment',title:'Payment reported: Draw 3 - Shotcrete',sub:'$78,000',when:'2h ago'},
    {type:'bid',title:'Bid submitted',sub:'$59,500',when:'5h ago'},
    {type:'lead',title:'New lead: Robert Kingsley',sub:'Google LSA / new',when:'8h ago'},
    {type:'event',title:'stage advanced',sub:'Shotcrete shell applied',when:'1d ago'},
    {type:'referral',title:'Referral: Marcus Reed',sub:'pending',when:'1d ago'},
    {type:'lead',title:'New lead: Dana Whitfield',sub:'Referral / qualified',when:'2d ago'},
    {type:'event',title:'job completed',sub:'Steel inspection passed',when:'3d ago'}
  ];
  var ACTIVITY=ACTIVITY_DEMO;
  var ACT_ICON={lead:'&#9993;',payment:'&#9679;',bid:'&#9874;',referral:'&#9856;',event:'&#9788;',error:'&#9888;'};
  function loadActivity(){
    fetch('/api/admin-activity',{headers:{'x-cdb-admin':sessionStorage.getItem('cdb_admin')||''}})
      .then(function(r){ return r.ok?r.json():Promise.reject(); })
      .then(function(d){ if(d&&d.items&&d.items.length){ ACTIVITY=d.items; } renderActivity(); })
      .catch(function(){ renderActivity(); });
  }
  function renderActivity(){
    var el=document.getElementById('activity-feed'); if(!el) return;
    el.innerHTML='<div style="display:flex;flex-direction:column;">'+ACTIVITY.map(function(a){
      return '<div style="display:flex;gap:14px;padding:14px 16px;border-bottom:1px solid var(--border);align-items:flex-start;">'+
        '<div style="width:34px;height:34px;border-radius:50%;background:var(--gold-pale);color:var(--gold-dark);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+(ACT_ICON[a.type]||'&#8226;')+'</div>'+
        '<div style="flex:1;"><div style="font-weight:600;color:var(--ink);">'+a.title+'</div><div style="font-size:0.84rem;color:var(--muted);">'+(a.sub||'')+'</div></div>'+
        '<div class="mono" style="font-size:0.66rem;color:var(--muted);white-space:nowrap;">'+a.when+'</div></div>';
    }).join('')+'</div>';
    var bc=document.getElementById('bell-count'); if(bc){ bc.textContent=ACTIVITY.length; bc.style.display=ACTIVITY.length?'block':'none'; }
  }
  function loadHealth(){
    fetch('/api/health').then(function(r){return r.json();}).then(function(h){
      var mode=document.getElementById('health-mode'); if(mode) mode.textContent=(h.mode||'')+' mode';
      var el=document.getElementById('health-chips'); if(!el) return;
      var c=h.checks||{};
      var rows=[['Database',c.supabase],['Storage',c.storage],['Rate limiting',c.rate_limit_kv],['Email',c.email_configured],['Captcha',c.turnstile_configured],['QuickBooks',c.quickbooks_connected]];
      el.innerHTML=rows.map(function(r){ var on=r[1]; return '<span style="font-family:\'DM Mono\',monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;padding:6px 12px;border-radius:20px;background:'+(on?'var(--green-pale)':'#F1F1F1')+';color:'+(on?'var(--green)':'var(--muted)')+';">'+(on?'&#10003; ':'&#9675; ')+r[0]+'</span>'; }).join('');
    }).catch(function(){ var el=document.getElementById('health-chips'); if(el) el.innerHTML='<span style="color:var(--muted);font-size:0.85rem;">Health check unavailable.</span>'; });
  }
  window.adminPurgeEvents=function(){
    mcConfirm({title:'Purge old analytics',message:'Permanently delete raw page-view events older than 180 days. Aggregated dashboard metrics are unaffected. Continue?',confirmLabel:'Purge'}).then(function(ok){
      if(!ok) return;
      var st=document.getElementById('maint-status'); if(st) st.textContent='Purging...';
      fetch('/api/admin-maintenance',{method:'POST',headers:{'Content-Type':'application/json','x-cdb-admin':sessionStorage.getItem('cdb_admin')||''},body:JSON.stringify({op:'purge_events',days:180})})
        .then(function(r){return r.json();}).then(function(j){
          if(j&&j.ok){ var msg=j.demo?'Connect Supabase to enable retention purges.':('Removed '+(j.removed||0)+' events older than '+(j.days||180)+' days.'); if(st) st.textContent=msg; mcToast(j.demo?'Demo mode: nothing purged.':'Analytics purged.', j.demo?'info':'success'); }
          else { if(st) st.textContent='Purge failed.'; mcToast('Could not purge analytics.','error'); }
        }).catch(function(){ if(st) st.textContent='Server unreachable.'; mcToast('Could not reach the server.','error'); });
    });
  };

  // ── QuickBooks accounting connection ──────────────────────────
  window.__qboConnected=false;
  function qhdr(){ return {'Content-Type':'application/json','x-cdb-admin':sessionStorage.getItem('cdb_admin')||''}; }
  function qboFlash(){
    try{ var p=new URLSearchParams(location.search); var q=p.get('qbo'); if(!q) return;
      var m={connected:['QuickBooks connected.','success'],denied:['QuickBooks authorization was declined.','info'],error:['QuickBooks connection failed.','error'],badstate:['QuickBooks session expired, try again.','error'],notconfigured:['QuickBooks is not configured yet.','info']};
      var t=m[q]||null; if(t) mcToast(t[0],t[1]);
      history.replaceState({},'',location.pathname);
    }catch(e){}
  }
  function loadQbo(){
    var statusEl=document.getElementById('qbo-status'), actEl=document.getElementById('qbo-actions'), modeEl=document.getElementById('qbo-mode');
    if(!statusEl) return;
    fetch('/api/qbo-status',{headers:qhdr()}).then(function(r){return r.ok?r.json():Promise.reject();}).then(function(j){
      if(modeEl) modeEl.textContent=j.mode?(j.mode+' mode'):'';
      window.__qboConnected=!!j.connected;
      if(!j.configured){ statusEl.innerHTML='<span style="color:var(--muted);">Not configured. Set CDB_QBO_CLIENT_ID and CDB_QBO_CLIENT_SECRET, plus the redirect URI in your Intuit app.</span>'; actEl.innerHTML=''; renderPayments(); return; }
      if(j.connected){
        statusEl.innerHTML='<span class="pill converted">Connected</span> '+(j.company?('<strong>'+j.company+'</strong> ':''))+'<span style="color:var(--muted);font-size:0.82rem;">Company '+(j.realm_id||'')+'</span>';
        actEl.innerHTML='<button class="kcount" style="cursor:pointer;border:none;background:var(--gold);color:#fff;" onclick="qboSyncAll()">Sync all to QuickBooks</button> <button class="kcount" style="cursor:pointer;border:1px solid var(--line);background:#fff;" onclick="qboDisconnect()">Disconnect</button>';
      } else {
        statusEl.innerHTML='<span class="pill contacted">Not connected</span> <span style="color:var(--muted);font-size:0.82rem;">Authorize to sync invoices and payments.</span>';
        actEl.innerHTML='<button class="kcount" style="cursor:pointer;border:none;background:var(--green);" onclick="qboConnect()">Connect QuickBooks</button>';
      }
      renderPayments(); renderVendorsAdmin();
    }).catch(function(){ statusEl.textContent='Status unavailable.'; });
  }
  window.qboConnect=function(){
    fetch('/api/qbo-connect',{headers:qhdr()}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.ok&&j.url){ window.location=j.url; } else { mcToast(j&&j.note?j.note:'Could not start QuickBooks connection.','error'); }
    }).catch(function(){ mcToast('Could not reach the server.','error'); });
  };
  window.qboDisconnect=function(){
    mcConfirm({title:'Disconnect QuickBooks',message:'Stop syncing to QuickBooks and remove the stored connection?',confirmLabel:'Disconnect'}).then(function(ok){
      if(!ok) return;
      fetch('/api/qbo-disconnect',{method:'POST',headers:qhdr()}).then(function(r){return r.json();}).then(function(){ mcToast('QuickBooks disconnected.','info'); loadQbo(); }).catch(function(){ mcToast('Could not reach the server.','error'); });
    });
  };
  window.qboSyncAll=function(){
    mcToast('Syncing to QuickBooks...','info');
    fetch('/api/qbo-sync',{method:'POST',headers:qhdr(),body:JSON.stringify({op:'sync_all'})}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.ok) mcToast('Synced '+(j.synced||0)+' of '+(j.total||0)+' draws to QuickBooks.','success');
      else mcToast(j&&j.error?('Sync: '+j.error):'Sync failed.', 'error');
      loadData();
    }).catch(function(){ mcToast('Could not reach the server.','error'); });
  };
  window.qboSyncDraw=function(id){
    fetch('/api/qbo-sync',{method:'POST',headers:qhdr(),body:JSON.stringify({op:'sync_draw',payment_id:id})}).then(function(r){return r.json();}).then(function(j){
      mcToast(j&&j.ok?'Draw synced to QuickBooks.':(j&&j.error?('Sync: '+j.error):'Sync failed.'), j&&j.ok?'success':'error'); loadData();
    }).catch(function(){ mcToast('Could not reach the server.','error'); });
  };
  function qboAcctMsg(j){ return (j&&j.error==='needs_account_config')?'Set CDB_QBO_BANK_ACCOUNT_ID and CDB_QBO_EXPENSE_ACCOUNT_ID to sync vendor expenses.':(j&&j.error?('Sync: '+j.error):'Sync failed.'); }
  window.qboSyncVendor=function(id){
    fetch('/api/qbo-sync',{method:'POST',headers:qhdr(),body:JSON.stringify({op:'sync_vendor_assignment',assignment_id:id})}).then(function(r){return r.json();}).then(function(j){
      mcToast(j&&j.ok?'Vendor expense synced to QuickBooks.':qboAcctMsg(j), j&&j.ok?'success':'error'); loadVendorsAdmin();
    }).catch(function(){ mcToast('Could not reach the server.','error'); });
  };
  window.qboSyncVendorsAll=function(){
    if(!window.__qboConnected){ mcToast('Connect QuickBooks first (Dashboard).','info'); return; }
    mcToast('Syncing vendor expenses to QuickBooks...','info');
    fetch('/api/qbo-sync',{method:'POST',headers:qhdr(),body:JSON.stringify({op:'sync_vendors_all'})}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.ok) mcToast('Synced '+(j.synced||0)+' of '+(j.total||0)+' vendor expenses.','success'); else mcToast(qboAcctMsg(j),'error');
      loadVendorsAdmin();
    }).catch(function(){ mcToast('Could not reach the server.','error'); });
  };
  window.showActivity=function(){
    document.querySelectorAll('.sb-nav a').forEach(function(x){x.classList.remove('active');});
    var nav=document.querySelector('.sb-nav a[data-view="activity"]'); if(nav) nav.classList.add('active');
    document.querySelectorAll('.view').forEach(function(x){x.classList.remove('active');});
    document.getElementById('view-activity').classList.add('active');
    document.getElementById('view-title').textContent='Activity';
  };

  // ── Vendors (separate endpoint + demo) ────────────────────────
  var VENDOR_DEMO={
    vendors:[
      {id:'v1',name:'Apex Gunite Co.',company:'Apex Gunite Co.',trade:'Gunite',email:'ops@apexgunite.com',status:'active'},
      {id:'v2',name:'Carolina Tile & Stone',company:'Carolina Tile & Stone',trade:'Tile & Coping',email:'hello@cltile.com',status:'active'},
      {id:'v3',name:'Queen City Electrical',company:'Queen City Electrical',trade:'Electrical',email:'dispatch@qcelectric.com',status:'active'}
    ],
    assignments:[
      {id:'a1',project:'Myers Park Vanishing Edge',vendor:'Apex Gunite Co.',stage:'Shotcrete',amount:54000,status:'in_progress',due:'2026-06-18',pay_status:'unpaid',lien:false},
      {id:'a2',project:'Weddington Estate Pool',vendor:'Carolina Tile & Stone',stage:'Tile & Coping',amount:28000,status:'assigned',due:'2026-07-02',pay_status:'unpaid',lien:false}
    ],
    jobs:[
      {id:'j1',project:'Lake Norman Infinity Spa',title:'Gunite shell + raised spa',trade:'Gunite',budget:62000,status:'open'},
      {id:'j2',project:'Ballantyne Outdoor Living',title:'Plunge pool shell',trade:'Gunite',budget:24000,status:'open'}
    ],
    bids:[
      {id:'b1',job_id:'j1',vendor:'Apex Gunite Co.',vendor_id:'v1',amount:59500,status:'submitted'},
      {id:'b2',job_id:'j1',vendor:'Premier Pools Gunite',vendor_id:'v9',amount:61000,status:'submitted'},
      {id:'b3',job_id:'j2',vendor:'Apex Gunite Co.',vendor_id:'v1',amount:23200,status:'submitted'}
    ]
  };
  var VDATA=VENDOR_DEMO;
  function loadVendorsAdmin(){
    fetch('/api/admin-vendor',{headers:{'x-cdb-admin':sessionStorage.getItem('cdb_admin')||''}})
      .then(function(r){ return r.ok?r.json():Promise.reject(); })
      .then(function(d){ if(d&&d.vendors&&d.vendors.length){ VDATA=d; } renderVendorsAdmin(); renderFinancials(); renderNeedsAttention(); })
      .catch(function(){ renderVendorsAdmin(); renderFinancials(); renderNeedsAttention(); });
  }
  function renderVendorsAdmin(){
    var V=VDATA;
    var pendingN=(V.vendors||[]).filter(function(v){return v.status==='pending';}).length;
    kpiCards('ven-kpis',[['Vendors',(V.vendors||[]).length,'In network'],['Pending',pendingN,'Applications'],['Open Jobs',(V.jobs||[]).filter(function(j){return j.status==='open';}).length,'Out for bid'],['Bids',(V.bids||[]).length,'Received']]);
    var vt=document.getElementById('vendors-table'); if(vt) vt.innerHTML='<table><thead><tr><th>Vendor</th><th>Trade</th><th>Email</th><th>Status</th><th></th></tr></thead><tbody>'+(V.vendors||[]).map(function(v){
      var st=v.status==='active'?'qualified':(v.status==='pending'?'consult':'lost');
      var act=v.status==='pending'?('<button class="kcount" style="cursor:pointer;border:none;background:var(--green);" onclick="approveVendor(\''+v.id+'\')">Approve</button> <button class="kcount" style="cursor:pointer;border:none;" onclick="declineVendor(\''+v.id+'\')">Decline</button>'):'';
      var co=v.company?(' <span style="color:var(--muted);font-size:0.8rem;">'+v.company+'</span>'):'';
      return '<tr><td><strong>'+v.name+'</strong>'+co+'</td><td>'+(v.trade||'')+'</td><td>'+(v.email||'')+'</td><td>'+statusPill(st)+' '+(v.status||'')+'</td><td>'+act+'</td></tr>'; }).join('')+'</tbody></table>';
    var at=document.getElementById('assign-table'); if(at) at.innerHTML='<table><thead><tr><th>Project</th><th>Vendor</th><th>Stage</th><th>Amount</th><th>Status</th><th>Lien</th><th>Payment</th><th></th></tr></thead><tbody>'+(V.assignments||[]).map(function(a){
      var lien=a.lien?'<span class="pill converted">Signed</span>':'<span style="color:var(--muted);">-</span>';
      var pay=a.pay_status==='paid'?'<span class="pill converted">Paid</span>':'<span class="pill contacted">Unpaid</span>';
      var payAct=(a.pay_status!=='paid')?'<button class="kcount" style="cursor:pointer;border:none;background:var(--green);" onclick="markVendorPaid(\''+a.id+'\','+(a.amount||0)+')">Mark paid</button>':'';
      var qbAct=(window.__qboConnected && a.pay_status==='paid')?' <button class="kcount" style="cursor:pointer;border:1px solid var(--line);background:#fff;" onclick="qboSyncVendor(\''+a.id+'\')">Sync to QB</button>':'';
      return '<tr><td>'+a.project+'</td><td>'+a.vendor+'</td><td>'+a.stage+'</td><td class="mono">'+money(a.amount)+'</td><td>'+statusPill(a.status==='complete'?'converted':(a.status==='in_progress'?'consult':'contacted'))+' '+String(a.status).replace('_',' ')+'</td><td>'+lien+'</td><td>'+pay+'</td><td>'+payAct+qbAct+'</td></tr>'; }).join('')+'</tbody></table>';
    // build schedule (assignments sorted by due date)
    var sched=(V.assignments||[]).filter(function(a){return a.due;}).sort(function(x,y){return (x.due||'')<(y.due||'')?-1:1;});
    var stt=document.getElementById('schedule-table');
    if(stt) stt.innerHTML = sched.length ? '<table><thead><tr><th>Due</th><th>Stage</th><th>Project</th><th>Vendor</th><th>Status</th><th>Reschedule</th></tr></thead><tbody>'+sched.map(function(a){ return '<tr><td><strong>'+a.due+'</strong></td><td>'+a.stage+'</td><td>'+a.project+'</td><td>'+a.vendor+'</td><td>'+statusPill(a.status==='complete'?'converted':(a.status==='in_progress'?'consult':'contacted'))+'</td><td><button class="kcount" style="cursor:pointer;border:none;" onclick="setAssignmentDue(\''+a.id+'\')">Set date</button></td></tr>'; }).join('')+'</tbody></table>' : '<p class="empty">No scheduled assignments yet.</p>';
    var jt=document.getElementById('jobs-table'); if(jt) jt.innerHTML='<table><thead><tr><th>Job</th><th>Project</th><th>Trade</th><th>Budget</th><th>Status</th></tr></thead><tbody>'+(V.jobs||[]).map(function(j){ return '<tr><td><strong>'+j.title+'</strong></td><td>'+j.project+'</td><td>'+(j.trade||'')+'</td><td class="mono">'+money(j.budget)+'</td><td>'+statusPill(j.status==='awarded'?'converted':'new')+' '+j.status+'</td></tr>'; }).join('')+'</tbody></table>';
    var bt=document.getElementById('bids-table'); if(bt) bt.innerHTML='<table><thead><tr><th>Job</th><th>Vendor</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>'+(V.bids||[]).map(function(b){ var job=(V.jobs||[]).find(function(x){return x.id===b.job_id;}); var jn=job?job.title:b.job_id; var award=b.status==='awarded'?'<span class="pill converted">Awarded</span>':'<button class="kcount" style="cursor:pointer;border:none;" onclick="awardBid(\''+b.id+'\',\''+b.job_id+'\',\''+(b.vendor_id||'')+'\')">Award</button>'; return '<tr><td>'+jn+'</td><td>'+b.vendor+'</td><td class="mono">'+money(b.amount)+'</td><td>'+b.status+'</td><td>'+award+'</td></tr>'; }).join('')+'</tbody></table>';
  }
  function vendorPost(body){ fetch('/api/admin-vendor',{method:'POST',headers:{'Content-Type':'application/json','x-cdb-admin':sessionStorage.getItem('cdb_admin')||''},body:JSON.stringify(body)}).then(function(r){return r.json();}).then(function(){ loadVendorsAdmin(); }).catch(function(){}); }
  window.approveVendor=function(id){ var v=(VDATA.vendors||[]).find(function(x){return x.id===id;}); if(v){ v.status='active'; renderVendorsAdmin(); } vendorPost({op:'set_vendor_status',vendor_id:id,status:'active'}); mcToast('Vendor approved.','success'); };
  window.declineVendor=function(id){ mcConfirm({title:'Decline application',message:'Archive this vendor application?',confirmLabel:'Decline'}).then(function(ok){ if(!ok) return; var v=(VDATA.vendors||[]).find(function(x){return x.id===id;}); if(v){ v.status='archived'; renderVendorsAdmin(); } vendorPost({op:'set_vendor_status',vendor_id:id,status:'archived'}); mcToast('Application archived.','info'); }); };

  // ── Partner applications ──────────────────────────────────────
  var PARTNER_DEMO=[
    {id:'demo-1',name:'Laura Bennett',firm:'Dickens Mitchener & Associates',type:'real_estate',email:'laura@example.com',phone:'(704) 555-0142',territory:'Myers Park, Eastover',message:'Two listings now where the backyard is the soft spot.',status:'new',created:'2026-05-30'},
    {id:'demo-2',name:'Ramon Vega',firm:'Bonterra Builders',type:'builder',email:'ramon@example.com',phone:'(704) 555-0188',territory:'South Charlotte, Lake Norman',message:'Interested in pool-spec-at-framing on two spring builds.',status:'contacted',created:'2026-05-27'},
    {id:'demo-3',name:'The Peninsula Club',firm:'The Peninsula Club',type:'club',email:'events@example.com',phone:'',territory:'Cornelius / Lake Norman',message:'Member introduced. Exploring a fall member-guest sponsorship.',status:'active',created:'2026-05-20'}
  ];
  var PARTNERS=PARTNER_DEMO;
  function partnerTypeLabel(t){ return ({real_estate:'Real Estate',builder:'Home Builder',designer:'Designer',club:'Club',brand:'Luxury Brand',other:'Other'})[t]||'Other'; }
  function loadPartners(){
    fetch('/api/admin-partners',{headers:{'x-cdb-admin':sessionStorage.getItem('cdb_admin')||''}})
      .then(function(r){ return r.ok?r.json():Promise.reject(); })
      .then(function(d){ if(d&&d.items&&d.items.length){ PARTNERS=d.items; } renderPartners(); renderNeedsAttention(); })
      .catch(function(){ renderPartners(); });
  }
  function renderPartners(){
    var el=document.getElementById('partners-table'); if(!el) return;
    var P=PARTNERS||[];
    kpiCards('partner-kpis',[['Partners',P.length,'Applications'],['New',P.filter(function(x){return x.status==='new';}).length,'Awaiting review'],['Active',P.filter(function(x){return x.status==='active';}).length,'Live partners']]);
    var cnt=document.getElementById('partner-count'); if(cnt) cnt.textContent=P.length+' total';
    el.innerHTML='<table><thead><tr><th>Name</th><th>Firm</th><th>Type</th><th>Contact</th><th>Territory</th><th>Status</th><th></th></tr></thead><tbody>'+P.map(function(p){
      var st=p.status==='active'?'converted':(p.status==='contacted'?'consult':(p.status==='declined'?'lost':'new'));
      var acts='';
      if(p.status!=='active') acts+='<button class="kcount" style="cursor:pointer;border:none;background:var(--green);" onclick="partnerStatus(\''+p.id+'\',\'active\')">Activate</button> ';
      if(p.status==='new') acts+='<button class="kcount" style="cursor:pointer;border:none;" onclick="partnerStatus(\''+p.id+'\',\'contacted\')">Contacted</button> ';
      if(p.status!=='declined') acts+='<button class="kcount" style="cursor:pointer;border:none;" onclick="partnerStatus(\''+p.id+'\',\'declined\')">Decline</button>';
      var contact=(p.email||'')+(p.phone?('<br><span style="color:var(--muted);font-size:0.8rem;">'+p.phone+'</span>'):'');
      return '<tr><td><strong>'+p.name+'</strong></td><td>'+(p.firm||'')+'</td><td>'+partnerTypeLabel(p.type)+'</td><td>'+contact+'</td><td>'+(p.territory||'')+'</td><td>'+statusPill(st)+' '+(p.status||'')+'</td><td>'+acts+'</td></tr>';
    }).join('')+'</tbody></table>';
  }
  window.partnerStatus=function(id,status){
    var p=(PARTNERS||[]).find(function(x){return x.id===id;}); if(p){ p.status=status; renderPartners(); }
    fetch('/api/admin-partners',{method:'POST',headers:{'Content-Type':'application/json','x-cdb-admin':sessionStorage.getItem('cdb_admin')||''},body:JSON.stringify({op:'set_status',id:id,status:status})})
      .then(function(r){return r.json();}).then(function(j){ mcToast(j&&j.ok?'Partner updated.':'Saved locally (demo).', j&&j.ok?'success':'info'); }).catch(function(){ mcToast('Could not reach the server.','error'); });
  };

  // ── 3D rendering requests ─────────────────────────────────────
  var RENDER_DEMO=[
    {id:'demo-r1',name:'Laura Bennett',firm:'Dickens Mitchener',email:'laura@example.com',phone:'(704) 555-0142',address:'1024 Hempstead Pl, Myers Park',notes:'Buyer wants a vanishing edge. Yard slopes to a creek.',photos:[],status:'new',created:'2026-05-31'},
    {id:'demo-r2',name:'Marcus Reed',firm:'Premier Sotheby\'s',email:'marcus@example.com',phone:'',address:'The Point, Mooresville (LKN waterfront)',notes:'Lakefront, wants infinity edge toward the water.',photos:[],status:'in_progress',created:'2026-05-28'}
  ];
  var RENDERINGS=RENDER_DEMO;
  function loadRenderings(){
    fetch('/api/admin-renderings',{headers:{'x-cdb-admin':sessionStorage.getItem('cdb_admin')||''}})
      .then(function(r){ return r.ok?r.json():Promise.reject(); })
      .then(function(d){ if(d&&d.items&&d.items.length){ RENDERINGS=d.items; } renderRenderings(); renderNeedsAttention(); })
      .catch(function(){ renderRenderings(); });
  }
  function renderRenderings(){
    var el=document.getElementById('renderings-table'); if(!el) return;
    var R=RENDERINGS||[];
    var cnt=document.getElementById('rendering-count'); if(cnt) cnt.textContent=R.length+' total, '+R.filter(function(x){return x.status==='new';}).length+' new';
    el.innerHTML='<table><thead><tr><th>Agent</th><th>Listing</th><th>Photos</th><th>Status</th><th></th></tr></thead><tbody>'+R.map(function(r){
      var st=r.status==='delivered'?'converted':(r.status==='in_progress'?'consult':(r.status==='declined'?'lost':'new'));
      var photos=(r.photos&&r.photos.length)?r.photos.map(function(u,i){return '<a href="'+u+'" target="_blank" rel="noopener" style="color:var(--gold-dark);">#'+(i+1)+'</a>';}).join(' '):'<span style="color:var(--muted);">none</span>';
      var acts='';
      if(r.status==='new') acts+='<button class="kcount" style="cursor:pointer;border:none;" onclick="renderingStatus(\''+r.id+'\',\'in_progress\')">Start</button> ';
      if(r.status!=='delivered') acts+='<button class="kcount" style="cursor:pointer;border:none;background:var(--green);" onclick="renderingStatus(\''+r.id+'\',\'delivered\')">Delivered</button> ';
      if(r.status!=='declined') acts+='<button class="kcount" style="cursor:pointer;border:none;" onclick="renderingStatus(\''+r.id+'\',\'declined\')">Decline</button>';
      var who='<strong>'+r.name+'</strong>'+(r.firm?(' <span style="color:var(--muted);font-size:0.8rem;">'+r.firm+'</span>'):'')+'<br><span style="color:var(--muted);font-size:0.8rem;">'+(r.email||'')+'</span>';
      return '<tr><td>'+who+'</td><td>'+(r.address||'')+(r.notes?('<br><span style="color:var(--muted);font-size:0.8rem;">'+r.notes+'</span>'):'')+'</td><td>'+photos+'</td><td>'+statusPill(st)+' '+(r.status||'')+'</td><td>'+acts+'</td></tr>';
    }).join('')+'</tbody></table>';
  }
  window.renderingStatus=function(id,status){
    var r=(RENDERINGS||[]).find(function(x){return x.id===id;}); if(r){ r.status=status; renderRenderings(); }
    fetch('/api/admin-renderings',{method:'POST',headers:{'Content-Type':'application/json','x-cdb-admin':sessionStorage.getItem('cdb_admin')||''},body:JSON.stringify({op:'set_status',id:id,status:status})})
      .then(function(r){return r.json();}).then(function(j){ mcToast(j&&j.ok?'Rendering updated.':'Saved locally (demo).', j&&j.ok?'success':'info'); }).catch(function(){ mcToast('Could not reach the server.','error'); });
  };
  window.adminAddVendor=function(){
    mcModalForm({title:'Add Vendor',submitLabel:'Add vendor',fields:[
      {name:'name',label:'Vendor name',required:true,placeholder:'Apex Gunite Co.'},
      {name:'trade',label:'Trade',placeholder:'Gunite, Tile, Electrical, Plumbing, Decking...'},
      {name:'email',label:'Email',type:'email'},
      {name:'phone',label:'Phone',type:'tel'}
    ]}).then(function(v){ if(!v) return; vendorPost({op:'add_vendor',name:v.name,trade:v.trade,email:v.email,phone:v.phone}); mcToast('Vendor added.','success'); });
  };
  window.adminPostJob=function(){
    mcModalForm({title:'Post a Job for Bid',submitLabel:'Post job',fields:[
      {name:'title',label:'Job title',required:true,placeholder:'Gunite shell + raised spa'},
      {name:'trade',label:'Trade',placeholder:'Gunite'},
      {name:'stage',label:'Stage',placeholder:'shotcrete'},
      {name:'budget',label:'Budget (USD)',type:'number',placeholder:'62000'},
      {name:'scope',label:'Scope',type:'textarea'}
    ]}).then(function(v){ if(!v) return; vendorPost({op:'post_job',title:v.title,trade:v.trade,stage:v.stage,budget:v.budget?+v.budget:null,scope:v.scope}); mcToast('Job posted for bidding.','success'); });
  };
  window.awardBid=function(bid,job,vendor){
    mcConfirm({title:'Award this bid?',message:'This assigns the job to the winning vendor and declines the other bids.',confirmLabel:'Award'})
      .then(function(ok){ if(!ok) return; vendorPost({op:'award_bid',bid_id:bid,job_id:job,vendor_id:vendor}); mcToast('Bid awarded and assignment created.','success'); });
  };
  window.markVendorPaid=function(id,amount){
    mcConfirm({title:'Mark as paid?',message:'Record this vendor assignment as paid.',confirmLabel:'Mark paid'})
      .then(function(ok){ if(!ok) return; var a=(VDATA.assignments||[]).find(function(x){return x.id===id;}); if(a){ a.pay_status='paid'; renderVendorsAdmin(); } vendorPost({op:'set_vendor_paid',assignment_id:id,amount:amount}); mcToast('Vendor marked paid.','success'); });
  };
  window.setAssignmentDue=function(id){
    mcModalForm({title:'Set Due Date',submitLabel:'Set date',fields:[{name:'due',label:'Due date',type:'date',required:true}]})
      .then(function(v){ if(!v) return; var a=(VDATA.assignments||[]).find(function(x){return x.id===id;}); if(a){ a.due=v.due; renderVendorsAdmin(); } vendorPost({op:'set_due',assignment_id:id,due_date:v.due}); mcToast('Due date set.','success'); });
  };

  function renderReferrals(){
    var refs=DATA.referrals||[];
    var pending=refs.filter(function(r){return r.status==='pending'||r.status==='consult';}).length;
    var conv=refs.filter(function(r){return r.status==='converted'||r.status==='rewarded';}).length;
    kpiCards('ref-kpis',[['Total Referrals',refs.length,'All time'],['In Progress',pending,'Pending or consult'],['Converted',conv,'Became clients']]);
    var cnt=document.getElementById('ref-count'); if(cnt) cnt.textContent=refs.length+' referrals';
    var rows=refs.map(function(r){
      var st=r.status==='converted'||r.status==='rewarded'?'converted':(r.status==='consult'?'consult':'new');
      var reward=r.reward==='issued'?'<span class="pill converted">Reward issued</span>':(r.reward==='pending'?'<span class="pill contacted">Reward due</span>':'<span style="color:var(--muted);font-size:0.8rem;">-</span>');
      var acts='';
      if(r.id){
        if(r.status!=='consult'&&r.status!=='converted'&&r.status!=='rewarded') acts+='<button class="kcount" style="cursor:pointer;border:none;" onclick="referralStatus(\''+r.id+'\',\'consult\')">Consult</button> ';
        if(r.status!=='converted'&&r.status!=='rewarded') acts+='<button class="kcount" style="cursor:pointer;border:none;background:var(--green);" onclick="referralStatus(\''+r.id+'\',\'converted\')">Converted</button> ';
        if(r.reward!=='issued') acts+='<button class="kcount" style="cursor:pointer;border:none;" onclick="referralReward(\''+r.id+'\',\'issued\')">Reward sent</button>';
      }
      return '<tr><td><strong>'+r.referred+'</strong><br><span style="color:var(--muted);font-size:0.8rem;">'+(r.email||'')+'</span></td><td>'+r.referrer+'</td><td class="mono">'+r.code+'</td><td>'+statusPill(st)+' '+(r.status||'')+'</td><td>'+reward+'</td><td>'+r.when+'</td><td>'+acts+'</td></tr>';
    }).join('');
    var t=document.getElementById('referrals-table'); if(t) t.innerHTML='<table><thead><tr><th>Referred Lead</th><th>Referred By</th><th>Code</th><th>Status</th><th>Reward</th><th>When</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="7" class="empty">No referrals yet.</td></tr>')+'</tbody></table>';
  }
  function referralPost(body){
    var r=(DATA.referrals||[]).find(function(x){return x.id===body.id;});
    if(r){ if(body.op==='set_status'){ r.status=body.status; if(body.status==='converted') r.reward='pending'; } if(body.op==='set_reward') r.reward=body.reward; renderReferrals(); }
    fetch('/api/admin-referral',{method:'POST',headers:{'Content-Type':'application/json','x-cdb-admin':sessionStorage.getItem('cdb_admin')||''},body:JSON.stringify(body)})
      .then(function(rr){return rr.json();}).then(function(j){ mcToast(j&&j.ok?'Referral updated.':'Saved locally (demo).', j&&j.ok?'success':'info'); }).catch(function(){ mcToast('Could not reach the server.','error'); });
  }
  window.referralStatus=function(id,status){ referralPost({op:'set_status',id:id,status:status}); };
  window.referralReward=function(id,reward){ referralPost({op:'set_reward',id:id,reward:reward}); };

  function renderPayments(){
    var pays=(DATA.payments||[]).slice().sort(function(a,b){ var pc=(a.project||'').localeCompare(b.project||''); if(pc) return pc; return (a.draw_no||0)-(b.draw_no||0); });
    var scheduled=pays.filter(function(p){return p.status==='scheduled';}).length;
    var due=pays.filter(function(p){return p.status==='due';}).length;
    var reported=pays.filter(function(p){return p.status==='reported';}).length;
    var received=pays.filter(function(p){return p.status==='received'||p.status==='cleared';}).length;
    var billed=pays.filter(function(p){return p.status!=='scheduled'&&p.status!=='void';}).reduce(function(a,p){return a+(+p.amount||0);},0);
    var collected=pays.filter(function(p){return p.status==='received'||p.status==='cleared';}).reduce(function(a,p){return a+(+p.amount||0);},0);
    kpiCards('pay-kpis',[['Scheduled',scheduled,'Not yet billed'],['Due / Reported',due+reported,'Awaiting payment'],['Collected',money(collected),'Received or cleared'],['Billed',money(billed),'Issued to date']]);
    var cnt=document.getElementById('pay-count'); if(cnt) cnt.textContent=pays.length+' draws';
    var rows=pays.map(function(p){
      var st=(p.status==='received'||p.status==='cleared')?'converted':(p.status==='reported'?'consult':(p.status==='due'?'contacted':'new'));
      var act='';
      if(p.id){
        if(p.status==='scheduled') act='<button class="kcount" style="cursor:pointer;border:none;background:var(--gold);color:#fff;" onclick="issueDraw(\''+p.id+'\')">Issue / bill</button> <button class="kcount" style="cursor:pointer;border:none;" onclick="editDraw(\''+p.id+'\','+(+p.amount||0)+',\''+String(p.draw||'').replace(/[\\\\\x27"]/g,'')+'\')">Edit</button>';
        else if(p.status==='due') act='<button class="kcount" style="cursor:pointer;border:none;" onclick="confirmPayment(\''+p.id+'\',\'received\')">Confirm received</button> <button class="kcount" style="cursor:pointer;border:none;" onclick="editDraw(\''+p.id+'\','+(+p.amount||0)+',\''+String(p.draw||'').replace(/[\\\\\x27"]/g,'')+'\')">Edit</button>';
        else if(p.status==='reported') act='<button class="kcount" style="cursor:pointer;border:none;background:var(--green);" onclick="confirmPayment(\''+p.id+'\',\'received\')">Confirm received</button>';
        else if(p.status==='received') act='<button class="kcount" style="cursor:pointer;border:none;background:var(--green);" onclick="confirmPayment(\''+p.id+'\',\'cleared\')">Mark cleared</button>';
        else act='<span style="color:var(--muted);font-size:0.78rem;">Done</span>';
        if(window.__qboConnected && p.status!=='scheduled' && p.status!=='void') act+=' <button class="kcount" style="cursor:pointer;border:1px solid var(--line);background:#fff;" onclick="qboSyncDraw(\''+p.id+'\')">Sync to QB</button>';
      }
      return '<tr><td><strong>'+(p.client||'')+'</strong></td><td>'+(p.project||'')+'</td><td>'+(p.draw_no?('#'+p.draw_no+' '):'')+p.draw+'</td><td class="mono">'+money(p.amount)+'</td><td>'+methodPill(p.method)+'</td><td>'+statusPill(st)+' '+(p.status||'')+'</td><td>'+(p.ref||'')+'</td><td>'+act+'</td></tr>';
    }).join('');
    var t=document.getElementById('payments-table'); if(t) t.innerHTML='<table><thead><tr><th>Client</th><th>Project</th><th>Draw</th><th>Amount</th><th>Method</th><th>Status</th><th>Reference</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="8" class="empty">No draws yet. Use Set up billing to create a schedule.</td></tr>')+'</tbody></table>';
  }
  function payPost(body,msg){
    fetch('/api/admin-payment',{method:'POST',headers:{'Content-Type':'application/json','x-cdb-admin':sessionStorage.getItem('cdb_admin')||''},body:JSON.stringify(body)})
      .then(function(r){return r.json();}).then(function(j){ if(msg) mcToast(j&&j.ok?msg:(j&&j.error?('Could not: '+j.error):'Saved (demo).'), j&&j.ok?'success':'info'); loadData(); }).catch(function(){ mcToast('Could not reach the server.','error'); });
  }
  window.issueDraw=function(id){
    mcModalForm({title:'Issue draw',sub:'Bills the homeowner. They will see it in the Owner Suite and can report a check or ACH payment.',submitLabel:'Issue draw',fields:[
      {name:'due_at',label:'Due date (optional)',type:'date'}
    ]}).then(function(v){ if(!v) return; payPost({op:'issue_draw',payment_id:id,due_at:v.due_at||null},'Draw issued.'); });
  };
  window.editDraw=function(id,amount,label){
    mcModalForm({title:'Edit draw',submitLabel:'Save',fields:[
      {name:'draw_label',label:'Label',value:label||''},
      {name:'amount',label:'Amount (USD)',type:'number',value:amount||0}
    ]}).then(function(v){ if(!v) return; payPost({op:'update_draw',payment_id:id,draw_label:v.draw_label,amount:v.amount?+v.amount:null},'Draw updated.'); });
  };
  window.setupBilling=function(){
    var projOpts=(DATA.projects||[]).map(function(p){return {value:p.id,label:p.name+(p.value?(' ('+money(p.value)+')'):'')};});
    if(!projOpts.length){ mcToast('No projects yet. Bills are auto-created when a client signs on.','info'); return; }
    mcModalForm({title:'Set up billing',sub:'Creates the standard draw schedule (15/20/25/20/20) from the project contract value. Draws start as scheduled, then you issue each one to bill it.',submitLabel:'Create schedule',fields:[
      {name:'project_id',label:'Project',type:'select',options:projOpts}
    ]}).then(function(v){ if(!v||!v.project_id) return; payPost({op:'create_schedule',project_id:v.project_id},'Billing schedule created.'); });
  };
  window.confirmPayment=function(id,status){
    var p=(DATA.payments||[]).find(function(x){return x.id===id;}); if(p){ p.status=status; renderPayments(); }
    fetch('/api/admin-payment',{method:'POST',headers:{'Content-Type':'application/json','x-cdb-admin':sessionStorage.getItem('cdb_admin')||''},body:JSON.stringify({op:'set_status',payment_id:id,status:status})}).catch(function(){});
    mcToast(status==='received'?'Payment marked received.':'Payment marked cleared.','success');
  };

  function renderKpis(){
    var k=DATA.kpis;
    document.getElementById('kpis').innerHTML=[
      ['Pipeline Value', money(k.pipeline_value), 'Across active projects'],
      ['Active Projects', k.active_projects, 'In the 14-stage build'],
      ['New Leads', k.new_leads, 'This week'],
      ['Consults Booked', k.consults_week, 'This week']
    ].map(function(x){ return '<div class="kpi"><div class="label">'+x[0]+'</div><div class="val">'+x[1]+'</div><div class="delta up">'+x[2]+'</div></div>'; }).join('');
  }

  function renderKanban(elId, mini){
    var el=document.getElementById(elId); if(!el) return;
    var byStage={}; STAGES.forEach(function(s){byStage[s.key]=[];});
    DATA.projects.forEach(function(p){ (byStage[p.stage]||(byStage[p.stage]=[])).push(p); });
    el.innerHTML=STAGES.map(function(s,i){
      var cards=(byStage[s.key]||[]).map(function(p){
        return '<div class="kcard" draggable="true" data-id="'+p.id+'">'+
          '<div class="ktitle">'+p.name+'</div>'+
          '<div class="kval">'+money(p.value)+'</div>'+
          '<div class="kmeta"><span>'+p.client+'</span><span>'+(p.neighborhood||'')+'</span></div>'+
        '</div>';
      }).join('');
      return '<div class="kcol" data-stage="'+s.key+'">'+
        '<div class="kcol-head"><span class="kname">'+s.name+'</span><span class="kcount">'+(byStage[s.key]||[]).length+'</span></div>'+
        '<div class="kcol-stage">Stage '+String(i+1).padStart(2,'0')+'</div>'+
        cards+
      '</div>';
    }).join('');
    if(!mini) wireDrag(el);
  }

  // ── Drag to advance stage ─────────────────────────────────────
  function wireDrag(root){
    var dragId=null;
    root.querySelectorAll('.kcard').forEach(function(card){
      card.addEventListener('dragstart',function(){ dragId=card.dataset.id; card.classList.add('dragging'); });
      card.addEventListener('dragend',function(){ card.classList.remove('dragging'); });
    });
    root.querySelectorAll('.kcol').forEach(function(col){
      col.addEventListener('dragover',function(e){ e.preventDefault(); col.classList.add('drop-target'); });
      col.addEventListener('dragleave',function(){ col.classList.remove('drop-target'); });
      col.addEventListener('drop',function(e){
        e.preventDefault(); col.classList.remove('drop-target');
        var newStage=col.dataset.stage;
        var p=DATA.projects.find(function(x){return x.id===dragId;});
        if(p && p.stage!==newStage){
          var from=p.stage; p.stage=newStage;
          renderKanban('full-kanban',false); renderKanban('mini-kanban',true);
          // Persist if live
          if(DATA.live){ fetch('/api/admin-data',{method:'POST',headers:{'Content-Type':'application/json','x-cdb-admin':sessionStorage.getItem('cdb_admin')||''},body:JSON.stringify({op:'advance_stage',project_id:p.id,from:from,to:newStage})}).catch(function(){}); }
        }
      });
    });
  }

  function statusPill(s){
    var map={ new:'new', contacted:'contacted', qualified:'qualified', consult:'consult', consult_booked:'consult', converted:'converted', lost:'lost' };
    var label={ new:'New', contacted:'Contacted', qualified:'Qualified', consult:'Consult Booked', consult_booked:'Consult Booked', converted:'Converted', lost:'Lost' };
    return '<span class="pill '+(map[s]||'new')+'">'+(label[s]||s)+'</span>';
  }
  function respCell(r){ var fast=/^[0-3]\s*min/.test(r); return '<span class="'+(fast?'resp-fast':'resp-slow')+'">'+r+'</span>'; }

  function renderDashLeads(){
    var rows=DATA.leads.slice(0,5).map(function(l){
      return '<tr><td><strong>'+l.name+'</strong></td><td>'+l.neighborhood+'</td><td>'+l.project+'</td><td>'+l.budget+'</td><td>'+l.source+'</td><td>'+respCell(l.resp)+'</td><td>'+statusPill(l.status)+'</td></tr>';
    }).join('');
    document.getElementById('dash-leads').innerHTML='<table><thead><tr><th>Name</th><th>Area</th><th>Project</th><th>Budget</th><th>Source</th><th>Response</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table>';
  }
  function renderLeads(){
    document.getElementById('leads-count').textContent=DATA.leads.length+' leads';
    var rows=DATA.leads.map(function(l){
      return '<tr><td><strong>'+l.name+'</strong></td><td>'+l.neighborhood+'</td><td>'+l.project+'</td><td>'+l.budget+'</td><td>'+l.source+'</td><td>'+respCell(l.resp)+'</td><td>'+l.created+'</td><td>'+statusPill(l.status)+'</td></tr>';
    }).join('');
    document.getElementById('leads-table').innerHTML='<table><thead><tr><th>Name</th><th>Area</th><th>Project</th><th>Budget</th><th>Source</th><th>1st Response</th><th>Received</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table>';
  }
  function renderClients(){
    document.getElementById('clients-count').textContent=DATA.clients.length+' clients';
    var rows=DATA.clients.map(function(c){
      return '<tr><td><strong>'+c.name+'</strong></td><td>'+c.neighborhood+'</td><td>'+c.projects+'</td><td>'+money(c.value)+'</td><td>'+statusPill(c.status==='complete'?'converted':'qualified')+(c.status==='complete'?' Complete':' Active')+'</td></tr>';
    }).join('');
    document.getElementById('clients-table').innerHTML='<table><thead><tr><th>Client</th><th>Neighborhood</th><th>Projects</th><th>Total Value</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table>';
  }
  function renderAnalytics(){
    var maxS=Math.max.apply(null,DATA.sources.map(function(x){return x[1];}));
    document.getElementById('source-bars').innerHTML=DATA.sources.map(function(x){
      return '<div class="bar-row"><div class="bar-label">'+x[0]+'</div><div class="bar-track"><div class="bar-fill" style="width:'+(x[1]/maxS*100)+'%">'+x[1]+'%</div></div></div>';
    }).join('');
    document.getElementById('funnel').innerHTML=DATA.funnel.map(function(f){
      return '<div class="funnel-step"><span class="fname">'+f[0]+'</span><span><span class="fval">'+f[1]+'</span> <span class="fpct">'+f[2]+'</span></span></div>';
    }).join('');
    var maxP=Math.max.apply(null,DATA.pages.map(function(x){return x[1];}));
    document.getElementById('page-bars').innerHTML=DATA.pages.map(function(x){
      return '<div class="bar-row"><div class="bar-label" style="width:240px;">'+x[0]+'</div><div class="bar-track"><div class="bar-fill" style="width:'+(x[1]/maxP*100)+'%">'+x[1]+'</div></div></div>';
    }).join('');
  }
  document.getElementById('source-bars') && (function(){ var b=document.querySelector('#page-bars'); })();

  function renderPipeSummary(){
    var total=DATA.projects.reduce(function(a,p){return a+p.value;},0);
    var el=document.getElementById('pipe-summary'); if(el) el.textContent=DATA.projects.length+' projects · '+money(total);
  }

  // Modal niceties: close on backdrop click + Escape.
  (function(){
    var m=document.getElementById('mc-modal');
    if(m) m.addEventListener('click',function(e){ if(e.target.id==='mc-modal'){ var c=document.getElementById('mc-cancel'); if(c) c.click(); } });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ var mm=document.getElementById('mc-modal'); if(mm&&mm.classList.contains('on')){ var c=document.getElementById('mc-cancel'); if(c) c.click(); } } });
  })();

  // ── Boot: auto-login if session exists ────────────────────────
  var existing=sessionStorage.getItem('cdb_admin');
  if(existing){ enter(sessionStorage.getItem('cdb_admin_email')||''); }
  // patch render to also set pipe summary
  var _render=render; render=function(){ _render(); renderPipeSummary(); };
})();
