"""Descarga los anexos oficiales del DANE usados por este repositorio.

Los anexos NO se redistribuyen en el repositorio: el lector los obtiene
directamente del DANE. Fuente: Departamento Administrativo Nacional de
Estadística: www.dane.gov.co

Uso:  python scripts/00_descargar_anexos.py
"""
from pathlib import Path
from urllib.request import urlopen, Request

BASE = 'https://www.dane.gov.co/files/operaciones/'
ANEXOS = [
    'GEIH/anex-GEIH-ago2026.xlsx',                 # Mercado laboral (mensual)
    'GEIH/anex-GEIHDepartamentos-2025.xls',        # Mercado laboral por departamentos
    'GEIH/anex-GEIHEISS-jun-ago2026.xlsx',         # Empleo informal y seguridad social
    'GEIH/anex-GEIHMLS-jun-ago2026.xlsx',          # Mercado laboral según sexo
    'PM/anex-PM-TotalNacional-2025.xlsx',          # Pobreza monetaria nacional
    'PM/anex-PMDepartamental-2025.xlsx',           # Pobreza monetaria departamental
    'PM/anex-PMultidimensional-2025.xlsx',         # Pobreza multidimensional nacional
    'PM/anex-PMultidimensional-Departamental-2025.xlsx',
]
DEST = Path(__file__).resolve().parents[1] / 'data' / 'raw' / 'dane'
DEST.mkdir(parents=True, exist_ok=True)
for a in ANEXOS:
    destino = DEST / a.split('/')[-1]
    if destino.exists():
        print('ya existe', destino.name); continue
    with urlopen(Request(BASE + a, headers={'User-Agent': 'Mozilla/5.0'})) as r:
        destino.write_bytes(r.read())
    print('descargado', destino.name)
print('Nota: si el DANE publica una versión más reciente, cambie el nombre del archivo en ANEXOS.')
