/* Tablero de microdatos GEIH 2025-2026: «juegue con los factores de expansión».
   Datos: data/micro.json (generado por scripts/02_microdatos.py).
   Solo BUSCA cifras precalculadas. Nunca suma, resta ni deriva: una cifra reservada no se calcula a partir de otras. */
(function () {
'use strict';
const $ = s => document.querySelector(s);
let J, G, indice = {}, S, sucio = true, grafico = null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const LAB = ['td', 'tgp', 'to', 'inf', 'cot_pension', 'oc_afil', 'nini'];
const SAL_NAC = ['afil', 'contrib', 'especial', 'subsid'];
const SAL_DEP = ['afil', 'contrib_especial', 'subsid'];
const IND = {
  td: ['Tasa de desocupación (TD)', 'Unemployment rate (TD)', 'personas en la fuerza de trabajo', 'people in the labour force'],
  tgp: ['Tasa global de participación (TGP)', 'Labour force participation rate (TGP)', 'personas en edad de trabajar', 'working-age people'],
  to: ['Tasa de ocupación (TO)', 'Employment rate (TO)', 'personas en edad de trabajar', 'working-age people'],
  inf: ['Informalidad laboral', 'Labour informality', 'personas ocupadas', 'employed people'],
  cot_pension: ['Ocupados que cotizan a pensión', 'Employed contributing to a pension', 'personas ocupadas', 'employed people'],
  oc_afil: ['Ocupados afiliados a salud', 'Employed enrolled in health insurance', 'personas ocupadas', 'employed people'],
  nini: ['Ni estudian ni trabajan (15–28 años)', 'Neither studying nor working (aged 15–28)', 'personas de 15 a 28 años', 'people aged 15 to 28'],
  afil: ['Afiliados a salud, toda la población', 'Enrolled in health insurance, whole population', 'personas (toda la población)', 'people (whole population)'],
  contrib: ['Régimen contributivo (incluye sin dato de régimen)', 'Contributory scheme (includes scheme not reported)', 'personas (toda la población)', 'people (whole population)'],
  especial: ['Régimen especial', 'Special scheme', 'personas (toda la población)', 'people (whole population)'],
  subsid: ['Régimen subsidiado', 'Subsidised scheme', 'personas (toda la población)', 'people (whole population)'],
  contrib_especial: ['Contributivo y especial (incluye sin dato de régimen)', 'Contributory and special (includes scheme not reported)', 'personas (toda la población)', 'people (whole population)']
};
const PER = { '2025': ['2025', '2025'], 'ene-ago 2025': ['Enero–agosto de 2025', 'January–August 2025'], 'ene-ago 2026': ['Enero–agosto de 2026', 'January–August 2026'] };
const NIV = { nacional: ['Nacional', 'National'], cabeceras: ['Cabeceras', 'Urban centres'], rural: ['Centros poblados y rural disperso', 'Rural areas'], departamento: ['Departamento (y Bogotá)', 'Department (and Bogotá)'] };
const NIV_OP = { nacional: ['Nacional', 'National'], cabeceras: ['Cabeceras', 'Urban centres'], rural: ['Rural', 'Rural'], departamento: ['Departamento', 'Department'] };
const CRUCE = { sexo: ['Sexo al nacer', 'Sex at birth'], edad: ['Edad', 'Age'], educ: ['Educación', 'Education'], zona: ['Zona', 'Area'] };
const CAT = {
  h: ['Hombres', 'Men'], m: ['Mujeres', 'Women'], cab: ['Cabeceras', 'Urban centres'], rur: ['Centros poblados y rural disperso', 'Rural areas'],
  ninguno: ['Ninguno', 'None'], primaria: ['Primaria', 'Primary'], secundaria: ['Secundaria', 'Lower secondary'], media: ['Media', 'Upper secondary'], superior: ['Superior', 'Tertiary'], sin_dato: ['Sin dato (sobre todo menores de 3 años)', 'Not reported (mostly under 3)']
};
const RES = {
  P: ['P = precisión insuficiente (menos de 300 encuestas en el denominador)', 'P = insufficient precision (fewer than 300 interviews in the denominator)'],
  C: ['C = reservada por confidencialidad (Ley 79 de 1993)', 'C = withheld for confidentiality (Law 79 of 1993)']
};
const es = () => G.lang() === 'es';
const T = (a, b) => G.t(a, b);
const par = x => es() ? x[0] : x[1];
const nomInd = k => es() ? IND[k][0] : IND[k][1];
const denInd = k => es() ? IND[k][2] : IND[k][3];
const cat = v => CAT[v] ? par(CAT[v]) : String(v).replace('-', '–');
const pct = v => G.nf(v, 2) + ' %';
const ent = v => Math.round(v).toLocaleString(es() ? 'es-CO' : 'en-US');
const css = n => getComputedStyle(document.body).getPropertyValue(n).trim();

/* ---------- Búsqueda: sin ningún cálculo sobre las cifras ---------- */
function indexar() {
  Object.entries(J.tablas).forEach(([nom, t]) => {
    const nd = t.dims.length;
    t.filas.forEach(f => {
      const clave = t.dims.map((d, i) => J.dims[d][f[i]]).join('|');
      const reg = {};
      t.medidas.forEach((m, i) => { reg[m] = f[nd + i]; });
      indice[nom + '#' + clave] = reg;
    });
  });
}
const buscar = (tabla, claves, ind) => { const r = indice[tabla + '#' + claves.join('|')]; return r && r[ind] !== undefined ? r[ind] : null; };
const esDep = () => S.niv === 'departamento';
const base = () => esDep() ? [S.dpto] : [S.niv, S.per];
const prefijo = () => esDep() ? 'departamental.' : 'nacional.';
const dimEdad = () => esDep() ? 'edad_dpto' : 'edad';

function tablaActual() {
  if (!S.c1) return 'total';
  if (!S.c2) return S.c1;
  return 'sexo_' + (S.c1 === 'sexo' ? S.c2 : S.c1);
}
function categorias(dim) { return J.dims[dim === 'edad' ? dimEdad() : dim] || []; }

/* Filas visibles: la cifra del total y, si hay cruce, la de cada categoría que exista en la tabla. */
function filasActuales() {
  const pre = prefijo(), b = base(), filas = [{ etiquetas: [T('Total', 'Total')], total: true, e: buscar(pre + 'total', b, S.ind) }];
  if (!S.c1) return filas;
  const tb = pre + tablaActual();
  if (!S.c2) {
    categorias(S.c1).forEach(c => {
      const e = buscar(tb, b.concat([c]), S.ind);
      if (e !== null) filas.push({ etiquetas: [cat(c)], c1: c, e });
    });
    return filas;
  }
  const otra = S.c1 === 'sexo' ? S.c2 : S.c1;
  categorias('sexo').forEach(sx => categorias(otra).forEach(c => {
    const e = buscar(tb, b.concat([sx, c]), S.ind);
    if (e !== null) filas.push({ etiquetas: [cat(sx), cat(c)], sexo: sx, otra: c, e });
  }));
  return filas;
}

/* ---------- Filtros: desactivan lo que no existe y explican por qué ---------- */
function indicadoresDisponibles() {
  if (S.tema === 'laboral') return LAB;
  return esDep() ? SAL_DEP : SAL_NAC;
}
function coherencia() {
  if (esDep()) { S.per = '2025'; S.c2 = ''; }
  if (S.tema === 'salud' && !indicadoresDisponibles().includes(S.ind)) {
    S.ind = S.ind === 'contrib_especial' ? 'contrib' : (S.ind === 'contrib' || S.ind === 'especial') ? 'contrib_especial' : S.ind;
  }
  if (!indicadoresDisponibles().includes(S.ind)) S.ind = indicadoresDisponibles()[0];
  if (S.ind === 'nini') { if (S.c1 === 'edad') S.c1 = ''; if (S.c2 === 'edad') S.c2 = ''; }
  if (!esDep() && S.c1 === 'zona') S.c1 = '';
  if (!S.c1) S.c2 = '';
  if (S.c2 === S.c1) S.c2 = '';
  if (S.c1 && S.c2 && S.c1 !== 'sexo' && S.c2 !== 'sexo') S.c2 = '';
}
function opciones(id, lista, valor) {
  const sel = $(id);
  sel.innerHTML = lista.map(o => `<option value="${esc(o.v)}"${o.off ? ' disabled' : ''}>${esc(o.t)}${o.off ? T(' (no disponible)', ' (not available)') : ''}</option>`).join('');
  sel.value = valor;
}
function pintarFiltros() {
  opciones('#tb-tema', [{ v: 'laboral', t: T('Mercado laboral', 'Labour market') }, { v: 'salud', t: T('Salud', 'Health') }], S.tema);
  opciones('#tb-ind', indicadoresDisponibles().map(k => ({ v: k, t: nomInd(k) })), S.ind);
  opciones('#tb-per', J.dims.periodo.map(p => ({ v: p, t: par(PER[p]), off: esDep() && p !== '2025' })), S.per);
  opciones('#tb-niv', Object.keys(NIV).map(k => ({ v: k, t: par(NIV_OP[k]), off: k === 'departamento' && S.per !== '2025' })), S.niv);
  const deps = J.dims.dpto.slice().sort((a, b) => G.NOMBRES[a].localeCompare(G.NOMBRES[b], 'es'));
  opciones('#tb-dpto', deps.map(c => ({ v: c, t: G.NOMBRES[c] })), S.dpto);
  $('#tb-dpto').disabled = !esDep();
  const c1 = [{ v: '', t: T('Sin cruce', 'No breakdown') }, { v: 'sexo', t: par(CRUCE.sexo) }, { v: 'edad', t: par(CRUCE.edad), off: S.ind === 'nini' }, { v: 'educ', t: par(CRUCE.educ) }];
  if (esDep()) c1.splice(2, 0, { v: 'zona', t: par(CRUCE.zona) });
  opciones('#tb-c1', c1, S.c1);
  const c2 = [{ v: '', t: T('Sin segundo cruce', 'No second breakdown') }];
  if (!esDep() && S.c1 === 'sexo') c2.push({ v: 'edad', t: par(CRUCE.edad), off: S.ind === 'nini' }, { v: 'educ', t: par(CRUCE.educ) });
  if (!esDep() && (S.c1 === 'edad' || S.c1 === 'educ')) c2.push({ v: 'sexo', t: par(CRUCE.sexo) });
  opciones('#tb-c2', c2, S.c2);
  $('#tb-c2').disabled = esDep() || !S.c1;
  const av = [];
  if (S.per !== '2025') av.push(T('<b>Departamento desactivado.</b> Por representatividad, la GEIH solo permite departamentos con el año completo: enero–agosto no se desagrega por departamento. Elija 2025 para activarlo.', '<b>Department disabled.</b> For representativeness, the GEIH only supports departments over a full year: January–August is not broken down by department. Choose 2025 to enable it.'));
  if (esDep()) {
    av.push(T('<b>Período.</b> En departamentos solo existe 2025. Para ver enero–agosto, elija un nivel nacional, de cabeceras o rural.', '<b>Period.</b> Departments exist only for 2025. To see January–August, choose the national, urban or rural level.'));
    av.push(T('<b>Segundo cruce desactivado.</b> En departamentos no hay dobles cruces: las celdas quedarían demasiado pequeñas para publicarlas.', '<b>Second breakdown disabled.</b> Departments have no double breakdowns: cells would be too small to publish.'));
  } else {
    av.push(T('<b>Departamento.</b> Se activa al elegir el nivel «Departamento». La zona se elige en el nivel: nacional, cabeceras o rural.', '<b>Department.</b> It becomes active when the “Department” level is chosen. The area is chosen in the level: national, urban or rural.'));
    if (S.c1 === 'edad' || S.c1 === 'educ') av.push(T('<b>Segundo cruce.</b> Solo existe con sexo: edad y educación no se cruzan entre sí.', '<b>Second breakdown.</b> Only available with sex: age and education are not crossed with each other.'));
  }
  if (S.ind === 'nini') av.push(T('<b>Edad desactivada.</b> Este indicador ya se refiere a las personas de 15 a 28 años.', '<b>Age disabled.</b> This indicator already refers to people aged 15 to 28.'));
  if (S.tema === 'salud') av.push(esDep()
    ? T('<b>Regímenes.</b> En departamentos, el contributivo y el especial se publican agrupados por confidencialidad.', '<b>Schemes.</b> In departments, the contributory and special schemes are published together for confidentiality.')
    : T('<b>Regímenes.</b> Contributivo y especial solo se publican por separado en los niveles nacional, de cabeceras y rural.', '<b>Schemes.</b> The contributory and special schemes are published separately only at the national, urban and rural levels.'));
  $('#tb-avisos').innerHTML = av.map(x => `<li>${x}</li>`).join('');
}

/* ---------- Tarjetas ---------- */
function lugar() { return esDep() ? G.NOMBRES[S.dpto] : par(NIV[S.niv]); }
function tarjetas() {
  const e = buscar(prefijo() + 'total', base(), S.ind);
  $('#tb-sel').textContent = `${nomInd(S.ind)} · ${lugar()} · ${par(PER[S.per])}`;
  const f = id => $(id);
  if (!Array.isArray(e)) {
    const txt = par(RES[e === 'C' ? 'C' : 'P']);
    ['#tb-k-n', '#tb-k-pob', '#tb-k-v', '#tb-k-vsp'].forEach(i => { f(i).textContent = e === 'C' ? 'C' : 'P'; });
    f('#tb-frase').textContent = txt;
    return;
  }
  f('#tb-k-n').textContent = ent(e[0]);
  f('#tb-k-pob').textContent = ent(e[1]);
  f('#tb-k-v').textContent = pct(e[2]);
  f('#tb-k-vsp').textContent = pct(e[3]);
  $('#tb-k-den').textContent = denInd(S.ind);
  $('#tb-k-den2').textContent = denInd(S.ind);
  const dif = Math.abs(e[2] - e[3]);
  f('#tb-frase').textContent = T(
    `Con los factores de expansión, la cifra es ${pct(e[2])}; contando cada encuesta como una persona, sería ${pct(e[3])}: ${G.nf(dif, 2)} puntos porcentuales de diferencia. Cada persona encuestada representa a un número distinto de personas, y la muestra no tiene la misma composición de la población. Por eso solo la cifra ponderada describe a la población; la otra describe a la muestra.`,
    `With expansion factors, the figure is ${pct(e[2])}; counting each interview as one person, it would be ${pct(e[3])}: a gap of ${G.nf(dif, 2)} percentage points. Each respondent represents a different number of people, and the sample does not mirror the population. So only the weighted figure describes the population; the other describes the sample.`);
}

/* ---------- Gráfico de barras ---------- */
const marcasReservadas = {
  id: 'tbReservadas',
  afterDatasetsDraw(ch) {
    const { ctx, scales: { x, y } } = ch;
    ctx.save(); ctx.fillStyle = css('--sub'); ctx.font = '600 11px Work Sans, sans-serif'; ctx.textBaseline = 'middle';
    ch.data.datasets.forEach((ds, i) => {
      const meta = ch.getDatasetMeta(i);
      (ds.reservas || []).forEach((r, j) => {
        if (!r || !meta.data[j]) return;
        ctx.fillText(r, x.getPixelForValue(0) + 5, meta.data[j].y);
      });
    });
    ctx.restore();
    return y;
  }
};
function serieDe(filas, campo) { return filas.map(f => Array.isArray(f.e) ? f.e[campo] : null); }
function reservasDe(filas) { return filas.map(f => Array.isArray(f.e) ? null : f.e); }
function graficar() {
  const filas = filasActuales(), oscuro = css('--azul-osc'), ama = css('--amarillo');
  let labels, datasets;
  const elegir = $('#tb-cifra-caja');
  if (S.c1 && S.c2) {
    const otra = S.c1 === 'sexo' ? S.c2 : S.c1, campo = S.cifra === 'vsp' ? 3 : 2;
    elegir.hidden = false; opciones('#tb-cifra', [{ v: 'v', t: T('Ponderada', 'Weighted') }, { v: 'vsp', t: T('Sin ponderar', 'Unweighted') }], S.cifra);
    const cs = categorias(otra).filter(c => filas.some(f => f.otra === c));
    labels = cs.map(cat);
    datasets = categorias('sexo').map(sx => {
      const fs = cs.map(c => filas.find(f => f.sexo === sx && f.otra === c) || { e: null });
      const color = sx === 'h' ? css('--azul') : css('--verde');
      return { label: cat(sx), data: serieDe(fs, campo), reservas: reservasDe(fs), backgroundColor: color, borderColor: color };
    });
  } else {
    elegir.hidden = true;
    const fs = S.c1 ? filas.filter(f => !f.total) : filas;
    labels = fs.map(f => f.etiquetas[0]);
    datasets = [
      { label: T('Ponderada (con factores)', 'Weighted (with factors)'), data: serieDe(fs, 2), reservas: reservasDe(fs), backgroundColor: oscuro, borderColor: oscuro },
      // El amarillo solo se usa como relleno con borde (criterio de los autores)
      { label: T('Sin ponderar (la muestra)', 'Unweighted (the sample)'), data: serieDe(fs, 3), reservas: reservasDe(fs), backgroundColor: ama, borderColor: css('--ocre') }
    ];
  }
  $('#tb-graf-caja').style.height = Math.max(190, labels.length * 58 + 90) + 'px';
  $('#tb-graf-tit').textContent = S.c1
    ? `${nomInd(S.ind)} · ${lugar()} · ${par(PER[S.per])}`
    : T('Con y sin factores de expansión, ', 'With and without expansion factors, ') + `${lugar()}, ${par(PER[S.per])}`;
  if (grafico) grafico.destroy();
  grafico = new Chart($('#tb-graf'), {
    type: 'bar', plugins: [marcasReservadas],
    data: { labels, datasets: datasets.map(d => Object.assign(d, { borderWidth: 1, borderRadius: { topRight: 4, bottomRight: 4 }, borderSkipped: false, categoryPercentage: .78, barPercentage: .9, minBarLength: 0 })) },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', axis: 'y', intersect: false },
      plugins: {
        legend: { labels: { color: css('--texto'), boxWidth: 12 } },
        tooltip: { callbacks: {
          label: c => `${c.dataset.label}: ${pct(c.parsed.x)}`,
          afterBody: its => { const r = its.length ? (its[0].chart.data.datasets.map(d => (d.reservas || [])[its[0].dataIndex]).filter(Boolean)[0]) : null; return r ? par(RES[r]) : ''; }
        } }
      },
      scales: {
        x: { beginAtZero: true, ticks: { color: css('--sub'), callback: v => G.nf(v, 0) + ' %' }, grid: { color: css('--borde') } },
        y: { ticks: { color: css('--texto') }, grid: { display: false } }
      }
    }
  });
}

/* ---------- Mapa y ranking: reutilizan mapa() y ranking() de assets/app.js ---------- */
function indicadorDepto() { return S.tema === 'salud' && !SAL_DEP.includes(S.ind) ? null : S.ind; }
function mapaDepto() {
  const caja = $('#tb-mapa-caja'), msg = $('#tb-mapa-msg'), ind = indicadorDepto();
  const dis = S.per === '2025' && ind;
  caja.hidden = !dis;
  msg.hidden = !!dis;
  $('#tb-mapa-nota').hidden = !dis;
  if (!dis) {
    $('#tb-mapa-tit').textContent = T('Mapa departamental', 'Departmental map');
    msg.textContent = S.per !== '2025'
      ? T('El mapa solo existe para 2025: enero–agosto no es representativo por departamento.', 'The map exists only for 2025: January–August is not representative by department.')
      : T('Este indicador no tiene mapa: en departamentos, el contributivo y el especial se publican agrupados. Elija «Afiliados», «Subsidiado» o el nivel «Departamento».', 'This indicator has no map: in departments, the contributory and special schemes are published together. Choose “Enrolled”, “Subsidised” or the “Department” level.');
    return;
  }
  const vals = {};
  J.dims.dpto.forEach(c => { const e = buscar('departamental.total', [c], ind); vals[c] = Array.isArray(e) ? e[2] : null; });
  $('#tb-mapa-tit').textContent = `${nomInd(ind)}, 2025 (${T('cifra ponderada', 'weighted figure')})`;
  G.mapa('tb-mapa', vals, { titulo: nomInd(ind), fmt: pct, click: c => { S.niv = 'departamento'; S.dpto = c; S.per = '2025'; render(); } });
  if (esDep()) { const p = document.querySelector(`#tb-mapa path[data-c="${S.dpto}"]`); if (p) { p.classList.add('sel'); p.parentNode.appendChild(p); } }
  G.ranking('tb-rk', vals, { fmt: pct });
}

/* ---------- Tabla y CSV ---------- */
function celdas(e) {
  if (Array.isArray(e)) return { n: ent(e[0]), pob: ent(e[1]), v: pct(e[2]), vsp: pct(e[3]), res: false };
  return { n: '', pob: '', v: e, vsp: e, res: true };
}
function encabezados() {
  const cs = !S.c1 ? [T('Selección', 'Selection')] : S.c2 ? [par(CRUCE.sexo), par(CRUCE[S.c1 === 'sexo' ? S.c2 : S.c1])] : [par(CRUCE[S.c1])];
  return cs.concat([T('Encuestas (n del denominador)', 'Interviews (denominator n)'), T('Población representada', 'Population represented'), T('Cifra ponderada', 'Weighted figure'), T('Cifra sin ponderar', 'Unweighted figure')]);
}
function tabla() {
  const filas = filasActuales(), cols = encabezados(), nc = cols.length - 4;
  $('#tb-tabla thead').innerHTML = '<tr>' + cols.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>';
  $('#tb-tabla tbody').innerHTML = filas.map(f => {
    const c = celdas(f.e), et = f.etiquetas.slice();
    while (et.length < nc) et.push('');
    return `<tr${f.total ? ' class="tb-total"' : ''}>${et.map(x => `<td>${esc(x)}</td>`).join('')}<td>${c.n}</td><td>${c.pob}</td><td>${c.v}</td><td>${c.vsp}</td></tr>`;
  }).join('');
}
function descargar() {
  const sep = es() ? ';' : ',', dec = v => { const s = String(v); return es() ? s.replace('.', ',') : s; };
  const q = s => /[;,"\n]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : s;
  const cols = encabezados(), nc = cols.length - 4;
  const lineas = [q(`${nomInd(S.ind)} - ${lugar()} - ${par(PER[S.per])}`), cols.map(q).join(sep)];
  filasActuales().forEach(f => {
    const et = f.etiquetas.slice(); while (et.length < nc) et.push('');
    const v = Array.isArray(f.e) ? [f.e[0], f.e[1], dec(f.e[2]), dec(f.e[3])] : ['', '', f.e, f.e];
    lineas.push(et.map(q).concat(v).join(sep));
  });
  lineas.push('', q(par(RES.P)), q(par(RES.C)), q(T('Cálculo propio: resúmenes numéricos, no microdatos.', 'Own calculation: numerical summaries, not microdata.')), q(J.meta.fuente));
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tablero-geih-${S.ind}-${esDep() ? S.dpto : S.niv}-${S.per.replace(/\s+/g, '-')}${S.c1 ? '-' + tablaActual() : ''}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- Validación ---------- */
const GRUPO_EN = [['Tablas: ', 'Tables: '], ['nacional mensual', 'national, monthly'], ['departamental 2025', 'departmental 2025'], ['hombres', 'men'], ['mujeres', 'women'], ['cabeceras', 'urban centres'], ['centros poblados y rural', 'rural areas'], ['(miles)', '(thousands)'], ['% ocupados afiliados a salud, trim. móvil', '% of employed enrolled in health, moving quarter'], ['% ocupados régimen contributivo, trim. móvil', '% of employed, contributory scheme, moving quarter'], ['% ocupados régimen especial, trim. móvil', '% of employed, special scheme, moving quarter'], ['% ocupados régimen subsidiado, trim. móvil', '% of employed, subsidised scheme, moving quarter'], ['% ocupados que cotizan a pensión, trim. móvil', '% of employed contributing to a pension, moving quarter'], ['% informalidad nacional, trim. móvil', '% informality, national, moving quarter'], ['% informalidad 13 ciudades, trim. móvil', '% informality, 13 cities, moving quarter'], ['% informalidad 23 ciudades, trim. móvil', '% informality, 23 cities, moving quarter'], ['TD Bogotá 2025 con FEX_C18/12', 'TD Bogotá 2025 with FEX_C18/12'], ['TD anual 2025 (oficial con 2 decimales)', 'Annual TD 2025 (official figure has 2 decimals)'], ['PT ', 'Total population ']];
const nomGrupo = g => es() ? g : GRUPO_EN.reduce((x, [a, b]) => x.split(a).join(b), g);
function validacion() {
  $('#tb-val tbody').innerHTML = J.validacion_resumen.map(r => `<tr><td>${esc(nomGrupo(r.grupo))}</td><td>${ent(r.comparaciones)}</td><td>${G.nf(r.dif_abs_max, 4)}</td><td>${r.replica ? T('Sí', 'Yes') : T('No', 'No')}</td></tr>`).join('');
  const dep = J.validacion.filter(f => f.grupo === 'Tablas: TD departamental 2025 (%)');
  $('#tb-val-dep tbody').innerHTML = dep.map(f => `<tr><td>${esc(G.NOMBRES[f.periodo])}</td><td>${G.nf(f.propia, 4)}</td><td>${G.nf(f.oficial, 4)}</td><td>${G.nf(f.diferencia, 4)}</td></tr>`).join('');
  $('#tb-gen').textContent = J.meta.generado; $('#tb-gen-en').textContent = J.meta.generado;
}

/* ---------- Render ---------- */
function visible() { const s = $('#tablero'); return s && !s.hidden; }
function render() {
  if (!J) return;
  if (!visible()) { sucio = true; return; }
  sucio = false;
  coherencia(); pintarFiltros(); tarjetas(); graficar(); mapaDepto(); tabla(); validacion();
  document.documentElement.dataset.tablero = 'listo';
}
function enlazar() {
  const ligar = (id, k) => $(id).addEventListener('change', e => { S[k] = e.target.value; render(); });
  ligar('#tb-tema', 'tema'); ligar('#tb-ind', 'ind'); ligar('#tb-per', 'per'); ligar('#tb-niv', 'niv'); ligar('#tb-dpto', 'dpto'); ligar('#tb-c1', 'c1'); ligar('#tb-c2', 'c2'); ligar('#tb-cifra', 'cifra');
  $('#tb-csv').addEventListener('click', descargar);
}
async function iniciar() {
  G = window.GEIH;
  S = { tema: 'laboral', ind: 'td', per: '2025', niv: 'departamento', dpto: '27', c1: '', c2: '', cifra: 'v' };
  try {
    const VER = document.documentElement.dataset.version || '1';
    const r = await fetch('data/micro.json?v=' + VER, { cache: 'no-cache' });
    if (!r.ok) throw new Error('data/micro.json (HTTP ' + r.status + ')');
    J = await r.json();
  } catch (e) {
    console.error(e);
    const b = $('#tb-error'); if (b) b.hidden = false;
    return;
  }
  indexar(); enlazar();
  document.addEventListener('geih:seccion', ev => { if (ev.detail === 'tablero' && sucio) render(); else if (ev.detail === 'tablero' && grafico) grafico.resize(); });
  document.addEventListener('geih:idioma', () => { sucio = true; render(); });
  render();
}
document.addEventListener('geih:listo', iniciar, { once: true });
})();
