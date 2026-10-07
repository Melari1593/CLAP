import { describe, expect, it } from 'vitest';
import { Catalogo, valorEnBanda } from './catalogo';
import { trimestreDeEG } from './trimestre';

describe('Catálogo de parámetros clínicos (A1)', () => {
  it('cada parámetro tiene fuente, estado y fecha de revisión', () => {
    for (const p of new Catalogo().lista()) {
      expect(p.fuentes.length, p.id).toBeGreaterThan(0);
      expect(['decidido', 'pendiente'], p.id).toContain(p.estado);
      expect(p.revisado, p.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('cambiar un valor en el catálogo cambia el resultado de la regla sin tocar código', () => {
    const egDias = 13 * 7 + 6; // 13+6
    expect(trimestreDeEG(egDias, new Catalogo())).toBe(1);
    const otro = new Catalogo({ 'trimestres.limites': { valor: { finPrimeroSemanas: 13, finSegundoSemanas: 28 } } });
    expect(trimestreDeEG(egDias, otro)).toBe(2);
  });

  it('usa los límites de trimestre del spec: 13+6, 14+0, 27+6 y 28+0', () => {
    const cat = new Catalogo();
    expect(trimestreDeEG(13 * 7 + 6, cat)).toBe(1);
    expect(trimestreDeEG(14 * 7, cat)).toBe(2);
    expect(trimestreDeEG(27 * 7 + 6, cat)).toBe(2);
    expect(trimestreDeEG(28 * 7, cat)).toBe(3);
  });

  it('avisa internamente cuando una regla usa un parámetro pendiente de validar', () => {
    const cat = new Catalogo();
    cat.valor('anemia.cortesHb'); // decidido
    expect(cat.avisos()).toEqual([]);
    trimestreDeEG(100, cat); // trimestres.limites ya está decidido
    expect(cat.avisos()).toEqual([]);
    cat.valor('ive.limite'); // pendiente
    expect(cat.avisos().map((a) => a.id)).toEqual(['ive.limite']);
  });

  it('un parámetro validado por el equipo clínico deja de avisar', () => {
    const cat = new Catalogo({ 'ive.limite': { estado: 'decidido', revisado: '2026-11-01' } });
    cat.valor('ive.limite');
    expect(cat.avisos()).toEqual([]);
  });

  it('carga los valores decididos del spec', () => {
    const cat = new Catalogo();
    expect(valorEnBanda(cat.valor('anemia.ajusteAltitud'), 2600)).toBe(18);
    expect(valorEnBanda(cat.valor('anemia.ajusteAltitud'), 499)).toBe(0);
    expect(valorEnBanda(cat.valor('anemia.ajusteAltitud'), 4999)).toBe(33);
    const tabaco = cat.valor('anemia.ajusteTabaquismo');
    expect([9, 10, 19, 20, 30].map((c) => valorEnBanda(tabaco.bandas, c))).toEqual([3, 5, 5, 6, 6]);
    expect(tabaco.cantidadDesconocida).toBe(3);
    expect(cat.valor('anemia.cortesHb')[2]).toEqual({ sinAnemia: 10.5, leve: 9.5, moderada: 7.0 });
    expect(cat.valor('hierro.ferritinaConAnemia')).toBe(50);
    expect(cat.valor('hierro.ferritinaSinAnemia')).toBe(30);
    expect(cat.valor('ptog.cortes')).toEqual({ ayunas: 92, unaHora: 180, dosHoras: 153 });
    expect(cat.valor('calcio.indicacion')).toEqual({ semanaInicio: 14, dosisDiariaMg: 1200, tabletaMg: 600 });
    expect(cat.valor('asa.dosis')).toEqual({ minimaMg: 75, maximaMg: 100 });
    expect(cat.valor('trombo.plaquetasSangrado')).toBe(75);
    expect(valorEnBanda(cat.valor('trombo.dosisPorPeso'), 129.9).enoxaparina).toBe('60 mg al día*');
    expect(valorEnBanda(cat.valor('trombo.dosisPorPeso'), 130).dalteparina).toBe('10 000 UI al día');
  });

  it('nunca usa 15 ng/mL como umbral de ferritina', () => {
    const cat = new Catalogo();
    expect(cat.valor('hierro.ferritinaConAnemia')).not.toBe(15);
    expect(cat.valor('hierro.ferritinaSinAnemia')).not.toBe(15);
  });

  it('los parámetros aprobados el 2026-10-07 quedaron decididos', () => {
    const cat = new Catalogo();
    for (const id of [
      'calculo.imcClasificacion',
      'trimestres.limites',
      'validacion.rangos',
      'carne.minutosBloqueo',
      'vacunas.tdap',
      'clap.edadRiesgo',
      'clap.antecedentesObstetricos',
      'clap.pesoRNPrevio',
      'clap.antitetanicaConducta',
      'recordatorios.ventanas',
      'recordatorios.examenesPrimeraConsulta',
      'trombo.suspensionAntesDelParto',
      'hta.umbrales',
      'bienestarFetal',
    ] as const) {
      expect(cat.parametro(id), id).toMatchObject({ estado: 'decidido', revisado: '2026-10-07' });
    }
  });

  it('deja como pendientes las decisiones abiertas del plan', () => {
    const pendientes = new Catalogo().lista().filter((p) => p.estado === 'pendiente').map((p) => p.id);
    expect(pendientes).toEqual(
      expect.arrayContaining([
        'derechos.rutaViolenciaSexual',
        'ive.limite',
      ]),
    );
  });
});
