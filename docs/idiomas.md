# Idiomas: español, inglés, francés y árabe

## Qué se traduce

- **Interfaz del profesional**: menús, secciones, etiquetas de campos, botones, avisos, alertas,
  recordatorios, laboratorios, consentimiento, derechos e IVE, fórmula y órdenes. El idioma se
  elige con el selector 🌐 de la barra superior y se recuerda en el dispositivo.
- **Carné de la gestante** (web, vista previa e impreso): se lee en el idioma que ella eligió en la
  consulta ("Idioma del carné"). En el enlace del carné ella puede cambiarlo; su elección se
  recuerda en su teléfono.
- **Árabe**: la página se escribe de derecha a izquierda. Las curvas, las fechas y los números de
  documento y teléfono conservan la lectura de izquierda a derecha.

## Qué queda en español

- Lo que escribe el profesional (notas, motivo de consulta, nombres) y los datos de la gestante.
- Las descripciones de la tabla CIE-10 (el código sí es universal).
- Las notas y los nombres técnicos del catálogo clínico (es la fuente que revisa el equipo clínico).
- La cantidad en letras de la fórmula médica.

## Cómo funciona

El español es el idioma fuente. `src/i18n/{en,fr,ar}.json` llevan cada frase en español con su
traducción; las frases con datos usan marcadores `{0}`, `{1}` (por ejemplo, "Anemia {0}").
`src/i18n/dom.ts` traduce lo que aparece en pantalla, según el idioma global o el de la sección más
cercana con `data-idioma` (el carné). Lo marcado con `data-no-traducir` no se toca.

Cuando se agrega o cambia un texto en español, hay que agregar su traducción a los tres
diccionarios; mientras no esté, ese texto se muestra en español.

## Revisión pendiente

Las traducciones son una primera versión. Antes de usarlas con gestantes deben revisarlas
profesionales de salud que hablen cada idioma, sobre todo los textos clínicos (alertas, signos de
alarma, qué hacer) y los legales (derechos, IVE, rutas de violencia y consentimiento informado).
