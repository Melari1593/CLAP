# Validación de la HCP Digital v1 (Bloque G)

Antes de usar la app con pacientes hay que completar cuatro cosas. Las dos primeras salen del código y se regeneran con `npm run casos`.

| # | Qué | Quién | Documento | Listo cuando |
|---|---|---|---|---|
| 1 | Revisar y firmar la batería de casos clínicos (G1) | Equipo clínico | [`../casos-clinicos.md`](../casos-clinicos.md) | Todos los casos marcados como correctos y firmados. Los que no, se corrigen en `src/casos/casos.ts` o en la regla. |
| 2 | Validar los parámetros pendientes | Equipo clínico | [`../parametros-pendientes.md`](../parametros-pendientes.md) | Cada parámetro pasa a "decidido" en `src/clinico/catalogo.ts`, con la fecha de revisión. |
| 3 | Verificar las normas que citan los textos legales (G3) | Equipo clínico y asesoría jurídica | [`verificacion-normativa.md`](verificacion-normativa.md) | Cada texto legal cita su norma y muestra la fecha de verificación. |
| 4 | Probar los textos con gestantes y medir el tiempo de consulta (G3) | Equipo del piloto | [`pruebas-con-gestantes.md`](pruebas-con-gestantes.md) y [`tiempo-de-consulta.md`](tiempo-de-consulta.md) | Las gestantes saben decir su próxima cita y dos signos de alarma; la consulta no toma más que en papel. |

Además, las decisiones pendientes del plan (prestador de IVE y ruta de violencia sexual de la institución) se configuran por institución en `src/institucion/configuracion.ts` (prestador de IVE y contactos de la ruta; la demostración usa datos ficticios). Los pasos comunes de la ruta están en el catálogo: `derechos.rutaViolenciaSexual`.
