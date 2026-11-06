#!/usr/bin/env python
"""Pestaña «Trabajo, protección y contribución»: tablas precalculadas desde los microdatos GEIH 2025-2026.

Cada cifra se calcula de los microdatos y se protege en el archivo; el navegador solo la busca.
Los microdatos del DANE NUNCA se suben al repositorio. Este script escribe únicamente agregados.

Uso (rutas por argumento o por las variables GEIH_DTA, GEIH_ANEXOS, GEIH_FEX_DPTO y GEIH_POBREZA):
  python scripts/03_trabajo.py          # escribe data/trabajo.json; cámbielo con --salida

Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co
"""
import argparse
import datetime
import importlib.util
import json
import os
import time
from collections import Counter, OrderedDict

import numpy as np
import openpyxl
import pandas as pd
import pyreadstat

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_e = importlib.util.spec_from_file_location('micro', os.path.join(RAIZ, 'scripts', '02_microdatos.py'))
B0 = importlib.util.module_from_spec(_e)
_e.loader.exec_module(B0)
FUENTE = B0.FUENTE

UMBRAL, MIN = 300, 10
UNIDAD = 10            # los niveles se publican en decenas de personas u hogares
P_, C_, NA_ = -1, -2, -3
SM = {2025: 1423500, 2026: 1750905}    # Decreto 1572 de 2024; Decreto 1469 de 2025


def jornada_legal(anio, mes):
    """Ley 2101 de 2021: 46 h desde el 15-jul-2024, 44 h desde el 15-jul-2025, 42 h desde el 15-jul-2026.
    La encuesta se fecha por mes: julio se asigna al límite anterior, porque el cambio ocurre a mitad de mes."""
    if anio == 2025:
        return 46 if mes <= 7 else 44
    return 44 if mes <= 7 else 42


# Dimensiones -------------------------------------------------------------------------------------
PERIODOS = OrderedDict([('a', ('2025', lambda a, m: a == 2025, 12)),
                        ('b', ('ene-ago 2025', lambda a, m: (a == 2025) & (m <= 8), 8)),
                        ('c', ('ene-ago 2026', lambda a, m: a == 2026, 8))])
DOMINIOS = OrderedDict([('n', None), ('k', 1), ('r', 2)])
EDAD_LIM, EDAD_N = [15, 29, 45, 65, 200], 4
EDUC_MAPA = {1: 0, 2: 0, 3: 1, 4: 2, 5: 3, 6: 3, 7: 3, 8: 4, 9: 4, 10: 4, 11: 4, 12: 4, 13: 4}
POS_MAPA = {1: 0, 2: 1, 3: 2, 7: 2, 4: 3, 5: 4, 6: 5, 8: 5}


def rama_grupo(r):
    """Agrupa CIIU rev. 4 a dos dígitos en 10 categorías."""
    if r <= 3: return 0        # Agro
    if r <= 9 or 35 <= r <= 39: return 1   # Minas, electricidad, gas y agua
    if r <= 33: return 2       # Manufactura
    if r <= 43: return 3       # Construcción
    if r <= 47: return 4       # Comercio
    if r <= 53: return 5       # Transporte
    if r <= 56: return 6       # Alojamiento y comida
    if r <= 82: return 7       # Información, finanzas, inmobiliarias, profesionales y administrativas
    if r <= 88: return 8       # Administración pública, educación y salud
    return 9                   # Otros servicios y hogares


FILTROS = OrderedDict([('s', 2), ('e', 4), ('u', 5), ('p', 6), ('m', 10), ('f', 2)])  # s sexo, e edad, u educ, p posición, m rama, f formal
PARES = [('s', 'e'), ('s', 'u'), ('s', 'p'), ('s', 'm'), ('s', 'f'), ('f', 'e'), ('f', 'u'), ('f', 'p'), ('f', 'm'), ('e', 'u')]


# Lectura -----------------------------------------------------------------------------------------
EXTRA_O = ['P6800', 'P7090', 'P7120', 'P7040', 'P6990', 'P9450', 'P6440', 'P6460', 'INGLABO']
COL_T = ['P3368', 'P3369', 'P3370', 'P3371']


def extraer(a):
    """Devuelve agregables por persona y por hogar. Todo queda en memoria; no se escribe ningún registro."""
    n, cols = B0.MODULOS['O']
    B0.MODULOS['O'] = (n, cols + [c for c in EXTRA_O if c not in cols])
    t, ctrl_t = B0.leer_factores(a.fex_dpto)
    per, _ = pyreadstat.read_dta(os.path.join(a.pobreza, 'Personas', 'Personas.dta'), usecols=['directorio', 'secuencia_p', 'orden', 'mes', 'impa', 'impaes'])
    hog, _ = pyreadstat.read_dta(os.path.join(a.pobreza, 'Hogares', 'Hogares.dta'), usecols=['directorio', 'secuencia_p', 'mes', 'nper', 'npersug', 'clase', 'ingpcug', 'lp', 'li', 'pobre', 'indigente', 'fex_c', 'fex_dpto', 'dpto', 'dominio'])
    filas, hogs = [], []
    for anio, mes in B0.MESES_DATOS:
        d = B0.leer_mes(a.dta, anio, mes)
        if not all(x == y for x, y in d.attrs['control'].values()):
            raise ValueError(f'Cruce incompleto {anio}-{mes}: {d.attrs["control"]}')
        o = d['OCI'] == 1
        ei = np.full(len(d), np.nan)
        ei[o.to_numpy()] = B0.informalidad(d[o], 'stata')
        x = pd.DataFrame({'anio': anio, 'mes': mes, 'DIRECTORIO': d['DIRECTORIO'], 'SECUENCIA_P': d['SECUENCIA_P'], 'ORDEN': d['ORDEN']})
        x['clase'] = d['CLASE'].astype(int).to_numpy()
        x['fex'] = d['FEX_C18'].to_numpy()
        x['area'] = d['AREA'].to_numpy()
        for c in ['P3271', 'P6040', 'P6090', 'P6100', 'P6920', 'P6800', 'P7090', 'P7120', 'P7040', 'P6990', 'P9450', 'P6430', 'P6440', 'P6450', 'P6460', 'P3069', 'INGLABO', 'P3042']:
            x[c] = d[c].to_numpy()
        x['rama'] = pd.to_numeric(d['RAMA2D_R4'], errors='coerce').to_numpy()
        x['pet'], x['ft'], x['oc'], x['ds'] = (d['PET'] == 1).to_numpy(), (d['FT'] == 1).to_numpy(), o.to_numpy(), (d['DSI'] == 1).to_numpy()
        x['formal'] = ei
        x['ing908'] = np.nan
        x['dpto_d'], x['w_dep'] = '', np.nan
        if anio == 2025:
            w = B0.asignar_departamental(pd.DataFrame({'dpto': d['DPTO'], 'fex': d['FEX_C18']}), d, t, mes)
            x.loc[w.index, 'dpto_d'] = w['dpto'].to_numpy()
            x.loc[w.index, 'w_dep'] = w['fexd'].to_numpy()
            pm = per[per['mes'] == mes]
            k = d[B0.LLAVES[:3]].merge(pm, left_on=B0.LLAVES[:3], right_on=['directorio', 'secuencia_p', 'orden'], how='left')
            ing = k['impa'].where(k['impa'] > 0, k['impaes'])
            x['ing908'] = ing.to_numpy()
            x['en908'] = k['directorio'].notna().to_numpy()
        else:
            x['en908'] = False
        filas.append(x)
        tx, _ = pyreadstat.read_dta(B0.ruta_modulo(a.dta, 'Otros_ingresos_e_impuestos', anio, mes), usecols=B0.LLAVES + COL_T)
        tx = B0.normalizar(tx)
        tx = tx.assign(anio=anio, mes=mes)
        hh, _ = pyreadstat.read_dta(B0.ruta_modulo(a.dta, 'Datos_del_hogar_y_la_vivienda', anio, mes), usecols=['DIRECTORIO', 'SECUENCIA_P', 'MES', 'FEX_C18', 'CLASE'])
        hh = B0.normalizar(hh)
        hh['anio'], hh['mes'] = anio, mes
        hh['clase'] = hh['CLASE'].astype(int)
        hogs.append((tx, hh))
        print(anio, mes, len(x), flush=True)
    return pd.concat(filas, ignore_index=True), hogs, hog, ctrl_t


# Definición de celdas ----------------------------------------------------------------------------
def construir_celdas(x):
    """Cada celda es un indicador 0/1 por persona. Publicar=False: complemento que solo sirve para proteger."""
    o = x['oc'].to_numpy()
    anio, mes = x['anio'].to_numpy(), x['mes'].to_numpy()
    h = x['P6800'].to_numpy(dtype='float64')
    sm = np.where(anio == 2025, SM[2025], SM[2026]).astype('float64')
    legal = np.array([jornada_legal(a, m) for a, m in zip(anio, mes)], dtype='float64')
    inglabo = x['INGLABO'].to_numpy(dtype='float64')
    ing_dec = np.where(np.isin(inglabo, [98, 99]) | ~(inglabo > 0), np.nan, inglabo)
    ing = np.where(anio == 2025, x['ing908'].to_numpy(dtype='float64'), ing_dec)
    ing = np.where(ing > 0, ing, np.nan)
    r = ing / sm
    rh = r * legal / h
    ibk = lambda v: np.select([v < .5, v < .95, v <= 1.05, v < 2, v <= 4, v > 4], [0, 1, 2, 3, 4, 5], default=6)
    ib, ihb = ibk(r), ibk(rh)
    hist = np.where(np.isnan(r), -1, np.minimum((r / .25).astype('float64'), 12))
    hist = np.where(np.isnan(r), -1, np.floor(np.nan_to_num(hist)))
    j = np.select([h < 20, h < 48], [0, 1], default=2)
    hb = np.select([h < 10, h < 20, h < 30, h < 40, h < 48, h == 48, h < 60], [0, 1, 2, 3, 4, 5, 6], default=7)
    cot = o & (x['P6920'].to_numpy() == 1)
    pen = o & (x['P6920'].to_numpy() == 3)
    form, inf = o & (x['formal'].to_numpy() == 1), o & (x['formal'].to_numpy() == 0)
    pos = x['P6430'].to_numpy()
    # «otro» y sin remuneración van con independientes: por separado se derivarían por resta con 1 a 9 encuestas
    emp, ind = o & np.isin(pos, [1, 2, 3, 7]), o & ~np.isin(pos, [1, 2, 3, 7])
    edad = x['P6040'].to_numpy()
    C = OrderedDict()

    def add(n, m, pub=True):
        C[n] = (np.asarray(m, dtype=bool), pub)
    # Flujo
    add('pt', np.ones(len(x), bool)); add('men', edad < 15); add('pet', x['pet']); add('ft', x['ft']); add('fft', x['pet'].to_numpy() & ~x['ft'].to_numpy())
    add('oc', o); add('ds', x['ds']); add('form', form); add('inf', inf)
    for k in range(3):
        add(f'j{k}', o & (j == k)); add(f'fj{k}', form & (j == k)); add(f'nj{k}', inf & (j == k))
        add(f'jc{k}', cot & (j == k)); add(f'jn{k}', o & ~cot & (j == k))
    add('cot', cot); add('noc', o & ~cot)
    for k in range(7):
        add(f'i{k}', o & (ib == k)); add(f'ci{k}', cot & (ib == k)); add(f'ni{k}', o & ~cot & (ib == k))
    # Escalera de protección
    p6100 = x['P6100'].to_numpy()
    for n, m in (('sal', o & (p6100 == 1)), ('arl', o & (x['P6990'].to_numpy() == 1)), ('caj', o & (x['P9450'].to_numpy() == 1)), ('afs', o & (x['P6090'].to_numpy() == 1))):
        add(n, m); add(n + '_', o & ~m, False)
    # Horas (P6800, horas normales)
    for k in range(8):
        add(f'h{k}', o & (hb == k))
    add('h49', o & (h > 48)); add('h49_', o & ~(h > 48), False)
    add('leg', o & (h > legal)); add('leg_', o & ~(h > legal), False)
    sub = o & (x['P7090'].to_numpy() == 1) & (x['P7120'].to_numpy() == 1) & (h < 48)
    add('sub', sub); add('sub_', o & ~sub, False)
    seg = o & (x['P7040'].to_numpy() == 1)
    add('seg', seg); add('seg_', o & ~seg, False)
    # Ingreso frente al salario mínimo
    add('emp', emp); add('ind', ind)
    for k in range(7):
        add(f'ie{k}', emp & (ib == k)); add(f'ii{k}', ind & (ib == k))
        for q in range(3):
            add(f'ij{q}{k}', o & (j == q) & (ib == k))
        add(f'ih{k}', o & (ihb == k))
    for k in range(13):
        add(f'g{k}', o & (hist == k))
    # Situaciones especiales
    o65 = o & (edad >= 65)
    sinp = o65 & ~cot & ~pen
    add('o65', o65); add('o65_', o & ~o65, False); add('o65s', sinp); add('o65c', o65 & ~sinp, False)
    add('pen', pen); add('nnp', o & ~cot & ~pen, False)
    add('infs', inf & (p6100 == 3)); add('infs_', inf & ~(p6100 == 3), False)
    tiene, escr, t6460 = x['P6440'].to_numpy() == 1, x['P6450'].to_numpy() == 2, x['P6460'].to_numpy()
    tc = np.select([o & tiene & escr & (t6460 == 1), o & tiene & escr & (t6460 == 2), o & tiene], [0, 1, 2], default=3)
    tam = x['P3069'].to_numpy()
    te = np.select([tam == 1, tam <= 4, tam <= 7], [0, 1, 2], default=3)   # 1; 2-10; 11-50; 51 o más
    for k in range(4):
        add(f'tc{k}', o & (tc == k)); add(f'tcc{k}', cot & (tc == k)); add(f'tcn{k}', o & ~cot & (tc == k), False)
        add(f'te{k}', o & (te == k)); add(f'tec{k}', cot & (te == k)); add(f'ten{k}', o & ~cot & (te == k), False)
    G = []
    def g(p, *ch):
        G.append((p, list(ch)))
    g('pt', 'men', 'pet'); g('pet', 'ft', 'fft'); g('ft', 'oc', 'ds'); g('oc', 'form', 'inf')
    g('oc', 'j0', 'j1', 'j2'); g('form', 'fj0', 'fj1', 'fj2'); g('inf', 'nj0', 'nj1', 'nj2'); g('oc', 'cot', 'noc')
    g('cot', 'jc0', 'jc1', 'jc2'); g('noc', 'jn0', 'jn1', 'jn2')
    for k in range(3):
        g(f'j{k}', f'fj{k}', f'nj{k}'); g(f'j{k}', f'jc{k}', f'jn{k}')
        g(f'j{k}', *[f'ij{k}{q}' for q in range(7)])
    g('oc', *[f'i{k}' for k in range(7)]); g('cot', *[f'ci{k}' for k in range(7)]); g('noc', *[f'ni{k}' for k in range(7)])
    g('oc', 'emp', 'ind'); g('emp', *[f'ie{k}' for k in range(7)]); g('ind', *[f'ii{k}' for k in range(7)])
    for k in range(7):
        g(f'i{k}', f'ci{k}', f'ni{k}'); g(f'i{k}', f'ie{k}', f'ii{k}'); g(f'i{k}', *[f'ij{q}{k}' for q in range(3)])
    g('oc', *[f'ih{k}' for k in range(7)]); g('oc', 'i6', *[f'g{k}' for k in range(13)])
    for n in ('sal', 'arl', 'caj', 'afs', 'h49', 'leg', 'sub', 'seg', 'o65'):
        g('oc', n, n + '_')
    g('oc', *[f'h{k}' for k in range(8)]); g('j0', 'h0', 'h1'); g('h49', 'h6', 'h7'); g('j2', 'h5', 'h6', 'h7')
    g('o65', 'o65s', 'o65c'); g('noc', 'pen', 'nnp'); g('inf', 'infs', 'infs_')
    g('oc', *[f'tc{k}' for k in range(4)]); g('oc', *[f'te{k}' for k in range(4)])
    g('cot', *[f'tcc{k}' for k in range(4)]); g('cot', *[f'tec{k}' for k in range(4)]); g('noc', *[f'tcn{k}' for k in range(4)]); g('noc', *[f'ten{k}' for k in range(4)])
    for k in range(4):
        g(f'tc{k}', f'tcc{k}', f'tcn{k}'); g(f'te{k}', f'tec{k}', f'ten{k}')
    extras = {'h': h, 'ing': ing, 'rm': r, 'ing_dec': ing_dec}
    return C, G, extras


def vista_de(n):
    """Vista de la pestaña a la que pertenece cada celda (para el informe de supresiones)."""
    if n in ('sal', 'arl', 'caj', 'afs') or n.rstrip('_') in ('sal', 'arl', 'caj', 'afs'):
        return 'Protección'
    if n in ('h49', 'leg', 'sub', 'seg') or (n[0] == 'h' and n[1:].isdigit()):
        return 'Horas'
    if n in ('emp', 'ind') or n[:2] in ('ie', 'ii', 'ij', 'ih') or (n[0] == 'g' and n[1:].isdigit()) or (n[0] == 'i' and n[1:].isdigit()):
        return 'Ingreso'
    if n.startswith(('o65', 'pen', 'infs', 'tc', 'te')):
        return 'Situaciones especiales'
    return 'Flujo'


# Motor de supresión ------------------------------------------------------------------------------
def proteger(N, grupos, pares=()):
    """N: conteos sin ponderar (arreglo plano). grupos: (padre, [hijos]) con padre = suma de hijos.
    Devuelve causa por celda: 0 publicada, 1 precisión, 2 confidencialidad primaria, 3 secundaria."""
    causa = np.zeros(len(N), dtype='int8')
    causa[(N >= 1) & (N < MIN)] = 2
    for p, hs in grupos:
        if N[p] < UMBRAL:
            for h in hs:
                if causa[h] == 0 and N[h] > 0:
                    causa[h] = 1
    cambio, vueltas = True, 0
    while cambio:
        cambio, vueltas = False, vueltas + 1
        for a, b in pares:
            if causa[a] == 0 and causa[b] == 0 and 1 <= N[a] - N[b] < MIN:
                causa[b] = 3
                cambio = True
        for p, hs in grupos:
            res = [h for h in hs if causa[h]]
            total = len(res) + (1 if causa[p] else 0)
            if not total:
                continue
            forzar = total == 1
            if not forzar and not causa[p]:
                forzar = 1 <= sum(int(N[h]) for h in res) < MIN
            if forzar:
                libres = [h for h in hs if not causa[h] and N[h] > 0]
                if libres:
                    causa[min(libres, key=lambda h: N[h])] = 3
                    cambio = True
                elif not causa[p] and N[p] > 0 and (res or total == 1):
                    if len(res) >= 1 and forzar and total == 1:
                        causa[p] = 3
                        cambio = True
    print('  punto fijo en', vueltas, 'vueltas', flush=True)
    return causa


# Cálculo por estado ------------------------------------------------------------------------------
def mediana_pond(v, w):
    if len(v) == 0 or w.sum() <= 0:
        return None
    o = np.argsort(v, kind='stable')
    c = np.cumsum(w[o])
    return float(v[o][np.searchsorted(c, c[-1] / 2)])


def claves_estados(dptos):
    out = []
    singles = [(f, v) for f, c in FILTROS.items() for v in range(c)]
    for per in PERIODOS:
        for dom in DOMINIOS:
            out.append((per, dom, ()))
            out += [(per, dom, ((f, v),)) for f, v in singles]
        for f1, f2 in PARES:
            for v1 in range(FILTROS[f1]):
                for v2 in range(FILTROS[f2]):
                    out.append((per, 'n', ((f1, v1), (f2, v2))))
    for d in dptos:
        out.append(('a', 'D' + d, ()))
        out += [('a', 'D' + d, ((f, v),)) for f, v in singles]
    return out


def clave_txt(per, ter, fil):
    return '.'.join([per, ter] + [f'{f}{v}' for f, v in sorted(fil)])


def calcular(x, C, ext):
    t0 = time.time()
    nombres = list(C)
    M = np.column_stack([C[n][0] for n in nombres])
    print('matriz', M.shape, round(M.nbytes / 1e6), 'MB', flush=True)
    anio, mes, clase = x['anio'].to_numpy(), x['mes'].to_numpy(), x['clase'].to_numpy()
    fex, wd = x['fex'].to_numpy(), x['w_dep'].to_numpy()
    dpto = x['dpto_d'].to_numpy()
    edad = x['P6040'].to_numpy()
    cod = {
        's': x['P3271'].map({1: 0, 2: 1}).fillna(-1).to_numpy('int8'),
        'e': np.where(edad < 15, -1, np.digitize(edad, EDAD_LIM) - 1).astype('int8'),
        'u': np.where(edad < 15, -1, x['P3042'].map(EDUC_MAPA).fillna(0)).astype('int8'),
        'p': x['P6430'].map(POS_MAPA).fillna(-1).to_numpy('int8'),
        'm': np.where(np.isnan(x['rama'].to_numpy()), -1, [rama_grupo(r) if r == r else -1 for r in x['rama'].to_numpy()]).astype('int8'),
        'f': np.where(x['oc'].to_numpy(), np.where(x['formal'].to_numpy() == 1, 0, 1), -1).astype('int8'),
    }
    dptos = sorted(d for d in pd.unique(dpto) if d)
    estados = claves_estados(dptos)
    S, K = len(estados), len(nombres)
    N = np.zeros((S, K), dtype='int32')
    W = np.zeros((S, K))
    NA = np.zeros((S, K), dtype=bool)
    i_pre = [nombres.index(c) for c in ('pt', 'men', 'pet', 'ft', 'fft', 'ds')]
    i_pt = [nombres.index(c) for c in ('pt', 'men')]
    med = np.full((S, 2), np.nan)
    i_oc = nombres.index('oc')
    h, ing, oc = ext['h'], ext['ing'], x['oc'].to_numpy()
    base = {}
    for i, (per, ter, fil) in enumerate(estados):
        if (per, ter) not in base:
            _, cond, k = PERIODOS[per]
            m = cond(anio, mes)
            if ter.startswith('D'):
                m = m & (dpto == ter[1:]) & ~np.isnan(wd)
            elif DOMINIOS[ter] is not None:
                m = m & (clase == DOMINIOS[ter])
            base[(per, ter)] = (np.flatnonzero(m), k)
        ix, k = base[(per, ter)]
        for f, v in fil:
            ix = ix[cod[f][ix] == v]
        w = (wd[ix] if ter.startswith('D') else fex[ix] / k)
        for a in range(0, len(ix), 40000):
            bl = M[ix[a:a + 40000]]
            N[i] += bl.sum(0)
            W[i] += w[a:a + 40000] @ bl
        fs = {f for f, _ in fil}
        if fs & {'p', 'm', 'f'}:
            NA[i, i_pre] = True
        elif fs & {'e', 'u'}:
            NA[i, i_pt] = True
        o_ = oc[ix]
        if o_.sum() >= UMBRAL:
            med[i, 0] = mediana_pond(h[ix][o_], w[o_])
            ii = o_ & ~np.isnan(ing[ix])
            if ii.sum() >= UMBRAL:
                med[i, 1] = mediana_pond(ing[ix][ii], w[ii])
        if i % 200 == 0:
            print(' estado', i, 'de', S, round(time.time() - t0), 's', flush=True)
    return estados, nombres, N, W, NA, med


def grupos_lattice(estados, nombres, NA, G):
    """Grupos dentro de cada estado, entre filtros, nacional = cabeceras + rural, y parejas de período."""
    S, K = len(estados), len(nombres)
    pos = {n: i for i, n in enumerate(nombres)}
    id_ = lambda s, k: s * K + k
    mapa = {(p, t, tuple(sorted(f))): i for i, (p, t, f) in enumerate(estados)}
    grupos, pares = [], []
    Gi = [(pos[p], [pos[h] for h in hs]) for p, hs in G]
    for s in range(S):
        for p, hs in Gi:
            if not NA[s, p]:
                grupos.append((id_(s, p), [id_(s, h) for h in hs if not NA[s, h]]))
    for s, (per, ter, fil) in enumerate(estados):
        for f, _ in fil:
            resto = tuple(sorted(x for x in fil if x[0] != f))
            padre = mapa.get((per, ter, resto))
            if padre is None:
                continue
            hijos = [mapa[(per, ter, tuple(sorted(resto + ((f, v),))))] for v in range(FILTROS[f])]
            if s != hijos[0]:
                continue
            for k in range(K):
                if not NA[hijos[0], k] and not NA[padre, k]:
                    grupos.append((id_(padre, k), [id_(h, k) for h in hijos]))
        if ter == 'n':
            a, b = mapa.get((per, 'k', tuple(sorted(fil)))), mapa.get((per, 'r', tuple(sorted(fil))))
            if a is not None and b is not None:
                for k in range(K):
                    if not NA[s, k]:
                        grupos.append((id_(s, k), [id_(a, k), id_(b, k)]))
        if per == 'a' and not ter.startswith('D'):
            o = mapa.get(('b', ter, tuple(sorted(fil))))
            if o is not None:
                pares += [(id_(s, k), id_(o, k)) for k in range(K) if not NA[s, k]]
    print('grupos', len(grupos), 'pares', len(pares), flush=True)
    return grupos, pares


# Hogares: impuestos y matriz de contribución -----------------------------------------------------
def tabla_hogares(x, hogs):
    """Une impuestos y cotización por hogar. 98 = pagó sin saber el valor; 99 y 9 = sin información; 0 = no pagó."""
    filas = []
    cot = x[x['oc'] & (x['P6920'] == 1)].groupby(['anio', 'mes', 'DIRECTORIO', 'SECUENCIA_P']).size().rename('cot')
    dep = x[x['w_dep'].notna()].groupby(['mes', 'DIRECTORIO', 'SECUENCIA_P']).agg(dpto=('dpto_d', 'first'), w_dep=('w_dep', 'first'))
    for tx, hh in hogs:
        anio = int(hh['anio'].iloc[0])
        q = pd.DataFrame({'DIRECTORIO': tx['DIRECTORIO'], 'SECUENCIA_P': tx['SECUENCIA_P']})
        pr = tx['P3368'].to_numpy(); va = tx['P3369'].to_numpy()
        q['pre'] = (pr >= 1000) | (pr == 98)
        q['pre9'] = pr == 99
        q['val'] = (va >= 1000) | (va == 98)
        q['val9'] = va == 99
        q['veh'] = tx['P3370'].to_numpy() == 1
        q['veh9'] = tx['P3370'].to_numpy() == 9
        q['ren'] = tx['P3371'].to_numpy() == 1
        q['ren9'] = tx['P3371'].to_numpy() == 9
        q = q.groupby(['DIRECTORIO', 'SECUENCIA_P']).any().reset_index()
        h = hh.merge(q, on=['DIRECTORIO', 'SECUENCIA_P'], how='left')
        h[q.columns[2:]] = h[q.columns[2:]].fillna(False).astype(bool)
        filas.append(h[['anio', 'mes', 'DIRECTORIO', 'SECUENCIA_P', 'clase', 'FEX_C18'] + list(q.columns[2:])])
    H = pd.concat(filas, ignore_index=True)
    H = H.merge(cot, left_on=['anio', 'mes', 'DIRECTORIO', 'SECUENCIA_P'], right_index=True, how='left')
    H['cotiza'] = H['cot'].notna()
    a25 = H['anio'] == 2025
    H = H.merge(dep, left_on=['mes', 'DIRECTORIO', 'SECUENCIA_P'], right_index=True, how='left')
    H.loc[~a25, ['dpto', 'w_dep']] = ['', np.nan]
    H['alguno'] = H[['pre', 'val', 'veh', 'ren']].any(axis=1)
    return H


TAX = ['pre', 'val', 'veh', 'ren']
TAX_CELDAS = ['hog'] + [c for t in TAX for c in (t, t + '9', t + '_')] + ['mcc', 'mco', 'mim', 'mno']


def mascaras_tax(H):
    m = {'hog': np.ones(len(H), bool)}
    for t in TAX:
        si, nd = H[t].to_numpy(), H[t + '9'].to_numpy() & ~H[t].to_numpy()
        m[t], m[t + '9'], m[t + '_'] = si, nd, ~si & ~nd
    co, al = H['cotiza'].to_numpy(), H['alguno'].to_numpy()
    m['mcc'], m['mco'], m['mim'], m['mno'] = co & al, co & ~al, ~co & al, ~co & ~al
    return m


TAX_G = [('hog', [t, t + '9', t + '_']) for t in TAX] + [('hog', ['mcc', 'mco', 'mim', 'mno'])]


def impuestos(H, dptos):
    claves = [(p, d) for p in PERIODOS for d in DOMINIOS] + [('a', 'D' + d) for d in dptos]
    K = len(TAX_CELDAS); N = np.zeros((len(claves), K), 'int32'); W = np.zeros((len(claves), K))
    m = mascaras_tax(H)
    M = np.column_stack([m[c] for c in TAX_CELDAS])
    an, me, cl, fx, dp, wd = (H[c].to_numpy() for c in ('anio', 'mes', 'clase', 'FEX_C18', 'dpto', 'w_dep'))
    for i, (p, t) in enumerate(claves):
        _, cond, k = PERIODOS[p]
        s = cond(an, me)
        if t.startswith('D'):
            s = s & (dp == t[1:]) & ~np.isnan(wd.astype('float64'))
            w = wd[s].astype('float64')
        else:
            if DOMINIOS[t] is not None:
                s = s & (cl == DOMINIOS[t])
            w = fx[s] / k
        N[i] = M[s].sum(0); W[i] = w @ M[s]
    idx = {c: j for j, c in enumerate(claves)}
    gr, pa = [], []
    pos = {c: j for j, c in enumerate(TAX_CELDAS)}
    # En departamentos, «sin información» va con «no pagó»: aparte, 1 a 9 hogares reservarían todo el impuesto
    for i, c in enumerate(claves):
        if c[1].startswith('D'):
            for t in TAX:
                N[i, pos[t + '_']] += N[i, pos[t + '9']]; W[i, pos[t + '_']] += W[i, pos[t + '9']]
                N[i, pos[t + '9']] = 0; W[i, pos[t + '9']] = 0
    for i, c in enumerate(claves):
        for p, hs in TAX_G:
            gr.append((i * K + pos[p], [i * K + pos[h] for h in hs]))
        if c[1] == 'n':
            for k in range(K):
                gr.append((i * K + k, [idx[(c[0], 'k')] * K + k, idx[(c[0], 'r')] * K + k]))
        if c[0] == 'a' and not c[1].startswith('D'):
            pa += [(i * K + k, idx[('b', c[1])] * K + k) for k in range(K)]
    causa = proteger(N.ravel(), gr, pa).reshape(N.shape)
    return claves, N, W, causa


# Deciles -----------------------------------------------------------------------------------------
def cortes(v, w):
    o = np.argsort(v, kind='stable')
    c = np.cumsum(w[o])
    return [float(v[o][np.searchsorted(c, c[-1] * q / 10)]) for q in range(1, 10)]


def deciles(hog, x, H):
    """Deciles de personas por el ingreso per cápita de la unidad de gasto (ingpcug), ponderados por factor × nper."""
    h = hog.copy()
    h['dp'] = h['dpto'].astype(str).str.strip()
    a = x[x['anio'] == 2025]
    agg = a[a['oc']].assign(inf=lambda q: q['formal'] == 0, cot=lambda q: q['P6920'] == 1)
    tax = H[H['anio'] == 2025][['mes', 'DIRECTORIO', 'SECUENCIA_P'] + TAX + [t + '9' for t in TAX] + ['cotiza', 'alguno']]
    h = h.merge(tax, left_on=['mes', 'directorio', 'secuencia_p'], right_on=['mes', 'DIRECTORIO', 'SECUENCIA_P'], how='left')
    h[TAX + [t + '9' for t in TAX] + ['cotiza', 'alguno']] = h[TAX + [t + '9' for t in TAX] + ['cotiza', 'alguno']].fillna(False).astype(bool)
    oc = agg[['mes', 'DIRECTORIO', 'SECUENCIA_P', 'inf', 'cot']]
    nombres_dep = {v: k for k, v in NOM_DP.items()}
    scopes = [('n', np.ones(len(h), bool), 'fex_c'), ('k', h['clase'].to_numpy() == 1, 'fex_c'), ('r', h['clase'].to_numpy() == 2, 'fex_c')]
    for d in sorted(h['dp'].unique()):
        scopes.append(('D' + nombres_dep[d], h['dp'].to_numpy() == d, 'fex_dpto'))
    CEL = ['per', 'hog', 'ocu', 'inf', 'inf_', 'cot', 'cot_'] + [c for t in TAX for c in (t, t + '9', t + '_')] + ['mcc', 'mco', 'mim', 'mno']
    K, R = len(CEL), len(scopes) * 11
    N, W = np.zeros((R, K), 'int32'), np.zeros((R, K))
    pos = {c: j for j, c in enumerate(CEL)}
    limites, medias = {}, {}
    mt = mascaras_tax(h.assign(hog=True))
    for si, (sc, mask, fx) in enumerate(scopes):
        q = h[mask]
        w = q[fx].to_numpy(); nper = q['nper'].to_numpy(); v = q['ingpcug'].to_numpy()
        wp = w * nper
        cc = cortes(v, wp)
        dec = np.searchsorted(cc, v, side='left')
        limites[sc] = [round(c) for c in cc]
        hogkey = q[['mes', 'directorio', 'secuencia_p']].assign(_d=dec, _w=w)
        ocu = oc.merge(hogkey, left_on=['mes', 'DIRECTORIO', 'SECUENCIA_P'], right_on=['mes', 'directorio', 'secuencia_p'], how='inner')
        medias[sc] = []
        for d in range(11):
            s = (dec == d) if d < 10 else np.ones(len(q), bool)
            o_ = ocu[ocu['_d'] == d] if d < 10 else ocu
            r = si * 11 + d
            N[r, pos['per']] = nper[s].sum(); W[r, pos['per']] = wp[s].sum()
            N[r, pos['hog']] = s.sum(); W[r, pos['hog']] = w[s].sum()
            medias[sc].append(round(float((wp[s] * v[s]).sum() / wp[s].sum()), -3) if wp[s].sum() else None)
            for c, m in (('ocu', np.ones(len(o_), bool)), ('inf', o_['inf'].to_numpy()), ('inf_', ~o_['inf'].to_numpy()), ('cot', o_['cot'].to_numpy()), ('cot_', ~o_['cot'].to_numpy())):
                N[r, pos[c]] = m.sum(); W[r, pos[c]] = o_['_w'].to_numpy()[m].sum()
            for c in CEL[7:]:
                m = mt[c][mask][s]
                N[r, pos[c]] = m.sum(); W[r, pos[c]] = w[s][m].sum()
            for t in TAX:   # por decil, «sin información» va con «no pagó»
                N[r, pos[t + '_']] += N[r, pos[t + '9']]; W[r, pos[t + '_']] += W[r, pos[t + '9']]
                N[r, pos[t + '9']] = 0; W[r, pos[t + '9']] = 0
    gr = []
    for si in range(len(scopes)):
        for d in range(11):
            r = si * 11 + d
            gr.append((r * K + pos['ocu'], [r * K + pos['inf'], r * K + pos['inf_']]))
            gr.append((r * K + pos['ocu'], [r * K + pos['cot'], r * K + pos['cot_']]))
            for t in TAX:
                gr.append((r * K + pos['hog'], [r * K + pos[t], r * K + pos[t + '9'], r * K + pos[t + '_']]))
            gr.append((r * K + pos['hog'], [r * K + pos[c] for c in ('mcc', 'mco', 'mim', 'mno')]))
        tot = si * 11 + 10
        for j in range(K):
            gr.append((tot * K + j, [(si * 11 + d) * K + j for d in range(10)]))
    causa = proteger(N.ravel(), gr).reshape(N.shape)
    return [s[0] for s in scopes], CEL, N, W, causa, limites, medias


NOM_DP = {'05': 'Antioquia', '08': 'Atlántico', '11': 'Bogotá D.C.', '13': 'Bolívar', '15': 'Boyacá', '17': 'Caldas', '18': 'Caquetá', '19': 'Cauca', '20': 'Cesar', '23': 'Córdoba', '25': 'Cundinamarca', '27': 'Chocó', '41': 'Huila', '44': 'La Guajira', '47': 'Magdalena', '50': 'Meta', '52': 'Nariño', '54': 'Norte de Santander', '63': 'Quindío', '66': 'Risaralda', '68': 'Santander', '70': 'Sucre', '73': 'Tolima', '76': 'Valle del Cauca'}


# Validación --------------------------------------------------------------------------------------
def gini(x, w):
    o = np.argsort(x)
    x, w = x[o], w[o]
    cw, cxw = np.cumsum(w), np.cumsum(x * w)
    return float(1 - np.sum((cxw[1:] + cxw[:-1]) * np.diff(cw)) / (cxw[-1] * cw[-1]))


def fila(gr, per, propia, oficial, fuente):
    return {'grupo': gr, 'periodo': per, 'propia': round(float(propia), 4), 'oficial': None if oficial is None else round(float(oficial), 4), 'diferencia': None if oficial is None else round(float(propia) - float(oficial), 4), 'fuente': fuente}


def validar(x, hog, ofi, anexos, valor):
    fl = []
    v = lambda c: x[c].to_numpy()
    meses = B0.MESES_DATOS
    tab = {}
    for (a, m), g in x[x['oc']].groupby(['anio', 'mes']):
        w = g['fex'].to_numpy()
        tab[(a, m)] = dict(oc=w.sum(), inf=w[g['formal'].to_numpy() == 0].sum(), cot=w[g['P6920'].to_numpy() == 1].sum(), afi=w[g['P6090'].to_numpy() == 1].sum())
    tabc13 = {}
    pct = ofi['seg_social_ocupados']['nacional']['porcentajes']
    wb = openpyxl.load_workbook(os.path.join(anexos, 'anex-GEIHEISS-jun-ago2026.xlsx'), read_only=True, data_only=True)
    filas_x = list(wb['Prop informalidad'].iter_rows(values_only=True))
    ventanas = list(zip(meses, meses[1:], meses[2:]))
    for w_, of in zip(ventanas, filas_x[12][49:67]):
        s = lambda c: sum(tab[i][c] for i in w_)
        et = f'{w_[0][0]}-{w_[0][1]:02d} a {w_[2][0]}-{w_[2][1]:02d}'
        fin = f'{w_[2][0]}-{w_[2][1]:02d}'
        fl.append(fila('% informalidad nacional, trim. móvil', et, 100 * s('inf') / s('oc'), of, 'anexo EISS, hoja Prop informalidad'))
        fl.append(fila('% ocupados que cotizan a pensión, trim. móvil', et, 100 * s('cot') / s('oc'), pct['Cotiza a pensión'][fin], 'data/datos.json, anexo EISS'))
        fl.append(fila('% ocupados afiliados a salud, trim. móvil', et, 100 * s('afi') / s('oc'), pct['Afiliada a salud'][fin], 'data/datos.json, anexo EISS'))
    h = hog
    w = h['fex_c'].to_numpy() * h['nper'].to_numpy()
    y = h['ingpcug'].to_numpy()
    P = ofi['pob_nac']
    fu = 'data/datos.json pob_nac, anexo de pobreza 2025'
    for dom, et, m in (('Nacional', 'nacional', np.ones(len(h), bool)), ('Cabeceras', 'cabeceras', h['clase'].to_numpy() == 1), ('Centros poblados y rural disperso', 'rural', h['clase'].to_numpy() == 2)):
        fl.append(fila('Pobreza monetaria 2025 (%)', et, 100 * w[m & (h['pobre'].to_numpy() == 1)].sum() / w[m].sum(), P['PM'][dom]['2025'], fu))
        fl.append(fila('Pobreza extrema 2025 (%)', et, 100 * w[m & (h['indigente'].to_numpy() == 1)].sum() / w[m].sum(), P['PME'][dom]['2025'], fu))
        fl.append(fila('Gini 2025 (coef. × 100)', et, 100 * gini(y[m], w[m]), 100 * P['Gini'][dom]['2025'], fu))
        fl.append(fila('Ingreso per cápita 2025 (miles de COP)', et, (w[m] * y[m]).sum() / w[m].sum() / 1000, P['Ingpc'][dom]['2025'] / 1000, fu))
    # Cifras publicadas en el JSON
    ld = ofi['lab_depto']['total']
    for c in ld:
        k = f'a.D{c}'
        for nom, n_, d_, of in (('TD', 'ds', 'ft', 'TD'), ('TGP', 'ft', 'pet', 'TGP'), ('TO', 'oc', 'pet', 'TO')):
            a_, b_ = valor(k, n_), valor(k, d_)
            if a_ is not None and b_ is not None:
                fl.append(fila(f'Tablas: {nom} departamental 2025 (%)', c, 100 * a_ / b_, ld[c][of]['2025'], 'data/datos.json lab_depto'))
    an = ofi['lab_anual']
    fl.append(fila('Tablas: TD anual 2025 (oficial con 2 decimales) (%)', 'nacional', 100 * valor('a.n', 'ds') / valor('a.n', 'ft'), an['Total Nacional']['2025']['TD'], 'data/datos.json lab_anual'))
    fl.append(fila('Tablas: TD anual 2025 (oficial con 2 decimales) (%)', 'cabeceras', 100 * valor('a.k', 'ds') / valor('a.k', 'ft'), an['Total Cabeceras']['2025']['TD'], 'data/datos.json lab_anual'))
    # Sin contraste oficial: la subocupación del DANE es más amplia que la insuficiencia de horas aquí definida
    return fl


def resumen(fl):
    out = []
    for g in dict.fromkeys(f['grupo'] for f in fl):
        d = [abs(f['diferencia']) for f in fl if f['grupo'] == g and f['diferencia'] is not None]
        tol = 0.5 if 'miles de COP' in g else (0.5 if 'Gini' in g else 0.1)
        if 'miles de COP' in g:
            tol = 1.0
        out.append({'grupo': g, 'comparaciones': len(d), 'dif_abs_max': round(max(d), 4), 'replica': bool(max(d) <= tol)})
    return out


# Publicación -------------------------------------------------------------------------------------
def publicar(x, hogs, hog, ctrl_t, oficial, anexos):
    C, G, ext = construir_celdas(x)
    estados, nombres, N, W, NA, med = calcular(x, C, ext)
    S, K = N.shape
    grupos, pares = grupos_lattice(estados, nombres, NA, G)
    N_plano = N.ravel().astype('int64').copy()
    N_plano[NA.ravel()] = 0
    causa = proteger(N_plano, grupos, pares).reshape(S, K)
    publ = [i for i, n in enumerate(nombres) if C[n][1]]
    medidas = [nombres[i] for i in publ]
    salida, ctrl = {}, Counter()
    por_vista = {}
    for s, (per, ter, fil) in enumerate(estados):
        fila_ = []
        for j in publ:
            if NA[s, j]:
                fila_.append(NA_)
                continue
            c = causa[s, j]
            v = vista_de(nombres[j])
            q = por_vista.setdefault(v, Counter())
            q['total'] += 1
            if c == 0:
                fila_.append(int(round(W[s, j] / UNIDAD)))
                q['publicadas'] += 1
            else:
                fila_.append(P_ if c == 1 else C_)
                q[{1: 'precision', 2: 'primaria', 3: 'secundaria'}[int(c)]] += 1
        m = [None if np.isnan(v) else (round(v) if i == 0 else round(v, -3)) for i, v in enumerate(med[s])]
        # Los conteos sin ponderar solo se publican si su celda se publica: una celda reservada no puede revelar su n
        i_pet, i_oc = nombres.index('pet'), nombres.index('oc')
        n_pet = NA_ if NA[s, i_pet] else (int(N[s, i_pet]) if causa[s, i_pet] == 0 else P_)
        n_oc = int(N[s, i_oc]) if causa[s, i_oc] == 0 else P_
        fila_ += [n_pet, n_oc, m[0] if m[0] is not None else P_, int(m[1]) if m[1] is not None else P_]
        salida[clave_txt(per, ter, fil)] = fila_
    def valor(k, n):
        v = salida[k][medidas.index(n)]
        return v * UNIDAD if v >= 0 else None

    H = tabla_hogares(x, hogs)
    dptos = sorted(d for d in pd.unique(x['dpto_d']) if d)
    print('impuestos', flush=True)
    claves_t, Nt, Wt, ct = impuestos(H, dptos)
    t_salida = {}
    tq = Counter()
    for i, c in enumerate(claves_t):
        t_salida['.'.join(c)] = [NA_ if (c[1].startswith('D') and TAX_CELDAS[j].endswith('9')) else (int(round(Wt[i, j] / UNIDAD)) if ct[i, j] == 0 else (P_ if ct[i, j] == 1 else C_)) for j in range(len(TAX_CELDAS))]
        for j in range(len(TAX_CELDAS)):
            tq['total'] += 1; tq[{0: 'publicadas', 1: 'precision', 2: 'primaria', 3: 'secundaria'}[int(ct[i, j])]] += 1
    por_vista['Impuestos'] = tq
    print('deciles', flush=True)
    sc, cel, Nd, Wd, cd, lim, medias = deciles(hog, x, H)
    d_salida = {}
    dq = Counter()
    for si, s_ in enumerate(sc):
        filas_d = []
        for d in range(11):
            r = si * 11 + d
            filas_d.append([int(round(Wd[r, j] / UNIDAD)) if cd[r, j] == 0 else (P_ if cd[r, j] == 1 else C_) for j in range(len(cel))])
            for j in range(len(cel)):
                dq['total'] += 1; dq[{0: 'publicadas', 1: 'precision', 2: 'primaria', 3: 'secundaria'}[int(cd[r, j])]] += 1
        d_salida[s_] = {'cortes': lim[s_], 'medias': medias[s_], 'filas': filas_d}
    por_vista['Deciles'] = dq
    fl = validar(x, hog, oficial, anexos, valor)
    # Puente 2025: declarado (INGLABO) frente a corregido (impa o impaes), para dimensionar la ruptura con 2026
    a = x[(x['anio'] == 2025) & x['oc'] & x['en908']]
    ibk = lambda r: np.select([r < .5, r < .95, r <= 1.05, r < 2, r <= 4, r > 4], [0, 1, 2, 3, 4, 5], default=6)
    wa = a['fex'].to_numpy() / 12
    d1 = ibk(a['ing908'].to_numpy(dtype='float64') / SM[2025])
    d2i = a['INGLABO'].to_numpy(dtype='float64')
    d2 = ibk(np.where(d2i > 99, d2i, np.nan) / SM[2025])
    puente = {'corregido': [round(100 * wa[d1 == k].sum() / wa.sum(), 1) for k in range(7)], 'declarado': [round(100 * wa[d2 == k].sum() / wa.sum(), 1) for k in range(7)]}
    bog = hog[hog['dpto'].astype(str).str.strip() == 'Bogotá D.C.']
    controles = {'TOTAL_25': ctrl_t, 'supresion': {k: dict(v) for k, v in por_vista.items()}, 'puente_2025_pct': puente,
                 'estados': len(salida), 'bogota_fex_dpto_igual_fex_c': bool(np.allclose(bog['fex_dpto'], bog['fex_c']))}
    return {
        'meta': {'generado': datetime.date.today().isoformat(), 'fuente': FUENTE, 'calculo': 'Cálculo propio a partir de microdatos GEIH (catálogos ANDA 853, 900, 908 y 789). Cada cifra se calcula de los microdatos; el navegador solo la busca.',
                 'unidad': UNIDAD, 'codigos': {'P': P_, 'C': C_, 'no_aplica': NA_}, 'sm': SM,
                 'formato': 'estados[clave] = valores en el orden de «medidas», luego [n PET, n ocupados, mediana de horas, mediana de ingreso]. Clave: período.territorio[.filtro+valor]. Valores en decenas de personas; -1 = P; -2 = C; -3 = no aplica.',
                 'controles': controles},
        'medidas': medidas, 'estados': salida, 'impuestos_celdas': TAX_CELDAS, 'impuestos': t_salida, 'deciles_celdas': cel, 'deciles': d_salida,
        'dptos': dptos, 'validacion_resumen': resumen(fl), 'validacion': fl}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    e = os.environ.get
    ap.add_argument('--dta', default=e('GEIH_DTA')); ap.add_argument('--anexos', default=e('GEIH_ANEXOS'))
    ap.add_argument('--fex-dpto', default=e('GEIH_FEX_DPTO')); ap.add_argument('--pobreza', default=e('GEIH_POBREZA'))
    ap.add_argument('--salida', default=os.path.join(RAIZ, 'data', 'trabajo.json'))
    a = ap.parse_args()
    if not all([a.dta, a.anexos, a.fex_dpto, a.pobreza]):
        ap.error('Faltan rutas: use argumentos o GEIH_DTA, GEIH_ANEXOS, GEIH_FEX_DPTO y GEIH_POBREZA.')
    oficial = json.load(open(os.path.join(RAIZ, 'data', 'datos.json'), encoding='utf-8'))
    x, hogs, hog, ctrl_t = extraer(a)
    salida = publicar(x, hogs, hog, ctrl_t, oficial, a.anexos)
    tmp = a.salida + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, a.salida)
    print('\nRESUMEN')
    for r in salida['validacion_resumen']:
        print(r)
    print('tamaño JSON (bytes):', os.path.getsize(a.salida))
    print('controles:', json.dumps(salida['meta']['controles'], ensure_ascii=False))


if __name__ == '__main__':
    main()
