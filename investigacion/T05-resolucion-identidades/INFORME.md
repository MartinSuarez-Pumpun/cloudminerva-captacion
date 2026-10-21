# T05 · E4 · Resolución de identidades · Informe

- **Fecha de ejecución:** 21 de octubre de 2026.
- **Líneas, requisitos e hipótesis:** L1 y L5 · R-L1.1 · R-L5.3 · H1 · H5.1. Protocolo: [PROTOCOLO.md](PROTOCOLO.md), fechado antes de generar los datos.
- **Datos:** sintéticos, sin datos personales. Dos escenarios (estándar y difícil) con 5 conjuntos cada uno. Cada conjunto tiene unas 3.000 fichas en A (CloudMinerva) y unas 3.100 en B (SIPERDEF), con 2.070–2.100 parejas verdaderas.
- **Software:** Splink 5.0.0 sobre DuckDB 1.5.6 y scikit-learn 1.9.1, con las versiones fijadas en `requirements.txt`. Tarda unos 2 minutos.
- **Registros:**
  - `datos/`: fichas A y B de cada conjunto, con la persona real para la verdad de referencia;
  - [`registros.jsonl`](registros.jsonl): una línea por conjunto con las métricas de cada método;
  - [`resultados.json`](resultados.json);
  - [`recibos-estandar-s1.jsonl.gz`](recibos-estandar-s1.jsonl.gz): 2.157 recibos encadenados por hash, con la cadena verificada;
  - [`modelo-estandar-s1-L199.json`](modelo-estandar-s1-L199.json).

## Resultado

**H1 / H5.1 se cumple en el escenario estándar.** El método propio supera F1 = 0,95 en los 5 conjuntos con 199, 100 e incluso 50 pares etiquetados.

| Presupuesto | F1 en cada conjunto estándar | Cumple (todos ≥ 0,95) |
|---|---|---|
| M3, L = 50 | 0,963 · 0,964 · 0,981 · 0,982 · 0,953 | Sí |
| M3, L = 100 | 0,995 · 0,993 · 0,992 · 0,990 · 0,995 | Sí |
| M3, L = 199 | 0,996 · 0,995 · 0,996 · 0,995 · 0,998 | Sí |

### Comparación de métodos

F1: media ± desviación típica (mínimo) de los 5 conjuntos.

| Método | Etiquetas | Estándar | Difícil |
|---|---|---|---|
| M0 · Determinista (DNI, o nombre + apellidos + fecha) | 0 | 0,887 ± 0,007 (0,877) | 0,649 ± 0,011 (0,633) |
| M1 · Splink sin supervisión | 0 | 0,986 ± 0,001 (0,985) | 0,944 ± 0,004 (0,939) |
| M2 · Splink con umbral elegido con etiquetas | 199 | 0,992 ± 0,001 (0,991) | 0,948 ± 0,005 (0,940) |
| M3 · Método propio | 50 | 0,968 ± 0,013 (0,953) | 0,844 ± 0,127 (0,619) |
| M3 · Método propio | 100 | 0,993 ± 0,002 (0,990) | 0,943 ± 0,016 (0,916) |
| **M3 · Método propio** | **199** | **0,996 ± 0,001 (0,995)** | **0,967 ± 0,004 (0,962)** |

- **Exhaustividad máxima que permite el bloqueo:** 0,995 en el escenario estándar y 0,970 en el difícil.
- **Precisión de M0:** 1,00, pero solo encuentra el 80 % de las parejas en el escenario estándar y el 48 % en el difícil.

## Lectura

1. **Sin clave común completa, el enlace exacto no basta.** M0, que es la práctica habitual (cruzar por DNI y, si falta, por nombre completo y fecha), se queda en F1 = 0,89 cuando falta el DNI en el 40 % de las fichas. Cae a 0,65 cuando falta en el 80 %.
2. **En el escenario estándar, el enlace probabilístico ya resuelve casi todo sin etiquetas.** Splink sin supervisión llega a 0,986. El escenario estándar resulta más fácil de lo previsto, y la hipótesis se cumple con holgura en él. El hallazgo que aporta más es el del escenario difícil.
3. **En el escenario difícil, el método propio es el único que supera 0,95.** Con 80 % de DNI ausente y 15 % de erratas, Splink se queda en 0,944 y el umbral con etiquetas (M2) en 0,948. El método propio con 199 etiquetas llega a 0,967, con un mínimo de 0,962. La ganancia viene de las variables propias de la identidad española. Las de más peso en el modelo son:
   - apellidos intercambiados (coeficiente 7,7);
   - fecha con día y mes intercambiados (7,3);
   - la concordancia del DNI.

   Fellegi-Sunter compara cada campo por separado y no puede ver estos patrones.
4. **Con 50 etiquetas el método propio es inestable.** En el escenario difícil baja hasta 0,62, porque con 15–28 positivos la regresión aprende mal. A partir de 100 etiquetas es estable. Regla práctica: con menos de 100 pares etiquetados, usar Splink (M1 o M2).
5. **Cada decisión deja un recibo.** Lleva la probabilidad, las seis contribuciones principales, el veredicto y el SHA-256 del modelo, encadenado al recibo anterior. Un auditor puede reconstruir por qué se enlazaron dos fichas, como pide RT-5.

## Decisiones que provoca

1. **H1 y H5.1:** confirmadas sobre datos sintéticos. Queda por medir R-L1.1 sobre una muestra real etiquetada a mano.
2. **Diseño de L1:** Splink como base y método propio a partir de 100 etiquetas. Las variables de apellidos intercambiados y fecha con día y mes intercambiados se incorporan al diseño.
3. **Próxima prueba:** repetir T05 con una muestra real de CloudMinerva × SIPERDEF (piloto de Tierra), con 200 pares etiquetados por dos personas. Hace falta acceso a SIPERDEF y la autorización correspondiente. Con eso se calibra el escenario: los datos reales dirán si se parecen más al estándar o al difícil.

## Desviaciones y limitaciones

- **Prueba previa:** antes de ejecutar se hizo una prueba de funcionamiento con la semilla 99, que no forma parte de la evaluación, para comprobar que el código corría. No se cambió ningún parámetro del protocolo después.
- **Sin federación (declarada en el protocolo):** las dos bases están en la misma máquina. La resolución sin centralizar los datos que exige R-L1.1 no se mide aquí.
- **«Modelo local»:** es una regresión logística con recibos, no un modelo de lenguaje.
- **Etiquetas simuladas:** salen de la verdad de referencia, como si la persona que revisa no se equivocara nunca. Con revisores reales habrá algo de ruido en las etiquetas.
- **Errores conocidos:** las alteraciones sintéticas son las que el protocolo define. Los datos reales tendrán otras (cambios de apellido, nombres en otra lengua cooficial, fichas fusionadas), y el escenario estándar puede ser optimista.
