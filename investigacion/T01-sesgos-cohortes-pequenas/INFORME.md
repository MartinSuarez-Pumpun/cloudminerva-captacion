# T01 · E3 · Sesgos con cohortes pequeñas · Informe

- **Fecha de ejecución:** 20 de octubre de 2026.
- **Línea, requisito e hipótesis:** L5 · R-L5.6 · H5.2. Protocolo: [PROTOCOLO.md](PROTOCOLO.md), fechado antes de simular.
- **Datos:** simulados, sin datos personales. 270 escenarios × 1.000 repeticiones, semilla 20261020.
- **Registros:** [`repeticiones.csv.gz`](repeticiones.csv.gz) (270.000 líneas, una por repetición, con los recuentos de cada promoción y la decisión de cada método) y [`resultados.json`](resultados.json). Se reproducen con `node investigacion/T01-sesgos-cohortes-pequenas/t01.mjs` (unos 10 s).

## Resultado

**H5.2 no se confirma.** Con n = 40 por grupo, ningún método alcanza a la vez potencia ≥ 0,80 y falsas alarmas ≤ 0,05 en una sola promoción. El modelo bayesiano registrado en el protocolo no da falsas alarmas, pero es demasiado conservador.

Configuración de la hipótesis: n = 40 por grupo, tasa base 0,5, sesgo real = razón 0,6.

| Situación | Método | Potencia | Falsas alarmas | Cumple |
|---|---|---|---|---|
| **1 promoción** | Cuatro quintos | 0,86 | **0,15** | No |
| | Fisher | 0,48 | 0,03 | No |
| | Bayesiano (protocolo) | 0,17 | 0,00 | No |
| **3 promociones, sin heterogeneidad** | Cuatro quintos, suma | 0,96 | 0,04 | Sí |
| | Fisher, suma | 0,92 | 0,03 | Sí |
| | Cuatro quintos, última | 0,86 | 0,15 | No |
| | Fisher, última | 0,49 | 0,03 | No |
| | Bayesiano (protocolo) | 0,79 | 0,01 | No (en el límite) |
| **3 promociones, heterogeneidad τ = 0,3** | Cuatro quintos, suma | 0,91 | 0,07 | No |
| | Fisher, suma | 0,87 | 0,06 | No |
| | Bayesiano (protocolo) | 0,73 | 0,01 | No |

Error de Monte Carlo: ±0,013 en la potencia y ±0,007 en las falsas alarmas. Con K = 3 sin heterogeneidad, el bayesiano (0,79) está a menos de una desviación del umbral.

### Lo que sí queda demostrado

1. **La regla de los cuatro quintos no sirve para una promoción pequeña.** Sin ningún sesgo real da la alarma en el 15 % de las promociones de 40 + 40, en el 15–30 % con 20 + 20 y hasta en el 38 % con 10 + 10 y tasa base 0,3. Su potencia alta es el reflejo de esas falsas alarmas.
2. **Con una sola promoción de 40 + 40, el límite es la información, no el método.** Fisher, con falsas alarmas controladas, detecta un sesgo de razón 0,6 en menos de la mitad de los casos. Hace falta n ≈ 100 por grupo para llegar a 0,8.
3. **El modelo bayesiano casi no da falsas alarmas.** Su máximo, en los 45 escenarios sin sesgo, es 0,04, frente a 0,38 de los cuatro quintos y 0,13 de Fisher. La «falsa tranquilidad» («sin indicio» con razón real ≤ 0,7) no pasa de 0,017.
4. **Con pocas observaciones, el modelo bayesiano dice «inconcluso» en lugar de equivocarse.** Con 40 + 40 y sin sesgo, el 92 % de las promociones salen «inconcluso». Es el comportamiento que pide RT-4: no dar como prueba lo que es ruido.
5. **Sumar promociones sin modelar la heterogeneidad infla las falsas alarmas.** Con τ = 0,3, Fisher sobre la suma llega a 0,13 de falsas alarmas con n = 100.

### Análisis exploratorio (posterior al protocolo)

La baja potencia del bayesiano con una promoción se debe a la cantidad sobre la que decide. El protocolo fijó la decisión sobre δ, el efecto medio del proceso. Con una sola promoción, δ no se puede separar de la heterogeneidad τ, así que su posterior queda ancha.

Se probó a decidir sobre el efecto de la promoción actual, δ_K, tomando información de las anteriores. Esta variante **no estaba registrada** y no cambia el veredicto sobre H5.2.

| n = 40, razón 0,6 | Potencia | Falsas alarmas |
|---|---|---|
| 1 promoción | 0,49 (Fisher: 0,48) | 0,03 |
| 3 promociones, τ = 0 | **0,78** (Fisher sobre la última: 0,49) | 0,02 |
| 3 promociones, τ = 0,3 | **0,71** (Fisher sobre la última: 0,45) | 0,04 |

- Falsas alarmas máximas en todos los escenarios: 0,077.
- Falsa tranquilidad máxima: 0,026.

Lectura: el valor del modelo jerárquico está en **revisar cada promoción con la memoria de las anteriores**. Para la promoción actual pasa de 0,49 a 0,78 de potencia con las falsas alarmas controladas. Con una promoción aislada no aporta potencia frente a Fisher.

## Decisiones que provoca

1. **Reformular H5.2 en la memoria y en R-L5.6.** Con una sola promoción de n = 40, la potencia ≥ 0,8 es inalcanzable con falsas alarmas ≤ 0,05 para cualquier método (resultado negativo, que se registra como tal). Propuesta para un nuevo protocolo: «el modelo jerárquico, aplicado a la promoción actual con al menos dos promociones previas del mismo proceso, alcanza potencia ≥ 0,75 con razón 0,6 y n = 40, con falsas alarmas ≤ 0,05».
2. **No usar la regla de los cuatro quintos como alarma en promociones de menos de unas 100 personas por grupo.** Como mucho, como indicador descriptivo junto al nivel bayesiano.
3. **Adoptar la salida en tres niveles** («sin indicio / inconcluso / aviso») para los informes de sesgo de ARA y de L5, con δ_K como cantidad de decisión. Hay que validarla en un protocolo nuevo, fechado, antes de darla por buena.
4. Siguiente paso de la prueba: repetir la variante exploratoria como protocolo propio, añadir K = 5 y razones por grupo con más de dos grupos.

## Limitaciones

- Dos grupos por promoción y tamaños iguales. Las selecciones reales pueden tener grupos desiguales.
- Los priors (δ ~ N(0, 1), τ ~ semi-normal(0,5)) se fijaron sin calibrar con datos reales. Otro prior para τ cambiaría la potencia del bayesiano registrado.
- El modelo se calcula por cuadrícula (paso 0,1 en δ), que basta para umbrales de 0,05 y 0,95.
