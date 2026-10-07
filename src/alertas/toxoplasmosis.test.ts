import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { historiaDePrueba } from '../pruebas/historia';
import { recordatorios } from '../recordatorios/recordatorios';
import { construirContexto } from './motor';
import { evaluarToxo, toxoplasmosis } from './toxoplasmosis';

// FUM de los datos de prueba: 2026-06-01.
const semana = (n: number, dias = 0) => new Date(Date.UTC(2026, 5, 1 + n * 7 + dias)).toISOString().slice(0, 10);
type T = { igg: 'positivo' | 'negativo'; igm: 'positivo' | 'negativo'; iggTitulo?: number; iga?: 'positivo' | 'negativo'; avidez?: 'alta' | 'baja' };
const toxo = (fecha: string, v: T) => ({ tipo: 'toxoplasmosis' as const, valor: { iggTitulo: null, iga: null, avidez: null, ...v }, fecha });
const pcr = (fecha: string, positivo: boolean) => ({ tipo: 'pcrLiquidoAmniotico' as const, valor: { positivo }, fecha });
type Examenes = NonNullable<NonNullable<Parameters<typeof historiaDePrueba>[0]>['examenes']>;
const ctx = (hoy: string, examenes: Examenes, extra: NonNullable<Parameters<typeof historiaDePrueba>[0]> = {}) =>
  construirContexto(historiaDePrueba({ examenes, ...extra }), hoy, new Catalogo());

describe('Toxoplasmosis: protocolo', () => {
  it('caso 1: IgG negativa preconcepcional y positiva en el 2.º trimestre → seroconversión, espiramicina y PCR', () => {
    const c = ctx(semana(18), [toxo('2026-03-01', { igg: 'negativo', igm: 'negativo' }), toxo(semana(16), { igg: 'positivo', igm: 'negativo' })]);
    const f = evaluarToxo(c);
    expect(f).toMatchObject({ fase: 'infeccion', sospecha: semana(16) });
    // PCR: después de la semana 20 y al menos 4 semanas desde la sospecha (semana 16 + 4 = 20).
    expect(f?.fase === 'infeccion' && f.pcrDesde).toBe(semana(20));
    const r = toxoplasmosis.evaluar(c)!;
    expect(r.titulo).toBe('Toxoplasmosis: infección materna en el embarazo');
    expect(r.porque.join(' ')).toContain('preconcepcional');
    expect(r.porque.join(' ')).toContain('Espiramicina 9 MUI/día en 3 dosis');
    expect(r.opciones?.[0]).toMatchObject({ registraIndicacion: { tipo: 'espiramicina', estado: 'indicado' } });
  });

  it('PCR negativa: continuar espiramicina; PCR positiva: tratamiento pleno con hemograma semanal', () => {
    const base = [toxo(semana(8), { igg: 'negativo', igm: 'negativo' }), toxo(semana(12), { igg: 'positivo', igm: 'positivo' })];
    expect(toxoplasmosis.evaluar(ctx(semana(22), [...base, pcr(semana(21), false)]))?.porque.join(' ')).toContain('continuar la espiramicina hasta el parto');
    const positivo = toxoplasmosis.evaluar(ctx(semana(22), [...base, pcr(semana(21), true)]))!;
    expect(positivo).toMatchObject({ titulo: 'Toxoplasmosis: infección fetal confirmada', severidad: 3 });
    expect(positivo.porque.join(' ')).toContain('pirimetamina');
    const conPleno = ctx(semana(23), [...base, pcr(semana(21), true), { tipo: 'hb', valor: { gdl: 12, muestra: 'venosa' }, fecha: semana(22) }], {
      indicaciones: [{ tipo: 'toxoTratamientoPleno', estado: 'indicado' }],
    });
    expect(recordatorios(conPleno).map((x) => x.id)).toContain('toxo_hemograma');
  });

  it('PCR: recordatorio solo desde la fecha que corresponde', () => {
    const base = [toxo(semana(8), { igg: 'negativo', igm: 'negativo' }), toxo(semana(12), { igg: 'positivo', igm: 'negativo' })];
    expect(recordatorios(ctx(semana(19), base)).map((x) => x.id)).not.toContain('toxo_pcr');
    expect(recordatorios(ctx(semana(20), base)).map((x) => x.id)).toContain('toxo_pcr');
  });

  it('caso 2: IgG positiva sin serología previa → segunda muestra a las 2 semanas', () => {
    const una = [toxo(semana(10), { igg: 'positivo', igm: 'negativo', iggTitulo: 40 })];
    expect(evaluarToxo(ctx(semana(11), una))).toMatchObject({ fase: 'segunda_muestra', desde: semana(12) });
    expect(recordatorios(ctx(semana(11), una)).map((x) => x.id)).not.toContain('toxo_segunda');
    expect(recordatorios(ctx(semana(12), una)).map((x) => x.id)).toContain('toxo_segunda');
    expect(recordatorios(ctx(semana(12), una)).map((x) => x.id)).not.toContain('toxo_mensual'); // ya no es susceptible
  });

  it('caso 2: IgG estable con IgM negativa → infección pasada, sin alerta', () => {
    const c = ctx(semana(14), [toxo(semana(10), { igg: 'positivo', igm: 'negativo', iggTitulo: 40 }), toxo(semana(12), { igg: 'positivo', igm: 'negativo', iggTitulo: 50 })]);
    expect(evaluarToxo(c)?.fase).toBe('inmune');
    expect(toxoplasmosis.evaluar(c)).toBeNull();
  });

  it('caso 2: IgG duplicada con IgM positiva → infección reciente', () => {
    const c = ctx(semana(14), [toxo(semana(10), { igg: 'positivo', igm: 'positivo', iggTitulo: 40 }), toxo(semana(12), { igg: 'positivo', igm: 'positivo', iggTitulo: 90 })]);
    expect(evaluarToxo(c)).toMatchObject({ fase: 'infeccion', sospecha: semana(10) });
  });

  it('caso 2: IgG duplicada con IgM negativa → IgA y repetir IgM; con IgA negativa igual se trata', () => {
    const dos = [toxo(semana(18), { igg: 'positivo', igm: 'negativo', iggTitulo: 40 }), toxo(semana(20), { igg: 'positivo', igm: 'negativo', iggTitulo: 100 })];
    expect(evaluarToxo(ctx(semana(21), dos))).toMatchObject({ fase: 'iga_igm', avidez: false });
    expect(recordatorios(ctx(semana(21), dos)).map((x) => x.id)).toContain('toxo_iga');
    const igaNeg = [...dos, toxo(semana(21), { igg: 'positivo', igm: 'negativo', iga: 'negativo' })];
    expect(evaluarToxo(ctx(semana(22), igaNeg))).toMatchObject({ fase: 'infeccion', motivo: expect.stringContaining('no descarta') });
  });

  it('antes de la semana 16 se puede pedir avidez; avidez alta → infección anterior al embarazo', () => {
    const dos = [toxo(semana(9), { igg: 'positivo', igm: 'negativo', iggTitulo: 40 }), toxo(semana(11), { igg: 'positivo', igm: 'negativo', iggTitulo: 100 })];
    expect(evaluarToxo(ctx(semana(12), dos))).toMatchObject({ fase: 'iga_igm', avidez: true });
    const alta = [...dos, toxo(semana(12), { igg: 'positivo', igm: 'negativo', avidez: 'alta' })];
    expect(evaluarToxo(ctx(semana(13), alta))?.fase).toBe('inmune');
  });

  it('sin títulos no se puede comparar: pide registrarlos', () => {
    const c = ctx(semana(14), [toxo(semana(10), { igg: 'positivo', igm: 'negativo' }), toxo(semana(12), { igg: 'positivo', igm: 'negativo' })]);
    expect(evaluarToxo(c)?.fase).toBe('faltan_datos');
  });
});
