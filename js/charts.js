/* Chart rendering: Chart.js (equity/radar/R-dist) + lightweight-charts recap. */
const Charts = (function () {
  const inst = {};
  function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function theme(){ return { ink:css('--ink'), muted:css('--muted'), line:css('--line'), green:css('--green'), red:css('--red'), purple:css('--purple'), cyan:css('--cyan'), panel:css('--panel'), soft:css('--soft') }; }
  function destroy(id){ if(inst[id]){ inst[id].destroy(); delete inst[id]; } }

  function equity(canvasId, curve){
    destroy(canvasId); const c=document.getElementById(canvasId); if(!c) return; const t=theme();
    const up = curve.length && curve[curve.length-1].eq>=0;
    const g=c.getContext('2d').createLinearGradient(0,0,0,230);
    g.addColorStop(0, (up?t.green:t.red)+'44'); g.addColorStop(1, (up?t.green:t.red)+'02');
    inst[canvasId]=new Chart(c,{type:'line',data:{labels:curve.map((_,i)=>i+1),datasets:[{data:curve.map(p=>p.eq),borderColor:up?t.green:t.red,backgroundColor:g,fill:true,tension:.25,pointRadius:0,borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:(x)=>' $'+Number(x.raw).toLocaleString()}}},
        scales:{x:{display:false},y:{ticks:{color:t.muted,callback:(v)=>'$'+(v/1000).toFixed(v%1000?1:0)+(Math.abs(v)>=1000?'k':'').replace('$0k','$0')},grid:{color:t.line}}}}});
  }
  function radar(canvasId, axes){
    destroy(canvasId); const c=document.getElementById(canvasId); if(!c) return; const t=theme();
    inst[canvasId]=new Chart(c,{type:'radar',data:{labels:Object.keys(axes),datasets:[{data:Object.values(axes),borderColor:t.purple,backgroundColor:t.purple+'33',pointBackgroundColor:t.cyan,borderWidth:2}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{r:{min:0,max:100,angleLines:{color:t.line},grid:{color:t.line},pointLabels:{color:t.muted,font:{size:11,weight:'600'}},ticks:{display:false}}}}});
  }
  function rdist(canvasId, trades){
    destroy(canvasId); const c=document.getElementById(canvasId); if(!c) return; const t=theme();
    const rs=trades.map(x=>x.r).filter(r=>r!=null);
    const buckets=['≤-2','-2..-1','-1..0','0..1','1..2','2..3','≥3']; const counts=new Array(7).fill(0);
    for(const r of rs){ let i; if(r<=-2)i=0; else if(r<-1)i=1; else if(r<0)i=2; else if(r<1)i=3; else if(r<2)i=4; else if(r<3)i=5; else i=6; counts[i]++; }
    const colors=counts.map((_,i)=>i<3?t.red:(i===3?t.muted:t.green));
    if(!rs.length){ const ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle=t.muted; ctx.font='13px Inter'; ctx.textAlign='center'; ctx.fillText('Add stops to your trades to see R distribution', c.width/2, c.height/2); return; }
    inst[canvasId]=new Chart(c,{type:'bar',data:{labels:buckets,datasets:[{data:counts,backgroundColor:colors,borderRadius:6}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:t.muted,font:{size:10}},grid:{display:false}},y:{ticks:{color:t.muted,precision:0},grid:{color:t.line}}}}});
  }

  let recapChart=null, recapRO=null;
  function recap(elId, trade){
    const host=document.getElementById(elId); if(!host) return; host.innerHTML=''; const t=theme();
    if(recapChart){ try{recapChart.remove();}catch(e){} recapChart=null; }
    const chart=LightweightCharts.createChart(host,{layout:{background:{color:'transparent'},textColor:t.muted,fontFamily:'Inter'},grid:{vertLines:{color:t.line},horzLines:{color:t.line}},rightPriceScale:{borderColor:t.line},timeScale:{borderColor:t.line,timeVisible:true,secondsVisible:false},handleScroll:false,handleScale:false});
    recapChart=chart;
    const long = trade.direction!=='short';
    let series;
    if(Array.isArray(trade.candles)&&trade.candles.length){
      series=chart.addCandlestickSeries({upColor:t.green,downColor:t.red,borderVisible:false,wickUpColor:t.green,wickDownColor:t.red});
      series.setData(trade.candles.map(c=>({time:c.time,open:c.open,high:c.high,low:c.low,close:c.close})));
    } else {
      // synthetic 2-point line entry->exit
      series=chart.addLineSeries({color:t.muted,lineWidth:2});
      const e=+trade.entry, x=(+trade.exit||+trade.entry);
      const t0=trade.entry_ts?Math.floor(new Date(trade.entry_ts).getTime()/1000):Math.floor(new Date(trade.date).getTime()/1000);
      const t1=trade.exit_ts?Math.floor(new Date(trade.exit_ts).getTime()/1000):t0+3600;
      series.setData([{time:t0,value:e},{time:(t1>t0?t1:t0+3600),value:x}]);
    }
    // position tool: price lines
    if(trade.stop!=null) series.createPriceLine({price:+trade.stop,color:t.red,lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'Stop'});
    if(trade.entry!=null) series.createPriceLine({price:+trade.entry,color:t.muted,lineWidth:1,lineStyle:0,axisLabelVisible:true,title:'Entry'});
    if(trade.target!=null) series.createPriceLine({price:+trade.target,color:t.green,lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'Target'});
    if(trade.exit!=null){ const et=trade.exit_ts?Math.floor(new Date(trade.exit_ts).getTime()/1000):Math.floor(new Date(trade.date).getTime()/1000); series.setMarkers([{time:et,position:long?'aboveBar':'belowBar',color:trade.pnl>=0?t.green:t.red,shape:long?'arrowDown':'arrowUp',text:(trade.pnl>=0?'+':'')+'$'+Math.round(trade.pnl)}]); }
    chart.timeScale().fitContent();
    if(recapRO){ recapRO.disconnect(); } recapRO=new ResizeObserver(()=>chart.applyOptions({width:host.clientWidth,height:host.clientHeight})); recapRO.observe(host);
    chart.applyOptions({width:host.clientWidth,height:host.clientHeight});
  }
  // Half-gauge split green(win)/red(loss). Fixed square buffer + responsive:false
  // so the semicircle never distorts; the wrapper CSS clips to the top half.
  function gauge(canvasId, pct){
    destroy(canvasId); const c=document.getElementById(canvasId); if(!c) return; const t=theme();
    pct=Math.max(0,Math.min(100,pct)); c.width=280; c.height=280;
    inst[canvasId]=new Chart(c,{type:'doughnut',data:{datasets:[{data:[pct,100-pct],backgroundColor:[t.green,t.red],borderWidth:0}]},
      options:{responsive:false,rotation:-90,circumference:180,cutout:'72%',animation:false,plugins:{legend:{display:false},tooltip:{enabled:false}}}});
  }
  // Full donut: a(green) vs b(red)
  function donut(canvasId, a, b){
    destroy(canvasId); const c=document.getElementById(canvasId); if(!c) return; const t=theme();
    c.width=200; c.height=200;
    inst[canvasId]=new Chart(c,{type:'doughnut',data:{datasets:[{data:[a||0,b||0],backgroundColor:[t.green,t.red],borderWidth:0}]},
      options:{responsive:false,cutout:'74%',animation:false,plugins:{legend:{display:false},tooltip:{enabled:false}}}});
  }
  // Net daily P&L bar chart (green/red)
  function dailyPnl(canvasId, dayPnls){
    destroy(canvasId); const c=document.getElementById(canvasId); if(!c) return; const t=theme();
    const rows=(dayPnls||[]).slice(-40);
    inst[canvasId]=new Chart(c,{type:'bar',data:{labels:rows.map(d=>d.date),datasets:[{data:rows.map(d=>d.pnl),backgroundColor:rows.map(d=>d.pnl>=0?t.green:t.red),borderRadius:3,barPercentage:.9,categoryPercentage:.95}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:(x)=>x[0].label,label:(x)=>' $'+Number(x.raw).toLocaleString()}}},
        scales:{x:{display:false},y:{ticks:{color:t.muted,font:{size:10},callback:(v)=>'$'+(Math.abs(v)>=1000?(v/1000)+'k':v)},grid:{color:t.line}}}}});
  }
  // ---- TradingView embed (Advanced Chart widget) ----
  function tvSymbol(sym){
    const s=(sym||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    const root=s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/,'').replace(/\d+$/,'');
    const map={ MNQ:'CME_MINI:MNQ1!', NQ:'CME_MINI:NQ1!', MES:'CME_MINI:MES1!', ES:'CME_MINI:ES1!',
      MYM:'CBOT_MINI:MYM1!', YM:'CBOT_MINI:YM1!', M2K:'CME_MINI:M2K1!', RTY:'CME_MINI:RTY1!',
      MGC:'COMEX:MGC1!', GC:'COMEX:GC1!', MCL:'NYMEX:MCL1!', CL:'NYMEX:CL1!', SI:'COMEX:SI1!',
      MBT:'CME:MBT1!', BTC:'CME:BTC1!', ETH:'CME:ETH1!' };
    return map[s]||map[root]||(sym?sym.toUpperCase():'CME_MINI:MNQ1!');
  }
  let _tvLoading=null;
  function loadTV(){
    if(window.TradingView&&window.TradingView.widget) return Promise.resolve();
    if(_tvLoading) return _tvLoading;
    _tvLoading=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://s3.tradingview.com/tv.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    return _tvLoading;
  }
  function tvEmbed(elId, trade){
    const host=document.getElementById(elId); if(!host) return; host.innerHTML='<div class="tv-loading">Loading TradingView…</div>';
    const dark=document.documentElement.getAttribute('data-theme')==='dark';
    const cid='tvw_'+Math.random().toString(36).slice(2);
    loadTV().then(()=>{
      host.innerHTML=''; const div=document.createElement('div'); div.id=cid; div.style.height='100%'; host.appendChild(div);
      new TradingView.widget({ container_id:cid, autosize:true, symbol:tvSymbol(trade&&trade.symbol),
        interval:'15', timezone:'America/New_York', theme:dark?'dark':'light', style:'1', locale:'en',
        toolbar_bg:dark?'#131922':'#ffffff', hide_side_toolbar:false, allow_symbol_change:true, withdateranges:true, details:false });
    }).catch(()=>{ host.innerHTML='<div class="empty">Couldn\'t load TradingView (offline?). Switch to Trade recap.</div>'; });
  }
  return { equity, radar, rdist, recap, gauge, donut, dailyPnl, tvEmbed, tvSymbol, destroyAll:()=>Object.keys(inst).forEach(destroy) };
})();
