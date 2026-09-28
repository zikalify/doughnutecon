/* Doughnut by country — GitHub Pages edition (no build, no deps).
 * Social foundation: LIVE from World Bank WDI API (latest non-null value per indicator).
 * Ecological ceiling: 4x LIVE World Bank pressures + ecological footprint (York NFA bulk,
 * refreshed yearly by scripts/update_eco.py) + material footprint (seed baseline, same refresh
 * path — the UN SDG API only publishes regional aggregates for it today). Every wedge shows
 * its year, source and boundary — nothing silently frozen.
 */
'use strict';

var SOCIAL = [
  { key:'clean-cooking', short:'Cooking', label:'Clean cooking', cat:'Energy', wb:'EG.CFT.ACCS.ZS',
    desc:'Lacking access to clean cooking fuels/tech. Shortfall = 100 − access %.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% access'; } },
  { key:'electricity', short:'Electricity', label:'Electricity', cat:'Energy', wb:'EG.ELC.ACCS.ZS',
    desc:'Lacking access to electricity. Shortfall = 100 − access %.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% access'; } },
  { key:'internet', short:'Internet', label:'Internet access', cat:'Networks', wb:'IT.NET.USER.ZS',
    desc:'Not using the internet. Shortfall = 100 − users %.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% users'; } },
  { key:'nourishment', short:'Food', label:'Nourishment', cat:'Food', wb:'SN.ITK.DEFC.ZS',
    desc:'Prevalence of undernourishment (% of population). Shortfall = value.',
    calc:function(v){ return v; }, fmt:function(v){ return v.toFixed(1)+'% undernourished'; } },
  { key:'housing', short:'Housing', label:'Housing (slums)', cat:'Housing', wb:'EN.POP.SLUM.UR.ZS',
    desc:'Urban population living in slums %. Shortfall = value.',
    calc:function(v){ return v; }, fmt:function(v){ return v.toFixed(1)+'% in slums'; } },
  { key:'literacy', short:'Literacy', label:'Literacy', cat:'Education', wb:'SE.ADT.LITR.ZS',
    desc:'Adult literacy %. Shortfall = 100 − literacy.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% literate'; } },
  { key:'women-parliament', short:'Women', label:'Women in parliament', cat:'Gender equality', wb:'SG.GEN.PARL.ZS',
    desc:'Seats held by women %. Parity target 50%. Shortfall = (50 − v)/50 × 100, floored at 0.',
    calc:function(v){ return Math.max(0, (50 - v) / 50 * 100); }, fmt:function(v){ return v.toFixed(1)+'% seats'; } },
  { key:'u5-mortality', short:'Children', label:'Child survival', cat:'Health', wb:'SH.DYN.MORT',
    desc:'Under-5 mortality per 1,000 live births. Mapped 0–100 (capped). Lower is better.',
    calc:function(v){ return Math.min(100, v); }, fmt:function(v){ return v.toFixed(1)+' per 1,000'; } },
  { key:'life-expectancy', short:'Lifespan', label:'Life expectancy', cat:'Health', wb:'SP.DYN.LE00.IN',
    desc:'Life expectancy at birth. Target 75y. Shortfall = (75 − v)/75 × 100, floored at 0.',
    calc:function(v){ return Math.max(0, (75 - v) / 75 * 100); }, fmt:function(v){ return v.toFixed(1)+' years'; } },
  { key:'peace', short:'Peace', label:'Peace (homicides)', cat:'Peace & justice', wb:'VC.IHR.PSRC.P5',
    desc:'Intentional homicides per 100k. 10/100k = 100% shortfall (capped).',
    calc:function(v){ return Math.min(100, v / 10 * 100); }, fmt:function(v){ return v.toFixed(2)+' per 100k'; } },
  { key:'water', short:'Water', label:'Drinking water', cat:'Water', wb:'SH.H2O.SMDW.ZS',
    desc:'Using safely managed drinking water %. Shortfall = 100 − value.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% access'; } },
  { key:'sanitation', short:'Sanitation', label:'Sanitation', cat:'Water', wb:'SH.STA.SMSS.ZS',
    desc:'Using safely managed sanitation %. Shortfall = 100 − value.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% access'; } }
];

var ECO_MAX = 6; // ratios capped here for drawing (tooltip notes when capped)

// boundary sources: CO2 1.6t + EF 1.7gha + MF 7.2t per O'Neill et al. 2018 ("Good Life");
// PM2.5 5ug/m3 = WHO 2021 guideline; water stress 25% = FAO stressed threshold (SDG 6.4.2);
// freshwater 1700 m3/cap = Falkenmark scarcity threshold (overshoot when BELOW it).
var ECO = [
  { key:'co2', short:'CO₂', label:'CO₂ per capita', wb:'EN.GHG.CO2.PC.CE.AR5', boundary:1.6, dir:'over',
    unit:'t CO₂e', src:'World Bank (live)',
    desc:'CO₂ excl. LULUCF per capita vs 1.6 t budget.' },
  { key:'pm25', short:'Air', label:'Air pollution', wb:'EN.ATM.PM25.MC.M3', boundary:5, dir:'over',
    unit:'µg/m³', src:'World Bank (live)',
    desc:'Mean PM2.5 exposure vs WHO guideline 5 µg/m³.' },
  { key:'water-stress', short:'Water stress', label:'Water stress', wb:'ER.H2O.FWST.ZS', boundary:25, dir:'over',
    unit:'%', src:'World Bank / SDG 6.4.2 (live)',
    desc:'Freshwater withdrawal as % of resources vs 25% stress threshold.' },
  { key:'freshwater', short:'Freshwater', label:'Freshwater per capita', wb:'ER.H2O.INTR.PC', boundary:1700, dir:'under',
    unit:'m³', src:'World Bank (live)',
    desc:'Renewable water per capita vs 1700 m³ Falkenmark threshold (overshoot = below).' },
  { key:'material', short:'Materials', label:'Material footprint', json:'mf', field:'tonnes', boundary:7.2, dir:'over',
    unit:'t', src:'Leeds-2021 seed, yearly refresh',
    desc:'Raw-material equivalents per capita vs 7.2 t budget.' },
  { key:'ecofoot', short:'Footprint', label:'Ecological footprint', json:'ef', field:'gha', boundary:1.7, dir:'over',
    unit:'gha', src:'York NFA bulk, yearly refresh',
    desc:'Consumption footprint per capita vs 1.7 gha budget.' }
];

/* Geometry: hole | social bars grow inward | green safe band | eco bars grow outward | labels.
 * Wide viewBox gives side labels room so nothing clips. */
var GEO = {
  W: 1300, H: 1080, CX: 650, CY: 540,
  SOC_IN: 180, SOC_OUT: 300,   // social bar zone
  SAFE_IN: 300, SAFE_OUT: 412, // green doughnut band
  ECO_TOP: 508,                // max outer radius (ratio >= ECO_MAX)
  SOC_LABEL_R: 240,
  ECO_LABEL_R: 512
};

var state = { countries:[], mf:{}, ef:{}, cache:{}, current:null,
              reqId:0, progDone:0, progTotal:1 };

function $(id){ return document.getElementById(id); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function arcPath(cx, cy, r0, r1, a0, a1){
  function pt(r,a){ return [cx + r*Math.cos(a), cy + r*Math.sin(a)]; }
  var p0 = pt(r1,a0), p1 = pt(r1,a1), p2 = pt(r0,a1), p3 = pt(r0,a0);
  var large = (a1 - a0) > Math.PI ? 1 : 0;
  return 'M'+p0[0].toFixed(1)+' '+p0[1].toFixed(1)+
         ' L'+p1[0].toFixed(1)+' '+p1[1].toFixed(1)+
         ' A'+r1.toFixed(1)+' '+r1.toFixed(1)+' 0 '+large+' 1 '+p2[0].toFixed(1)+' '+p2[1].toFixed(1)+
         ' L'+p3[0].toFixed(1)+' '+p3[1].toFixed(1)+
         ' A'+r0.toFixed(1)+' '+r0.toFixed(1)+' 0 '+large+' 0 '+p0[0].toFixed(1)+' '+p0[1].toFixed(1)+' Z';
}

/* Severity: soft amber -> red -> dark red. t in [0,1]. */
function severity(t){
  t = clamp(t, 0, 1);
  var stops = [[252,212,171],[251,106,74],[176,20,30]]; // light -> mid -> dark
  var x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  var c = [0,1,2].map(function(k){ return Math.round(stops[i][k] + (stops[i+1][k]-stops[i][k])*f); });
  return 'rgb('+c[0]+','+c[1]+','+c[2]+')';
}
var SAFE_GREEN = '#3d9e57', MISSING = '#cfd4d6';

function bumpProgress(){
  state.progDone++;
  var el = $('loader-text');
  if(el) el.textContent = 'Fetching live indicators… '+state.progDone+'/'+state.progTotal;
}

async function wbLatest(iso3, indicator){
  var url = 'https://api.worldbank.org/v2/country/'+iso3+'/indicator/'+indicator+'?format=json&per_page=12&mrv=12';
  try {
    var res = await fetch(url);
    if(!res.ok) return { value:null, year:null };
    var j = await res.json();
    if(!Array.isArray(j) || !j[1]) return { value:null, year:null };
    for(var i=0;i<j[1].length;i++){
      if(j[1][i].value !== null && j[1][i].value !== undefined)
        return { value:j[1][i].value, year:String(j[1][i].date) };
    }
    return { value:null, year:null };
  } catch(e){
    return { value:null, year:null };
  } finally {
    bumpProgress();
  }
}

function wbCount(){
  var n = SOCIAL.length;
  for(var i=0;i<ECO.length;i++) if(ECO[i].wb) n++;
  return n;
}

async function loadSocialLive(iso3){
  if(state.cache[iso3]) return state.cache[iso3];
  var out = await Promise.all(SOCIAL.map(async function(s){
    var r = await wbLatest(iso3, s.wb);
    if(r.value === null) return { key:s.key, value:null, year:null, shortfall:null };
    return { key:s.key, value:r.value, year:r.year, shortfall:clamp(s.calc(r.value),0,100) };
  }));
  state.cache[iso3] = out;
  return out;
}

async function loadEco(iso3){
  var out = await Promise.all(ECO.map(async function(e){
    var value = null, year = null;
    if(e.wb){
      var r = await wbLatest(iso3, e.wb);
      value = r.value; year = r.year;
    } else if(e.json === 'mf' && state.mf[iso3]){
      value = state.mf[iso3].tonnes; year = String(state.mf[iso3].year);
    } else if(e.json === 'ef' && state.ef[iso3]){
      value = state.ef[iso3].gha; year = String(state.ef[iso3].year);
    }
    if(value === null || value === undefined) return { key:e.key, value:null, year:null, ratio:null };
    var ratio = e.dir === 'over' ? value / e.boundary : e.boundary / value;
    return { key:e.key, value:value, year:year, ratio:ratio };
  }));
  return out;
}

function elNS(tag, attrs){
  var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for(var k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function haloText(parent, x, y, str, size, weight, fill, anchor){
  var t = elNS('text', { x:x, y:y, 'text-anchor':anchor || 'middle',
    'dominant-baseline':'middle', 'font-size':size, 'font-weight':weight || 'normal', fill:fill });
  t.style.paintOrder = 'stroke';
  t.style.stroke = '#fff';
  t.style.strokeWidth = '4px';
  t.style.strokeLinejoin = 'round';
  t.textContent = str;
  parent.appendChild(t);
  return t;
}

function render(social, eco, country){
  var box = $('chart-area');
  var loader = $('loader');
  box.querySelectorAll('svg').forEach(function(s){ s.remove(); });
  var G = GEO, cx = G.CX, cy = G.CY;
  var svg = elNS('svg', { viewBox:'0 0 '+G.W+' '+G.H, role:'img' });
  svg.setAttribute('aria-label', 'Doughnut chart for '+country.name);

  function ring(r, color, w, dash, label){
    var c = elNS('circle', { cx:cx, cy:cy, r:r, fill:'none', stroke:color, 'stroke-width':w });
    if(dash) c.setAttribute('stroke-dasharray', dash);
    if(label){ var tt = document.createElementNS('http://www.w3.org/2000/svg','title'); tt.textContent = label; c.appendChild(tt); }
    svg.appendChild(c);
  }

  /* safe green band */
  var band = elNS('circle', { cx:cx, cy:cy, r:(G.SAFE_IN+G.SAFE_OUT)/2, fill:'none',
    stroke:'#8fce8f', 'stroke-width':(G.SAFE_OUT-G.SAFE_IN) });
  svg.appendChild(band);
  /* subtle social scale rings: 25 / 50 / 75% shortfall */
  [25,50,75].forEach(function(p){
    ring(G.SOC_OUT - (p/100)*(G.SOC_OUT-G.SOC_IN), '#b9c4c0', 1, '2 6', p+'% shortfall');
  });
  /* eco scale rings at x2, x4 */
  [2,4].forEach(function(m){
    var r = G.SAFE_OUT + (m/ECO_MAX)*(G.ECO_TOP-G.SAFE_OUT);
    ring(r, '#9db8a8', 1.2, '5 6', '×'+m+' of boundary');
  });
  /* boundary rings with labels */
  ring(G.SAFE_IN, '#1c6b3c', 3.5, null, 'Social foundation: zero shortfall');
  ring(G.SAFE_OUT, '#1c6b3c', 3.5, null, 'Ecological ceiling: 1.0x boundary');
  haloText(svg, cx, cy-G.SAFE_IN-12, 'SOCIAL FOUNDATION', 17, '700', '#1c6b3c');
  haloText(svg, cx, cy+G.SAFE_OUT+26, 'ECOLOGICAL CEILING', 17, '700', '#1c6b3c');

  var gap = 0.022, NS = SOCIAL.length, NE = ECO.length;

  /* ---- social wedges (bars grow inward = shortfall) ---- */
  SOCIAL.forEach(function(s, i){
    var a0 = -Math.PI/2 + i*(2*Math.PI/NS) + gap/2;
    var a1 = -Math.PI/2 + (i+1)*(2*Math.PI/NS) - gap/2;
    var am = (a0+a1)/2;
    var rec = null;
    for(var k=0;k<social.length;k++) if(social[k].key===s.key) rec = social[k];
    var fill, r0, tip;
    if(!rec || rec.shortfall === null || rec.shortfall === undefined){
      fill = MISSING; r0 = G.SOC_OUT - 16;
      tip = s.label+' — no live data';
    } else if(rec.shortfall <= 0.5){
      fill = SAFE_GREEN; r0 = G.SOC_OUT - 7;
      tip = s.label+' — met ('+s.fmt(rec.value)+', '+rec.year+')';
    } else {
      fill = severity(rec.shortfall/100);
      r0 = G.SOC_OUT - Math.max(10, (rec.shortfall/100)*(G.SOC_OUT-G.SOC_IN));
      tip = s.label+' — shortfall '+rec.shortfall.toFixed(1)+'% ('+s.fmt(rec.value)+', '+rec.year+')';
    }
    var p = elNS('path', { d:arcPath(cx,cy,r0,G.SOC_OUT,a0,a1), fill:fill, 'class':'bar',
      stroke:'#fff', 'stroke-width':1.5, 'stroke-linejoin':'round' });
    var tt = document.createElementNS('http://www.w3.org/2000/svg','title'); tt.textContent = tip; p.appendChild(tt);
    var html = '<b>'+s.label+'</b><br>'+tip+'<br><i>'+s.desc+'</i><br>Source: World Bank '+s.wb+' (live)';
    p.addEventListener('mousemove', function(e){ showTip(e, html); });
    p.addEventListener('mouseleave', hideTip);
    p.addEventListener('click', function(e){ showTip(e, html, true); });
    svg.appendChild(p);

    /* radial label on the wedge */
    var deg = am*180/Math.PI;
    var flip = (deg > 90 && deg < 270);
    var lx = cx + G.SOC_LABEL_R*Math.cos(am), ly = cy + G.SOC_LABEL_R*Math.sin(am);
    var t = elNS('text', { x:lx.toFixed(1), y:ly.toFixed(1), 'text-anchor':'middle',
      'dominant-baseline':'middle', 'font-size':15.5, 'font-weight':'600', fill:'#123c33',
      transform:'rotate('+(deg+(flip?180:0)).toFixed(1)+' '+lx.toFixed(1)+' '+ly.toFixed(1)+')' });
    t.style.paintOrder = 'stroke';
    t.style.stroke = 'rgba(255,255,255,.85)';
    t.style.strokeWidth = '3.5px';
    t.textContent = s.short;
    var lt = document.createElementNS('http://www.w3.org/2000/svg','title'); lt.textContent = tip; t.appendChild(lt);
    svg.appendChild(t);
  });

  /* ---- eco wedges (bars grow outward = overshoot) ---- */
  ECO.forEach(function(e, i){
    var a0 = -Math.PI/2 + i*(2*Math.PI/NE) + gap/2;
    var a1 = -Math.PI/2 + (i+1)*(2*Math.PI/NE) - gap/2;
    var am = (a0+a1)/2;
    var rec = null;
    for(var k=0;k<eco.length;k++) if(eco[k].key===e.key) rec = eco[k];
    var fill, r1, tip;
    if(!rec || rec.ratio === null || rec.ratio === undefined){
      fill = MISSING; r1 = G.SAFE_OUT + 14;
      tip = e.label+' — no data';
    } else {
      var frac = clamp(rec.ratio, 0, ECO_MAX)/ECO_MAX;
      r1 = G.SAFE_OUT + Math.max(8, frac*(G.ECO_TOP-G.SAFE_OUT));
      fill = rec.ratio <= 1 ? SAFE_GREEN : severity((rec.ratio-1)/(ECO_MAX-1));
      var vtxt = (Math.abs(rec.value) < 100 ? rec.value.toFixed(2) : Math.round(rec.value))+' '+e.unit;
      tip = e.label+' — ×'+rec.ratio.toFixed(2)+' of boundary ('+vtxt+', '+rec.year+')'
        + (rec.ratio > ECO_MAX ? ' [drawn capped at ×'+ECO_MAX+']' : '');
    }
    var full = '<b>'+e.label+'</b><br>'+tip+'<br><i>'+e.desc+'</i><br>Source: '+e.src;
    var p = elNS('path', { d:arcPath(cx,cy,G.SAFE_OUT,r1,a0,a1), fill:fill, 'class':'bar',
      stroke:'#fff', 'stroke-width':1.5, 'stroke-linejoin':'round' });
    var tt = document.createElementNS('http://www.w3.org/2000/svg','title'); tt.textContent = tip; p.appendChild(tt);
    p.addEventListener('mousemove', function(ev){ showTip(ev, full); });
    p.addEventListener('mouseleave', hideTip);
    p.addEventListener('click', function(ev){ showTip(ev, full, true); });
    svg.appendChild(p);

    /* leader line + outside label */
    var tx = cx + r1*Math.cos(am), ty = cy + r1*Math.sin(am);
    var ex = cx + (G.ECO_LABEL_R-14)*Math.cos(am), ey = cy + (G.ECO_LABEL_R-14)*Math.sin(am);
    var line = elNS('line', { x1:tx.toFixed(1), y1:ty.toFixed(1), x2:ex.toFixed(1), y2:ey.toFixed(1),
      stroke:'#7a8a84', 'stroke-width':1.2 });
    svg.appendChild(line);
    var dot = elNS('circle', { cx:tx.toFixed(1), cy:ty.toFixed(1), r:3, fill:'#1c6b3c' });
    svg.appendChild(dot);
    var lx = cx + G.ECO_LABEL_R*Math.cos(am), ly = cy + G.ECO_LABEL_R*Math.sin(am);
    var t = elNS('text', { x:lx.toFixed(1), y:ly.toFixed(1), 'text-anchor':'middle',
      'dominant-baseline':'middle', 'font-size':16.5, 'font-weight':'600', fill:'#123c33' });
    t.style.paintOrder = 'stroke';
    t.style.stroke = '#fff';
    t.style.strokeWidth = '4px';
    t.textContent = e.short;
    var lt = document.createElementNS('http://www.w3.org/2000/svg','title'); lt.textContent = tip; t.appendChild(lt);
    svg.appendChild(t);
  });

  /* ---- centre summary ---- */
  var metS = social.filter(function(r){ return r.shortfall!==null && r.shortfall!==undefined && r.shortfall<=0.5; }).length;
  var metE = eco.filter(function(r){ return r.ratio!==null && r.ratio!==undefined && r.ratio<=1; }).length;
  var totS = social.filter(function(r){ return r.shortfall!==null && r.shortfall!==undefined; }).length;
  var totE = eco.filter(function(r){ return r.ratio!==null && r.ratio!==undefined; }).length;
  var lines = splitLines(country.name, 14);
  lines.forEach(function(ln, idx){
    var t = elNS('text', { x:cx, y:(cy-38+idx*34), 'text-anchor':'middle',
      'font-size': lines.length>1 ? 30 : 34, 'font-weight':'800', fill:'#1f1d1a' });
    t.textContent = ln;
    svg.appendChild(t);
  });
  haloText(svg, cx, cy+34, country.id, 17, '700', '#5a6360');
  haloText(svg, cx, cy+62, metS+'/'+totS+' foundations met', 16, '600',
    metS===totS && totS>0 ? '#1c6b3c' : '#a11a1a');
  haloText(svg, cx, cy+86, metE+'/'+totE+' ceilings respected', 16, '600',
    metE===totE && totE>0 ? '#1c6b3c' : '#a11a1a');

  box.appendChild(svg);
  if(loader) loader.hidden = true;
}

function splitLines(name, max){
  if(name.length <= max) return [name];
  var words = name.split(' '), lines = [], cur = '';
  words.forEach(function(w){
    if((cur+' '+w).trim().length > max && cur){ lines.push(cur.trim()); cur = w; }
    else cur += ' '+w;
  });
  if(cur.trim()) lines.push(cur.trim());
  return lines.slice(0,2);
}

function showTip(e, html, sticky){
  var tip = $('tooltip');
  tip.innerHTML = html; tip.hidden = false;
  var x = Math.min(window.innerWidth-320, Math.max(8, e.clientX+14));
  var y = Math.min(window.innerHeight-140, Math.max(8, e.clientY+14));
  tip.style.left = x+'px';
  tip.style.top = y+'px';
  if(sticky){ setTimeout(function(){ tip.hidden = true; }, 4000); }
}
function hideTip(){ $('tooltip').hidden = true; }

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

function renderDetail(country, social, eco){
  $('detail-title').textContent = country.name + ' (' + country.id + ')';
  function row(color, name, sub, val, pct, pctLabel){
    return '<div class="row"><span class="dot" style="background:'+color+'"></span>'+
      '<div class="rmeta"><b>'+esc(name)+'</b><small>'+esc(sub)+'</small>'+
      '<div class="rbar"><i style="width:'+Math.round(clamp(pct,0,100))+'%;background:'+color+'"></i></div></div>'+
      '<div class="rval">'+val+'<small>'+esc(pctLabel)+'</small></div></div>';
  }
  var srows = social.map(function(r){
    var s = null;
    for(var i=0;i<SOCIAL.length;i++) if(SOCIAL[i].key===r.key) s = SOCIAL[i];
    if(r.shortfall===null||r.shortfall===undefined)
      return row(MISSING, s.label, s.wb+' · no data', 'n/a', 0, '—');
    var ok = r.shortfall <= 0.5;
    return row(ok ? SAFE_GREEN : severity(r.shortfall/100), s.label,
      s.wb+' · '+r.year, esc(s.fmt(r.value)),
      ok ? 0 : r.shortfall, ok ? 'met' : r.shortfall.toFixed(0)+'% shortfall');
  }).join('');
  var erows = eco.map(function(r){
    var e = null;
    for(var i=0;i<ECO.length;i++) if(ECO[i].key===r.key) e = ECO[i];
    if(r.ratio===null||r.ratio===undefined)
      return row(MISSING, e.label, 'no data', 'n/a', 0, '—');
    var ok = r.ratio <= 1;
    var v = (Math.abs(r.value) < 100 ? r.value.toFixed(2) : Math.round(r.value))+' '+e.unit;
    return row(ok ? SAFE_GREEN : severity((r.ratio-1)/(ECO_MAX-1)), e.label,
      '÷ '+e.boundary+' '+e.unit+' · '+r.year, esc(v),
      ok ? (r.ratio*100) : 100, ok ? '×'+r.ratio.toFixed(2) : '×'+r.ratio.toFixed(2)+' over');
  }).join('');
  $('detail-body').innerHTML =
    '<details open><summary>Social foundation — live</summary>'+srows+'</details>'+
    '<details open><summary>Ecological ceiling — live + yearly bulk</summary>'+erows+'</details>';
}

async function selectCountry(id){
  var myReq = ++state.reqId;
  var country = null;
  for(var i=0;i<state.countries.length;i++) if(state.countries[i].id===id) country = state.countries[i];
  if(!country) return;
  state.current = country;
  var loader = $('loader');
  if(loader){ loader.hidden = false; }
  state.progDone = 0;
  state.progTotal = state.cache[id] ? ECO.filter(function(e){return e.wb;}).length : wbCount();
  $('status').textContent = 'Fetching live data for '+country.name+'…';
  var social = await loadSocialLive(id);
  var eco = await loadEco(id);
  if(myReq !== state.reqId) return; // user switched country mid-load
  render(social, eco, country);
  renderDetail(country, social, eco);
  var yrs = social.concat(eco).filter(function(r){ return r.year; }).map(function(r){ return +r.year; });
  var sl = social.filter(function(r){ return r.value!==null; }).length;
  var el = eco.filter(function(r){ return r.value!==null; }).length;
  $('status').textContent = country.name+': social live '+sl+'/'+SOCIAL.length+' · eco '+el+'/'+ECO.length+
    (yrs.length ? ' · data years ' + Math.min.apply(null,yrs) + '–' + Math.max.apply(null,yrs) : '');
}

async function init(){
  try {
    var c = await (await fetch('data/countries.json')).json();
    state.countries = c;
    try { state.mf = await (await fetch('data/material-footprint.json')).json(); } catch(e){ state.mf = {}; }
    try { state.ef = await (await fetch('data/ecological-footprint.json')).json(); } catch(e){ state.ef = {}; }
    var dd = $('country-dropdown');
    c.forEach(function(x){
      var o = document.createElement('option');
      o.value = x.id; o.textContent = x.name;
      dd.appendChild(o);
    });
    dd.value = 'USA';
    dd.addEventListener('change', function(){ selectCountry(dd.value); });
    await selectCountry('USA');
  } catch(e){
    $('status').textContent = 'Failed to load local data files. Serve over http(s), not file://. ' + e;
    var loader = $('loader');
    if(loader) loader.hidden = true;
  }
}
if(typeof document !== 'undefined' && document.addEventListener)
  document.addEventListener('DOMContentLoaded', init);
