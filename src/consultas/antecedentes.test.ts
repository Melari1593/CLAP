import { describe, expect, it } from 'vitest';
import { valor, vacio } from '../datos/campo';
import { primeraConsultaCompleta } from '../pruebas/fixtures';
import { resumenAntecedentes } from './antecedentes';

describe('Resumen de antecedentes para la ficha', () => {
  it('muestra lo positivo con detalle, lo negado aparte y no muestra datos privados', () => {
    const p = primeraConsultaCompleta();
    p.antecedentesPersonales.hipertension = valor(true);
    p.antecedentesPersonales.alergias = valor(true);
    p.antecedentesPersonales.alergiasCuales = valor('Penicilina');
    p.antecedentesPersonales.violencia = valor(true);
    p.antecedentesPersonales.tbc = vacio();
    p.antecedentesObstetricos.gestas = valor(2);
    const [personales] = resumenAntecedentes(p);
    expect(personales!.titulo).toMatch(/personales/);
    expect(personales!.datos).toContain('Hipertensión');
    expect(personales!.datos).toContain('¿A qué es alérgica?: Penicilina');
    expect(personales!.datos).toContain('Gestas previas: 2');
    expect(personales!.datos.join(' ')).not.toMatch(/Violencia/);
    expect(personales!.sinRegistrar).toBeGreaterThanOrEqual(1);
  });

  it('incluye familiares, preeclampsia, calcio y riesgo trombótico', () => {
    expect(resumenAntecedentes(primeraConsultaCompleta()).map((g) => g.titulo)).toHaveLength(5);
  });
});
