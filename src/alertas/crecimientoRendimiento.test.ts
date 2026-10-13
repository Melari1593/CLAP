import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import type { Consulta, ResultadoPorTipo } from '../datos/modelo';
import type { Historia } from '../datos/repositorio';
import { historiaDePrueba } from '../pruebas/historia';
import { rendimientoCrecimiento } from './crecimientoRendimiento';

const cat = new Catalogo();
type Eco = ResultadoPorTipo['ecografia'];
const eco = (fecha: string, extra: Partial<Eco>) => ({ tipo: 'ecografia' as const, fecha, valor: { momento: 'tercer_trimestre', hallazgos: 'normal', ...extra } as Eco });

/** Historia con controles (FUM 2026-06-01) cuya clasificación guardada se da explícita. */
function historia(controles: [string, NonNullable<Consulta['crecimiento']>, boolean?][], ecos: ReturnType<typeof eco>[] = []): Historia {
  const h = historiaDePrueba({
    examenes: ecos,
    seguimientos: controles.map(([fecha, , conOrden]) => ({
      fecha,
      ordenes: conOrden
        ? { medicamentos: [], paraclinicos: [{ id: `o-${fecha}`, nombre: 'Ecografía obstétrica de crecimiento', examen: 'ecografia', cups: null, automatica: { clase: 'descenso', motivo: 'x', fechaHora: `${fecha}T15:00:00.000Z` } }] }
        : undefined,
    })),
  });
  h.consultas.filter((c) => c.tipo === 'seguimiento').forEach((c, i) => (c.crecimiento = controles[i]![1]));
  return h;
}

describe('Éxito de la alerta de crecimiento (confirmación por peso fetal ecográfico)', () => {
  it('compara la app con la regla clásica en las tres métricas del spec', () => {
    // Pequeño estable: la regla clásica remite; la ecografía muestra peso en el percentil 30 (remisión innecesaria).
    const pequeno = historia(
      [['2026-12-14', { clase: 'pequeno_estable', reglaClasica: true, ordenGenerada: false }], ['2026-12-28', { clase: 'pequeno_estable', reglaClasica: true, ordenGenerada: false }]],
      [eco('2027-01-02', { pfePercentil: 30 })],
    );
    // Descenso sobre p10: solo la app remite; la ecografía (semana 31) confirma peso en el percentil 6, antes del siguiente control.
    const descenso = historia(
      [
        ['2026-12-14', { clase: 'adecuado', reglaClasica: false, ordenGenerada: false }],
        ['2026-12-28', { clase: 'descenso', reglaClasica: false, ordenGenerada: true }, true],
        ['2027-01-11', { clase: 'sospecha_restriccion', reglaClasica: true, ordenGenerada: false }],
      ],
      [eco('2027-01-04', { pfePercentil: 6, pfeGramos: 1400 })],
    );
    // Gemelar: no cuenta.
    const gemelar = historia([['2026-12-14', { clase: 'no_aplica', reglaClasica: false, ordenGenerada: false }]], [eco('2026-09-15', { fetos: 2, pfePercentil: 3 })]);

    const r = rendimientoCrecimiento([pequeno, descenso, gemelar], '2027-01-20', cat);
    expect(r.remisionesInnecesarias.clasica).toEqual({ numerador: 1, denominador: 1, valor: 1 });
    expect(r.remisionesInnecesarias.app).toEqual({ numerador: 0, denominador: 1, valor: 0 });
    // La regla clásica solo remitió después de la ecografía que confirmó (2027-01-11): no cuenta como detección.
    expect(r.deteccionAntesDe37.app).toEqual({ numerador: 1, denominador: 1, valor: 1 });
    expect(r.deteccionAntesDe37.clasica).toEqual({ numerador: 0, denominador: 1, valor: 0 });
    expect(r.ecografiaAntesDelSiguienteControl).toEqual({ numerador: 1, denominador: 1, valor: 1 });
  });

  it('una orden en curso no cuenta para "se hizo la ecografía"; una sin ecografía antes del siguiente control, sí (como no hecha)', () => {
    const enCurso = historia([['2026-12-28', { clase: 'descenso', reglaClasica: false, ordenGenerada: true }, true]]);
    const sinEco = historia([
      ['2026-12-14', { clase: 'descenso', reglaClasica: false, ordenGenerada: true }, true],
      ['2026-12-28', { clase: 'descenso', reglaClasica: false, ordenGenerada: false }],
    ]);
    expect(rendimientoCrecimiento([enCurso, sinEco], '2027-01-20', cat).ecografiaAntesDelSiguienteControl).toEqual({ numerador: 0, denominador: 1, valor: 0 });
  });
});
