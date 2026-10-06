# Pruebas del carné con gestantes (G3)

## Objetivo

Comprobar que el carné se entiende sin ayuda, incluida la población con baja alfabetización, y corregir los textos antes del piloto. Criterio del spec: después de la consulta, la gestante sabe decir cuándo es su próxima cita y al menos dos signos de alarma.

## Participantes

- 8 a 12 gestantes de la población objetivo, de distintas semanas de gestación.
- Al menos 3 con baja alfabetización (la HCP registra "alfabeta") y al menos 3 de zona rural.
- Al menos 3 que usen WhatsApp y 2 que no (carné impreso).
- Consentimiento informado verbal y escrito, en lenguaje sencillo. Participar no cambia su atención.

## Materiales

- Carnés de ejemplo con datos ficticios (crearlos en la app con gestantes ficticias, no con datos reales). Incluir uno con hierro y calcio, uno con ASA y uno con tromboprofilaxis y señales de coágulo.
- La misma versión en celular (enlace con PIN) y en papel.

## Procedimiento (15 minutos por persona)

1. Entregar el carné (celular o papel) sin explicar nada. En el celular, pedirle que escriba el PIN.
2. Pedirle que lo lea en voz alta o lo mire, y que diga lo que entiende ("pensar en voz alta").
3. Preguntas, sin mostrarle las respuestas:
   1. ¿En qué semana va?
   2. ¿Cuándo es su próxima cita y qué debe llevar?
   3. ¿Qué medicamento debe tomar y cómo? (por ejemplo, separar el calcio del hierro)
   4. Dígame dos señales por las que debe ir de urgencia.
   5. ¿Qué exámenes le faltan?
   6. Lea "Tus derechos": ¿qué quiere decir el tercer punto?
4. Anotar las palabras que no entendió y cómo lo diría ella.
5. Registrar la respuesta de comprensión en la app (al cerrar la consulta, "Pregunta corta a la gestante"), para que cuente en la métrica.

No preguntar por violencia, VIH, consumo ni decisiones sobre el embarazo: no hacen parte de la prueba.

## Resultado

| Participante | Alfabeta | Canal | Semana (1) | Cita (2) | Medicamento (3) | 2 signos (4) | Exámenes (5) | Derechos (6) | Palabras difíciles |
|---|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | | |

- Si menos de 8 de cada 10 responden bien la 2 y la 4, reescribir los textos y repetir con otras participantes.
- Cada cambio de texto se hace en `src/carne/textos.ts` y queda en el historial del repositorio.
