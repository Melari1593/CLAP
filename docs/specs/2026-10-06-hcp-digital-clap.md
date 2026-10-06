# Spec: HCP Digital (CLAP) — Control prenatal
Fecha: 6 de octubre de 2026

## Overview
Versión digital de la Historia Clínica Perinatal del CLAP para usar en el control prenatal. El profesional registra cada consulta. La app hace los cálculos, avisa lo que requiere atención (los campos amarillos del CLAP) y recuerda los exámenes según la semana de gestación. Al terminar, la gestante recibe por WhatsApp su carné digital, protegido con un PIN. El carné le explica en lenguaje simple en qué semana va, cuándo vuelve, qué debe hacerse y por qué. Si ella no tiene WhatsApp, se imprime. Todo funciona aunque no haya internet en la consulta.

## Usuarios objetivo

**Profesional de control prenatal** (médico, enfermera, partera). Hoy llena la HCP en papel. Calcula la edad gestacional con gestograma o a mano y depende de su memoria para saber qué examen toca en cada semana y cuándo un dato debe preocuparle. Cuando la gestante llega a otra institución, la información no viaja con ella o viaja incompleta.

**Gestante.** Hoy recibe un carné de papel que se moja, se pierde o no entiende. Muchas veces no sabe cuándo es su próxima cita, qué exámenes debe llevar ni qué señales la deben traer de urgencia. Algunas tienen baja alfabetización, por eso la HCP pregunta si es alfabeta. Es la persona para quien la app debe ser más fácil.

## Alcance

### La v1 SÍ hace
1. **Primera consulta completa**: identificación, antecedentes familiares, personales y obstétricos, y gestación actual según la HCP, con cálculos automáticos.
2. **Consultas de seguimiento con alertas y recordatorios**: registro de cada control, alertas automáticas y exámenes pendientes según la semana.
3. **Carné digital de la gestante**: enviado por WhatsApp, protegido con PIN, en lenguaje simple. Se puede imprimir si ella no tiene WhatsApp.
4. **Funciona sin internet** durante la consulta y envía lo pendiente cuando vuelve la señal.

### La v1 NO hace
- Parto, aborto, recién nacido, puerperio, egresos ni anticoncepción. Solo cubre el control prenatal.
- Partograma.
- Recordatorios automáticos a la gestante (mensajes antes de la cita).
- Gráficas de altura uterina y ganancia de peso.
- Flujo guiado del tamizaje de violencia: en la v1 se registra SÍ/NO, como en la HCP.
- Lectura del carné por otra institución con QR, ni exportación al formato CLAP.
- Que la gestante llene o edite datos. Ella solo ve su carné.
- Reportes, tableros e indicadores.
- Conexión con la historia clínica de otras instituciones o reportes a entes de salud.
- Asistente con IA, chat o gamificación.
- Pagos, agendamiento en línea o videoconsulta.
- Que el sistema tome decisiones clínicas. Solo avisa; el profesional decide.
- Prestar, agendar ni autorizar la interrupción voluntaria del embarazo (IVE). La app apoya la información, el registro de la voluntad y la remisión (sección 7).

## Comportamiento esperado

### 1. El profesional empieza una consulta
1. Abre la app y busca a la gestante por número de identidad o nombre.
2. **Si ya existe**, ve su embarazo actual con el resumen arriba: semanas de gestación de hoy, FPP, alertas activas y exámenes pendientes. Pasa directo al control de seguimiento (paso 3).
3. **Si no existe**, crea su registro y empieza la primera consulta (paso 2).
4. Si la gestante ya tuvo un embarazo registrado, la app abre un embarazo nuevo y conserva los anteriores como antecedentes.

### 2. Primera consulta
El profesional llena los datos en el mismo orden de la HCP, en bloques cortos:

- **Identificación:** nombre, documento, fecha de nacimiento, domicilio, municipio de residencia y la **altitud de su lugar de residencia en metros sobre el nivel del mar**, que registra el profesional (vereda o barrio incluidos), teléfono, etnia (autoidentificación), alfabeta, estudios y años en el mayor nivel, estado civil, si vive sola.
- **Antecedentes familiares y personales:** listas SÍ/NO de la HCP.
- **Antecedentes obstétricos:** gestas, partos (vaginales y cesáreas), abortos, nacidos vivos y muertos, viven, muertos en la 1.ª semana y después, peso del último RN, gemelares, fecha de fin del embarazo anterior.
- **Embarazo planeado** y **fracaso de método anticonceptivo** (con las 6 opciones de la HCP). Si el embarazo es no planeado, la app pide registrar además si la gestante **desea continuar el embarazo** (sí / no / no ha decidido) y abre el flujo de la sección 7.
- **Riesgo de preeclampsia:** además de los antecedentes que ya trae la HCP, la app pregunta si tiene enfermedad autoinmune (lupus, síndrome antifosfolípido), antecedente familiar de preeclampsia y alergia al ASA o a los AINE o asma que empeora con ellos. La HCP no incluye estos datos y se necesitan para la alerta de ASA (sección 4). También pregunta si el embarazo es por fertilización in vitro, que se usa en la alerta de tromboprofilaxis.
- **Antecedentes para el calcio:** la app pregunta por hipercalcemia, hipercalciuria, hiperparatiroidismo, cálculos renales o nefrocalcinosis, enfermedad renal crónica grave, hipersensibilidad a productos con calcio y sarcoidosis. También por medicamentos que interactúan: diuréticos tiazídicos, digoxina, levotiroxina y uso frecuente de antiácidos con calcio. La HCP no trae estos datos y se necesitan para la alerta de calcio (sección 4).
- **Riesgo trombótico:** la app pregunta por datos que la HCP tampoco trae y que se necesitan para la alerta de tromboprofilaxis (sección 4):
  - Trombosis venosa o embolia previa y, si la hubo, si fue sin causa, asociada a hormonas, asociada a cirugía mayor o a otro factor ya resuelto.
  - Trombofilia conocida y su tipo, con la clasificación de la RCOG: **alto riesgo** (déficit de antitrombina, de proteína C o de proteína S; homocigota para factor V Leiden o para la mutación del gen de la protrombina; doble heterocigota) o **bajo riesgo** (heterocigota para factor V Leiden o para la mutación de la protrombina; anticuerpos antifosfolípidos).
  - Antecedente familiar de trombosis sin causa o asociada a hormonas en familiar de primer grado.
  - Várices gruesas.
  - Comorbilidades de alto riesgo: cáncer, insuficiencia cardíaca, lupus activo, poliartropatía inflamatoria, enfermedad inflamatoria intestinal, síndrome nefrótico, diabetes tipo 1 con nefropatía, drepanocitosis, uso actual de drogas intravenosas.
  - Factores transitorios presentes hoy: hiperémesis, cirugía en este embarazo, síndrome de hiperestimulación ovárica, infección sistémica que requiere antibióticos intravenosos u hospitalización, inmovilidad o deshidratación.
  - Factores de riesgo de sangrado (RCOG): sangrado activo antenatal; riesgo aumentado de hemorragia mayor (por ejemplo, placenta previa); trastorno hemorrágico (enfermedad de von Willebrand, hemofilia o coagulopatía adquirida); accidente cerebrovascular en las últimas 4 semanas; enfermedad renal grave; enfermedad hepática grave; hipertensión no controlada; trombocitopenia (plaquetas menores de 75 × 10⁹/L); alergia o trombocitopenia inducida por heparina.
- **Gestación actual:** peso anterior, talla, FUM, confiabilidad de la EG (por FUM y por eco), tabaco activo (y, si fuma, cuántos cigarrillos al día o "no sabe", para el ajuste de la Hb) y pasivo, drogas, alcohol, violencia (SÍ/NO), antirrubéola, antitetánica, examen odontológico y de mamas, cérvix, grupo y Rh, y exámenes con su resultado.

Mientras llena, la app calcula sola y muestra:
- **Edad** a partir de la fecha de nacimiento.
- **FPP** a partir de la FUM (280 días).
- **Edad gestacional** de hoy en semanas y días.
- **IMC pregestacional** (peso ÷ talla²) con su clasificación.
- **Intervalo intergenésico** desde el fin del embarazo anterior.

Para la **antitetánica**, el profesional indica cuántas dosis tiene y cuándo fue la última. La app le dice si está vigente y cuántas dosis aplicar en este embarazo, según las reglas del CLAP. También le recuerda que la segunda dosis va al menos 4 semanas después de la primera y al menos 3 semanas antes de la FPP.

### 3. Consulta de seguimiento
1. El profesional registra: fecha, peso, presión arterial, altura uterina, presentación, frecuencia cardíaca fetal, movimientos fetales, proteinuria, observaciones, sus iniciales y la fecha de la próxima cita.
2. La edad gestacional del día aparece sola.
3. Si un dato no aplica por las semanas (por ejemplo, presentación antes de la semana 28), la app lo marca como "no corresponde" en vez de dejarlo vacío.
4. Registra los resultados de exámenes que trae la gestante: Hb (indicando si la muestra fue venosa o capilar), recuento de plaquetas del hemograma, ferritina sérica cuando hay anemia (y saturación de transferrina si hay inflamación), VDRL/RPR, FTA y tratamiento, VIH (solicitado y realizado, antes o después de 20 semanas), toxoplasmosis, Chagas, malaria, bacteriuria, PTOG de 75 g (valores en ayunas, a la hora y a las 2 horas), estreptococo B.
5. Marca las indicaciones: hierro y ácido fólico, carbonato de calcio, preparación para el parto, consejería en lactancia.
6. Registra eventos nuevos desde el control anterior que cambian el riesgo trombótico: hospitalización, cirugía, hiperémesis, infección sistémica que requiere antibióticos intravenosos u hospitalización, inmovilidad o deshidratación, diagnóstico de preeclampsia. También registra cuándo se resolvió un factor transitorio. La app recalcula el puntaje al guardarlos.

### 4. Alertas
Cuando un dato cumple una condición amarilla del CLAP, la app la muestra destacada en ese momento y la mantiene en el resumen de la gestante hasta que el profesional la marque como atendida. La alerta nunca impide guardar.

| Alerta | Cuándo aparece |
|---|---|
| Edad de riesgo | Menor de 15 o mayor de 35 años |
| **Gestante menor de 14 años** | Edad menor de 14 años: se presume violencia sexual (ver sección 7) |
| Abortos a repetición | 3 abortos espontáneos consecutivos |
| Intervalo corto | Menos de 1 año entre el fin del embarazo anterior y el actual |
| Peso de RN previo | Último RN con menos de 2500 g o con 4000 g o más |
| Embarazo no planeado | Embarazo marcado como no planeado. Si no desea continuarlo o no ha decidido, abre el flujo de opciones (sección 7) |
| Anemia | Hb ajustada por altitud menor de 11,0 g/dL en 1.er o 3.er trimestre, o menor de 10,5 g/dL en 2.º trimestre, con su gravedad (ver abajo) |
| **Déficit de hierro** | En gestante con anemia, ferritina de 50 ng/mL o menos (ver abajo) |
| Sífilis | VDRL/RPR reactivo |
| Infecciones | Malaria, Chagas o bacteriuria positivas; estreptococo B positivo |
| **Diabetes gestacional** | PTOG de 75 g con al menos un valor alterado: ayunas de 92 mg/dL o más, 1 hora de 180 mg/dL o más, o 2 horas de 153 mg/dL o más (ver abajo) |
| Rh negativo | Rh negativo, y si está inmunizada |
| Hábitos | Tabaco activo, drogas o alcohol en cualquier trimestre |
| Violencia | SÍ en el embarazo actual. Si es violencia sexual, activa la ruta de atención y el flujo de la sección 7 |
| Antitetánica | Esquema no vigente |
| Vacunas | Antirrubéola no recibida (recordar aplicar en el puerperio) |
| **Considerar ASA** | 1 o más factores de alto riesgo, o 2 o más de riesgo moderado de preeclampsia (ver abajo) |
| **Iniciar carbonato de calcio** | Toda gestante desde la semana 14, sin calcio indicado ni contraindicación registrada (ver abajo) |
| **Considerar tromboprofilaxis** | Puntaje de riesgo trombótico de 3 o más, o un caso especial (ver abajo) |

**Cómo funciona la alerta de ASA**

La alerta sigue la GPC colombiana de embarazo (2013): **aspirina 75 a 100 mg por vía oral todos los días, desde la semana 12 de gestación hasta el día del parto**, en gestantes con 1 factor de alto riesgo o con 2 o más de riesgo moderado. La app cuenta los factores con los datos de la primera consulta.

- **Alto riesgo (basta uno):** trastorno hipertensivo en un embarazo anterior; enfermedad renal crónica; enfermedad autoinmune como lupus eritematoso sistémico o síndrome antifosfolípido; diabetes tipo 1 o 2; hipertensión crónica.
- **Riesgo moderado (se necesitan dos o más):** primer embarazo; edad de 40 años o más; intervalo intergenésico mayor de 10 años; IMC de 35 o más en la primera consulta; antecedente familiar de preeclampsia; embarazo múltiple.

Comportamiento:
1. **Antes de la semana 12**, si se cumple el criterio, no hay alerta todavía. El resumen muestra "ASA: iniciar en la semana 12 ([fecha calculada])" con los factores.
2. **Desde la semana 12** (o en la primera consulta si ya pasó), aparece:

   > **Considerar ASA para prevenir preeclampsia**
   > Factores: [lista]
   > Aspirina 75–100 mg por vía oral todos los días, desde la semana 12 hasta el día del parto.
   > [Indicado] [No indicado — motivo] [Ya lo toma]

3. **Si la gestante tiene alergia al ASA o a los AINE, o asma que empeora con ellos**, la alerta cambia a "Criterio de ASA presente, pero con contraindicación registrada" y no sugiere iniciarlo.
4. **Si la primera consulta es después de la semana 16**, la alerta lo señala ("inicio después de la semana 16") y el profesional decide.
5. El profesional marca **"ASA indicado"**, **"No indicado"** (con motivo) o **"Ya lo toma"**. La alerta queda atendida y la decisión se guarda en la historia.
6. Si un dato nuevo cambia el conteo (por ejemplo, se registra el IMC o un antecedente que faltaba), la app recalcula y avisa.

**Cómo funciona la alerta de diabetes gestacional (PTOG según la GPC)**

La GPC colombiana recomienda una **prueba de tolerancia oral a la glucosa (PTOG) con 75 g entre las semanas 24 y 28** a todas las gestantes, y **no recomienda** tamizar con glucemia basal ni con glucosa en orina. Por eso la app no usa la glucemia en ayunas aislada del CLAP.

Valores normales de la PTOG:

| Momento | Normal |
|---|---|
| Ayunas | menos de 92 mg/dL |
| 1 hora | menos de 180 mg/dL |
| 2 horas | menos de 153 mg/dL |

Comportamiento:
1. **Semanas 24 a 28:** la PTOG aparece como pendiente. Después de la 28 sin resultado, como atrasada.
2. Al registrar los tres valores, si **al menos uno** está en el límite o por encima, aparece **"Diabetes gestacional: PTOG alterada"** con el valor que la disparó.
3. Si falta algún valor, la app no clasifica y pide completarlo.
4. Si la PTOG se hizo fuera de las semanas 24 a 28, la app la interpreta igual pero indica la semana en que se hizo.
5. Antes de solicitarla, la app le recuerda al profesional los puntos que la GPC pide explicar a la gestante: que en muchas mujeres la diabetes gestacional responde a la dieta y el ejercicio, que entre 10 % y 20 % necesitan medicamentos o insulina, y que el diagnóstico implica más controles durante el embarazo y el parto.

**Cómo funciona la alerta de anemia (OMS 2024, con ajuste por altitud)**

La app sigue la guía de la OMS de 2024 sobre puntos de corte de hemoglobina. Usa puntos de corte por trimestre y suma un ajuste por la altitud de residencia, porque vivir en altura eleva la Hb y, sin ajuste, la anemia se subdiagnostica.

**Trimestres** (por edad gestacional del día del examen): 1.º hasta la semana 13+6; 2.º de la semana 14+0 a la 27+6; 3.º desde la semana 28+0. Si la EG no es confiable, la app clasifica con el trimestre estimado y lo indica junto al resultado.

Puntos de corte en el embarazo (a nivel del mar):

| Trimestre | Sin anemia | Leve | Moderada | Grave |
|---|---|---|---|---|
| 1.º | 11,0 o más | 10,0–10,9 | 7,0–9,9 | menos de 7,0 |
| 2.º | 10,5 o más | 9,5–10,4 | 7,0–9,4 | menos de 7,0 |
| 3.º | 11,0 o más | 10,0–10,9 | 7,0–9,9 | menos de 7,0 |

Ajustes oficiales de la OMS 2024 (tabla de la guía, en g/L; la app muestra el equivalente en g/dL):

| Altitud de residencia (m s. n. m.) | Ajuste OMS (g/L) | Equivalente (g/dL) |
|---|---|---|
| Menos de 500 | 0 | 0 |
| 500–999 | 4 | 0,4 |
| 1000–1499 | 8 | 0,8 |
| 1500–1999 | 11 | 1,1 |
| 2000–2499 | 14 | 1,4 |
| 2500–2999 | 18 | 1,8 |
| 3000–3499 | 21 | 2,1 |
| 3500–3999 | 25 | 2,5 |
| 4000–4499 | 29 | 2,9 |
| 4500–4999 | 33 | 3,3 |

La tabla de la OMS llega hasta 4999 m. Si se registra una altitud de 5000 m o más, la app no aplica ajuste automático y pide revisar el dato.

**Ajuste por tabaquismo.** La OMS 2024 también pide restar un ajuste a las fumadoras según los cigarrillos al día. Valores de la tabla oficial (Tabla 5 de la guía):

| Cigarrillos al día | Ajuste OMS (g/L) | Equivalente (g/dL) |
|---|---|---|
| Fumadora, cantidad desconocida | 3 | 0,3 |
| Menos de 10 | 3 | 0,3 |
| 10–19 | 5 | 0,5 |
| Más de 20 | 6 | 0,6 |

La tabla de la OMS no asigna un valor a exactamente 20 cigarrillos. La guía permite usar en lugar de las categorías su fórmula (ajuste en g/L = 0,4565 × cigarrillos − 0,0078 × cigarrillos²), que para 20 cigarrillos da 6 g/L; la app usa ese valor. Si la gestante fuma pero no sabe cuánto, se aplican 3 g/L.

Cómo lo calcula la app, siguiendo el método de la OMS:
1. Convierte la Hb medida a g/L.
2. **Resta** el ajuste por altitud.
3. Si es fumadora, **resta además** el ajuste por tabaquismo. Una fumadora que vive en altura recibe los dos ajustes.
4. Redondea la Hb final a un decimal en g/dL y la compara con los puntos de corte del trimestre, incluida la gravedad.

**Tipo de muestra.** La OMS prefiere sangre venosa. La app registra si la Hb fue venosa o capilar; si fue capilar, lo indica junto al resultado, porque la capilar suele dar valores más altos y no tiene factor de corrección.

Qué ve el profesional:
- La Hb medida, la Hb ajustada y de dónde sale cada ajuste. Ejemplo para una gestante no fumadora en Bogotá (2600 m) en el 2.º trimestre: "Hb medida 11,8 g/dL (venosa) · ajuste por altitud −1,8 · Hb ajustada 10,0 g/dL → **anemia leve** (punto de corte del 2.º trimestre: 10,5)". Sin el ajuste, esa misma Hb se habría leído como normal.
- Si la altitud no está registrada, la app clasifica con el punto de corte a nivel del mar y muestra "Falta la altitud de residencia: la anemia puede estar subdiagnosticada".
- La anemia grave (Hb ajustada menor de 7,0) se muestra como alerta urgente.
- La clasificación de anemia que usa la alerta de déficit de hierro (umbral de ferritina de 50 ng/mL) es esta misma, ya ajustada.

**Cómo funciona la alerta de déficit de hierro (guía ASH 2026)**

La guía de la Sociedad Americana de Hematología sobre diagnóstico de déficit de hierro (septiembre de 2026) no cambia la definición de anemia por hemoglobina: cambia el umbral de **ferritina** para diagnosticar déficit de hierro. La anemia se define por la Hb ajustada (OMS 2024) y **la ferritina se solicita solo cuando hay anemia**, para confirmar si se debe a déficit de hierro.

Reglas:
- **Ferritina de 50 ng/mL o menos en gestante con anemia:** se considera anemia con déficit de hierro (umbral que la guía permite para el embarazo con anemia).
- **Si llega una ferritina sin anemia** (por ejemplo, pedida en otra institución), la app aplica el umbral general de 30 ng/mL o menos y lo muestra como dato, sin pedir nuevas ferritinas.
- **Nunca usar 15 ng/mL** como umbral: la guía lo desaconseja de forma explícita en el embarazo.
- **Si hay inflamación o infección registrada:** la ferritina puede salir falsamente normal. La alerta sugiere interpretarla junto con la saturación de transferrina.

Comportamiento:
1. Cuando la alerta de anemia se activa y no hay ferritina registrada en este embarazo, la alerta incluye "Solicitar ferritina sérica" y queda como examen pendiente.
2. Al registrar la ferritina, la app la cruza con la última Hb ajustada y la edad gestacional.
3. Muestra la alerta con la causa, por ejemplo: "Anemia con déficit de hierro (Hb ajustada 10,2 g/dL · ferritina 42 ng/mL)".
4. Si la ferritina es mayor de 50 ng/mL con anemia, la app lo indica como "Anemia sin déficit de hierro por ferritina: considerar otras causas" sin sugerir conducta.
5. El profesional marca la conducta (ajuste de hierro, remisión, otro) con motivo. La app no sugiere dosis de tratamiento porque la guía ASH no cubre tratamiento.

**Cómo funciona la alerta de carbonato de calcio**

A diferencia del ASA, el calcio no depende de factores de riesgo: la GPC colombiana de embarazo recomienda **carbonato de calcio 1200 mg al día** (1200 mg de la sal de carbonato, no de calcio elemental) desde la semana 14 y durante el resto de la gestación a **todas** las gestantes, para disminuir el riesgo de preeclampsia.

Comportamiento:
1. **Antes de la semana 14:** no hay alerta. En el resumen aparece "Calcio: iniciar en la semana 14 ([fecha calculada])".
2. **Desde la semana 14**, si el profesional no ha marcado una decisión, aparece:

   > **Iniciar carbonato de calcio**
   > Semana 14+3 · Recomendado para todas las gestantes desde la semana 14 (prevención de preeclampsia).
   > Dosis: carbonato de calcio 1200 mg al día (2 tabletas de 600 mg), desde ahora hasta el parto.
   > Tomar al menos 1 hora separado del hierro, 2 horas antes o después de las comidas principales y no con leche (GPC).
   > Si tiene ASA indicado, el calcio se da además del ASA, no en su lugar.
   > [Indicado] [No indicado — motivo] [Ya lo toma]

3. Si la primera consulta ocurre después de la semana 14, la alerta aparece en esa misma consulta.
4. **Contraindicación registrada:** hipercalcemia, hipercalciuria, hiperparatiroidismo, nefrolitiasis o nefrocalcinosis, enfermedad renal crónica grave o hipersensibilidad. La alerta cambia a "Calcio recomendado, pero con contraindicación registrada: valorar antes de indicar" y no sugiere dosis.
5. **Precaución registrada:** la alerta se muestra con la dosis y agrega la nota que corresponde:
   - **Sarcoidosis:** usar con cautela por mayor activación de la vitamina D; vigilar calcio sérico.
   - **Diuréticos tiazídicos:** reducen la excreción urinaria de calcio; vigilar calcio sérico por riesgo de hipercalcemia.
   - **Digoxina:** vigilar calcio sérico.
   - **Levotiroxina:** tomarla separada del calcio por varias horas, porque el calcio reduce su absorción.
   - **Antiácidos con calcio de uso frecuente o vómito persistente:** riesgo de hipercalcemia por exceso de calcio con álcalis; sumar el calcio de los antiácidos y vigilar.
6. Si durante el seguimiento se registra uno de estos antecedentes o medicamentos, la app recalcula: una contraindicación nueva cambia la alerta aunque el calcio ya esté indicado, y avisa al profesional.
7. El profesional marca **"Indicado"**, **"No indicado"** (con motivo) o **"Ya lo toma"**. La alerta queda atendida y la decisión se guarda en la historia.
8. Con calcio indicado, en cada control la app pregunta si lo está tomando todos los días.

**Cómo funciona la alerta de tromboprofilaxis**

La alerta sigue la guía RCOG 37a con las modificaciones de la declaración de posición de la RCOG, vigente mientras se publica la guía actualizada. La app suma un puntaje de riesgo trombótico con los datos de la HCP (edad, IMC, paridad, tabaquismo, gemelar, preeclampsia) y las preguntas nuevas de la sección 2.

Factores y puntos que aplican en el embarazo:

- **4 puntos:** trombosis previa (salvo un único evento asociado a cirugía mayor); IMC de 50 o más; cirugía en el embarazo; síndrome de hiperestimulación ovárica; infección sistémica que requiere antibióticos intravenosos u hospitalización; inmovilidad o deshidratación.
- **3 puntos:** trombosis previa provocada por cirugía mayor; trombofilia de alto riesgo conocida; comorbilidad de alto riesgo; hiperémesis.
- **2 puntos:** IMC de 40 a 49.
- **1 punto:** antecedente familiar de trombosis sin causa o asociada a estrógenos en familiar de primer grado; trombofilia de bajo riesgo sin trombosis; edad mayor de 35; IMC de 30 a 39; paridad de 3 o más; tabaquismo; várices gruesas; preeclampsia en este embarazo; fertilización in vitro o reproducción asistida; embarazo múltiple.

El IMC que se usa es el de la primera consulta.

Qué muestra la app según el resultado:
- **4 o más puntos:** "Considerar tromboprofilaxis desde ahora (primer trimestre)".
- **3 puntos:** "Considerar tromboprofilaxis desde la semana 28". Queda programada como recordatorio para esa semana.
- **Menos de 3 puntos:** sin alerta. El puntaje queda visible en el resumen.

Casos especiales que generan alerta aunque el puntaje no la dé, o que fijan la duración:
- **IMC de 50 o más:** "Ofrecer tromboprofilaxis durante todo el embarazo y 6 semanas posparto".
- **Hiperémesis** (no puede beber sin vomitar o le cuesta ponerse de pie y caminar por los síntomas): "Ofrecer tromboprofilaxis e iniciarla en las primeras 72 horas".
- **Hospitalización por hiperémesis o por otro factor transitorio con inmovilidad:** "Tromboprofilaxis mientras dure el factor y una semana más después de que se resuelva".
- **Cualquier otra hospitalización antenatal:** "Considerar tromboprofilaxis".
- **Factores transitorios** (cirugía, hiperestimulación ovárica, infección sistémica, inmovilidad o deshidratación): la tromboprofilaxis se mantiene mientras persista el factor y 7 días más. Cuando el profesional marca el factor como resuelto, la app calcula la fecha de suspensión y vuelve a calcular el puntaje sin ese factor.
- **Trombofilia de alto riesgo, o trombosis previa** (en especial con déficit de antitrombina o síndrome antifosfolípido): además del puntaje, sugerir remisión al equipo o especialista en trombosis en el embarazo, como indica la RCOG.

Comportamiento común:
1. La alerta muestra el puntaje y la lista de factores que lo componen, para que el profesional vea por qué.
2. Si la paciente tiene **factores de riesgo de sangrado**, la alerta cambia a "Criterio de tromboprofilaxis presente, con riesgo de sangrado registrado: discutir el balance de riesgos con un hematólogo con experiencia en trombosis y sangrado en el embarazo" y no sugiere dosis.
3. Si corresponde iniciar, la alerta muestra la **dosis profiláctica según el peso** de la primera consulta, con la tabla de la RCOG:

| Peso | Enoxaparina | Dalteparina | Tinzaparina |
|---|---|---|---|
| Menos de 100 kg | 40 mg al día | 5000 UI al día | 4500 UI al día |
| 100–129 kg | 60 mg al día* | 7500 UI al día | 7000 UI al día* |
| 130–169 kg | 80 mg al día* | 10 000 UI al día | 9000 UI al día* |
| 170 kg o más | 0,6 mg/kg al día* | 75 UI/kg al día | 75 UI/kg al día* |

\* Se puede dar en dos dosis divididas.

La app muestra las tres heparinas de la tabla de la RCOG.

4. El profesional marca **"Tromboprofilaxis indicada"** (con fecha de inicio), **"No indicada"** (con motivo), **"Referida a especialista"** o **"Ya la recibe"**. La decisión se guarda en la historia.
5. **Recálculo:** la app recalcula el puntaje cada vez que se registra un dato que lo afecta: preeclampsia, hospitalización, cirugía, hiperémesis, infección, inmovilidad, o la resolución de un factor transitorio. Si el resultado sube de nivel, avisa aunque la alerta anterior ya estuviera atendida.
6. **Semana 28:** la app pide reevaluar el riesgo aunque no haya alerta previa.

**Nota para validar antes de construir**

Para anemia y déficit de hierro:
- **Hemoglobina (decidido):** puntos de corte por trimestre de la OMS 2024 con los ajustes de la OMS por altitud de residencia y por tabaquismo. La app no usa el umbral de 10 g/dL de la GPC colombiana 2013.
- **Ajuste por altitud (decidido):** tabla oficial de la OMS 2024 en g/L.
- **Altitud (decidido):** la fuente oficial es la OMS 2024 para el ajuste. Como la OMS no publica la altitud de cada lugar, el profesional registra la altitud de residencia en metros; la app no la sugiere automáticamente.
- **Ajuste por tabaquismo (decidido):** Tabla 5 de la guía OMS 2024 (3 / 3 / 5 / 6 g/L), con la fórmula de la guía para 20 cigarrillos.
- **Cautela del ajuste en altura:** hay estudios en poblaciones andinas que sugieren que el ajuste puede sobrediagnosticar anemia por encima de los 3000 m. La Hb ajustada se interpreta junto con el hemograma, la ferritina y la clínica.
- **Trimestres (propuesto, a confirmar por el equipo clínico):** 1.º hasta la semana 13+6, 2.º de la 14+0 a la 27+6, 3.º desde la 28+0. La guía OMS 2024 da puntos de corte por trimestre sin fijar las semanas de cada uno.
- **Ferritina (decidido):** se solicita solo en gestantes con anemia; umbral de 50 ng/mL o menos (ASH 2026).

Los demás valores de corte se toman del manual CLAP 2007. El equipo clínico los revisa contra la Ruta Materno Perinatal vigente. La glucemia en ayunas del CLAP se reemplazó por la PTOG de la GPC (decidido).

Para el ASA:
- **Norma (decidido):** GPC colombiana 2013. Dosis de 75 a 100 mg al día, inicio en la semana 12, hasta el día del parto, con sus factores de alto y moderado riesgo (edad de 40 o más, IMC de 35 o más, embarazo múltiple como factor moderado).

Para el calcio:
- **Calcio (decidido):** carbonato de calcio 1200 mg al día desde la semana 14 y durante el resto de la gestación (hasta el parto) para todas, según la GPC colombiana. **Toma (decidido, GPC):** al menos 1 hora de separación entre hierro y calcio, 2 horas antes o después de las comidas principales y no con leche. **Presentación (decidido):** tabletas de 600 mg de carbonato de calcio, 2 tabletas al día. **Contraindicaciones y precauciones (decidido):** las de la alerta de calcio en la sección 4, tomadas de las fichas técnicas de productos con carbonato de calcio. Como dato de contexto, 1200 mg de carbonato equivalen a unos 480 mg de calcio elemental, por debajo de los límites diarios que fijan las fichas para el embarazo.

Para la tromboprofilaxis, el equipo clínico también fija la norma antes de construir:
- **Guía de base (decidido):** RCOG 37a con las modificaciones de la declaración de posición de la RCOG. La RCOG está actualizando la guía completa; cuando se publique, el puntaje, los casos especiales y la tabla de dosis se revisan contra la versión nueva.
- **Medicamentos (decidido, RCOG):** enoxaparina, dalteparina y tinzaparina con la tabla de dosis por peso de la RCOG.
- **Trombofilias (decidido, RCOG):** alto y bajo riesgo según la clasificación de la sección 2.
- **Riesgo de sangrado (decidido, RCOG):** los factores de la sección 2, incluida la trombocitopenia con plaquetas menores de 75 × 10⁹/L. Si el hemograma registra plaquetas por debajo de ese valor, la app la marca sola como factor de sangrado.
- **Referencia (decidido, RCOG):** trombosis previa o trombofilia de alto riesgo → equipo o especialista en trombosis en el embarazo; riesgo de sangrado → hematólogo con experiencia en trombosis y sangrado en el embarazo.

Para derechos sexuales y reproductivos e IVE:
- **Contenido legal (decidido):** por ahora la app informa sobre las sentencias y normas vigentes en Colombia: Sentencia C-355 de 2006 (tres causales), Sentencia SU-096 de 2018, Sentencia C-055 de 2022 (IVE hasta la semana 24) y Resolución 051 de 2023 (regulación única de la atención). Los textos citan la norma y muestran la fecha de la última verificación; se actualizan si cambia la jurisprudencia o la regulación.
- **Ruta de la institución:** prestador de referencia para IVE, ruta de violencia sexual y a quién se notifica en cada caso.
- **Textos de asesoría y de "Tus derechos":** se validan con el equipo clínico y, si es posible, con gestantes de la población objetivo.

### 5. Recordatorios por semana
La app muestra en el resumen qué exámenes y acciones tocan según la edad gestacional y cuáles ya se hicieron:
- **Primera consulta:** Hb, VDRL/RPR, VIH, grupo y Rh, bacteriuria, y las pruebas que exija la norma del país (toxoplasmosis, Chagas, malaria). También la antitetánica, hierro y ácido fólico.
- **Después de la semana 20:** segunda Hb, VIH y VDRL/RPR del tercer trimestre.
- **Semana 14:** iniciar carbonato de calcio. Si queda sin decisión, aparece como pendiente en cada consulta.
- **En cada control, si tiene calcio indicado:** preguntar si lo está tomando todos los días.
- **Primera consulta:** evaluar los factores de riesgo de preeclampsia.
- **Semana 12:** decidir sobre ASA si cumple criterio. Si queda sin decisión, aparece como pendiente en cada consulta.
- **Semanas 24 a 28:** PTOG de 75 g.
- **En cada control, si tiene ASA indicado:** preguntar si lo está tomando todos los días.
- **Primera consulta:** calcular el puntaje de riesgo trombótico.
- **Semana 28:** reevaluar el riesgo trombótico y, si tenía puntaje de 3, recordar el inicio de la tromboprofilaxis.
- **Si hay un factor transitorio activo:** preguntar en cada control si ya se resolvió, para calcular la fecha de suspensión (7 días después).
- **En cada control, si tiene tromboprofilaxis indicada:** preguntar si se la está aplicando todos los días.
- **Semanas 35 a 37:** estreptococo B.
- **En cada trimestre:** preguntar por tabaco, alcohol y violencia.
- **Durante el control:** examen odontológico y de mamas, preparación para el parto, consejería en lactancia.

Un examen pendiente que ya pasó su ventana aparece como "atrasado".

### 6. Cierre de consulta y carné de la gestante
1. Al terminar, el profesional pulsa **"Cerrar consulta"**. La app le muestra cómo verá la gestante su carné.
2. **En la primera consulta**, la gestante elige un PIN de 4 dígitos y el profesional lo ingresa con ella. La app confirma el número de WhatsApp.
3. El profesional pulsa **"Enviar por WhatsApp"**. La gestante recibe un mensaje corto con su nombre y el enlace al carné.
4. Si la gestante **no tiene WhatsApp**, el profesional pulsa **"Imprimir carné"** y le entrega una hoja con el mismo contenido.

**Qué ve la gestante al abrir el enlace:**
1. Le pide su PIN de 4 dígitos.
2. Ve su carné, en lenguaje cotidiano, frases cortas e iconos:
   - **En cuántas semanas va** y la fecha probable de parto.
   - **Su próxima cita**: fecha, lugar y qué llevar.
   - **Lo que debe hacer**, con el porqué en una frase. Ejemplo: *"Tómate la pastilla de hierro todos los días. Tu sangre tiene poco hierro y eso te puede cansar a ti y afectar el crecimiento de tu bebé. Tómala 2 horas antes o 2 horas después de las comidas principales, no con leche, y al menos 1 hora separada del calcio."*
     Si tiene ASA indicado: *"Tómate la aspirina todos los días hasta el día del parto. Ayuda a prevenir la presión alta del embarazo, que puede ser peligrosa para ti y tu bebé. No la suspendas sin preguntar."*
     Si tiene calcio indicado: *"Tómate 2 tabletas de calcio todos los días hasta el parto. Ayuda a prevenir la presión alta del embarazo y a formar los huesos de tu bebé. No lo tomes al mismo tiempo que el hierro: deja al menos 1 hora entre uno y otro. Tómalo 2 horas antes o 2 horas después del desayuno, el almuerzo o la comida, y no con leche."*
     Si tiene tromboprofilaxis indicada: *"Aplícate la inyección para prevenir coágulos todos los días a la misma hora. El embarazo aumenta el riesgo de coágulos en las venas y tú tienes factores que lo suben más. Si empiezas trabajo de parto, sangras o te van a operar, no te la apliques y avisa en el hospital que la estás usando."* Las instrucciones exactas sobre cuándo suspenderla antes del parto las define el equipo clínico.
   - **Señales de coágulo** (si tiene tromboprofilaxis indicada o puntaje de 3 o más): pierna hinchada, roja o dolorosa de un solo lado; falta de aire de repente; dolor en el pecho. Ir de urgencia.
   - **Exámenes pendientes**, explicados en simple. Ejemplo para la PTOG: *"Entre las semanas 24 y 28 te harán la prueba del azúcar. Ve en ayunas: te toman sangre, te dan una bebida dulce y te vuelven a tomar sangre a la hora y a las 2 horas."*
   - **Cuándo ir de urgencia**: signos de alarma de la gestación (sangrado, salida de líquido, dolor de cabeza fuerte, visión borrosa, hinchazón de cara o manos, fiebre, el bebé no se mueve, contracciones antes de tiempo).
   - Sus datos básicos: grupo y Rh, vacunas y el historial de sus citas (fecha, peso, presión).
3. Cada vez que el profesional cierra una nueva consulta, el mismo enlace muestra el carné actualizado. Ella no recibe un enlace nuevo cada vez, salvo que se lo reenvíen.

**Qué NUNCA aparece en el carné**, ni digital ni impreso:
- Resultado ni código de VIH.
- Respuestas sobre violencia.
- Consumo de drogas o alcohol.
- Notas internas del profesional.
- Deseo de continuar o no el embarazo, solicitud de IVE, causales o activación de la ruta de violencia sexual (sección 7).

Estos datos solo los ve el profesional. El carné puede abrirse en un celular compartido o caer en manos de la pareja.

### 7. Derechos sexuales y reproductivos e IVE

**Marco que sigue la app (Colombia)**
- **Sentencia C-055 de 2022 de la Corte Constitucional:** la IVE no es delito hasta la semana 24 de gestación, por la sola voluntad de la mujer o persona gestante, sin que tenga que dar razones. Después de la semana 24 sigue siendo legal bajo las tres causales de la Sentencia C-355 de 2006: riesgo para la vida o la salud (física o mental) de la gestante; malformación fetal incompatible con la vida extrauterina, certificada por un médico; embarazo producto de violencia sexual, incesto, o inseminación o transferencia de óvulo no consentidas, con denuncia.
- **Resolución 051 de 2023 del Ministerio de Salud:** regulación única de la atención integral de la IVE, que modifica la Ruta Materno Perinatal (Resolución 3280 de 2018). Puntos que la app refleja:
  - La IVE es parte de los derechos sexuales y reproductivos y su atención es **urgente**. No se puede dilatar; solo en casos excepcionales y justificados puede haber un plazo máximo de 5 días calendario, y se registra en la historia.
  - Después de la semana 24, una vez el profesional identifica una causal, **solo la gestante decide** qué riesgo asume para continuar o no, y su voluntad se registra en la historia clínica.
  - Las niñas y adolescentes también pueden acceder a la IVE.
- **Objeción de conciencia:** es individual del profesional que realiza el procedimiento, no de la institución. Quien objeta tiene que remitir de inmediato a un profesional que no objete.

**Cuándo se activa el flujo**
- Embarazo no planeado y la gestante responde que **no desea continuar** o **no ha decidido**.
- Violencia sexual en el embarazo actual.
- Gestante **menor de 14 años**.
- Diagnóstico de una malformación fetal grave o de una condición que pone en riesgo la vida o la salud de la gestante.
- La gestante pregunta por la IVE en cualquier momento.

**Qué ve y hace el profesional**
1. La app abre una pantalla privada **"Opciones y derechos"** con la edad gestacional de hoy y el marco que aplica:
   - **Hasta la semana 24:** "La IVE es un derecho por la sola voluntad de la gestante. No requiere causal."
   - **Después de la semana 24:** "La IVE es legal si se configura una causal" y la lista de las tres causales, para que el profesional marque cuál identifica.
2. Muestra una guía de asesoría en lenguaje neutro y sin juicios para informar todas las opciones: continuar el embarazo, entregar en adopción o interrumpirlo, y que cualquiera de ellas es decisión de ella.
3. El profesional registra la decisión de la gestante: **continúa el embarazo**, **solicita IVE**, **lo pensará** (con fecha de nueva cita cercana, sin dilatar) o **no desea hablar del tema ahora**.
4. **Si solicita IVE:** la app indica que la atención es urgente, muestra el prestador de referencia que la institución tenga configurado para IVE y registra la fecha y hora de la solicitud y de la remisión. Si el profesional es objetor, la app le recuerda que debe remitir de inmediato.
5. **Si continúa el embarazo:** el control prenatal sigue normal y la pantalla se cierra.

**Gestante menor de 14 años**
- La app muestra: "Embarazo en menor de 14 años: se presume violencia sexual. Activar la ruta de atención integral a víctimas de violencia sexual, que es una urgencia médica, y hacer las notificaciones que exige la norma."
- Informa que la causal de violencia sexual permite la IVE **sin límite de edad gestacional**.
- Registra la activación de la ruta y las notificaciones con fecha y hora.

**Violencia sexual en cualquier edad**
- Mismo aviso de activación de la ruta de violencia sexual.
- Informa que la causal de violencia sexual aplica también después de la semana 24.

**Qué se registra y quién lo ve**
- Todo lo de esta sección es información **privada**, con el mismo nivel de protección que el VIH: solo la ve el profesional autorizado.
- **Nunca** aparece en el carné, no se envía por WhatsApp ni se imprime.
- Si la gestante solicita IVE, la app **pausa el envío del carné**: no le llegan mensajes ni actualizaciones que alguien más pueda ver. El enlace muestra solo "Comunícate con tu servicio de salud".

**Derechos en el carné de la gestante (para todas)**
El carné incluye una sección corta "**Tus derechos**", segura aunque la vea otra persona:
- Recibir atención con respeto, sin discriminación y con información clara sobre tu salud y la de tu bebé.
- Que tu información sea confidencial.
- Recibir información sobre todas tus opciones y decidir sobre tu cuerpo. Puedes preguntar en privado a tu profesional de salud.
- Estar acompañada por la persona que tú elijas durante el trabajo de parto y el parto.
- Recibir asesoría sobre métodos anticonceptivos después del parto.
- Recibir atención urgente si sufres violencia, incluida la violencia sexual.

## Errores y seguridad

**Sin internet en la consulta**
- La consulta se guarda normalmente en el dispositivo.
- Un aviso indica "pendiente de enviar". El profesional puede imprimir el carné de inmediato.
- Cuando vuelve la señal, la información se sincroniza y el WhatsApp se envía solo. El profesional ve la confirmación.

**Datos que faltan o no cuadran**
- **Sin FUM:** la EG se toma de la ecografía. Si no hay ninguna de las dos, la app no calcula FPP, marca "EG no confiable" y recuerda solicitar ecografía.
- **Valores imposibles** (presión 300/20, peso 400 kg, FUM futura, más partos que gestas): la app pide confirmar antes de guardar.
- **Campo vacío:** se distingue entre "no se hizo" y "no corresponde", como en la HCP. Al cerrar, la app lista lo que quedó vacío para que el profesional decida si lo completa.
- **Gestante duplicada** (mismo documento): la app muestra el registro existente en vez de crear otro.
- **Cambio de residencia:** si la gestante se muda a otro municipio, el profesional actualiza la altitud y la app reclasifica la anemia desde ese control, sin cambiar las clasificaciones anteriores.

**Carné y PIN**
- **PIN equivocado:** después de 5 intentos el carné se bloquea un rato y le indica que pida ayuda en su próxima consulta.
- **Olvidó el PIN:** el profesional le asigna uno nuevo en la consulta.
- **Cambió de número:** el profesional actualiza el número y reenvía el enlace. El enlace anterior deja de funcionar.
- **Enlace reenviado a otra persona:** sin el PIN no ve nada.
- **Perdió el carné impreso:** se reimprime en cualquier consulta.

**Derechos sexuales y reproductivos e IVE**
- **Edad gestacional dudosa cerca de la semana 24:** si la EG no es confiable, la app no muestra "después de la semana 24" de forma automática; indica que se confirme la EG (por ejemplo, con ecografía) sin dilatar la atención.
- **Solicitud sin prestador configurado:** la app avisa que la institución debe tener definida su ruta de remisión para IVE y permite registrar la remisión de forma manual.
- **La gestante cambia de decisión:** se registra la nueva decisión con fecha. Si vuelve a control prenatal, el carné se reactiva.
- **Acompañante presente en la consulta:** la guía recuerda al profesional ofrecer un momento a solas antes de preguntar por la decisión o por violencia.
- **Lenguaje:** los textos de la app sobre IVE usan lenguaje neutro, sin términos estigmatizantes ni juicios de valor.

**Privacidad**
- Solo el personal autorizado del lugar de control prenatal ve y edita la historia.
- Cada cambio queda registrado con quién y cuándo, porque la HCP es un documento con valor legal.
- La gestante solo ve su propio carné y no puede editar nada.

## Éxito
- **El carné se usa:** al menos 6 de cada 10 gestantes con WhatsApp abren su carné entre una consulta y la siguiente.
- **Llegan preparadas:** aumenta la proporción de gestantes que llegan a la siguiente cita con los exámenes indicados, comparado con el carné de papel.
- **El profesional no pierde tiempo:** registrar una consulta de seguimiento no toma más que hacerlo en papel.
- **No se escapan alertas:** en una revisión de historias, ninguna condición amarilla del CLAP quedó sin alerta.
- **ASA a tiempo:** toda gestante que cumple el criterio de preeclampsia tiene una decisión de ASA registrada (indicado, no indicado con motivo, o ya lo toma) en la primera consulta desde la semana 12.
- **PTOG a tiempo:** toda gestante tiene la PTOG registrada entre las semanas 24 y 28.
- **Asesoría de opciones a tiempo:** toda gestante con embarazo no planeado que no desea continuarlo o no ha decidido tiene registrada la asesoría y su decisión en la misma consulta, y las solicitudes de IVE tienen remisión registrada el mismo día.
- **Ruta activada:** toda gestante menor de 14 años o con violencia sexual tiene registrada la activación de la ruta de atención.
- **Riesgo trombótico evaluado:** toda gestante tiene un puntaje de riesgo trombótico calculado en la primera consulta y reevaluado en la semana 28. Las que cumplen criterio tienen una decisión registrada.
- **La gestante entiende:** en preguntas cortas después de la consulta, la gestante sabe decir cuándo es su próxima cita y al menos dos signos de alarma.

## V2
- Recordatorios por WhatsApp antes de la cita y de exámenes pendientes.
- Gráficas de altura uterina y ganancia de peso contra los percentiles P10/P90 del CLAP, para el profesional y en versión simple en el carné.
- Tamizaje de violencia guiado con las 5 preguntas del CLAP, cambiando "en el último año" por "desde su última visita".
- QR en el carné para que la sala de partos de otra institución lea el resumen al ingreso.
- Exportar la HCP en el formato CLAP para referencias.
- Que la gestante precargue sus antecedentes antes de la primera consulta, solo si la v1 muestra que usa el carné sin dificultad.
- Mensajes de audio en el carné para gestantes con baja alfabetización.
- Secciones de parto, recién nacido, puerperio, egresos y anticoncepción; partograma.
- Evaluación del riesgo trombótico al ingreso hospitalario y en el posparto (puntaje posparto, duración de 10 días o 6 semanas), cuando existan las secciones de parto y puerperio.
- Reportes e indicadores para la institución.
