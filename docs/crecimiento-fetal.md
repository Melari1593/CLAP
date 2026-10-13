# Crecimiento fetal por altura uterina

Implementa el [spec del 13 de octubre de 2026](specs/2026-10-13-crecimiento-fetal-altura-uterina.md).
No diagnostica restricción del crecimiento: prioriza la remisión a ecografía.

## Cómo clasifica

1. Cada altura uterina se pasa a un puntaje z de la curva del CLAP. La curva da los percentiles 10 y
   90; se asume una distribución normal entre ellos.
2. Con las mediciones de las últimas 10 semanas (al menos 3) se ajusta una recta del puntaje z en el
   tiempo. El ajuste es una regresión bayesiana: el error de la cinta (±1 cm) es el ruido de cada
   medición y la pendiente tiene una previa normal de media 0.
3. La pendiente da la **probabilidad de descenso** (que el feto se esté cayendo de su carril). La
   recta da el tamaño estimado hoy, con su margen (intervalo del 80 %), y la proyección a 2 semanas.

| Clasificación | Cuándo | Orden de ecografía | Carné |
|---|---|---|---|
| Datos insuficientes | Menos de 3 mediciones desde la semana 13 | Solo si la última está bajo p10 (regla clásica) | Aviso si hay orden |
| Crecimiento adecuado | En su carril | No | Nada |
| Pequeño estable | Tamaño estimado bajo p10, sin descenso | No: mantener la medición en cada control | Nada |
| Crecimiento en descenso | Probabilidad de descenso ≥ 85 % | Sí | Aviso |
| Sospecha de restricción | Descenso con proyección bajo p10, o ecografía con peso fetal o circunferencia abdominal bajo el percentil de corte | Sí, prioritaria | Aviso |

Embarazo múltiple (ecografía con 2 o más fetos): no se clasifica.

## Dónde aparece

- **Curva de altura uterina** (examen físico):
  - las mediciones, el crecimiento estimado con su margen y la proyección punteada;
  - las ecografías marcadas;
  - la clasificación con su frase ("Bajó del percentil 45 al 20 en 6 semanas. Probabilidad de
    descenso: 93 %") y los avisos de confiabilidad: EG por FUM no confirmada, polihidramnios,
    miomas, obesidad, presentación transversa, ecografía sin percentil y mediciones fuera de la
    curva.
- **Historial de la ficha**: la clasificación de cada control.
- **Alertas**:
  - "Crecimiento fetal en descenso", "Sospecha de restricción" o "Altura uterina por debajo del
    percentil 10" (datos insuficientes), con el estado de la orden;
  - "Revise la orden de ecografía" si al corregir una medición cambia la clasificación de un control
    que ya había generado la orden (la app no la anula sola).
- **Plan y órdenes**:
  - La orden se genera al guardar el último control abierto, a nombre del profesional del control,
    con el motivo escrito.
  - No se genera si hay otra orden de ecografía pendiente o una ecografía registrada en los últimos
    14 días.
  - Se anula con el motivo, que queda en la bitácora. Las órdenes anuladas no se imprimen.
- **Carné**: mientras la orden esté pendiente aparece "Necesitas una ecografía antes de tu próximo
  control…", sin percentiles, probabilidades ni la palabra "restricción". Desaparece al registrar la
  ecografía o si se anula la orden.
- **Medición improbable**: si la altura uterina difiere más de 4 cm de lo esperado según el control
  anterior, se pide confirmarla antes de guardar.
- **Ecografía**: en Laboratorios y ecografías se registra la biometría tal como viene en el informe:
  EG, peso fetal estimado y su percentil, circunferencia abdominal y su percentil, número de fetos,
  líquido amniótico y miomas.

## Para medir el éxito

Cada control guarda su clasificación, lo que habría hecho la regla clásica (una medición bajo p10), la
probabilidad de descenso y si se generó la orden (`Consulta.crecimiento`).

La **restricción se confirma con el peso fetal estimado de la ecografía**: percentil bajo el corte de
`crecimiento.ecografia` (decidido el 2026-10-13). Con eso, la pantalla "Catálogo clínico" compara la
app con la regla clásica:

| Métrica | Cómo se calcula |
|---|---|
| Remisiones innecesarias | De las ecografías que resolvieron órdenes de cada regla, las que mostraron peso fetal en o sobre el corte. Menos es mejor. |
| Detección antes de la semana 37 | De los embarazos con restricción confirmada (primera ecografía con peso bajo el corte), los que tuvieron orden de esa regla antes de la semana 37 y antes de la ecografía que confirmó. |
| Gestantes que se hacen la ecografía | De las órdenes que generó la app (no anuladas), las que tienen ecografía registrada antes del siguiente control. Las que siguen en curso no cuentan aún. |

Se calcula con las historias del dispositivo (`src/alertas/crecimientoRendimiento.ts`), no con los
eventos, porque los eventos no llevan resultados de exámenes. Los embarazos múltiples no cuentan.

## Pendiente de decidir (catálogo, estado "pendiente")

- `crecimiento.au`:
  - límite de probabilidad (85 %) y si se exige confirmar en dos controles seguidos;
  - error de la cinta (±1 cm);
  - caída mínima, ventana, previa de la pendiente;
  - diferencia para "medición improbable".
- `crecimiento.ecografia`: percentil de corte del peso fetal y de la circunferencia abdominal (p3 o
  p10), y qué referencia de percentiles ecográficos se acepta.
- `crecimiento.obesidadImc`: IMC desde el que la altura uterina es menos confiable (30).
- `au.percentiles`: tabla numérica oficial del CLAP.
- Contenido de la orden (¿Doppler o solo biometría?) y validez de una orden generada por la app.

Antes del lanzamiento, el rendimiento se revisa con historias perinatales anteriores con desenlace
conocido para fijar estos valores.
