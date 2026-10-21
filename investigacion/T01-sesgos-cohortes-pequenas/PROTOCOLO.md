# T01 · E3 · Sesgos con cohortes pequeñas · Protocolo

- **Fecha del protocolo:** 20 de octubre de 2026, 11:40 CEST, antes de ejecutar ninguna simulación.
- **Línea, requisito e hipótesis:** L5 · R-L5.6 · H5.2 (plan de pruebas de las líneas de I+D, 15/10/2026, prueba T01; requisitos v0.9, experimento E3).
- **Responsable:** Calidad. Ejecución asistida por Claude.
- **Datos:** simulados. Ningún dato personal.

## Pregunta

¿Qué método detecta un sesgo real en selecciones militares pequeñas (decenas de personas) sin dar falsas alarmas?

## Hipótesis (H5.2), con el umbral fijado antes de medir

Un modelo bayesiano jerárquico alcanza una **potencia ≥ 0,80** con **n = 40 por grupo**, con una **tasa de falsas alarmas ≤ 0,05**, mientras que la regla de los cuatro quintos y la prueba exacta de Fisher no lo consiguen con la misma tasa de falsas alarmas.

- **Sesgo real de referencia:** razón de selección grupo B / grupo A = 0,6 (claramente por debajo de los cuatro quintos), con tasa base del grupo A de 0,5.
- **Un método cumple** si, en la misma configuración (n, tasa base, número de cohortes), tiene potencia ≥ 0,80 con razón 0,6 y falsas alarmas ≤ 0,05 con razón 1,0.
- La hipótesis se evalúa en dos situaciones: una sola promoción (K = 1) y tres promociones del mismo proceso con heterogeneidad entre ellas (K = 3, τ = 0,3).

## Escenarios

| Factor | Valores |
|---|---|
| Alumnos por grupo y promoción (n) | 10, 20, 40, 60, 100 (promociones de 20 a 200) |
| Tasa base del grupo A (p₀) | 0,3 · 0,5 · 0,7 |
| Razón real B/A | 1,0 (sin sesgo) · 0,9 · 0,8 · 0,7 · 0,6 · 0,5 |
| Promociones (K) | 1 · 3 |
| Heterogeneidad real entre promociones (τ, escala logit) | 0 con K = 1; 0 y 0,3 con K = 3 |

- 1.000 repeticiones por escenario (270 escenarios). Semilla fija.
- Con K = 3, la tasa base de cada promoción varía en la escala logit (desviación 0,3) y el efecto de cada promoción es δₖ = δ + τ·zₖ, con δ = logit(p₀·razón) − logit(p₀).
- Error de Monte Carlo: ±0,007 en una tasa de 0,05 y ±0,013 en una de 0,80 (una desviación típica).

## Métodos comparados

Con K = 3, los métodos clásicos se aplican a la suma de las tres promociones y, además, solo a la última (práctica actual: se revisa cada promoción por separado).

1. **Regla de los cuatro quintos:** alarma si la tasa observada de B es menor que 0,8 veces la de A.
2. **Prueba exacta de Fisher, unilateral:** alarma si p < 0,05 (B seleccionado menos que A).
3. **Modelo bayesiano jerárquico**, calculado por cuadrícula sin aproximaciones de muestreo:
   - por promoción, sₐ ~ Bin(n, σ(αₖ)) y s_b ~ Bin(n, σ(αₖ + δₖ));
   - δₖ ~ N(δ, τ²); δ ~ N(0, 1); τ ~ semi-normal(0,5); αₖ ~ N(0; 1,5²);
   - salida en tres niveles:
     - **aviso:** P(δ < 0 | datos) ≥ 0,95;
     - **sin indicio:** P(δ < δ\* | datos) < 0,05, donde δ\* es el logit-odds equivalente a una razón de 0,8 con la tasa observada de A;
     - **inconcluso:** el resto.
   - La alarma, para potencia y falsas alarmas, es el nivel «aviso».

## Métricas por escenario y método

- **Potencia:** proporción de alarmas cuando la razón real es < 1.
- **Falsas alarmas:** proporción de alarmas cuando la razón real es 1,0.
- **Solo para el modelo bayesiano:** proporción de «inconcluso» y de **falsa tranquilidad** («sin indicio» cuando la razón real es ≤ 0,7).

## Registro

- `repeticiones.csv.gz`: una línea por repetición con los recuentos de cada promoción y la decisión de cada método.
- `resultados.json`: potencia, falsas alarmas y niveles bayesianos por escenario, con fecha, semilla y commit.
- `INFORME.md`: resultado, decisión que provoca y enlace a los registros.

Ejecución: `node investigacion/T01-sesgos-cohortes-pequenas/t01.mjs` desde la raíz del repositorio.
