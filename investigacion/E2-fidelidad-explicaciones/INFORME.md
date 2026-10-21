# E2 · Fidelidad de las explicaciones de ARA · Informe

- **Fecha de ejecución:** 20 de octubre de 2026.
- **Línea y requisito:** L5 · R-L5.5.
- **Protocolo:** [`protocolo-v1.0.txt`](protocolo-v1.0.txt) con las enmiendas [`ENMIENDAS.md`](ENMIENDAS.md) (E-1 a E-9), fechadas antes de generar el conjunto de evaluación.
- **Generador:** el de producción de ARA (`generateReport`, `src/core/aiReport.js`), llamado a través del proxy de producción `demos.innovadef.es/api/xai`.
  - Modelo solicitado: `grok-4-fast-non-reasoning`. La API respondió en las 150 llamadas con `grok-4.3`.
  - Temperatura 0,4. Generación: 20/10/2026, de 16:50 a 16:56 UTC. Las 150 respuestas cumplieron el esquema; no hubo sustituciones.
- **Verificador:** `verificador.mjs`, determinista y propio de ARA, congelado por SHA-256 antes de generar el conjunto de evaluación (E-9). `4-verificar.mjs` comprueba ese hash antes de ejecutar.
- **Conjunto:** 150 explicaciones de Grok sin alterar más 150 copias con un error introducido (25 por tipo, T1–T6). Barajado y ciego (E-7).
- **Registros:** carpeta `datos/` (perfiles, respuestas en bruto de Grok, conjunto ciego, etiquetas y veredictos), [`resultados.json`](resultados.json) y [`revision-base.csv`](revision-base.csv).

## Resultado

**R-L5.5 no se cumple con E2.** El verificador con roles no alcanza el criterio ni con la métrica del protocolo v1.0 ni con la de la enmienda E-8. Se registra como resultado.

### Métricas principales

| Métrica | Con roles | Sin roles (línea base) | Criterio |
|---|---|---|---|
| **Exhaustividad localizada** (E-8): se marca la frase o el campo alterado | **0,707** [0,629–0,774] · 106/150 | 0,213 [0,155–0,286] · 32/150 | límite inferior ≥ 0,90 |
| **Alarmas interpretativas sobre la base** (E-8): cota de falsas alarmas | **0,213** [0,155–0,286] · 32/150 | 0,013 [0,004–0,047] · 2/150 | límite superior ≤ 0,10 |
| Exhaustividad por explicación (v1.0) | 0,873 [0,811–0,917] · 131/150 | 0,227 [0,167–0,300] · 34/150 | límite inferior ≥ 0,90 |
| Alarmas por explicación sobre la base (v1.0) | 0,713 [0,636–0,780] · 107/150 | 0,013 [0,004–0,047] · 2/150 | límite superior ≤ 0,10 |
| Precisión / F1 (v1.0) | 0,55 / 0,68 | 0,94 / 0,37 | — |
| No concluyentes | 0 | 0 | — |

Intervalos de Wilson al 95 %.

### Exhaustividad por tipo de error (con roles)

n = 25 por tipo: el intervalo es de unos ±0,15, así que estas cifras son descriptivas.

| Tipo | Localizada | Por explicación | Sin roles (localizada) |
|---|---|---|---|
| T1 · Atribución cruzada | 0,64 | 0,84 | 0,00 |
| T2 · Cifra no respaldada | 0,72 | 0,84 | 0,76 |
| T3 · Especialidad equivocada | 0,84 | 0,88 | 0,00 |
| T4 · Filtro de movilidad omitido | 0,80 | 0,88 | 0,52 |
| T5 · Adorno sin respaldo | 0,52 | 0,84 | 0,00 |
| T6 · Contradicción | 0,72 | 0,96 | 0,00 |

### Lectura

1. **Los roles aportan la detección.** Sin roles, el verificador solo encuentra cifras y especialidades inventadas (T2, T4) y no ve ninguna atribución cruzada, contradicción, factor ajeno ni adorno (0 de 100). Con roles, la exhaustividad localizada pasa de 0,21 a 0,71. Es el mismo patrón que P1 en autorIA: 2 de 4 contradicciones sin roles y 4 de 4 con roles.
2. **Lo que se escapa son redacciones que el léxico del verificador no cubre.** Todos los fallos revisados son de este tipo:
   - «alcanza 3 sobre 3»;
   - «es uno de sus puntos fuertes»;
   - «por debajo de lo esperado»;
   - «Afinidad con Infantería Ligera del 66 %»;
   - «Disponibilidad plena para cambios de destino»;
   - «superar las pruebas de acceso es muy probable».

   Un verificador basado en reglas tiene un techo de cobertura del lenguaje. La exhaustividad por explicación (0,87) es más alta porque cuenta errores de la base que el verificador sí ve.
3. **La explicación de Grok sin alterar no es fiel a la puntuación de ARA.** El 63 % de las explicaciones de la base (95/150) tiene al menos un error **objetivo**, es decir, comprobable de forma mecánica contra la puntuación sin interpretar el texto:

   | Error objetivo en la base | Explicaciones |
   |---|---|
   | `suboficialesPath: true` sin cumplirse la condición (GTI ≥ 70, Autoridad ≥ 2 y aspiración «sí») | 82 / 150 (55 %) |
   | Vía de Suboficiales anunciada en el texto sin cumplirse la condición | 24 / 150 |
   | «Igualmente válidas» con 5 puntos o más de diferencia de afinidad | 25 / 150 |
   | Cifra distinta de la puntuación | 1 / 150 |

   No son falsas alarmas: son errores del generador. Por eso la tasa del protocolo v1.0 (0,71) no mide al verificador, y la enmienda E-8 separa las alarmas objetivas de las interpretativas.
4. **Falsas alarmas reales:** como mucho 0,21, el 21 % (32 explicaciones con alguna alarma interpretativa: 14 de nivel, 11 de filtro, 5 de factor ajeno, 2 de adorno y 2 de especialidad). Solo 12 explicaciones (8 %) tienen únicamente alarmas interpretativas. Sin la revisión humana (E-5) no se puede separar cuántas de las 32 son errores reales de Grok. Las 45 alarmas interpretativas están en `revision-base.csv` para dos revisores.

## Hallazgos sobre ARA

Ninguno de estos hallazgos es objeto de E2, pero los ha destapado E2:

- **El modelo decide por su cuenta la vía de Suboficiales.** El prompt no le pasa `suboficialesPath`, solo el aviso `VIA_SUBOFICIALES` cuando procede. El campo booleano del informe lo rellena Grok, y se equivoca en el 55 % de los casos. Ese campo debería tomarse de `computeScores`, no del modelo.
- **El aviso `EMPATE` es incoherente con la alternativa.** El empate se calcula entre la primera y la segunda del ranking, pero al modelo se le pasa como alternativa otra especialidad, de un grupo distinto, que puede estar 20 o 30 puntos por debajo. El prompt le ordena llamarlas «igualmente válidas».
- **La Disciplina puede valer 4 en una escala de 0 a 3.** En `scoreQ3`, cuatro de los ocho ítems puntúan Disciplina, así que el modelo recibe «Disciplina: 4/3» (en 18 de las 150 entradas). Los demás rasgos llegan como mucho a 3.
- Los nombres de los rasgos en el prompt («Orientación técnica», «Aspiración/Autoridad») no coinciden con el modelo de ARA («Orientación al detalle», «Aceptación de la autoridad»).

## Decisión

- **R-L5.5:** no cumplido con E2 (octubre de 2026). Se registra en Evidencias como resultado negativo, con el desglose anterior.
- **Para cerrar las falsas alarmas reales:** completar `revision-base.csv` con dos revisores, y un tercero en caso de desacuerdo, y recalcular con `5-metricas.mjs`. No hay que regenerar nada.
- **Para 2027:**
  1. Corregir el generador: `suboficialesPath` y el empate deben salir de la puntuación y no del modelo, y la escala de Disciplina debe ir de 0 a 3. Después, repetir E2 con una base que ya no traiga esos errores objetivos.
  2. Ampliar la cobertura del verificador con extracción de afirmaciones por modelo local más comprobación determinista, como en autorIA, manteniendo el veredicto determinista. Se mide en un protocolo nuevo y fechado.

## Limitaciones

- **Base no revisada por personas (E-5):** la tasa de 0,213 es una cota superior de las falsas alarmas.
- **Mismo equipo para los errores y el verificador (E-4):** el generador de errores se escribió después de congelar el verificador y usa varias redacciones por tipo, pero la exhaustividad medida es optimista frente a errores reales.
- **Modelo externo:** la API sirvió `grok-4.3` aunque se pidió `grok-4-fast-non-reasoning`. Otra fecha puede dar otra base; por eso esta queda congelada en `datos/generacion/`.
- **Datos sintéticos:** perfiles de T03, sin datos personales.
