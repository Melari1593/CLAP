import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { curvaAU, evaluarCrecimiento, phi, type MedicionAU } from './crecimientoFetal';

const cat = new Catalogo();
/** Inversa de phi por bisección, para armar mediciones en un percentil dado. */
const Z = (p: number) => {
  let lo = -5;
  let hi = 5;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (phi(m) < p / 100) lo = m;
    else hi = m;
  }
  return lo;
};
/** Altura uterina (cm, con un decimal) en la semana y el percentil dados de la curva del CLAP. */
const enPercentil = (semana: number, percentil: number): MedicionAU => {
  const c = curvaAU(cat, semana * 7)!;
  return { fecha: `2026-01-${String(semana - 10).padStart(2, '0')}`, egDias: semana * 7, cm: Math.round((c.p50 + Z(percentil) * c.de) * 10) / 10 };
};

describe('Crecimiento fetal por altura uterina', () => {
  it('ejemplo del spec: baja del percentil 50 al 15 en 6 semanas → crecimiento en descenso, con orden', () => {
    const e = evaluarCrecimiento({ mediciones: [enPercentil(24, 50), enPercentil(26, 38), enPercentil(28, 26), enPercentil(30, 15)], ecografias: [] }, cat);
    expect(e.clase).toBe('descenso');
    expect(e.probDescenso).toBeGreaterThan(0.85);
    expect(e.frase).toMatch(/^Bajó del percentil \d+ al \d+ en 6 semanas\. Probabilidad de descenso: \d+ %\.$/);
    expect(e.requiereOrden).toBe(true);
    expect(e.prioritaria).toBe(false);
    expect(e.motivoOrden).toBe('Descenso del crecimiento por altura uterina desde la semana 24.');
    expect(e.trayectoria.at(-1)!.egDias).toBe(30 * 7);
    expect(e.proyeccion!.egDias).toBe(32 * 7);
  });

  it('avisa la caída del carril aunque siga sobre el percentil 10', () => {
    const e = evaluarCrecimiento({ mediciones: [enPercentil(24, 70), enPercentil(27, 50), enPercentil(30, 30)], ecografias: [] }, cat);
    expect(e.ultimaBajoP10).toBe(false);
    expect(e.clase).toBe('descenso');
  });

  it('en su carril: crecimiento adecuado, sin orden', () => {
    const e = evaluarCrecimiento({ mediciones: [enPercentil(24, 50), enPercentil(28, 52), enPercentil(32, 48)], ecografias: [] }, cat);
    expect(e.clase).toBe('adecuado');
    expect(e.requiereOrden).toBe(false);
  });

  it('bajo el percentil 10 pero estable: pequeño estable, sin orden (segundo filtro de la regla clásica)', () => {
    const e = evaluarCrecimiento({ mediciones: [enPercentil(26, 5), enPercentil(29, 5), enPercentil(32, 6)], ecografias: [] }, cat);
    expect(e.ultimaBajoP10).toBe(true);
    expect(e.clase).toBe('pequeno_estable');
    expect(e.requiereOrden).toBe(false);
    expect(e.frase).toContain('Mantenga la medición en cada control');
  });

  it('descenso con proyección bajo el percentil 10: sospecha de restricción, orden prioritaria', () => {
    const e = evaluarCrecimiento({ mediciones: [enPercentil(28, 40), enPercentil(30, 20), enPercentil(32, 9)], ecografias: [] }, cat);
    expect(e.clase).toBe('sospecha_restriccion');
    expect(e.prioritaria).toBe(true);
    expect(e.frase).toContain('Proyección a 2 semanas');
  });

  it('ecografía con peso fetal bajo el corte: sospecha de restricción aunque la altura uterina esté bien', () => {
    const e = evaluarCrecimiento(
      { mediciones: [enPercentil(24, 50), enPercentil(28, 50), enPercentil(32, 50)], ecografias: [{ fecha: '2026-02-01', pfePercentil: 4 }] },
      cat,
    );
    expect(e.clase).toBe('sospecha_restriccion');
    expect(e.motivoOrden).toContain('peso fetal estimado en el percentil 4 (corte: 10)');
  });

  it('menos de tres mediciones: datos insuficientes; bajo p10 aplica la regla clásica', () => {
    const sin = evaluarCrecimiento({ mediciones: [enPercentil(24, 50), enPercentil(26, 40)], ecografias: [] }, cat);
    expect(sin.clase).toBe('insuficientes');
    expect(sin.requiereOrden).toBe(false);
    const bajo = evaluarCrecimiento({ mediciones: [enPercentil(26, 4)], ecografias: [] }, cat);
    expect(bajo.clase).toBe('insuficientes');
    expect(bajo.requiereOrden).toBe(true);
    expect(bajo.frase).toContain('regla clásica');
    expect(bajo.motivoOrden).toBe('Altura uterina bajo el percentil 10 (curva del CLAP) en la semana 26.');
  });

  it('embarazo múltiple: no se activa', () => {
    const e = evaluarCrecimiento({ mediciones: [enPercentil(26, 4)], ecografias: [{ fecha: '2026-01-01', fetos: 2 }] }, cat);
    expect(e.clase).toBe('no_aplica');
    expect(e.requiereOrden).toBe(false);
    expect(e.frase).toContain('la curva de altura uterina del CLAP no aplica');
  });

  it('avisa lo que la hace menos confiable y no clasifica lo que está fuera de la curva', () => {
    const e = evaluarCrecimiento(
      {
        mediciones: [enPercentil(24, 50), enPercentil(28, 50), enPercentil(32, 50), { fecha: '2026-03-01', egDias: 41 * 7, cm: 33 }],
        ecografias: [{ fecha: '2026-02-01' }],
        egPocoConfiable: true,
        condiciones: ['polihidramnios'],
      },
      cat,
    );
    expect(e.fueraDeRango).toHaveLength(1);
    expect(e.mediciones).toHaveLength(3);
    expect(e.notas.join(' ')).toContain('Edad gestacional por FUM no confirmada');
    expect(e.notas.join(' ')).toContain('polihidramnios');
    expect(e.notas.join(' ')).toContain('no trae percentil');
  });

  it('el margen de la estimación contiene el valor estimado y se abre en la proyección', () => {
    const e = evaluarCrecimiento({ mediciones: [enPercentil(24, 50), enPercentil(28, 40), enPercentil(32, 30)], ecografias: [] }, cat);
    for (const p of [...e.trayectoria, e.proyeccion!]) expect(p.bajo <= p.cm && p.cm <= p.alto).toBe(true);
    expect(e.proyeccion!.alto - e.proyeccion!.bajo).toBeGreaterThan(e.trayectoria.at(-1)!.alto - e.trayectoria.at(-1)!.bajo);
  });
});
