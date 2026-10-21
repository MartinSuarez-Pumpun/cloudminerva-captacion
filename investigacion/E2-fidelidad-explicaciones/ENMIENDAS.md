# E2 · Fidelidad de las explicaciones de ARA · Enmiendas al protocolo v1.0

- **Fecha:** 20 de octubre de 2026, 18:15 CEST, antes de generar ninguna explicación y antes de la primera ejecución.
- **Protocolo base:** [`protocolo-v1.0.txt`](protocolo-v1.0.txt). Se ejecuta tal cual salvo en lo que estas enmiendas cambian.
- **Motivo general:** el protocolo v1.0 supone el verificador de autorIA y un ARA con habilitaciones. E2 se ejecuta solo con el código de ARA (este repositorio), con su generador de producción y un verificador propio.

## E-1 · Verificador

- **Verificador medido:** `verificador.mjs`, escrito en este repositorio. Es determinista y no usa modelo de lenguaje.
  - Divide cada informe en frases.
  - De cada frase extrae afirmaciones con su papel: atributo (familia de interés, rasgo, GTI, filtro de disponibilidad, especialidad), valor (cifra o sentido: alto o bajo, positivo o negativo) y relación (factor que justifica una especialidad).
  - Comprueba cada afirmación contra la puntuación determinista.
- **Línea base (sin roles):** el mismo fichero en modo `sinRoles`. Solo comprueba que cada cifra del texto existe en algún lugar de la puntuación y que cada especialidad nombrada es la principal o la alternativa. No liga cifras ni valores a su atributo.
- **Veredicto por explicación:** infiel si alguna frase se marca. Se informa además por frase.
- **Congelación:** el verificador se desarrolla sobre un **conjunto de desarrollo** de 20 explicaciones de perfiles que no están en el de evaluación. Se fija por su SHA-256 antes de generar el conjunto de evaluación y no se modifica después. Cualquier cambio posterior es una nueva enmienda, con la medición anterior y la nueva.

## E-2 · Generador y verdad de referencia

- **Generador:** el de producción de ARA, sin cambios: `generateReport` de `src/core/aiReport.js`, con el modelo `grok-4-fast-non-reasoning` de xAI, temperatura 0,4, 1.800 tokens de salida, el mismo `SYSTEM` y el mismo `buildPrompt`.
  - Las llamadas pasan por el proxy de producción de ARA (`/api/xai`), igual que las de un candidato en el kiosco. Cada registro anota la vía (`proxy_produccion`).
  - Es un modelo externo: no se pueden fijar sus pesos. Se conservan la respuesta en bruto de cada llamada, con su fecha y el identificador de modelo que devuelve la API. La base generada queda congelada.
  - Las respuestas que no cumplen el esquema (ARA usaría la plantilla de respaldo) se registran y se sustituyen por otro perfil del mismo estrato.
- **Verdad de referencia:** la puntuación determinista (`computeScores`) y el texto de entrada exacto que recibe el modelo (`buildPrompt`). El modelo no recibe el desglose de la afinidad, así que no se le exige.

## E-3 · Perfiles

- Perfiles sintéticos de la prueba T03 (población L, semilla 20261020), no los del stand, que fueron sesiones reales. Los registros del servidor con las sesiones de las pruebas no se usan: contienen datos de personas y E2 se declara sin datos personales.
- Se excluyen los redirigidos (riesgo físico = «no»), porque ARA no genera informe para ellos.
- **Selección con semilla 20261021:**
  - 150 perfiles para evaluación, de ellos 40 con movilidad = «no», necesarios para T4;
  - 20 perfiles distintos para desarrollo.

## E-4 · Tipos de error adaptados a ARA

Uno por explicación, 25 por tipo, sobre una copia de la explicación fiel. Cada caso registra el campo, la frase original, la frase alterada y la referencia a la puntuación.

| Código | Definición en ARA |
|---|---|
| T1 | Atribución cruzada: se atribuye a un rasgo o familia el valor de otro (el rasgo bajo se presenta con el valor del alto) |
| T2 | Cifra no respaldada: un porcentaje de interés, el GTI, una puntuación de rasgo o la afinidad cambiados por un valor que no está en la puntuación |
| T3 | Especialidad equivocada: la recomendación se justifica con una familia de interés que no forma parte del perfil de esa especialidad |
| T4 | Filtro omitido (sustituye a «habilitación»): se presenta como adecuada una especialidad excluida por movilidad = «no» (Infantería de Marina, Maniobra y Navegación), o se afirma disponibilidad geográfica que el candidato negó |
| T5 | Adorno sin respaldo: garantía, predicción de rendimiento o beneficio que la puntuación no sostiene |
| T6 | Contradicción: se afirma que el candidato destaca en el rasgo o familia con la puntuación más baja, o al revés |

**Riesgo de circularidad, declarado:** el verificador y el generador de errores los escribe el mismo equipo. Para mitigarlo:

- el verificador se congela antes de escribir el generador de errores;
- cada tipo de error tiene al menos cuatro redacciones distintas y se inserta en campos distintos;
- las falsas alarmas se miden sobre texto real de Grok, que nadie ha retocado.

Aun así, la exhaustividad medida es una cota optimista frente a errores reales.

## E-5 · Revisión humana de la base fiel

El paso 5 (dos revisores y un tercero en caso de desacuerdo) **no se ha hecho** en esta ejecución. Las 150 explicaciones se toman como fieles sin revisar. Consecuencia: una alarma sobre la base puede ser un error real de Grok. La tasa de falsas alarmas que se informa es la tasa de **alarmas sobre la base no revisada**, una cota superior de las falsas alarmas reales.

Se entrega `revision-base.csv`, con cada frase marcada, para que los revisores la completen. Con esa revisión se recalculan las métricas sin volver a ejecutar nada.

## E-6 · Métricas y decisión

- **«No concluyente»:** el verificador emite «no concluyente» solo si no puede leer el informe. Para la exhaustividad cuenta como no detectado (criterio conservador); se informa también la cifra sin ellos.
- **Criterio sin cambios:** el límite inferior de Wilson de la exhaustividad ≥ 0,90 y el superior de las falsas alarmas ≤ 0,10. Con N = 150 equivale a detectar al menos 143 de 150 (95,3 %) y a marcar como mucho 7 de 150 (4,7 %). Se declara aquí para que se lea así.
- La exhaustividad por tipo (n = 25, ±0,12) es descriptiva.

## E-7 · Ciego

- El conjunto de evaluación se baraja con semilla y se pasa al verificador solo con identificadores.
- Las etiquetas están en un fichero aparte que solo lee el cálculo de métricas.
- El analista y el autor del verificador son el mismo equipo; se declara.

## E-8 · Medición con una base que ya contiene errores

*Añadida el 20 de octubre de 2026, después de revisar el conjunto de desarrollo y antes de generar el de evaluación.*

En desarrollo, el verificador marca 13 de las 20 explicaciones de Grok sin alterar. Revisadas una a una, las 13 alarmas son errores reales frente a la puntuación:

- `suboficialesPath: true` sin que se cumpla la condición: 9 de 20.
- «Igualmente válidas» con afinidades separadas 7 puntos o más: 6 de 20. Lo provoca el aviso `EMPATE` del prompt, que se calcula con la segunda del ranking y no con la alternativa.
- Factores de interés que no forman parte de la especialidad que justifican.
- Vía de Suboficiales anunciada sin cumplirse la condición.
- GTI 75 descrito como «competente».

Con una base así, la medición del protocolo v1.0 falla de dos formas:

1. **Exhaustividad por explicación inflada:** una copia con un error introducido sale marcada por el error que ya traía. Por eso la **métrica principal de exhaustividad pasa a ser localizada**: el error introducido cuenta como detectado solo si el verificador marca la frase alterada o el campo alterado. La exhaustividad por explicación del protocolo v1.0 se informa como secundaria.
2. **Las falsas alarmas sobre la base no son falsas alarmas.** Se separan dos clases de reglas:
   - **Objetivas** (campos, cifras, afinidades, equivalencia, vía de Suboficiales, especialidad excluida): se comprueban mecánicamente contra la puntuación. Una alarma objetiva sobre la base es un error del generador, no del verificador.
   - **Interpretativas** (nivel descrito, factor ajeno, adorno, filtro, especialidad no recomendada): dependen de leer lenguaje natural y son las que necesitan revisión humana (E-5).

   La tasa de alarmas sobre la base se informa total y desglosada. La cota de falsas alarmas reales es la tasa de alarmas **interpretativas**, hasta que la revisión humana la cierre.

El criterio de aceptación no cambia. Se aplica a la exhaustividad localizada y a la tasa de alarmas interpretativas por explicación, con las mismas reglas de Wilson.

## E-9 · Congelación del verificador

Antes de generar el conjunto de evaluación, el verificador queda fijado con estos SHA-256 (`VERIFICADOR.sha256`):

```
30725f54c026e029925c006580606563862dd6e0cd81b6b800ddc6a0d074ffd8  verificador.mjs
c507e318d14f55bb70ff41f2925868a9889254fcaec891b3ec30756d85c09c09  comun.mjs
```
