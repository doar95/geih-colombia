/* Indicadores sociales de Colombia a partir de la GEIH y la ECV (DANE)
   Lógica de visualización. Datos: data/datos.json (generado por scripts/01_construir_datos.py) */
(function () {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const C = { azul: '#3366CC', osc: '#004884', ama: '#FFAB00', rojo: '#A80521', verde: '#069169', gris: '#7A7A7A', cl: '#E6EFFD' };
const SERIE = [C.osc, C.ama, C.verde, C.rojo, C.azul, C.gris];
const NOMBRES = { '05': 'Antioquia', '08': 'Atlántico', '11': 'Bogotá D.C.', '13': 'Bolívar', '15': 'Boyacá', '17': 'Caldas', '18': 'Caquetá', '19': 'Cauca', '20': 'Cesar', '23': 'Córdoba', '25': 'Cundinamarca', '27': 'Chocó', '41': 'Huila', '44': 'La Guajira', '47': 'Magdalena', '50': 'Meta', '52': 'Nariño', '54': 'Norte de Santander', '63': 'Quindío', '66': 'Risaralda', '68': 'Santander', '70': 'Sucre', '73': 'Tolima', '76': 'Valle del Cauca', '81': 'Arauca', '85': 'Casanare', '86': 'Putumayo', '88': 'San Andrés', '91': 'Amazonas', '94': 'Guainía', '95': 'Guaviare', '97': 'Vaupés', '99': 'Vichada' };
const MANDATOS = [
  { n: 'Andrés Pastrana', i: '1998-08', f: '2002-07' }, { n: 'Álvaro Uribe (I)', i: '2002-08', f: '2006-07' },
  { n: 'Álvaro Uribe (II)', i: '2006-08', f: '2010-07' }, { n: 'Juan Manuel Santos (I)', i: '2010-08', f: '2014-07' },
  { n: 'Juan Manuel Santos (II)', i: '2014-08', f: '2018-07' }, { n: 'Iván Duque', i: '2018-08', f: '2022-07' },
  { n: 'Gustavo Petro', i: '2022-08', f: '2026-07' }, { n: 'Abelardo de la Espriella', i: '2026-08', f: '2030-07' }];
let D, GEO, constantes = false, verMandatos = false;
const charts = {};
const lang = () => document.documentElement.lang === 'en' ? 'en' : 'es';
const t = (es, en) => lang() === 'en' ? en : es;
const nf = (v, d = 1) => v == null || isNaN(v) ? '—' : v.toLocaleString(lang() === 'en' ? 'en-US' : 'es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const TR = { 'Nacional': 'National', 'Cabecera': 'Urban centres', 'Cabeceras': 'Urban centres', 'Centros poblados y rural disperso': 'Rural areas', 'Total nacional': 'National total', '13 Ciudades y A.M.': '13 cities and metro areas', '23 Ciudades y A.M.': '23 cities and metro areas' };
const tr = k => lang() === 'en' && TR[k] ? TR[k] : k;
const cop = v => v == null ? '—' : 'COP ' + Math.round(v).toLocaleString(lang() === 'en' ? 'en-US' : 'es-CO');

/* ---------- Deflactor: COP constantes de 2025 (IPC promedio anual, base dic. 2018 = 100) ---------- */
const BASE = 2025;
function defl(v, a) {
  if (!constantes || v == null) return v;
  const i = D.ipc_anual[a], b = D.ipc_anual[BASE];
  return i && b ? v * b / i : null;
}
function avisoMonetario() {
  $$('.aviso-constantes').forEach(e => e.hidden = !constantes);
  $$('[data-moneda]').forEach(e => e.textContent = constantes ? t('COP constantes de 2025', 'constant 2025 COP') : t('COP corrientes', 'current COP'));
}

/* ---------- Gráficos ---------- */
const bandas = {
  id: 'bandas',
  beforeDatasetsDraw(ch, a, o) {
    if (!verMandatos || !o || !o.anual) return;
    const { ctx, chartArea: ar, scales: { x } } = ch; const labs = ch.data.labels.map(String);
    MANDATOS.forEach((m, k) => {
      const ia = labs.indexOf(String(+m.i.slice(0, 4) + 1)), fa = labs.indexOf(m.f.slice(0, 4));
      const i0 = labs.indexOf(m.i.slice(0, 4));
      const s = i0 >= 0 ? i0 : (ia >= 0 ? ia : (+m.i.slice(0, 4) < +labs[0] ? 0 : -1));
      const e = fa >= 0 ? fa : (+m.f.slice(0, 4) > +labs[labs.length - 1] && s >= 0 ? labs.length - 1 : -1);
      if (s < 0 || e < 0) return;
      const x0 = x.getPixelForValue(s), x1 = x.getPixelForValue(e);
      ctx.save(); ctx.fillStyle = k % 2 ? 'rgba(51,102,204,.07)' : 'rgba(255,171,0,.09)';
      ctx.fillRect(x0, ar.top, Math.max(2, x1 - x0), ar.bottom - ar.top);
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--sub'); ctx.font = '10px Work Sans, sans-serif';
      ctx.fillText(m.n.split(' ').slice(-2).join(' '), x0 + 3, ar.top + 10 + (k % 2) * 11); ctx.restore();
    });
  }
};
Chart.register(bandas);
function linea(id, labels, series, opt = {}) {
  const el = document.getElementById(id); if (!el) return;
  if (charts[id]) charts[id].destroy();
  const css = getComputedStyle(document.body);
  charts[id] = new Chart(el, {
    type: opt.tipo || 'line',
    data: { labels, datasets: series.map((s, k) => ({ label: s.n, data: s.v, borderColor: s.c || SERIE[k % 6], backgroundColor: s.c || SERIE[k % 6], borderWidth: 2, pointRadius: labels.length > 40 ? 0 : 2.5, spanGaps: false, borderDash: s.dash || [], tension: 0 })) },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { bandas: { anual: !!opt.anual }, legend: { labels: { color: css.getPropertyValue('--texto'), boxWidth: 12 } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${opt.fmt ? opt.fmt(c.parsed.y) : nf(c.parsed.y, opt.d ?? 1)}` } } },
      scales: { x: { ticks: { color: css.getPropertyValue('--sub'), maxTicksLimit: 14 }, grid: { display: false } },
        y: { beginAtZero: !!opt.cero, ticks: { color: css.getPropertyValue('--sub'), callback: v => opt.fmtEje ? opt.fmtEje(v) : nf(v, opt.dEje ?? 0) }, grid: { color: css.getPropertyValue('--borde') },
          title: { display: !!opt.y, text: opt.y || '', color: css.getPropertyValue('--sub') } } }
    }
  });
}
const rango = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const val = (o, k) => o && o[k] != null ? o[k] : null;

/* ---------- Mapa coroplético (SVG) ---------- */
function mapa(id, valores, opt = {}) {
  const cont = document.getElementById(id); if (!cont || !GEO) return;
  const vs = Object.values(valores).filter(v => v != null);
  const mn = opt.min ?? Math.min(...vs), mx = opt.max ?? Math.max(...vs);
  const W = 420, H = 560, lon0 = -79.1, lon1 = -66.8, lat0 = -4.3, lat1 = 13.5, k = Math.cos(4 * Math.PI / 180);
  const sx = W / ((lon1 - lon0) * k), sy = H / (lat1 - lat0), s = Math.min(sx, sy);
  const P = ([x, y]) => [((x - lon0) * k * s).toFixed(1), ((lat1 - y) * s).toFixed(1)];
  const ring = r => 'M' + r.map(P).join('L') + 'Z';
  const path = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map(p => p.map(ring).join('')).join('');
  const col = v => { if (v == null) return 'var(--nodato)'; let q = mx === mn ? .5 : (v - mn) / (mx - mn); if (opt.inv) q = 1 - q; return interp(q); };
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${opt.titulo || ''}">`;
  GEO.features.forEach(f => {
    const c = f.properties.cod, v = valores[c];
    svg += `<path d="${path(f.geometry)}" fill="${col(v)}" data-c="${c}" data-v="${v ?? ''}"><title>${NOMBRES[c] || c}: ${v == null ? t('sin dato en esta fuente', 'no data in this source') : (opt.fmt ? opt.fmt(v) : nf(v))}</title></path>`;
  });
  svg += '</svg>';
  const leyenda = `<div class="leyenda"><span>${opt.fmt ? opt.fmt(opt.inv ? mx : mn) : nf(opt.inv ? mx : mn)}</span><i style="background:linear-gradient(90deg,${interp(0)},${interp(.5)},${interp(1)})"></i><span>${opt.fmt ? opt.fmt(opt.inv ? mn : mx) : nf(opt.inv ? mn : mx)}</span><b class="nd"></b><span>${t('Sin dato', 'No data')}</span></div>`;
  cont.innerHTML = svg + leyenda;
  const tip = cont.parentElement.querySelector('.tip');
  cont.querySelectorAll('path').forEach(p => {
    p.addEventListener('mousemove', e => { if (!tip) return; const v = p.dataset.v; tip.hidden = false; tip.textContent = `${NOMBRES[p.dataset.c]}: ${v === '' ? t('sin dato', 'no data') : (opt.fmt ? opt.fmt(+v) : nf(+v))}`; const r = cont.getBoundingClientRect(); tip.style.left = (e.clientX - r.left + 12) + 'px'; tip.style.top = (e.clientY - r.top + 12) + 'px'; });
    p.addEventListener('mouseleave', () => tip && (tip.hidden = true));
    if (opt.click) p.addEventListener('click', () => opt.click(p.dataset.c));
  });
}
function interp(q) { // E6EFFD -> 3366CC -> 002A5C
  const a = [[230, 239, 253], [51, 102, 204], [0, 42, 92]]; q = Math.max(0, Math.min(1, q));
  const [p, r] = q < .5 ? [a[0], a[1]] : [a[1], a[2]]; const u = q < .5 ? q * 2 : (q - .5) * 2;
  return `rgb(${p.map((x, i) => Math.round(x + (r[i] - x) * u)).join(',')})`;
}
function ranking(id, valores, opt = {}) {
  const el = document.getElementById(id); if (!el) return;
  const filas = Object.entries(valores).filter(([c, v]) => v != null && NOMBRES[c]).sort((a, b) => b[1] - a[1]);
  const mx = Math.max(...filas.map(f => f[1]));
  el.innerHTML = filas.map(([c, v]) => `<div class="rk"><span>${NOMBRES[c]}</span><i style="width:${(100 * v / mx).toFixed(1)}%"></i><b>${opt.fmt ? opt.fmt(v) : nf(v)}</b></div>`).join('');
}

/* ---------- Secciones ---------- */
function laboral() {
  const m = D.lab_mensual['Total Nacional'];
  const per = Object.keys(m.TD).sort();
  const ind = $('#lab-ind').value;
  const cab = D.lab_mensual['Total Cabeceras'];
  linea('g-lab-mensual', per, [{ n: t('Total nacional', 'National total'), v: per.map(p => m[ind][p]) }, { n: t('Cabeceras', 'Urban centres'), v: per.map(p => val(cab[ind], p)), c: C.ama }], { y: '%' });
  const an = D.lab_anual['Total Nacional'], anos = Object.keys(an).sort();
  linea('g-lab-anual', anos, [{ n: 'TGP', v: anos.map(a => an[a].TGP) }, { n: 'TO', v: anos.map(a => an[a].TO), c: C.verde }, { n: 'TD', v: anos.map(a => an[a].TD), c: C.rojo }], { y: '%', anual: true });
  // departamentos
  const a = $('#lab-ano').value, ii = $('#lab-dind').value, g = $('#lab-grupo').value;
  const dep = D.lab_depto[g], vals = {};
  Object.entries(dep).forEach(([c, d]) => vals[c] = d[ii] ? d[ii][a] : null);
  mapa('m-lab', vals, { titulo: ii, fmt: v => nf(v) + '%', click: c => labDepto(c) });
  ranking('r-lab', vals, { fmt: v => nf(v) + '%' });
  labDepto($('#lab-dsel').value);
  // brecha de género
  const h = D.lab_depto.hombres, mu = D.lab_depto.mujeres, gap = {};
  Object.keys(h).forEach(c => { const x = val(h[c][ii], a), y = val(mu[c][ii], a); gap[c] = x != null && y != null ? y - x : null; });
  ranking('r-lab-gen', gap, { fmt: v => (v > 0 ? '+' : '') + nf(v) + ' p.p.' });
  // informalidad
  const inf = D.informalidad, pi = Object.keys(inf['Total nacional']).sort();
  linea('g-inf', pi, ['Total nacional', '13 Ciudades y A.M.', '23 Ciudades y A.M.'].map((k, i) => ({ n: tr(k), v: pi.map(p => val(inf[k], p)) })), { y: '%' });
  const ult = pi[pi.length - 1], vi = {};
  Object.keys(inf).filter(k => !/Total|Ciudades/.test(k)).forEach(k => vi[k] = inf[k][ult]);
  const el = $('#r-inf'); const fl = Object.entries(vi).sort((x, y) => y[1] - x[1]); const mx = fl[0][1];
  el.innerHTML = fl.map(([k, v]) => `<div class="rk"><span>${k}</span><i style="width:${100 * v / mx}%"></i><b>${nf(v)}%</b></div>`).join('');
  $('#inf-ult').textContent = ult;
  // mandatos
  tablaMandatos();
}
function labDepto(c) {
  if (!c || !D.lab_depto.total[c]) return; $('#lab-dsel').value = c;
  const anos = rango(2007, 2025), d = D.lab_depto.total[c], cb = D.lab_depto.cabeceras[c], ru = D.lab_depto.rural[c];
  const ii = $('#lab-dind').value;
  linea('g-lab-depto', anos, [{ n: t('Total', 'Total'), v: anos.map(a => val(d[ii], a)) }, { n: t('Cabeceras', 'Urban centres'), v: anos.map(a => val(cb && cb[ii], a)), c: C.ama }, { n: t('Centros poblados y rural disperso', 'Rural areas'), v: anos.map(a => val(ru && ru[ii], a)), c: C.verde }], { y: '%', anual: true });
  $('#lab-dnom').textContent = NOMBRES[c];
}
function tablaMandatos() {
  const m = D.lab_mensual['Total Nacional'];
  const filas = MANDATOS.map(md => {
    const ps = Object.keys(m.TD).filter(p => p >= md.i && p <= md.f);
    const prom = k => { const v = ps.map(p => m[k][p]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b) / v.length : null; };
    return `<tr><td>${md.n}</td><td>${md.i.slice(0, 4)}–${md.f.slice(0, 4)}</td><td>${ps.length} / 48</td><td>${nf(prom('TGP'))}</td><td>${nf(prom('TO'))}</td><td>${nf(prom('TD'))}</td></tr>`;
  }).join('');
  $('#t-mandatos tbody').innerHTML = filas;
}
function pobreza() {
  const P = D.pob_nac, anos = rango(2012, 2025).map(String);
  const dom = ['Nacional', 'Cabeceras', 'Centros poblados y rural disperso'];
  const nd = [t('Nacional', 'National'), t('Cabeceras', 'Urban centres'), t('Centros poblados y rural disperso', 'Rural areas')];
  const ind = $('#pob-ind').value;
  linea('g-pob', anos, dom.map((k, i) => ({ n: nd[i], v: anos.map(a => val(P[ind][k], a)) })), { y: ind === 'Gini' ? t('Coeficiente (0–1)', 'Coefficient (0–1)') : '%', anual: true, d: ind === 'Gini' ? 3 : 1, dEje: ind === 'Gini' ? 2 : 0 });
  linea('g-brecha', anos, [{ n: t('Brecha (FGT1), pobreza monetaria', 'Gap (FGT1), poverty'), v: anos.map(a => val(P.Brecha_PM.Nacional, a)) }, { n: t('Severidad (FGT2), pobreza monetaria', 'Severity (FGT2), poverty'), v: anos.map(a => val(P.Severidad_PM.Nacional, a)), c: C.rojo }], { anual: true, d: 1 });
  // ingreso y líneas (monetario)
  const sel = $('#pob-dom').value;
  linea('g-ing', anos, [{ n: t('Ingreso per cápita de la unidad de gasto', 'Per capita income of the spending unit'), v: anos.map(a => defl(val(P.Ingpc[sel], a), +a)) },
    { n: t('Línea de pobreza (LP)', 'Poverty line (PL)'), v: anos.map(a => defl(val(P.LP[sel], a), +a)), c: C.rojo },
    { n: t('Línea de pobreza extrema (LI)', 'Extreme poverty line (EPL)'), v: anos.map(a => defl(val(P.LI[sel], a), +a)), c: C.ama, dash: [5, 4] }],
    { anual: true, cero: true, fmt: cop, fmtEje: v => (v / 1000).toLocaleString(lang() === 'en' ? 'en-US' : 'es-CO') + t(' mil', 'k') });
  // ciudades
  const ciu = Object.keys(P.PM).filter(k => !dom.includes(k) && !/13 ciudades|Otras/.test(k));
  const ac = $('#pob-ano').value, vc = {};
  ciu.forEach(k => vc[k] = val(P[ind === 'Gini' ? 'Gini' : ind][k], ac));
  const el = $('#r-ciu'); const fl = Object.entries(vc).filter(x => x[1] != null).sort((a, b) => b[1] - a[1]); const mx = fl.length ? fl[0][1] : 1;
  el.innerHTML = fl.map(([k, v]) => `<div class="rk"><span>${k}</span><i style="width:${100 * v / mx}%"></i><b>${nf(v, ind === 'Gini' ? 3 : 1)}</b></div>`).join('') || `<p class="nota">${t('Sin datos para este año.', 'No data for this year.')}</p>`;
  // departamentos 2021-2025
  const ad = $('#pobd-ano').value, idd = $('#pobd-ind').value, vd = {};
  Object.entries(D.pob_dep[idd]).forEach(([c, s]) => { if (c !== '00') vd[c] = idd === 'Ingpc' || idd === 'LP' || idd === 'LI' ? defl(val(s, ad), +ad) : val(s, ad); });
  const mon = ['Ingpc', 'LP', 'LI'].includes(idd);
  mapa('m-pob', vd, { fmt: mon ? cop : v => nf(v, idd === 'Gini' ? 3 : 1) + (idd === 'Gini' ? '' : '%'), inv: false });
  ranking('r-pob', vd, { fmt: mon ? cop : v => nf(v, idd === 'Gini' ? 3 : 1) });
  const sx = P.PM_sexo;
  $('#pob-sexo').innerHTML = Object.entries(sx).map(([k, v]) => `<tr><td>${k}</td>${['2024', '2025'].map(a => `<td>${nf(v[a].hombres)}</td><td>${nf(v[a].mujeres)}</td>`).join('')}</tr>`).join('');
}
function ipm() {
  const I = D.ipm_nac, anos = rango(2010, 2025).map(String);
  const ks = Object.keys(I.dominios);
  linea('g-ipm', anos, ks.map((k, i) => ({ n: tr(k), v: anos.map(a => val(I.dominios[k], a)) })), { y: '%', anual: true });
  const rg = Object.keys(I.regiones);
  linea('g-ipm-reg', anos, rg.map((k, i) => ({ n: k, v: anos.map(a => val(I.regiones[k], a)) })), { y: '%', anual: true });
  const a = $('#ipm-ano').value, z = $('#ipm-zona').value, v = {};
  Object.entries(D.ipm_dep).forEach(([c, s]) => v[c] = s[a] ? s[a][z] : null);
  mapa('m-ipm', v, { fmt: x => nf(x) + '%', click: c => ipmDepto(c) });
  ranking('r-ipm', v, { fmt: x => nf(x) + '%' });
  ipmDepto($('#ipm-dsel').value);
}
function ipmDepto(c) {
  $('#ipm-dsel').value = c; const a = $('#ipm-ano').value;
  const pr = c === '00' ? D.ipm_privaciones_nac.Nacional : D.ipm_privaciones_dep[c]; if (!pr) return;
  const ks = Object.keys(pr).sort((x, y) => (pr[y][a] || 0) - (pr[x][a] || 0));
  linea('g-priv', ks, [{ n: (c === '00' ? t('Nacional', 'National') : NOMBRES[c]) + ' ' + a, v: ks.map(k => val(pr[k], a)) }], { tipo: 'bar', cero: true, y: t('% de hogares', '% of households') });
}
function salud() {
  const A = D.aseg_admin, anos = rango(2013, 2026).map(String);
  linea('g-aseg', anos, [{ n: t('Cobertura (afiliados / población)', 'Coverage (enrollees / population)'), v: anos.map(a => A['00'][a] ? A['00'][a].cobertura : null) }], { y: '%', anual: true, d: 2 });
  linea('g-reg', anos, [{ n: t('Contributivo', 'Contributory'), v: anos.map(a => A['00'][a] ? A['00'][a].contributivo / 1e6 : null) }, { n: t('Subsidiado', 'Subsidised'), v: anos.map(a => A['00'][a] ? A['00'][a].subsidiado / 1e6 : null), c: C.verde }, { n: t('Excepción y especiales', 'Exception regimes'), v: anos.map(a => A['00'][a] ? A['00'][a].excepcion / 1e6 : null), c: C.ama }], { y: t('Millones de personas', 'Million people'), anual: true, d: 2, cero: true });
  const a = $('#aseg-ano').value, v = {};
  Object.entries(A).forEach(([c, s]) => { if (c !== '00') v[c] = s[a] ? s[a].cobertura : null; });
  mapa('m-aseg', v, { fmt: x => nf(x) + '%' });
  ranking('r-aseg', v, { fmt: x => nf(x) + '%' });
  $('#aseg-corte').textContent = A['00'][a] ? A['00'][a].corte.replace(/(\d{4})(\d{2})/, '$1-$2') : '—';
  const S = D.seg_social_ocupados, pk = Object.keys(S.nacional.porcentajes['Afiliada a salud']).sort();
  linea('g-ss', pk, [{ n: t('Ocupados afiliados a salud', 'Employed enrolled in health'), v: pk.map(p => S.nacional.porcentajes['Afiliada a salud'][p]) },
    { n: t('Régimen contributivo', 'Contributory'), v: pk.map(p => S.nacional.porcentajes['Régimen contributivo'][p]), c: C.azul },
    { n: t('Régimen subsidiado', 'Subsidised'), v: pk.map(p => S.nacional.porcentajes['Régimen subsidiado'][p]), c: C.verde },
    { n: t('Cotiza a pensión', 'Pension contributor'), v: pk.map(p => S.nacional.porcentajes['Cotiza a pensión'][p]), c: C.rojo, dash: [5, 4] }], { y: t('% de la población ocupada', '% of employed'), cero: true });
  const pv = D.ipm_privaciones_nac, aa = rango(2010, 2025).map(String);
  linea('g-ipm-salud', aa, Object.keys(pv).map((k, i) => ({ n: tr(k), v: aa.map(x => val(pv[k]['Sin aseguramiento en salud'], x)) })), { y: t('% de hogares', '% of households'), anual: true });
}
function todo() { avisoMonetario(); laboral(); pobreza(); ipm(); salud(); }

/* ---------- Navegación, idioma, tema ---------- */
function nav() {
  const tabs = $$('.tabs button');
  const show = id => {
    $$('main > section').forEach(s => s.hidden = s.id !== id);
    tabs.forEach(b => b.setAttribute('aria-selected', b.dataset.t === id));
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    window.scrollTo({ top: 0 });
    Object.values(charts).forEach(c => c.resize());
  };
  tabs.forEach(b => b.addEventListener('click', () => show(b.dataset.t)));
  const esSeccion = k => { const el = k && document.getElementById(k); return !!el && el.tagName === 'SECTION'; };
  const h = location.hash.slice(1); show(esSeccion(h) ? h : 'resumen');
  window.addEventListener('hashchange', () => { const k = location.hash.slice(1); if (esSeccion(k)) show(k); });
  $('#btn-lang').addEventListener('click', () => {
    document.documentElement.lang = lang() === 'es' ? 'en' : 'es';
    try { localStorage.setItem('geih-lang', document.documentElement.lang); } catch (e) {}
    $('#btn-lang').textContent = lang() === 'es' ? 'English' : 'Español'; todo();
  });
  $('#btn-cop').addEventListener('change', e => { constantes = e.target.checked; todo(); });
  $('#btn-mand').addEventListener('change', e => { verMandatos = e.target.checked; Object.values(charts).forEach(c => c.update()); });
  $$('select[data-r]').forEach(s => s.addEventListener('change', () => ({ lab: laboral, pob: pobreza, ipm: ipm, salud: salud })[s.dataset.r]()));
  $('#lab-dsel').addEventListener('change', e => labDepto(e.target.value));
  $('#ipm-dsel').addEventListener('change', e => ipmDepto(e.target.value));
}
function opciones() {
  const ops = (id, arr, sel) => { const s = $(id); if (!s) return; s.innerHTML = arr.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); if (sel) s.value = sel; };
  ops('#lab-ano', rango(2007, 2025).reverse().map(a => [a, a]), '2025');
  ops('#lab-dsel', Object.keys(D.lab_depto.total).sort((a, b) => NOMBRES[a].localeCompare(NOMBRES[b])).map(c => [c, NOMBRES[c]]), '05');
  ops('#pob-ano', rango(2012, 2025).reverse().map(a => [a, a]), '2025');
  ops('#pobd-ano', rango(2021, 2025).reverse().map(a => [a, a]), '2025');
  ops('#ipm-ano', rango(2018, 2025).reverse().map(a => [a, a]), '2025');
  ops('#ipm-dsel', [['00', 'Nacional']].concat(Object.keys(D.ipm_dep).sort((a, b) => NOMBRES[a].localeCompare(NOMBRES[b])).map(c => [c, NOMBRES[c]])), '00');
  ops('#aseg-ano', rango(2013, 2026).reverse().map(a => [a, a]), '2025');
}
function cifrasClave() {
  const an = D.lab_anual['Total Nacional']['2025'], P = D.pob_nac, I = D.ipm_nac.dominios.Nacional, A = D.aseg_admin['00']['2025'];
  const m = D.lab_mensual['Total Nacional'].TD, ult = Object.keys(m).sort().pop();
  const set = (k, v) => $$(`[data-k="${k}"]`).forEach(e => e.textContent = v);
  set('td25', nf(an.TD)); set('tdult', nf(m[ult])); set('ult', ult); set('pm25', nf(P.PM.Nacional['2025'])); set('pm24', nf(P.PM.Nacional['2024']));
  set('pme25', nf(P.PME.Nacional['2025'])); set('gini25', nf(P.Gini.Nacional['2025'], 3)); set('ipm25', nf(I['2025'])); set('ipm10', nf(I['2010']));
  set('aseg25', nf(A.cobertura)); set('pmr25', nf(P.PM['Centros poblados y rural disperso']['2025'])); set('pmc25', nf(P.PM.Cabeceras['2025']));
  set('gen', D.meta.generado);
}
async function init() {
  try { const l = localStorage.getItem('geih-lang'); if (l) document.documentElement.lang = l; } catch (e) {}
  $('#btn-lang').textContent = lang() === 'es' ? 'English' : 'Español';
  const VER = document.documentElement.dataset.version || '1';  // evita respuestas antiguas guardadas en caché
  const leer = u => fetch(u + '?v=' + VER, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(u + ' (HTTP ' + r.status + ')'); return r.json(); });
  [D, GEO] = await Promise.all([leer('data/datos.json'), leer('data/departamentos.geojson')]);
  opciones(); nav(); cifrasClave(); todo();
}
document.addEventListener('DOMContentLoaded', () => init().catch(e => { console.error(e); const b = $('#error'); if (b) { b.hidden = false; const d = b.querySelector('.det'); if (d) d.textContent = String(e.message || e); } }));
})();
