# Plan: tablero de microdatos GEIH 2025–2026 («Juegue con los factores de expansión»)

Este plan lo ejecuta Claude Code en el computador del usuario (VS Code, Windows). Los microdatos
están en OneDrive y **nunca** se suben al repositorio. Solo se publican scripts y resúmenes numéricos.

## 0. Reglas que no se negocian

1. **Condiciones del DANE** (catálogos ANDA 853, 900, 908, 789): se permite el uso con la cita textual
   «Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co». Se prohíbe copiar o
   reproducir los datos en medios electrónicos que los pongan a disposición de múltiples usuarios sin
   visto bueno escrito. Ley 79 de 1993, art. 5: solo resúmenes numéricos que no permitan deducir
   información individual.
2. Antes de cada `git commit`, ejecutar `git status` y verificar que **no** aparezca ningún `.dta`, `.csv`,
   `.sav`, `.parquet` ni carpeta de microdatos. El `.gitignore` ya excluye `data/raw/` y `microdatos/`.
3. Toda cifra calculada aquí se marca en el sitio como **cálculo propio**. Si una validación no cuadra con
   la cifra oficial, se informa la diferencia y su posible causa; no se fuerza.
4. Supresión de celdas (estadística y confidencialidad):
   - Si los archivos traen variables de diseño (estrato y conglomerado; buscarlas en el diccionario),
     calcular el coeficiente de variación por linealización de Taylor y **no publicar** estimaciones con
     CV > 15 %. Entre 5 % y 15 %, marcarlas como «precisión baja» (el DANE considera admisible hasta 5 %).
   - Si no hay variables de diseño: **no publicar** celdas con menos de 300 encuestas (personas sin
     ponderar) para proporciones y tasas. Es un criterio propio de prudencia y así se explica en el sitio.
   - En el cubo publicado no deben existir celdas con menos de 10 encuestas, aunque se agreguen después
     en el navegador. Agrupar categorías o eliminar dimensiones hasta cumplirlo.
5. Representatividad (ficha GEIH): por año, departamentos y 23 ciudades con área metropolitana. Por mes o
   trimestre, solo nacional, cabeceras, centros poblados y rural disperso, y 13 ciudades con área metropolitana.
   **Enero–agosto de 2026 no se desagrega por departamento ni por 23 ciudades.**
6. No calcular pobreza, Gini, deciles ni clases sociales para 2026. Los ingresos de los archivos mensuales
   no tienen las correcciones del DANE (imputación, arriendo imputado). La pobreza 2026 la publica el DANE
   hacia junio de 2027.

## 1. Insumos en el computador del usuario

| Ruta (Windows) | Contenido |
|---|---|
| `C:\Users\doar9\OneDrive\Datos curiosos\GEIH\DTA_2025_2026` | 160 DTA: 8 módulos × 20 meses (ene-2025 a ago-2026). Nombres: `<Módulo>_<Mes>_<Año>.DTA` |
| `C:\Users\doar9\OneDrive\Datos curiosos\GEIH\Pobreza_2025\Personas\Personas.dta` y `Hogares\Hogares.dta` | Base 908: ingresos corregidos, `lp`, `li`, `pobre`, `indigente`, `fex_c`, `fex_dpto` |
| `C:\Users\doar9\OneDrive\Datos curiosos\GEIH\anexos_dane\anex-PMClasesSociales-2025.xlsx` | Umbrales oficiales de clases sociales |
| `C:\Users\doar9\OneDrive\Datos curiosos\GEIH\Factores_departamentales_2025` (opcional) | Factor de expansión departamental 2025 (catálogo 789) |

Módulos mensuales: Características generales, seguridad social en salud y educación; Fuerza de trabajo;
Ocupados; No ocupados; Otras formas de trabajo; Migración; Datos del hogar y la vivienda; Otros ingresos e
impuestos. Los archivos de agosto de 2026 pesan menos pero se verificó que son legibles (65.417 personas en
Características; FEX_C18 suma 52,6 millones). El DANE ajustó los factores de agosto de 2026 por el sismo.

Ya verificado en Características (ago-2026): `PERIODO, MES, PER, DIRECTORIO, SECUENCIA_P, ORDEN, HOGAR,
REGIS, AREA, CLASE, FEX_C18, DPTO, PT, P6016, P3271 (sexo al nacer), P6040 (edad), P6050 (parentesco)…`.
Base 908 Hogares: `directorio, secuencia_p, mes, nper, npersug, clase, ingtotug, dominio, lp, li, ingtotarr,
ingpcug, pobre, indigente, npobres, nindigentes, fex_c, ciudad_sinam, dpto, fex_dpto`.

**Paso obligatorio antes de calcular:** leer un mes de cada módulo con `pyreadstat.read_dta(..., metadataonly=True)`
y guardar en `scripts/salida/variables.md` (ignorado por git) la lista de variables con sus etiquetas.
Confirmar con las etiquetas (no con la memoria) los nombres de: PET, FT, OCI, DSI; afiliación a salud (P6090)
y régimen (P6100); cotización a pensión (P6920); nivel educativo; posición ocupacional; país de nacimiento o
residencia anterior (Migración); horas de cuidado y oficios del hogar (Otras formas de trabajo); pago de
predial, vehículos y renta (Otros ingresos e impuestos); variables de diseño (estrato, conglomerado).

## 2. Método

- Lectura con `pyreadstat` usando `usecols` (Ocupados pesa ~1 GB por mes): mes por mes, solo columnas
  necesarias, convertir a tipos pequeños y acumular agregados (no concatenar todo el año en memoria).
- Unión de módulos por `DIRECTORIO, SECUENCIA_P, ORDEN, MES` (personas) y `DIRECTORIO, SECUENCIA_P, MES` (hogares).
- Factor para períodos agregados: `FEX_C18 / número de meses` (12 para 2025; 8 para ene–ago). Las tasas no
  cambian; los niveles sí.
- Departamentos 2025: usar `FEX_DPTO` de `Factores_departamentales_2025\DTA\TOTAL_25.DTA` (verificado: 748.277
  registros, variables `DIRECTORIO, SECUENCIA_P, ORDEN, MES, DPTO, FEX_DPTO`, 12 meses, 23 departamentos sin
  Bogotá ni Amazonía-Orinoquía). **Es anual: la suma de los 12 meses ya da 43,5 millones; NO dividir por 12.**
  Unir con los módulos mensuales por las cuatro llaves (convertir llaves a un mismo tipo). Bogotá se reporta
  como ciudad con `FEX_C18/12`. Documentar en cada cifra qué factor se usó.
- Base 908: unir Personas y Hogares por `directorio, secuencia_p, mes`; usar `fex_c` (nacional y zona) y
  `fex_dpto` (departamentos), según la documentación del estudio.
- Deciles: de personas ordenadas por `ingpcug`, ponderados por `fex_c`.
- Clases sociales: umbrales de `anex-PMClasesSociales-2025.xlsx` (leer de la hoja y citar la hoja exacta).
- Contrafactual «sin ayudas institucionales»: restar la fuente de ayudas institucionales (IOF3I o IOF3IES,
  la que tenga valor) del ingreso de la unidad de gasto, recalcular `ingpcug` y comparar con `lp`. Presentar
  como ejercicio mecánico que no considera cambios de comportamiento.

## 3. Validación (tabla visible en el tablero)

| Cifra | Valor oficial | Fuente |
|---|---|---|
| Pobreza monetaria nacional 2025 | 28,0 % | anexo PM 2025 (`data/datos.json`, `pob_nac.PM.Nacional`) |
| Pobreza extrema nacional 2025 | 9,6 % | ídem `PME` |
| Gini nacional 2025 | 0,531 | ídem `Gini` |
| Ingreso per cápita nacional 2025 | COP 1.281.590 | ídem `Ingpc` |
| TD nacional, cada mes ene-2025 a ago-2026 | `lab_mensual["Total Nacional"].TD` | anexo GEIH ago-2026 |
| % ocupados afiliados a salud (trimestre móvil) | `seg_social_ocupados.nacional.porcentajes` | anexo EISS |
| TD departamental 2025 | `lab_depto.total[cod].TD["2025"]` | anexo departamental |

Tolerancia: diferencias ≤ 0,1 p.p. en tasas se consideran réplica. Si hay más, investigar (factor, universo,
definición) y reportar.

## 4. Salida: `data/micro.json` (cubo de resúmenes numéricos)

Estructura sugerida (ajustar si se justifica, manteniendo el peso total ≤ 3 MB):

```json
{
  "meta": {"generado": "...", "fuente": "Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co",
           "umbral": {"tipo": "n_min | cv", "valor": 300}, "factor": "FEX_C18/12 | departamental 789", "notas": []},
  "dims": {"periodo": ["2025", "ene-ago 2025", "ene-ago 2026"], "dpto": ["00","05",...], "zona": ["cab","rur"],
           "sexo": ["h","m"], "edad": ["15-24","25-34","35-44","45-54","55-64","65+"], "educ": ["ninguno","primaria","secundaria","media","superior"]},
  "cubos": {
    "laboral": {"dims": ["periodo","dpto","zona","sexo","edad","educ"],
                "medidas": ["n","pet","ft","oc","ds","inf","cot_pension"],
                "celdas": [[0,0,0,0,0,0, 1234, 5.6e5, ...], ...]},
    "salud":   {"dims": ["periodo","dpto","zona","sexo","edad"], "medidas": ["n","pob","contrib","subsid","especial","no_afil","nsnr"], "celdas": []},
    "ingreso_2025": {"dims": ["dpto","zona","decil"], "medidas": ["n","pob","pobres","indig","pobres_sin_ayudas","ing_trab","ing_pens","ing_capital","ing_ayu_hog","ing_ayu_inst","ing_arr_imp"], "celdas": []},
    "clases_2025": {"dims": ["dpto","zona","sexo_jefe","educ_jefe"], "medidas": ["n","pob","pobre","vulnerable","media","alta"], "celdas": []}
  },
  "validacion": [{"cifra": "...", "propia": 0, "oficial": 0, "diferencia": 0}]
}
```

- `n` = número de encuestas (personas sin ponderar). Las demás medidas = suma de factores de expansión.
- En 2026, `dpto` solo admite `00` (nacional): no generar celdas departamentales para ese período.
- Fase 2 (después): `migracion`, `cuidado` (otras formas de trabajo), `impuestos_2025` por decil.

## 5. El tablero en el sitio

- Nueva pestaña **principal**, inmediatamente después de «Resumen del estudio» y antes de «Las fuentes».
  Nombre: «Tablero: juegue con los factores de expansión (microdatos GEIH 2025–2026)». Grupo del menú:
  «Tablero de microdatos». Las demás secciones se mantienen debajo y se renumeran.
- Barra de filtros (slicers) fija arriba: tema (mercado laboral, salud, ingreso y pobreza 2025, clases sociales
  2025), período, departamento, zona, sexo, edad, educación. Desactivar automáticamente los filtros que el
  período no permite (p. ej., departamento en 2026) explicando por qué.
- Para la selección actual, mostrar siempre tres tarjetas: **encuestas** (n), **población representada**
  (suma de factores) y la **cifra ponderada**, junto con la **cifra sin ponderar** para comparar. Este es el
  «juego»: el lector ve cómo cambia el resultado cuando se usan o no los factores.
- Si la celda queda bajo el umbral: no mostrar la cifra y explicar «muestra insuficiente para esta combinación».
- Gráfico de barras por la dimensión que elija el lector, mapa departamental (solo 2025) y tabla descargable en
  CSV de los resúmenes visibles (son agregados, no microdatos).
- Debajo del tablero, en listas desplegables: qué es un factor de expansión, cómo se agrega por meses, cómo se
  unen los módulos, cómo se calculó cada medida (variables exactas), umbral de supresión, tabla de validación,
  limitaciones (representatividad, sismo de agosto de 2026, ingresos 2026 no corregidos, contrafactual mecánico)
  y la cita obligatoria del DANE.
- Bilingüe (español base, inglés alternativo), paleta gov.co ya definida en `index.html`, sin logos oficiales.
- Mantener el aviso de COP corrientes por defecto y el conversor a constantes para los montos del ingreso.

## 6. Archivos a crear o modificar

- `scripts/02_microdatos.py`: lee los DTA y la base 908 y escribe `data/micro.json`. Recibe las rutas por
  argumentos o variables de entorno (`GEIH_DTA`, `GEIH_POBREZA`, `GEIH_ANEXOS`, `GEIH_FEX_DPTO`), sin rutas
  fijas en el código publicado.
- `assets/tablero.js` (lógica de filtros y agregación en el navegador) e `index.html` (nueva pestaña).
- `README.md`: sección del tablero y reproducción con `python scripts/02_microdatos.py`.
- No modificar `data/datos.json` salvo que sea necesario.

## 7. Publicación

1. Probar el sitio en local: `python -m http.server` en la raíz y abrir `http://localhost:8000/`, también
   sin `#` en la dirección (ese caso ya falló una vez).
2. Mostrar al usuario la tabla de validación y capturas del tablero antes de publicar.
3. `git status` (sin microdatos), `git add`, `git commit`, `git push origin main`. GitHub Pages publica desde la
   raíz de `main`. Verificar en https://doar95.github.io/geih-colombia/ con Ctrl+F5.

Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co
