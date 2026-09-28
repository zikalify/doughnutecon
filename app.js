/* Doughnut by country — GitHub Pages edition (no build, no deps).
 * Social foundation: LIVE from World Bank WDI API (latest non-null value per indicator).
 * Ecological ceiling: 4x LIVE World Bank pressures + ecological footprint (York NFA bulk,
 * refreshed yearly by scripts/update_eco.py) + material footprint (seed baseline, same refresh
 * path — the UN SDG API only publishes regional aggregates for it today). Every wedge shows
 * its year, source and boundary — nothing silently frozen.
 */
'use strict';

var SOCIAL = [
  { key:'clean-cooking', label:'Clean cooking', cat:'Energy', wb:'EG.CFT.ACCS.ZS',
    desc:'Lacking access to clean cooking fuels/tech. Shortfall = 100 − access %.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% access'; } },
  { key:'electricity', label:'Electricity', cat:'Energy', wb:'EG.ELC.ACCS.ZS',
    desc:'Lacking access to electricity. Shortfall = 100 − access %.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% access'; } },
  { key:'internet', label:'Internet access', cat:'Networks', wb:'IT.NET.USER.ZS',
    desc:'Not using the internet. Shortfall = 100 − users %.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% users'; } },
  { key:'nourishment', label:'Nourishment', cat:'Food', wb:'SN.ITK.DEFC.ZS',
    desc:'Prevalence of undernourishment (% of population). Shortfall = value.',
    calc:function(v){ return v; }, fmt:function(v){ return v.toFixed(1)+'% undernourished'; } },
  { key:'housing', label:'Housing (slums)', cat:'Housing', wb:'EN.POP.SLUM.UR.ZS',
    desc:'Urban population living in slums %. Shortfall = value.',
    calc:function(v){ return v; }, fmt:function(v){ return v.toFixed(1)+'% in slums'; } },
  { key:'literacy', label:'Literacy', cat:'Education', wb:'SE.ADT.LITR.ZS',
    desc:'Adult literacy %. Shortfall = 100 − literacy.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% literate'; } },
  { key:'women-parliament', label:'Women in parliament', cat:'Gender equality', wb:'SG.GEN.PARL.ZS',
    desc:'Seats held by women %. Parity target 50%. Shortfall = (50 − v)/50 × 100, floored at 0.',
    calc:function(v){ return Math.max(0, (50 - v) / 50 * 100); }, fmt:function(v){ return v.toFixed(1)+'% seats'; } },
  { key:'u5-mortality', label:'Child survival', cat:'Health', wb:'SH.DYN.MORT',
    desc:'Under-5 mortality per 1,000 live births. Mapped 0–100 (capped). Lower is better.',
    calc:function(v){ return Math.min(100, v); }, fmt:function(v){ return v.toFixed(1)+' per 1,000'; } },
  { key:'life-expectancy', label:'Life expectancy', cat:'Health', wb:'SP.DYN.LE00.IN',
    desc:'Life expectancy at birth. Target 75y. Shortfall = (75 − v)/75 × 100, floored at 0.',
    calc:function(v){ return Math.max(0, (75 - v) / 75 * 100); }, fmt:function(v){ return v.toFixed(1)+' years'; } },
  { key:'peace', label:'Peace (homicides)', cat:'Peace & justice', wb:'VC.IHR.PSRC.P5',
    desc:'Intentional homicides per 100k. 10/100k = 100% shortfall (capped).',
    calc:function(v){ return Math.min(100, v / 10 * 100); }, fmt:function(v){ return v.toFixed(2)+' per 100k'; } },
  { key:'water', label:'Drinking water', cat:'Water', wb:'SH.H2O.SMDW.ZS',
    desc:'Using safely managed drinking water %. Shortfall = 100 − value.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% access'; } },
  { key:'sanitation', label:'Sanitation', cat:'Water', wb:'SH.STA.SMSS.ZS',
    desc:'Using safely managed sanitation %. Shortfall = 100 − value.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% access'; } }
];

var ECO_MAX = 6; // ratios capped here for drawing (tooltip notes when capped)

// boundary sources: CO2 1.6t + EF 1.7gha + MF 7.2t per O'Neill et al. 2018 ("Good Life");
// PM2.5 5ug/m3 = WHO 2021 guideline; water stress 25% = FAO stressed threshold (SDG 6.4.2);
// freshwater 1700 m3/cap = Falkenmark scarcity threshold (overshoot when BELOW it).
var ECO = [
  { key:'co2', label:'CO₂ per capita', wb:'EN.GHG.CO2.PC.CE.AR5', boundary:1.6, dir:'over',
    unit:'t CO₂e', src:'World Bank (live)',
    desc:'CO₂ excl. LULUCF per capita vs 1.6 t budget.' },
  { key:'pm25', label:'Air pollution', wb:'EN.ATM.PM25.MC.M3', boundary:5, dir:'over',
    unit:'µg/m³', src:'World Bank (live)',
    desc:'Mean PM2.5 exposure vs WHO guideline 5 µg/m³.' },
  { key:'water-stress', label:'Water stress', wb:'ER.H2O.FWST.ZS', boundary:25, dir:'over',
    unit:'%', src:'World Bank / SDG 6.4.2 (live)',
    desc:'Freshwater withdrawal as % of resources vs 25% stress threshold.' },
  { key:'freshwater', label:'Freshwater per capita', wb:'ER.H2O.INTR.PC', boundary:1700, dir:'under',
    unit:'m³', src:'World Bank (live)',
    desc:'Renewable water per capita vs 1700 m³ Falkenmark threshold (overshoot = below).' },
  { key:'material', label:'Material footprint', json:'mf', field:'tonnes', boundary:7.2, dir:'over',
    unit:'t', src:'Leeds-2021 seed, yearly refresh',
    desc:'Raw-material equivalents per capita vs 7.2 t budget.' },
  { key:'ecofoot', label:'Ecological footprint', json:'ef', field:'gha', boundary:1.7, dir:'over',
    unit:'gha', src:'York NFA bulk, yearly refresh',
    desc:'Consumption footprint per capita vs 1.7 gha budget.' }
];

var state = { countries:[], mf:{}, ef:{}, cache:{}, current:null };

function $(id){ return document.getElementById(id); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function arcPath(cx, cy, r0, r1, a0, a1){
  function pt(r,a){ return [cx + r*Math.cos(a), cy + r*Math.sin(a)]; }
  var p0 = pt(r1,a0), p1 = pt(r1,a1), p2 = pt(r0,a1), p3 = pt(r0,a0);
  var large = (a1 - a0) > Math.PI ? 1 : 0;
  return 'M'+p0+' L'+p1+' A'+r1+' '+r1+' 0 '+large+' 1 '+p2+' L'+p3+' A'+r0+' '+r0+' 0 '+large+' 0 '+p0+' Z';
}

async function wbLatest(iso3, indicator){
  // latest non-null observation in last ~12 years
  var url = 'https://api.worldbank.org/v2/country/'+iso3+'/indicator/'+indicator+'?format=json&per_page=12&mrv=12';
  var res = await fetch(url);
  if(!res.ok) throw new Error('WB '+res.status);
  var j = await res.json();
  if(!Array.isArray(j) || !j[1]) return { value:null, year:null };
  for(var i=0;i<j[1].length;i++){
    if(j[1][i].value !== null && j[1][i].value !== undefined) return { value:j[1][i].value, year:j[1][i].date };
  }
  return { value:null, year:null };
}

async function loadSocialLive(iso3){
  if(state.cache[iso3]) return state.cache[iso3];
  var out = await Promise.all(SOCIAL.map(async function(s){
    try {
      var r = await wbLatest(iso3, s.wb);
      if(r.value === null) return { key:s.key, value:null, year:null, shortfall:null };
      return { key:s.key, value:r.value, year:r.year, shortfall:clamp(s.calc(r.value),0,100) };
    } catch(e){ return { key:s.key, value:null, year:null, shortfall:null, error:true }; }
  }));
  state.cache[iso3] = out;
  return out;
}

async function loadEco(iso3){
  var out = await Promise.all(ECO.map(async function(e){
    try {
      var value = null, year = null, src = e.src;
      if(e.wb){
        var r = await wbLatest(iso3, e.wb);
        value = r.value; year = r.year;
      } else if(e.json === 'mf' && state.mf[iso3]){
        value = state.mf[iso3].tonnes; year = state.mf[iso3].year;
      } else if(e.json === 'ef' && state.ef[iso3]){
        value = state.ef[iso3].gha; year = state.ef[iso3].year;
      }
      if(value === null || value === undefined) return { key:e.key, value:null, year:null, ratio:null };
      var ratio = e.dir === 'over' ? value / e.boundary : e.boundary / value;
      return { key:e.key, value:value, year:year, ratio:ratio };
    } catch(err){ return { key:e.key, value:null, year:null, ratio:null }; }
  }));
  return out;
}

function render(social, eco, country){
  var box = $('chart-area');
  box.innerHTML = '';
  var S = 760, cx = S/2, cy = S/2;
  var rSafeIn = 185, rSafeOut = 285, rSocialMin = 70, rEcoMax = 368;
  var NS = SOCIAL.length, NE = ECO.length;
  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('viewBox','0 0 '+S+' '+S);
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Doughnut chart for '+country.name);

  function addRing(r, color, w, label){
    var c = document.createElementNS(svgNS,'circle');
    c.setAttribute('cx',cx); c.setAttribute('cy',cy); c.setAttribute('r',r);
    c.setAttribute('fill','none'); c.setAttribute('stroke',color); c.setAttribute('stroke-width',w);
    if(label){ c.appendChild(document.createElementNS(svgNS,'title')).textContent = label; }
    svg.appendChild(c);
  }
  // safe space annulus
  var safe = document.createElementNS(svgNS,'circle');
  safe.setAttribute('cx',cx); safe.setAttribute('cy',cy);
  safe.setAttribute('r',(rSafeIn+rSafeOut)/2);
  safe.setAttribute('fill','none'); safe.setAttribute('stroke','#6fb646');
  safe.setAttribute('stroke-width', rSafeOut - rSafeIn); safe.setAttribute('opacity','0.85');
  svg.appendChild(safe);
  addRing(rSafeIn,'#017241',3,'Social foundation boundary');
  addRing(rSafeOut,'#017241',3,'Ecological ceiling boundary (ratio 1.0)');
  // eco scale rings at 2x, 4x
  addRing(rSafeOut + (rEcoMax-rSafeOut)*0.5, '#017241', 1, '2x boundary');
  addRing(rSafeOut + (rEcoMax-rSafeOut)*0.83, '#017241', 1, '4x boundary');

  var gap = 0.018;
  // social bars grow inward
  SOCIAL.forEach(function(s, i){
    var a0 = -Math.PI/2 + i*(2*Math.PI/NS) + gap;
    var a1 = -Math.PI/2 + (i+1)*(2*Math.PI/NS) - gap;
    var rec = social.filter(function(r){ return r.key===s.key; })[0] || {};
    var fill = '#c9c9c9', r0 = rSafeIn - 18, r1 = rSafeIn, tip;
    if(rec.shortfall === null || rec.shortfall === undefined){
      tip = s.label+' — no live data';
    } else {
      var len = rec.shortfall/100 * (rSafeIn - rSocialMin);
      r0 = rSafeIn - Math.max(4, len);
      fill = rec.shortfall <= 0.5 ? '#6fb646' : '#d73027';
      tip = s.label+' — shortfall '+rec.shortfall.toFixed(1)+'% (raw '+s.fmt(rec.value)+', '+rec.year+')';
    }
    var p = document.createElementNS(svgNS,'path');
    p.setAttribute('d', arcPath(cx,cy,r0,r1,a0,a1));
    p.setAttribute('fill',fill); p.setAttribute('class','bar');
    p.appendChild(document.createElementNS(svgNS,'title')).textContent = tip;
    p.addEventListener('mousemove', function(e){ showTip(e, '<b>'+s.label+'</b><br>'+tip+'<br><i>'+s.desc+'</i><br>Source: World Bank '+s.wb+' (live)'); });
    p.addEventListener('mouseleave', hideTip);
    p.addEventListener('click', function(e){ showTip(e, '<b>'+s.label+'</b><br>'+tip+'<br><i>'+s.desc+'</i><br>Source: World Bank '+s.wb+' (live)', true); });
    svg.appendChild(p);
    // label
    var am = (a0+a1)/2, lr = rSocialMin - 8;
    var lx = cx + lr*Math.cos(am), ly = cy + lr*Math.sin(am);
    var t = document.createElementNS(svgNS,'text');
    t.setAttribute('x',lx); t.setAttribute('y',ly); t.setAttribute('class','clabel');
    t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
    t.textContent = s.label.split(' ')[0];
    t.appendChild(document.createElementNS(svgNS,'title')).textContent = tip;
    svg.appendChild(t);
  });

  // eco bars grow outward; length = ratio to boundary (1.0 = boundary ring)
  ECO.forEach(function(e, i){
    var a0 = -Math.PI/2 + i*(2*Math.PI/NE) + gap;
    var a1 = -Math.PI/2 + (i+1)*(2*Math.PI/NE) - gap;
    var rec = eco.filter(function(r){ return r.key===e.key; })[0] || {};
    var fill = '#c9c9c9', r0 = rSafeOut, r1 = rSafeOut + 14, tip;
    if(rec.ratio === null || rec.ratio === undefined){
      tip = e.label+' — no data';
    } else {
      var frac = clamp(rec.ratio, 0, ECO_MAX) / ECO_MAX;
      r1 = rSafeOut + Math.max(4, frac*(rEcoMax - rSafeOut));
      fill = rec.ratio > 1 ? '#d73027' : '#6fb646';
      var vtxt = (Math.abs(rec.value) < 100 ? rec.value.toFixed(2) : Math.round(rec.value)) + ' ' + e.unit;
      tip = e.label+' — ×'+rec.ratio.toFixed(2)+' of boundary ('+vtxt+', '+rec.year+')'
        + (rec.ratio > ECO_MAX ? ' [capped at ×'+ECO_MAX+' for drawing]' : '');
    }
    var fullTip = '<b>'+e.label+'</b><br>'+tip+'<br><i>'+e.desc+'</i><br>Source: '+e.src;
    var p = document.createElementNS(svgNS,'path');
    p.setAttribute('d', arcPath(cx,cy,r0,r1,a0,a1));
    p.setAttribute('fill',fill); p.setAttribute('class','bar');
    p.appendChild(document.createElementNS(svgNS,'title')).textContent = tip;
    p.addEventListener('mousemove', function(ev){ showTip(ev, fullTip); });
    p.addEventListener('mouseleave', hideTip);
    p.addEventListener('click', function(ev){ showTip(ev, fullTip, true); });
    svg.appendChild(p);
    var am = (a0+a1)/2, lr = rEcoMax + 2;
    var lx = cx + lr*Math.cos(am), ly = cy + lr*Math.sin(am);
    var anchor = Math.cos(am) > 0.3 ? 'start' : (Math.cos(am) < -0.3 ? 'end' : 'middle');
    var t = document.createElementNS(svgNS,'text');
    t.setAttribute('x',lx); t.setAttribute('y',ly); t.setAttribute('class','clabel');
    t.setAttribute('text-anchor',anchor);
    t.textContent = e.label;
    svg.appendChild(t);
  });

  // centre label
  var ct = document.createElementNS(svgNS,'text');
  ct.setAttribute('x',cx); ct.setAttribute('y',cy-6);
  ct.setAttribute('text-anchor','middle'); ct.setAttribute('font-size','18'); ct.setAttribute('font-weight','700');
  ct.textContent = country.name;
  svg.appendChild(ct);
  var cs = document.createElementNS(svgNS,'text');
  cs.setAttribute('x',cx); cs.setAttribute('y',cy+16);
  cs.setAttribute('text-anchor','middle'); cs.setAttribute('font-size','12'); cs.setAttribute('fill','#555');
  cs.textContent = 'inner = live social · outer = live pressures + footprints';
  svg.appendChild(cs);

  box.appendChild(svg);
}

function showTip(e, html, sticky){
  var tip = $('tooltip');
  tip.innerHTML = html; tip.hidden = false;
  tip.style.left = Math.min(window.innerWidth-320, e.clientX+14)+'px';
  tip.style.top = (e.clientY+14)+'px';
  if(sticky){ setTimeout(function(){ tip.hidden = true; }, 3500); }
}
function hideTip(){ $('tooltip').hidden = true; }

function renderDetail(country, social, eco){
  $('detail-title').textContent = country.name + ' (' + country.id + ')';
  var rows = social.map(function(r){
    var s = SOCIAL.filter(function(x){ return x.key===r.key; })[0];
    var val = (r.value===null||r.value===undefined) ? 'n/a' : s.fmt(r.value)+' <span style="color:#888">('+ (r.year||'?') +')</span>';
    var sh = (r.shortfall===null||r.shortfall===undefined) ? 'n/a' : r.shortfall.toFixed(1)+'%';
    return '<tr><td><b>'+s.label+'</b><br><span style="color:#666">'+s.cat+' · '+s.wb+'</span></td><td>'+val+'</td><td>'+sh+'</td></tr>';
  }).join('');
  var erows = eco.map(function(r){
    var e = ECO.filter(function(x){ return x.key===r.key; })[0];
    var val = (r.value===null||r.value===undefined)
      ? 'n/a'
      : ((Math.abs(r.value) < 100 ? r.value.toFixed(2) : Math.round(r.value))+' '+e.unit+' <span style="color:#888">('+(r.year||'?')+')</span>');
    var ra = (r.ratio===null||r.ratio===undefined) ? 'n/a' : '×'+r.ratio.toFixed(2);
    return '<tr><td><b>'+e.label+'</b><br><span style="color:#666">÷ '+e.boundary+' '+e.unit+' · '+e.src+'</span></td><td>'+val+'</td><td>'+ra+'</td></tr>';
  }).join('');
  var live = social.filter(function(r){ return r.value!==null&&r.value!==undefined; }).length;
  var elive = eco.filter(function(r){ return r.value!==null&&r.value!==undefined; }).length;
  $('detail-body').innerHTML =
    '<p>Social: <b>'+live+'/'+SOCIAL.length+'</b> live · Ecological: <b>'+elive+'/'+ECO.length+'</b>.</p>'+
    '<table><tr><th>Social indicator</th><th>Live value</th><th>Shortfall</th></tr>'+rows+'</table>'+
    '<table style="margin-top:10px"><tr><th>Ecological indicator</th><th>Value</th><th>Overshoot</th></tr>'+erows+'</table>';
}

async function selectCountry(id){
  var country = state.countries.filter(function(c){ return c.id===id; })[0];
  if(!country) return;
  state.current = country;
  $('status').textContent = 'Fetching live data for '+country.name+'…';
  var social = await loadSocialLive(id);
  var eco = await loadEco(id);
  render(social, eco, country);
  renderDetail(country, social, eco);
  var syears = social.concat(eco).filter(function(r){ return r.year; }).map(function(r){ return r.year; });
  var slive = social.filter(function(r){ return r.value!==null; }).length;
  var elive = eco.filter(function(r){ return r.value!==null; }).length;
  $('status').textContent = 'Social live '+slive+'/'+SOCIAL.length+' · Eco '+elive+'/'+ECO.length+
    (syears.length ? ' · years ' + Math.min.apply(null,syears) + '–' + Math.max.apply(null,syears) : '');
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
  }
}
document.addEventListener('DOMContentLoaded', init);
