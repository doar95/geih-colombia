"""Construye docs/data/datos.json a partir de los anexos oficiales del DANE
(guardados sin modificar en data/raw/dane) y de dos insumos externos
(IPC del DANE y afiliación al SGSSS del Ministerio de Salud y Protección Social).

Uso:  python scripts/01_construir_datos.py
Requisitos: pandas, openpyxl, xlrd
"""
import json, re, sys
from pathlib import Path
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from comun import bloques, limpiar, es_anio, anio

RAIZ = Path(__file__).resolve().parents[1]
RAW = RAIZ / 'data' / 'raw' / 'dane'
EXT = RAIZ / 'data' / 'externos'
OUT = RAIZ / 'data'

def hoja(f, s):
    return pd.read_excel(RAW / f, sheet_name=s, header=None)

# --- Códigos DIVIPOLA de departamento -------------------------------------
COD = {
 'antioquia':'05','atlantico':'08','bogota':'11','bolivar':'13','boyaca':'15','caldas':'17',
 'caqueta':'18','cauca':'19','cesar':'20','cordoba':'23','cundinamarca':'25','choco':'27',
 'huila':'41','la guajira':'44','magdalena':'47','meta':'50','narino':'52','norte de santander':'54',
 'quindio':'63','risaralda':'66','santander':'68','sucre':'70','tolima':'73','valle del cauca':'76',
 'arauca':'81','casanare':'85','putumayo':'86','san andres':'88','amazonas':'91','guainia':'94',
 'guaviare':'95','vaupes':'97','vichada':'99'}

def norm(t):
    t = str(t).lower().strip()
    for a, b in zip('áéíóúñ', 'aeioun'): t = t.replace(a, b)
    t = re.sub(r'[\*\.,]', '', t)
    t = t.replace(' dc', '').replace(' d c', '')
    t = re.sub(r'\s+', ' ', t).strip()
    if t.startswith('bogota'): return 'bogota'
    if t.startswith('san andres'): return 'san andres'
    return t

def cod(t):
    return COD.get(norm(t))

# --- Series mensuales / trimestre móvil -----------------------------------
MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

def series_concepto(df):
    """Bloques con fila 'Concepto' (años, con celdas combinadas) y fila de meses/trimestres."""
    res = []
    titulo = None
    i = 0
    while i < len(df):
        c0 = df.iloc[i, 0]
        if isinstance(c0, str) and c0.strip() == 'Concepto':
            anios, a = [], None
            for v in df.iloc[i].tolist()[1:]:
                if es_anio(v): a = anio(v)
                anios.append(a)
            per = df.iloc[i + 1].tolist()[1:]
            claves = []
            for a, p in zip(anios, per):
                if a is None or not isinstance(p, str): claves.append(None); continue
                p = p.strip()
                m = p[:3]
                if '-' in p:  # trimestre móvil: se fecha por el último mes
                    m = p.split('-')[-1].strip()[:3].capitalize()
                k = MESES.index(m.capitalize()) + 1 if m.capitalize() in MESES else None
                claves.append(f'{a}-{k:02d}' if k else None)
            j = i + 2; filas = {}
            while j < len(df):
                lab = df.iloc[j, 0]
                if not isinstance(lab, str) or not lab.strip():
                    j += 1; continue  # filas en blanco entre tasas y poblaciones
                vals = df.iloc[j].tolist()[1:]
                d = {k: limpiar(v) for k, v in zip(claves, vals) if k}
                if lab.strip() == 'Concepto': break
                if not any(v is not None for v in d.values()):
                    if lab.strip().startswith('Población ocupada'): j += 1; continue  # fila base vacía en tablas de %
                    break
                filas[lab.strip()] = d
                j += 1
            res.append((titulo, filas))
            i = j
            continue
        if isinstance(c0, str) and c0.strip() and not c0.startswith(('Serie', 'Nota', 'Fuente')):
            titulo = c0.strip()
        i += 1
    return res

def anual_desde_mensual(filas, ini=2001, fin=2025):
    """Promedio de los 12 meses de cada población (miles) y tasas recalculadas."""
    pob = {k: v for k, v in filas.items()}
    def media(lbl, a):
        vs = [pob[lbl].get(f'{a}-{m:02d}') for m in range(1, 13)]
        vs = [v for v in vs if v is not None]
        return sum(vs) / len(vs) if len(vs) == 12 else None
    def k(pref): return next(x for x in pob if x.startswith(pref))
    PT, PET, FT, OC, DS = k('Población total'), k('Población en edad'), k('Fuerza de trabajo'), k('Población ocupada'), k('Población desocupada')
    out = {}
    for a in range(ini, fin + 1):
        pt, pet, ft, oc, ds = (media(PT, a), media(PET, a), media(FT, a), media(OC, a), media(DS, a))
        if None in (pt, pet, ft, oc, ds): continue
        out[a] = {'PT': round(pt, 1), 'PET': round(pet, 1), 'FT': round(ft, 1), 'OC': round(oc, 1), 'DS': round(ds, 1),
                  'TGP': round(100 * ft / pet, 2), 'TO': round(100 * oc / pet, 2), 'TD': round(100 * ds / ft, 2)}
    return out

def mensual(filas, etiquetas):
    out = {}
    for nuevo, viejo in etiquetas.items():
        k = next((x for x in filas if x.startswith(viejo)), None)
        # en 2020 el DANE reporta 0 cuando no pudo recolectar (p. ej., subocupación mar-jul 2020): se trata como dato faltante
        if k: out[nuevo] = {p: v for p, v in filas[k].items() if v is not None and not (v == 0 and nuevo in ('TS', 'SUB'))}
    return out

D = {'meta': {'generado': pd.Timestamp.now().strftime('%Y-%m-%d'), 'archivos': sorted(p.name for p in RAW.iterdir())}}

# 1. Mercado laboral nacional (mensual 2001-2026) ---------------------------
s = dict(series_concepto(hoja('anex-GEIH-ago2026.xlsx', 'Total nacional')))
ETQ = {'TGP': 'Tasa Global', 'TO': 'Tasa de Ocupación', 'TD': 'Tasa de Desocupación', 'TS': 'Tasa de Subocupación',
       'PT': 'Población total', 'PET': 'Población en edad', 'FT': 'Fuerza de trabajo', 'OC': 'Población ocupada',
       'DS': 'Población desocupada', 'FFT': 'Población fuera', 'SUB': 'Población subocupada'}
D['lab_mensual'] = {dom: mensual(f, ETQ) for dom, f in s.items()}
D['lab_anual'] = {dom: anual_desde_mensual(f) for dom, f in s.items()}

# 2. Mercado laboral departamental (anual 2007-2025) ------------------------
def deptos_anual(sheet):
    df = hoja('anex-GEIHDepartamentos-2025.xls', sheet)
    out, dep, anios = {}, None, None
    for i in range(len(df)):
        fila = df.iloc[i].tolist()
        c0 = fila[0]
        if isinstance(c0, str) and cod(c0) and len(c0) < 40:
            dep = cod(c0); out.setdefault(dep, {}); continue
        ya = {j: anio(v) for j, v in enumerate(fila) if es_anio(v)}
        if len(ya) >= 3: anios = ya; continue
        if dep and anios and isinstance(c0, str):
            for nuevo, viejo in ETQ.items():
                if c0.strip().startswith(viejo):
                    out[dep][nuevo] = {a: limpiar(fila[j]) for j, a in anios.items() if limpiar(fila[j]) is not None}
    return out
D['lab_depto'] = {'total': deptos_anual('Departamentos anual'), 'hombres': deptos_anual('Departamentos anual hombres'),
                  'mujeres': deptos_anual('Departamentos anual mujeres'), 'cabeceras': deptos_anual('Departamento anual Cabeceras'),
                  'rural': deptos_anual('Departamento anual CentrosP')}
for k in ('hombres', 'mujeres', 'cabeceras', 'rural'):  # solo tasas para las desagregaciones
    D['lab_depto'][k] = {c: {i: v for i, v in d.items() if i in ('TGP', 'TO', 'TD')} for c, d in D['lab_depto'][k].items()}

# 3. Informalidad (trimestre móvil 2021-2026) -------------------------------
df = hoja('anex-GEIHEISS-jun-ago2026.xlsx', 'Prop informalidad')
hdr = next(i for i in range(len(df)) if str(df.iloc[i, 0]).startswith('Proporción de informalidad') and sum(es_anio(v) for v in df.iloc[i].tolist()) >= 2)
anios, a = [], None
for v in df.iloc[hdr].tolist()[1:]:
    if es_anio(v): a = anio(v)
    anios.append(a)
claves = []
for a, p in zip(anios, df.iloc[hdr + 1].tolist()[1:]):
    m = str(p).split('-')[-1].strip()[:3].capitalize() if isinstance(p, str) else None
    claves.append(f'{a}-{MESES.index(m)+1:02d}' if a and m in MESES else None)
inf = {}
for j in range(hdr + 2, len(df)):
    lab = df.iloc[j, 0]
    if not isinstance(lab, str) or not lab.strip(): break
    inf[lab.strip()] = {k: limpiar(v) for k, v in zip(claves, df.iloc[j].tolist()[1:]) if k and limpiar(v) is not None}
D['informalidad'] = inf

# 4. Afiliación de los ocupados a salud y pensión (GEIH, trimestre móvil) --
s = series_concepto(hoja('anex-GEIHEISS-jun-ago2026.xlsx', 'Seguridad social Tnal'))
ss = {}
DOMS = ['nacional', 'cabeceras', 'rural']
for n, (dom, f) in enumerate(s):  # 3 bloques de niveles (miles) y luego 3 de porcentajes
    ss.setdefault(DOMS[n % 3], {})['niveles' if n < 3 else 'porcentajes'] = {k.strip(): {p: v for p, v in vv.items() if v is not None} for k, vv in f.items() if any(v for v in vv.values())}
    for vv in ss[DOMS[n % 3]]['niveles' if n < 3 else 'porcentajes'].values():  # ceros = meses sin recolección
        for p in [p for p, v in vv.items() if v == 0 and p.startswith('2020')]: del vv[p]
D['seg_social_ocupados'] = ss

# 5. Pobreza monetaria nacional, dominios y ciudades (2012-2025) -----------
def tabla(f, s, n=0):
    b = bloques(hoja(f, s))[n]
    return {lab: {b['anios'][j]: v for j, v in vals if v is not None} for lab, vals in b['filas'].items()}
def sexo(f, s):
    """Hojas por sexo: fila de años (celdas combinadas) y debajo Hombre | Mujer."""
    df = hoja(f, s)
    h = next(i for i in range(len(df)) if sum(es_anio(v) for v in df.iloc[i].tolist()) >= 2)
    an = {j: anio(v) for j, v in enumerate(df.iloc[h].tolist()) if es_anio(v)}
    out = {}
    for i in range(h + 2, len(df)):
        lab = df.iloc[i, 0]
        if not isinstance(lab, str) or lab.startswith(('Fuente', 'Nota')): continue
        vals = {a: {'hombres': limpiar(df.iloc[i, j]), 'mujeres': limpiar(df.iloc[i, j + 1])} for j, a in an.items()}
        if any(v['hombres'] is not None for v in vals.values()): out[lab.strip()] = vals
    return out
PMN = 'anex-PM-TotalNacional-2025.xlsx'
D['pob_nac'] = {'PM': tabla(PMN, 'Pobreza Monetaria Act.Met.'), 'PM_personas': tabla(PMN, 'Pobreza Monetaria Act.Met.', 1),
                'PME': tabla(PMN, 'Pobreza Extrema Act.Met.'), 'PME_personas': tabla(PMN, 'Pobreza Extrema Act.Met.', 1),
                'Gini': tabla(PMN, 'Gini'), 'Ingpc': tabla(PMN, 'Ingpc Act.Met.'),
                'LP': tabla(PMN, 'LP_LI Act.Met.'), 'LI': tabla(PMN, 'LP_LI Act.Met.', 1),
                'Brecha_PM': tabla(PMN, 'Brecha Act.Met.'), 'Brecha_PME': tabla(PMN, 'Brecha Act.Met.', 1),
                'Severidad_PM': tabla(PMN, 'Severidad Act.Met.'), 'Severidad_PME': tabla(PMN, 'Severidad Act.Met.', 1),
                'PM_sexo': sexo(PMN, 'IP_Sexo Act.Met.'), 'PME_sexo': sexo(PMN, 'IPE_Sexo Act.Met.')}

# 6. Pobreza monetaria departamental (2021-2025) ---------------------------
PMD = 'anex-PMDepartamental-2025.xlsx'
def por_cod(t):
    o = {}
    for k, v in t.items():
        c = cod(k) or ('00' if norm(k).startswith('nacional') or norm(k).startswith('total') else None)
        if c: o[c] = v
    return o
D['pob_dep'] = {k: por_cod(tabla(PMD, s, n)) for k, s, n in [
    ('PM', 'Pobreza Monetaria Act.Met.', 0), ('PME', 'Pobreza Extrema Act.Met.', 0), ('Gini', 'Gini', 0),
    ('Ingpc', 'Ingpc Act.Met.', 0), ('LP', 'LP_LI Act.Met.', 0), ('LI', 'LP_LI Act.Met.', 1)]}

# 7. Pobreza multidimensional (ECV) ----------------------------------------
IPM = 'anex-PMultidimensional-2025.xlsx'
D['ipm_nac'] = {'dominios': tabla(IPM, 'IPM_Dominios', 0), 'regiones': tabla(IPM, 'IPM_Dominios', 1)}
def privaciones(f, s, col_var):
    df = hoja(f, s); out = {}; dom = None; anios = None
    for i in range(len(df)):
        fila = df.iloc[i].tolist()
        ya = {}
        a = None
        for j, v in enumerate(fila):
            if es_anio(v): ya[j] = anio(v)
        if len(ya) >= 3:
            # años en celdas combinadas: la primera columna del año es 'Total'
            anios = ya; continue
        d0, var = fila[0], fila[col_var]
        if isinstance(d0, str) and d0.strip() and not d0.startswith(('Fuente', 'Nota', 'Datos', 'Actualizado', 'Privaciones', 'Cifras', 'Dominio', 'Departamento', 'Índice')):
            dom = d0.strip()
        if anios and dom and isinstance(var, str) and var.strip():
            vals = {a: limpiar(fila[j]) for j, a in anios.items() if j < len(fila) and limpiar(fila[j]) is not None}
            if vals: out.setdefault(dom, {})[var.strip()] = vals
    return out
D['ipm_privaciones_nac'] = privaciones(IPM, 'IPM_Indicadores', 1)
IPD = 'anex-PMultidimensional-Departamental-2025.xlsx'
df = hoja(IPD, 'IPM_Departamentos')
hdr = next(i for i in range(len(df)) if str(df.iloc[i, 0]).strip() == 'Departamento')
anios = {j: anio(v) for j, v in enumerate(df.iloc[hdr].tolist()) if es_anio(v)}
ipmd = {}
for i in range(hdr + 2, len(df)):
    c = cod(df.iloc[i, 0]) if isinstance(df.iloc[i, 0], str) else None
    if not c: continue
    ipmd[c] = {a: {'total': limpiar(df.iloc[i, j]), 'cabeceras': limpiar(df.iloc[i, j + 1]), 'rural': limpiar(df.iloc[i, j + 2])} for j, a in anios.items()}
D['ipm_dep'] = ipmd
D['ipm_privaciones_dep'] = {cod(k): v for k, v in privaciones(IPD, 'IPM_Indicadores_Departamento ', 1).items() if cod(k)}

# 8. Aseguramiento (registro administrativo, MinSalud) ----------------------
af = json.load(open(EXT / 'minsalud_afiliacion_departamentos.json'))
per = af['periodos']
cob = {}
for c, s in af['datos'].items():
    if c == '00' or c not in af['poblacion_dane']: continue
    for a in range(2013, 2027):
        idx = [i for i, p in enumerate(per) if p.startswith(str(a))]
        if not idx: continue
        i = idx[-1]  # último corte disponible del año
        pob = af['poblacion_dane'][c].get(str(a))
        if not pob: continue
        cob.setdefault(c, {})[a] = {'corte': per[i], 'afiliados': s['total'][i], 'contributivo': s['contributivo'][i],
            'subsidiado': s['subsidiado'][i], 'excepcion': s['excepcion'][i], 'poblacion': pob,
            'cobertura': round(100 * s['total'][i] / pob, 2)}
nac = {}
for a in range(2013, 2027):
    filas = [cob[c][a] for c in cob if a in cob[c]]
    if len(filas) == len(cob):
        t = sum(f['afiliados'] for f in filas); p = sum(f['poblacion'] for f in filas)
        nac[a] = {'corte': filas[0]['corte'], 'afiliados': t, 'poblacion': p, 'cobertura': round(100 * t / p, 2),
                  'contributivo': sum(f['contributivo'] for f in filas), 'subsidiado': sum(f['subsidiado'] for f in filas),
                  'excepcion': sum(f['excepcion'] for f in filas)}
cob['00'] = nac
D['aseg_admin'] = cob

# 9. IPC (base diciembre 2018 = 100): promedio anual -----------------------
ipc = pd.read_csv(EXT / 'ipc_dane_mensual.csv')
ipc['a'] = ipc['periodo'].str[:4].astype(int)
g = ipc.groupby('a')['ipc'].agg(['mean', 'count'])
D['ipc_anual'] = {int(a): round(r['mean'], 4) for a, r in g.iterrows() if r['count'] == 12}

D['nombres_depto'] = {v: k for k, v in COD.items()}
OUT.mkdir(parents=True, exist_ok=True)
json.dump(D, open(OUT / 'datos.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('datos.json', (OUT / 'datos.json').stat().st_size, 'bytes')
for k, v in D.items():
    print(k, list(v)[:6] if isinstance(v, dict) else v)
