import { describe, expect, it } from 'vitest';
import { Catalogo } from './catalogo';
import { diasEntre, edad, edadGestacional, fechaDeSemana, imc, intervaloIntergenesico } from './calculos';

const cat = new Catalogo();

describe('Motor de cálculos (B3)', () => {
  it('edad en años cumplidos, incluido un nacimiento el 29 de febrero', () => {
    expect(edad('1998-04-12', '2026-10-06')).toBe(28);
    expect(edad('1998-10-07', '2026-10-06')).toBe(27);
    expect(edad('2008-02-29', '2026-02-28')).toBe(17);
    expect(edad('2008-02-29', '2026-03-01')).toBe(18);
  });

  it('FPP por FUM (280 días), con año bisiesto y FUM de diciembre', () => {
    const fpp = (fum: string) => {
      const eg = edadGestacional({ fum }, fum, cat);
      return eg.estado === 'calculada' ? eg.fpp : null;
    };
    expect(fpp('2024-02-28')).toBe('2024-12-04'); // cruza el 29 de febrero de 2024
    expect(fpp('2024-02-29')).toBe('2024-12-05');
    expect(fpp('2025-12-15')).toBe('2026-09-21'); // cambio de año
  });

  it('EG del día en semanas y días por FUM', () => {
    const eg = edadGestacional({ fum: '2026-06-01' }, '2026-10-06', cat);
    expect(eg).toMatchObject({ estado: 'calculada', dias: 127, semanas: 18, diasResto: 1, texto: '18+1', fuente: 'fum' });
  });

  it('sin FUM toma la EG de la ecografía', () => {
    const eg = edadGestacional({ ecografia: { fecha: '2026-09-01', egDias: 70 } }, '2026-10-06', cat);
    expect(eg).toMatchObject({ estado: 'calculada', dias: 105, texto: '15+0', fuente: 'eco', fpp: '2027-03-30' });
  });

  it('con FUM no confiable y ecografía disponible, usa la ecografía', () => {
    const eg = edadGestacional(
      { fum: '2026-06-01', egConfiablePorFum: false, ecografia: { fecha: '2026-09-01', egDias: 70 } },
      '2026-10-06',
      cat,
    );
    expect(eg).toMatchObject({ fuente: 'eco', dias: 105 });
  });

  it('con FUM no confiable y sin ecografía, calcula pero marca la EG como no confiable', () => {
    const eg = edadGestacional({ fum: '2026-06-01', egConfiablePorFum: false }, '2026-10-06', cat);
    expect(eg).toMatchObject({ estado: 'calculada', fuente: 'fum', confiable: false });
  });

  it('sin FUM ni ecografía no calcula FPP y marca "EG no confiable"', () => {
    const eg = edadGestacional({}, '2026-10-06', cat);
    expect(eg.estado).toBe('no_confiable');
    if (eg.estado === 'no_confiable') expect(eg.motivo).toContain('Solicitar ecografía');
  });

  it('una FUM futura no da una EG negativa', () => {
    expect(edadGestacional({ fum: '2026-11-01' }, '2026-10-06', cat).estado).toBe('no_confiable');
  });

  it('IMC pregestacional con su clasificación', () => {
    expect(imc(62, 158, cat)).toEqual({ valor: 24.8, clasificacion: 'Normal' });
    expect(imc(90, 160, cat)).toEqual({ valor: 35.2, clasificacion: 'Obesidad' });
    expect(imc(45, 160, cat)).toEqual({ valor: 17.6, clasificacion: 'Bajo peso' });
  });

  it('intervalo intergenésico en meses y años', () => {
    expect(intervaloIntergenesico('2025-10-01', '2026-06-01')).toEqual({ meses: 8, anios: 0 });
    expect(intervaloIntergenesico('2025-06-02', '2026-06-01')).toEqual({ meses: 11, anios: 0 });
    expect(intervaloIntergenesico('2015-03-10', '2026-06-01')).toEqual({ meses: 134, anios: 11 });
  });

  it('fecha en que se cumple una semana', () => {
    expect(fechaDeSemana('2026-06-01', 12)).toBe('2026-08-24');
    expect(diasEntre('2026-06-01', '2026-08-24')).toBe(84);
  });
});
