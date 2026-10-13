# Spec: Alerta de restricción del crecimiento por altura uterina
Feature nueva de HCP Digital (CLAP) — Control prenatal
Fecha: 13 de octubre de 2026

## Overview
Hoy la HCP marca una alerta cuando una sola medición de altura uterina cae bajo el percentil 10 de la curva del CLAP. Esa regla remite a ecografía a muchos fetos sanos o pequeños pero estables, y no avisa cuando un feto empieza a caerse de su carril mientras sigue sobre el percentil 10. Esta feature mira la secuencia de mediciones de altura uterina y las ecografías disponibles, separa el error de la cinta métrica del crecimiento real y clasifica cada control en una de cinco categorías. Cuando sospecha restricción, genera la orden de ecografía y explica a la gestante qué hacer y por qué. Se basa en el prototipo `alerta_altura_uterina_ou.html`.

## Usuarios objetivo

**Profesional de control prenatal** (médico, enfermera, partera). Hoy grafica la altura uterina en la curva del CLAP y decide con base en un solo punto. Si el punto queda bajo p10, remite; si queda sobre p10, sigue. No tiene forma práctica de saber si una medición baja es error de medición, un feto pequeño que siempre ha sido pequeño o uno que se está deteriorando. Tampoco ve con facilidad una caída de carril que todavía no cruza el p10.

**Gestante.** Recibe la remisión a ecografía sin entender por qué, o no la recibe a tiempo. Ve esta feature solo a través de su carné digital.

## Alcance

### La v1 SÍ hace
1. **Clasifica el crecimiento en cada control** a partir de la altura uterina y de las ecografías registradas, en cinco categorías: datos insuficientes, crecimiento adecuado, pequeño estable, crecimiento en descenso y sospecha de restricción.
2. **Funciona como segundo filtro**: cuando la altura uterina cae bajo p10, indica si el feto es pequeño estable o si viene en descenso.
3. **Avisa el descenso del carril** aunque la altura uterina siga sobre p10.
4. **Genera la orden de ecografía** y muestra el aviso en el carné de la gestante cuando la clasificación es crecimiento en descenso o sospecha de restricción.

### La v1 NO hace
- No usa factores de riesgo maternos (hipertensión, preeclampsia, tabaquismo, restricción en embarazo previo) para ajustar la alerta. Eso es v2.
- No diagnostica restricción del crecimiento. Solo prioriza la remisión a ecografía.
- No interpreta Doppler ni otros hallazgos ecográficos fuera de las biometrías registradas.
- No funciona en embarazo múltiple.
- No usa otra curva de referencia distinta a la del CLAP.
- No envía mensajes a la gestante fuera del carné.

## Comportamiento esperado

### Registro de datos (profesional)
1. En cada consulta de seguimiento, el profesional registra la altura uterina como ya lo hace en la HCP.
2. Cuando la gestante trae una ecografía, el profesional registra en el mismo control la fecha del estudio, la edad gestacional, el peso fetal estimado y la circunferencia abdominal, con sus percentiles tal como vienen en el informe.
3. Si una medición de altura uterina difiere mucho de la esperada según los controles previos, la app pide confirmarla antes de guardarla ("¿Confirma 24 cm? En el control anterior midió 29 cm").

### Lo que ve el profesional
4. Al guardar la altura uterina, la app muestra la curva del CLAP con:
   - Las mediciones de todos los controles.
   - El crecimiento estimado por la app, con su margen de incertidumbre.
   - La proyección a dos semanas.
   - Las ecografías registradas, marcadas sobre la misma línea de tiempo.
5. Junto a la curva aparece la clasificación del control actual y una frase que la explica en lenguaje clínico, por ejemplo: "Bajó del percentil 50 al 15 en 6 semanas. Probabilidad de descenso: 91 %".
6. El historial de controles muestra la clasificación de cada uno, para ver cómo cambió en el tiempo.
7. Cada clasificación significa:
   - **Datos insuficientes**: hay menos de tres mediciones de altura uterina desde la semana en que la curva del CLAP es válida. Se aplica la regla clásica: si una medición cae bajo p10, se genera la orden de ecografía como hoy.
   - **Crecimiento adecuado**: el feto se mantiene en su carril. Sin acción.
   - **Pequeño estable**: el tamaño estimado está bajo p10 pero no viene en descenso. No genera orden de ecografía. La app le sugiere al profesional mantener la medición en cada control.
   - **Crecimiento en descenso**: la probabilidad de que el feto se esté cayendo de su carril supera el límite configurado. Genera orden de ecografía.
   - **Sospecha de restricción**: hay descenso y la proyección a dos semanas queda bajo p10, o una ecografía registrada muestra peso fetal estimado o circunferencia abdominal bajo el percentil definido por el equipo clínico. Genera orden de ecografía con prioridad.

### Orden de ecografía
8. Cuando la clasificación es crecimiento en descenso o sospecha de restricción, la app genera automáticamente la orden de ecografía obstétrica de crecimiento, con el motivo escrito ("Descenso del crecimiento por altura uterina desde la semana 30").
9. La orden queda a nombre del profesional que atiende el control y aparece en el resumen de la consulta.
10. El profesional puede anular la orden escribiendo el motivo. La anulación queda en la bitácora.
11. Si ya existe una orden de ecografía pendiente o una ecografía registrada en las últimas dos semanas, la app no genera otra. Muestra la existente y recuerda que hay que registrar su resultado.

### Lo que ve la gestante en su carné
12. Si la clasificación es crecimiento en descenso o sospecha de restricción, el carné muestra la alerta como las demás: qué hacer y por qué, en lenguaje simple. Por ejemplo: "Necesitas una ecografía antes de tu próximo control. En las últimas mediciones tu bebé creció menos de lo esperado y queremos verlo mejor. Lleva la orden que te entregaron."
13. Si la clasificación es datos insuficientes con altura uterina bajo p10, el carné muestra la misma alerta con la orden de ecografía.
14. Las clasificaciones crecimiento adecuado y pequeño estable no muestran ningún aviso en el carné.
15. Cuando el profesional registra la ecografía, la alerta del carné se actualiza: desaparece o cambia según lo que decida el profesional.

### Sin conexión
16. La clasificación, la orden y el aviso en el carné funcionan sin internet, igual que el resto de la consulta, y se sincronizan cuando vuelve la señal.

## Errores y seguridad

- **Embarazo múltiple**: la feature no se activa. La app muestra al profesional que la curva de altura uterina del CLAP no aplica y que el seguimiento del crecimiento debe hacerse por ecografía.
- **Edad gestacional poco confiable** (fecha de última menstruación dudosa y sin ecografía temprana): la app sigue clasificando, pero lo indica junto a la clasificación ("Edad gestacional por FUM no confirmada: la clasificación es menos confiable").
- **Condiciones que alteran la altura uterina** (polihidramnios, miomas, obesidad, presentación transversa): si están registradas, la app lo indica junto a la clasificación y sugiere apoyarse en la ecografía.
- **Mediciones fuera del rango de la curva del CLAP**: se guardan pero no se clasifican.
- **Medición improbable**: se pide confirmación antes de guardar (punto 3). Si el profesional la confirma, entra al cálculo.
- **Corrección de una medición pasada**: la app recalcula las clasificaciones desde ese control en adelante y lo registra en la bitácora. Si la corrección cambia una clasificación que ya había generado una orden, avisa al profesional en lugar de anular la orden sola.
- **Ecografía con datos incompletos**: se guarda lo que haya. Si falta el percentil, no se usa en la clasificación y la app lo indica.
- **Parámetros clínicos**: la curva del CLAP, el límite de probabilidad para alertar, el error de medición de la altura uterina y los percentiles ecográficos de corte viven en el catálogo de parámetros clínicos, con su fuente y su estado. Si alguno está "pendiente de validar", la app muestra el aviso interno de siempre.
- **Privacidad**: el carné nunca muestra percentiles, probabilidades ni la palabra "restricción". Solo qué hacer y por qué, en lenguaje simple.

## Éxito
La app guarda en segundo plano, para cada control, qué habría hecho la regla clásica (una medición bajo p10) además de lo que hizo la feature. Con esos datos se compara:

1. **Menos remisiones innecesarias**: proporción de órdenes de ecografía cuyo resultado mostró un feto con crecimiento normal o pequeño estable, con la feature frente a la regla clásica. La meta es una reducción clara sin perder casos.
2. **Detección más temprana**: proporción de restricciones confirmadas que tuvieron alerta antes de la semana 37, con la feature frente a la regla clásica.
3. **Gestantes que se hacen la ecografía**: proporción de órdenes generadas cuya ecografía queda registrada antes del siguiente control.

Antes del lanzamiento, el rendimiento se revisa con historias clínicas perinatales anteriores con desenlace conocido, para fijar los valores del catálogo.

## Decisiones pendientes
- **Confirmación de la restricción**: la v1 no cubre el parto, así que para medir el éxito hay que obtener el peso al nacer o el diagnóstico ecográfico definitivo. Falta definir de dónde sale ese dato.
- **Percentiles de corte ecográficos** para pasar directo a sospecha de restricción (por ejemplo, peso fetal estimado o circunferencia abdominal bajo p3 o bajo p10), y la referencia de los percentiles ecográficos que se aceptan en el informe.
- **Límite de probabilidad para alertar** y si se exige confirmación en dos controles seguidos. El prototipo usa 85 % en el primer control.
- **Error de medición de la altura uterina** que asume el modelo. El prototipo usa ±1 cm.
- **Contenido de la orden de ecografía**: si incluye Doppler o solo biometría.
- **Orden automática**: confirmar con la institución que una orden generada por la app y emitida a nombre del profesional cumple sus requisitos para ser válida.
- **Umbral de obesidad** a partir del cual la app avisa que la altura uterina es menos confiable.

## V2
- Factores de riesgo maternos (hipertensión, preeclampsia, tabaquismo, restricción en embarazo previo, uso de ASA) para ajustar la sospecha desde el inicio.
- Curva configurable (INTERGROWTH-21st).
- Lectura de Doppler y líquido amniótico.
- Registro del peso al nacer para medir el éxito dentro de la app.
- Reporte institucional de remisiones a ecografía y su rendimiento.
