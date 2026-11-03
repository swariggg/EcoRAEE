# Cambios de la versión 5 (base EcoRaEE_CLOUD)

Probado el 02/11/2026 en SQL Server 2022, sobre una base nueva:

- `01_esquema.sql` corre completo, y también `01_esquema_sin_borrar.sql`.
- `02_datos.sql` corre sin errores.
- `03_pruebas.sql` pasa 21 de 21 pruebas.
- `04_consultas.sql` devuelve las 5 consultas.

Orden de ejecución: 01 → 02 → 03 → 04. La base sigue llamándose EcoRaEE_CLOUD, así que 01_esquema.sql reemplaza la de la versión 4.

## Cambio de tablas: resultado y resultado_arista

| Tabla | Antes (v4) | Ahora (v5) |
|---|---|---|
| resultado | PK `id_resultado` (entidad fuerte) | PK (`id_escenario`, `nro_ejecucion`). Ahora es entidad débil de escenario. |
| resultado_arista | PK (`id_resultado`, `nro_arista`), con `id_escenario` como atributo aparte | PK (`id_escenario`, `nro_ejecucion`, `nro_arista`) |

**Por qué.** En v4, `id_escenario` dependía solo de `id_resultado`, que es una parte de la clave. Eso es una dependencia parcial y no cumple la 2FN. Ahora `id_escenario` forma parte de la clave, y todos los atributos dependen de la clave completa.

Las dos FK compuestas garantizan que la arista sea del mismo escenario que la ejecución:

- (`id_escenario`, `nro_ejecucion`) → resultado;
- (`id_escenario`, `nro_arista`) → arista.

Por eso el trigger `tr_resultado_arista_rn05` ya no compara escenarios y solo valida RN-05 (flujo ≤ capacidad).

## Lo que se ajustó por ese cambio

- **`sp_guardar_resultado_flujo`:** ya no recibe `@id_resultado`. Calcula `nro_ejecucion` solo (1, 2, 3… por escenario).
  - Uso: `EXEC sp_guardar_resultado_flujo 'ESC-1', 140, N'[...]'`.
- **`vw_resultado_flujo`:** devuelve `id_escenario` y `nro_ejecucion` en vez de `id_resultado`.
- **02_datos:** las 5 llamadas al procedimiento ya no llevan el código RES-ESC…
- **03_pruebas:** CP-07 busca ESC-1, ejecución 1. CP-08 agrupa por escenario y ejecución.
- **Diagramas:** en el EER, RESULTADO ahora es entidad débil y "produce" es una relación identificadora. En el modelo lógico, resultado aparece como débil.
- **Word:** se actualizaron el diccionario, la normalización y las dos imágenes.
