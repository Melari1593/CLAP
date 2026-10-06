# Roadmap: HCP Digital (CLAP) para control prenatal
Fecha: 6 de octubre de 2026

## La idea en una frase
Una versión digital de la Historia Clínica Perinatal del CLAP para el profesional que hace control prenatal. Calcula y alerta por él, y entrega a la gestante un carné digital tan simple que lo entienda sin ayuda.

## Quién la usa
- **Usuario principal:** el profesional de control prenatal. Es quien la adopta y la usa en cada consulta.
- **Usuaria que define el éxito:** la gestante. No instala nada complejo ni llena formularios largos. Solo recibe y consulta su carné.

Implicación de diseño: la complejidad clínica vive del lado del profesional. Del lado de la gestante solo llega lo que necesita saber y hacer. La HCP incluye la variable "alfabeta", así que su vista debe funcionar también para mujeres con baja alfabetización (iconos, frases cortas, lenguaje cotidiano).

## La acción core
**El profesional registra una consulta prenatal y la gestante sale con su carné digital actualizado.** El carné muestra en cuántas semanas va, cuándo es su próxima cita, qué debe llevar o hacerse y qué señales la deben traer de urgencia.

Todo lo demás sirve a esa acción.

## Fase 1 — Lanzamiento
| # | Feature | Por qué va primero | Depende de |
|---|---------|--------------------|------------|
| 1 | **Primera consulta**: identificación, antecedentes y gestación actual de la HCP, con cálculo automático de FPP, edad gestacional, IMC e intervalo intergenésico | Sin la primera consulta no existe historia ni carné. Los cálculos son el primer ahorro de tiempo visible para el profesional. | — |
| 2 | **Consultas de seguimiento con alertas**: registro de cada control (EG, peso, PA, altura uterina, FCF, movimientos, proteinuria). Los campos amarillos del CLAP se convierten en alertas y los exámenes en recordatorios por semana (VDRL, VIH, Hb, EGB, antitetánica). Se suma una alerta que el CLAP 2007 no trae: **considerar ASA** según los factores de riesgo de preeclampsia de la GPC colombiana, desde la semana 12; **diabetes gestacional** por PTOG de 75 g entre las semanas 24 y 28; **iniciar carbonato de calcio** en toda gestante desde la semana 14 y hasta el parto; y **considerar tromboprofilaxis** según el puntaje de riesgo trombótico, en la primera consulta y en la semana 28 | Es el corazón clínico: convierte el formulario en un sistema que avisa, no solo que archiva. | #1 |
| 2b | **Derechos sexuales y reproductivos e IVE**: si el embarazo es no planeado y la gestante no desea continuarlo, o hay violencia sexual o es menor de 14 años, la app guía la asesoría de opciones según la Sentencia C-055 de 2022 y la Resolución 051 de 2023, registra su decisión en privado y apoya la remisión urgente | Es un derecho que debe garantizarse desde la primera consulta, y la HCP ya pregunta si el embarazo fue planeado y por violencia | #1 |
| 3 | **Carné digital de la gestante**: se abre por enlace o QR, sin contraseña complicada, y muestra semanas, próxima cita, exámenes pendientes y signos de alarma en lenguaje sencillo con iconos | Es lo que hace la app fácil para la gestante y reemplaza el carné de papel que se pierde. | #1, #2 |

**Condición de toda la Fase 1:** debe poder usarse sin conexión a internet durante la consulta. Sin esto, la app no sirve en los contextos rurales donde más se necesita.

## Fase 2 — Mejora
1. **Recordatorios a la gestante**: mensajes antes de su cita y de exámenes pendientes, por el canal que más use (por ejemplo, mensajería). Se decide con lo aprendido sobre si la gestante abre el carné.
2. **Gráficas de altura uterina y ganancia de peso** contra los percentiles P10/P90 del carné perinatal, visibles para el profesional y en versión simplificada para la gestante.
3. **Tamizaje de violencia guiado y privado**: las 5 preguntas del CLAP como flujo paso a paso, con el cambio automático de "en el último año" a "desde su última visita". En Fase 1 se registra SÍ/NO; aquí se vuelve un flujo cuidado.
4. **Lectura del carné por otra institución** (QR al ingreso a parto) y exportación de la HCP en el formato CLAP para referencias.
5. **Precarga de antecedentes por la gestante** desde su celular antes de la primera consulta. Es opcional y solo si la Fase 1 muestra que ella usa el carné sin dificultad. Si no, agrega carga en vez de quitarla.

## Backlog
- Secciones de parto/aborto, recién nacido, puerperio, egresos y anticoncepción (la HCP completa).
- Partograma con curvas de alerta del CLAP.
- Evaluación del riesgo trombótico en hospitalización y posparto.
- Reportes e indicadores por institución (cobertura de VDRL, controles completos, corticoides, etc.). Necesitan datos acumulados de la Fase 1 para tener sentido.
- Interoperabilidad con la historia clínica electrónica nacional y el reporte a entes de salud.
- Asistente con IA para la gestante. Es de vanidad por ahora: no la acerca a la acción core más que un carné claro y bien escrito, y agrega riesgo clínico.
- Gamificación o seguimiento de "logros" del embarazo. También es de vanidad: no mejora la asistencia a controles por sí sola.
- Manejo multi-institución, roles y auditoría avanzada.

## Supuestos a validar
- **Señal de que vale la pena:** la gestante abre su carné entre consultas y llega a la siguiente cita con los exámenes indicados, y el profesional termina la consulta en igual o menos tiempo que con el formulario en papel.
- Las reglas de alerta se toman del manual CLAP 2007, corregidas (fórmula del IMC) y cruzadas con la Ruta Materno Perinatal vigente en Colombia antes de construirlas. El ASA (75–100 mg desde la semana 12 hasta el parto) y la PTOG siguen la GPC colombiana 2013. La anemia se define con los puntos de corte por trimestre de la OMS 2024 y sus ajustes por altitud de residencia y tabaquismo, así que la primera consulta registra el municipio y su altitud. El contenido sobre IVE y derechos sexuales y reproductivos informa las sentencias y normas vigentes en Colombia, con fecha de verificación, y usa la ruta de remisión de la institución. Para la tromboprofilaxis, sigue la RCOG 37a con las modificaciones de su declaración de posición (puntaje, casos especiales y tabla de dosis), y se revisa cuando la RCOG publique la guía actualizada. Las heparinas, trombofilias, factores de sangrado y criterios de referencia también siguen la RCOG, incluida la trombocitopenia (plaquetas menores de 75 × 10⁹/L) como factor de sangrado.

## Siguiente paso
Convertir la Fase 1 en spec con /crear-specs, usando este roadmap como contexto.
