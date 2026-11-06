#!/usr/bin/env python
"""Tablero de microdatos GEIH 2025-2026: calcula tablas precalculadas de resúmenes numéricos.

Fase 1: tablas de mercado laboral y salud y tabla de validación (sin ingreso ni pobreza).
Cada cifra se calcula directamente de los microdatos: el navegador no suma ni deriva.
Los microdatos del DANE NUNCA se suben al repositorio; este script solo escribe agregados.

Uso:
  python scripts/02_microdatos.py   # escribe data/micro.json (cámbielo con --salida)

Rutas por argumento o variable de entorno (sin rutas fijas en el código):
  --dta       GEIH_DTA       carpeta con los DTA mensuales
  --anexos    GEIH_ANEXOS    carpeta con los anexos del DANE
  --fex-dpto  GEIH_FEX_DPTO  ruta a TOTAL_25.DTA (catálogo 789)
  --pobreza   GEIH_POBREZA   carpeta de la base 908 (contiene Personas/Personas.dta)

Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co
"""
import argparse
import datetime
import json
import os
import unicodedata

import numpy as np
import openpyxl
import pandas as pd
import pyreadstat

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = 'Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co'
MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
         'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
MESES_DATOS = [(2025, m) for m in range(1, 13)] + [(2026, m) for m in range(1, 9)]
LLAVES = ['DIRECTORIO', 'SECUENCIA_P', 'ORDEN', 'MES']
MODULOS = {
    'C': ('Características_generales,_seguridad_social_en_salud_y_educación',
          ['PER', 'CLASE', 'DPTO', 'AREA', 'FEX_C18', 'P3271', 'P6040', 'P6090', 'P6100', 'P6110',
           'P6170', 'P3042']),
    'F': ('Fuerza_de_trabajo', ['PET', 'FT', 'FFT']),
    'O': ('Ocupados', ['OCI', 'P6430', 'P6920', 'P6930', 'P6940', 'P6450', 'P3045S1', 'P3046', 'P3069',
                       'P6765', 'P3065', 'P3066', 'P3067', 'P3067S1', 'P3067S2', 'P6775', 'P3068',
                       'RAMA2D_R4', 'OFICIO_C8']),
    'N': ('No_ocupados', ['DSI']),
}
TEXTO = {'CLASE', 'DPTO', 'AREA', 'RAMA2D_R4', 'OFICIO_C8'}


def nfc(s):
    return unicodedata.normalize('NFC', s)


def ruta_modulo(carpeta, modulo, anio, mes):
    objetivo = nfc(f'{modulo}_{MESES[mes - 1]}_{anio}.DTA').lower()
    for f in os.listdir(carpeta):
        if nfc(f).lower() == objetivo:
            return os.path.join(carpeta, f)
    raise FileNotFoundError(objetivo)


def normalizar(df):
    """Las llaves llegan como número o como texto según el mes (agosto de 2026): todo a un tipo."""
    for c in df.columns:
        if c in TEXTO:
            df[c] = df[c].astype(str).str.strip().replace({'nan': '', 'None': ''})
        else:
            df[c] = pd.to_numeric(df[c], errors='coerce')
    if 'DPTO' in df:
        df['DPTO'] = df['DPTO'].str.zfill(2)
    return df


def leer_mes(carpeta, anio, mes):
    """Une los cuatro módulos de un mes (llaves de persona) con solo las columnas necesarias."""
    partes = {}
    for k, (modulo, cols) in MODULOS.items():
        d, _ = pyreadstat.read_dta(ruta_modulo(carpeta, modulo, anio, mes), usecols=LLAVES + cols)
        faltan = set(LLAVES + cols) - set(d.columns)
        if faltan:
            raise KeyError(f'{modulo} {anio}-{mes}: faltan {sorted(faltan)}')
        partes[k] = normalizar(d)
        dup = int(partes[k].duplicated(LLAVES).sum())
        if dup:
            raise ValueError(f'{modulo} {anio}-{mes}: {dup} llaves duplicadas')
        if set(partes[k]['MES'].dropna().unique()) != {mes}:
            raise ValueError(f'{modulo} {anio}-{mes}: MES inesperado')
    df = partes['C']
    control = {}
    for k in ('F', 'O', 'N'):
        df = df.merge(partes[k], on=LLAVES, how='left', validate='one_to_one', indicator='_u')
        control[k] = (int((df['_u'] == 'both').sum()), len(partes[k]))
        df = df.drop(columns='_u')
    df['anio'] = anio
    df.attrs['control'] = control
    return df


def informalidad(d, variante='stata'):
    """Traducción del código oficial del DANE (anexo EISS, hojas Código_STATA y Código_SAS).

    Devuelve EI: 1 formal, 0 informal, NaN sin clasificar. En 'stata' gana la última regla que
    aplique; en 'sas' (cadena IF/ELSE) gana la primera. d debe contener solo ocupados.
    """
    def g(c):
        return d[c].to_numpy(dtype='float64')
    P6430, P6765, P3065, P3066, P3067, P3067S1, P3067S2, P6775, P3068, P3069, P3045S1, P3046 = map(
        g, ['P6430', 'P6765', 'P3065', 'P3066', 'P3067', 'P3067S1', 'P3067S2', 'P6775', 'P3068',
            'P3069', 'P3045S1', 'P3046'])
    anios = g('PER') - 1
    of = pd.to_numeric(d['OFICIO_C8'].str[:2], errors='coerce').to_numpy(dtype='float64')
    rama = d['RAMA2D_R4'].isin(['84', '99']).to_numpy()
    a, b = np.isin(P6430, [1, 7]), np.isin(P3045S1, [2, 9])
    ind, c4, c5 = np.isin(P6430, [4, 5]), P6430 == 4, P6430 == 5
    # Stata enumera P6765 = 1..6, 8; SAS usa NOT IN (7), que también admite valores perdidos.
    sin = np.isin(P6765, [1, 2, 3, 4, 5, 6, 8]) if variante == 'stata' else P6765 != 7
    con = P6765 == 7
    e, f = np.isin(P3065, [2, 9]), P3066 == 9
    of_si, of_no = (of >= 0) & (of <= 20), of >= 21
    r1 = con & (P3067 == 1) & (P3067S1 == 2)
    r2 = con & (P3067 == 2)
    reglas = [
        (P6430 == 6, 0), (rama, 1), (P6430 == 8, 0),
        # Asalariados
        (P6430 == 2, 1),
        (a & (P3045S1 == 1), 1), (a & b & (P3046 == 1), 1), (a & b & (P3046 == 2), 0),
        (a & b & (P3046 == 9) & (P3069 >= 4), 1), (a & b & (P3046 == 9) & (P3069 <= 3), 0),
        # Independientes sin negocio
        (ind & sin & (P3065 == 1), 1), (ind & sin & e & (P3066 == 1), 1), (ind & sin & e & (P3066 == 2), 0),
        (c5 & sin & e & f & (P3069 >= 4), 1), (c5 & sin & e & f & (P3069 <= 3), 0),
        (c4 & sin & e & f & of_si, 1), (c4 & sin & e & f & of_no, 0),
        # Con negocio y registro mercantil
        (ind & con & (P3067 == 1) & (P3067S1 == 1) & (P3067S2 >= anios), 1),
        (ind & con & (P3067 == 1) & (P3067S1 == 1) & (P3067S2 < anios), 0),
        (ind & r1 & (P6775 == 1), 1), (ind & r1 & (P6775 == 3) & of_si, 1), (ind & r1 & (P6775 == 3) & of_no, 0),
        (ind & r1 & (P6775 == 2), 0),
        (c4 & r1 & (P6775 == 9) & of_si, 1), (c4 & r1 & (P6775 == 9) & of_no, 0),
        (c5 & r1 & (P6775 == 9) & (P3069 >= 4), 1), (c5 & r1 & (P6775 == 9) & (P3069 <= 3), 0),
        # Con negocio y sin registro mercantil
        (ind & r2 & (P6775 == 1) & (P3068 == 1), 1), (ind & r2 & (P6775 == 1) & (P3068 == 2), 0),
        (ind & r2 & (P6775 == 3) & of_si, 1), (ind & r2 & (P6775 == 3) & of_no, 0),
        (ind & r2 & (P6775 == 1) & np.isin(P3068, [3, 9]), 0), (ind & r2 & (P6775 == 2), 0),
        (c5 & r2 & (P6775 == 9) & (P3069 >= 4), 1), (c5 & r2 & (P6775 == 9) & (P3069 <= 3), 0),
        (c4 & r2 & (P6775 == 9) & of_si, 1), (c4 & r2 & (P6775 == 9) & of_no, 0),
    ]
    formal = np.full(len(d), np.nan)
    if variante == 'stata':
        for cond, v in reglas:
            formal[cond] = v
    else:
        hecho = P6430 == 3  # primera regla SAS: FORMAL=. si P6430=3
        for cond, v in reglas:
            m = cond & ~hecho
            formal[m] = v
            hecho |= m
    asal = np.isin(P6430, [1, 3, 7])
    P6100, P6110, P6450, P6920, P6930, P6940 = map(g, ['P6100', 'P6110', 'P6450', 'P6920', 'P6930', 'P6940'])
    salud = asal & ((np.isin(P6100, [1, 2]) & np.isin(P6110, [1, 2, 4]))
                    | ((P6100 == 9) & (P6450 == 2)) | ((P6110 == 9) & (P6450 == 2)))
    pension = asal & ((P6920 == 3) | ((P6920 == 1) & np.isin(P6930, [1, 2, 3]) & np.isin(P6940, [1, 3])))
    ei = np.zeros(len(d))
    ei[P6430 == 2] = 1
    ei[ind] = formal[ind]
    ei[asal & salud & pension] = 1
    ei[rama & np.isin(P6430, [1, 2, 3, 4, 5, 7])] = 1
    if variante == 'sas':
        ei[~np.isin(P6430, [1, 2, 3, 4, 5, 6, 7, 8])] = np.nan
    return ei


# Agregación -----------------------------------------------------------------------------------
ZONAS = {'1': 'cab', '2': 'rur'}
SEXOS = {1: 'h', 2: 'm'}
EDAD_LIM = [0, 15, 25, 35, 45, 55, 65, 200]
EDAD_ETQ = ['0-14', '15-24', '25-34', '35-44', '45-54', '55-64', '65+']
# Grupos más amplios en los cubos departamentales (confidencialidad)
EDAD_DPTO_LIM = [0, 15, 29, 45, 65, 200]
EDAD_DPTO_ETQ = ['0-14', '15-28', '29-44', '45-64', '65+']
# Agrupación de P3042 aprobada por los autores. Los códigos 0 (agosto de 2026), 99 y vacíos: nsnr.
EDUC = {1: 'ninguno', 2: 'ninguno', 3: 'primaria', 4: 'secundaria', 5: 'media', 6: 'media', 7: 'media',
        8: 'superior', 9: 'superior', 10: 'superior', 11: 'superior', 12: 'superior', 13: 'superior'}
AREA13 = ['05', '08', '11', '13', '17', '23', '50', '52', '54', '66', '68', '73', '76']  # 13 ciudades y A.M.
AREA_NO23 = ['81', '85', '86', '88', '91', '94', '95', '97', '99']  # capitales fuera de las 23 ciudades
BOGOTA = '11'
INDICADORES = ['pet', 'ft', 'oc', 'ds', 'inf', 'cot', 'oc_afil', 'oc_contrib', 'oc_especial', 'oc_subsid',
               'pob', 'afil', 'no_afil', 'afil_nsnr', 'contrib', 'especial', 'subsid', 'reg_nsnr',
               'pob1528', 'nini']


def variables(d):
    """Dimensiones e indicadores 0/1 por persona. Se compara con ==1 porque agosto de 2026
    codifica como 0 lo que en los demás meses viene vacío."""
    o = d['OCI'] == 1
    out = pd.DataFrame(index=d.index)
    out['anio'], out['mes'] = d['anio'], d['MES'].astype(int)
    out['dpto'], out['area'] = d['DPTO'], d['AREA']
    out['zona'] = d['CLASE'].map(ZONAS)
    out['sexo'] = d['P3271'].map(SEXOS)
    out['edad'] = pd.cut(d['P6040'], EDAD_LIM, right=False, labels=EDAD_ETQ).astype(str)
    out['edad_dpto'] = pd.cut(d['P6040'], EDAD_DPTO_LIM, right=False, labels=EDAD_DPTO_ETQ).astype(str)
    out['educ'] = d['P3042'].map(EDUC).fillna('nsnr')
    out['fex'] = d['FEX_C18']
    out['pet'], out['ft'], out['oc'], out['ds'] = d['PET'] == 1, d['FT'] == 1, o, d['DSI'] == 1
    ei = np.full(len(d), np.nan)
    if o.any():
        ei[o.to_numpy()] = informalidad(d[o], 'stata')
    out['inf'] = ei == 0
    out['cot'] = o & (d['P6920'] == 1)
    out['oc_afil'] = o & (d['P6090'] == 1)
    for k, val in {'oc_contrib': 1, 'oc_especial': 2, 'oc_subsid': 3}.items():
        out[k] = o & (d['P6090'] == 1) & (d['P6100'] == val)
    out['pob'] = True
    out['afil'] = d['P6090'] == 1
    out['no_afil'] = d['P6090'] == 2
    out['afil_nsnr'] = ~d['P6090'].isin([1, 2])
    out['contrib'] = out['afil'] & (d['P6100'] == 1)
    out['especial'] = out['afil'] & (d['P6100'] == 2)
    out['subsid'] = out['afil'] & (d['P6100'] == 3)
    out['reg_nsnr'] = out['afil'] & ~d['P6100'].isin([1, 2, 3])
    joven = d['P6040'].between(15, 28)
    out['pob1528'] = joven
    out['nini'] = joven & ~o & (d['P6170'] == 2)  # no ocupado y no asiste a institución educativa
    return out


def agregar(v, dims, peso='fex'):
    """Suma ponderada (w_*) y conteo sin ponderar (n_*) de cada indicador por dims."""
    x = v[dims].copy()
    pesos = v[peso].fillna(0).to_numpy()
    for k in INDICADORES:
        ind = v[k].to_numpy()
        x['n_' + k] = ind.astype('int32')
        x['w_' + k] = ind * pesos
    return x.groupby(dims, observed=True, sort=False).sum().reset_index()


# Factor departamental ---------------------------------------------------------------------------
def leer_factores(ruta):
    """TOTAL_25 (catálogo 789): factor anual, 12 meses, 23 departamentos, sin Bogotá. No se divide."""
    t, _ = pyreadstat.read_dta(ruta)
    t = normalizar(t)
    ctrl = {'registros': len(t), 'meses': int(t['MES'].nunique()), 'departamentos': int(t['DPTO'].nunique()),
            'bogota_incluida': bool((t['DPTO'] == BOGOTA).any()), 'suma_FEX_DPTO': round(float(t['FEX_DPTO'].sum())),
            'llaves_duplicadas': int(t.duplicated(LLAVES).sum())}
    return t, ctrl


def comparar_908(ruta_personas, t):
    """Compara fex_dpto (base 908) con FEX_DPTO (TOTAL_25) registro por registro."""
    p, _ = pyreadstat.read_dta(ruta_personas, usecols=['directorio', 'secuencia_p', 'orden', 'mes', 'dpto', 'fex_dpto'])
    p['dpto'] = p['dpto'].astype(str).str.strip()
    j = p.merge(t, left_on=['directorio', 'secuencia_p', 'orden', 'mes'], right_on=LLAVES, how='outer', indicator=True)
    b = j[j['_merge'] == 'both']
    solo = j[j['_merge'] == 'left_only']
    return {'registros_908': len(p), 'en_ambas': len(b), 'solo_908': len(solo), 'solo_TOTAL_25': int((j['_merge'] == 'right_only').sum()),
            'solo_908_dpto': sorted(solo['dpto'].unique().tolist()),
            'dif_abs_max': float((b['fex_dpto'] - b['FEX_DPTO']).abs().max()),
            'suma_fex_dpto_908': round(float(p['fex_dpto'].sum())), 'suma_fex_dpto_bogota_908': round(float(solo['fex_dpto'].sum())),
            'dpto_908_es_nombre': not p['dpto'].str.fullmatch(r'\d+').all()}


def asignar_departamental(v, d, t, mes):
    """Prevalecen DPTO y FEX_DPTO de TOTAL_25 (Bogotá rural figura allí como Cundinamarca, y así
    se replica la cifra oficial). Bogotá restante: FEX_C18/12. Amazonía-Orinoquía y San Andrés quedan fuera."""
    t1 = t[t['MES'] == mes][LLAVES[:3] + ['FEX_DPTO', 'DPTO']].rename(columns={'DPTO': 'DT'})
    k = d[LLAVES[:3]].merge(t1, on=LLAVES[:3], how='left')
    if len(k) != len(d) or k['FEX_DPTO'].notna().sum() != len(t1):
        raise ValueError(f'Cruce con TOTAL_25 incompleto en el mes {mes}')
    con = k['FEX_DPTO'].notna().to_numpy()
    bog = (~con) & (v['dpto'] == BOGOTA).to_numpy()
    w = v.copy()
    w['dpto_d'] = np.where(con, k['DT'].to_numpy(), np.where(bog, BOGOTA, ''))
    w['fexd'] = np.where(con, k['FEX_DPTO'].to_numpy(), np.where(bog, v['fex'].to_numpy() / 12, np.nan))
    return w[con | bog].drop(columns='dpto').rename(columns={'dpto_d': 'dpto'})


# Tablas precalculadas ---------------------------------------------------------------------------
PERIODOS = [('2025', lambda x: x['anio'] == 2025, 12),
            ('ene-ago 2025', lambda x: (x['anio'] == 2025) & (x['mes'] <= 8), 8),
            ('ene-ago 2026', lambda x: x['anio'] == 2026, 8)]
DOMINIOS = [('nacional', None), ('cabeceras', 'cab'), ('rural', 'rur')]
DESAG_NAC = {'total': [], 'sexo': ['sexo'], 'edad': ['edad'], 'educ': ['educ'], 'sexo_edad': ['sexo', 'edad'], 'sexo_educ': ['sexo', 'educ']}
DESAG_DEP = {'total': [], 'sexo': ['sexo'], 'zona': ['zona'], 'edad': ['edad'], 'educ': ['educ']}
EDUC_ORD = ['ninguno', 'primaria', 'secundaria', 'media', 'superior', 'sin_dato']
MIN_CONTEO = 10
SECUNDARIA_EN_PRECISION = True
UMBRAL = 300
# Clave de cada fila: nivel, dominio, periodo, dpto, zona, sexo, edad, educ. '*' significa «todos».
K = ['nivel', 'dominio', 'periodo', 'dpto', 'zona', 'sexo', 'edad', 'educ']


def familias(nivel):
    """Grupos de cifras que se derivan entre sí: se suprimen juntas por confidencialidad.
    Cada figura: (nombre, indicador numerador, indicador denominador)."""
    if nivel == 'nac':
        sal_fig = [('afil', 'afil', 'pob'), ('contrib', 'contrib_sd', 'pob'), ('especial', 'especial', 'pob'), ('subsid', 'subsid', 'pob')]
        sal_con = ['n_pob', 'n_afil', 'n_contrib_sd', 'n_especial', 'n_subsid']
    else:
        sal_fig = [('afil', 'afil', 'pob'), ('contrib_especial', 'contrib_esp', 'pob'), ('subsid', 'subsid', 'pob')]
        sal_con = ['n_pob', 'n_afil', 'n_contrib_esp', 'n_subsid']
    return [
        {'id': 'laboral', 'base': 'n_pet', 'figuras': [('tgp', 'ft', 'pet'), ('to', 'oc', 'pet'), ('td', 'ds', 'ft')],
         'conteos': ['n_pet', 'n_ft', 'n_oc', 'n_ds'], 'difs': [('n_pet', 'n_ft')]},
        {'id': 'informalidad', 'base': 'n_oc', 'figuras': [('inf', 'inf', 'oc')], 'conteos': ['n_oc', 'n_inf'], 'difs': [('n_oc', 'n_inf')]},
        {'id': 'pension', 'base': 'n_oc', 'figuras': [('cot_pension', 'cot', 'oc')], 'conteos': ['n_oc', 'n_cot'], 'difs': [('n_oc', 'n_cot')]},
        {'id': 'salud_ocupados', 'base': 'n_oc', 'figuras': [('oc_afil', 'oc_afil', 'oc')], 'conteos': ['n_oc', 'n_oc_afil'], 'difs': [('n_oc', 'n_oc_afil')]},
        {'id': 'nini', 'base': 'n_pob1528', 'figuras': [('nini', 'nini', 'pob1528')], 'conteos': ['n_pob1528', 'n_nini'], 'difs': [('n_pob1528', 'n_nini')], 'sin_edad': True},
        {'id': 'salud', 'base': 'n_pob', 'figuras': sal_fig, 'conteos': sal_con, 'difs': [('n_pob', 'n_afil')], 'educ_propia': True},
    ]


def preparar(df):
    """Agrupación de los «no sabe» de salud: no se publican por separado porque se derivarían con conteos de 1 a 9."""
    df = df.copy()
    for p in ('n_', 'w_'):
        df[p + 'contrib_sd'] = df[p + 'contrib'] + df[p + 'reg_nsnr']
        df[p + 'contrib_esp'] = df[p + 'contrib'] + df[p + 'especial'] + df[p + 'reg_nsnr']
    return df


def por_periodo(df, dims):
    salida = []
    for etq, filtro, k in PERIODOS:
        x = df[filtro(df)].groupby(dims, observed=True).sum(numeric_only=True).reset_index()
        pesos = [c for c in x.columns if c.startswith('w_')]
        x[pesos] = x[pesos] / k
        salida.append(x.assign(periodo=etq))
    return pd.concat(salida, ignore_index=True)


def educ_familia(df, f):
    """Salud: los sin dato son sobre todo menores de 3 años (categoría propia). Laboral y ni-ni: los pocos
    registros sin dato van con «ninguno»; si no, total menos la suma por educación los revelaría."""
    x = df.copy()
    x['educ'] = x['educ'].replace({'nsnr': 'sin_dato' if f.get('educ_propia') else 'ninguno'})
    return x


def filas_familia(pn, dep, f_nac, f_dep):
    """Calcula directamente cada cifra de cada tabla. Devuelve un DataFrame con la clave K y los agregados."""
    filas = []

    def agrega(x, dims, base, clave):
        x = x.rename(columns={'edad_dpto': 'edad'})
        cols = [c for c in x.columns if c.startswith(('n_', 'w_'))]
        if dims:
            g = x.groupby(dims, observed=True)[cols].sum().reset_index()
        else:
            g = x[cols].sum().to_frame().T
        g = g[g[base] > 0]
        for c, v in clave.items():
            g[c] = v
        for c in ('zona', 'sexo', 'edad', 'educ'):
            if c not in g:
                g[c] = '*'
        filas.append(g)

    px = educ_familia(pn, f_nac)
    for dom, z in DOMINIOS:
        for etq, _, _ in PERIODOS:
            x = px[(px['periodo'] == etq) & ((px['zona'] == z) if z else True)]
            for tb, dims in DESAG_NAC.items():
                if f_nac.get('sin_edad') and 'edad' in dims:
                    continue
                agrega(x, dims, f_nac['base'], {'tabla': 'nacional.' + tb, 'nivel': 'nac', 'dominio': dom, 'periodo': etq, 'dpto': '*'})
    dx = educ_familia(dep, f_dep)
    for c in sorted(dx['dpto'].unique()):
        x = dx[dx['dpto'] == c].drop(columns='edad').rename(columns={'edad_dpto': 'edad'}) if 'edad' in dx else dx[dx['dpto'] == c]
        for tb, dims in DESAG_DEP.items():
            if f_dep.get('sin_edad') and 'edad' in dims:
                continue
            agrega(x, dims, f_dep['base'], {'tabla': 'departamental.' + tb, 'nivel': 'dep', 'dominio': '*', 'periodo': '*', 'dpto': c})
    return pd.concat(filas, ignore_index=True)


def restricciones(r):
    """Igualdades contables entre filas: padre = suma de hijos. Cada una es un grupo de supresión secundaria."""
    claves = {tuple(f): i for i, f in enumerate(r[K].itertuples(index=False, name=None))}
    grupos = {}
    pos = {c: K.index(c) for c in K}
    for k, i in claves.items():
        for d in ('zona', 'sexo', 'edad', 'educ'):
            if k[pos[d]] != '*':
                p = list(k)
                p[pos[d]] = '*'
                p = tuple(p)
                if p in claves:
                    grupos.setdefault((p, d), []).append(i)
        if k[0] == 'nac' and k[pos['dominio']] != 'nacional':  # nacional = cabeceras + rural
            p = list(k)
            p[pos['dominio']] = 'nacional'
            p = tuple(p)
            if p in claves:
                grupos.setdefault((p, 'dominio'), []).append(i)
    return [(claves[p], hijos) for (p, _), hijos in grupos.items()]


def en_rango(x):
    return (x >= 1) & (x < MIN_CONTEO)


def viola_fila(s, base, conteos, difs):
    r = s[base] < MIN_CONTEO
    for c in conteos:
        r = r or bool(en_rango(s[c]))
    for a, b in difs:
        r = r or bool(en_rango(s[a] - s[b]))
    return bool(r)


def suprimir_familia(r, f_por_nivel):
    """Confidencialidad: primaria (conteo de 1 a 9, directo o por resta) y secundaria por grupo y por márgenes,
    hasta llegar a un punto fijo. Marca toda la familia de la fila."""
    r['conf'] = False
    for niv, f in f_por_nivel.items():
        m = (r['nivel'] == niv)
        p = r[m][f['base']] < MIN_CONTEO
        for c in f['conteos']:
            p = p | en_rango(r[m][c])
        for a, b in f['difs']:
            p = p | en_rango(r[m][a] - r[m][b])
        r.loc[m, 'conf'] = p
    r['conf_primaria'] = r['conf']
    grupos = restricciones(r)
    conf = r['conf'].to_numpy().copy()
    tablas = r['nivel'].to_numpy()
    registros = r.to_dict('records')
    # 2025 menos ene-ago 2025 da los conteos de sep-dic: tampoco pueden quedar entre 1 y 9.
    pos = {tuple(x[c] for c in K): i for i, x in enumerate(registros)}
    pares = []
    for i, x in enumerate(registros):
        if x['nivel'] == 'nac' and x['periodo'] == '2025':
            j = pos.get(tuple('ene-ago 2025' if c == 'periodo' else x[c] for c in K))
            if j is not None:
                pares.append((i, j))
    cambio = True
    while cambio:
        cambio = False
        f = f_por_nivel['nac']
        for i, j in pares:
            if conf[i] or conf[j]:
                continue
            a, b = registros[i], registros[j]
            if any(en_rango(a[c] - b[c]) for c in f['conteos']) or any(en_rango((a[p] - b[p]) - (a[q] - b[q])) for p, q in f['difs']):
                conf[j] = True  # se reserva el período más corto
                cambio = True
        for padre, hijos in grupos:
            f = f_por_nivel[tablas[padre]]
            base = f['base']
            sup = [i for i in hijos if conf[i]] + ([padre] if conf[padre] else [])
            if not sup:
                continue
            forzar = len(sup) == 1
            # Con el padre conocido, la suma de los hijos suprimidos se obtiene por resta.
            if not forzar and not conf[padre]:
                suma = {c: sum(registros[i][c] for i in sup) for c in set(f['conteos']) | {base} | {x for d in f['difs'] for x in d}}
                forzar = viola_fila(suma, base, f['conteos'], f['difs'])
            if forzar:
                libres = [i for i in hijos if not conf[i]]
                if libres:
                    conf[min(libres, key=lambda i: registros[i][base])] = True
                    cambio = True
                elif not conf[padre]:
                    conf[padre] = True
                    cambio = True
    r['conf'] = conf
    return r


def secundaria_precision(r, figura, den, grupos):
    """Supresión secundaria también sobre las cifras de precisión insuficiente (solo esa cifra)."""
    marca = ((r['n_' + den] < UMBRAL) | r['conf']).to_numpy().copy()
    origen = marca.copy()
    ns = r['n_' + den].to_numpy()
    cambio = True
    while cambio:
        cambio = False
        for padre, hijos in grupos:
            sup = [i for i in hijos if marca[i]] + ([padre] if marca[padre] else [])
            if len(sup) == 1:
                libres = [i for i in hijos if not marca[i]]
                if libres:
                    marca[min(libres, key=lambda i: ns[i])] = True
                    cambio = True
                elif not marca[padre]:
                    marca[padre] = True
                    cambio = True
    return marca & ~origen


def construir_tablas(nac, dep, sec_prec=False):
    """Devuelve tablas publicables, controles por tabla y los valores por clave para validar."""
    pn = preparar(por_periodo(nac, ['zona', 'sexo', 'edad', 'educ']))
    dp = preparar(dep.groupby(['dpto', 'zona', 'sexo', 'edad_dpto', 'educ'], observed=True).sum(numeric_only=True).reset_index())
    salida, control, resultado = {}, {}, {}
    for f_nac, f_dep in zip(familias('nac'), familias('dep')):
        r = filas_familia(pn, dp, f_nac, f_dep)
        r = suprimir_familia(r, {'nac': f_nac, 'dep': f_dep})
        grupos = restricciones(r)
        for niv, f in (('nac', f_nac), ('dep', f_dep)):
            m = (r['nivel'] == niv).to_numpy()
            for fig, num, den in f['figuras']:
                extra = secundaria_precision(r, fig, den, grupos) if sec_prec else np.zeros(len(r), dtype=bool)
                for i in np.flatnonzero(m):
                    q = r.iloc[i]
                    n_den = int(q['n_' + den])
                    if q['conf'] or extra[i]:
                        est = 'P' if n_den < UMBRAL else 'C'
                    elif n_den < UMBRAL:
                        est = 'P'
                    else:
                        est = None
                    causa = 'primaria' if q['conf_primaria'] else ('secundaria' if (q['conf'] or extra[i]) else ('precision' if est else 'publicada'))
                    clave = tuple(q[c] for c in K)
                    w_den = float(q['w_' + den])
                    val = est if est else [n_den, int(round(w_den)), round(100 * float(q['w_' + num]) / w_den, 4), round(100 * int(q['n_' + num]) / n_den, 4)]
                    salida.setdefault(q['tabla'], {}).setdefault(clave, {})[fig] = val
                    c = control.setdefault(q['tabla'], {'cifras': 0, 'publicadas': 0, 'precision': 0, 'primaria': 0, 'secundaria': 0})
                    c['cifras'] += 1
                    c[causa if causa != 'publicada' else 'publicadas'] += 1
                    resultado[(clave, fig)] = val
    return salida, control, resultado


def serializar(salida, valores):
    """Formato: dims, medidas, filas = [índices de dims..., una entrada por medida].
    Entrada: [n del denominador, población representada, valor ponderado, valor sin ponderar]; 'P' = precisión
    insuficiente; 'C' = reservada por confidencialidad; null = no aplica. Las reservadas no llevan ningún número."""
    tablas = {}
    for nombre, filas in salida.items():
        nivel, tb = nombre.split('.')
        dims = (['dominio', 'periodo'] if nivel == 'nacional' else ['dpto']) + (DESAG_NAC if nivel == 'nacional' else DESAG_DEP)[tb]
        medidas = list(dict.fromkeys(m for f in filas.values() for m in f))
        lista = []
        for clave, fig in filas.items():
            d = dict(zip(K, clave))
            nom_dim = {'edad': 'edad' if nivel == 'nacional' else 'edad_dpto'}
            lista.append([valores[nom_dim.get(x, x)].index(d[x]) for x in dims] + [fig.get(m) for m in medidas])
        tablas[nombre] = {'dims': [('edad_dpto' if (x == 'edad' and nivel == 'departamental') else x) for x in dims], 'medidas': medidas, 'filas': lista}
    return tablas


def clave_dep(c, zona='*', sexo='*', edad='*', educ='*'):
    return ('dep', '*', '*', c, zona, sexo, edad, educ)


def clave_nac(dom, per, sexo='*', edad='*', educ='*'):
    return ('nac', dom, per, '*', '*', sexo, edad, educ)


# Validación ---------------------------------------------------------------------------------------
TOLERANCIA = 0.1


def fila_val(grupo, periodo, propia, oficial, fuente):
    dif = None if oficial is None else round(propia - oficial, 4)
    return {'grupo': grupo, 'periodo': periodo, 'propia': round(float(propia), 4),
            'oficial': None if oficial is None else round(float(oficial), 4), 'diferencia': dif, 'fuente': fuente}


def etiqueta_trim(w):
    (a1, m1), (a3, m3) = w[0], w[2]
    return f'{a1}-{m1:02d} a {a3}-{m3:02d}'


def validar(mensual, dep, oficial, anexos):
    filas = []
    tab = {g: x.groupby(['anio', 'mes']).sum(numeric_only=True).sort_index() for g, x in mensual.groupby('g')}
    nac = tab['nac']
    lab = oficial['lab_mensual']['Total Nacional']
    fuente_td = 'data/datos.json lab_mensual, anexo GEIH ago-2026'
    for a, m in nac.index:
        filas.append(fila_val('TD nacional mensual (%)', f'{a}-{m:02d}', 100 * nac.loc[(a, m), 'w_ds'] / nac.loc[(a, m), 'w_ft'], lab['TD'][f'{a}-{m:02d}'], fuente_td))
    for et, col in [('PT', 'w_pob'), ('PET', 'w_pet'), ('FT', 'w_ft'), ('OC', 'w_oc'), ('DS', 'w_ds')]:
        for a, m in nac.index:
            filas.append(fila_val(f'{et} nacional mensual (miles)', f'{a}-{m:02d}', nac.loc[(a, m), col] / 1000, lab[et][f'{a}-{m:02d}'], fuente_td))
    g = dep.groupby('dpto').sum(numeric_only=True)
    for c in g.index:
        if c == BOGOTA:
            continue
        filas.append(fila_val('TD departamental 2025 (%)', c, 100 * g.loc[c, 'w_ds'] / g.loc[c, 'w_ft'], oficial['lab_depto']['total'][c]['TD']['2025'], 'data/datos.json lab_depto, anexo departamental 2025'))
    wb = openpyxl.load_workbook(os.path.join(anexos, 'anex-GEIH-ago2026.xlsx'), read_only=True, data_only=True)
    r = list(wb['Año_móvil_32_ciudades'].iter_rows(values_only=True))
    i0 = next(i for i, x in enumerate(r) if x[0] and str(x[0]).strip().startswith('Bogotá'))
    col = next(j for j, v in enumerate(r[i0 + 3]) if v and str(v).replace(' ', '').lower() == 'ene-dic25')
    td_b = next(x[col] for x in r[i0 + 3:i0 + 25] if x[0] and 'desocupaci' in str(x[0]).lower())
    filas.append(fila_val('TD Bogotá 2025 con FEX_C18/12 (%)', '11', 100 * g.loc[BOGOTA, 'w_ds'] / g.loc[BOGOTA, 'w_ft'], float(td_b), 'anexo GEIH ago-2026, hoja Año_móvil_32_ciudades, ene-dic 25'))
    ventanas = list(zip(MESES_DATOS, MESES_DATOS[1:], MESES_DATOS[2:]))
    pct = oficial['seg_social_ocupados']['nacional']['porcentajes']

    def trim(x, num):
        return [(w, 100 * sum(x.loc[i, num] for i in w) / sum(x.loc[i, 'w_oc'] for i in w)) for w in ventanas]
    for et, gr, col_ in [('Afiliada a salud', '% ocupados afiliados a salud, trim. móvil', 'w_oc_afil'),
                         ('Régimen contributivo', '% ocupados régimen contributivo, trim. móvil', 'w_oc_contrib'),
                         ('Régimen especial', '% ocupados régimen especial, trim. móvil', 'w_oc_especial'),
                         ('Régimen subsidiado', '% ocupados régimen subsidiado, trim. móvil', 'w_oc_subsid'),
                         ('Cotiza a pensión', '% ocupados que cotizan a pensión, trim. móvil', 'w_cot')]:
        for w, v in trim(nac, col_):
            a, m = w[2]
            filas.append(fila_val(gr, etiqueta_trim(w), v, pct[et][f'{a}-{m:02d}'], 'data/datos.json seg_social_ocupados, anexo EISS jun-ago 2026'))
    wb = openpyxl.load_workbook(os.path.join(anexos, 'anex-GEIHEISS-jun-ago2026.xlsx'), read_only=True, data_only=True)
    r = list(wb['Prop informalidad'].iter_rows(values_only=True))
    for fila, g_, nom in [(12, 'nac', 'nacional'), (13, 'c13', '13 ciudades'), (14, 'c23', '23 ciudades')]:
        for (w, v), o in zip(trim(tab[g_], 'w_inf'), r[fila][49:67]):
            filas.append(fila_val(f'% informalidad {nom}, trim. móvil', etiqueta_trim(w), v, float(o), 'anexo EISS jun-ago 2026, hoja Prop informalidad'))
    return filas


def resumen(filas):
    out = []
    for gr in dict.fromkeys(f['grupo'] for f in filas):
        d = [abs(f['diferencia']) for f in filas if f['grupo'] == gr and f['diferencia'] is not None]
        tol = 0.5 if '(miles)' in gr else TOLERANCIA
        out.append({'grupo': gr, 'comparaciones': len(d), 'dif_abs_max': round(float(max(d)), 4), 'replica': bool(max(d) <= tol)})
    return out


def extraer(a):
    """Lee los microdatos y devuelve solo agregados en memoria (no escribe registros individuales)."""
    t, ctrl_t = leer_factores(a.fex_dpto)
    ctrl_908 = comparar_908(os.path.join(a.pobreza, 'Personas', 'Personas.dta'), t)
    print('TOTAL_25', ctrl_t, '\n908 vs TOTAL_25', ctrl_908, flush=True)
    mensual, nac, dep = [], [], []
    for anio, mes in MESES_DATOS:
        d = leer_mes(a.dta, anio, mes)
        if not all(x == y for x, y in d.attrs['control'].values()):
            raise ValueError(f'Cruce de módulos incompleto en {anio}-{mes}: {d.attrs["control"]}')
        v = variables(d)
        if v['zona'].isna().any() or v['sexo'].isna().any():
            raise ValueError(f'{anio}-{mes}: zona o sexo sin clasificar')
        if not (v['ft'] == (v['oc'] | v['ds'])).all():
            raise ValueError(f'{anio}-{mes}: FT distinto de OCI + DSI')
        mensual.append(agregar(v, ['anio', 'mes']).assign(g='nac'))
        mensual.append(agregar(v[v['area'].isin(AREA13)], ['anio', 'mes']).assign(g='c13'))
        mensual.append(agregar(v[(v['area'] != '') & ~v['area'].isin(AREA_NO23)], ['anio', 'mes']).assign(g='c23'))
        nac.append(agregar(v, ['anio', 'mes', 'zona', 'sexo', 'edad', 'educ']))
        if anio == 2025:
            dep.append(agregar(asignar_departamental(v, d, t, mes), ['dpto', 'zona', 'sexo', 'edad_dpto', 'educ'], 'fexd'))
        print(anio, mes, len(d), flush=True)
    return pd.concat(mensual), pd.concat(nac), pd.concat(dep), ctrl_t, ctrl_908


def validar_tablas(res, oficial, valores, anexos):
    """Compara la cifra PUBLICADA en las tablas (no la de los microdatos) con la oficial."""
    filas, no_pub = [], {}

    def compara(grupo, per, clave, fig, ofi, fuente):
        v = res.get((clave, fig))
        if isinstance(v, list):
            filas.append(fila_val(grupo, per, v[2], ofi, fuente))
        else:
            no_pub.setdefault(grupo, []).append(per)
    ld = oficial['lab_depto']
    for c in valores['dpto']:
        if c == BOGOTA:
            continue
        f = 'data/datos.json lab_depto, anexo departamental 2025'
        for fig, ofi in (('td', 'TD'), ('tgp', 'TGP'), ('to', 'TO')):
            compara(f'Tablas: {ofi} departamental 2025 (%)', c, clave_dep(c), fig, ld['total'][c][ofi]['2025'], f)
            compara(f'Tablas: {ofi} departamental 2025, hombres (%)', c, clave_dep(c, sexo='h'), fig, ld['hombres'][c][ofi]['2025'], f)
            compara(f'Tablas: {ofi} departamental 2025, mujeres (%)', c, clave_dep(c, sexo='m'), fig, ld['mujeres'][c][ofi]['2025'], f)
            compara(f'Tablas: {ofi} departamental 2025, cabeceras (%)', c, clave_dep(c, zona='cab'), fig, ld['cabeceras'][c][ofi]['2025'], f)
            compara(f'Tablas: {ofi} departamental 2025, centros poblados y rural (%)', c, clave_dep(c, zona='rur'), fig, ld['rural'][c][ofi]['2025'], f)
    an = oficial['lab_anual']
    compara('Tablas: TD anual 2025 (oficial con 2 decimales) (%)', 'nacional', clave_nac('nacional', '2025'), 'td', an['Total Nacional']['2025']['TD'], 'data/datos.json lab_anual')
    compara('Tablas: TD anual 2025 (oficial con 2 decimales) (%)', 'cabeceras', clave_nac('cabeceras', '2025'), 'td', an['Total Cabeceras']['2025']['TD'], 'data/datos.json lab_anual')
    return filas, no_pub


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    e = os.environ.get
    ap.add_argument('--dta', default=e('GEIH_DTA'))
    ap.add_argument('--anexos', default=e('GEIH_ANEXOS'))
    ap.add_argument('--fex-dpto', default=e('GEIH_FEX_DPTO'))
    ap.add_argument('--pobreza', default=e('GEIH_POBREZA'))
    ap.add_argument('--salida', default=os.path.join(RAIZ, 'data', 'micro.json'))
    a = ap.parse_args()
    if not all([a.dta, a.anexos, a.fex_dpto, a.pobreza]):
        ap.error('Faltan rutas: use argumentos o GEIH_DTA, GEIH_ANEXOS, GEIH_FEX_DPTO y GEIH_POBREZA.')
    oficial = json.load(open(os.path.join(RAIZ, 'data', 'datos.json'), encoding='utf-8'))
    mensual, nac, dep, ctrl_t, ctrl_908 = extraer(a)
    salida = publicar(mensual, nac, dep, ctrl_t, ctrl_908, oficial, a.anexos)
    os.makedirs(os.path.dirname(os.path.abspath(a.salida)), exist_ok=True)
    temporal = a.salida + '.tmp'
    with open(temporal, 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(temporal, a.salida)
    print('\nRESUMEN')
    for r in salida['validacion_resumen']:
        print(r)
    print('no publicadas en validación:', salida['meta']['controles']['validacion_no_publicadas'])
    print('tamaño JSON (bytes):', os.path.getsize(a.salida))
    for k, v in salida['meta']['controles']['supresion'].items():
        print(' ', k, v)


def publicar(mensual, nac, dep, ctrl_t, ctrl_908, oficial, anexos, sec_prec=SECUNDARIA_EN_PRECISION):
    filas = validar(mensual, dep, oficial, anexos)
    valores = {'dominio': [d[0] for d in DOMINIOS], 'periodo': [p[0] for p in PERIODOS], 'dpto': sorted(dep['dpto'].unique().tolist()),
               'zona': ['cab', 'rur'], 'sexo': ['h', 'm'], 'edad': EDAD_ETQ, 'edad_dpto': EDAD_DPTO_ETQ, 'educ': EDUC_ORD}
    tb, control, res = construir_tablas(nac, dep, sec_prec)
    filas_t, no_pub = validar_tablas(res, oficial, valores, anexos)
    filas += filas_t
    nsnr = int(nac[nac['educ'] == 'nsnr']['n_pet'].sum())
    return {
        'meta': {
            'generado': datetime.date.today().isoformat(), 'fuente': FUENTE,
            'calculo': 'Cálculo propio a partir de microdatos GEIH (catálogos ANDA 853, 900 y 789). Cada cifra se calcula directamente de los microdatos: el navegador no suma.',
            'formato': 'filas = [índices de dims..., una entrada por medida]. Entrada: [n del denominador, población representada, valor ponderado %, valor sin ponderar %]; "P" = precisión insuficiente; "C" = reservada por confidencialidad; null = no aplica.',
            'medidas': {'tgp': 'FT/PET', 'to': 'ocupados/PET', 'td': 'desocupados/FT', 'inf': 'informales/ocupados (código oficial DANE, anexo EISS)', 'cot_pension': 'P6920=1/ocupados',
                        'oc_afil': 'P6090=1/ocupados', 'nini': '15-28 años no ocupados y con P6170=2 / población de 15-28 (cálculo propio, sin cifra oficial en los anexos)',
                        'afil': 'P6090=1/población total', 'contrib': 'contributivo y afiliados sin dato de régimen / población total', 'especial': 'régimen especial / población total',
                        'subsid': 'subsidiado / población total', 'contrib_especial': 'contributivo, especial y sin dato de régimen / población total (solo departamental)'},
            'reglas': {'precision': f'Denominador con menos de {UMBRAL} encuestas: "P".', 'confidencialidad': f'Todo conteo publicado o derivable por resta debe ser 0 o al menos {MIN_CONTEO}. Las cifras que se derivan entre sí (TGP, TO, TD; regímenes de salud) se suprimen juntas.',
                       'secundaria': 'Dentro de cada grupo (cada padre con sus hijos, incluido nacional = cabeceras + rural) no puede quedar una sola cifra reservada ni un residuo con conteos de 1 a 9.',
                       'motivo_umbral': 'Los archivos no traen variables de estrato ni conglomerado: no es posible calcular CV por linealización de Taylor. Criterio propio de prudencia.'},
            'notas': ['Nacional usa FEX_C18/12 (2025) y FEX_C18/8 (ene-ago). Departamental usa FEX_DPTO (catálogo 789, anual, sin dividir) y Bogotá FEX_C18/12.',
                      'Agrupación de «no sabe» en salud: los afiliados sin dato de régimen van en contributivo; quienes no informan afiliación quedan dentro de población menos afiliados.',
                      f'Registros sin nivel educativo: en laboral y ni-ni, los {nsnr} registros de PET sin dato en los 20 meses se agrupan con «ninguno» (decisión de los autores), porque publicarlos aparte los haría identificables por resta contra el total. No es una imputación. En salud, «sin_dato» es una categoría propia, sobre todo menores de 3 años.',
                      'Departamental: solo 2025 y 24 entidades (23 departamentos y Bogotá). Amazonía-Orinoquía y San Andrés no tienen factor departamental. En TOTAL_25 los registros rurales de Bogotá figuran en Cundinamarca; se conserva para replicar la cifra oficial.',
                      'Representatividad: 2026 no se desagrega por departamento. Ingresos y pobreza no se incluyen en esta fase.',
                      'Agosto de 2026: factores ajustados por el DANE por el sismo del 10 de agosto.'],
            'controles': {'TOTAL_25': ctrl_t, 'fex_dpto_908_vs_TOTAL_25': ctrl_908, 'supresion': control, 'informalidad_incluida': True, 'validacion_no_publicadas': no_pub}},
        'dims': valores, 'tablas': serializar(tb, valores), 'validacion_resumen': resumen(filas), 'validacion': filas}


if __name__ == '__main__':
    main()
