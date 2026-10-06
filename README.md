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
- `src/clinico/calculos.ts` — edad, FPP, edad gestacional, IMC e intervalo intergenésico (B3).
- `src/consultas/` — esquema de los formularios, validaciones de valores imposibles, búsqueda y guardado de consultas (B1, B2, B4).
- `src/alertas/` — motor de alertas y decisiones (C1), reglas básicas del CLAP (C2), antitetánica (C3) y reglas con lógica propia: anemia, hierro, ASA, calcio, tromboprofilaxis y PTOG (D1–D6).
- `src/derechos/` — flujo privado "Opciones y derechos": marco según la EG, decisión, remisión, ruta de violencia sexual y pausa del carné (E1).
- `src/ui/` — pantallas: búsqueda, ficha de la gestante, primera consulta, control de seguimiento y catálogo.

Mientras no exista el servidor, la app usa un profesional autorizado de demostración en el dispositivo.
