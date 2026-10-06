# CLAP

HCP Digital (CLAP) para control prenatal: versión digital de la Historia Clínica Perinatal del CLAP para el profesional, con cálculos, alertas y recordatorios, y un carné digital simple para la gestante.

## Documentos

- [Roadmap](docs/roadmap.md)
- [Spec v1](docs/specs/2026-10-06-hcp-digital-clap.md)
- [Plan de implementación v1](docs/plans/2026-10-06-hcp-digital-clap.md)

## Tecnología

App web instalable (PWA) que funciona sin conexión: Vite + React + TypeScript, service worker con `vite-plugin-pwa` y datos locales en IndexedDB (Dexie). El envío del carné por WhatsApp usará la API de WhatsApp Business desde el servidor (pendiente).

```bash
npm install
npm run dev        # desarrollo
npm test           # pruebas
npm run typecheck  # tipos
npm run build      # build de producción con service worker
```

## Estructura

- `src/clinico/catalogo.ts` — catálogo de parámetros clínicos (A1). Las reglas leen sus valores de aquí.
- `src/datos/` — modelo de datos (A2), base de datos local y repositorio con permisos y bitácora (A3).
- `src/privacidad/` — niveles de privacidad, roles y lectura restringida del carné (A3).
- `src/sync/cola.ts` — cola de envíos sin conexión y sincronización (A4).
- `src/ui/` — pantallas.
