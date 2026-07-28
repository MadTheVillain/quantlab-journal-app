/* Analytics: metrics, insights engine, prop-firm tracking. Pure functions over trades[]. */
const Analytics = (function () {
  const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const round = (n, d=2) => Math.round(n*10**d)/10**d;
  const sum = (a) => a.reduce((x,y)=>x+y,0);
  const mean = (a) => a.length ? sum(a)/a.length : 0;

  function dayKey(t){ return (t.date||t.entry_ts||'').slice(0,10); }
  function hourOf(t){ const s=t.entry_ts||t.date; if(!s) return null; const d=new Date(s); return isNaN(d)?null:d.getHours(); }
  function sessionOf(t){ if(t.session) return t.session; const h=hourOf(t); if(h==null) return 'Unspecified'; if(h<9) return 'Pre-market'; if(h<11) return 'Morning (9–11)'; if(h<13) return 'Midday (11–1)'; if(h<16) return 'Afternoon (1–4)'; return 'After hours'; }
  function adherence(t){ if(Array.isArray(t.rules)&&t.rules.length){ const ok=t.rules.filter(r=>r.ok).length; return ok/t.rules.length; } return null; }

  function metrics(trades){
    const T = trades.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    const n = T.length;
    const pnls = T.map(t=>+t.pnl||0);
    const wins = T.filter(t=>t.pnl>0), losses = T.filter(t=>t.pnl<0), bes = T.filter(t=>t.pnl===0);
    const gW = sum(wins.map(t=>t.pnl)), gL = sum(losses.map(t=>t.pnl));
    const net = sum(pnls);
    const pf = gL===0 ? (gW>0?Infinity:0) : gW/Math.abs(gL);
    const winRate = n? wins.length/n*100 : 0;
    const avgWin = wins.length? gW/wins.length : 0;
    const avgLoss = losses.length? gL/losses.length : 0;
    const expectancy = n ? net/n : 0;
    const rs = T.map(t=>t.r).filter(r=>r!=null);
    const avgR = rs.length? mean(rs) : null;
    // equity + drawdown
    let eq=0, peak=0, maxDD=0; const curve=[];
    for(const t of T){ eq+=(+t.pnl||0); peak=Math.max(peak,eq); maxDD=Math.max(maxDD,peak-eq); curve.push({date:t.date, eq:round(eq)}); }
    // streaks
    let cur=0, best=0, worst=0;
    for(const t of T){ if(t.pnl>0){ cur=cur>0?cur+1:1; best=Math.max(best,cur);} else if(t.pnl<0){ cur=cur<0?cur-1:-1; worst=Math.min(worst,cur);} }
    // by day
    const byDay={}; for(const t of T){ const k=dayKey(t); if(!k) continue; (byDay[k]=byDay[k]||[]).push(t); }
    const dayPnls = Object.entries(byDay).map(([k,ts])=>({day:k, pnl:round(sum(ts.map(x=>x.pnl))), n:ts.length}));
    const bestDay = dayPnls.slice().sort((a,b)=>b.pnl-a.pnl)[0];
    const worstDay = dayPnls.slice().sort((a,b)=>a.pnl-b.pnl)[0];
    // radar axes 0..100
    const wl = avgLoss!==0 ? Math.min(Math.abs(avgWin/avgLoss)/3,1)*100 : (avgWin>0?100:0);
    const consistency = dayPnls.length? dayPnls.filter(d=>d.pnl>=0).length/dayPnls.length*100 : 0;
    const recovery = maxDD>0? Math.min(net/maxDD,3)/3*100 : (net>0?100:0);
    const adhVals = T.map(adherence).filter(v=>v!=null);
    const discipline = adhVals.length? mean(adhVals)*100 : consistency;
    const axes = { 'Win %':round(winRate), 'Profit factor':round(Math.min((isFinite(pf)?pf:3)/3,1)*100), 'Win/Loss':round(wl), 'Consistency':round(consistency), 'Recovery':round(recovery), 'Discipline':round(discipline) };
    const score = Math.round(mean(Object.values(axes)));

    return { n, net:round(net), grossWin:round(gW), grossLoss:round(gL), wins:wins.length, losses:losses.length, bes:bes.length,
      winRate:round(winRate,1), profitFactor:pf, avgWin:round(avgWin), avgLoss:round(avgLoss), expectancy:round(expectancy),
      avgR:avgR!=null?round(avgR):null, maxDD:round(maxDD), curve, bestStreak:best, worstStreak:Math.abs(worst),
      dayPnls, bestDay, worstDay, axes, score };
  }

  function group(trades, keyFn){ const g={}; for(const t of trades){ const k=keyFn(t); if(k==null) continue; (g[k]=g[k]||[]).push(t);} return g; }
  function statFor(ts){ const p=ts.map(t=>+t.pnl||0); const w=ts.filter(t=>t.pnl>0).length; return { n:ts.length, pnl:round(sum(p)), win:ts.length?round(w/ts.length*100,0):0, exp:ts.length?round(sum(p)/ts.length):0 }; }

  // ---- Insights ----
  function insights(trades){
    const out=[]; const T=trades.filter(t=>t.pnl!=null);
    if(T.length<4){ return [{tone:'neutral',tag:'Getting started',title:'Log a few more trades',body:'Once you have ~10 trades, real patterns show up — best sessions, tilt after losses, and which rules actually cost you money.'}]; }
    const m=metrics(T);

    // weekday
    const wd=group(T,t=>{const d=new Date(t.date);return isNaN(d)?null:WD[d.getDay()];});
    const wdStats=Object.entries(wd).map(([k,v])=>({k,...statFor(v)})).filter(x=>x.n>=2);
    if(wdStats.length>=2){ const b=wdStats.slice().sort((a,b)=>b.pnl-a.pnl)[0], w=wdStats.slice().sort((a,b)=>a.pnl-b.pnl)[0];
      if(b.k!==w.k){ out.push({tone:'good',tag:'Best day',title:`${b.k} is your money day`,body:`${b.k}: ${b.win}% win over ${b.n} trades. Your worst is ${w.k} (${w.win}%, ${fmt(w.pnl)}). Consider sizing up ${b.k}, sitting out ${w.k}.`,metric:fmt(b.pnl)}); } }

    // session
    const ss=group(T,sessionOf);
    const ssStats=Object.entries(ss).map(([k,v])=>({k,...statFor(v)})).filter(x=>x.n>=2 && x.k!=='Unspecified');
    if(ssStats.length>=2){ const b=ssStats.slice().sort((a,b)=>b.exp-a.exp)[0], w=ssStats.slice().sort((a,b)=>a.exp-b.exp)[0];
      if(w.exp<0 && b.k!==w.k) out.push({tone:'bad',tag:'Time leak',title:`You bleed in the ${w.k.toLowerCase()}`,body:`${w.k}: ${fmt(w.pnl)} across ${w.n} trades (${w.win}% win). Your ${b.k.toLowerCase()} makes ${fmt(b.pnl)}. The fix is usually just: stop trading that window.`,metric:fmt(w.pnl)}); }

    // tilt: trades right after a loss
    const sorted=T.slice().sort((a,b)=>(a.entry_ts||a.date||'').localeCompare(b.entry_ts||b.date||''));
    const afterLoss=[]; for(let i=1;i<sorted.length;i++){ if(sorted[i-1].pnl<0) afterLoss.push(sorted[i]); }
    if(afterLoss.length>=3){ const al=statFor(afterLoss); const base=round(m.expectancy);
      if(al.exp < base-1){ out.push({tone:'bad',tag:'Tilt',title:'You revenge-trade after a loss',body:`The trade right after a loss averages ${fmt(al.exp)} vs your baseline ${fmt(base)} (${al.win}% win over ${al.n}). Rule: after a red trade, step away for one setup.`,metric:fmt(al.exp)}); }
      else { out.push({tone:'good',tag:'Composure',title:'No tilt after losses',body:`Trades after a loss still average ${fmt(al.exp)} — you stay disciplined when it hurts. Rare. Keep it.`,metric:fmt(al.exp)}); } }

    // overtrading
    const byDay=group(T,dayKey); const dayCounts=Object.values(byDay).map(v=>v.length);
    const avgPerDay=mean(dayCounts); const busy=Object.values(byDay).filter(v=>v.length>=Math.max(4,avgPerDay*1.6));
    if(busy.length>=2){ const bp=statFor(busy.flat()); const calm=statFor(Object.values(byDay).filter(v=>v.length<Math.max(4,avgPerDay*1.6)).flat());
      if(bp.exp<calm.exp){ out.push({tone:'bad',tag:'Overtrading',title:'High-volume days cost you',body:`On days you take ${Math.round(Math.max(4,avgPerDay*1.6))}+ trades you average ${fmt(bp.exp)}/trade vs ${fmt(calm.exp)} on quiet days. More clicks ≠ more money. Cap your daily trades.`,metric:fmt(bp.pnl)}); } }

    // rule adherence
    const withRules=T.filter(t=>adherence(t)!=null);
    if(withRules.length>=5){ const followed=withRules.filter(t=>adherence(t)>=1), broke=withRules.filter(t=>adherence(t)<1);
      if(followed.length>=2&&broke.length>=2){ const f=statFor(followed), b=statFor(broke);
        out.push({tone: b.exp<f.exp?'bad':'good', tag:'Rule adherence', title: b.exp<f.exp?'Breaking rules is your biggest leak':'You trade your rules well',
          body:`Trades that followed every rule: ${f.win}% win, ${fmt(f.exp)}/trade. Trades where you broke a rule: ${b.win}% win, ${fmt(b.exp)}/trade. ${b.exp<f.exp?`That gap (${fmt(f.exp-b.exp)}/trade × ${b.n} trades = ${fmt((f.exp-b.exp)*b.n)}) is money left on the table.`:'Discipline is paying off.'}`,
          metric: fmt((f.exp-b.exp))+'/trade'}); } }

    // outsized losses
    const rLosses=T.filter(t=>t.r!=null&&t.r<-1.05);
    if(rLosses.length>=1 && T.filter(t=>t.r!=null).length>=6){ const pct=round(rLosses.length/T.filter(t=>t.r!=null).length*100,0);
      out.push({tone:'bad',tag:'Risk',title:'You let losers run past your stop',body:`${pct}% of your losses went beyond -1R (${rLosses.length} trades, ${fmt(sum(rLosses.map(t=>t.pnl)))} total). A hard stop turns those into -1R and saves the account.`,metric:`${pct}%`}); }

    // cutting winners
    if(m.avgWin>0 && m.avgLoss<0){ const ratio=Math.abs(m.avgWin/m.avgLoss);
      if(ratio<1 && m.winRate>50){ out.push({tone:'bad',tag:'Exits',title:'You cut winners, hold losers',body:`Win rate is ${m.winRate}% but avg win (${fmt(m.avgWin)}) is smaller than avg loss (${fmt(m.avgLoss)}). You're right often but paid little. Let winners reach target; cut losers at stop.`,metric:`${round(ratio)}:1`}); }
      else if(ratio>=1.8){ out.push({tone:'good',tag:'Exits',title:'Great risk/reward',body:`Avg win ${fmt(m.avgWin)} vs avg loss ${fmt(m.avgLoss)} — a ${round(ratio)}:1 payoff. You can be right less than half the time and still win.`,metric:`${round(ratio)}:1`}); } }

    // headline
    out.unshift({tone: m.net>=0?'good':'bad', tag:'Bottom line', title: m.net>=0?'You are net profitable':'You are net negative — here is why',
      body:`${m.n} trades · ${m.winRate}% win · profit factor ${isFinite(m.profitFactor)?round(m.profitFactor):'∞'} · expectancy ${fmt(m.expectancy)}/trade. Max drawdown ${fmt(-m.maxDD)}.`, metric: fmt(m.net)});
    return out;
  }

  function fmt(v){ if(v==null||isNaN(v)) return '—'; const s=(v<0?'-':'+')+'$'+Math.abs(v).toLocaleString(undefined,{maximumFractionDigits:0}); return s; }

  // ---- Prop firm ----
  function propStatus(trades, cfg){
    if(!cfg) return null;
    const startBal=+cfg.startBalance||0, target=+cfg.profitTarget||0, dll=+cfg.dailyLossLimit||0, mll=+cfg.maxLossLimit||0, trailing=!!cfg.trailing;
    const m=metrics(trades);
    const day=m.dayPnls.slice().sort((a,b)=>a.day.localeCompare(b.day));
    // worst single-day loss
    const worstDay=day.slice().sort((a,b)=>a.pnl-b.pnl)[0];
    const dllViolations=day.filter(d=>dll>0 && d.pnl <= -dll);
    // trailing / max drawdown from peak equity (incl start)
    let eq=startBal, peak=startBal, curDD=0, maxDDbreach=false, minEq=startBal;
    for(const d of day){ eq+=d.pnl; peak=trailing?Math.max(peak,eq):Math.max(peak,startBal); curDD=peak-eq; minEq=Math.min(minEq,eq); if(mll>0 && curDD>=mll) maxDDbreach=true; }
    const netProfit=m.net; const progress=target>0?Math.min(netProfit/target*100,100):0;
    const winDays=day.filter(d=>d.pnl>0); const avgWinDay=winDays.length?sum(winDays.map(d=>d.pnl))/winDays.length:0;
    const remaining=Math.max(target-netProfit,0);
    const daysToPass = (avgWinDay>0 && remaining>0)? Math.ceil(remaining/avgWinDay) : (remaining<=0?0:null);
    return { m, startBal, target, dll, mll, trailing, netProfit:round(netProfit), progress:round(progress,0),
      currentDD:round(curDD), currentEquity:round(eq), worstDay, dllViolations, maxDDbreach,
      daysToPass, avgWinDay:round(avgWinDay), day };
  }

  return { metrics, insights, group, statFor, sessionOf, adherence, propStatus, fmt, WD };
})();
