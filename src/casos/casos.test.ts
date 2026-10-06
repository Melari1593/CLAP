import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { construirContexto, evaluar } from '../alertas/motor';
import { REGLAS } from '../alertas/reglas';
import { historiaDePrueba } from '../pruebas/historia';
import { CASOS } from './casos';
import { documentoCasos, documentoParametrosPendientes } from './documento';

describe('Batería de casos clínicos (G1)', () => {
  it.each(CASOS.map((c) => [c.id, c] as const))('%s', (_id, caso) => {
    const ctx = construirContexto(historiaDePrueba(caso.opciones), caso.hoy ?? '2026-10-06', new Catalogo());
    const resultados = evaluar(REGLAS, ctx);
    const obtenidas = Object.fromEntries([...resultados].map(([regla, r]) => [regla, r.titulo]));
    expect(obtenidas).toEqual(caso.alertas);
    for (const [regla, textos] of Object.entries(caso.contiene ?? {})) {
      const porque = resultados.get(regla)?.porque.join(' ') ?? '';
      for (const t of textos) expect(porque, `${regla}: ${t}`).toContain(t);
    }
    for (const [regla, textos] of Object.entries(caso.noContiene ?? {})) {
      const porque = resultados.get(regla)?.porque.join(' ') ?? '';
      for (const t of textos) expect(porque, `${regla}: ${t}`).not.toContain(t);
    }
  });

  it('cubre todas las reglas del motor', () => {
    const cubiertas = new Set(CASOS.flatMap((c) => Object.keys(c.alertas)));
    expect(REGLAS.map((r) => r.id).filter((id) => !cubiertas.has(id))).toEqual([]);
  });

  it('los ids de los casos son únicos', () => {
    expect(new Set(CASOS.map((c) => c.id)).size).toBe(CASOS.length);
  });

  // Con GENERAR_CASOS=1 (npm run casos) reescribe los documentos; si no, verifica que estén al día.
  it.each([
    ['docs/casos-clinicos.md', documentoCasos],
    ['docs/parametros-pendientes.md', documentoParametrosPendientes],
  ] as const)('%s está al día', (ruta, generar) => {
    const contenido = generar();
    if (process.env.GENERAR_CASOS) writeFileSync(ruta, contenido);
    expect(readFileSync(ruta, 'utf8'), 'Ejecute npm run casos').toBe(contenido);
  });
});
