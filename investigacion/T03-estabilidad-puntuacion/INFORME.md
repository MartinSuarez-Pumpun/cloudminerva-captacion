# T03 · Estabilidad de la puntuación de ARA · Informe

- **Fecha de ejecución:** 20 de octubre de 2026.
- **Línea y requisito:** L5 · R-L5.2. Protocolo: [PROTOCOLO.md](PROTOCOLO.md), fechado antes de medir.
- **Código medido:** `src/core/scoring.js` (commit base `f1d442f` más la exposición de `AFFINITY_WEIGHTS`, sin cambio de valores). La línea base coincide con la ruta de producción (`computeScores`) en el 100 % de los perfiles: 0 discrepancias en 3.147.
- **Datos:** 4.000 perfiles sintéticos, semilla 20261020. Se excluyen los redirigidos por riesgo físico = «no»: 663 en la población U y 190 en la L.
- **Registros:** [`perfiles.jsonl.gz`](perfiles.jsonl.gz), [`registros.jsonl.gz`](registros.jsonl.gz) (72.381 líneas, una por perfil y condición) y [`resultados.json`](resultados.json). Se reproducen con `node investigacion/T03-estabilidad-puntuacion/t03.mjs`.

## Resultado

**Los tres criterios se cumplen en las dos poblaciones.** La puntuación es estable ante cambios de pesos; lo que más la mueve es que falte una respuesta.

| Criterio | Umbral | Población U | Población L | Cumple |
|---|---|---|---|---|
| Pesos ±10 % | τ_b mediana ≥ 0,90 y cambio de principal ≤ 5 % | τ 1,00 · 2,8 % | τ 1,00 · 2,0 % | Sí |
| Pesos ±20 % | τ_b mediana ≥ 0,80 y cambio de principal ≤ 10 % | τ 0,97 · 6,4 % | τ 0,97 · 5,4 % | Sí |
| 1 respuesta suprimida | cambio de principal ≤ 10 % | 8,2 % | 8,3 % | Sí |

Se toma el peor caso de las condiciones de cada grupo.

### Predicciones analíticas: confirmadas

1. **El GTI no influye en qué especialidad se recomienda.** Su término es igual para las 13 especialidades. Variar su peso ±20 % o suprimir una respuesta de aptitudes deja el orden intacto (τ_b = 1 en todos los perfiles). Los únicos cambios observados (≤ 0,3 %) son entre especialidades que ya estaban empatadas en exacto.
2. **Escalar todos los pesos no cambia el orden.** Solo importa el cociente intereses/personalidad (hoy 2,5).
3. **Suprimir aptitudes no cambia el orden**, solo la afinidad que se muestra.

### Datos faltantes: la principal fuente de inestabilidad

| Respuestas suprimidas | Cambio de principal (U / L) | τ_b mediana (U / L) | Solape del top-5 |
|---|---|---|---|
| 1 al azar | 8,2 % / 8,3 % | 1,00 / 1,00 | 94–95 % |
| 2 | 15,6 % / 16,1 % | 0,91 / 0,94 | 89–90 % |
| 4 | 30,0 % / 30,2 % | 0,77 / 0,82 | 81–83 % |
| 8 | 46,9 % / 47,4 % | 0,62 / 0,66 | 72–73 % |
| 1 de intereses | 17,4 % / 15,1 % | 0,93 / 0,97 | 90–91 % |
| 1 de personalidad | 13,3 % / 9,7 % | 0,94 / 0,99 | 91–93 % |
| 1 de motivación | 0,7 % / 0,4 % | 1,00 | 99 % |

Una respuesta de intereses que falta cambia la recomendación en uno de cada seis perfiles. El motivo es que `scoreQ1` y `scoreQ3` cuentan una respuesta ausente igual que un «no» o que no elegir el rasgo, en lugar de tratarla como desconocida.

### Empates en la línea base

| | Población U | Población L |
|---|---|---|
| Empate exacto en el primer puesto | 8,6 % | 17,4 % |
| Aviso de empate (diferencia < 0,05) | 56,3 % | 55,9 % |
| Margen mediano entre la 1.ª y la 2.ª | 0,044 | 0,040 |

- Cuando hay empate exacto, la recomendación la decide el orden de la lista `SPECIALTIES`, no el perfil.
- El aviso de empate salta en más de la mitad de los perfiles: con el umbral de 0,05, «se mencionan ambas» es el caso normal, no la excepción.

## Decisiones que provoca

1. **R-L5.2:** se puede afirmar que el orden de ARA es robusto ante errores de ±20 % en los pesos (τ_b mediana ≥ 0,97, recomendación estable en ≥ 93,6 % de los perfiles).
2. **Revisar el papel del GTI.** Hoy pesa un 30 % en la afinidad mostrada, pero no cambia nunca la especialidad recomendada. Los mínimos de GTI que recoge el diseño (Transmisiones ≥ 60, Operaciones y Sistemas ≥ 60) no están implementados. O se modulan las especialidades por GTI, o se deja de presentar como un factor de la recomendación.
3. **Tratar las respuestas ausentes como desconocidas:** normalizar cada familia y cada rasgo solo sobre los ítems respondidos, o exigir el cuestionario completo antes de recomendar. Repetir la condición «falta 1 de intereses» tras el cambio.
4. **Deshacer los empates con una regla explícita** (por ejemplo, el mayor interés dominante) en lugar del orden de la lista, y recalibrar el umbral del aviso de empate.

## Desviaciones del protocolo

- En la primera ejecución, τ_b y los cambios de recomendación trataban como distintas dos afinidades que difieren en ~1e-16 por redondeo. Eso hacía fallar las predicciones 1 y 2 con un 0,1–0,3 % de cambios, todos entre especialidades empatadas en exacto. Se corrigió con una tolerancia de 1e-9 y se añadió la métrica «cambio de principal entre empatadas». Los criterios y sus umbrales no cambiaron.
- Los registros en bruto se guardan comprimidos (`.jsonl.gz`) por tamaño (11 MB sin comprimir). Se actualizaron los nombres de fichero en el protocolo.
- Perfiles sintéticos: miden la sensibilidad de la fórmula, no la validez de la recomendación frente a aspirantes reales.
