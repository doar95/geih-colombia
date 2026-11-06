/* Trabajo, protección y contribución (microdatos GEIH 2025-2026).
   Datos: data/trabajo.json (generado por scripts/03_trabajo.py).
   Solo BUSCA cifras precalculadas y calcula porcentajes entre cifras publicadas.
   Nunca suma celdas ni calcula una cifra reservada a partir de otras. */
(function () {
'use strict';
const $ = s => document.querySelector(s);
let J, G, sucio = true, vista = 'flujo', graficos = {};
const COD = { P: -1, C: -2, NA: -3 };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const T = (a, b) => G.t(a, b);
const es = () => G.lang() === 'es';
const css = n => getComputedStyle(document.body).getPropertyValue(n).trim();
const par = x => es() ? x[0] : x[1];

const PER = { a: ['2025', '2025'], b: ['Enero–agosto de 2025', 'January–August 2025'], c: ['Enero–agosto de 2026', 'January–August 2026'] };
const TER = { n: ['Nacional', 'National'], k: ['Cabeceras', 'Urban centres'], r: ['Rural', 'Rural'], D: ['Departamento (solo 2025)', 'Department (2025 only)'] };
const FIL = {
  s: { n: ['Sexo al nacer', 'Sex at birth'], v: [['Hombres', 'Men'], ['Mujeres', 'Women']] },
  e: { n: ['Edad', 'Age'], v: [['15–28', '15–28'], ['29–44', '29–44'], ['45–64', '45–64'], ['65 o más', '65 or over']] },
  u: { n: ['Educación', 'Education'], v: [['Ninguno', 'None'], ['Primaria', 'Primary'], ['Secundaria', 'Lower secondary'], ['Media', 'Upper secondary'], ['Superior', 'Tertiary']] },
  p: { n: ['Posición ocupacional', 'Employment status'], v: [['Empleado particular', 'Private employee'], ['Empleado del gobierno', 'Government employee'], ['Doméstico o jornalero', 'Domestic or day labourer'], ['Cuenta propia', 'Own-account'], ['Patrón o empleador', 'Employer'], ['Sin remuneración u otro', 'Unpaid or other']] },
  m: { n: ['Rama de actividad', 'Industry'], v: [['Agro', 'Agriculture'], ['Minas y servicios públicos', 'Mining and utilities'], ['Manufactura', 'Manufacturing'], ['Construcción', 'Construction'], ['Comercio', 'Retail and repair'], ['Transporte', 'Transport'], ['Alojamiento y comida', 'Accommodation and food'], ['Información, finanzas y profesionales', 'Information, finance and professional'], ['Gobierno, educación y salud', 'Government, education and health'], ['Otros servicios y hogares', 'Other services and households']] },
  f: { n: ['Formal o informal', 'Formal or informal'], v: [['Formal', 'Formal'], ['Informal', 'Informal']] }
};
const ORDEN = ['s', 'e', 'u', 'p', 'm', 'f'];
const TR_SM = [['Menos de 0,5', 'Under 0.5'], ['0,5–0,95', '0.5–0.95'], ['0,95–1,05 (alrededor de un mínimo)', '0.95–1.05 (around one minimum)'], ['1,05–2', '1.05–2'], ['2–4', '2–4'], ['Más de 4', 'Over 4'], ['Sin ingreso o sin dato', 'No income or no data']];
const TR_H = ['<10', '10–19', '20–29', '30–39', '40–47', '48', '49–59', '60+'];
const J3 = [['Menos de 20 h', 'Under 20 h'], ['20 a 47 h', '20 to 47 h'], ['48 h o más', '48 h or more']];
const RAMPA = ['#C5D6F5', '#8FB0EC', '#5C8BDD', '#3366CC', '#1F4E99', '#002A5C', '#9A9A9A'];
const IND = [
  { id: 'tgp', n: 'ft', d: 'pet', t: ['Tasa global de participación (TGP)', 'Participation rate (TGP)'], g: 'Mercado laboral' },
  { id: 'to', n: 'oc', d: 'pet', t: ['Tasa de ocupación (TO)', 'Employment rate (TO)'] },
  { id: 'td', n: 'ds', d: 'ft', t: ['Tasa de desocupación (TD)', 'Unemployment rate (TD)'] },
  { id: 'inf', n: 'inf', d: 'oc', t: ['Informalidad', 'Informality'] },
  { id: 'cot', n: 'cot', d: 'oc', t: ['Cotizan a pensión', 'Contribute to a pension'] },
  { id: 'sal', n: 'sal', d: 'oc', t: ['Salud, régimen contributivo', 'Health, contributory scheme'] },
  { id: 'afs', n: 'afs', d: 'oc', t: ['Afiliados a salud', 'Enrolled in health'] },
  { id: 'arl', n: 'arl', d: 'oc', t: ['Riesgos laborales', 'Occupational risk insurance'] },
  { id: 'caj', n: 'caj', d: 'oc', t: ['Caja de compensación', 'Family compensation fund'] },
  { id: 'j0', n: 'j0', d: 'oc', t: ['Menos de 20 horas', 'Under 20 hours'] },
  { id: 'j2', n: 'j2', d: 'oc', t: ['48 horas o más', '48 hours or more'] },
  { id: 'h49', n: 'h49', d: 'oc', t: ['Más de 48 horas', 'Over 48 hours'] },
  { id: 'leg', n: 'leg', d: 'oc', t: ['Por encima de la jornada legal', 'Above the legal maximum'] },
  { id: 'sub', n: 'sub', d: 'oc', t: ['Subempleo por insuficiencia de horas', 'Time-related underemployment'] },
  { id: 'seg', n: 'seg', d: 'oc', t: ['Con segundo empleo', 'With a second job'] },
  { id: 'i0', n: 'i0', d: 'oc', t: ['Menos de 0,5 salarios mínimos', 'Under 0.5 minimum wages'] },
  { id: 'i2', n: 'i2', d: 'oc', t: ['Alrededor de un salario mínimo', 'Around one minimum wage'] },
  { id: 'i5', n: 'i5', d: 'oc', t: ['Más de 4 salarios mínimos', 'Over 4 minimum wages'] },
  { id: 'o65s', n: 'o65s', d: 'o65', t: ['Ocupados de 65+ sin pensión ni cotización', 'Employed 65+ with no pension or contribution'] },
  { id: 'pen', n: 'pen', d: 'oc', t: ['Pensionados que trabajan', 'Working pensioners'] },
  { id: 'infs', n: 'infs', d: 'inf', t: ['Informales con salud subsidiada', 'Informal with subsidised health'] }
];
const S = { per: 'a', ter: 'D', dpto: '27', s: '', e: '', u: '', p: '', m: '', f: '' };
const PA = { per: 'a', ter: 'n', dpto: '27', s: '1', e: '', u: '', p: '', m: '', f: '1' };
const PB = { per: 'a', ter: 'n', dpto: '27', s: '1', e: '', u: '', p: '', m: '', f: '0' };
let selDeptos = ['27', '11', '05'], indComp = 'inf', compComp = 'sm', ordenRama = { k: 'oc', asc: false };

/* ---------- Búsqueda ---------- */
const terStr = st => st.ter === 'D' ? 'D' + st.dpto : st.ter;
const filtrosDe = st => ORDEN.filter(f => st[f] !== '').map(f => f + st[f]).sort();
const claveDe = (st, extra) => [st.per, terStr(st)].concat(filtrosDe(Object.assign({}, st, extra || {}))).join('.');
function celda(k, n) {
  const f = J.estados[k]; if (!f) return 'NA';
  const v = f[J._i[n]];
  return v === COD.P ? 'P' : v === COD.C ? 'C' : v === COD.NA ? 'NA' : v * J.meta.unidad;
}
function pct(k, n, d) {
  const a = celda(k, n), b = celda(k, d);
  if (typeof a === 'string') return a;
  if (typeof b === 'string') return b;
  return b > 0 ? 100 * a / b : 'NA';
}
const extra = (k, i) => { const f = J.estados[k]; return f ? f[J.medidas.length + i] : null; };  // 0 n PET, 1 n ocupados, 2 horas, 3 ingreso
const num = v => typeof v === 'number';
const fP = v => num(v) ? G.nf(v, 1) + ' %' : v === 'NA' ? '—' : v;
function fM(v) {
  if (!num(v)) return v === 'NA' ? '—' : v;
  return v >= 1e5 ? G.nf(v / 1e6, 2) + T(' M', ' M') : G.nf(v / 1e3, 1) + T(' mil', ' k');
}
const conNum = (v, sufijo) => num(v) ? ' · ' + fM(v) + (sufijo || '') : '';
const cop = v => 'COP ' + Math.round(v).toLocaleString(es() ? 'es-CO' : 'en-US');
const fH = v => v > 0 ? G.nf(v, 0) + ' h' : 'P';
const fCop = v => v > 0 ? cop(v) : 'P';
const nomPer = st => par(PER[st.per]);
const lugar = st => st.ter === 'D' ? G.NOMBRES[st.dpto] : par(TER[st.ter]);
function etiqueta(st) {
  const p = ORDEN.filter(f => st[f] !== '').map(f => par(FIL[f].v[+st[f]]));
  return [lugar(st), nomPer(st)].concat(p).join(' · ');
}

/* ---------- Filtros ---------- */
function reparar(st) {
  if (st.ter === 'D') st.per = 'a';
  let tries = 0;
  while (!J.estados[claveDe(st)] && tries < 8) {
    const act = ORDEN.filter(f => st[f] !== '');
    if (!act.length) break;
    st[act[act.length - 1]] = '';
    tries++;
  }
}
function opcion(v, t, off) { return `<option value="${esc(v)}"${off ? ' disabled' : ''}>${esc(t)}${off ? T(' (no disponible)', ' (not available)') : ''}</option>`; }
function construir(cont, st, alCambiar, pref, soloTerritorio) {
  const h = [];
  const campo = (id, et, ops, val, dis) => h.push(`<label><span>${esc(et)}</span><select id="${pref}${id}" data-k="${id}"${dis ? ' disabled' : ''}>${ops}</select></label>`);
  campo('per', T('Período', 'Period'), Object.keys(PER).map(k => opcion(k, par(PER[k]), st.ter === 'D' && k !== 'a')).join(''), st.per);
  campo('ter', T('Territorio', 'Territory'), Object.keys(TER).map(k => opcion(k, par(TER[k]), k === 'D' && st.per !== 'a')).join(''), st.ter);
  const deps = J.dptos.slice().sort((a, b) => G.NOMBRES[a].localeCompare(G.NOMBRES[b], 'es'));
  campo('dpto', T('Departamento', 'Department'), deps.map(c => opcion(c, G.NOMBRES[c])).join(''), st.dpto, st.ter !== 'D');
  if (!soloTerritorio) ORDEN.forEach(f => {
    const prueba = v => J.estados[claveDe(st, { [f]: v })];
    const ops = opcion('', T('Todos', 'All')) + FIL[f].v.map((x, i) => opcion(String(i), par(x), !prueba(String(i)))).join('');
    campo(f, par(FIL[f].n), ops, st[f]);
  });
  cont.innerHTML = h.join('');
  cont.querySelectorAll('select').forEach(s => {
    s.value = st[s.dataset.k];
    s.addEventListener('change', e => { st[s.dataset.k] = e.target.value; reparar(st); alCambiar(); });
  });
}
function avisosFiltros() {
  const av = [];
  if (S.per !== 'a') av.push(T('<b>Departamento desactivado.</b> Por representatividad, solo existe con el año completo 2025.', '<b>Department disabled.</b> For representativeness, it exists only for full-year 2025.'));
  if (S.ter === 'n') av.push(T('<b>Filtros.</b> A nivel nacional puede combinar hasta dos: sexo con edad, educación, posición, rama o formalidad; formalidad con edad, educación, posición o rama; y edad con educación.', '<b>Filters.</b> At national level you can combine up to two: sex with age, education, status, industry or formality; formality with age, education, status or industry; and age with education.'));
  else av.push(T('<b>Filtros.</b> En cabeceras, rural y departamentos se usa un filtro a la vez: sus celdas cruzadas quedarían demasiado pequeñas para publicarlas.', '<b>Filters.</b> Urban, rural and departmental levels use one filter at a time: crossed cells would be too small to publish.'));
  if (S.p !== '' || S.m !== '' || S.f !== '') av.push(T('<b>Universo.</b> Posición, rama y formalidad solo existen para ocupados: las cifras previas (población, PET, FT) no aplican.', '<b>Universe.</b> Status, industry and formality exist only for the employed: earlier figures (population, working age, labour force) do not apply.'));
  else if (S.e !== '' || S.u !== '') av.push(T('<b>Universo.</b> Edad y educación se refieren a personas de 15 años o más.', '<b>Universe.</b> Age and education refer to people aged 15 or over.'));
  const n = extra(claveDe(S), 1);
  if (n !== null && n < 300) av.push(T('<b>Precisión.</b> Esta selección tiene menos de 300 encuestas de ocupados: la mayoría de sus cifras aparece como P.', '<b>Precision.</b> This selection has fewer than 300 employed interviews: most figures show as P.'));
  $('#tr-avisos').innerHTML = av.map(x => `<li>${x}</li>`).join('');
}

/* ---------- Gráficos de barras (Chart.js) ---------- */
const marcas = { id: 'trRes', afterDatasetsDraw(ch) {
  const { ctx, scales } = ch, hz = ch.options.indexAxis === 'y';
  ctx.save(); ctx.fillStyle = css('--sub'); ctx.font = '600 11px Work Sans, sans-serif'; ctx.textBaseline = 'middle';
  ch.data.datasets.forEach((ds, i) => {
    const me = ch.getDatasetMeta(i);
    (ds.res || []).forEach((r, j) => {
      if (!r || !me.data[j] || me.hidden) return;
      if (hz) ctx.fillText(r, scales.x.getPixelForValue(0) + 4, me.data[j].y);
      else { ctx.textAlign = 'center'; ctx.fillText(r, me.data[j].x, scales.y.getPixelForValue(0) - 8); }
    });
  });
  ctx.restore();
} };
function barras(id, labels, series, op) {
  op = op || {};
  const el = document.getElementById(id); if (!el) return;
  if (graficos[id]) graficos[id].destroy();
  const hz = !!op.horizontal, apilado = !!op.apilado;
  const eje = v => (op.fmtEje ? op.fmtEje(v) : op.fmt ? op.fmt(v) : G.nf(v, 0) + ' %');
  graficos[id] = new Chart(el, {
    type: 'bar', plugins: [marcas],
    data: { labels, datasets: series.map(s => ({ label: s.n, data: s.v.map(v => num(v) ? v : null), res: s.v.map(v => num(v) ? null : (v === 'NA' ? null : v)), backgroundColor: s.c, borderColor: s.b || s.c, borderWidth: s.b ? 1 : 0, borderRadius: apilado ? 0 : 3, borderSkipped: false, categoryPercentage: .82, barPercentage: .92 })) },
    options: {
      indexAxis: hz ? 'y' : 'x', responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', axis: hz ? 'y' : 'x', intersect: false },
      plugins: { legend: { display: series.length > 1, position: 'bottom', labels: { color: css('--texto'), boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${op.fmt ? op.fmt(c.parsed[hz ? 'x' : 'y']) : fP(c.parsed[hz ? 'x' : 'y'])}` } } },
      scales: {
        x: { stacked: apilado, beginAtZero: true, max: apilado && hz ? 100 : undefined, ticks: Object.assign({ color: css(hz ? '--sub' : '--texto'), font: { size: 11 }, maxRotation: 0, autoSkip: !hz ? false : true }, hz ? { callback: eje } : {}), grid: { display: hz, color: css('--borde') } },
        y: { stacked: apilado, beginAtZero: true, ticks: Object.assign({ color: css(hz ? '--texto' : '--sub'), font: { size: 11 } }, hz ? { autoSkip: false } : { callback: eje }), grid: { display: !hz, color: css('--borde') } }
      }
    }
  });
}
const altoH = (id, n, f) => { const c = document.getElementById(id); if (c) c.style.height = Math.max(170, n * (f || 40) + 80) + 'px'; };
const tabla = (cab, filas) => `<div class="tabla"><table><thead><tr>${cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${f.map((c, i) => `<td>${i === 0 ? esc(c) : c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const kpi = (v, t, c) => `<div class="kpi${c ? ' ' + c : ''}"><b>${v}</b><span>${esc(t)}</span></div>`;
const ley = () => `<p class="tr-ley">${T('<b>P</b> = precisión insuficiente (menos de 300 encuestas en el denominador). <b>C</b> = reservada por confidencialidad (Ley 79 de 1993).', '<b>P</b> = insufficient precision (fewer than 300 interviews in the denominator). <b>C</b> = withheld for confidentiality (Law 79 of 1993).')}</p>`;
const cita = () => `<p class="fuente">${T('Cálculo propio. ', 'Own calculation. ')}<span class="cita-dane">Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co</span></p>`;
const titulo = t => `<p class="tb-sel">${esc(t)}</p>`;
const sinCorr = st => st.per === 'c' ? `<p class="aviso rojo tr-c">${T('<b>Sin corregir.</b> En 2026, el ingreso es el declarado en el módulo Ocupados (<code>INGLABO</code>), sin las correcciones del DANE. No es comparable con 2025, que usa la base corregida.', '<b>Not corrected.</b> In 2026, income is as declared in the Employed module (<code>INGLABO</code>), without DANE\'s corrections. It is not comparable with 2025, which uses the corrected base.')}</p>` : '';

/* ---------- 1. Flujo (Sankey) ---------- */
function flujo(cont) {
  const k = claveDe(S), lab = {
    pt: T('Población total', 'Total population'), men: T('Menores de 15', 'Under 15'), pet: T('Edad de trabajar (PET)', 'Working age'), ft: T('Fuerza de trabajo', 'Labour force'), fft: T('Fuera de la FT', 'Out of labour force'), oc: T('Ocupados', 'Employed'), ds: T('Desocupados', 'Unemployed'), form: 'Formal', inf: 'Informal',
    j0: par(J3[0]), j1: par(J3[1]), j2: par(J3[2]), cot: T('Cotiza a pensión', 'Contributes to pension'), noc: T('No cotiza', 'Does not contribute')
  };
  TR_SM.forEach((x, i) => { lab['i' + i] = (i === 6 ? par(x) : par(x).split(' (')[0] + T(' SM', ' MW')); });
  const L = [['pt', 'men', 'men'], ['pt', 'pet', 'pet'], ['pet', 'ft', 'ft'], ['pet', 'fft', 'fft'], ['ft', 'oc', 'oc'], ['ft', 'ds', 'ds'], ['oc', 'form', 'form'], ['oc', 'inf', 'inf']];
  [0, 1, 2].forEach(i => { L.push(['form', 'j' + i, 'fj' + i], ['inf', 'j' + i, 'nj' + i]); });
  [0, 1, 2].forEach(i => { L.push(['j' + i, 'cot', 'jc' + i], ['j' + i, 'noc', 'jn' + i]); });
  [0, 1, 2, 3, 4, 5, 6].forEach(i => { L.push(['cot', 'i' + i, 'ci' + i], ['noc', 'i' + i, 'ni' + i]); });
  const usados = [], enl = [], max = Math.max(1, ...L.map(l => { const v = celda(k, l[2]); return num(v) ? v : 0; }));
  L.forEach(([a, b, c]) => {
    const v = celda(k, c); if (v === 'NA' || v === 0) return;
    enl.push({ source: a, target: b, value: num(v) ? v : max * .006, res: num(v) ? null : v, c });
    [a, b].forEach(n => { if (!usados.includes(n)) usados.push(n); });
  });
  const nodos = usados.map(id => ({ id, cel: celda(k, id) }));
  cont.innerHTML = titulo(etiqueta(S)) + sinCorr(S) +
    `<p class="tr-p">${T('Cada bloque es un grupo de personas, en millones (M) o miles. Las bandas muestran cómo se reparte cada grupo en la siguiente etapa; solo enlazan etapas contiguas, no siguen a una misma persona de punta a punta. Los bloques con P o C están reservados: su banda tiene un ancho simbólico que no indica tamaño.', 'Each block is a group of people, in millions (M) or thousands. Bands show how each group splits at the next stage; they link adjacent stages only and do not follow one person end to end. Blocks marked P or C are withheld: their band has a symbolic width that shows no size.')}</p>` +
    `<div class="tr-sankey" id="tr-sk" role="img" aria-label="${esc(T('Diagrama de flujo; los mismos valores están en la tabla', 'Flow diagram; the same values are in the table'))}"></div>` + ley() +
    `<details><summary>${T('Ver los bloques en tabla', 'See the blocks in a table')}</summary><div>${tabla([T('Bloque', 'Block'), T('Personas', 'People')], usados.map(id => [lab[id], fM(celda(k, id))]))}</div></details>` + cita();
  const caja = $('#tr-sk');
  if (!window.d3 || !d3.sankey) { caja.innerHTML = `<p class="tb-msg">${T('No se pudo cargar la librería del diagrama. Los valores están en la tabla.', 'The diagram library could not be loaded. Values are in the table.')}</p>`; return; }
  if (!enl.length) { caja.innerHTML = `<p class="tb-msg">${T('Sin cifras publicables para esta selección.', 'No publishable figures for this selection.')}</p>`; return; }
  const W = 1000, H = 660;
  const sk = d3.sankey().nodeId(d => d.id).nodeAlign(d3.sankeyLeft).nodeWidth(12).nodePadding(20).nodeSort(null).size([W - 8, H - 10]);
  const g = sk({ nodes: nodos.map(d => Object.assign({}, d)), links: enl.map(d => Object.assign({}, d)) });
  const pa = d3.sankeyLinkHorizontal();
  const colorN = id => id === 'form' ? css('--azul') : id === 'inf' ? css('--ocre') : id === 'cot' ? css('--verde') : id === 'noc' ? css('--rojo') : css('--azul-osc');
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  g.links.forEach(l => {
    svg += `<path d="${pa(l)}" fill="none" stroke="${l.res ? css('--sub') : colorN(l.source.id === 'oc' || l.source.id === 'form' || l.source.id === 'inf' ? (l.source.id === 'oc' ? l.target.id : l.source.id) : (l.source.id === 'cot' || l.source.id === 'noc') ? l.source.id : 'x')}" stroke-opacity="${l.res ? .55 : .24}" stroke-width="${Math.max(1, l.width)}"${l.res ? ' stroke-dasharray="3 3"' : ''}><title>${esc(lab[l.source.id])} → ${esc(lab[l.target.id])}: ${esc(fM(celda(k, l.c)))}</title></path>`;
  });
  g.nodes.forEach(n => {
    const izq = n.x0 > W * .8, x = izq ? n.x0 - 5 : n.x1 + 5, y = (n.y0 + n.y1) / 2;
    svg += `<rect x="${n.x0}" y="${n.y0}" width="${n.x1 - n.x0}" height="${Math.max(2, n.y1 - n.y0)}" fill="${colorN(n.id)}"><title>${esc(lab[n.id])}: ${esc(fM(n.cel))}</title></rect>`;
    svg += `<text x="${x}" y="${y - 6}" text-anchor="${izq ? 'end' : 'start'}" class="tr-skt"><tspan x="${x}">${esc(lab[n.id])}</tspan><tspan x="${x}" dy="13" font-weight="600">${esc(fM(n.cel))}</tspan></text>`;
  });
  caja.innerHTML = svg + '</svg>';
}

/* ---------- 2. Protección ---------- */
function proteccion(cont) {
  const k = claveDe(S);
  const esc_ = [['sal', T('Salud, régimen contributivo (P6100 = 1)', 'Health, contributory scheme (P6100 = 1)')], ['cot', T('Pensión: cotiza (P6920 = 1)', 'Pension: contributes (P6920 = 1)')], ['arl', T('Riesgos laborales (P6990 = 1)', 'Occupational risks (P6990 = 1)')], ['caj', T('Caja de compensación (P9450 = 1)', 'Compensation fund (P9450 = 1)')]];
  cont.innerHTML = titulo(etiqueta(S)) +
    `<p class="tr-p">${T('De los ocupados, cuántos tienen cada protección. No son escalones acumulativos: cada barra se mide por separado, de manera autodeclarada.', 'Of the employed, how many have each protection. These are not cumulative steps: each bar is measured separately and is self-reported.')}</p>` +
    `<div class="kpis tr-k4">${esc_.map(([n, t]) => kpi(fP(pct(k, n, 'oc')), t + conNum(celda(k, n)))).join('')}</div>` +
    `<div class="panel"><div class="graf" id="tr-pc" style="height:230px"><canvas id="tr-p1"></canvas></div></div>` +
    tabla([T('Protección', 'Protection'), T('Millones de ocupados', 'Employed, millions'), T('% de ocupados', '% of employed')], [[T('Ocupados', 'Employed'), fM(celda(k, 'oc')), '']].concat(esc_.map(([n, t]) => [t, fM(celda(k, n)), fP(pct(k, n, 'oc'))]))) + ley() + cita();
  barras('tr-p1', esc_.map(e => e[1].split(' (')[0]), [{ n: T('% de ocupados', '% of employed'), v: esc_.map(e => pct(k, e[0], 'oc')), c: css('--azul') }], { horizontal: true });
}

/* ---------- 3. Horas ---------- */
function horas(cont) {
  const k = claveDe(S), kF = S.f === '' ? claveDe(S, { f: '0' }) : null, kI = S.f === '' ? claveDe(S, { f: '1' }) : null;
  const hay = kF && J.estados[kF] && J.estados[kI];
  const ser = [{ n: T('Todos', 'All'), v: TR_H.map((_, i) => pct(k, 'h' + i, 'oc')), c: css('--azul-osc') }];
  if (hay) ser.push({ n: 'Formal', v: TR_H.map((_, i) => pct(kF, 'h' + i, 'oc')), c: css('--azul') }, { n: 'Informal', v: TR_H.map((_, i) => pct(kI, 'h' + i, 'oc')), c: css('--ocre') });
  const ind = [['h49', T('Más de 48 horas', 'Over 48 hours')], ['j0', T('Menos de 20 horas', 'Under 20 hours')], ['leg', T('Por encima de la jornada legal', 'Above the legal maximum')], ['sub', T('Subempleo por insuficiencia de horas', 'Time-related underemployment')], ['seg', T('Con segundo empleo', 'With a second job')]];
  const fila = (t, q) => [t, fH(extra(q, 2))].concat(ind.map(i => fP(pct(q, i[0], 'oc'))));
  const filas = [fila(T('Todos', 'All'), k)];
  if (hay) filas.push(fila('Formal', kF), fila('Informal', kI));
  cont.innerHTML = titulo(etiqueta(S)) +
    `<p class="tr-p">${T('Horas <b>normales</b> a la semana en el trabajo principal (<code>P6800</code>), no las de la semana pasada (<code>P6850</code>): la jornada legal se refiere a la jornada habitual. Son autodeclaradas.', '<b>Usual</b> weekly hours in the main job (<code>P6800</code>), not last week\'s (<code>P6850</code>): the legal maximum refers to the usual schedule. They are self-reported.')}</p>` +
    `<div class="kpis tr-k4">${kpi(fH(extra(k, 2)), T('Mediana de horas', 'Median hours'))}${kpi(fP(pct(k, 'h49', 'oc')), T('Más de 48 horas', 'Over 48 hours'))}${kpi(fP(pct(k, 'j0', 'oc')), T('Menos de 20 horas', 'Under 20 hours'))}${kpi(fP(pct(k, 'leg', 'oc')), T('Por encima de la jornada legal', 'Above the legal maximum'))}${kpi(fP(pct(k, 'sub', 'oc')), T('Subempleo por insuficiencia de horas', 'Time-related underemployment'))}${kpi(fP(pct(k, 'seg', 'oc')), T('Con segundo empleo', 'With a second job'))}</div>` +
    `<div class="panel"><div class="graf" style="height:320px"><canvas id="tr-h1"></canvas></div>${hay ? '' : `<p class="fuente">${T('La comparación entre formales e informales no está disponible con este filtro.', 'The formal–informal comparison is not available with this filter.')}</p>`}</div>` +
    tabla([T('Grupo', 'Group'), T('Mediana', 'Median')].concat(ind.map(i => i[1])), filas) +
    `<p class="fuente">${T('Jornada máxima (Ley 2101 de 2021): 46 h desde el 15 de julio de 2024, 44 h desde el 15 de julio de 2025 y 42 h desde el 15 de julio de 2026. La encuesta se fecha por mes: julio se compara con el límite anterior. El límite no aplica por igual a independientes ni a las excepciones legales. Subempleo: quiere trabajar más horas (<code>P7090</code>), está disponible (<code>P7120</code>) y trabaja menos de 48 h; es una definición propia, más estrecha que la subocupación que publica el DANE.', 'Legal maximum (Law 2101 of 2021): 46 h from 15 July 2024, 44 h from 15 July 2025 and 42 h from 15 July 2026. The survey is dated by month: July is compared with the earlier limit. The limit does not apply equally to the self-employed or legal exceptions. Underemployment: wants more hours (<code>P7090</code>), is available (<code>P7120</code>) and works under 48 h; the authors\' definition, narrower than DANE\'s published underemployment.')}</p>` + ley() + cita();
  barras('tr-h1', TR_H, ser);
}

/* ---------- 4. Ingreso frente al salario mínimo ---------- */
function ingreso(cont) {
  const k = claveDe(S), sm = J.meta.sm[S.per === 'c' ? '2026' : '2025'];
  const filasG = [[T('Todos los ocupados', 'All employed'), 'i', 'oc'], [T('Empleados', 'Employees'), 'ie', 'emp'], [T('Independientes y otros', 'Self-employed and others'), 'ii', 'ind'], [par(J3[0]), 'ij0', 'j0'], [par(J3[1]), 'ij1', 'j1'], [par(J3[2]), 'ij2', 'j2']];
  const ser = TR_SM.map((x, i) => ({ n: par(x).split(' (')[0], v: filasG.map(g => pct(k, g[1] + i, g[2])), c: RAMPA[i] }));
  const serH = [{ n: T('% de ocupados', '% of employed'), v: [0, 1, 2, 3, 4, 5, 6].map(i => pct(k, 'ih' + i, 'oc')), c: css('--azul') }];
  const hist = [...Array(13).keys()];
  const et = hist.map(i => i === 12 ? T('3 o más', '3 or more') : G.nf(i * .25, 2) + '–' + G.nf((i + 1) * .25, 2));
  const b = J.meta.controles.puente_2025_pct;
  cont.innerHTML = titulo(etiqueta(S)) + sinCorr(S) +
    `<div class="kpis tr-k4">${kpi(cop(sm), T('Salario mínimo mensual', 'Monthly minimum wage') + (S.per === 'c' ? ' 2026' : ' 2025'))}${kpi(fCop(extra(k, 3)), T('Ingreso mediano de la primera actividad', 'Median income from the main job'))}${kpi(fP(pct(k, 'i2', 'oc')), T('Alrededor de un mínimo (0,95–1,05)', 'Around one minimum (0.95–1.05)'))}${kpi(fP(pct(k, 'i0', 'oc')), T('Menos de 0,5 mínimos', 'Under 0.5 minimums'))}</div>` +
    `<div class="panel"><h3 class="tb-h">${T('Distribución de los ocupados por tramo de salario mínimo', 'Employed by minimum-wage band')}</h3><div class="graf" style="height:370px"><canvas id="tr-i1"></canvas></div></div>` +
    tabla([T('Grupo', 'Group')].concat(TR_SM.map(x => par(x).split(' (')[0])), filasG.map(g => [g[0]].concat(TR_SM.map((_, i) => fP(pct(k, g[1] + i, g[2])))))) +
    `<div class="panel"><h3 class="tb-h">${T('Ingreso por hora frente al mínimo por hora', 'Hourly income against the hourly minimum')}</h3><div class="graf" style="height:300px"><canvas id="tr-i2"></canvas></div><p class="fuente">${T('Ingreso mensual / (horas normales × 5) frente a salario mínimo / (jornada legal × 5), que equivale a 230, 220 o 210 horas al mes.', 'Monthly income / (usual hours × 5) against minimum wage / (legal maximum × 5), equivalent to 230, 220 or 210 hours a month.')}</p></div>` +
    `<details><summary>${T('Histograma de ingreso en salarios mínimos', 'Income histogram in minimum wages')}</summary><div><div class="graf" style="height:300px"><canvas id="tr-i3"></canvas></div><p class="fuente">${T('Tramos de 0,25 salarios mínimos; el último es abierto. Solo ocupados con ingreso informado.', 'Bands of 0.25 minimum wages; the last is open-ended. Only employed with reported income.')}</p></div></details>` +
    `<p class="aviso">${T(`<b>Dos medidas distintas.</b> 2025 usa el ingreso corregido de la primera actividad (<code>impa</code> o <code>impaes</code>); 2026, el declarado (<code>INGLABO</code>), sin corregir. Con datos de 2025, «alrededor de un mínimo» es ${G.nf(b.corregido[2], 1)} % con el corregido y ${G.nf(b.declarado[2], 1)} % con el declarado: no compare ambos años como un cambio real.`, `<b>Two different measures.</b> 2025 uses corrected main-job income (<code>impa</code> or <code>impaes</code>); 2026 uses declared income (<code>INGLABO</code>), not corrected. With 2025 data, "around one minimum" is ${G.nf(b.corregido[2], 1)}% with the corrected measure and ${G.nf(b.declarado[2], 1)}% with the declared one: do not read the two years as a real change.`)}</p>` +
    `<p class="fuente">${T('Salario mínimo: COP 1.423.500 en 2025 (Decreto 1572 de 2024) y COP 1.750.905 en 2026 (Decreto 1469 de 2025). COP significa pesos colombianos; las cifras están en COP corrientes. No se usa ni se aproxima el ingreso base de cotización (IBC).', 'Minimum wage: COP 1,423,500 in 2025 (Decree 1572 of 2024) and COP 1,750,905 in 2026 (Decree 1469 of 2025). COP means Colombian pesos; figures are in current COP. The contribution base income (IBC) is neither used nor approximated.')}</p>` + ley() + cita();
  barras('tr-i1', filasG.map(g => g[0]), ser, { horizontal: true, apilado: true });
  barras('tr-i2', TR_SM.map(x => par(x).split(' (')[0]), serH, { horizontal: true });
  barras('tr-i3', et, [{ n: T('% de ocupados', '% of employed'), v: hist.map(i => pct(k, 'g' + i, 'oc')), c: css('--azul') }]);
}

/* ---------- 5. Deciles ---------- */
const AMB = () => { const e = S.ter === 'D' ? 'D' + S.dpto : S.ter; return J.deciles[e] ? e : 'n'; };
let calc = { ing: '', per: '', amb: null };
function ambitos() {
  return [['n', T('Nacional', 'National')], ['k', T('Cabeceras', 'Urban centres')], ['r', T('Rural', 'Rural')]].concat(J.dptos.slice().sort((a, b) => G.NOMBRES[a].localeCompare(G.NOMBRES[b], 'es')).map(c => ['D' + c, G.NOMBRES[c]]));
}
function lineas(a) {
  const D = G.datos(); if (!D) return null;
  if (a[0] === 'D') { const c = a.slice(1), lp = D.pob_dep.LP[c], li = D.pob_dep.LI[c]; return lp && li ? { lp: lp['2025'], li: li['2025'] } : null; }
  const k = { n: 'Nacional', k: 'Cabeceras', r: 'Centros poblados y rural disperso' }[a];
  return { lp: D.pob_nac.LP[k]['2025'], li: D.pob_nac.LI[k]['2025'] };
}
const dc = (a, d, n) => { const v = J.deciles[a].filas[d][J._d[n]]; return v === COD.P ? 'P' : v === COD.C ? 'C' : v * J.meta.unidad; };
const dp = (a, d, n, q) => { const x = dc(a, d, n), y = dc(a, d, q); return typeof x === 'string' ? x : typeof y === 'string' ? y : y > 0 ? 100 * x / y : '—'; };
function deciles(cont) {
  const a = AMB(), D = J.deciles[a], c = D.cortes;
  const filas = [...Array(10).keys()].map(d => [
    String(d + 1), d === 0 ? cop(0) : cop(c[d - 1]), d === 9 ? T('sin límite', 'no limit') : cop(c[d]), cop(D.medias[d]), fM(dc(a, d, 'per')), fM(dc(a, d, 'hog')), fP(dp(a, d, 'inf', 'ocu')), fP(dp(a, d, 'cot', 'ocu')), fP(dp(a, d, 'pre', 'hog')), fP(dp(a, d, 'val', 'hog')), fP(dp(a, d, 'veh', 'hog')), fP(dp(a, d, 'ren', 'hog'))]);
  if (!calc.amb) calc.amb = a;
  const nomA = (ambitos().find(x => x[0] === a) || [])[1];
  cont.innerHTML = titulo(`${T('Deciles de ingreso', 'Income deciles')} · ${nomA} · 2025`) +
    `<details open><summary>${T('¿Qué es un decil?', 'What is a decile?')}</summary><div><p>${T('Imagine a todas las personas en fila, de menor a mayor ingreso por persona de su hogar. Si se parte la fila en 10 grupos con el mismo número de personas, cada grupo es un <b>decil</b>: el decil 1 reúne al 10 % con menos ingreso y el decil 10 al 10 % con más. Por ejemplo, un hogar de 4 personas con COP 2.400.000 al mes tiene COP 600.000 por persona; ese valor indica en qué lugar de la fila queda.', 'Picture everyone in a line, from lowest to highest income per person in their household. Split the line into 10 groups with the same number of people, and each group is a <b>decile</b>: decile 1 holds the 10% with the least income and decile 10 the 10% with the most. For example, a household of 4 with COP 2,400,000 a month has COP 600,000 per person; that value shows where it falls in the line.')}</p></div></details>` +
    `<div class="panel"><h3 class="tb-h">${T('Calculadora: ¿en qué decil queda su hogar?', 'Calculator: which decile is your household in?')}</h3><div class="tr-calc">
      <label><span>${T('Ingreso mensual del hogar (COP)', 'Monthly household income (COP)')}</span><input id="tr-ci" type="number" inputmode="numeric" min="0" step="1000" value="${esc(calc.ing)}"></label>
      <label><span>${T('Número de personas', 'Number of people')}</span><input id="tr-cp" type="number" inputmode="numeric" min="1" step="1" value="${esc(calc.per)}"></label>
      <label><span>${T('Comparar con', 'Compare with')}</span><select id="tr-ca">${ambitos().map(x => `<option value="${x[0]}">${esc(x[1])}</option>`).join('')}</select></label></div><div id="tr-cr" class="tr-cres" aria-live="polite"></div>
      <p class="fuente">${T('Lo que escriba no se guarda ni se envía: el cálculo ocurre en su navegador. Es una aproximación: la cifra oficial usa la unidad de gasto, con arriendo imputado y las correcciones del DANE.', 'What you type is neither saved nor sent: the calculation runs in your browser. It is an approximation: the official figure uses the spending unit, with imputed rent and DANE\'s corrections.')}</p></div>` +
    `<div class="panel"><h3 class="tb-h">${T('Límite superior de cada decil (ingreso per cápita mensual, COP corrientes)', 'Upper limit of each decile (monthly per capita income, current COP)')}</h3><div class="graf" style="height:290px"><canvas id="tr-d1"></canvas></div><p class="fuente">${T('El decil 10 no tiene límite superior.', 'Decile 10 has no upper limit.')}</p></div>` +
    tabla([T('Decil', 'Decile'), T('Desde', 'From'), T('Hasta', 'To'), T('Ingreso medio', 'Mean income'), T('Personas', 'People'), T('Hogares', 'Households'), T('% informal', '% informal'), T('% cotiza', '% contribute'), T('% predial', '% property tax'), T('% valorización', '% betterment'), T('% vehículos', '% vehicle'), T('% renta', '% income tax')], filas) +
    `<p class="fuente">${T('Ingreso per cápita mensual de la unidad de gasto (<code>ingpcug</code>, base 908), en COP corrientes (pesos colombianos). Deciles de personas, ponderados con <code>fex_c</code> en nacional y zona y con <code>fex_dpto</code> en departamentos. Cada ámbito tiene sus propios cortes. Informal y cotiza se miden sobre los ocupados del decil; impuestos, sobre sus hogares. Se elige el ámbito con el filtro de territorio.', 'Monthly per capita income of the spending unit (<code>ingpcug</code>, base 908), in current COP (Colombian pesos). Person deciles, weighted with <code>fex_c</code> nationally and by area and <code>fex_dpto</code> for departments. Each scope has its own cut-offs. Informal and contribution are measured over the employed in the decile; taxes over its households. The scope is set with the territory filter.')}</p>` + ley() + cita();
  barras('tr-d1', [...Array(9).keys()].map(i => T('Decil ', 'Decile ') + (i + 1)), [{ n: 'COP', v: c, c: css('--azul') }], { fmt: v => cop(v), fmtEje: v => G.nf(v / 1e6, 1) + ' M' });
  const cr = () => {
    const i = parseFloat($('#tr-ci').value), p = parseFloat($('#tr-cp').value), am = $('#tr-ca').value, out = $('#tr-cr');
    calc = { ing: $('#tr-ci').value, per: $('#tr-cp').value, amb: am };
    if (!(i >= 0) || !(p >= 1)) { out.innerHTML = `<p class="tr-p">${T('Escriba el ingreso y el número de personas.', 'Enter the income and the number of people.')}</p>`; return; }
    const pc = i / p, cc = J.deciles[am].cortes; let d = cc.findIndex(x => pc <= x); d = d < 0 ? 10 : d + 1;
    const l = lineas(am), nom = (ambitos().find(x => x[0] === am) || [])[1];
    const pos = !l ? '' : pc < l.li ? T(`por debajo de la línea de pobreza extrema (${cop(l.li)})`, `below the extreme poverty line (${cop(l.li)})`) : pc < l.lp ? T(`entre la línea de pobreza extrema (${cop(l.li)}) y la de pobreza (${cop(l.lp)})`, `between the extreme poverty line (${cop(l.li)}) and the poverty line (${cop(l.lp)})`) : T(`por encima de la línea de pobreza (${cop(l.lp)})`, `above the poverty line (${cop(l.lp)})`);
    out.innerHTML = `<b class="tr-d">${T('Decil', 'Decile')} ${d}</b><p>${T(`Con ${cop(pc)} por persona, frente a ${esc(nom)} en 2025, su hogar quedaría en el decil ${d} y ${pos}.`, `With ${cop(pc)} per person, compared with ${esc(nom)} in 2025, your household would fall in decile ${d} and ${pos}.`)}</p>`;
  };
  $('#tr-ca').value = calc.amb;
  ['#tr-ci', '#tr-cp', '#tr-ca'].forEach(q => $(q).addEventListener('input', cr));
  cr();
}

/* ---------- 6. Situaciones especiales ---------- */
function especiales(cont) {
  const k = claveDe(S);
  const TC = [T('Escrito, término indefinido', 'Written, open-ended'), T('Escrito, término fijo', 'Written, fixed-term'), T('Verbal o sin dato de término', 'Verbal or term not reported'), T('Sin contrato', 'No contract')];
  const TE = [T('Trabaja solo', 'Works alone'), T('2 a 10 personas', '2 to 10 people'), T('11 a 50 personas', '11 to 50 people'), T('51 o más personas', '51 or more people')];
  cont.innerHTML = titulo(etiqueta(S)) +
    `<div class="kpis tr-k4">${kpi(fP(pct(k, 'o65s', 'o65')), T('Ocupados de 65+ sin pensión ni cotización', 'Employed 65+ with no pension or contribution') + conNum(celda(k, 'o65s')))}${kpi(fP(pct(k, 'pen', 'oc')), T('Pensionados que trabajan (P6920 = 3)', 'Working pensioners (P6920 = 3)') + conNum(celda(k, 'pen')))}${kpi(fP(pct(k, 'infs', 'inf')), T('Informales con salud subsidiada', 'Informal with subsidised health') + conNum(celda(k, 'infs')))}</div>` +
    `<div class="dos"><div class="panel"><h3 class="tb-h">${T('Tipo de contrato: % que cotiza', 'Contract type: % contributing')}</h3><div class="graf" style="height:240px"><canvas id="tr-e1"></canvas></div></div><div class="panel"><h3 class="tb-h">${T('Tamaño de empresa: % que cotiza', 'Firm size: % contributing')}</h3><div class="graf" style="height:240px"><canvas id="tr-e2"></canvas></div></div></div>` +
    tabla([T('Grupo', 'Group'), T('Ocupados', 'Employed'), T('% de ocupados', '% of employed'), T('% que cotiza', '% contributing')], TC.map((t, i) => [t, fM(celda(k, 'tc' + i)), fP(pct(k, 'tc' + i, 'oc')), fP(pct(k, 'tcc' + i, 'tc' + i))]).concat(TE.map((t, i) => [t, fM(celda(k, 'te' + i)), fP(pct(k, 'te' + i, 'oc')), fP(pct(k, 'tec' + i, 'te' + i))]))) +
    `<p class="fuente">${T('Variables: contrato <code>P6440</code>, <code>P6450</code> y <code>P6460</code>; tamaño <code>P3069</code>; pensión <code>P6920</code>; régimen <code>P6100</code>. Los de 65+ «sin pensión ni cotización» son los que responden no cotizar y no estar pensionados.', 'Variables: contract <code>P6440</code>, <code>P6450</code> and <code>P6460</code>; size <code>P3069</code>; pension <code>P6920</code>; scheme <code>P6100</code>. Those 65+ "with no pension or contribution" report neither contributing nor being pensioned.')}</p>` + ley() + cita();
  barras('tr-e1', TC, [{ n: T('% que cotiza', '% contributing'), v: TC.map((_, i) => pct(k, 'tcc' + i, 'tc' + i)), c: css('--azul') }], { horizontal: true });
  barras('tr-e2', TE, [{ n: T('% que cotiza', '% contributing'), v: TE.map((_, i) => pct(k, 'tec' + i, 'te' + i)), c: css('--azul') }], { horizontal: true });
}

/* ---------- 7. Impuestos ---------- */
function impuestos(cont) {
  const clave = S.per + '.' + terStr(S), f = J.impuestos[clave];
  const c = n => { if (!f) return 'NA'; const v = f[J._t[n]]; return v === COD.P ? 'P' : v === COD.C ? 'C' : v === COD.NA ? 'NA' : v * J.meta.unidad; };
  const p = n => { const x = c(n), y = c('hog'); return typeof x === 'string' ? x : typeof y === 'string' ? y : 100 * x / y; };
  const TX = [['pre', T('Predial (P3368)', 'Property tax (P3368)')], ['val', T('Valorización (P3369)', 'Betterment levy (P3369)')], ['veh', T('Vehículos (P3370)', 'Vehicle tax (P3370)')], ['ren', T('Renta (P3371)', 'Income tax (P3371)')]];
  const MX = [['mcc', T('Cotiza y paga algún impuesto', 'Contributes and pays a tax')], ['mco', T('Solo cotiza', 'Only contributes')], ['mim', T('Solo paga impuestos', 'Only pays taxes')], ['mno', T('Ninguno', 'Neither')]];
  const a = AMB();
  const dec = [...Array(10).keys()];
  cont.innerHTML = titulo(`${lugar(S)} · ${nomPer(S)}`) +
    `<p class="tr-p">${T('Un hogar paga un impuesto si alguno de sus integrantes de 15 años o más lo pagó en los últimos 12 meses, según lo que declaró. Predial y valorización: 0 = no pagó; 98 = pagó pero no sabe el valor (cuenta como pagó); 99 = no fue posible obtener la información. Vehículos y renta: 1 = sí, 2 = no, 9 = no sabe o no informa. En departamentos y por decil, «sin información» se agrupa con «no pagó» para no reservar todo el impuesto.', 'A household pays a tax if any member aged 15 or over paid it in the last 12 months, as reported. Property and betterment: 0 = did not pay; 98 = paid but does not know the amount (counts as paid); 99 = information could not be obtained. Vehicle and income tax: 1 = yes, 2 = no, 9 = does not know or report. In departments and by decile, "no information" is grouped with "did not pay" so the whole tax is not withheld.')}</p>` +
    `<div class="kpis tr-k4">${TX.map(t => kpi(fP(p(t[0])), t[1] + conNum(c(t[0]), T(' hogares', ' households')))).join('')}</div>` +
    tabla([T('Impuesto', 'Tax'), T('Hogares que pagaron', 'Households that paid'), T('% de hogares', '% of households'), T('Sin información', 'No information')], TX.map(t => [t[1], fM(c(t[0])), fP(p(t[0])), fM(c(t[0] + '9'))])) +
    `<div class="panel"><h3 class="tb-h">${T('Matriz de contribución del hogar, 2025', 'Household contribution matrix, 2025')}</h3><div class="graf" style="height:470px"><canvas id="tr-x1"></canvas></div>
     <p class="fuente">${T('Cotiza: algún ocupado del hogar cotiza a pensión (<code>P6920 = 1</code>). Por decil de ingreso del ámbito elegido; base 908, 2025.', 'Contributes: an employed household member contributes to a pension (<code>P6920 = 1</code>). By income decile of the chosen scope; base 908, 2025.')}</p></div>` +
    tabla([T('Grupo', 'Group')].concat(MX.map(m => m[1])), [[T('Total', 'Total')].concat(MX.map(m => fP(dp(a, 10, m[0], 'hog'))))].concat(dec.map(d => [T('Decil ', 'Decile ') + (d + 1)].concat(MX.map(m => fP(dp(a, d, m[0], 'hog'))))))) + ley() + cita();
  barras('tr-x1', [T('Total', 'Total')].concat(dec.map(d => T('Decil ', 'Decile ') + (d + 1))), MX.map((m, i) => ({ n: m[1], v: [10].concat(dec).map(d => dp(a, d, m[0], 'hog')), c: [css('--azul-osc'), css('--azul'), css('--verde'), '#BDBDBD'][i] })), { horizontal: true, apilado: true });
}

/* ---------- 8. Comparador regional ---------- */
function valorInd(k, i) {
  if (i.id === 'medh') { const v = extra(k, 2); return v > 0 ? v : 'P'; }
  if (i.id === 'medi') { const v = extra(k, 3); return v > 0 ? v : 'P'; }
  return pct(k, i.n, i.d);
}
const INDX = () => IND.concat([{ id: 'medh', t: ['Mediana de horas', 'Median hours'] }, { id: 'medi', t: ['Ingreso mediano (COP)', 'Median income (COP)'] }]);
const fIND = (i, v) => !num(v) ? (v === 'NA' ? '—' : v) : i.id === 'medh' ? G.nf(v, 0) + ' h' : i.id === 'medi' ? cop(v) : G.nf(v, 1) + ' %';
function comparador(cont) {
  const deps = J.dptos.slice().sort((a, b) => G.NOMBRES[a].localeCompare(G.NOMBRES[b], 'es'));
  const i = INDX().find(x => x.id === indComp);
  const COMP = { sm: { t: T('Tramos de salario mínimo', 'Minimum-wage bands'), v: TR_SM.map((x, q) => [par(x).split(' (')[0], 'i' + q, 'oc', RAMPA[q]]) }, h: { t: T('Tramos de horas', 'Hours bands'), v: TR_H.map((x, q) => [x, 'h' + q, 'oc', ['#C5D6F5', '#A6C0F0', '#8FB0EC', '#5C8BDD', '#3366CC', '#264F9E', '#1A3C7C', '#002A5C'][q]]) } };
  const nac = 'a.n', kd = c => 'a.D' + c;
  const vn = valorInd(nac, i);
  const filas = selDeptos.map(c => { const v = valorInd(kd(c), i); return [G.NOMBRES[c], fIND(i, v), num(v) && num(vn) ? (v - vn >= 0 ? '+' : '') + (i.id === 'medi' ? cop(v - vn) : G.nf(v - vn, 1) + (i.id === 'medh' ? ' h' : ' p.p.')) : '—']; });
  cont.innerHTML = titulo(T('Comparador regional, 2025', 'Regional comparison, 2025')) +
    `<p class="tr-p">${T('Elija de 2 a 6 departamentos.', 'Choose 2 to 6 departments.')}</p><div class="tr-chips">${deps.map(c => `<label class="tr-chip${selDeptos.includes(c) ? ' on' : ''}"><input type="checkbox" value="${c}"${selDeptos.includes(c) ? ' checked' : ''}${!selDeptos.includes(c) && selDeptos.length >= 6 ? ' disabled' : ''}>${esc(G.NOMBRES[c])}</label>`).join('')}</div>` +
    `<div class="fil tr-fil"><label>${T('Indicador', 'Indicator')} <select id="tr-ci2">${INDX().map(x => `<option value="${x.id}">${esc(par(x.t))}</option>`).join('')}</select></label></div>` +
    `<div class="dos"><div class="panel"><div class="graf" style="height:${Math.max(240, selDeptos.length * 44 + 90)}px"><canvas id="tr-r1"></canvas></div></div><div class="panel"><div class="mapa"><div id="tr-rm"></div><div class="tip" hidden></div></div></div></div>` +
    tabla([T('Departamento', 'Department'), par(i.t), T('Diferencia con el promedio nacional', 'Gap with the national average')], [[T('Promedio nacional', 'National average'), fIND(i, vn), '']].concat(filas)) +
    `<div class="fil tr-fil"><label>${T('Composición de los ocupados', 'Composition of the employed')} <select id="tr-cc"><option value="sm">${esc(COMP.sm.t)}</option><option value="h">${esc(COMP.h.t)}</option><option value="m">${esc(par(FIL.m.n))}</option></select></label></div>` +
    `<div class="panel"><div class="graf" style="height:${Math.max(320, selDeptos.length * 44 + 230)}px"><canvas id="tr-r2"></canvas></div></div><div id="tr-rt"></div>` + ley() +
    `<p class="fuente">${T('Departamentos con <code>FEX_DPTO</code> y Bogotá con <code>FEX_C18/12</code>; el promedio nacional usa <code>FEX_C18/12</code>. Son factores distintos y la diferencia es descriptiva, sin prueba de significancia.', 'Departments use <code>FEX_DPTO</code> and Bogotá <code>FEX_C18/12</code>; the national average uses <code>FEX_C18/12</code>. These are different factors and the gap is descriptive, with no significance test.')}</p>` + cita();
  $('#tr-ci2').value = indComp; $('#tr-cc').value = compComp;
  cont.querySelectorAll('.tr-chip input').forEach(ch => ch.addEventListener('change', e => {
    const v = e.target.value;
    if (e.target.checked && selDeptos.length < 6) selDeptos.push(v);
    else if (!e.target.checked && selDeptos.length > 2) selDeptos = selDeptos.filter(x => x !== v);
    render();
  }));
  $('#tr-ci2').addEventListener('change', e => { indComp = e.target.value; render(); });
  $('#tr-cc').addEventListener('change', e => { compComp = e.target.value; render(); });
  const et = selDeptos.map(c => G.NOMBRES[c]);
  barras('tr-r1', [T('Promedio nacional', 'National average')].concat(et), [{ n: par(i.t), v: [vn].concat(selDeptos.map(c => valorInd(kd(c), i))), c: css('--azul') }], { horizontal: true, fmt: v => fIND(i, v), fmtEje: i.id === 'medi' ? (v => G.nf(v / 1e6, 1) + ' M') : (i.id === 'medh' ? (v => G.nf(v, 0) + ' h') : undefined) });
  const vals = {}; J.dptos.forEach(c => { const v = valorInd(kd(c), i); vals[c] = num(v) ? v : null; });
  G.mapa('tr-rm', vals, { titulo: par(i.t), fmt: v => fIND(i, v) });
  selDeptos.forEach(c => { const p = document.querySelector(`#tr-rm path[data-c="${c}"]`); if (p) { p.classList.add('sel'); p.parentNode.appendChild(p); } });
  let items;
  if (compComp === 'm') {
    const col = ['#7A7A7A', '#B26A00', '#3366CC', '#A80521', '#069169', '#8FB0EC', '#E2A94F', '#004884', '#6FBFA5', '#C97B8A'];
    const ser = FIL.m.v.map((x, q) => ({ n: par(x), v: selDeptos.map(c => pct(kd(c) + '.m' + q, 'oc', 'oc') === 'NA' ? 'NA' : (() => { const a = celda(kd(c) + '.m' + q, 'oc'), b = celda(kd(c), 'oc'); return typeof a === 'string' ? a : typeof b === 'string' ? b : 100 * a / b; })()), c: col[q] }));
    barras('tr-r2', et, ser, { horizontal: true, apilado: true });
    $('#tr-rt').innerHTML = tabla([par(FIL.m.n)].concat(et), ser.map(s => [s.n].concat(s.v.map(fP))));
    return;
  }
  items = COMP[compComp].v;
  const ser = items.map(x => ({ n: x[0], v: selDeptos.map(c => pct(kd(c), x[1], x[2])), c: x[3] }));
  barras('tr-r2', et, ser, { horizontal: true, apilado: true });
  $('#tr-rt').innerHTML = tabla([COMP[compComp].t].concat(et), ser.map(s => [s.n].concat(s.v.map(fP))));
}

/* ---------- 9. Tabla por rama ---------- */
function ramas(cont) {
  const base = Object.assign({}, S, { m: '', p: '', u: '', e: '' });
  const un = ORDEN.filter(f => S[f] !== '' && !['s', 'f'].includes(f));
  const filas = FIL.m.v.map((x, q) => {
    const k = claveDe(base, { m: String(q) });
    const dis = !!J.estados[k];
    return { n: par(x), oc: dis ? celda(k, 'oc') : 'NA', inf: dis ? pct(k, 'inf', 'oc') : 'NA', h: dis ? (extra(k, 2) > 0 ? extra(k, 2) : 'P') : 'NA', ing: dis ? (extra(k, 3) > 0 ? extra(k, 3) : 'P') : 'NA', cot: dis ? pct(k, 'cot', 'oc') : 'NA' };
  });
  const k_ = ordenRama.k, s = ordenRama.asc ? 1 : -1;
  filas.sort((a, b) => k_ === 'n' ? s * a.n.localeCompare(b.n) : (num(a[k_]) ? (num(b[k_]) ? s * (a[k_] - b[k_]) : -1) : 1));
  const cols = [['n', T('Rama', 'Industry')], ['oc', T('Ocupados', 'Employed')], ['inf', T('% informal', '% informal')], ['h', T('Horas medianas', 'Median hours')], ['ing', T('Ingreso mediano', 'Median income')], ['cot', T('% que cotiza', '% contributing')]];
  const t = `<div class="tabla"><table class="tr-ord"><thead><tr>${cols.map(c => `<th><button type="button" data-k="${c[0]}" class="tr-th">${esc(c[1])}${k_ === c[0] ? (ordenRama.asc ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr><td>${esc(f.n)}</td><td>${fM(f.oc)}</td><td>${fP(f.inf)}</td><td>${num(f.h) ? G.nf(f.h, 0) + ' h' : f.h === 'NA' ? '—' : f.h}</td><td>${num(f.ing) ? cop(f.ing) : f.ing === 'NA' ? '—' : f.ing}</td><td>${fP(f.cot)}</td></tr>`).join('')}</tbody></table></div>`;
  cont.innerHTML = titulo(`${lugar(base)} · ${nomPer(base)}` + (base.s !== '' ? ' · ' + par(FIL.s.v[+base.s]) : '') + (base.f !== '' ? ' · ' + par(FIL.f.v[+base.f]) : '')) + sinCorr(S) +
    (un.length ? `<p class="fuente">${T('Esta tabla ya está por rama: no usa los filtros de edad, educación ni posición.', 'This table is already by industry: it ignores the age, education and status filters.')}</p>` : '') +
    `<p class="tr-p">${T('Haga clic en un encabezado para ordenar.', 'Click a header to sort.')}</p>` + t +
    `<p class="fuente">${T('Rama: <code>RAMA2D_R4</code> (CIIU rev. 4) agrupada en 10 categorías. Ingreso de la primera actividad en COP corrientes (pesos colombianos). Horas normales (<code>P6800</code>).', 'Industry: <code>RAMA2D_R4</code> (ISIC rev. 4) grouped into 10 categories. Main-job income in current COP (Colombian pesos). Usual hours (<code>P6800</code>).')}</p>` + ley() + cita();
  cont.querySelectorAll('.tr-th').forEach(b => b.addEventListener('click', () => { const q = b.dataset.k; ordenRama = { k: q, asc: ordenRama.k === q ? !ordenRama.asc : q === 'n' }; render(); }));
}

/* ---------- 10. Dos perfiles ---------- */
function perfiles(cont) {
  reparar(PA); reparar(PB);
  const kA = claveDe(PA), kB = claveDe(PB);
  const filas = INDX().map(i => { const a = valorInd(kA, i), b = valorInd(kB, i); return [par(i.t), fIND(i, a), fIND(i, b), num(a) && num(b) ? (a - b >= 0 ? '+' : '') + (i.id === 'medi' ? cop(a - b) : G.nf(a - b, 1) + (i.id === 'medh' ? ' h' : ' p.p.')) : '—']; });
  cont.innerHTML = titulo(T('Comparador de dos perfiles', 'Compare two profiles')) +
    `<div class="dos"><div class="panel"><h3 class="tb-h">${T('Perfil A', 'Profile A')}</h3><div class="tr-fbar tr-fbar2" id="tr-pa"></div></div><div class="panel"><h3 class="tb-h">${T('Perfil B', 'Profile B')}</h3><div class="tr-fbar tr-fbar2" id="tr-pb"></div></div></div>` +
    `<p class="tr-p"><b>A:</b> ${esc(etiqueta(PA))}<br><b>B:</b> ${esc(etiqueta(PB))}</p>` + sinCorr(PA.per === 'c' ? PA : PB) +
    tabla([T('Indicador', 'Indicator'), T('Perfil A', 'Profile A'), T('Perfil B', 'Profile B'), T('A menos B', 'A minus B')], filas) + ley() + cita();
  construir($('#tr-pa'), PA, render, 'tr-a-');
  construir($('#tr-pb'), PB, render, 'tr-b-');
}

/* ---------- Validación ---------- */
const GRUPO_EN = [['Tablas: ', 'Tables: '], ['departamental 2025', 'departmental 2025'], ['% informalidad nacional, trim. móvil', '% informality, national, moving quarter'], ['% ocupados que cotizan a pensión, trim. móvil', '% of employed contributing to a pension, moving quarter'], ['% ocupados afiliados a salud, trim. móvil', '% of employed enrolled in health, moving quarter'], ['Pobreza monetaria', 'Monetary poverty'], ['Pobreza extrema', 'Extreme poverty'], ['coef. × 100', 'coef. × 100'], ['Ingreso per cápita', 'Per capita income'], ['miles de COP', 'thousand COP'], ['TD anual 2025 (oficial con 2 decimales)', 'Annual TD 2025 (official figure has 2 decimals)']];
function validacion() {
  const nom = g => es() ? g : GRUPO_EN.reduce((x, [a, b]) => x.split(a).join(b), g);
  $('#tr-val tbody').innerHTML = J.validacion_resumen.map(r => `<tr><td>${esc(nom(r.grupo))}</td><td>${r.comparaciones}</td><td>${G.nf(r.dif_abs_max, 4)}</td><td>${r.replica ? T('Sí', 'Yes') : 'No'}</td></tr>`).join('');
  const lo = J.meta.generado;
  ['#tr-gen', '#tr-gen-en'].forEach(q => { const e = $(q); if (e) e.textContent = lo; });
}

/* ---------- Render ---------- */
const VISTAS = { flujo: [['Flujo', 'Flow'], flujo, 1], proteccion: [['Protección', 'Protection'], proteccion, 1], horas: [['Horas', 'Hours'], horas, 1], ingreso: [['Ingreso y mínimo', 'Income and minimum'], ingreso, 1], deciles: [['Deciles', 'Deciles'], deciles, 2], especiales: [['Situaciones especiales', 'Special situations'], especiales, 1], impuestos: [['Impuestos', 'Taxes'], impuestos, 2], comparador: [['Comparador regional', 'Regional comparison'], comparador, 0], ramas: [['Por rama', 'By industry'], ramas, 1], perfiles: [['Dos perfiles', 'Two profiles'], perfiles, 0] };
function visible() { const s = $('#trabajo'); return s && !s.hidden; }
function render() {
  if (!J) return;
  if (!visible()) { sucio = true; return; }
  sucio = false;
  Object.values(graficos).forEach(g => g.destroy()); graficos = {};
  reparar(S);
  $('#tr-nav').innerHTML = Object.entries(VISTAS).map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="${k === vista}">${esc(par(v[0]))}</button>`).join('');
  $('#tr-nav').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { vista = b.dataset.v; render(); }));
  const conFiltros = VISTAS[vista][2];
  $('#tr-fcaja').hidden = !conFiltros;
  if (conFiltros) {
    if (conFiltros === 2) ORDEN.forEach(f => { S[f] = ''; });
    construir($('#tr-filtros'), S, render, 'tr-f-', conFiltros === 2);
    if (conFiltros === 2) $('#tr-avisos').innerHTML = `<li>${vista === 'deciles' ? T('<b>Deciles.</b> Solo existen para 2025 (base 908): esta vista usa el territorio.', '<b>Deciles.</b> They exist only for 2025 (base 908): this view uses the territory.') : T('<b>Impuestos.</b> Son cifras de hogares: esta vista usa el período y el territorio. La matriz por decil es de 2025.', '<b>Taxes.</b> These are household figures: this view uses the period and territory. The decile matrix is for 2025.')}</li>`;
    else avisosFiltros();
  }
  VISTAS[vista][1]($('#tr-vista'));
  validacion();
  document.documentElement.dataset.trabajo = 'listo';
  document.documentElement.dataset.vista = vista;
}
async function iniciar() {
  G = window.GEIH;
  try {
    const VER = document.documentElement.dataset.version || '1';
    const r = await fetch('data/trabajo.json?v=' + VER, { cache: 'no-cache' });
    if (!r.ok) throw new Error('data/trabajo.json (HTTP ' + r.status + ')');
    J = await r.json();
  } catch (e) {
    console.error(e);
    const b = $('#tr-error'); if (b) b.hidden = false;
    return;
  }
  J._i = {}; J.medidas.forEach((m, i) => { J._i[m] = i; });
  J._t = {}; J.impuestos_celdas.forEach((m, i) => { J._t[m] = i; });
  J._d = {}; J.deciles_celdas.forEach((m, i) => { J._d[m] = i; });
  document.addEventListener('geih:seccion', ev => { if (ev.detail === 'trabajo') { if (sucio) render(); else Object.values(graficos).forEach(g => g.resize()); } });
  document.addEventListener('geih:idioma', () => { sucio = true; render(); });
  render();
}
document.addEventListener('geih:listo', iniciar, { once: true });
})();
