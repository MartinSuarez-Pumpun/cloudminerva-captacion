# Pruebas de I+D de L1 y L5

Pruebas del «Plan de pruebas de las líneas de I+D · CloudMinerva» (15/10/2026) que se pueden hacer con el código de este repositorio. Cada carpeta tiene un protocolo fechado antes de medir, el script reproducible, los registros en bruto y un informe.

| Prueba | Requisito | Resultado | Carpeta |
|---|---|---|---|
| T01 · E3 · Sesgos con cohortes pequeñas | R-L5.6 · H5.2 | H5.2 no confirmada; resultado negativo registrado | [T01-sesgos-cohortes-pequenas](T01-sesgos-cohortes-pequenas/INFORME.md) |
| E2 · Fidelidad de las explicaciones de ARA | R-L5.5 | No cumplido: exhaustividad localizada 0,71; alarmas interpretativas 0,21; la base de Grok trae errores objetivos en el 63 % | [E2-fidelidad-explicaciones](E2-fidelidad-explicaciones/INFORME.md) |
| T05 · E4 · Resolución de identidades | R-L1.1 · R-L5.3 · H1 · H5.1 | H1/H5.1 confirmadas con sintéticos: F1 ≥ 0,995 con 199 etiquetas; en el escenario difícil solo el método propio pasa de 0,95 | [T05-resolucion-identidades](T05-resolucion-identidades/INFORME.md) |
| T03 · Estabilidad de la puntuación de ARA | R-L5.2 | Criterios cumplidos; el GTI no influye en la recomendación | [T03-estabilidad-puntuacion](T03-estabilidad-puntuacion/INFORME.md) |

Requisito: Node 22 (T01, T03, E2) y Python 3.12 con `uv` (T05; ver su protocolo). T01 y T03 no tienen dependencias; E2 usa `zod` del propio plugin y llama al proxy de producción solo en el paso 2 (generación).
