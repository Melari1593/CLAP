import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { historiaDePrueba } from '../pruebas/historia';
import { clasificarIMCGestacional } from './crecimiento';
import { construirContexto } from './motor';

const cat = new Catalogo();
const c = construirContexto(historiaDePrueba(), '2026-10-06', cat);
const clasificar = (imc: number, semana: number, dias = 0) => clasificarIMCGestacional(c, imc, semana * 7 + dias);

describe('IMC para la edad gestacional (cuadro 12, Resolución 2465 de 2016)', () => {
  it('tiene una fila por semana, de la 6 a la 42, y es un parámetro decidido', () => {
    const tabla = cat.valor('nutricion.atalah');
    expect(tabla.map((f) => f.semana)).toEqual(Array.from({ length: 37 }, (_, i) => i + 6));
    expect(cat.parametro('nutricion.atalah').estado).toBe('decidido');
  });

  it('los rangos son contiguos (fin de adecuado + 0,1 = inicio de sobrepeso), salvo la semana 26 del cuadro', () => {
    const saltos = cat
      .valor('nutricion.atalah')
      .filter((f) => Math.round((f.sobrepeso[0] - f.adecuado[1]) * 10) !== 1)
      .map((f) => f.semana);
    expect(saltos).toEqual([26]);
  });

  it.each([
    [20.2, 10, 'bajo_peso'],
    [20.3, 10, 'adecuado'],
    [25.2, 10, 'adecuado'],
    [25.3, 10, 'sobrepeso'],
    [30.2, 10, 'sobrepeso'],
    [30.3, 10, 'obesidad'],
    [21.7, 21, 'bajo_peso'],
    [26.4, 21, 'adecuado'],
    [31.1, 21, 'sobrepeso'],
    [31.2, 21, 'obesidad'],
    [24.9, 6, 'adecuado'],
    [25.0, 6, 'sobrepeso'],
    [30.0, 6, 'sobrepeso'],
    [30.1, 6, 'obesidad'],
    [25.0, 40, 'adecuado'],
    [33.2, 42, 'sobrepeso'],
  ] as const)('IMC %s en la semana %s → %s', (imc, semana, esperado) => {
    expect(clasificar(imc, semana)).toBe(esperado);
  });

  it('usa la semana cumplida: 24+6 se clasifica con la fila 24', () => {
    expect(clasificar(22.4, 24, 6)).toBe('adecuado');
    expect(clasificar(22.4, 25, 0)).toBe('bajo_peso');
  });

  it('semana 26: 27,2 queda como adecuado (el cuadro lo pone en los dos rangos)', () => {
    expect(clasificar(27.2, 26)).toBe('adecuado');
    expect(clasificar(27.3, 26)).toBe('sobrepeso');
  });

  it('fuera de las semanas 6 a 42 no clasifica', () => {
    expect(clasificar(22, 5, 6)).toBeUndefined();
    expect(clasificar(22, 43)).toBeUndefined();
  });
});
