# Parámetros clínicos pendientes de validar

> Documento generado desde el catálogo (`src/clinico/catalogo.ts`, `npm run casos`). Las reglas ya los usan, pero no deben usarse con pacientes hasta que el equipo clínico los valide. Al validarlos, se marcan como "decidido" en el catálogo con la fecha de revisión.

| Id | Parámetro | Valor actual | Fuente | Nota |
|---|---|---|---|---|
| `trombo.suspensionAntesDelParto` | Instrucciones a la gestante para suspender la tromboprofilaxis antes del parto | Sin definir | Equipo clínico | Las define el equipo clínico (decisión pendiente del plan). |
| `ive.limite` | Límite de la IVE por la sola voluntad y margen de EG dudosa | `{"hastaDiasInclusive":168,"margenEGDudosaSemanas":2}` | Sentencia C-055 de 2022, Equipo clínico | Se toma "hasta la semana 24" como EG de hasta 24+0. Con EG no confiable entre las semanas 22 y 26 la app pide confirmar la EG sin dilatar la atención. Validar la interpretación con asesoría jurídica. |
| `derechos.normas` | Sentencias y normas que informan los textos de derechos | `[{"norma":"Sentencia C-355 de 2006","contenido":"Tres causales de IVE.","fechaVerificacion":null},{"norma":"Sentencia SU-096 de 2018","contenido":"Reglas sobre el acceso a la IVE.","fechaVerificacion":null},{"norma":"Sentencia C-055 de 2022","contenido":"IVE hasta la semana 24 por la sola voluntad.","fechaVerificacion":null},{"norma":"Resolución 051 de 2023","contenido":"Regulación única de la atención integral de la IVE.","fechaVerificacion":null}]` | Sentencia C-355 de 2006, Sentencia SU-096 de 2018, Sentencia C-055 de 2022, Resolución 051 de 2023 | Falta registrar la fecha de verificación de cada norma (tarea G3). |
| `derechos.prestadorIVE` | Prestador de referencia para IVE de la institución | Sin definir | Equipo clínico | Sin prestador configurado, la app permite registrar la remisión de forma manual. |
| `derechos.rutaViolenciaSexual` | Ruta de atención a víctimas de violencia sexual y notificaciones | Sin definir | Equipo clínico |  |
