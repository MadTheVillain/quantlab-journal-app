/* CSV import — Topstep/Tradovate/NinjaTrader + smart generic mapping. */
const CSVImport = (function () {
  // $ per index point per contract for common futures (used only if P/L missing)
  const POINT = { MNQ:2, NQ:20, MES:5, ES:50, MYM:0.5, YM:5, M2K:5, RTY:50, MGC:10, GC:100, MCL:100, CL:1000 };
  function pointValue(sym){ if(!sym) return null; const s=String(sym).toUpperCase().replace(/[^A-Z]/g,''); for(const k of Object.keys(POINT)){ if(s.startsWith(k)) return POINT[k]; } return null; }
  const num = (v)=>{ if(v==null) return null; const n=parseFloat(String(v).replace(/[$,()]/g,'').replace(/[^0-9.\-]/g,'')); return isNaN(n)?null:(String(v).includes('(')?-Math.abs(n):n); };
  function toISO(v){ if(!v) return null; const d=new Date(String(v).replace(/\s+/,'T').replace(/(\d)\s(AM|PM)/i,'$1 $2')); if(!isNaN(d.getTime())) return d.toISOString(); const m=String(v).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); if(m){ return new Date(+m[1],+m[2]-1,+m[3]).toISOString(); } const m2=String(v).match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/); if(m2){ let y=+m2[3]; if(y<100)y+=2000; return new Date(y,+m2[1]-1,+m2[2]).toISOString(); } return null; }

  // fuzzy header pick
  function pick(headers, ...cands){
    const low = headers.map(h=>h.toLowerCase().trim());
    for(const c of cands){ const i=low.findIndex(h=>h===c); if(i>=0) return headers[i]; }
    for(const c of cands){ const i=low.findIndex(h=>h.includes(c)); if(i>=0) return headers[i]; }
    return null;
  }

  function parse(text){
    const res = Papa.parse(text.trim(), { header:true, skipEmptyLines:true });
    const rows = res.data.filter(r=>Object.values(r).some(v=>String(v).trim()!==''));
    if(!rows.length) return { trades:[], format:'empty', count:0 };
    const headers = res.meta.fields || Object.keys(rows[0]);
    const H = headers.join('|').toLowerCase();

    let format = 'generic';
    if(H.includes('boughttimestamp')||H.includes('soldtimestamp')||(H.includes('buyprice')&&H.includes('sellprice'))) format='tradovate';
    else if(H.includes('entry price')&&H.includes('exit price')&&H.includes('instrument')) format='ninjatrader';
    else if(H.includes('pnl')||H.includes('p/l')||H.includes('profit')) format='generic';

    const cSym   = pick(headers,'symbol','instrument','contract','ticker','market');
    const cSide  = pick(headers,'b/s','side','direction','buy/sell','action','type','position');
    const cQty   = pick(headers,'qty','quantity','size','contracts','shares');
    const cEntry = pick(headers,'buyprice','entry price','entryprice','entry','avg entry','open price','fill price','price');
    const cExit  = pick(headers,'sellprice','exit price','exitprice','exit','avg exit','close price');
    const cStop  = pick(headers,'stop','stop price','stop loss','sl');
    const cTgt   = pick(headers,'target','take profit','tp','limit');
    const cPnl   = pick(headers,'pnl','p/l','realized p/l','profit','net p/l','gross p/l','net pnl');
    const cIn    = pick(headers,'boughttimestamp','entry time','open time','entry date','date/time','datetime','date','time','filled');
    const cOut   = pick(headers,'soldtimestamp','exit time','close time','exit date');
    const cSetup = pick(headers,'setup','strategy','tag','playbook');
    const cNotes = pick(headers,'notes','comment','description');

    const trades = [];
    for(const r of rows){
      const sym = cSym ? String(r[cSym]).trim() : '';
      let entry = cEntry ? num(r[cEntry]) : null;
      let exit  = cExit  ? num(r[cExit])  : null;
      // tradovate buyPrice/sellPrice: direction from which timestamp is earlier
      let direction = null;
      if(cSide && r[cSide]){ const s=String(r[cSide]).toLowerCase(); if(/sell|short|s\b/.test(s)) direction='short'; else if(/buy|long|b\b/.test(s)) direction='long'; }
      let inT = cIn?toISO(r[cIn]):null, outT = cOut?toISO(r[cOut]):null;
      if(format==='tradovate' && !direction && inT && outT){ direction = new Date(inT) <= new Date(outT) ? 'long' : 'short'; }
      // for tradovate, entry = the earlier-time price
      let pnl = cPnl ? num(r[cPnl]) : null;
      const qty = cQty ? (num(r[cQty])||1) : 1;
      // compute pnl if missing
      if(pnl==null && entry!=null && exit!=null){ const pv=pointValue(sym); const dir = direction==='short'?-1:1; const pts=(exit-entry)*dir; pnl = pv!=null ? pts*pv*qty : pts*qty; }
      if(pnl==null && entry==null && exit==null) continue; // nothing usable
      const stop = cStop?num(r[cStop]):null, target=cTgt?num(r[cTgt]):null;
      let R=null; if(stop!=null && entry!=null){ const risk=Math.abs(entry-stop); if(risk>0){ const dir=direction==='short'?-1:1; R = exit!=null ? ((exit-entry)*dir)/risk : (pnl>0?1:-1); } }
      const date = (inT||outT||new Date().toISOString());
      const outcome = pnl>0?'win':(pnl<0?'loss':'be');
      trades.push({
        symbol: sym||'—', direction: direction||(pnl>=0?'long':'long'),
        entry, exit, stop, target, contracts: qty, pnl: Math.round(pnl*100)/100,
        r: R!=null?Math.round(R*100)/100:null, outcome,
        date, entry_ts: inT, exit_ts: outT,
        setup: cSetup?String(r[cSetup]).trim():'', notes: cNotes?String(r[cNotes]).trim():'',
        source:'import', imported:format
      });
    }
    return { trades, format, count: trades.length };
  }

  return { parse, pointValue };
})();
