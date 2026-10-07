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
  { tipo: 'sifilisTreponemica', valor: { reactiva: false }, fecha },
  { tipo: 'vih', valor: { solicitado: true, realizado: true, resultado: 'negativo' }, fecha },
  { tipo: 'hepatitisB', valor: { antigenoSuperficie: 'negativo' }, fecha },
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

    // Semana 8, sin exámenes: los de la primera consulta pendientes, nada atrasado. Sin zona endémica
    // ni falta de vacuna de rubéola, no se piden Chagas, malaria ni IgG de rubéola.
    const s8 = ids(semana(8), base);
    expect(exam(s8.filter((r) => r.tipo === 'examen').map((r) => r.id))).toEqual(
      ['inicial:hb', 'inicial:sifilisTreponemica', 'inicial:vih', 'inicial:hepatitisB', 'inicial:bacteriuria', 'inicial:toxoplasmosis'],
    );
    expect(s8.some((r) => r.estado === 'atrasado')).toBe(false);

    // Semana 21 sin los exámenes iniciales: atrasados.
    const s21 = ids(semana(21), base);
    expect(s21.filter((r) => r.estado === 'atrasado').map((r) => r.id)).toContain('inicial:hb');

    // Con los exámenes iniciales hechos en la semana 9: ya no aparecen.
    const conIniciales = { ...base, examenes: examenesIniciales(semana(9)) };
    expect(ids(semana(21), conIniciales).filter((r) => r.id.startsWith('inicial:'))).toEqual([]);

    // Ecografía de 10+6 a 13+6: pendiente en la 11, atrasada en la 14, ya no se muestra en la 20.
    expect(ids(semana(11), conIniciales).find((r) => r.id === 'eco_1t')?.estado).toBe('pendiente');
    expect(ids(semana(14), conIniciales).find((r) => r.id === 'eco_1t')?.estado).toBe('atrasado');
    expect(ids(semana(20), conIniciales).find((r) => r.id === 'eco_1t')).toBeUndefined();
    const eco1t = { tipo: 'ecografia' as const, valor: { momento: 'primer_trimestre' as const, hallazgos: 'normal' as const }, fecha: semana(12) };
    expect(ids(semana(13), { ...conIniciales, examenes: [...examenesIniciales(semana(9)), eco1t] }).find((r) => r.id === 'eco_1t')).toBeUndefined();

    // Ecografía de detalle: pendiente en la 20, atrasada en la 24.
    expect(ids(semana(20), conIniciales).find((r) => r.id === 'eco_detalle')?.estado).toBe('pendiente');
    expect(ids(semana(24), conIniciales).find((r) => r.id === 'eco_detalle')?.estado).toBe('atrasado');

    // Tercer trimestre: hemograma, VIH y sífilis desde la 28; atrasados desde la 35.
    expect(ids(semana(27), conIniciales).some((r) => r.id.startsWith('tercer:'))).toBe(false);
    expect(ids(semana(28), conIniciales).filter((r) => r.id.startsWith('tercer:')).map((r) => [r.id, r.estado])).toEqual([
      ['tercer:hb', 'pendiente'],
      ['tercer:vih', 'pendiente'],
      ['tercer:sifilis', 'pendiente'],
    ]);
    expect(ids(semana(35), conIniciales).find((r) => r.id === 'tercer:vih')?.estado).toBe('atrasado');
    const vdrl3 = { tipo: 'vdrl' as const, valor: { reactivo: false, fta: null, tratamiento: null, tratamientoPareja: null }, fecha: semana(29) };
    expect(ids(semana(30), { ...conIniciales, examenes: [...examenesIniciales(semana(9)), vdrl3] }).map((r) => r.id)).not.toContain('tercer:sifilis');

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

  it('IgG de rubéola sin vacuna previa; Chagas y malaria solo en zona endémica', () => {
    const r = ids(semana(10), {
      primera: (d) => {
        d.gestacionActual.antirrubeola = valor('no_sabe');
        d.identificacion.zonaEndemicaChagas = valor(true);
        d.identificacion.zonaEndemicaMalaria = valor(true);
      },
    }).map((x) => x.id);
    expect(r).toEqual(expect.arrayContaining(['inicial:rubeolaIgG', 'inicial:chagas', 'inicial:malaria']));
  });

  it('Rh negativo: Coombs indirecto en la primera consulta y anti-D desde la semana 28', () => {
    const rhNeg = { primera: (d: Parameters<NonNullable<NonNullable<Parameters<typeof historiaDePrueba>[0]>['primera']>>[0]) => {
      d.gestacionActual.rh = valor('-');
      d.gestacionActual.inmunizada = valor(false);
    } };
    expect(ids(semana(10), rhNeg).map((r) => r.id)).toContain('inicial:coombsIndirecto');
    expect(ids(semana(27), rhNeg).map((r) => r.id)).not.toContain('anti_d');
    expect(ids(semana(28), rhNeg).find((r) => r.id === 'anti_d')).toMatchObject({ estado: 'pendiente', tipo: 'accion' });
    expect(ids(semana(29), rhNeg).find((r) => r.id === 'anti_d')?.estado).toBe('atrasado');
    const aplicada = { ...rhNeg, seguimientos: [{ fecha: semana(28), cambios: (d: { antiDAplicada: unknown }) => (d.antiDAplicada = valor(true)) }] };
    expect(ids(semana(30), aplicada).map((r) => r.id)).not.toContain('anti_d');
    // Rh positivo: nada de esto.
    expect(ids(semana(28)).map((r) => r.id)).not.toContain('anti_d');
  });

  it('Tdap desde la semana 26 hasta que se registre aplicada', () => {
    expect(ids(semana(25)).map((r) => r.id)).not.toContain('tdap');
    expect(ids(semana(26)).find((r) => r.id === 'tdap')).toMatchObject({ estado: 'pendiente', tipo: 'accion' });
    expect(ids(semana(38)).find((r) => r.id === 'tdap')?.estado).toBe('pendiente'); // sin semana límite
    const aplicada = { seguimientos: [{ fecha: semana(27), cambios: (d: { tdapAplicada: unknown }) => (d.tdapAplicada = valor(true)) }] };
    expect(ids(semana(30), aplicada).map((r) => r.id)).not.toContain('tdap');
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
