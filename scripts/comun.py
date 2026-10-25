"""Funciones comunes para leer los anexos oficiales del DANE (formato de bloques)."""
import re, math
import pandas as pd

def es_anio(x):
    try:
        v = float(str(x).replace('*', ''))
        return 1990 < v < 2100 and float(v).is_integer()
    except Exception:
        return False

def anio(x):
    return int(float(str(x).replace('*', '')))

def limpiar(v):
    if v is None: return None
    if isinstance(v, str):
        v = v.strip().replace(',', '.')
        try: v = float(v)
        except Exception: return None
    try:
        if math.isnan(v): return None
    except Exception:
        return None
    return round(float(v), 4)

def bloques(df, stop=None):
    """Recorre una hoja con bloques 'encabezado de años' + filas 'etiqueta | valores'.
    Devuelve lista de dicts {titulo, anios(col->anio), filas:{etiqueta:[(col,valor)]}}."""
    out, cur, titulo = [], None, None
    for i in range(len(df)):
        fila = df.iloc[i].tolist()
        cols_anio = {j: anio(v) for j, v in enumerate(fila) if es_anio(v)}
        etiqueta = next((str(v).strip() for v in fila[:2] if isinstance(v, str) and v.strip()), None)
        if len(cols_anio) >= 3:
            cur = {'titulo': titulo, 'anios': cols_anio, 'filas': {}, 'fila0': i}
            out.append(cur); continue
        if etiqueta and cur is not None:
            vals = [(j, limpiar(fila[j])) for j in cur['anios'] if j < len(fila)]
            if any(v is not None for _, v in vals):
                cur['filas'].setdefault(etiqueta, vals)
                continue
        if etiqueta:
            titulo = etiqueta
            if stop and re.search(stop, etiqueta): cur = None
    return out
