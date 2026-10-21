# T05 · E4 · Resolución de identidades · Protocolo

- **Fecha del protocolo:** 21 de octubre de 2026, 09:45 CEST, antes de generar ningún dato y de ejecutar ninguna medición.
- **Líneas, requisitos e hipótesis:** L1 y L5 · R-L1.1 · R-L5.3 · H1 · H5.1 (plan de pruebas de las líneas de I+D, 15/10/2026, prueba T05; requisitos v0.9, experimento E4).
- **Responsable:** equipo de plataforma. Ejecución asistida por Claude.
- **Datos:** sintéticos. Ningún dato personal.

## Pregunta

¿Se pueden enlazar las fichas de una misma persona entre CloudMinerva (sistema académico) y SIPERDEF (sistema de personal) sin una clave común completa, con F1 ≥ 0,95 y menos de 200 pares etiquetados a mano?

## Hipótesis, con el umbral fijado antes de medir

**H1 / H5.1:** el método propio alcanza **F1 ≥ 0,95 con 199 pares etiquetados o menos** en el escenario estándar.

- **Se da por cumplida** si F1 ≥ 0,95 en **cada uno** de los 5 conjuntos del escenario estándar, no solo en la media.
- Splink sin etiquetas es la línea base de referencia que pide el plan («Splink frente al método propio»).

## Datos sintéticos

Una población de personas ficticias de la que salen dos sistemas con fichas que no coinciden del todo.

### Personas

- Nombre simple o compuesto («María José», «José Antonio»).
- Dos apellidos, algunos compuestos («de la Fuente», «García-Ruiz»).
- Sexo, fecha de nacimiento entre 1998 y 2008 (promociones de alumnos: muchas fechas coinciden) y DNI con letra válida.
- Los nombres y apellidos se reparten con frecuencias de tipo Zipf sobre listas de nombres y apellidos españoles frecuentes. Habrá muchas personas distintas con los mismos apellidos (García, Fernández, González…), que son los casos difíciles.

### Sistemas

| Sistema | Fichas | Cómo están |
|---|---|---|
| A · CloudMinerva | 3.000 personas | Con tildes y mayúsculas normales; DNI presente en el 95 %; erratas leves (2 %) |
| B · SIPERDEF | 3.000 personas, 2.000 de ellas también en A; el 4 % aparece dos veces (duplicados) | En mayúsculas y sin tildes; con las alteraciones de la tabla siguiente |

### Alteraciones en B

| Alteración | Escenario estándar | Escenario difícil |
|---|---|---|
| DNI ausente | 40 % | 80 % |
| DNI presente sin letra | 50 % | 50 % |
| DNI con un dígito cambiado | 3 % | 5 % |
| Errata en el nombre o en un apellido (sustitución, omisión o trasposición) | 8 % por campo | 15 % por campo |
| Falta el segundo apellido | 10 % | 15 % |
| Apellidos intercambiados | 3 % | 5 % |
| Nombre compuesto abreviado o truncado («Mª José», «María») | 30 % de los compuestos | 40 % |
| Fecha con día y mes intercambiados / con un dígito cambiado / ausente | 3 % / 3 % / 5 % | 5 % / 5 % / 10 % |

- 5 conjuntos por escenario, con semillas 1 a 5.
- **Verdad de referencia:** son pareja todas las combinaciones (ficha de A, ficha de B) de la misma persona. Un duplicado de B da dos parejas verdaderas.

## Métodos

| Id | Método | Pares etiquetados |
|---|---|---|
| M0 | **Determinista:** coincidencia exacta del número de DNI si está en las dos fichas; si no, exacta de nombre, dos apellidos y fecha (normalizados) | 0 |
| M1 | **Splink (Fellegi-Sunter), sin supervisión:** u por muestreo aleatorio, m por EM y frecuencia de los términos en nombre y apellidos. Umbral fijo de probabilidad 0,5 | 0 |
| M2 | **Splink con el umbral elegido con etiquetas:** el mismo modelo que M1, con el umbral que maximiza F1 sobre L pares etiquetados | L |
| M3 | **Método propio:** los pares candidatos de Splink se clasifican con una regresión logística entrenada con L pares etiquetados, elegidos por aprendizaje activo (un núcleo estratificado por la puntuación de Splink y después los pares más inciertos) | L |

**Variables del método propio (M3):**
- los niveles de comparación de Splink y su peso;
- indicadores propios de la identidad española: apellidos intercambiados, segundo apellido ausente, primer nombre de un compuesto coincidente, fecha con día y mes intercambiados, DNI que coincide en los números pero no en la letra, y rareza de los apellidos.

**Recibo de cada decisión:** se guarda la versión del modelo (SHA-256 de sus coeficientes), las variables, la contribución de cada una, la probabilidad y el veredicto, encadenados por hash.

**Presupuestos de etiquetado:** L ∈ {50, 100, 199}.
- Las etiquetas salen de la verdad de referencia y simulan a la persona que revisa.
- Los pares etiquetados se excluyen de la evaluación de M2 y M3: el conjunto de evaluación es todo el producto A × B menos esos pares.

**Bloqueo común para M1 a M3** (pares candidatos): misma fecha; mismo primer apellido y misma inicial del nombre; mismo número de DNI; mismos dos apellidos. Los pares verdaderos que no pasan el bloqueo cuentan como no detectados.

## Métricas

- Precisión, exhaustividad y F1 por pares sobre todas las parejas verdaderas, por conjunto. Se informa la media, la desviación típica y el mínimo de los 5 conjuntos.
- Exhaustividad máxima que permite el bloqueo.
- Número de pares etiquetados usados.

## Limitaciones declaradas de antemano

- **Centralización:** R-L1.1 exige resolver identidades «sin centralizar los datos». T05 mide la calidad del enlace con los dos sistemas en una misma máquina. La resolución federada, con los datos en su origen, no se mide aquí.
- **Modelo local:** el diseño de L1 combina Splink con «un modelo local que deja recibo de cada decisión». Aquí ese modelo es una regresión logística con recibos. No se usa un modelo de lenguaje.
- **Datos sintéticos:** miden el método frente a alteraciones conocidas, no la distribución real de errores entre CloudMinerva y SIPERDEF. La muestra real etiquetada a mano que exige R-L1.1 sigue pendiente.

## Registro

- `datos/`: los conjuntos A y B generados de cada escenario y semilla, con la verdad de referencia, comprimidos.
- `registros.jsonl`: una línea por conjunto, método y presupuesto, con sus métricas.
- `recibos-estandar-s1.jsonl.gz`: los recibos de M3 (L = 199) en el conjunto estándar de semilla 1.
- `resultados.json` e `INFORME.md`.

Ejecución:

```
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python t05.py
```
