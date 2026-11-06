# Indicadores sociales de Colombia con la GEIH y la ECV del DANE

**Sitio:** https://doar95.github.io/geih-colombia/ · *English version available on the site (button "English").*

Repositorio académico, retrospectivo y actualizable, organizado por fuente (GEIH y ECV), con indicadores de **mercado laboral** (TGP, TO, TD, TS, informalidad), **pobreza monetaria y desigualdad** (incidencia, brecha, severidad, Gini, ingreso per cápita, líneas de pobreza), **pobreza multidimensional** (IPM) y **aseguramiento en salud** de Colombia, construido con datos públicos del Departamento Administrativo Nacional de Estadística (DANE) y del Ministerio de Salud y Protección Social.

Autores: Claude (Anthropic), David Aguilar y Camila Gómez.

## Contenido

| Ruta | Descripción |
|---|---|
| `index.html` | Sitio publicado en GitHub Pages desde la raíz de la rama main (español e inglés). |
| `assets/app.js` | Gráficos, mapas, conversión a pesos constantes e idioma. |
| `assets/tablero.js` | Lógica del tablero de microdatos: filtros, tarjetas, gráfico, mapa y descarga en CSV. |
| `data/datos.json` | Datos procesados que usa el sitio. |
| `data/micro.json` | Tablas precalculadas del tablero: resúmenes numéricos, no microdatos. |
| `data/departamentos.geojson` | Límites departamentales simplificados (derivados del Marco Geoestadístico Nacional del DANE). |
| `data/externos/` | Cifras de afiliación al SGSSS (Ministerio de Salud y Protección Social). |
| `scripts/00_descargar_anexos.py` | Descarga los anexos oficiales desde www.dane.gov.co a `data/raw/dane/` (carpeta excluida del repositorio). |
| `scripts/01_construir_datos.py` | Transforma los anexos en `data/datos.json`. |
| `scripts/02_microdatos.py` | Calcula, valida y protege las cifras del tablero y escribe `data/micro.json`. Requiere los microdatos descargados del DANE. |

## Tablero de microdatos

La sección 1 del sitio, «Tablero: juegue con los factores de expansión (microdatos GEIH 2025–2026)», compara cada cifra ponderada con la cifra sin ponderar. Cubre mercado laboral y salud: TGP, TO, TD, informalidad, ocupados que cotizan a pensión, ocupados afiliados a salud, personas de 15 a 28 años que ni estudian ni trabajan, y afiliación a salud de toda la población por régimen. Las cifras son **cálculos propios**.

- **Niveles.** Nacional, cabeceras y rural, por período (2025, enero–agosto de 2025 y enero–agosto de 2026): total, sexo, edad, educación, sexo × edad y sexo × educación. Departamento y Bogotá, solo 2025: total, sexo, zona, edad y educación.
- **Tablas precalculadas.** Cada cifra se calcula directamente de los microdatos. El navegador solo la busca: no suma ni deriva, y nunca calcula una cifra reservada a partir de otras.
- **Cifras reservadas.** P = precisión insuficiente (menos de 300 encuestas en el denominador). C = reservada por confidencialidad (Ley 79 de 1993): todo conteo publicado o derivable por resta debe ser 0 o al menos 10, con supresión secundaria. Las reservadas no llevan ningún número en `data/micro.json`.
- **Validación.** El tablero incluye la tabla de contraste contra los anexos del DANE, y su nota metodológica documenta factores, uniones, definiciones, agrupaciones y limitaciones.
- **Limitación principal.** Los archivos públicos no traen variables de estrato ni conglomerado, de modo que no se calculan errores de muestreo.

## Fuentes (versiones usadas)

- DANE, GEIH: anexo de mercado laboral (agosto de 2026), mercado laboral por departamentos (serie anual 2007–2025), empleo informal y seguridad social y mercado laboral según sexo (junio–agosto de 2026).
- DANE: pobreza monetaria y desigualdad 2025 (nacional y departamental), publicada el 12 de junio de 2026.
- DANE, ECV: pobreza multidimensional 2025 (nacional y departamental), actualizada el 14 de abril de 2026.
- Ministerio de Salud y Protección Social: cifras de afiliación en salud (corte agosto de 2026), procesadas en https://github.com/doar95/aseguramiento-salud-colombia.

## Reproducción

```bash
pip install pandas openpyxl xlrd
python scripts/00_descargar_anexos.py
python scripts/01_construir_datos.py
```

El IPC mensual (base diciembre 2018 = 100) debe guardarse en `data/externos/ipc_dane_mensual.csv` (columnas `periodo,ipc`), descargándolo de https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc . Para actualizar, cambie los nombres de archivo en `00_descargar_anexos.py` y ejecute ambos scripts.

### Tablero de microdatos

Descargue los microdatos directamente del DANE (sección 8 del sitio) y guárdelos **fuera del repositorio**. El script recibe las rutas por variables de entorno o por los argumentos `--dta`, `--anexos`, `--fex-dpto` y `--pobreza`; no tiene rutas fijas.

```bash
pip install pandas numpy openpyxl pyreadstat
export GEIH_DTA="/ruta/DTA_2025_2026"            # módulos mensuales: <Módulo>_<Mes>_<Año>.DTA
export GEIH_ANEXOS="/ruta/anexos_dane"           # anexos del DANE, para validar
export GEIH_FEX_DPTO="/ruta/TOTAL_25.DTA"        # factor departamental 2025 (catálogo 789)
export GEIH_POBREZA="/ruta/Pobreza_2025"         # base 908: contiene Personas/Personas.dta
python scripts/02_microdatos.py                  # escribe data/micro.json; cámbielo con --salida
```

En Windows PowerShell, defina las variables con `$env:GEIH_DTA = "C:\ruta\DTA_2025_2026"`. Antes de cada commit, revise con `git status` que no aparezca ningún microdato ni anexo.

## Condiciones de uso del DANE

Este repositorio **no redistribuye anexos ni microdatos del DANE**. Las condiciones de los catálogos de microdatos autorizan el uso de la información con la cita textual «Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co» y prohíben su copia o reproducción en medios electrónicos que la pongan a disposición de múltiples usuarios sin visto bueno escrito del DANE. El sitio publica únicamente resúmenes numéricos citados (Ley 79 de 1993, art. 5). La sección 8 del sitio explica paso a paso cómo descargar los datos directamente del DANE.

Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co

## Advertencias

Este repositorio no es una publicación oficial. Reproduce cifras oficiales y señala de forma explícita los cálculos propios (promedios anuales de series mensuales, promedios por período de gobierno, cobertura administrativa, conversión a pesos constantes y las cifras del tablero de microdatos). Las cifras monetarias están en pesos colombianos (COP) corrientes por defecto. El estudio es descriptivo y no establece relaciones causales.

## Marco normativo

Ley 1712 de 2014 (transparencia y acceso a la información pública), Ley 79 de 1993 (reserva estadística), Ley 2335 de 2023 (estadísticas oficiales), Ley 1581 de 2012 (protección de datos personales) y Documento CONPES 150 de 2012.

## Licencia

Código bajo licencia MIT. Los datos pertenecen a sus productores (DANE; Ministerio de Salud y Protección Social) y deben citarse como tales.
