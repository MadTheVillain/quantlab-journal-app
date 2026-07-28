/* Top-10 futures prop firm catalog — account types + rules (researched 2026-07).
   Powers the Prop Firm rule tracker. Drawdown types: trailing / end-of-day-trailing /
   intraday-trailing / static. dailyLossLimit null = firm has none. */
const FIRMS = (function () {
  const RAW = [
    {id:"topstep",name:"Topstep",domain:"topstep.com",accounts:[
      {label:"50K",size:50000,profitTarget:3000,drawdownType:"end-of-day-trailing",maxDrawdown:2000,dailyLossLimit:1000,minTradingDays:0,consistencyRule:"Best day < 50% of total profit",price:49},
      {label:"100K",size:100000,profitTarget:6000,drawdownType:"end-of-day-trailing",maxDrawdown:3000,dailyLossLimit:2000,minTradingDays:0,consistencyRule:"Best day < 50% of total profit",price:99},
      {label:"150K",size:150000,profitTarget:9000,drawdownType:"end-of-day-trailing",maxDrawdown:4500,dailyLossLimit:3000,minTradingDays:0,consistencyRule:"Best day < 50% of total profit",price:149}],
      notes:"One-step Trading Combine, monthly until passed. $149 activation to funded. Daily loss limit locks (not fail). Trailing updates on EOD balance."},
    {id:"apex",name:"Apex Trader Funding",domain:"apextraderfunding.com",accounts:[
      {label:"25K",size:25000,profitTarget:1500,drawdownType:"intraday-trailing",maxDrawdown:1500,dailyLossLimit:null,minTradingDays:1,consistencyRule:"30% best-day rule on funded payout only",price:147},
      {label:"50K",size:50000,profitTarget:3000,drawdownType:"intraday-trailing",maxDrawdown:2500,dailyLossLimit:null,minTradingDays:1,consistencyRule:"30% best-day rule on funded payout only",price:167},
      {label:"100K",size:100000,profitTarget:6000,drawdownType:"intraday-trailing",maxDrawdown:3000,dailyLossLimit:null,minTradingDays:1,consistencyRule:"30% best-day rule on funded payout only",price:207},
      {label:"150K",size:150000,profitTarget:9000,drawdownType:"intraday-trailing",maxDrawdown:5000,dailyLossLimit:null,minTradingDays:1,consistencyRule:"none in eval",price:297}],
      notes:"One-step eval. Intraday trailing drawdown (trails equity high incl. unrealized), no daily loss limit. Frequent 80-90% off promos; prices approximate."},
    {id:"myfundedfutures",name:"MyFundedFutures",domain:"myfundedfutures.com",accounts:[
      {label:"50K",size:50000,profitTarget:3000,drawdownType:"end-of-day-trailing",maxDrawdown:2000,dailyLossLimit:null,minTradingDays:2,consistencyRule:"50% max single-day profit (Pro)",price:227},
      {label:"100K",size:100000,profitTarget:6000,drawdownType:"end-of-day-trailing",maxDrawdown:3000,dailyLossLimit:null,minTradingDays:2,consistencyRule:"50% max single-day profit (Pro)",price:344},
      {label:"150K",size:150000,profitTarget:9000,drawdownType:"end-of-day-trailing",maxDrawdown:4500,dailyLossLimit:null,minTradingDays:2,consistencyRule:"50% max single-day profit (Pro)",price:477}],
      notes:"One-step evals (Rapid/Pro/Builder/Flex). Shown = Pro (EOD-trailing, no daily loss limit, 80/20). No activation fee; frequent ~50% promos."},
    {id:"takeprofittrader",name:"Take Profit Trader",domain:"takeprofittrader.com",accounts:[
      {label:"25K",size:25000,profitTarget:1500,drawdownType:"end-of-day-trailing",maxDrawdown:1500,dailyLossLimit:null,minTradingDays:5,consistencyRule:"No single day >= 50% of net profit",price:150},
      {label:"50K",size:50000,profitTarget:3000,drawdownType:"end-of-day-trailing",maxDrawdown:2000,dailyLossLimit:null,minTradingDays:5,consistencyRule:"No single day >= 50% of net profit",price:170},
      {label:"100K",size:100000,profitTarget:6000,drawdownType:"end-of-day-trailing",maxDrawdown:3000,dailyLossLimit:null,minTradingDays:5,consistencyRule:"No single day >= 50% of net profit",price:330},
      {label:"150K",size:150000,profitTarget:9000,drawdownType:"end-of-day-trailing",maxDrawdown:4500,dailyLossLimit:null,minTradingDays:5,consistencyRule:"No single day >= 50% of net profit",price:360}],
      notes:"One-step 'Test' eval, EOD-trailing, no daily loss limit (removed 2025), 5 min days. $130 activation to funded. Prices approximate."},
    {id:"tradeday",name:"TradeDay",domain:"tradeday.com",accounts:[
      {label:"50K",size:50000,profitTarget:3000,drawdownType:"trailing",maxDrawdown:2000,dailyLossLimit:null,minTradingDays:5,consistencyRule:"<=30% of target/day (Quick Pay); removed when funded",price:99},
      {label:"100K",size:100000,profitTarget:6000,drawdownType:"trailing",maxDrawdown:3000,dailyLossLimit:null,minTradingDays:5,consistencyRule:"<=30% of target/day (Quick Pay)",price:149},
      {label:"150K",size:150000,profitTarget:9000,drawdownType:"trailing",maxDrawdown:4500,dailyLossLimit:null,minTradingDays:5,consistencyRule:"<=30% of target/day (Quick Pay)",price:225}],
      notes:"One-step eval, trailing max drawdown, NO daily loss limit, no activation fees. Prices are list; frequent discounts."},
    {id:"tradeify",name:"Tradeify",domain:"tradeify.co",accounts:[
      {label:"Growth 50K",size:50000,profitTarget:3000,drawdownType:"end-of-day-trailing",maxDrawdown:2000,dailyLossLimit:1250,minTradingDays:1,consistencyRule:"none in eval; 35% funded",price:139},
      {label:"Select 100K",size:100000,profitTarget:6000,drawdownType:"end-of-day-trailing",maxDrawdown:3000,dailyLossLimit:null,minTradingDays:3,consistencyRule:"40% max single-day (eval)",price:259},
      {label:"Select 150K",size:150000,profitTarget:9000,drawdownType:"end-of-day-trailing",maxDrawdown:4500,dailyLossLimit:null,minTradingDays:3,consistencyRule:"40% max single-day (eval)",price:359}],
      notes:"One-time purchase (not monthly). Growth = soft daily loss limit; Select = no eval daily limit. EOD-trailing. ~40% discount codes common."},
    {id:"bulenox",name:"Bulenox",domain:"bulenox.com",accounts:[
      {label:"25K",size:25000,profitTarget:1500,drawdownType:"trailing",maxDrawdown:1500,dailyLossLimit:null,minTradingDays:0,consistencyRule:"none in eval; 40% funded payouts",price:145},
      {label:"50K",size:50000,profitTarget:3000,drawdownType:"trailing",maxDrawdown:2500,dailyLossLimit:null,minTradingDays:0,consistencyRule:"none in eval; 40% funded payouts",price:125},
      {label:"100K",size:100000,profitTarget:6000,drawdownType:"trailing",maxDrawdown:3000,dailyLossLimit:null,minTradingDays:0,consistencyRule:"none in eval; 40% funded payouts",price:155},
      {label:"150K",size:150000,profitTarget:9000,drawdownType:"trailing",maxDrawdown:4500,dailyLossLimit:null,minTradingDays:0,consistencyRule:"none in eval",price:325}],
      notes:"One-step monthly eval. Default: real-time trailing, no daily loss limit. Activation fee at funded. Coupon-driven pricing."},
    {id:"elitetraderfunding",name:"Elite Trader Funding",domain:"elitetraderfunding.com",accounts:[
      {label:"50K Static",size:50000,profitTarget:4000,drawdownType:"static",maxDrawdown:2000,dailyLossLimit:null,minTradingDays:5,consistencyRule:"none in eval",price:449},
      {label:"50K 1-Step",size:50000,profitTarget:3000,drawdownType:"intraday-trailing",maxDrawdown:2000,dailyLossLimit:null,minTradingDays:5,consistencyRule:"none in eval",price:165},
      {label:"100K Diamond",size:100000,profitTarget:5000,drawdownType:"end-of-day-trailing",maxDrawdown:3500,dailyLossLimit:1500,minTradingDays:5,consistencyRule:"none in eval",price:365},
      {label:"150K EOD",size:150000,profitTarget:9000,drawdownType:"end-of-day-trailing",maxDrawdown:4500,dailyLossLimit:3300,minTradingDays:5,consistencyRule:"none in eval",price:605}],
      notes:"Six eval models. 1-Step & Static: no daily loss limit. Static = fixed floor (never trails). Diamond Hands allows overnight holds. Prices approximate."},
    {id:"earn2trade",name:"Earn2Trade",domain:"earn2trade.com",accounts:[
      {label:"50K",size:50000,profitTarget:3000,drawdownType:"end-of-day-trailing",maxDrawdown:2000,dailyLossLimit:1100,minTradingDays:10,consistencyRule:"30% max daily profit (eval)",price:170},
      {label:"100K",size:100000,profitTarget:6000,drawdownType:"end-of-day-trailing",maxDrawdown:3500,dailyLossLimit:2200,minTradingDays:10,consistencyRule:"30% max daily profit (eval)",price:315},
      {label:"150K",size:150000,profitTarget:9000,drawdownType:"end-of-day-trailing",maxDrawdown:4500,dailyLossLimit:3300,minTradingDays:10,consistencyRule:"30% max daily profit (eval)",price:375}],
      notes:"Gauntlet Mini: monthly, EOD-trailing, daily loss limit, 10 min days. Funded: no fees, split 50% until $2,250 then 80%. Drawdown approx on 100K/150K."},
    {id:"alphafutures",name:"Alpha Futures",domain:"alpha-futures.com",accounts:[
      {label:"25K",size:25000,profitTarget:1500,drawdownType:"end-of-day-trailing",maxDrawdown:1000,dailyLossLimit:500,minTradingDays:0,consistencyRule:"none in eval; 40% funded",price:79},
      {label:"50K",size:50000,profitTarget:3000,drawdownType:"end-of-day-trailing",maxDrawdown:2000,dailyLossLimit:1000,minTradingDays:0,consistencyRule:"none in eval; 40% funded",price:119},
      {label:"100K",size:100000,profitTarget:6000,drawdownType:"end-of-day-trailing",maxDrawdown:3000,dailyLossLimit:2000,minTradingDays:0,consistencyRule:"none in eval; 40% funded",price:239},
      {label:"150K",size:150000,profitTarget:9000,drawdownType:"end-of-day-trailing",maxDrawdown:4500,dailyLossLimit:null,minTradingDays:2,consistencyRule:"50% eval / 40% funded",price:349}],
      notes:"Domain alpha-futures.com. One-step, EOD-trailing (MLL). Zero plan (25K-100K): Daily Loss Guard = 2% start, no activation. Standard 150K: $149 activation. Prices approximate."}
  ];
  const DB = {}; RAW.forEach(f => DB[f.id] = f);
  // consistency % parsed from the rule text (for the tracker)
  function consistencyPct(acct){ const m=/(\d{2})\s*%/.exec(acct.consistencyRule||''); return m?+m[1]:null; }
  function logo(id){ return 'assets/firms/'+id+'.png'; }
  function get(id){ return DB[id]; }
  function list(){ return RAW; }
  function matchId(name){
    if(!name) return null; const n=name.toLowerCase().replace(/[^a-z]/g,'');
    for(const f of RAW){ const fn=f.name.toLowerCase().replace(/[^a-z]/g,''); if(n===f.id||n===fn||fn.includes(n)||n.includes(f.id)) return f.id; }
    return null;
  }
  // Build a tracker config from a firm+account selection
  function toConfig(firmId, acctLabel){
    const f=DB[firmId]; if(!f) return null; const a=f.accounts.find(x=>x.label===acctLabel)||f.accounts[0];
    return { firmId, firm:f.name, account:a.label, startBalance:a.size, profitTarget:a.profitTarget,
      dailyLossLimit:a.dailyLossLimit||0, maxLossLimit:a.maxDrawdown, drawdownType:a.drawdownType,
      trailing: a.drawdownType!=='static', minTradingDays:a.minTradingDays||0,
      consistencyPct: consistencyPct(a), consistencyRule:a.consistencyRule, price:a.price };
  }
  return { DB, RAW, logo, get, list, matchId, toConfig, consistencyPct };
})();
