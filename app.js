/* Doughnut by country — GitHub Pages edition (no build, no deps).
 * Data: social foundation LIVE from World Bank WDI API; ecological ceiling =
 * 4x live World Bank pressures + ecological footprint (York NFA bulk, refreshed
 * yearly by scripts/update_eco.py) + material footprint (seed baseline — the UN
 * SDG API only publishes regional aggregates for it today).
 * Rendering: ported from Caldec's RadialDoughnut (caldec.org) — true annular
 * sectors, square-root scaling, curved textPath labels, arc ring titles.
 */
'use strict';

var SOCIAL = [
  { key:'clean-cooking', short:'clean cooking', label:'Clean cooking', cat:'Energy', wb:'EG.CFT.ACCS.ZS',
    desc:'Lacking access to clean cooking fuels/tech. Shortfall = 100 − access %.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% access'; } },
  { key:'electricity', short:'electricity', label:'Electricity', cat:'Energy', wb:'EG.ELC.ACCS.ZS',
    desc:'Lacking access to electricity. Shortfall = 100 − access %.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% access'; } },
  { key:'internet', short:'internet access', label:'Internet access', cat:'Networks', wb:'IT.NET.USER.ZS',
    desc:'Not using the internet. Shortfall = 100 − users %.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% users'; } },
  { key:'nourishment', short:'nourishment', label:'Nourishment', cat:'Food', wb:'SN.ITK.DEFC.ZS',
    desc:'Prevalence of undernourishment (% of population). Shortfall = value.',
    calc:function(v){ return v; }, fmt:function(v){ return v.toFixed(1)+'% undernourished'; } },
  { key:'housing', short:'housing', label:'Housing (slums)', cat:'Housing', wb:'EN.POP.SLUM.UR.ZS',
    desc:'Urban population living in slums %. Shortfall = value.',
    calc:function(v){ return v; }, fmt:function(v){ return v.toFixed(1)+'% in slums'; } },
  { key:'literacy', short:'literacy', label:'Literacy', cat:'Education', wb:'SE.ADT.LITR.ZS',
    desc:'Adult literacy %. Shortfall = 100 − literacy.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% literate'; } },
  { key:'women-parliament', short:'gender representation', label:'Women in parliament', cat:'Gender equality', wb:'SG.GEN.PARL.ZS',
    desc:'Seats held by women %. Parity target 50%. Shortfall = (50 − v)/50 × 100, floored at 0.',
    calc:function(v){ return Math.max(0, (50 - v) / 50 * 100); }, fmt:function(v){ return v.toFixed(1)+'% seats'; } },
  { key:'u5-mortality', short:'under-five mortality', label:'Child survival', cat:'Health', wb:'SH.DYN.MORT',
    desc:'Under-5 mortality per 1,000 live births. Mapped 0–100 (capped). Lower is better.',
    calc:function(v){ return Math.min(100, v); }, fmt:function(v){ return v.toFixed(1)+' per 1,000'; } },
  { key:'life-expectancy', short:'life expectancy', label:'Life expectancy', cat:'Health', wb:'SP.DYN.LE00.IN',
    desc:'Life expectancy at birth. Target 75y. Shortfall = (75 − v)/75 × 100, floored at 0.',
    calc:function(v){ return Math.max(0, (75 - v) / 75 * 100); }, fmt:function(v){ return v.toFixed(1)+' years'; } },
  { key:'peace', short:'peace', label:'Peace (homicides)', cat:'Peace & justice', wb:'VC.IHR.PSRC.P5',
    desc:'Intentional homicides per 100k. 10/100k = 100% shortfall (capped).',
    calc:function(v){ return Math.min(100, v / 10 * 100); }, fmt:function(v){ return v.toFixed(2)+' per 100k'; } },
  { key:'water', short:'drinking water', label:'Drinking water', cat:'Water', wb:'SH.H2O.SMDW.ZS',
    desc:'Using safely managed drinking water %. Shortfall = 100 − value.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% access'; } },
  { key:'sanitation', short:'sanitation', label:'Sanitation', cat:'Water', wb:'SH.STA.SMSS.ZS',
    desc:'Using safely managed sanitation %. Shortfall = 100 − value.',
    calc:function(v){ return 100 - v; }, fmt:function(v){ return v.toFixed(1)+'% access'; } }
];

var ECO_MAX_RATIO = 11; // ratio above this draws maxed-out + chevron (i.e. >1000% over)

/* boundary sources: CO2 1.6t + EF 1.7gha + MF 7.2t per O'Neill et al. 2018 ("Good Life");
 * PM2.5 5ug/m3 = WHO 2021 guideline; water stress 25% = FAO stressed threshold (SDG 6.4.2);
 * freshwater 1700 m3/cap = Falkenmark scarcity threshold (overshoot when BELOW it). */
var ECO = [
  { key:'co2', short:'co2 emissions', label:'CO₂ per capita', wb:'EN.GHG.CO2.PC.CE.AR5', boundary:1.6, dir:'over',
    unit:'t CO₂e', src:'World Bank (live)',
    desc:'CO₂ excl. LULUCF per capita vs 1.6 t budget.' },
  { key:'pm25', short:'air pollution', label:'Air pollution', wb:'EN.ATM.PM25.MC.M3', boundary:5, dir:'over',
    unit:'µg/m³', src:'World Bank (live)',
    desc:'Mean PM2.5 exposure vs WHO guideline 5 µg/m³.' },
  { key:'water-stress', short:'freshwater use', label:'Water stress', wb:'ER.H2O.FWST.ZS', boundary:25, dir:'over',
    unit:'%', src:'World Bank / SDG 6.4.2 (live)',
    desc:'Freshwater withdrawal as % of resources vs 25% stress threshold.' },
  { key:'freshwater', short:'water availability', label:'Freshwater per capita', wb:'ER.H2O.INTR.PC', boundary:1700, dir:'under',
    unit:'m³', src:'World Bank (live)',
    desc:'Renewable water per capita vs 1700 m³ Falkenmark threshold (overshoot = below).' },
  { key:'material', short:'material footprint', label:'Material footprint', json:'mf', field:'tonnes', boundary:7.2, dir:'over',
    unit:'t', src:'Leeds-2021 seed, yearly refresh',
    desc:'Raw-material equivalents per capita vs 7.2 t budget.' },
  { key:'ecofoot', short:'ecological footprint', label:'Ecological footprint', json:'ef', field:'gha', boundary:1.7, dir:'over',
    unit:'gha', src:'York NFA bulk, yearly refresh',
    desc:'Consumption footprint per capita vs 1.7 gha budget.' }
];

/* Caldec RadialDoughnut geometry (square 1300 canvas, top-clockwise angles):
 * social stubs/bars: outer edge 322, max inward to 170 · grey foundation ring 324-352
 * green safe band 354-456 · grey ceiling ring 458-486 · eco stubs/bars: inner edge
 * 488, max outward to 600 · category labels: social 148, eco 632. */
var DC = {
  S: 1300, C: 650,
  K: 148, T: 170, SZ: 322, N: 324, R: 352, B: 354, G: 456, L: 458, W: 486,
  K2: 488, Q: 600, V: 632,
  CAP_ECO: 1000, CAP_SOC: 100,
  CREAM: '#F5F1EA', INK: '#1F1D1A', CORAL: '#B14A3A', CORAL_SAFE: '#B5AFA2',
  BAND_GREEN: '#4F8C5C', BAND_GREY: '#C9C3B4', BAND_GREY_TEXT: '#2B2622',
  BAND_GREEN_TEXT: '#F5F1EA', MISSING: '#D8D5CC'
};

var state = { countries:[], mf:{}, ef:{}, cache:{}, current:null,
              reqId:0, progDone:0, progTotal:1, sel:null };

function $(id){ return document.getElementById(id); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

/* angle 0 = top, clockwise (Caldec convention) */
function polar(r, a){
  return { x: DC.C + r*Math.sin(a), y: DC.C - r*Math.cos(a) };
}
/* annular sector path between radii e (inner) and s (outer), angles a..m */
function sector(e, s, a, m){
  var f = m - a > Math.PI ? 1 : 0;
  var l = polar(s, a), d = polar(s, m), p = polar(e, m), A = polar(e, a);
  return ['M '+l.x.toFixed(1)+' '+l.y.toFixed(1),
          'A '+s.toFixed(1)+' '+s.toFixed(1)+' 0 '+f+' 1 '+d.x.toFixed(1)+' '+d.y.toFixed(1),
          'L '+p.x.toFixed(1)+' '+p.y.toFixed(1),
          'A '+e.toFixed(1)+' '+e.toFixed(1)+' 0 '+f+' 0 '+A.x.toFixed(1)+' '+A.y.toFixed(1),
          'Z'].join(' ');
}
/* square-root (area-proportional) scaling, like Caldec */
function sqrtScale(v, cap){ return Math.sqrt(clamp(v, 0, cap) / cap); }
/* label arc across a wedge, flipped upright on the left half */
function labelArc(r, mid, width){
  var left = mid > Math.PI/2 && mid < 3*Math.PI/2;
  var f = mid - width/2, l = mid + width/2;
  var d = polar(r, f), p = polar(r, l);
  return left ? ('M '+p.x.toFixed(1)+' '+p.y.toFixed(1)+' A '+r+' '+r+' 0 0 0 '+d.x.toFixed(1)+' '+d.y.toFixed(1))
              : ('M '+d.x.toFixed(1)+' '+d.y.toFixed(1)+' A '+r+' '+r+' 0 0 1 '+p.x.toFixed(1)+' '+p.y.toFixed(1));
}
/* near-semicircle arc across the top for ring titles */
function topArc(r){
  var s = polar(r, -Math.PI*0.48), a = polar(r, Math.PI*0.48);
  return 'M '+s.x.toFixed(1)+' '+s.y.toFixed(1)+' A '+r+' '+r+' 0 0 1 '+a.x.toFixed(1)+' '+a.y.toFixed(1);
}
function fmtPct(v){
  if(v >= 1000) return Math.round(v).toLocaleString('en-US')+'%';
  return Math.round(v)+'%';
}

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
function titleEl(txt){
  var t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  t.textContent = txt;
  return t;
}

function render(social, eco, country){
  var box = $('chart-area');
  var loader = $('loader');
  box.querySelectorAll('svg').forEach(function(s){ s.remove(); });
  var svg = elNS('svg', { viewBox:'0 0 '+DC.S+' '+DC.S, 'class':'dough-svg' });
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Doughnut chart for '+country.name);

  var TWO_PI = Math.PI*2;
  var nS = SOCIAL.length, nE = ECO.length;
  var arcS = TWO_PI/nS, arcE = TWO_PI/nE;

  function byKey(arr, key){
    for(var i=0;i<arr.length;i++) if(arr[i].key===key) return arr[i];
    return null;
  }
  function dimmed(ring, key){
    if(!state.sel) return 1;
    return (state.sel.ring===ring && state.sel.key===key) ? 1 : 0.45;
  }

  /* defs: curved label paths (outer ring only — the hole stays clean) + ring title arcs */
  var defs = elNS('defs', {});
  ECO.forEach(function(e, i){
    var mid = i*arcE + arcE/2;
    var p = elNS('path', { id:'eco-lp-'+i, d:labelArc(DC.V, mid, arcE*0.85), fill:'none' });
    defs.appendChild(p);
  });
  [['ring-eco-arc',(DC.L+DC.W)/2],['ring-green-arc',(DC.B+DC.G)/2],['ring-soc-arc',(DC.N+DC.R)/2]
  ].forEach(function(r){
    defs.appendChild(elNS('path', { id:r[0], d:topArc(r[1]), fill:'none' }));
  });
  svg.appendChild(defs);

  /* rings: outer grey (ceiling), green safe band, inner grey (foundation) */
  svg.appendChild(elNS('circle', { cx:DC.C, cy:DC.C, r:(DC.L+DC.W)/2, fill:'none',
    stroke:DC.BAND_GREY, 'stroke-width':DC.W-DC.L }));
  svg.appendChild(elNS('circle', { cx:DC.C, cy:DC.C, r:(DC.B+DC.G)/2, fill:'none',
    stroke:DC.BAND_GREEN, 'stroke-width':DC.G-DC.B }));
  svg.appendChild(elNS('circle', { cx:DC.C, cy:DC.C, r:(DC.N+DC.R)/2, fill:'none',
    stroke:DC.BAND_GREY, 'stroke-width':DC.R-DC.N }));

  /* ---- ecological wedges (grow outward from 488, max 600) ---- */
  ECO.forEach(function(e, i){
    var a1 = i*arcE + arcE*0.05, a2 = (i+1)*arcE - arcE*0.05;
    var mid = (a1+a2)/2;
    var rec = byKey(eco, e.key);
    var g = svgEl('g', { 'class':'wedge' });
    var isSafe = rec && rec.ratio !== null && rec.ratio !== undefined && rec.ratio <= 1;
    var missing = !rec || rec.ratio === null || rec.ratio === undefined;
    var over = missing || isSafe ? 0 : (rec.ratio - 1)*100; // overshoot %
    var capped = over > DC.CAP_ECO;
    var len = missing || isSafe ? 0 : sqrtScale(over, DC.CAP_ECO)*(DC.Q-DC.K2);
    var r1 = DC.K2, r2 = (missing || isSafe) ? DC.K2+6 : DC.K2+Math.max(8, len);
    var fill = missing ? DC.MISSING : (isSafe ? DC.CORAL_SAFE : DC.CORAL);
    var tip = missing ? (e.label+' — no data')
      : isSafe ? (e.label+' — within boundary (×'+rec.ratio.toFixed(2)+', '+fmtVal(rec.value)+' '+e.unit+', '+rec.year+')')
      : (e.label+' — +'+fmtPct(over)+' over boundary (×'+rec.ratio.toFixed(2)+', '+fmtVal(rec.value)+' '+e.unit+', '+rec.year+')'
         +(capped ? ' [drawn capped]' : ''));
    var path = elNS('path', { d:sector(r1, r2, a1, a2), fill:fill,
      opacity:dimmed('eco', e.key), stroke:DC.CREAM, 'stroke-width':1.2 });
    path.appendChild(titleEl(tip+' — '+e.desc+' Source: '+e.src));
    g.appendChild(path);
    if(capped){ /* cream chevron at the tip, like Caldec */
      var c = polar(r2-4, mid), w = a2-a1;
      var p1 = polar(r2-14, a1+w*0.3), p2 = polar(r2-14, a1+w*0.7);
      g.appendChild(elNS('polyline', {
        points:p1.x.toFixed(1)+','+p1.y.toFixed(1)+' '+c.x.toFixed(1)+','+c.y.toFixed(1)+' '+p2.x.toFixed(1)+','+p2.y.toFixed(1),
        fill:'none', stroke:DC.CREAM, 'stroke-width':2.4,
        'stroke-linecap':'round', 'stroke-linejoin':'round' }));
    }
    if(!missing && !isSafe){
      var lr = Math.max(DC.K2+18, r2-16), lp = polar(lr, mid);
      var t = elNS('text', { x:lp.x.toFixed(1), y:lp.y.toFixed(1), 'class':'wedge-num',
        'text-anchor':'middle', 'dominant-baseline':'middle', fill:DC.BAND_GREEN_TEXT,
        transform:'rotate('+(mid*180/Math.PI).toFixed(1)+' '+lp.x.toFixed(1)+' '+lp.y.toFixed(1)+')' });
      t.textContent = '+'+fmtPct(over);
      g.appendChild(t);
    }
    (function(ee){
      g.addEventListener('click', function(){ selectWedge('eco', ee.key); });
      g.addEventListener('mouseover', function(){ hoverWedge('eco', ee.key); });
      g.addEventListener('mouseleave', restoreCenter);
    })(e);
    svg.appendChild(g);
  });

  /* ---- social wedges (grow inward from 322, max to 170) ---- */
  SOCIAL.forEach(function(s, i){
    var a1 = i*arcS + arcS*0.05, a2 = (i+1)*arcS - arcS*0.05;
    var mid = (a1+a2)/2;
    var rec = byKey(social, s.key);
    var g = svgEl('g', { 'class':'wedge' });
    var isSafe = rec && rec.shortfall !== null && rec.shortfall !== undefined && rec.shortfall <= 0.5;
    var missing = !rec || rec.shortfall === null || rec.shortfall === undefined;
    var v = missing || isSafe ? 0 : rec.shortfall;
    var len = missing || isSafe ? 0 : sqrtScale(v, DC.CAP_SOC)*(DC.SZ-DC.T-6);
    var rOut = DC.SZ, rIn = (missing || isSafe) ? DC.SZ-6 : Math.max(DC.T+4, DC.SZ-Math.max(8, len));
    var fill = missing ? DC.MISSING : (isSafe ? DC.CORAL_SAFE : DC.CORAL);
    var tip = missing ? (s.label+' — no live data')
      : isSafe ? (s.label+' — met ('+s.fmt(rec.value)+', '+rec.year+')')
      : (s.label+' — −'+fmtPct(v)+' shortfall ('+s.fmt(rec.value)+', '+rec.year+')');
    var path = elNS('path', { d:sector(rIn, rOut, a1, a2), fill:fill,
      opacity:dimmed('soc', s.key), stroke:DC.CREAM, 'stroke-width':1.2 });
    path.appendChild(titleEl(tip+' — '+s.desc+' Source: World Bank '+s.wb+' (live)'));
    g.appendChild(path);
    /* no text on social wedges — hover/tap shows the info in the middle instead */
    (function(ss){
      g.addEventListener('click', function(){ selectWedge('soc', ss.key); });
      g.addEventListener('mouseover', function(){ hoverWedge('soc', ss.key); });
      g.addEventListener('mouseleave', restoreCenter);
    })(s);
    svg.appendChild(g);
  });

  /* ---- curved category labels ---- */
  function textPath(id, str, cls, fill){
    var t = elNS('text', { 'class':cls, fill:fill });
    var tp = elNS('textPath', { href:'#'+id, startOffset:'50%', 'text-anchor':'middle' });
    tp.textContent = str;
    t.appendChild(tp);
    return t;
  }
  ECO.forEach(function(e, i){
    svg.appendChild(textPath('eco-lp-'+i, e.short.toLowerCase(), 'cat-label', DC.INK));
  });
  svg.appendChild(textPath('ring-eco-arc', 'ECOLOGICAL  CEILING', 'ring-title', DC.BAND_GREY_TEXT));
  svg.appendChild(textPath('ring-green-arc', 'the safe and just space for humanity', 'band-headline', DC.BAND_GREEN_TEXT));
  svg.appendChild(textPath('ring-soc-arc', 'SOCIAL  FOUNDATION', 'ring-title', DC.BAND_GREY_TEXT));

  /* ---- centre: a readout group, repainted on hover/select ---- */
  var centerG = elNS('g', { id:'center-g' });
  svg.appendChild(centerG);

  box.appendChild(svg);
  if(loader) loader.hidden = true;
  state.centerG = centerG;
  state.centerCountry = country;
  state.centerStats = {
    metS: social.filter(function(r){ return r.shortfall!==null && r.shortfall!==undefined && r.shortfall<=0.5; }).length,
    metE: eco.filter(function(r){ return r.ratio!==null && r.ratio!==undefined && r.ratio<=1; }).length,
    totS: social.filter(function(r){ return r.shortfall!==null && r.shortfall!==undefined; }).length,
    totE: eco.filter(function(r){ return r.ratio!==null && r.ratio!==undefined; }).length
  };
  state.centerData = { social:social, eco:eco };
  if(state.sel) paintCenterInfo(state.sel.ring, state.sel.key);
  else paintCenterDefault();
}

function centerText(str, x, y, cls, fill, size){
  var t = elNS('text', { x:x, y:y, 'text-anchor':'middle',
    'dominant-baseline':'middle', 'class':cls });
  if(fill) t.setAttribute('fill', fill);
  if(size) t.setAttribute('font-size', size);
  t.textContent = str;
  state.centerG.appendChild(t);
  return t;
}
function clearCenter(){
  var g = state.centerG;
  while(g.firstChild) g.removeChild(g.firstChild);
}

/* default view: country + score */
function paintCenterDefault(){
  if(!state.centerG) return;
  clearCenter();
  var c = state.centerCountry, s = state.centerStats;
  splitLines(c.name, 15).forEach(function(ln, idx){
    centerText(ln, DC.C, DC.C-30+idx*36, 'center-name');
  });
  centerText(c.id, DC.C, DC.C+46, 'center-sub', '#5a6360');
  var okS = s.metS===s.totS && s.totS>0, okE = s.metE===s.totE && s.totE>0;
  centerText(s.metS+'/'+s.totS+' foundations met', DC.C, DC.C+74, 'center-sub',
    okS ? DC.BAND_GREEN : DC.CORAL);
  centerText(s.metE+'/'+s.totE+' ceilings respected', DC.C, DC.C+100, 'center-sub',
    okE ? DC.BAND_GREEN : DC.CORAL);
}

function lookupDef(ring, key){
  var arr = ring==='soc' ? SOCIAL : ECO;
  for(var i=0;i<arr.length;i++) if(arr[i].key===key) return arr[i];
  return null;
}
function lookupRec(ring, key){
  var arr = ring==='soc' ? state.centerData.social : state.centerData.eco;
  for(var i=0;i<arr.length;i++) if(arr[i].key===key) return arr[i];
  return null;
}

/* info view: hovered/selected dimension, big and readable */
function paintCenterInfo(ring, key){
  if(!state.centerG) return;
  var def = lookupDef(ring, key), rec = lookupRec(ring, key);
  if(!def || !rec) return;
  clearCenter();
  splitLines(def.label, 16).forEach(function(ln, idx){
    centerText(ln, DC.C, DC.C-64+idx*34, 'center-name');
  });
  if(ring === 'soc'){
    if(rec.shortfall===null || rec.shortfall===undefined){
      centerText('no data', DC.C, DC.C+6, 'center-value', DC.MISSING);
      centerText(def.wb+' · —', DC.C, DC.C+40, 'center-sub2');
    } else if(rec.shortfall <= 0.5){
      centerText('within bounds', DC.C, DC.C+6, 'center-value', DC.BAND_GREEN);
      centerText(def.fmt(rec.value)+' · '+rec.year, DC.C, DC.C+40, 'center-sub2');
    } else {
      centerText('−'+Math.round(rec.shortfall)+'%', DC.C, DC.C+8, 'center-value', DC.CORAL);
      centerText(def.fmt(rec.value)+' · '+rec.year, DC.C, DC.C+44, 'center-sub2');
    }
  } else {
    if(rec.ratio===null || rec.ratio===undefined){
      centerText('no data', DC.C, DC.C+6, 'center-value', DC.MISSING);
      centerText('—', DC.C, DC.C+40, 'center-sub2');
    } else if(rec.ratio <= 1){
      centerText('×'+rec.ratio.toFixed(2), DC.C, DC.C+8, 'center-value', DC.BAND_GREEN);
      centerText(fmtVal(rec.value)+' '+def.unit+' · '+rec.year+' · ÷'+def.boundary, DC.C, DC.C+44, 'center-sub2');
    } else {
      centerText('+'+fmtPct((rec.ratio-1)*100), DC.C, DC.C+8, 'center-value', DC.CORAL);
      centerText(fmtVal(rec.value)+' '+def.unit+' · '+rec.year+' · ÷'+def.boundary, DC.C, DC.C+44, 'center-sub2');
    }
  }
}

var hoverKey = null;
function hoverWedge(ring, key){
  if(hoverKey === ring+':'+key) return;
  hoverKey = ring+':'+key;
  paintCenterInfo(ring, key);
}
function restoreCenter(){
  hoverKey = null;
  if(!state.centerG) return;
  if(state.sel) paintCenterInfo(state.sel.ring, state.sel.key);
  else paintCenterDefault();
}

function svgEl(tag, attrs){ return elNS(tag, attrs); }

function fmtVal(v){
  return Math.abs(v) < 100 ? v.toFixed(2) : String(Math.round(v));
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

function selectWedge(ring, key){
  if(state.sel && state.sel.ring===ring && state.sel.key===key) state.sel = null;
  else state.sel = { ring:ring, key:key };
  if(state.last) render(state.last.social, state.last.eco, state.last.country);
  var row = $('row-'+ring+'-'+key);
  if(row && state.sel){
    row.classList.add('flash');
    row.scrollIntoView({ block:'nearest', behavior:'smooth' });
    setTimeout(function(){ row.classList.remove('flash'); }, 1800);
  }
  var names = { soc:'Social', eco:'Ecological' };
  var label = state.sel ? (function(){
    var arr = state.sel.ring==='soc' ? SOCIAL : ECO, k = state.sel.key;
    for(var i=0;i<arr.length;i++) if(arr[i].key===k) return arr[i].label;
    return k;
  })() : null;
  if(label) $('status').textContent = names[state.sel.ring]+': '+label+' — see details →';
}

function renderDetail(country, social, eco){
  $('detail-title').textContent = country.name + ' (' + country.id + ')';
  function row(ring, key, color, name, sub, val, pct, pctLabel){
    return '<div class="row" id="row-'+ring+'-'+key+'"><span class="dot" style="background:'+color+'"></span>'+
      '<div class="rmeta"><b>'+esc(name)+'</b><small>'+esc(sub)+'</small>'+
      '<div class="rbar"><i style="width:'+Math.round(clamp(pct,0,100))+'%;background:'+color+'"></i></div></div>'+
      '<div class="rval">'+val+'<small>'+esc(pctLabel)+'</small></div></div>';
  }
  function byKey(arr, key){
    for(var i=0;i<arr.length;i++) if(arr[i].key===key) return arr[i];
    return null;
  }
  var srows = SOCIAL.map(function(s){
    var r = byKey(social, s.key);
    if(!r || r.shortfall===null||r.shortfall===undefined)
      return row('soc', s.key, DC.MISSING, s.label, s.wb+' · no data', 'n/a', 0, '—');
    var ok = r.shortfall <= 0.5;
    return row('soc', s.key, ok ? DC.BAND_GREEN : DC.CORAL, s.label,
      s.wb+' · '+r.year, esc(s.fmt(r.value)),
      ok ? 0 : r.shortfall, ok ? 'met' : '−'+Math.round(r.shortfall)+'% shortfall');
  }).join('');
  var erows = ECO.map(function(e){
    var r = byKey(eco, e.key);
    if(!r || r.ratio===null||r.ratio===undefined)
      return row('eco', e.key, DC.MISSING, e.label, 'no data', 'n/a', 0, '—');
    var ok = r.ratio <= 1;
    var v = fmtVal(r.value)+' '+e.unit;
    var pct = ok ? 0 : clamp((r.ratio-1)/(ECO_MAX_RATIO-1)*100, 0, 100);
    return row('eco', e.key, ok ? DC.BAND_GREEN : DC.CORAL, e.label,
      '÷ '+e.boundary+' '+e.unit+' · '+r.year, esc(v),
      pct, ok ? '×'+r.ratio.toFixed(2) : '×'+r.ratio.toFixed(2)+' over');
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
  state.sel = null;
  var loader = $('loader');
  if(loader){ loader.hidden = false; }
  state.progDone = 0;
  state.progTotal = state.cache[id] ? ECO.filter(function(e){return e.wb;}).length : wbCount();
  $('status').textContent = 'Fetching live data for '+country.name+'…';
  var social = await loadSocialLive(id);
  var eco = await loadEco(id);
  if(myReq !== state.reqId) return; // user switched country mid-load
  state.last = { social:social, eco:eco, country:country };
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
