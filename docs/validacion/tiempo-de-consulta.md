# Tiempo de la consulta: app frente a papel (G3)

## Objetivo

Criterio del spec: registrar una consulta de seguimiento en la app no toma más que hacerlo en papel.

## Diseño

- 3 a 5 profesionales (medicina, enfermería, partería) que ya hacen control prenatal en papel.
- Una semana de práctica con la app antes de medir.
- Medir al menos 10 consultas de seguimiento por profesional con cada método, alternando el orden.
- Medir también al menos 3 consultas por profesional sin conexión (modo avión), incluidos el cierre y la impresión del carné.

## Cómo se mide

- **App:** la app registra la duración sola (evento `consulta_cerrada`: desde que se abre el control hasta que se cierra). La mediana se calcula con `duracionConsultas` en `src/eventos/metricas.ts`.
- **Papel:** un observador cronometra desde que el profesional empieza a escribir el control hasta que termina el carné de papel.
- En ambos casos se excluye la valoración clínica que no depende del registro (examen físico).

## Registro

| Profesional | Método | Consulta | Con conexión | Minutos | Observaciones |
|---|---|---|---|---|---|
| | App / Papel | | Sí / No | | |

## Criterio

La mediana de la app es igual o menor que la del papel. Si no, anotar en qué bloques del formulario se pierde tiempo y simplificarlos antes del piloto.
