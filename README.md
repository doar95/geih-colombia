# Indicadores sociales de Colombia con la GEIH y la ECV del DANE

**Sitio:** https://doar95.github.io/geih-colombia/ · *English version available on the site (button "English").*

Repositorio académico, retrospectivo y actualizable, organizado por fuente (GEIH y ECV), con indicadores de **mercado laboral** (TGP, TO, TD, TS, informalidad), **pobreza monetaria y desigualdad** (incidencia, brecha, severidad, Gini, ingreso per cápita, líneas de pobreza), **pobreza multidimensional** (IPM) y **aseguramiento en salud** de Colombia, construido con datos públicos del Departamento Administrativo Nacional de Estadística (DANE) y del Ministerio de Salud y Protección Social.

Autores: Claude (Anthropic), David Aguilar y Camila Gómez.

## Contenido

| Ruta | Descripción |
|---|---|
| `docs/index.html` | Sitio publicado en GitHub Pages (español e inglés). |
| `docs/assets/app.js` | Gráficos, mapas, conversión a pesos constantes e idioma. |
| `docs/data/datos.json` | Datos procesados que usa el sitio. |
| `docs/data/departamentos.geojson` | Límites departamentales simplificados (derivados del Marco Geoestadístico Nacional del DANE). |
| `data/externos/` | Cifras de afiliación al SGSSS (Ministerio de Salud y Protección Social). |
| `scripts/00_descargar_anexos.py` | Descarga los anexos oficiales desde www.dane.gov.co a `data/raw/dane/` (carpeta excluida del repositorio). |
| `scripts/01_construir_datos.py` | Transforma los anexos en `docs/data/datos.json`. |

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

## Condiciones de uso del DANE

Este repositorio **no redistribuye anexos ni microdatos del DANE**. Las condiciones de los catálogos de microdatos autorizan el uso de la información con la cita textual «Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co» y prohíben su copia o reproducción en medios electrónicos que la pongan a disposición de múltiples usuarios sin visto bueno escrito del DANE. El sitio publica únicamente resúmenes numéricos citados (Ley 79 de 1993, art. 5). La sección 7 del sitio explica paso a paso cómo descargar los datos directamente del DANE.

Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co

## Advertencias

Este repositorio no es una publicación oficial. Reproduce cifras oficiales y señala de forma explícita los cálculos propios (promedios anuales de series mensuales, promedios por período de gobierno, cobertura administrativa y conversión a pesos constantes). Las cifras monetarias están en pesos colombianos (COP) corrientes por defecto. El estudio es descriptivo y no establece relaciones causales.

## Marco normativo

Ley 1712 de 2014 (transparencia y acceso a la información pública), Ley 79 de 1993 (reserva estadística), Ley 2335 de 2023 (estadísticas oficiales), Ley 1581 de 2012 (protección de datos personales) y Documento CONPES 150 de 2012.

## Licencia

Código bajo licencia MIT. Los datos pertenecen a sus productores (DANE; Ministerio de Salud y Protección Social) y deben citarse como tales.
