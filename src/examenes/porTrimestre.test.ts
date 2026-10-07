import { describe, expect, it } from 'vitest';
import { construirContexto } from '../alertas/motor';
import { Catalogo } from '../clinico/catalogo';
import { historiaDePrueba } from '../pruebas/historia';
import { examenesPorTrimestre } from './porTrimestre';

// FUM de los datos de prueba: 2026-06-01.
const semana = (n: number, dias = 0) => new Date(Date.UTC(2026, 5, 1 + n * 7 + dias)).toISOString().slice(0, 10);
type Opciones = NonNullable<Parameters<typeof historiaDePrueba>[0]>;
const grupos = (hoy: string, op: Opciones = {}) => examenesPorTrimestre(construirContexto(historiaDePrueba(op), hoy, new Catalogo()));
const fila = (g: ReturnType<typeof grupos>, id: string) => g.flatMap((x) => x.filas).find((f) => f.id === id);

describe('Laboratorios y ecografías por trimestre', () => {
  it('agrupa lo esperado en los tres trimestres', () => {
    const g = grupos(semana(12));
    expect(g.map((x) => x.titulo)).toEqual(['Primer trimestre y exámenes de ingreso', 'Segundo trimestre', 'Tercer trimestre']);
    expect(g[0]!.filas.map((f) => f.id)).toEqual(expect.arrayContaining(['ingreso:hb', 'ingreso:vih', 'ingreso:hepatitisB', 'eco_1t']));
    expect(g[1]!.filas.map((f) => f.id)).toEqual(['segundo:vih', 'segundo:sifilis', 'eco_detalle', 'ptog']);
    expect(g[2]!.filas.map((f) => f.id)).toEqual(['tercer:hb', 'tercer:vih', 'tercer:sifilis', 'egb']);
  });

  it('estados: pendiente en su ventana, próximo antes y atrasado después', () => {
    const g12 = grupos(semana(12));
    expect(fila(g12, 'eco_1t')?.estado).toBe('pendiente');
    expect(fila(g12, 'ptog')?.estado).toBe('proximo');
    expect(fila(g12, 'egb')?.estado).toBe('proximo');
    expect(fila(grupos(semana(30)), 'ptog')?.estado).toBe('atrasado');
  });

  it('cada resultado va a su momento: la Hb de la semana 11 es de ingreso y la de la 29, del tercer trimestre', () => {
    const g = grupos(semana(30), {
      examenes: [
        { tipo: 'hb', valor: { gdl: 12.5, muestra: 'venosa' }, fecha: semana(11) },
        { tipo: 'hb', valor: { gdl: 12.1, muestra: 'venosa' }, fecha: semana(29) },
      ],
    });
    expect(fila(g, 'ingreso:hb')?.resultado).toMatchObject({ fecha: semana(11), semana: '11+0' });
    expect(fila(g, 'tercer:hb')).toMatchObject({ estado: 'hecho', resultado: { fecha: semana(29) } });
  });

  it('marca los resultados alterados y lista los no esperados como otros, en el trimestre de su fecha', () => {
    const g = grupos(semana(22), {
      examenes: [
        { tipo: 'vih', valor: { solicitado: true, realizado: true, resultado: 'positivo' }, fecha: semana(10) },
        { tipo: 'ferritina', valor: { ngMl: 40 }, fecha: semana(20) },
        { tipo: 'ecografia', valor: { momento: 'detalle', hallazgos: 'anormal' }, fecha: semana(20) },
      ],
    });
    expect(fila(g, 'ingreso:vih')?.resultado?.alterado).toBe(true);
    expect(fila(g, 'eco_detalle')?.resultado).toMatchObject({ alterado: true });
    expect(g[1]!.otros.map((f) => f.nombre)).toEqual(['Ferritina sérica']);
    expect(g[0]!.otros).toEqual([]);
  });
});
