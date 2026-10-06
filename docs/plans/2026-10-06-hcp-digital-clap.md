# Plan de implementación: HCP Digital (CLAP) — Control prenatal v1
Fecha: 6 de octubre de 2026

## 1. Objetivo
Construir la v1 de la HCP digital para control prenatal. El profesional registra la primera consulta y los controles de seguimiento, sin conexión si hace falta, y la app calcula, alerta y recuerda según el CLAP y las guías incorporadas. Al cerrar cada consulta, la gestante recibe por WhatsApp (o impreso) un carné simple protegido con PIN.

## 2. Contexto del problema
En control prenatal, la HCP se llena en papel. El profesional calcula a mano la edad gestacional y depende de su memoria para saber qué examen toca y cuándo un dato es una alerta. La gestante recibe un carné de papel que se pierde o no entiende, y muchas veces no sabe cuándo vuelve, qué exámenes llevar ni qué señales la deben llevar a urgencias. Varios contextos de uso son rurales, con conexión intermitente y gestantes con baja alfabetización. Además, parte de la información es muy sensible (VIH, violencia, decisión sobre el embarazo) y no puede quedar expuesta en un celular compartido.

## 3. Spec de referencia
`docs/specs/2026-10-06-hcp-digital-clap.md`. Acompañado de `docs/roadmap.md`.

## 4. Lista de tareas a implementar con detalles

Las tareas están en orden de dependencia. Donde dos tareas no dependen entre sí, se indica que pueden avanzar en paralelo.

### Bloque A — Base

**A1. Catálogo de parámetros clínicos configurables**
- **Qué hacer:** crear un catálogo único donde vivan todos los valores clínicos que usan las reglas, sin quemarlos en el código. Cada parámetro guarda: valor, unidad, fuente (CLAP 2007, OMS 2024, ASH 2026, RCOG 37a con declaración de posición, GPC Colombia 2013, C-055 de 2022, Resolución 051 de 2023), estado ("decidido" o "pendiente de validar") y fecha de revisión. Cargar los valores ya decididos en el spec: puntos de corte de Hb por trimestre y gravedad, límites de semanas de cada trimestre, tabla de altitud OMS en g/L, umbral de ferritina en anemia, tabla de ajuste por tabaquismo, puntaje y casos especiales RCOG, tabla de dosis de HBPM, factores, dosis y período del ASA según la GPC, valores de la PTOG según la GPC, carbonato de calcio 1200 mg en tabletas de 600 mg, clasificación de trombofilias, factores de sangrado y criterios de referencia de la RCOG, y la lista de sentencias y normas vigentes con su fecha de verificación. Dejar marcados como pendientes los que el spec deja abiertos (ver "Decisiones pendientes" al final).
- **Componentes:** capa de configuración clínica; pantalla de solo lectura para el equipo clínico.
- **Hecho cuando:** cada regla de las tareas C y D lee sus valores del catálogo; cambiar un valor en el catálogo cambia el resultado de la regla sin tocar código; la app muestra un aviso interno si una regla usa un parámetro "pendiente de validar".

**A2. Modelo de datos**
- **Qué hacer:** definir las entidades: gestante, embarazo (episodio; una gestante puede tener varios), consulta (primera o de seguimiento), resultado de examen (con tipo de muestra venosa/capilar para Hb), indicación (hierro, ácido fólico, calcio, ASA, tromboprofilaxis), alerta y su decisión (con motivo y fecha), factor transitorio (inicio y resolución), registro de derechos sexuales y reproductivos, carné (enlace, PIN, estado activo/pausado) y bitácora de cambios. Incluir todos los campos de la HCP más los nuevos del spec: municipio y altitud, cigarrillos al día, enfermedad autoinmune, FIV, alergia al ASA/AINE, antecedentes trombóticos, factores de sangrado, antecedentes y medicamentos que contraindican o condicionan el calcio, ferritina y saturación de transferrina, deseo de continuar el embarazo. Cada campo admite tres estados además del valor: "no se hizo", "no corresponde" y vacío.
- **Componentes:** capa de datos.
- **Hecho cuando:** se puede guardar y recuperar una historia completa de prueba con todos los campos de la sección 2 y 3 del spec, incluidos los tres estados; un embarazo nuevo no sobrescribe uno anterior.

**A3. Niveles de privacidad, roles y bitácora**
- **Qué hacer:** marcar cada campo con un nivel: "normal", "privado" (solo el profesional autorizado) o "nunca en carné". Son privados y nunca van al carné: VIH (resultado y código), respuestas sobre violencia, drogas y alcohol, notas internas y todo el registro de la sección 7 (deseo de continuar, IVE, causales, ruta de violencia sexual). Crear roles de profesional autorizado por institución. Registrar en la bitácora quién cambió qué y cuándo.
- **Componentes:** capa de permisos; bitácora.
- **Hecho cuando:** un usuario sin rol autorizado no puede ver la historia; cada edición queda en la bitácora con usuario y hora; ninguna consulta del carné puede leer un campo "nunca en carné" (verificado con prueba automática).

**A4. Funcionamiento sin conexión y sincronización**
- **Qué hacer:** que la consulta completa (búsqueda de gestantes ya descargadas, registro, cálculos, alertas, cierre e impresión) funcione sin internet. Las acciones que requieren red (sincronizar, enviar WhatsApp) quedan en cola con estado "pendiente de enviar" y se ejecutan solas al volver la señal. Definir cómo se resuelven conflictos si dos dispositivos editan la misma historia.
- **Componentes:** almacenamiento local en el dispositivo; cola de sincronización.
- **Hecho cuando:** con el dispositivo en modo avión se puede hacer y cerrar una consulta completa e imprimir el carné; al reconectar, los datos aparecen en el servidor y el WhatsApp se envía, y el profesional ve la confirmación.

### Bloque B — Consultas

**B1. Búsqueda e inicio de consulta**
- **Qué hacer:** buscar por documento o nombre. Si existe, abrir el resumen del embarazo actual; si no, crear la gestante e iniciar la primera consulta. Si el documento ya existe, mostrar el registro existente en vez de duplicar. Si tuvo un embarazo anterior, abrir uno nuevo y conservar el anterior.
- **Componentes:** pantalla de búsqueda; pantalla de inicio de consulta.
- **Hecho cuando:** buscar un documento existente nunca crea un duplicado; una gestante con embarazo previo queda con dos episodios separados.

**B2. Formulario de primera consulta**
- **Qué hacer:** formulario en bloques cortos y en el orden de la HCP: identificación (incluye municipio y altitud de residencia registrada por el profesional), antecedentes familiares y personales, obstétricos, embarazo planeado y método, riesgo de preeclampsia, riesgo trombótico, antecedentes y medicamentos para el calcio, gestación actual (con cigarrillos al día o "no sabe" si fuma). Si el embarazo es no planeado, pedir el deseo de continuar. Validar valores imposibles (PA 300/20, peso 400 kg, FUM futura, más partos que gestas) pidiendo confirmación. Al cerrar, listar los campos vacíos.
- **Componentes:** formulario de primera consulta; validaciones.
- **Hecho cuando:** se puede registrar la primera consulta completa de los casos de prueba; los valores imposibles piden confirmación; se distinguen "no se hizo" y "no corresponde".
- Depende de A2.

**B3. Motor de cálculos**
- **Qué hacer:** calcular edad, FPP por FUM (280 días), edad gestacional del día (semanas y días), IMC pregestacional con su clasificación e intervalo intergenésico. Sin FUM, tomar la EG de la ecografía; sin ninguna, no calcular FPP, marcar "EG no confiable" y recordar la ecografía. 
- **Componentes:** módulo de cálculos.
- **Hecho cuando:** los cálculos coinciden con casos verificados a mano (incluido un año bisiesto y una FUM de diciembre); sin FUM ni eco aparece "EG no confiable".
- Puede avanzar en paralelo con B2.

**B4. Formulario de consulta de seguimiento**
- **Qué hacer:** registrar fecha, peso, PA, altura uterina, presentación, FCF, movimientos fetales, proteinuria, observaciones, iniciales y próxima cita, con la EG del día automática. Marcar "no corresponde" según la semana (por ejemplo, presentación antes de la 28). Registrar exámenes (Hb con tipo de muestra, plaquetas, ferritina cuando hay anemia, transferrina, VDRL/RPR, FTA y tratamiento, VIH, toxoplasmosis, Chagas, malaria, bacteriuria, PTOG de 75 g con sus tres valores, EGB), indicaciones (hierro, ácido fólico, calcio, preparación para el parto, lactancia), eventos que cambian el riesgo trombótico y la resolución de factores transitorios. Permitir actualizar el municipio y la altitud si se mudó.
- **Componentes:** formulario de seguimiento.
- **Hecho cuando:** un control registrado en semana 20 marca "no corresponde" la presentación; registrar o resolver un factor transitorio dispara el recálculo de la tarea D5.
- Depende de A2 y B3.

### Bloque C — Motor de alertas

**C1. Motor genérico de alertas y decisiones**
- **Qué hacer:** evaluar todas las reglas cada vez que se guarda un dato. Una alerta queda activa en el resumen hasta que el profesional la marca atendida, con una decisión de la lista que corresponda (por ejemplo, "Indicado", "No indicado — motivo", "Ya lo toma", "Referida a especialista"). Si un dato nuevo empeora el resultado de una regla ya atendida, avisar de nuevo. Ninguna alerta impide guardar. Cada alerta muestra por qué se disparó.
- **Componentes:** motor de reglas; componente de alerta en la interfaz.
- **Hecho cuando:** una alerta atendida no reaparece si nada cambia, pero reaparece si el puntaje sube de nivel; ninguna alerta bloquea el guardado.
- Depende de A1 y A2.

**C2. Reglas básicas del CLAP**
- **Qué hacer:** implementar las alertas de la tabla del spec que no tienen lógica propia: edad de riesgo, menor de 14 años (enlaza con E1), abortos a repetición, intervalo corto, peso del RN previo, embarazo no planeado (enlaza con E1), sífilis, infecciones, Rh negativo, hábitos, violencia (enlaza con E1) y antirrubéola.
- **Componentes:** reglas del motor.
- **Hecho cuando:** cada regla tiene al menos un caso que la dispara y uno que no, y pasan.
- Depende de C1.

**C3. Antitetánica**
- **Qué hacer:** a partir de dosis previas y fecha de la última, decir si está vigente y cuántas dosis aplicar, con las reglas del CLAP. Recordar que la segunda dosis va al menos 4 semanas después de la primera y al menos 3 semanas antes de la FPP.
- **Componentes:** regla de antitetánica.
- **Hecho cuando:** los casos del manual CLAP (0 dosis; 2 dosis dentro y fuera de 3 años; 3 dosis dentro y fuera de 5 años; 5 dosis; información poco confiable) dan el resultado esperado.
- Depende de C1. Puede avanzar en paralelo con C2.

### Bloque D — Alertas con lógica propia
Todas dependen de C1 y pueden avanzar en paralelo entre sí, salvo D2, que usa la clasificación de D1.

**D1. Anemia (OMS 2024 con altitud y tabaquismo)**
- **Qué hacer:** convertir la Hb a g/L, restar el ajuste por altitud de la tabla OMS, restar además el ajuste por tabaquismo de la Tabla 5 de la OMS si fuma (3 g/L si no sabe cuánto o menos de 10; 5 g/L de 10 a 19; 6 g/L con 20 o más), redondear a un decimal en g/dL y clasificar con los puntos de corte del trimestre (1.º hasta la semana 13+6, 2.º de la 14+0 a la 27+6, 3.º desde la 28+0; tomados del catálogo A1) (sin anemia, leve, moderada, grave). Mostrar la Hb medida, cada ajuste y la Hb ajustada. Sin altitud, clasificar a nivel del mar con aviso de posible subdiagnóstico. Con 5000 m o más, no ajustar y pedir revisión. Marcar las muestras capilares. Anemia grave como alerta urgente. Al cambiar la altitud, reclasificar solo desde ese control.
- **Componentes:** regla de anemia.
- **Hecho cuando:** el ejemplo del spec da el resultado esperado (Bogotá, 2600 m, 2.º trimestre, Hb 11,8 venosa, no fumadora → Hb ajustada 10,0 → anemia leve), y pasan casos en cada franja de altitud, cada trimestre y una fumadora en altura con los dos ajustes.

**D2. Déficit de hierro (ASH 2026)**
- **Qué hacer:** cuando D1 detecta anemia sin ferritina registrada, agregar "Solicitar ferritina sérica" como pendiente. Con anemia, ferritina de 50 ng/mL o menos es anemia con déficit de hierro; mayor de 50, sugerir considerar otras causas. Si llega una ferritina sin anemia, aplicar 30 ng/mL o menos y mostrarla como dato, sin pedir más. Nunca usar 15. Si hay inflamación registrada, sugerir interpretar con la saturación de transferrina. No sugerir dosis.
- **Componentes:** regla de déficit de hierro.
- **Hecho cuando:** una anemia sin ferritina genera el pendiente; ferritina 42 con anemia dispara la alerta; 60 con anemia muestra "considerar otras causas"; 24 sin anemia aparece solo como dato.
- Depende de D1.

**D3. ASA (GPC colombiana)**
- **Qué hacer:** contar los factores de la GPC (alto: trastorno hipertensivo previo, enfermedad renal crónica, autoinmune, diabetes 1 o 2, hipertensión crónica; moderado: primer embarazo, 40 años o más, intervalo mayor de 10 años, IMC de 35 o más, antecedente familiar, embarazo múltiple). Con 1 alto o 2 o más moderados: antes de la semana 12, mostrar la fecha de inicio en el resumen; desde la 12, alertar "Considerar ASA" con 75–100 mg diarios hasta el parto. Con contraindicación, cambiar el texto y no sugerir dosis. Si la primera consulta es después de la 16, señalarlo. Recalcular si llega un dato que cambia el conteo.
- **Componentes:** regla de ASA.
- **Hecho cuando:** pasan casos con 1 factor alto, 2 moderados (por ejemplo, primer embarazo y gemelar), 1 moderado (sin alerta), edad de 38 sola (sin alerta), criterio en semana 10 (solo fecha) y en semana 12 (alerta), contraindicación y primera consulta en semana 20.

**D4. Carbonato de calcio**
- **Qué hacer:** antes de la semana 14, mostrar la fecha de inicio en el resumen; desde la 14 (o en la primera consulta si ya pasó), alertar "Iniciar carbonato de calcio" con 1200 mg al día de carbonato (2 tabletas de 600 mg) hasta el parto y las indicaciones de toma de la GPC (al menos 1 hora separado del hierro, 2 horas antes o después de las comidas principales, no con leche), separación del hierro y la nota sobre ASA. Con contraindicación (hipercalcemia, hipercalciuria, hiperparatiroidismo, nefrolitiasis o nefrocalcinosis, enfermedad renal crónica grave, hipersensibilidad), pedir valorar sin sugerir dosis. Con precaución (sarcoidosis, tiazidas, digoxina, levotiroxina, antiácidos con calcio frecuentes o vómito persistente), mostrar la dosis con la nota correspondiente. Recalcular si se registra un antecedente o medicamento nuevo.
- **Componentes:** regla de calcio; preguntas de antecedentes y medicamentos en la primera consulta.
- **Hecho cuando:** una gestante en semana 12 no tiene alerta pero ve la fecha; en semana 14+0 aparece la alerta; con nefrolitiasis aparece el texto de contraindicación sin dosis; con levotiroxina aparece la dosis con la nota de separación; registrar hipercalcemia con el calcio ya indicado vuelve a avisar.

**D5. Tromboprofilaxis (RCOG 37a con declaración de posición)**
- **Qué hacer:** sumar el puntaje con la tabla del spec. Con 4 o más, "desde ahora"; con 3, "desde la semana 28" y programar el recordatorio. Aplicar los casos especiales (IMC de 50 o más, hiperémesis con inicio en 72 horas, hospitalización, factores transitorios con suspensión 7 días después de resolverse, trombofilia de alto riesgo con valoración por especialista). Con riesgo de sangrado (incluidas plaquetas menores de 75 × 10⁹/L, detectadas solas desde el hemograma), cambiar el texto y no sugerir dosis. Sugerir la dosis por peso de la primera consulta con la tabla de la RCOG para las tres heparinas. Sugerir remisión al especialista en trombosis en el embarazo si hay trombosis previa o trombofilia de alto riesgo. Recalcular con cada evento.
- **Componentes:** regla de tromboprofilaxis.
- **Hecho cuando:** pasan casos de puntaje 2, 3 y 4; IMC 52; hiperémesis; un factor transitorio resuelto (fecha de suspensión correcta); riesgo de sangrado; y pesos en cada franja de dosis.

**D6. Diabetes gestacional (PTOG según la GPC)**
- **Qué hacer:** con los tres valores de la PTOG de 75 g, alertar "Diabetes gestacional" si alguno es igual o mayor a 92 (ayunas), 180 (1 hora) o 153 mg/dL (2 horas), mostrando cuál. Si falta un valor, no clasificar y pedirlo. Si se hizo fuera de las semanas 24 a 28, indicar la semana. Antes de solicitarla, mostrar al profesional los puntos de información que pide la GPC.
- **Componentes:** regla de PTOG.
- **Hecho cuando:** 91/179/152 no alerta; 92 en ayunas sola alerta; 153 a las 2 horas sola alerta; un caso con un valor faltante pide completarlo.

### Bloque E — Derechos sexuales y reproductivos

**E1. Flujo "Opciones y derechos"**
- **Qué hacer:** abrir una pantalla privada cuando: embarazo no planeado y no desea continuar o no ha decidido; violencia sexual; menor de 14 años; causal clínica; o la gestante pregunta. Mostrar el marco según la EG (hasta la 24: por su sola voluntad; después: las tres causales para marcar). Si la EG no es confiable cerca de la 24, pedir confirmarla sin dilatar. Mostrar la guía de asesoría neutra con el recordatorio de ofrecer un momento a solas. Registrar la decisión (continúa, solicita IVE, lo pensará con cita cercana, no desea hablar ahora). Si solicita IVE: aviso de urgencia, prestador configurado (o registro manual), fecha y hora de solicitud y remisión, recordatorio para objetores. En menor de 14 años o violencia sexual: aviso de ruta de atención urgente, causal sin límite de EG y registro de activación y notificaciones. Si solicita IVE, pausar el carné (ver F4 y F5).
- **Componentes:** pantalla privada de opciones y derechos; registro de la sección 7.
- **Hecho cuando:** cada disparador abre el flujo; los textos cambian correctamente antes y después de la semana 24; una solicitud de IVE queda con remisión fechada y el carné pasa a "pausado"; nada de este registro aparece en el carné (prueba automática de A3).
- Depende de A3 y C2. Los textos informan las sentencias y normas vigentes (C-355 de 2006, SU-096 de 2018, C-055 de 2022, Resolución 051 de 2023) con su fecha de verificación.

### Bloque F — Resumen, recordatorios y carné

**F1. Recordatorios por semana**
- **Qué hacer:** calcular, según la EG y lo ya registrado, la lista de exámenes y acciones pendientes de la sección 5 del spec (primera consulta, semana 12 para ASA, semana 14 para calcio, después de la 20, semanas 24 a 28 para PTOG, semana 28, 35 a 37, cada trimestre, controles de adherencia a calcio, ASA y tromboprofilaxis, factores transitorios activos). Marcar "atrasado" lo que pasó su ventana.
- **Componentes:** módulo de recordatorios.
- **Hecho cuando:** una gestante de prueba recorrida de la semana 8 a la 38 muestra los pendientes correctos en cada control y los atrasados cuando corresponde.
- Depende de C1 y D3–D6.

**F2. Resumen de la gestante**
- **Qué hacer:** pantalla superior del embarazo: EG de hoy, FPP, alertas activas (urgentes primero), pendientes y atrasados, e indicaciones vigentes.
- **Componentes:** pantalla de resumen.
- **Hecho cuando:** al abrir una gestante existente se ve todo lo anterior sin navegar a otra pantalla.
- Depende de C1 y F1.

**F3. Cierre de consulta, PIN y vista previa**
- **Qué hacer:** botón "Cerrar consulta" que lista los campos vacíos y muestra la vista previa del carné. En la primera consulta, registrar el PIN de 4 dígitos con la gestante y confirmar el WhatsApp. Permitir asignar un PIN nuevo y actualizar el número (lo que invalida el enlace anterior).
- **Componentes:** flujo de cierre; gestión de PIN y enlace.
- **Hecho cuando:** la vista previa coincide con lo que verá la gestante; cambiar el número deja inservible el enlace viejo.
- Depende de F2.

**F4. Carné web de la gestante**
- **Qué hacer:** página que pide el PIN, bloquea por un rato tras 5 intentos fallidos y muestra, en lenguaje cotidiano con iconos: semanas y FPP, próxima cita, qué hacer y por qué (hierro, calcio, ASA, tromboprofilaxis con los textos del spec), señales de coágulo cuando aplique, exámenes pendientes, signos de alarma, "Tus derechos", grupo y Rh, vacunas e historial de citas. Nunca leer campos "nunca en carné". Con el carné pausado, mostrar solo "Comunícate con tu servicio de salud". El mismo enlace muestra siempre la versión actualizada.
- **Componentes:** página del carné; capa de lectura restringida.
- **Hecho cuando:** el carné de prueba muestra todo lo anterior; un caso con VIH, violencia y solicitud de IVE no deja ver nada de eso; el sexto intento de PIN queda bloqueado; un carné pausado muestra solo el mensaje.
- Depende de A3 y F3.

**F5. Envío por WhatsApp**
- **Qué hacer:** enviar un mensaje corto con el nombre y el enlace. Si no hay red, dejarlo en la cola de A4. No enviar nada si el carné está pausado.
- **Componentes:** integración de mensajería; cola de envío.
- **Hecho cuando:** el mensaje llega al número de prueba; un envío hecho sin red sale al reconectar; un carné pausado no genera envío.
- Depende de A4 y F4.

**F6. Carné impreso**
- **Qué hacer:** versión imprimible de una página con el mismo contenido del carné web y las mismas exclusiones, disponible sin conexión y reimprimible en cualquier consulta.
- **Componentes:** plantilla de impresión.
- **Hecho cuando:** la hoja impresa sin conexión coincide con el carné web y no incluye ningún campo excluido.
- Depende de F4. Puede avanzar en paralelo con F5.

### Bloque G — Verificación

**G1. Batería de casos clínicos**
- **Qué hacer:** armar con el equipo clínico un conjunto de gestantes ficticias que cubra cada regla (incluidos los ejemplos del spec) y correrlo como prueba automática en cada cambio.
- **Componentes:** pruebas automáticas.
- **Hecho cuando:** todos los casos pasan y el equipo clínico firmó los resultados esperados.

**G2. Registro para medir el éxito**
- **Qué hacer:** registrar los eventos necesarios para las métricas del spec: aperturas del carné entre consultas, exámenes traídos a la cita, duración de la consulta, decisiones de ASA desde la semana 12, PTOG entre las semanas 24 y 28, asesoría y remisión en la misma consulta, activación de la ruta, evaluación trombótica en primera consulta y semana 28. Solo el registro, sin tableros (los reportes son V2).
- **Componentes:** registro de eventos.
- **Hecho cuando:** cada métrica del spec puede calcularse con una consulta sobre los eventos registrados.

**G3. Validación con usuarios y verificación normativa**
- **Qué hacer:** verificar que los textos de la sección 7 coincidan con las sentencias y normas vigentes y registrar la fecha de verificación; probar los textos del carné y de "Tus derechos" con gestantes de la población objetivo, incluidas algunas con baja alfabetización; medir con profesionales el tiempo de una consulta de seguimiento frente al papel.
- **Componentes:** pruebas con usuarios.
- **Hecho cuando:** cada texto legal cita su sentencia o norma y muestra la fecha de verificación; las gestantes del piloto saben decir su próxima cita y dos signos de alarma; la consulta no toma más que en papel.

---

### Decisiones pendientes que bloquean tareas
El spec las deja abiertas. Las reglas se pueden construir con el catálogo (A1), pero no deben usarse con pacientes hasta resolverlas:

- **Derechos (E1):** prestador de IVE y ruta de violencia sexual de la institución (para la remisión).
- **Trimestres (A1, D1):** confirmar los límites propuestos (1.º hasta 13+6, 2.º de 14+0 a 27+6, 3.º desde 28+0).
- **Valores de corte del CLAP (A1, C2):** revisarlos contra la Ruta Materno Perinatal vigente (Resolución 3280 de 2018 y sus modificaciones).
- **Suspensión de la tromboprofilaxis antes del parto (D5, F4):** instrucciones exactas para la gestante; las define el equipo clínico.
- **Bloqueo del carné por PIN (F4):** duración del bloqueo después de 5 intentos fallidos.
- **Conflictos de sincronización (A4):** regla para resolver ediciones de la misma historia en dos dispositivos sin conexión.
- **Textos de asesoría y de "Tus derechos" (E1, F4):** validación con el equipo clínico y, si es posible, con gestantes de la población objetivo (G3).
