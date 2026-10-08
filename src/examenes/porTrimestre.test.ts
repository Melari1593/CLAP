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
    expect(g[0]!.filas.map((f) => f.id)).toEqual(expect.arrayContaining(['ingreso:hemoclasificacion', 'ingreso:hb', 'ingreso:vih', 'ingreso:hepatitisB', 'eco_1t']));
    // La hemoclasificación se pide a todas aunque haya declarado su grupo (O positivo en la prueba).
    expect(fila(g, 'ingreso:hemoclasificacion')?.estado).toBe('pendiente');
    const conLab = grupos(semana(12), { examenes: [{ tipo: 'hemoclasificacion', valor: { grupo: 'O', rh: '-' }, fecha: semana(9) }] });
    expect(fila(conLab, 'ingreso:hemoclasificacion')).toMatchObject({ estado: 'hecho', resultado: { texto: 'O negativo', alterado: true } });
    // Con el Rh negativo del laboratorio se pide el Coombs indirecto.
    expect(fila(conLab, 'ingreso:coombsIndirecto')?.estado).toBe('pendiente');
    expect(g[1]!.filas.map((f) => f.id)).toEqual(['segundo:vih', 'segundo:sifilis', 'segundo:uroanalisis', 'eco_detalle', 'ptog']);
    expect(g[2]!.filas.map((f) => f.id)).toEqual(['tercer:hb', 'tercer:vih', 'tercer:sifilis', 'tercer:uroanalisis', 'egb']);
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

  it('hemograma: suma las plaquetas del mismo día y las marca si están bajas', () => {
    const g = grupos(semana(12), {
      examenes: [
        { tipo: 'hb', valor: { gdl: 12.5, muestra: 'venosa' }, fecha: semana(10) },
        { tipo: 'plaquetas', valor: { x10e9L: 120 }, fecha: semana(10) },
      ],
    });
    expect(fila(g, 'ingreso:hb')).toMatchObject({ nombre: 'Hemograma (Hb y plaquetas)', resultado: { alterado: true } });
    expect(fila(g, 'ingreso:hb')?.resultado?.texto).toContain('plaquetas 120');
    expect(g[0]!.otros).toEqual([]); // las plaquetas no se repiten como "otros"
  });

  it('varicela solo sin antecedente de vacuna', () => {
    expect(fila(grupos(semana(12)), 'ingreso:varicelaIgG')).toBeDefined(); // datos de prueba: sin vacuna
    const vacunada = grupos(semana(12), { primera: (d) => (d.gestacionActual.antivaricela = { estado: 'valor', valor: 'previa' }) });
    expect(fila(vacunada, 'ingreso:varicelaIgG')).toBeUndefined();
  });

  it('toxoplasmosis cada mes mientras la IgG sea negativa', () => {
    const neg = { tipo: 'toxoplasmosis' as const, valor: { igg: 'negativo' as const, igm: 'negativo' as const } };
    const antes = grupos(semana(12), { examenes: [{ ...neg, fecha: semana(10) }] });
    expect(fila(antes, 'toxo_mensual')?.estado).toBe('proximo'); // 14 días: aún no toca
    const toca = grupos(semana(15), { examenes: [{ ...neg, fecha: semana(10) }] });
    expect(fila(toca, 'toxo_mensual')?.estado).toBe('pendiente');
    expect(toca[1]!.filas.map((f) => f.id)).toContain('toxo_mensual'); // en el trimestre actual
    const positiva = grupos(semana(15), { examenes: [{ tipo: 'toxoplasmosis', valor: { igg: 'positivo', igm: 'negativo' }, fecha: semana(10) }] });
    expect(fila(positiva, 'toxo_mensual')).toBeUndefined();
  });
});
