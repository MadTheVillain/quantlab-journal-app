/* First-run demo data: realistic MNQ trades + playbooks + prop config. Flagged demo:true so it can be cleared. */
const Demo = (function () {
  const PB = [
    { id:'pb_set2', name:'Set-2 (the model)', color:'#7c6bff',
      desc:'Daily bias → H1 sweep → M5 CISD → entry on the close. The rule-based NQ edge.',
      rules:['Daily bias locked before 10:00','H1 C2 swept liquidity','M5 CISD confirmed','Entry on the close','Stop past the sweep','Target 2R','Under 2 losses today'] },
    { id:'pb_rev', name:'Liquidity reversal', color:'#22b8cf',
      desc:'Fade a sweep of a key level with confirmation.',
      rules:['At PDH / PDL','Sweep + rejection','Confirmation close','Risk ≤ 1%'] },
    { id:'pb_bo', name:'Breakout (WIP)', color:'#e5484d',
      desc:'Range break with retest. Still leaking — watch the insights tab.',
      rules:['Clean range','Volume confirmation','Retest entry','Stop below range'] }
  ];
  const PV = 2; // MNQ
  function mk(date, h, m, dir, entry, exit, stop, target, pb, rulesOk, notes){
    const iso=`2026-07-${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
    const d = dir==='short'?-1:1; const pnl=Math.round((exit-entry)*d*PV*2*100)/100; // 2 contracts
    const risk=Math.abs(entry-stop); const r = risk?Math.round(((exit-entry)*d)/risk*100)/100:null;
    const rulesDef=(PB.find(p=>p.id===pb)||{}).rules||[];
    const rules=rulesDef.map((text,i)=>({text, ok: rulesOk===true?true:(Array.isArray(rulesOk)?!rulesOk.includes(i):true)}));
    return { id:'demo_'+date+h+m+Math.round(entry), symbol:'MNQ', direction:dir, entry, exit, stop, target,
      contracts:2, pnl, r, outcome: pnl>0?'win':(pnl<0?'loss':'be'), date:iso, entry_ts:iso,
      exit_ts:`2026-07-${date}T${String(h).padStart(2,'0')}:${String(m+18).padStart(2,'0')}:00`,
      setup:pb, notes:notes||'', demo:true };
  }
  // Crafted so insights pop: Set-2 wins in the morning w/ rules; Breakout loses (rules broken) + afternoon leak + a revenge trade.
  const TR = [
    mk('06',10,15,'long',28450,28520,28415,28520,'pb_set2',true,'Clean daily reclaim, textbook.'),
    mk('06',13,40,'short',28610,28560,28648,28535,'pb_bo',[1,2],'Broke retest rule, chased it. Afternoon.'),
    mk('07',10,5,'short',28720,28640,28756,28640,'pb_set2',true,'H1 swept the high, CISD short.'),
    mk('08',9,50,'long',28390,28352,28430,28470,'pb_set2',true,'Stopped out but followed the plan.'),
    mk('08',10,35,'long',28360,28455,28324,28430,'pb_set2',true,'Re-entry after the sweep, +2R.'),
    mk('09',14,20,'long',28880,28835,28915,28960,'pb_bo',[0,1],'Afternoon breakout, no confirmation. Loss.'),
    mk('09',14,55,'short',28820,28870,28788,28720,'pb_bo',[0,2],'Revenge trade right after. Loss again.'),
    mk('10',10,10,'short',29010,28930,29045,28930,'pb_set2',true,'Bias short, entry on the close.'),
    mk('13',10,25,'long',28770,28845,28735,28840,'pb_rev',true,'PDL sweep + rejection, clean.'),
    mk('13',15,10,'long',28900,28864,28935,28970,'pb_bo',[1,3],'Late day breakout. Chop. Loss.'),
    mk('14',9,55,'short',28680,28600,28716,28600,'pb_set2',true,'+2R before 10:30.'),
    mk('14',13,30,'short',28540,28576,28508,28460,'pb_bo',[0,1,2],'Afternoon, broke 3 rules. Loss.'),
    mk('15',10,15,'long',28420,28492,28386,28490,'pb_set2',true,'Reclaim of swept low.'),
    mk('16',10,40,'short',28950,28872,28986,28870,'pb_set2',true,'Distribution short, 2R.'),
    mk('16',14,15,'long',29020,28980,29055,29100,'pb_bo',[0,1],'Afternoon breakout fail.'),
    mk('17',9,45,'long',28610,28588,28648,28690,'pb_rev',[3],'Sized too big, broke risk rule. Small loss.'),
    mk('20',10,5,'long',28720,28800,28684,28800,'pb_set2',true,'Perfect Set-2, +2R.'),
    mk('21',10,30,'short',28880,28806,28916,28800,'pb_set2',true,'Swept the high then dropped.'),
    mk('21',13,50,'short',28760,28792,28728,28680,'pb_bo',[0,2],'Afternoon revenge after green morning.'),
    mk('22',9,50,'long',28540,28615,28505,28610,'pb_set2',true,'Textbook, target hit.'),
    mk('23',10,20,'long',28690,28648,28728,28770,'pb_set2',true,'Stopped, clean -1R.'),
    mk('23',11,5,'long',28650,28726,28614,28720,'pb_set2',true,'Re-entered, +2R.'),
    mk('24',14,40,'short',28820,28858,28788,28730,'pb_bo',[0,1,2],'Late day, no edge. Loss.'),
    mk('27',10,15,'short',28324,28125,28362,28125,'pb_set2',true,'The live one — CISD short, +2R, +$532.')
  ];

  // assign demo trades across a few prop firms / accounts so the Firms section is alive
  TR.forEach((t,i)=>{
    if(t.setup==='pb_set2'){ if(i%4===0){ t.firm='MyFundedFutures'; t.account='MFF-50K'; } else { t.firm='Topstep'; t.account = i%3===0?'TS-100K':'TS-50K'; } }
    else if(t.setup==='pb_bo'){ t.firm='TradeDay'; t.account='TD-25K'; }
    else { t.firm='Apex'; t.account='APX-100K'; }
  });

  async function seedIfEmpty(){
    const seeded = await Store.getSetting('seeded', false);
    const trades = await Store.getTrades();
    if(seeded || trades.length) return false;
    for(const p of PB) await Store.savePlaybook({...p, demo:true});
    for(const t of TR) await Store.saveTrade(t);
    await Store.setSetting('prop', { firm:'Topstep', account:'50K Combine', startBalance:50000, profitTarget:3000, dailyLossLimit:1000, maxLossLimit:2000, trailing:true });
    await Store.setSetting('seeded', true);
    return true;
  }
  async function clearDemo(){
    const trades=await Store.getTrades(); for(const t of trades) if(t.demo) await Store.deleteTrade(t.id);
    const pbs=await Store.getPlaybooks(); for(const p of pbs) if(p.demo) await Store.deletePlaybook(p.id);
  }
  return { seedIfEmpty, clearDemo, PB };
})();
