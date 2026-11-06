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

**Principio: tablas precalculadas.** Cada cifra que el tablero puede mostrar se calcula directamente de los microdatos,
se protege y se escribe en `data/micro.json`. El navegador no suma ni deriva (sección 4).

Lectura y uniones:

- Lectura con `pyreadstat` usando `usecols`, mes por mes, y acumulación de agregados. No se escriben registros
  individuales en disco ni se concatena todo el año en memoria.
- Unión de módulos por `DIRECTORIO, SECUENCIA_P, ORDEN, MES` (personas) y `DIRECTORIO, SECUENCIA_P, MES` (hogares).
  El proceso se detiene si un cruce queda incompleto o hay llaves duplicadas.
- Agosto de 2026: varias llaves llegan como texto y lo no aplicable viene como 0 en vez de vacío. Normalizar las llaves a
  un mismo tipo y comparar los indicadores con `== 1`. 0 en `P3042` no es un nivel educativo.

Factores:

- Nacional, cabeceras y rural: `FEX_C18 / número de meses` (12 para 2025; 8 para ene–ago). Las tasas no cambian; los niveles sí.
- Departamentos 2025, laboral y salud: `FEX_DPTO` de `TOTAL_25.DTA` (748.277 registros, 12 meses, 23 departamentos, sin
  Bogotá ni Amazonía-Orinoquía). **Es anual: suma 43,5 millones; NO dividir por 12.** Prevalece el `DPTO` de ese archivo: los
  registros rurales de Bogotá figuran allí en Cundinamarca, y así se replica la cifra oficial.
- Bogotá 2025: `FEX_C18/12`, solo cabecera; replica la TD oficial (hoja `Año_móvil_32_ciudades`).
- Base 908: `fex_c` (nacional y zona) y `fex_dpto` (departamentos). `fex_dpto` es idéntico a `FEX_DPTO` en los 748.277
  registros comunes y trae además a Bogotá.

Indicadores de la fase 1:

- Informalidad: traducción del código oficial del anexo EISS (hojas `Código_STATA` y `Código_SAS`); replica la hoja
  `Prop informalidad`.
- Agrupaciones: ver sección 4. Educación (`P3042`): ninguno 1-2, primaria 3, secundaria 4, media 5-7, superior 8-13.
- Sin variables de diseño (estrato, conglomerado) en los archivos: no se calculan CV; rige el umbral de 300 encuestas en
  el denominador de cada tasa.

Fases siguientes, con las mismas reglas de publicación (sección 4). La tabla se calcula de los microdatos, no se suma después:

- Base 908: unir Personas y Hogares por `directorio, secuencia_p, mes`. `lp`, `li`, `pobre`, `indigente` e `ingpcug` solo
  están en Hogares; `dpto` trae nombres, no códigos.
- Deciles: de personas ordenadas por `ingpcug`, ponderados por `fex_c`.
- Clases sociales: umbrales de `anex-PMClasesSociales-2025.xlsx` (leer de la hoja y citar la hoja exacta).
- Arriendo imputado: `ingtotarr − ingtotug` por unidad de gasto.
- Montos de impuestos: 0 = no pagó; 98 = no sabe; 99 = no informa. Excluir 98 y 99 de los montos y contarlos aparte.
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

## 4. Salida: `data/micro.json` (tablas precalculadas de resúmenes numéricos)

**Diseño vigente: el navegador no suma ni deriva cifras.** Un cubo que se agrega en el navegador se descartó: al
suprimir celdas, la suma de lo publicado se sesga (TD de Chocó 18,84 % frente a 12,83 % oficial). Por eso cada cifra
se calcula directamente de los microdatos y el tablero solo la busca. Peso total ≤ 3 MB.

Tablas de la fase 1 (mercado laboral y salud):

- `nacional.*`, por dominio (nacional, cabeceras, rural) y período (2025, ene-ago 2025, ene-ago 2026): `total`, `sexo`,
  `edad`, `educ`, `sexo_edad`, `sexo_educ`.
- `departamental.*`, solo 2025 y 24 entidades (23 departamentos y Bogotá): `total`, `sexo`, `zona`, `edad`
  (15-28, 29-44, 45-64, 65+; salud agrega 0-14), `educ`. Sin dobles cruces.

Medidas: `tgp`, `to`, `td`, `inf`, `cot_pension`, `oc_afil`, `nini` (15-28; no se publica por edad) y salud de toda la
población: `afil`, `contrib`, `especial`, `subsid` en nacional; `afil`, `contrib_especial`, `subsid` en departamental.

```json
{
  "meta": {"generado": "...", "fuente": "Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co",
           "formato": "...", "medidas": {}, "reglas": {}, "notas": [], "controles": {}},
  "dims": {"dominio": [], "periodo": [], "dpto": [], "zona": [], "sexo": [], "edad": [], "edad_dpto": [], "educ": []},
  "tablas": {
    "departamental.total": {"dims": ["dpto"], "medidas": ["tgp", "to", "td"],
                            "filas": [[11, [22123, 394976, 38.8051, 51.39], [22123, 394976, 33.8273, 38.6747], [11369, 153271, 12.8277, 24.7427]]]}
  },
  "validacion_resumen": [{"grupo": "...", "comparaciones": 0, "dif_abs_max": 0, "replica": true}],
  "validacion": [{"grupo": "...", "periodo": "...", "propia": 0, "oficial": 0, "diferencia": 0, "fuente": "..."}]
}
```

- Cada fila: índices de `dims` y una entrada por medida. Entrada: `[n del denominador, población representada, valor
  ponderado %, valor sin ponderar %]`; `"P"` = precisión insuficiente; `"C"` = reservada por confidencialidad; `null` = no
  aplica. Las reservadas no llevan ningún número.
- Reglas al publicar (aplicadas en el archivo, porque el JSON es público):
  1. **Precisión:** denominador con menos de 300 encuestas → `P` (regla sobre el denominador de cada tasa).
  2. **Confidencialidad:** todo conteo publicado o derivable por resta debe ser 0 o ≥ 10. Las cifras que se derivan entre
     sí (TGP, TO, TD; regímenes de salud) se suprimen juntas.
  3. **Secundaria:** en cada grupo (padre e hijos, incluido nacional = cabeceras + rural) no puede quedar una sola cifra
     reservada, ni un residuo con conteos de 1 a 9. También se aplica a las de precisión insuficiente, solo en esa cifra.
  4. **Resta de períodos:** 2025 menos ene-ago 2025 tampoco puede dejar conteos de 1 a 9; se reserva el período más corto.
- Agrupaciones: afiliados sin dato de régimen en contributivo; quienes no informan afiliación quedan en población menos
  afiliados; régimen especial con contributivo en departamentos; los 5 registros de PET sin nivel educativo con «ninguno».
- En 2026 no hay filas departamentales (regla 5).
- `validacion` compara con la cifra oficial; el grupo «Tablas: …» compara la cifra publicada en el JSON.
- Fases siguientes, con este mismo diseño: `ingreso_2025`, `clases_2025`, `migracion`, `cuidado` (otras formas de trabajo)
  e `impuestos_2025` por decil.

## 5. El tablero en el sitio

- Pestaña **principal**, inmediatamente después de «Resumen del estudio» y antes de «Las fuentes»: sección 1,
  «Tablero: juegue con los factores de expansión (microdatos GEIH 2025–2026)», en el grupo «Tablero de microdatos». Las
  demás secciones se mantienen debajo y están renumeradas (2 a 11).
- **El tablero solo busca cifras en `data/micro.json`:** no suma, no resta y nunca calcula una cifra reservada a partir de
  otras. Lógica en `assets/tablero.js`; reutiliza `mapa()` y `ranking()` de `assets/app.js`.
- Filtros fijos arriba (en pantallas de hasta 900 px no son fijos, porque ocuparían gran parte de la pantalla): tema,
  indicador, período, nivel (nacional, cabeceras, rural, departamento), departamento y hasta dos cruces permitidos por las
  tablas. Se desactiva lo que no existe y se explica por qué: departamentos fuera de 2025, doble cruce en departamentos,
  edad en ni-ni, edad × educación, y contributivo y especial por separado en departamentos.
- Se abre con TD de Chocó 2025 (12,83 % ponderada frente a 24,74 % sin ponderar).
- Tarjetas: **encuestas** (n del denominador), **población representada**, **cifra ponderada** y **cifra sin ponderar**, con
  una frase que explica la diferencia. Muestran el total de la selección; los cruces van en el gráfico y en la tabla.
- Cifras reservadas, sin números: «P = precisión insuficiente (menos de 300 encuestas en el denominador)» y «C = reservada
  por confidencialidad (Ley 79 de 1993)».
- Gráfico de barras por el cruce elegido (ponderada y sin ponderar; en doble cruce, hombres y mujeres con selector de cifra),
  mapa departamental (solo 2025) y tabla descargable en CSV de las cifras visibles (son resúmenes, no microdatos).
- Debajo, en listas desplegables: factores usados (ver sección 2.7), uniones entre módulos, definición de cada indicador con
  sus variables, reglas de supresión, agrupaciones, tabla de validación, limitaciones (sin variables de diseño,
  representatividad, sismo de agosto de 2026) y la cita obligatoria del DANE.
- Bilingüe (clases `.es` y `.en`), paleta gov.co ya definida en `index.html`, sin logos oficiales, y versión en
  `data-version` para evitar caché. **El amarillo `#FFAB00` solo se usa como relleno con borde;** nunca en líneas, puntos ni
  texto sobre fondo claro (en su lugar, `--ocre`, `#B26A00`).
- Las cifras monetarias están en COP corrientes (COP = pesos colombianos). Se mantienen las advertencias de ingresos 2026 no
  corregidos.

## 5.1 Pestaña principal: Trabajo, protección y contribución

- Sección 1 y apertura por defecto del sitio. `scripts/03_trabajo.py` escribe `data/trabajo.json`; `assets/trabajo.js` solo busca
  cifras y calcula porcentajes entre cifras publicadas.
- Estados precalculados: período × territorio × hasta un filtro; a nivel nacional, además, hasta dos filtros en las
  combinaciones sexo × (edad, educación, posición, rama, formalidad), formalidad × (edad, educación, posición, rama) y edad × educación.
- Mismas reglas de la sección 4, aplicadas por celda con un motor de punto fijo: dentro de la selección, entre categorías de
  un filtro, nacional = cabeceras + rural y resta de períodos.
- Ingreso: 2025 con `impa` o `impaes` (base 908); 2026 con `INGLABO`, marcado «sin corregir». `fex_c` es igual a `FEX_C18/12` en
  los registros cruzados. Personas de la base 908: `fex_c × nper` replica pobreza, Gini e ingreso per cápita.
- Horas: `P6800` (normales). Jornada legal por mes según la Ley 2101 de 2021. Subempleo: definición propia, sin contraste oficial.
- Colores de grupo: verde y ocre no pasan el contraste para texto (4,5:1); se usan solo en la franja.

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
