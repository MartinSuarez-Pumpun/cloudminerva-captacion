# cloudminerva-captacion

## Qué es esto

Plugin standalone de React para un sistema modular de Pumpún Dixital. Código de módulo **MOD-10**, identificador `recruitment`.

El sistema anfitrión carga plugins de forma dinámica y los monta pasándoles un callback `onComplete(result)`. El plugin gestiona su propio flujo completo y llama a `onComplete` al terminar (con los datos del informe) o al cancelar (con `null`).

---

## Contexto del producto

**Demo de IA para Reclutamiento Militar — INNOVADEF 2026**

Demo presencial del asistente conversacional **ARA** (Asistente de Reclutamiento y Aptitud), desarrollado por Pumpún Dixital S.L. El objetivo es mostrar en directo en el evento cómo la IA puede orientar a un aspirante a las Fuerzas Armadas españolas hacia la especialidad fundamental que mejor encaja con su perfil, en una sesión de 8-10 minutos.

El plugin implementa la **versión UI/pantalla** del flujo de ARA. La lógica de voz es un sistema aparte ya operativo; este plugin es la interfaz visual que acompaña o sustituye la voz en el stand.

---

## Flujo completo del módulo

El candidato pasa por 4 módulos secuenciales + evaluación final:

| Orden | Módulo | Ítems | Duración | Qué mide |
|-------|--------|-------|----------|----------|
| 1 | Intereses vocacionales | 12 | ~3 min | Familias de especialidades |
| 2 | Aptitudes cognitivas | 6 | ~2 min | GTI (razonamiento numérico, verbal, lógico, espacial) |
| 3 | Personalidad | 8 | ~2 min | Big Five militar (disciplina, resiliencia, equipo, detalle, autoridad) |
| 4 | Motivación y disponibilidad | 5 | ~1 min | Filtros duros de exclusión |
| — | Evaluación final | — | ~1-2 min | Especialidad recomendada + alternativa + razones |

**Flujo conversacional:**
1. Bienvenida + aclaración orientativa (no vinculante)
2. Recogida de nombre/alias, edad y formación máxima
3. Cuestionario 1 — Intereses
4. Transición animadora
5. Cuestionario 2 — Aptitudes
6. Transición
7. Cuestionario 3 — Personalidad
8. Transición
9. Cuestionario 4 — Motivación
10. Evaluación final con perfil cognitivo + intereses + personalidad + recomendación
11. Cierre con opción de QR/resumen

---

## Cuestionario 1 — Intereses vocacionales

**Formato:** 12 ítems Sí / No / No estoy seguro  
**Puntuación:** Sí=2, No sé=1, No=0. Normalizado a 0-1 por familia.

**8 familias temáticas:**

| Código | Familia | Especialidades asociadas |
|--------|---------|--------------------------|
| F1-CMB | Combate y acción directa | Infantería Ligera, Caballería, Infantería de Marina |
| F2-TEC | Técnica y mecánica | Ingenieros, Mantenimiento Operativo, Energía y Propulsión |
| F3-CYB | Tecnología, electrónica y ciberdefensa | Transmisiones, Operaciones y Sistemas |
| F4-SAN | Sanidad y cuidado | Sanidad militar, Veterinaria |
| F5-LOG | Logística, administración | Logística ET, Aprovisionamiento Armada |
| F6-MAN | Mando y liderazgo | Vía suboficiales, instrucción |
| F7-MAR | Entorno marítimo/aéreo | Maniobra y Navegación, Mantenimiento Aire |
| F8-ART | Creatividad y comunicación | Música Militar, Cartografía |

**Los 12 ítems (I1.1–I1.12):**
- I1.1: trabajo al aire libre en terrenos exigentes → F1×2
- I1.2: desmontar/reparar máquinas → F2×2
- I1.3: ordenadores, redes, ciberseguridad → F3×2
- I1.4: cuidar heridos, primeros auxilios → F4×2
- I1.5: planificar, inventariar, controlar materiales → F5×2
- I1.6: tomar iniciativa y proponer planes → F6×2
- I1.7: trabajar en barco o base aérea lejos de casa → F7×2
- I1.8: música, comunicación audiovisual, cartografía → F8×2
- I1.9: mantenimiento técnico complejo en campaña → F1×1, F2×2
- I1.10: dirigir equipo en misión técnica → F6×2, F2×1
- I1.11: idiomas, análisis de info, cartografía → F3×1, F8×1
- I1.12: misiones humanitarias internacionales → F1×1, F4×1, F6×1

---

## Cuestionario 2 — Aptitudes cognitivas (GTI)

**6 ítems, tiempo blando ~45-60 s cada uno. No se penaliza el error.**

| Código | Área | Pregunta | Respuesta |
|--------|------|----------|-----------|
| A2.1 | Numérico-serie | 5,10,20,40,80,… | B) 160 |
| A2.2 | Numérico-cálculo | 48 raciones ÷ 4 grupos | B) 12 |
| A2.3 | Verbal-comprensión | "mantened la posición" | C) permanecer |
| A2.4 | Verbal-analogía | médico:hospital = mecánico:? | C) taller |
| A2.5 | Lógico-inferencia | Todos pilotos saben nadar, Marta es piloto | B) Marta sabe nadar |
| A2.6 | Lógico-espacial | Letra F girada 180° eje vertical | C) izquierda |

**GTI (0-100):** Numérico 30 pts (15+15) · Verbal 20 pts (10+10) · Lógico-espacial 50 pts (15+15 lógico + 10+10 espacial implícito en A2.6)

**Umbrales:**
- 0-39: perfil con margen formativo
- 40-69: competente, válido para mayoría de especialidades
- 70-100: destacado → especialidades técnicas o vía Suboficiales

---

## Cuestionario 3 — Personalidad (mini-TAPAS)

**8 ítems de elección forzada** (par A/B, candidato elige la que más le describe)

**5 rasgos:**
- **D** — Disciplina (seguir procedimientos sin supervisión)
- **R** — Resiliencia (tolerancia al estrés físico)
- **T** — Trabajo en equipo
- **O** — Orientación al detalle
- **A** — Aceptación de la autoridad

Cada rasgo puntúa 0-3. Ítems P3.1–P3.8 distribuidos entre los 5 rasgos.

**Perfiles resultantes:**
- D+O dominantes → Aprovisionamiento, Transmisiones, Mantenimiento, Sanidad
- R+T dominantes → Infantería Ligera, Infantería de Marina, Caballería
- A muy alto (3) → potencial Suboficiales si además GTI ≥ 70
- Perfil plano → priorizar intereses vocacionales en recomendación final

---

## Cuestionario 4 — Motivación y disponibilidad

**5 ítems, respuesta verbal de 3 niveles. Generan filtros duros.**

| Código | Eje | Opciones | Efecto si negativo |
|--------|-----|----------|--------------------|
| M4.1 | Movilidad geográfica | Sí/Depende/No | Bloquea IM y Maniobra/Navegación |
| M4.2 | Despliegues internacionales | Sí/Tal vez/No | Prioriza especialidades sin despliegue |
| M4.3 | Riesgo físico | Sí/Solo si/No | **No rotundo** → no recomienda especialidad, redirige |
| M4.4 | Horizonte temporal | Sí/Probablemente/No | "Solo unos años" → vía T&M estándar |
| M4.5 | Promoción interna | Sí/Tal vez/No | Sí + GTI≥70 + A≥2 → menciona vía Suboficiales |

---

## Fórmula de afinidad y recomendación

```
Afinidad = 0.50 × (intereses normalizados) + 0.30 × (GTI/100) + 0.20 × (compatibilidad personalidad)
```

- La especialidad ganadora es la de mayor afinidad tras descartar las excluidas por filtros duros.
- Si dos especialidades quedan a menos de 0.05 puntos, se mencionan ambas.
- La alternativa recomendada es la segunda mejor de un cluster distinto.

---

## Las 13 especialidades fundamentales y su perfil

| Especialidad | Rama | Intereses | Personalidad | Nota |
|---|---|---|---|---|
| Infantería Ligera | ET | F1 dom, F6 med | R≥2, T≥2 | Movilidad y riesgo aceptados |
| Caballería | ET | F1 dom, F2 med | R≥2, T≥2, D≥1 | Vehículos blindados |
| Ingenieros | ET | F2 dom, F1 med | D≥2, O≥1 | Campo, exigente físicamente |
| Transmisiones | ET | F3 dom, F2 med | O≥2, D≥2 | GTI≥60 recomendado |
| Sanidad | ET/Armada/EAE | F4 dom | T≥2, O≥2 | Vocación sobre GTI |
| Logística | ET | F5 dom, F6 med | O≥2, D≥2 | Alta empleabilidad civil |
| Operaciones y Sistemas | Armada | F3 dom, F7 med | O≥2, D≥1 | GTI≥60 necesario |
| Energía y Propulsión | Armada | F2 dom, F7 med | D≥2, O≥1 | FP industrial ventaja |
| Aprovisionamiento | Armada | F5 dom | O≥2, D≥2 | Análogo logística terrestre |
| Maniobra y Navegación | Armada | F7 dom, F1 med | R≥2, T≥2 | Embarques largos obligatorios |
| Infantería de Marina | Armada | F1 dom, F7 med | R≥3, T≥2 | La más exigente físicamente |
| Protección y Apoyo a la Fuerza | EAE | F1 dom, F6 med | R≥2, A≥2 | Seguridad de bases aéreas |
| Mantenimiento Operativo | EAE | F2 dom, F3 med | O≥2, D≥2 | FP aeronáutica ventaja |

---

## Casos especiales (edge cases)

- **Perfil mixto sin dominante**: mencionar las 2 mejores, dejar al candidato decidir
- **GTI < 40 con vocación clara**: no desanimar, redirigir a proceso oficial y preparación
- **M4.3 = No rotundo**: no recomendar especialidad, redirigir honestamente
- **M4.1 = No rotundo**: excluir IM y Maniobra/Navegación; plantear si FAS es opción viable
- **Usuario hostil/irónico**: modo demostración, ofrecer parar sin problema

---

## Contrato del plugin

```jsx
// El host monta el plugin así:
<RecruitmentPlugin onComplete={(result) => { /* result o null si cancela */ }} />
```

**Resultado esperado en `onComplete`:**
```js
{
  candidato: { nombre, edad, formacion },
  intereses: { F1, F2, F3, F4, F5, F6, F7, F8 },  // 0-1 cada familia
  gti: 78,                                           // 0-100
  personalidad: { D, R, T, O, A },                  // 0-3 cada rasgo
  motivacion: { movilidad, despliegues, riesgo, horizonte, promocion },
  recomendacion: { principal: "Energía y Propulsión", alternativa: "Ingenieros" },
  afinidades: { /* puntuación por especialidad */ }
}
```

- `onComplete(null)` → el usuario cancela.

---

## Stack y convenciones

- **React 19 + Vite 8**
- **CSS plano con variables CSS** (sin Tailwind, sin CSS-in-JS)
- **`lucide-react`** para iconografía
- Sin estado global externo — el plugin es autocontenido
- Variables CSS en `.recruitment-plugin` (raíz del componente)
- Color de acento: `#22C55E` (verde) · Fondo: `#070707` · Borde: `rgba(34, 197, 94, 0.22)`
- Estética oscura y técnica, coherente con el sistema anfitrión

---

## Estructura de archivos

```
src/
  plugin.jsx   ← componente raíz exportado como default
  plugin.css   ← estilos del módulo
plugin.json    ← metadatos que lee el host (no tocar salvo versión)
CLAUDE.md      ← este archivo
```

---

## Estado actual

Scaffold inicial — `src/plugin.jsx` solo tiene el esqueleto con botón cancelar. Pendiente implementar el flujo completo de los 4 módulos, la lógica de scoring y el informe final.

---

## Contexto de empresa

**Pumpún Dixital S.L.** — Vigo / Madrid — pumpun.cloud  
Producto presentado en INNOVADEF 2026 como coorganizadores del evento.