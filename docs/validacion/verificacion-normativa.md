# Verificación normativa (G3)

Los textos de "Opciones y derechos" y de "Tus derechos" informan normas vigentes en Colombia. Antes de usarlos, una persona del equipo clínico y una de asesoría jurídica verifican cada punto contra la norma vigente y registran la fecha.

## Cómo registrar la verificación

1. Verificar cada fila de la tabla.
2. En `src/clinico/catalogo.ts`, parámetro `derechos.normas`, poner la fecha en `fechaVerificacion` (AAAA-MM-DD) de cada norma verificada. La app la muestra junto a la cita de la norma ("verificada el …").
3. Cuando todas tengan fecha, cambiar el estado del parámetro a `decidido` y regenerar los documentos con `npm run casos`.
4. Repetir la verificación cuando cambie la jurisprudencia o la regulación, o al menos una vez al año.

## Qué verificar

| Texto en la app | Dónde aparece | Norma | Qué confirmar | Verificado por | Fecha |
|---|---|---|---|---|---|
| "La IVE es un derecho por la sola voluntad de la gestante. No requiere causal." | Opciones y derechos, hasta la semana 24 | Sentencia C-055 de 2022 | Que siga vigente y cómo se cuenta el límite: la app lo toma como EG de hasta 24+0 (parámetro `ive.limite`, pendiente). | | |
| Las tres causales | Opciones y derechos, después de la semana 24 | Sentencia C-355 de 2006 | Redacción de las causales y requisito de denuncia para la causal de violencia sexual. | | |
| "Una vez identificada, solo la gestante decide" | Opciones y derechos, después de la semana 24 | Resolución 051 de 2023 | Que la voluntad se registre en la historia clínica. | | |
| Atención urgente; plazo máximo excepcional de 5 días calendario | Al registrar "Solicita IVE" | Resolución 051 de 2023 | Plazo y condiciones del caso excepcional. | | |
| Objeción de conciencia individual; remisión inmediata | Al registrar "Solicita IVE" | Resolución 051 de 2023, SU-096 de 2018 | Que la objeción sea individual y la obligación de remitir. | | |
| Niñas y adolescentes pueden acceder a la IVE | Guía de asesoría | Resolución 051 de 2023 | Redacción. | | |
| Menor de 14 años: se presume violencia sexual; activar la ruta y notificar | Alerta y Opciones y derechos | Normas de protección vigentes y ruta de violencia sexual | A quién se notifica y en qué plazo; verificar los pasos de `derechos.rutaViolenciaSexual` y los contactos de la institución. | | |
| Causal de violencia sexual sin límite de edad gestacional | Alerta y Opciones y derechos | Sentencia C-055 de 2022, C-355 de 2006 | Redacción. | | |
| "Tus derechos" (seis puntos) | Carné de la gestante | Ruta Materno Perinatal (Resolución 3280 de 2018) y normas de derechos sexuales y reproductivos | Que cada punto sea correcto y comprensible (ver también las pruebas con gestantes). | | |

## Lenguaje

Revisar que todos los textos sobre IVE usen lenguaje neutro, sin términos estigmatizantes ni juicios de valor (spec, "Errores y seguridad"). Los textos están en `src/derechos/textos.ts` y `src/carne/textos.ts`.
