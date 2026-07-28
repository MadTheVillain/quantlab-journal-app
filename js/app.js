/* Quant Lab Journal — UI controller */
(function () {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const fmt = Analytics.fmt;
  const money = (v)=> (v<0?'-':'')+'$'+Math.abs(v).toLocaleString(undefined,{maximumFractionDigits:0});

  let TRADES=[], PBS=[], PROP=null, TAB='dashboard';
  let filters={ range:'all', playbook:'all', firm:'all', search:'' , sort:{key:'date',dir:-1}};
  let calMonth=null;

  async function init(){
    await Store.init();
    const first = await Demo.seedIfEmpty();
    await reload();
    const h=location.hash.slice(1); if(['dashboard','trades','playbook','insights','propfirm'].includes(h)) TAB=h;
    bind();
    render();
    if(first) toast('Loaded with demo data — click Backup ▸ Clear demo to start fresh');
  }
  async function reload(){
    TRADES = await Store.getTrades();
    PBS = await Store.getPlaybooks();
    PROP = await Store.getSetting('prop', null);
    const sel=$('#filter-playbook'); const cur=sel.value;
    sel.innerHTML='<option value="all">All setups</option>'+PBS.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    sel.value= PBS.some(p=>p.id===cur)?cur:'all';
  }

  function pbName(id){ const p=PBS.find(x=>x.id===id); return p?p.name:(id||''); }
  function pbColor(id){ const p=PBS.find(x=>x.id===id); return p?p.color:'#8c94a0'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function filtered(){
    let T=TRADES.slice();
    const now=new Date();
    if(filters.range!=='all'){
      T=T.filter(t=>{ const d=new Date(t.date); if(isNaN(d))return true;
        if(filters.range==='7') return d>=new Date(now-6.048e8);
        if(filters.range==='30') return d>=new Date(now-2.592e9);
        if(filters.range==='ytd') return d.getFullYear()===now.getFullYear();
        if(filters.range==='month') return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
        return true; });
    }
    if(filters.playbook!=='all') T=T.filter(t=>t.setup===filters.playbook);
    if(filters.firm!=='all') T=T.filter(t=>t.firm===filters.firm);
    if(filters.search){ const q=filters.search.toLowerCase(); T=T.filter(t=>[t.symbol,pbName(t.setup),t.notes,t.direction].join(' ').toLowerCase().includes(q)); }
    return T;
  }

  // ---------- render ----------
  function render(){
    $$('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.tab===TAB));
    $$('.tab').forEach(s=>s.classList.add('hidden'));
    $('#tab-'+TAB).classList.remove('hidden');
    $('#page-title').textContent={dashboard:'Dashboard',trades:'Trade View',playbook:'Strategies',insights:'Reports',propfirm:'Prop Firm'}[TAB];
    const ap=$('#acct-pill'); if(filters.firm!=='all'){ ap.textContent='◎ '+filters.firm+' ✕'; ap.style.cursor='pointer'; ap.onclick=()=>{filters.firm='all';render();}; } else { ap.textContent='All accounts'; ap.style.cursor='default'; ap.onclick=null; }
    if(TAB==='dashboard') renderDash();
    if(TAB==='trades') renderTrades();
    if(TAB==='playbook') renderPlaybook();
    if(TAB==='insights') renderInsights();
    if(TAB==='propfirm') renderProp();
  }

  function renderDash(){
    const T=filtered(); const m=Analytics.metrics(T);
    // Net P&L
    const net=$('#d-net'); net.textContent=money(m.net); net.className='sc-val '+(m.net>0?'pos':(m.net<0?'neg':''));
    $('#d-n').textContent=m.n; $('#d-net-sub').textContent=(filters.firm||'All accounts');
    // Trade win %
    $('#d-winrate').textContent=m.winRate+'%';
    $('#d-w').textContent=m.wins; $('#d-be').textContent=m.bes; $('#d-l').textContent=m.losses;
    Charts.gauge('g-winrate', m.winRate);
    // Profit factor
    $('#d-pf').textContent=isFinite(m.profitFactor)?m.profitFactor.toFixed(2):'∞';
    Charts.donut('g-pf', m.grossWin, m.grossLoss);
    // Day win %
    const dp=m.dayPnls||[]; const dW=dp.filter(d=>d.pnl>0).length, dL=dp.filter(d=>d.pnl<0).length, dB=dp.filter(d=>d.pnl===0).length;
    const dwin=dp.length?Math.round(dW/dp.length*100):0;
    $('#d-daywin').textContent=dwin+'%'; $('#dd-w').textContent=dW; $('#dd-be').textContent=dB; $('#dd-l').textContent=dL;
    Charts.gauge('g-daywin', dwin);
    // Avg win/loss
    const aw=m.avgWin||0, al=Math.abs(m.avgLoss||0); const ratio=al?aw/al:(aw>0?aw:0);
    $('#d-wl').textContent=ratio?ratio.toFixed(2):'—';
    const winPct=(aw+al)?aw/(aw+al)*100:50;
    $('#wl-win').style.width=winPct+'%'; $('#wl-loss').style.width=(100-winPct)+'%';
    $('#d-avgwin').textContent=money(aw); $('#d-avgloss').textContent=money(-al);
    // Quant score + daily P&L
    $('#perf-score').textContent=m.score||'—';
    Charts.radar('chart-radar', m.axes);
    Charts.dailyPnl('chart-daily', dp);
    // last activity
    $('#last-import').textContent = T.length? new Date(T[T.length-1].date).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'}) : '—';
    if(!calMonth){ const last=T.length?new Date(T[T.length-1].date):new Date(); calMonth=new Date(last.getFullYear(),last.getMonth(),1); }
    renderCalendar(T);
    renderFirms(T);
  }

  function renderFirms(T){
    const card=$('#firms-card'); const withFirm=T.filter(t=>t.firm);
    if(!withFirm.length){ card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const byFirm={}; for(const t of withFirm){ (byFirm[t.firm]=byFirm[t.firm]||[]).push(t); }
    const firms=Object.entries(byFirm).map(([firm,ts])=>{
      const m=Analytics.metrics(ts);
      const accts={}; for(const t of ts){ const a=t.account||'—'; (accts[a]=accts[a]||[]).push(t); }
      const accStats=Object.entries(accts).map(([a,at])=>({a, net:at.reduce((s,x)=>s+(+x.pnl||0),0)}));
      const best=accStats.slice().sort((a,b)=>b.net-a.net)[0], worst=accStats.slice().sort((a,b)=>a.net-b.net)[0];
      return { firm, n:ts.length, net:m.net, win:m.winRate, pf:m.profitFactor, accts:accStats.length, best, worst };
    }).sort((a,b)=>b.net-a.net);
    $('#firms-sub').textContent=`${firms.length} firm${firms.length===1?'':'s'} · ${Object.keys(byFirm).length} tracked`;
    $('#firms-grid').innerHTML=firms.map(f=>`
      <div class="firm-card ${f.net<0?'neg-edge':''}">
        <div class="firm-top">${(function(){const id=FIRMS.matchId(f.firm);return id?`<img class="firm-logo-sm" src="${FIRMS.logo(id)}" alt="" onerror="this.style.display='none'">`:'';})()}<span class="firm-name">${esc(f.firm)}</span><span class="firm-accts">${f.accts} acct${f.accts===1?'':'s'}</span></div>
        <div class="firm-net ${f.net>0?'pos':(f.net<0?'neg':'')}">${money(f.net)}</div>
        <div class="firm-meta">${f.n} trades · ${f.win}% win · PF ${isFinite(f.pf)?f.pf.toFixed(2):'∞'}</div>
        ${f.accts>1?`<div class="firm-bw">best <b>${esc(f.best.a)}</b> ${money(Math.round(f.best.net))} · worst <b>${esc(f.worst.a)}</b> ${money(Math.round(f.worst.net))}</div>`:`<div class="firm-bw">account <b>${esc(f.best.a)}</b></div>`}
      </div>`).join('');
    $$('#firms-grid .firm-card').forEach((el,i)=>el.onclick=()=>{ filters.firm=firms[i].firm; TAB='trades'; render(); });
  }
  function kpi(l,v,s,cls=''){ return `<div class="kpi"><div class="k-label">${l}</div><div class="k-val ${cls}">${v}</div><div class="k-sub">${s}</div></div>`; }

  function renderCalendar(T){
    const y=calMonth.getFullYear(), mo=calMonth.getMonth();
    $('#cal-month').textContent=calMonth.toLocaleString('en',{month:'long',year:'numeric'});
    const byDay={}; for(const t of T){ const k=(t.date||'').slice(0,10); if(!k)continue; (byDay[k]=byDay[k]||[]).push(t); }
    const first=new Date(y,mo,1).getDay(), days=new Date(y,mo+1,0).getDate();
    let html='<div class="cal-weekdays">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div>${d}</div>`).join('')+'</div><div class="cal-days">';
    for(let i=0;i<first;i++) html+='<div class="cal-day empty"></div>';
    for(let d=1;d<=days;d++){ const k=`${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const ts=byDay[k];
      if(ts){ const p=ts.reduce((a,x)=>a+(+x.pnl||0),0); const cls=p>0?'win':(p<0?'loss':''); html+=`<div class="cal-day has ${cls}" data-day="${k}"><div class="d-num">${d}</div><div class="d-pnl ${p>0?'pos':(p<0?'neg':'')}">${money(Math.round(p))}</div></div>`; }
      else html+=`<div class="cal-day"><div class="d-num">${d}</div></div>`;
    }
    html+='</div>'; $('#calendar').innerHTML=html;
    $$('#calendar .cal-day.has').forEach(el=>el.onclick=()=>openDay(el.dataset.day));
  }

  function renderTrades(){
    const T=filtered().slice();
    const {key,dir}=filters.sort;
    T.sort((a,b)=>{ let x=a[key], y=b[key]; if(key==='setup'){x=pbName(a.setup);y=pbName(b.setup);} if(x==null)x=-Infinity; if(y==null)y=-Infinity; if(typeof x==='string'){return dir*x.localeCompare(y);} return dir*((x>y?1:x<y?-1:0)); });
    $('#trades-empty').classList.toggle('hidden', T.length>0);
    $('#trades-body').innerHTML=T.map(t=>{
      const dircls=t.direction==='short'?'short':'long';
      const oc=t.outcome==='win'?'win':(t.outcome==='loss'?'loss':'be');
      return `<tr data-id="${t.id}">
        <td>${(t.date||'').slice(0,10)}</td>
        <td><b>${esc(t.symbol)}</b></td>
        <td><span class="pill ${dircls}">${t.direction==='short'?'Short':'Long'}</span></td>
        <td>${t.setup?`<span class="tag-dot" style="background:${pbColor(t.setup)}"></span>${esc(pbName(t.setup))}`:'<span style="color:var(--faint)">—</span>'}</td>
        <td class="num">${t.r!=null?t.r+'R':'—'}</td>
        <td class="num ${t.pnl>0?'pos':(t.pnl<0?'neg':'')}">${money(Math.round(t.pnl))}</td>
        <td><span class="pill ${oc}">${t.outcome==='be'?'BE':t.outcome[0].toUpperCase()+t.outcome.slice(1)}</span></td>
        <td class="row-menu">›</td></tr>`;
    }).join('');
    $$('#trades-body tr').forEach(tr=>tr.onclick=()=>openRecap(TRADES.find(x=>x.id===tr.dataset.id)));
  }

  function renderPlaybook(){
    if(!PBS.length){ $('#playbook-list').innerHTML='<div class="empty">No setups yet. Create your first — e.g. your Set-2 model.</div>'; return; }
    $('#playbook-list').innerHTML=PBS.map(p=>{
      const ts=TRADES.filter(t=>t.setup===p.id); const m=Analytics.metrics(ts);
      return `<div class="pb-card"><h3><span class="tag-dot" style="background:${p.color}"></span>${esc(p.name)}</h3>
        <p class="pb-desc">${esc(p.desc||'')}</p>
        <ul class="pb-rules">${(p.rules||[]).map(r=>`<li>${esc(r)}</li>`).join('')}</ul>
        <div class="pb-stats">
          <div class="pb-stat"><div class="v">${ts.length}</div><div class="l">Trades</div></div>
          <div class="pb-stat"><div class="v ${m.winRate>=50?'pos':''}">${ts.length?m.winRate+'%':'—'}</div><div class="l">Win</div></div>
          <div class="pb-stat"><div class="v ${m.net>0?'pos':(m.net<0?'neg':'')}">${ts.length?money(m.net):'—'}</div><div class="l">Net</div></div>
        </div>
        <div class="pb-actions"><button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button><button class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button></div>
      </div>`;
    }).join('');
    $$('[data-edit]').forEach(b=>b.onclick=()=>openPlaybookForm(PBS.find(p=>p.id===b.dataset.edit)));
    $$('[data-del]').forEach(b=>b.onclick=async()=>{ if(confirm('Delete this setup? Trades keep their tag.')){ await Store.deletePlaybook(b.dataset.del); await reload(); render(); }});
  }

  function renderInsights(){
    const ins=Analytics.insights(filtered());
    $('#insights-list').innerHTML=ins.map(i=>`<div class="insight ${i.tone}">
      <div class="i-tag">${esc(i.tag)}</div><h4>${esc(i.title)}</h4>
      ${i.metric?`<div class="i-metric ${i.tone==='good'?'pos':(i.tone==='bad'?'neg':'')}">${esc(i.metric)}</div>`:''}
      <p>${esc(i.body)}</p></div>`).join('');
  }

  let _pickFirm=null;
  function renderProp(){
    const activeFirm = _pickFirm || (PROP&&PROP.firmId) || null;
    const picker = `
      <div class="card firm-picker">
        <div class="card-label">Select your prop firm</div>
        <div class="firm-logos" id="firm-logos">
          ${FIRMS.list().map(f=>`<button class="firm-logo-btn ${f.id===activeFirm?'sel':''}" data-firm="${f.id}" title="${esc(f.name)}"><img src="${FIRMS.logo(f.id)}" alt="" onerror="this.style.visibility='hidden'"><span>${esc(f.name)}</span></button>`).join('')}
        </div>
        <div class="firm-acct-row" id="firm-acct-row" ${activeFirm?'':'style="display:none"'}>
          <select id="firm-acct" class="select"></select>
          <button class="btn btn-primary" id="firm-track">Track this account</button>
        </div>
      </div>`;
    if(!PROP){ $('#prop-body').innerHTML=picker+'<div class="empty">Pick a firm and account above to start tracking your rules.</div>'; bindPicker(activeFirm); return; }
    const s=Analytics.propStatus(TRADES.filter(t=>filters.playbook==='all'||t.setup===filters.playbook), PROP);
    const dllUsed = (s.dll>0 && s.worstDay)? Math.min(Math.abs(Math.min(s.worstDay.pnl,0))/s.dll*100,100):0;
    const ddUsed = s.mll? Math.min(s.currentDD/s.mll*100,100):0;
    const pcls=(v)=>v>=100?'bad':(v>=70?'warn':'ok');
    const ddLabel={static:'Static drawdown','end-of-day-trailing':'EOD trailing drawdown','intraday-trailing':'Intraday trailing drawdown',trailing:'Trailing drawdown'}[s.drawdownType]||'Max drawdown';
    const f=FIRMS.get(PROP.firmId);
    $('#prop-body').innerHTML=picker+`
      <div class="prop-grid">
        <div class="card">
          <div class="prop-head"><img class="firm-logo-lg" src="${FIRMS.logo(PROP.firmId)}" onerror="this.style.display='none'"><div><div class="card-label">${esc(PROP.firm)} · ${esc(PROP.account)}</div><div class="card-sub">${money(PROP.startBalance)} account · ${esc(PROP.drawdownType)}</div></div></div>
          <div class="k-val" style="margin-top:12px">${money(s.currentEquity)}</div>
          <div class="card-sub">Equity · net ${s.netProfit>=0?'+':''}${money(s.netProfit)}</div>
          <div class="prop-row" style="margin-top:14px">Profit target <b>${money(s.target)}</b></div>
          <div class="bar ok"><i style="width:${s.progress}%"></i></div>
          <div class="card-sub">${s.progress}% there · ${s.daysToPass===0?'target reached 🎯':(s.daysToPass?`~${s.daysToPass} green day${s.daysToPass===1?'':'s'} to pass`:'need winning days to project')}</div>
        </div>
        <div class="card"><div class="card-label">Rule usage</div>
          ${s.dll>0
            ? `<div class="prop-row" style="margin-top:12px">Daily loss limit <b>${money(s.dll)}</b></div><div class="bar ${pcls(dllUsed)}"><i style="width:${dllUsed}%"></i></div><div class="card-sub">Worst day ${s.worstDay?money(s.worstDay.pnl):'—'} (${Math.round(dllUsed)}% of limit)</div>`
            : `<div class="prop-row" style="margin-top:12px">Daily loss limit <b>None</b></div><div class="card-sub">This account has no daily loss limit.</div>`}
          <div class="prop-row" style="margin-top:14px">${ddLabel} <b>${money(s.mll)}</b></div>
          <div class="bar ${pcls(ddUsed)}"><i style="width:${ddUsed}%"></i></div>
          <div class="card-sub">Current DD ${money(s.currentDD)} (${Math.round(ddUsed)}% of limit)</div>
        </div>
      </div>
      <div class="card">
        <div class="card-label">Rule check</div>
        <div class="rulelist" style="margin-top:12px">
          <div class="prop-row">${s.progress>=100?'✅':'○'} <b>Profit target</b> ${money(s.target)} — ${s.netProfit>=0?'+':''}${money(s.netProfit)} (${s.progress}%)</div>
          ${s.dll>0?`<div class="prop-row">${s.dllViolations.length?'⚠':'✅'} <b>Daily loss limit</b> ${money(s.dll)} — ${s.dllViolations.length?('breached '+s.dllViolations.length+' day(s): '+s.dllViolations.map(d=>d.day).join(', ')):'no breaches'}</div>`:''}
          <div class="prop-row">${s.maxDDbreach?'⚠':'✅'} <b>${ddLabel}</b> ${money(s.mll)} — ${s.maxDDbreach?'BREACHED':'within limit'}</div>
          <div class="prop-row">${s.minDaysMet?'✅':'○'} <b>Min trading days</b> — ${s.tradingDays}/${s.minDays}${s.minDays?'':' (none required)'}</div>
          ${s.cPct?`<div class="prop-row">${s.consistencyOk?'✅':'⚠'} <b>Consistency</b> (${esc(PROP.consistencyRule)}) — best day ${s.bestDayShare!=null?s.bestDayShare+'% of profit':'—'}</div>`:`<div class="prop-row">• <b>Consistency</b> — ${esc(PROP.consistencyRule||'none')}</div>`}
        </div>
        ${f?`<div class="card-sub" style="margin-top:12px;line-height:1.5">${esc(f.notes)}</div>`:''}
      </div>`;
    bindPicker(activeFirm);
  }
  function bindPicker(activeFirm){
    const acctSel=$('#firm-acct'); if(!acctSel) return;
    function fillAccts(firmId){ const f=FIRMS.get(firmId); if(!f)return;
      acctSel.innerHTML=f.accounts.map(a=>`<option value="${esc(a.label)}" ${PROP&&PROP.firmId===firmId&&PROP.account===a.label?'selected':''}>${esc(a.label)} — target ${money(a.profitTarget)} · DD ${money(a.maxDrawdown)}${a.dailyLossLimit?' · DLL '+money(a.dailyLossLimit):' · no DLL'}</option>`).join('');
      $('#firm-acct-row').style.display=''; }
    if(activeFirm) fillAccts(activeFirm);
    $$('#firm-logos .firm-logo-btn').forEach(b=>b.onclick=()=>{ _pickFirm=b.dataset.firm;
      $$('#firm-logos .firm-logo-btn').forEach(x=>x.classList.toggle('sel',x===b)); fillAccts(b.dataset.firm); });
    $('#firm-track').onclick=async()=>{ const firmId=_pickFirm||activeFirm; if(!firmId)return;
      const cfg=FIRMS.toConfig(firmId, acctSel.value); if(!cfg)return; PROP=cfg; _pickFirm=null;
      await Store.setSetting('prop',PROP); render(); toast(cfg.firm+' '+cfg.account+' tracked'); };
  }

  // ---------- modals ----------
  function openModal(html){ $('#modal-content').innerHTML=html; $('#modal').classList.remove('hidden'); $('#scrim').classList.remove('hidden'); }
  function closeModal(){ $('#modal').classList.add('hidden'); $('#scrim').classList.add('hidden'); }

  function ruleChecksHTML(pbId, existing){
    const p=PBS.find(x=>x.id===pbId); if(!p||!p.rules) return '';
    return `<div class="field full"><label>Rule adherence (${esc(p.name)})</label>`+
      p.rules.map((r,i)=>{ const on = existing? (existing[i]&&existing[i].ok):false; return `<label class="rulecheck"><input type="checkbox" data-rule="${i}" ${on?'checked':''}/> ${esc(r)}</label>`; }).join('')+`</div>`;
  }

  function openTradeForm(t){
    t=t||{}; const d=(t.date||new Date().toISOString());
    const date=d.slice(0,10), time=(t.entry_ts||d).slice(11,16);
    openModal(`<h2>${t.id?'Edit trade':'Log a trade'}</h2><p class="sub">P&L and R auto-calc from your prices. Override P&L if your broker differs.</p>
      <form id="tf">
      <div class="form-grid">
        <div class="field"><label>Date</label><input name="date" type="date" value="${date}" required></div>
        <div class="field"><label>Time (entry)</label><input name="time" type="time" value="${time}"></div>
        <div class="field"><label>Symbol</label><input name="symbol" value="${esc(t.symbol||'MNQ')}" required></div>
        <div class="field"><label>Direction</label><select name="direction"><option value="long" ${t.direction!=='short'?'selected':''}>Long</option><option value="short" ${t.direction==='short'?'selected':''}>Short</option></select></div>
        <div class="field"><label>Contracts</label><input name="contracts" type="number" step="1" value="${t.contracts||1}"></div>
        <div class="field"><label>Setup</label><select name="setup"><option value="">—</option>${PBS.map(p=>`<option value="${p.id}" ${t.setup===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Entry</label><input name="entry" type="number" step="any" value="${t.entry??''}"></div>
        <div class="field"><label>Exit</label><input name="exit" type="number" step="any" value="${t.exit??''}"></div>
        <div class="field"><label>Stop</label><input name="stop" type="number" step="any" value="${t.stop??''}"></div>
        <div class="field"><label>Target</label><input name="target" type="number" step="any" value="${t.target??''}"></div>
        <div class="field"><label>P&L (override)</label><input name="pnl" type="number" step="any" value="${t.pnl??''}" placeholder="auto"></div>
        <div class="field"><label>Session</label><input name="session" value="${esc(t.session||'')}" placeholder="auto from time"></div>
        <div class="field"><label>Prop firm</label><input name="firm" list="firm-list" value="${esc(t.firm||'')}" placeholder="e.g. Topstep"></div>
        <div class="field"><label>Account</label><input name="account" value="${esc(t.account||'')}" placeholder="e.g. TS-50K"></div>
      </div>
      <datalist id="firm-list">${[...new Set(TRADES.map(x=>x.firm).filter(Boolean))].map(f=>`<option value="${esc(f)}">`).join('')}</datalist>
      <div id="rulebox">${t.setup?ruleChecksHTML(t.setup,t.rules):''}</div>
      <div class="field full"><label>Notes</label><textarea name="notes" placeholder="What was the setup, what did you feel, what would you change?">${esc(t.notes||'')}</textarea></div>
      <div class="form-actions">${t.id?`<button type="button" class="btn btn-danger" id="tf-del">Delete</button>`:''}<button type="button" class="btn btn-ghost" id="tf-cancel">Cancel</button><button type="submit" class="btn btn-primary">Save trade</button></div>
      </form>`);
    const form=$('#tf');
    form.setup.onchange=()=>{ $('#rulebox').innerHTML=form.setup.value?ruleChecksHTML(form.setup.value):''; };
    $('#tf-cancel').onclick=closeModal;
    if($('#tf-del')) $('#tf-del').onclick=async()=>{ if(confirm('Delete this trade?')){ await Store.deleteTrade(t.id); await reload(); render(); closeModal(); toast('Trade deleted'); }};
    form.onsubmit=async(e)=>{ e.preventDefault(); const f=new FormData(form); const g=(k)=>{const v=f.get(k); return v===''?null:v;};
      const entry=num(g('entry')), exit=num(g('exit')), stop=num(g('stop')), target=num(g('target')), contracts=num(g('contracts'))||1;
      const dir=g('direction'); const sym=g('symbol')||'MNQ';
      let pnl=num(g('pnl'));
      if(pnl==null && entry!=null && exit!=null){ const pv=CSVImport.pointValue(sym); const s=dir==='short'?-1:1; const pts=(exit-entry)*s; pnl= pv!=null?pts*pv*contracts:pts*contracts; }
      pnl=pnl==null?0:Math.round(pnl*100)/100;
      let r=null; if(stop!=null&&entry!=null){ const risk=Math.abs(entry-stop); if(risk){ const s=dir==='short'?-1:1; r= exit!=null?Math.round(((exit-entry)*s)/risk*100)/100:(pnl>0?1:-1); } }
      const iso=`${g('date')}T${(g('time')||'10:00')}:00`;
      const rules = form.setup.value ? $$('#rulebox input[data-rule]').map((c,i)=>({text:(PBS.find(p=>p.id===form.setup.value).rules[i]),ok:c.checked})) : null;
      const trade={ ...t, symbol:sym, direction:dir, entry, exit, stop, target, contracts, pnl, r,
        outcome: pnl>0?'win':(pnl<0?'loss':'be'), date:iso, entry_ts:iso, setup:form.setup.value||'',
        session:g('session')||'', firm:g('firm')||'', account:g('account')||'', notes:g('notes')||'', rules };
      if(t.demo) delete trade.demo;
      await Store.saveTrade(trade); await reload(); render(); closeModal(); toast(t.id?'Trade updated':'Trade logged');
    };
  }

  function openPlaybookForm(p){
    p=p||{color:'#7c6bff'};
    openModal(`<h2>${p.id?'Edit setup':'New setup'}</h2><p class="sub">Rules are graded on every trade tagged with this setup.</p>
      <form id="pf">
      <div class="field"><label>Name</label><input name="name" value="${esc(p.name||'')}" required></div>
      <div class="field"><label>Colour</label><input name="color" type="color" value="${p.color||'#7c6bff'}" style="height:40px;padding:4px"></div>
      <div class="field full"><label>Description</label><textarea name="desc">${esc(p.desc||'')}</textarea></div>
      <div class="field full"><label>Rules (one per line)</label><textarea name="rules" style="min-height:120px">${esc((p.rules||[]).join('\n'))}</textarea></div>
      <div class="form-actions"><button type="button" class="btn btn-ghost" id="pf-cancel">Cancel</button><button type="submit" class="btn btn-primary">Save setup</button></div></form>`);
    $('#pf-cancel').onclick=closeModal;
    $('#pf').onsubmit=async(e)=>{ e.preventDefault(); const f=new FormData(e.target);
      const pb={ ...p, name:f.get('name'), color:f.get('color'), desc:f.get('desc'), rules:String(f.get('rules')).split('\n').map(s=>s.trim()).filter(Boolean) };
      if(p.demo) delete pb.demo; await Store.savePlaybook(pb); await reload(); render(); closeModal(); toast('Setup saved');
    };
  }

  function openPropForm(){
    const p=PROP||{firm:'Topstep',account:'50K Combine',startBalance:50000,profitTarget:3000,dailyLossLimit:1000,maxLossLimit:2000,trailing:true};
    openModal(`<h2>Prop account</h2><p class="sub">Presets: Topstep 50K → target $3k, DLL $1k, trailing $2k.</p>
      <form id="ppf"><div class="form-grid">
      <div class="field"><label>Firm</label><input name="firm" value="${esc(p.firm)}"></div>
      <div class="field"><label>Account</label><input name="account" value="${esc(p.account)}"></div>
      <div class="field"><label>Start balance</label><input name="startBalance" type="number" value="${p.startBalance}"></div>
      <div class="field"><label>Profit target</label><input name="profitTarget" type="number" value="${p.profitTarget}"></div>
      <div class="field"><label>Daily loss limit</label><input name="dailyLossLimit" type="number" value="${p.dailyLossLimit}"></div>
      <div class="field"><label>Max / trailing drawdown</label><input name="maxLossLimit" type="number" value="${p.maxLossLimit}"></div>
      <div class="field full"><label class="rulecheck"><input type="checkbox" name="trailing" ${p.trailing?'checked':''}> Trailing drawdown (follows peak equity)</label></div>
      </div><div class="form-actions"><button type="button" class="btn btn-ghost" id="ppf-cancel">Cancel</button><button type="submit" class="btn btn-primary">Save</button></div></form>`);
    $('#ppf-cancel').onclick=closeModal;
    $('#ppf').onsubmit=async(e)=>{ e.preventDefault(); const f=new FormData(e.target);
      PROP={ firm:f.get('firm'),account:f.get('account'),startBalance:+f.get('startBalance'),profitTarget:+f.get('profitTarget'),dailyLossLimit:+f.get('dailyLossLimit'),maxLossLimit:+f.get('maxLossLimit'),trailing:f.get('trailing')==='on' };
      await Store.setSetting('prop',PROP); render(); closeModal(); toast('Account saved');
    };
  }

  function openRecap(t){ if(!t) return;
    const long=t.direction!=='short'; const rr=(t.stop!=null&&t.target!=null&&t.entry!=null)?Math.abs(t.target-t.entry)/Math.max(Math.abs(t.entry-t.stop),1e-9):null;
    openModal(`<div class="recap-head"><div>
        <div class="card-label">${(t.date||'').slice(0,10)} · ${esc(t.symbol)} · <span class="pill ${long?'long':'short'}">${long?'Long':'Short'}</span></div>
        <div class="recap-pnl ${t.pnl>0?'pos':(t.pnl<0?'neg':'')}">${money(t.pnl)}</div></div>
        <button class="btn btn-ghost btn-sm" id="rc-edit">Edit</button></div>
      <div class="recap-chart-toggle">
        <button class="seg active" data-view="tv">TradingView</button>
        <button class="seg" data-view="draw">Trade recap</button>
        <span class="recap-sym">${Charts.tvSymbol(t.symbol)}</span>
      </div>
      <div id="recap-chart"></div>
      <div class="recap-stats">
        <div class="r-l">Entry</div><div class="r-v">${t.entry??'—'}</div>
        <div class="r-l">Exit</div><div class="r-v">${t.exit??'—'}</div>
        <div class="r-l">Stop</div><div class="r-v">${t.stop??'—'}</div>
        <div class="r-l">Target</div><div class="r-v">${t.target??'—'}</div>
        <div class="r-l">R multiple</div><div class="r-v">${t.r!=null?t.r+'R':'—'}</div>
        <div class="r-l">Planned R:R</div><div class="r-v">${rr?('1:'+rr.toFixed(1)):'—'}</div>
        <div class="r-l">Contracts</div><div class="r-v">${t.contracts||1}</div>
        <div class="r-l">Setup</div><div class="r-v">${t.setup?esc(pbName(t.setup)):'—'}</div>
      </div>
      ${Array.isArray(t.rules)&&t.rules.length?`<div class="card-label" style="margin-top:6px">Rule adherence — ${t.rules.filter(r=>r.ok).length}/${t.rules.length}</div>
        <ul class="pb-rules" style="margin-top:8px">${t.rules.map(r=>`<li style="${r.ok?'':'opacity:.5'}">${r.ok?'':'✗ '}${esc(r.text)}</li>`).join('')}</ul>`:''}
      ${t.notes?`<div class="recap-notes"><b>Notes</b><br>${esc(t.notes)}</div>`:''}`);
    $('#rc-edit').onclick=()=>{ closeModal(); openTradeForm(t); };
    setTimeout(()=>Charts.tvEmbed('recap-chart', t), 30);
    $$('.recap-chart-toggle .seg').forEach(b=>b.onclick=()=>{
      $$('.recap-chart-toggle .seg').forEach(x=>x.classList.toggle('active',x===b));
      if(b.dataset.view==='tv') Charts.tvEmbed('recap-chart', t); else Charts.recap('recap-chart', t);
    });
  }

  function openDay(dayKey){
    const ts=TRADES.filter(t=>(t.date||'').slice(0,10)===dayKey);
    const p=ts.reduce((a,x)=>a+(+x.pnl||0),0);
    openModal(`<h2>${dayKey}</h2><p class="sub">${ts.length} trade${ts.length===1?'':'s'} · <b class="${p>0?'pos':(p<0?'neg':'')}">${money(p)}</b></p>
      <table class="table"><tbody>${ts.map(t=>`<tr data-id="${t.id}"><td><span class="pill ${t.direction==='short'?'short':'long'}">${t.direction==='short'?'S':'L'}</span> ${esc(t.symbol)}</td><td>${t.setup?esc(pbName(t.setup)):'—'}</td><td class="num">${t.r!=null?t.r+'R':''}</td><td class="num ${t.pnl>0?'pos':'neg'}">${money(Math.round(t.pnl))}</td></tr>`).join('')}</tbody></table>`);
    $$('#modal tr[data-id]').forEach(tr=>tr.onclick=()=>{ closeModal(); openRecap(TRADES.find(x=>x.id===tr.dataset.id)); });
  }

  function openImport(){
    openModal(`<h2>Import trades</h2><p class="sub">Export a CSV from Topstep / Tradovate / NinjaTrader (or any broker) and drop it here. Columns are auto-detected.</p>
      <div class="field full"><button class="btn btn-primary btn-block" id="imp-pick">Choose CSV file</button></div>
      <div id="imp-result" style="margin-top:8px"></div>`);
    $('#imp-pick').onclick=()=>$('#csv-file').click();
  }

  // ---------- events ----------
  function bind(){
    $$('.nav-item').forEach(b=>b.onclick=()=>{ TAB=b.dataset.tab; try{history.replaceState(null,'','#'+TAB);}catch(e){} render(); });
    $('#filter-range').onchange=e=>{ filters.range=e.target.value; render(); };
    $('#filter-playbook').onchange=e=>{ filters.playbook=e.target.value; render(); };
    $('#trade-search').oninput=e=>{ filters.search=e.target.value; renderTrades(); };
    $$('#trades-table th[data-sort]').forEach(th=>th.onclick=()=>{ const k=th.dataset.sort; filters.sort= filters.sort.key===k?{key:k,dir:-filters.sort.dir}:{key:k,dir:-1}; renderTrades(); });
    $('#btn-add').onclick=()=>openTradeForm();
    { const sd=$('#start-day'); if(sd) sd.onclick=()=>{ TAB='insights'; render(); }; }
    $('#btn-add-playbook').onclick=()=>openPlaybookForm();
    $('#btn-edit-prop').onclick=openPropForm;
    $('#cal-prev').onclick=()=>{ calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()-1,1); renderCalendar(filtered()); };
    $('#cal-next').onclick=()=>{ calMonth=new Date(calMonth.getFullYear(),calMonth.getMonth()+1,1); renderCalendar(filtered()); };
    $('#modal-close').onclick=closeModal; $('#scrim').onclick=closeModal;
    $('#theme-toggle').onclick=async()=>{ const cur=document.documentElement.getAttribute('data-theme'); const nx=cur==='dark'?'light':'dark'; document.documentElement.setAttribute('data-theme',nx); await Store.setSetting('theme',nx); render(); };
    $('#btn-import').onclick=openImport;
    $('#csv-file').onchange=async(e)=>{ const file=e.target.files[0]; if(!file) return; const text=await file.text(); e.target.value='';
      let res; try{ res=CSVImport.parse(text); }catch(err){ toast('Could not read that CSV'); return; }
      const box=$('#imp-result');
      if(!res.count){ if(box) box.innerHTML='<div class="empty">No trades found in that file. Check it has price/P&L columns.</div>'; else toast('No trades found in CSV'); return; }
      openModal(`<h2>Import preview</h2><p class="sub">Detected <b>${res.format}</b> format · <b>${res.count}</b> trades.</p>
        <table class="table"><tbody>${res.trades.slice(0,6).map(t=>`<tr><td>${(t.date||'').slice(0,10)}</td><td>${esc(t.symbol)}</td><td>${t.direction}</td><td class="num ${t.pnl>0?'pos':'neg'}">${money(Math.round(t.pnl))}</td></tr>`).join('')}</tbody></table>
        ${res.count>6?`<p class="sub">…and ${res.count-6} more</p>`:''}
        <div class="form-actions"><button class="btn btn-ghost" id="imp-cancel">Cancel</button><button class="btn btn-primary" id="imp-go">Import ${res.count} trades</button></div>`);
      $('#imp-cancel').onclick=closeModal;
      $('#imp-go').onclick=async()=>{ for(const t of res.trades) await Store.saveTrade(t); await reload(); TAB='trades'; render(); closeModal(); toast(`Imported ${res.count} trades`); };
    };
    $('#btn-export').onclick=exportMenu;
    $('#json-file').onchange=async(e)=>{ const f=e.target.files[0]; if(!f)return; try{ const data=JSON.parse(await f.text()); e.target.value=''; if(data.trades){ for(const t of data.trades) await Store.saveTrade(t); } if(data.playbooks){ for(const p of data.playbooks) await Store.savePlaybook(p);} if(data.prop) await Store.setSetting('prop',data.prop); await reload(); render(); toast('Backup restored'); }catch(err){ toast('Invalid backup file'); } };
    // load theme
    Store.getSetting('theme','light').then(th=>document.documentElement.setAttribute('data-theme',th));
  }

  function exportMenu(){
    openModal(`<h2>Backup & data</h2><p class="sub">Everything lives in this browser only. Export a backup to keep it safe or move devices.</p>
      <div class="chips" style="flex-direction:column;align-items:stretch;gap:10px">
        <button class="btn btn-primary" id="ex-json">Download backup (.json)</button>
        <button class="btn btn-ghost" id="ex-csv">Export trades (.csv)</button>
        <button class="btn btn-ghost" id="ex-restore">Restore from backup</button>
        <button class="btn btn-danger" id="ex-cleardemo">Clear demo data</button>
      </div>`);
    $('#ex-json').onclick=async()=>{ const data={trades:await Store.getTrades(),playbooks:await Store.getPlaybooks(),prop:await Store.getSetting('prop',null),exported:new Date().toISOString()}; dl('quantlab-journal-backup.json',JSON.stringify(data,null,2),'application/json'); };
    $('#ex-csv').onclick=async()=>{ const t=await Store.getTrades(); const cols=['date','symbol','direction','contracts','entry','exit','stop','target','pnl','r','outcome','setup','notes']; const csv=[cols.join(',')].concat(t.map(x=>cols.map(c=>JSON.stringify(x[c]==null?'':x[c])).join(','))).join('\n'); dl('quantlab-trades.csv',csv,'text/csv'); };
    $('#ex-restore').onclick=()=>$('#json-file').click();
    $('#ex-cleardemo').onclick=async()=>{ await Demo.clearDemo(); await reload(); render(); closeModal(); toast('Demo data cleared'); };
  }
  function dl(name,content,type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); }

  // ---------- utils ----------
  function num(v){ if(v==null||v==='') return null; const n=parseFloat(v); return isNaN(n)?null:n; }
  let toastT;
  function toast(msg){ let el=$('.toast'); if(!el){ el=document.createElement('div'); el.className='toast'; document.body.appendChild(el);} el.textContent=msg; el.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),3200); }

  init();
})();
