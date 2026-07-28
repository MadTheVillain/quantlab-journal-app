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
  return { equity, radar, rdist, recap, destroyAll:()=>Object.keys(inst).forEach(destroy) };
})();
