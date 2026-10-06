import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import type { ResultadoPorTipo, TipoExamen } from '../datos/modelo';
import { construirContexto } from '../alertas/motor';
import { historiaDePrueba } from '../pruebas/historia';
import { recordatorios } from './recordatorios';

// FUM 2026-06-01. Fecha de cada semana completa:
const semana = (s: number) => new Date(Date.UTC(2026, 5, 1 + s * 7)).toISOString().slice(0, 10);
type Examen = { tipo: TipoExamen; valor: ResultadoPorTipo[TipoExamen]; fecha: string };
const neg = { positivo: false };
const examenesIniciales = (fecha: string): Examen[] => [
  { tipo: 'hb', valor: { gdl: 13, muestra: 'venosa' }, fecha },
  { tipo: 'vdrl', valor: { reactivo: false, fta: null, tratamiento: null, tratamientoPareja: null }, fecha },
  { tipo: 'vih', valor: { solicitado: true, realizado: true, resultado: 'negativo' }, fecha },
  { tipo: 'bacteriuria', valor: neg, fecha },
  { tipo: 'toxoplasmosis', valor: { igg: 'negativo', igm: 'negativo' }, fecha },
  { tipo: 'chagas', valor: neg, fecha },
  { tipo: 'malaria', valor: neg, fecha },
];

const ids = (hoy: string, op: NonNullable<Parameters<typeof historiaDePrueba>[0]> = {}) =>
  recordatorios(construirContexto(historiaDePrueba({ fechaPrimera: semana(8), ...op }), hoy, new Catalogo()));

describe('Recordatorios por semana (F1)', () => {
  it('recorrido de la semana 8 a la 38 con los pendientes y atrasados de cada control', () => {
    const indicaciones = [
      { tipo: 'hierro' as const, estado: 'indicado' as const },
      { tipo: 'acidoFolico' as const, estado: 'indicado' as const },
      { tipo: 'preparacionParto' as const, estado: 'indicado' as const },
      { tipo: 'lactancia' as const, estado: 'indicado' as const },
    ];
    const base = { indicaciones };
    const exam = (s: string[]) => s.map((x) => x);

    // Semana 8, sin exámenes: los de la primera consulta pendientes, nada atrasado.
    const s8 = ids(semana(8), base);
    expect(exam(s8.filter((r) => r.tipo === 'examen').map((r) => r.id))).toEqual(
      ['inicial:hb', 'inicial:vdrl', 'inicial:vih', 'inicial:bacteriuria', 'inicial:toxoplasmosis', 'inicial:chagas', 'inicial:malaria'],
    );
    expect(s8.some((r) => r.estado === 'atrasado')).toBe(false);

    // Semana 21 sin los exámenes iniciales: atrasados; y aparecen los de después de la 20.
    const s21 = ids(semana(21), base);
    expect(s21.filter((r) => r.estado === 'atrasado').map((r) => r.id)).toContain('inicial:hb');
    expect(s21.map((r) => r.id)).toEqual(expect.arrayContaining(['tras20:hb', 'tras20:vih', 'tras20:vdrl']));

    // Semana 21 con los exámenes iniciales hechos en la semana 9.
    const conIniciales = { ...base, examenes: examenesIniciales(semana(9)) };
    const s21b = ids(semana(21), conIniciales);
    expect(s21b.filter((r) => r.id.startsWith('inicial:'))).toEqual([]);
    expect(s21b.filter((r) => r.id.startsWith('tras20:')).map((r) => r.estado)).toEqual(['pendiente', 'pendiente', 'pendiente']);

    // Semana 25: PTOG pendiente; semana 29 sin PTOG: atrasada; con PTOG: ya no aparece.
    expect(ids(semana(25), conIniciales).find((r) => r.id === 'ptog')?.estado).toBe('pendiente');
    expect(ids(semana(29), conIniciales).find((r) => r.id === 'ptog')?.estado).toBe('atrasado');
    const ptog = { tipo: 'ptog' as const, valor: { ayunas: valor(80), unaHora: valor(120), dosHoras: valor(110) }, fecha: semana(26) };
    expect(ids(semana(29), { ...conIniciales, examenes: [...examenesIniciales(semana(9)), ptog] }).find((r) => r.id === 'ptog')).toBeUndefined();

    // Semana 28: reevaluar el riesgo trombótico (se cumple con un control desde la 28).
    expect(ids(semana(28), conIniciales).map((r) => r.id)).toContain('trombo28');
    expect(ids(semana(28), { ...conIniciales, seguimientos: [{ fecha: semana(28) }] }).map((r) => r.id)).not.toContain('trombo28');

    // Semana 35: estreptococo B pendiente; semana 38 sin hacerlo: atrasado.
    expect(ids(semana(35), conIniciales).find((r) => r.id === 'egb')?.estado).toBe('pendiente');
    expect(ids(semana(38), conIniciales).find((r) => r.id === 'egb')?.estado).toBe('atrasado');
  });

  it('pregunta por tabaco, alcohol y violencia una vez por trimestre', () => {
    expect(ids(semana(10)).map((r) => r.id)).not.toContain('tamizaje:1'); // la primera consulta fue en el 1.er trimestre
    expect(ids(semana(16)).map((r) => r.id)).toContain('tamizaje:2');
    expect(ids(semana(16), { seguimientos: [{ fecha: semana(15) }] }).map((r) => r.id)).not.toContain('tamizaje:2');
  });

  it('adherencia en cada control si hay calcio, ASA o tromboprofilaxis indicados', () => {
    const r = ids(semana(20), { indicaciones: [{ tipo: 'calcio', estado: 'indicado' }, { tipo: 'asa', estado: 'ya_lo_toma' }] });
    expect(r.map((x) => x.id)).toEqual(expect.arrayContaining(['adh:calcio', 'adh:asa']));
    expect(r.map((x) => x.id)).not.toContain('adh:trombo');
  });

  it('factor transitorio activo: preguntar si ya se resolvió', () => {
    const r = ids(semana(20), { factores: [{ tipo: 'hiperemesis', inicio: semana(19), conHospitalizacion: false }] });
    expect(r.some((x) => x.id.startsWith('factor:'))).toBe(true);
  });

  it('EG no confiable: solicitar ecografía', () => {
    const r = ids(semana(20), { primera: (d) => (d.gestacionActual.fum = { estado: 'vacio' }) });
    expect(r[0]?.id === 'ecografia' || r.some((x) => x.id === 'ecografia')).toBe(true);
  });

  it('los textos para la gestante nunca nombran el VIH', () => {
    for (const r of ids(semana(21))) expect((r.paraGestante ?? '').toLowerCase()).not.toContain('vih');
  });
});
