# T03 · Estabilidad de la puntuación de ARA · Protocolo

- **Fecha del protocolo:** 20 de octubre de 2026, 11:25 CEST, antes de ejecutar ninguna medición.
- **Línea y requisito:** L5 · R-L5.2 (plan de pruebas de las líneas de I+D, 15/10/2026, prueba T03).
- **Responsable:** equipo ARA. Ejecución asistida por Claude.
- **Código medido:** `src/core/scoring.js` de este repositorio. La única modificación es exponer los pesos de la fórmula como parámetro opcional (`AFFINITY_WEIGHTS`), con los mismos valores por defecto. El script comprueba que, con los pesos por defecto, el ranking coincide con el de producción.

## Pregunta

¿Cuánto cambia el orden de las 13 especialidades que propone ARA si varían los pesos de la fórmula de afinidad (0,50 intereses / 0,30 GTI / 0,20 personalidad) o faltan respuestas?

## Predicción analítica registrada antes de medir

El término de GTI (`0,30 × GTI/100`) es el mismo para todas las especialidades de un candidato. Por tanto:

1. El orden no depende del peso de GTI ni del valor del GTI. Solo depende del cociente entre el peso de intereses y el de personalidad.
2. Multiplicar todos los pesos por la misma constante (por ejemplo, renormalizar a suma 1) no cambia el orden.
3. Suprimir respuestas de aptitudes (A2.x) no cambia el orden; solo cambia la afinidad mostrada.

El experimento debe confirmar o refutar estas tres afirmaciones.

## Datos

Perfiles sintéticos generados con semilla fija. Ningún dato personal.

- **Población U (uniforme):** cada respuesta se elige al azar entre las opciones del ítem. N = 2.000.
- **Población L (latente):** cada candidato tiene una propensión por familia de intereses (Beta(0,7; 0,7)), una capacidad (U(0,1); probabilidad de acierto 0,25 + 0,70 × capacidad), unos pesos de personalidad (Dirichlet(1,…,1)) y respuestas de motivación con probabilidades 0,6 / 0,3 / 0,1. N = 2.000.

Los perfiles redirigidos (riesgo físico = «no») no tienen ranking y se excluyen del análisis; se informa de cuántos son.

## Condiciones

| Grupo | Condición | Detalle |
|---|---|---|
| Línea base | Pesos 0,50 / 0,30 / 0,20, respuestas completas | Referencia de cada perfil |
| Pesos, uno a uno | Cada peso × 0,8 · 0,9 · 1,1 · 1,2, los demás fijos, renormalizado a suma 1 | 12 condiciones |
| Pesos, conjunto | Cada peso × U(0,9; 1,1) y × U(0,8; 1,2), independientes por perfil | 2 condiciones |
| Datos faltantes | Se suprimen k respuestas al azar entre las 31, k = 1, 2, 4, 8 | 4 condiciones |
| Datos faltantes por bloque | Se suprime 1 respuesta solo de intereses, solo de aptitudes, solo de personalidad, solo de motivación | 4 condiciones |

## Métricas, por perfil y condición, frente a su línea base

- **τ_b de Kendall** entre los vectores de afinidad de las especialidades admitidas (tiene en cuenta los empates).
- **Cambio de la recomendación principal** (sí/no).
- **Cambio de la alternativa** (sí/no).
- **Solape de los 5 primeros** (elementos comunes / 5) y número de puestos del top-5 que cambian.

Además, en la línea base:

- **Empates exactos en el primer puesto**, que hoy deshace el orden de la lista `SPECIALTIES`.
- **Frecuencia del aviso de empate** (`tied`: diferencia < 0,05 entre las dos primeras).

## Criterios fijados antes de medir

| Condición | La puntuación se considera estable si |
|---|---|
| Pesos ±10 % (uno a uno y conjunto) | mediana de τ_b ≥ 0,90 y cambio de principal ≤ 5 % |
| Pesos ±20 % (uno a uno y conjunto) | mediana de τ_b ≥ 0,80 y cambio de principal ≤ 10 % |
| 1 respuesta suprimida | cambio de principal ≤ 10 % |

Los criterios se evalúan por separado en cada población. Un criterio no alcanzado se registra como resultado.

## Registro

- `perfiles.jsonl.gz`: respuestas de cada perfil sintético.
- `registros.jsonl.gz`: una línea por perfil y condición con las métricas anteriores.
- `resultados.json`: agregados por condición y población, con fecha, semilla y commit.
- `INFORME.md`: resultado, decisión que provoca y enlace a los registros.

Ejecución: `node investigacion/T03-estabilidad-puntuacion/t03.mjs` desde la raíz del repositorio.
