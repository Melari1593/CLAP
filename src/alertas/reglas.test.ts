import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import type { DatosPrimeraConsulta } from '../datos/modelo';
import { historiaDePrueba } from '../pruebas/historia';
import { evaluarAntitetanica } from './antitetanica';
import { construirContexto, type Regla } from './motor';
import {
  abortosARepeticion,
  antirrubeola,
  antitetanica,
  edadDeRiesgo,
  embarazoNoPlaneado,
  habitos,
  infecciones,
  intervaloCorto,
  menorDe14,
  pesoRNPrevio,
  rhNegativo,
  sifilis,
  violencia,
} from './reglasClap';

const cat = new Catalogo();
const HOY = '2026-10-06';
type Opciones = Parameters<typeof historiaDePrueba>[0];

function evaluar(regla: Regla, opciones: Opciones = {}) {
  return regla.evaluar(construirContexto(historiaDePrueba(opciones), HOY, cat));
}
const conPrimera = (f: (d: DatosPrimeraConsulta) => void): Opciones => ({ primera: f });

describe('Reglas básicas del CLAP (C2): cada una dispara y no dispara', () => {
  it('edad de riesgo: menor de 15 o mayor de 35', () => {
    expect(evaluar(edadDeRiesgo, { fechaNacimiento: '1988-01-01' })?.titulo).toBe('Edad de riesgo'); // 38
    expect(evaluar(edadDeRiesgo, { fechaNacimiento: '2012-01-01' })).not.toBeNull(); // 14
    expect(evaluar(edadDeRiesgo, { fechaNacimiento: '1998-04-12' })).toBeNull(); // 28
    expect(evaluar(edadDeRiesgo, { fechaNacimiento: '1991-07-20' })).toBeNull(); // 35 exactos
  });

  it('menor de 14 años: urgente y enlaza con "Opciones y derechos"', () => {
    const r = evaluar(menorDe14, { fechaNacimiento: '2013-01-01' }); // 13 años
    expect(r).toMatchObject({ urgente: true, enlace: 'derechos' });
    expect(r?.porque.join(' ')).toContain('sin límite de edad gestacional');
    expect(evaluar(menorDe14, { fechaNacimiento: '2012-01-01' })).toBeNull(); // 14 años
  });

  it('abortos a repetición', () => {
    expect(evaluar(abortosARepeticion, conPrimera((d) => (d.antecedentesObstetricos.tresEspontaneosConsecutivos = valor(true))))).not.toBeNull();
    expect(evaluar(abortosARepeticion)).toBeNull();
  });

  it('intervalo corto: menos de 1 año', () => {
    expect(evaluar(intervaloCorto, conPrimera((d) => (d.antecedentesObstetricos.finEmbarazoAnterior = valor('2025-10-01'))))?.porque[0]).toContain('8 meses');
    expect(evaluar(intervaloCorto, conPrimera((d) => (d.antecedentesObstetricos.finEmbarazoAnterior = valor('2025-05-01'))))).toBeNull();
    expect(evaluar(intervaloCorto)).toBeNull(); // no corresponde
  });

  it('peso del RN previo: menos de 2500 g o 4000 g o más', () => {
    const peso = (g: number) => conPrimera((d) => (d.antecedentesObstetricos.pesoUltimoRNg = valor(g)));
    expect(evaluar(pesoRNPrevio, peso(2400))).not.toBeNull();
    expect(evaluar(pesoRNPrevio, peso(4000))).not.toBeNull();
    expect(evaluar(pesoRNPrevio, peso(2500))).toBeNull();
    expect(evaluar(pesoRNPrevio, peso(3999))).toBeNull();
  });

  it('embarazo no planeado: si no desea continuar o no ha decidido, es urgente y abre derechos', () => {
    expect(evaluar(embarazoNoPlaneado)).toMatchObject({ urgente: true, enlace: 'derechos', severidad: 2 }); // no ha decidido
    const desea = evaluar(embarazoNoPlaneado, conPrimera((d) => (d.planificacion.deseaContinuar = valor('si'))));
    expect(desea).toMatchObject({ titulo: 'Embarazo no planeado' });
    expect(desea?.urgente).toBeFalsy();
    expect(evaluar(embarazoNoPlaneado, conPrimera((d) => (d.planificacion.embarazoPlaneado = valor(true))))).toBeNull();
  });

  it('sífilis: VDRL/RPR reactivo', () => {
    const vdrl = (reactivo: boolean, tratamiento: boolean | null = null) => ({
      examenes: [{ tipo: 'vdrl' as const, valor: { reactivo, fta: null, tratamiento, tratamientoPareja: null } }],
    });
    expect(evaluar(sifilis, vdrl(true))).toMatchObject({ severidad: 2 });
    expect(evaluar(sifilis, vdrl(true, true))).toMatchObject({ severidad: 1 });
    expect(evaluar(sifilis, vdrl(false))).toBeNull();
    expect(evaluar(sifilis)).toBeNull();
  });

  it('sífilis: cuenta el último resultado', () => {
    const r = evaluar(sifilis, {
      examenes: [
        { tipo: 'vdrl', valor: { reactivo: true, fta: null, tratamiento: null, tratamientoPareja: null }, fecha: '2026-07-20' },
        { tipo: 'vdrl', valor: { reactivo: false, fta: null, tratamiento: null, tratamientoPareja: null }, fecha: '2026-09-20' },
      ],
    });
    expect(r).toBeNull();
  });

  it('infecciones: malaria, Chagas, bacteriuria o estreptococo B positivos', () => {
    const r = evaluar(infecciones, {
      examenes: [
        { tipo: 'bacteriuria', valor: { positivo: true } },
        { tipo: 'egb', valor: { positivo: true } },
        { tipo: 'malaria', valor: { positivo: false } },
      ],
    });
    expect(r?.porque).toEqual(['Bacteriuria positivo (2026-08-20).', 'Estreptococo B positivo (2026-08-20).']);
    expect(r?.severidad).toBe(2);
    expect(evaluar(infecciones, { examenes: [{ tipo: 'chagas', valor: { positivo: false } }] })).toBeNull();
  });

  it('Rh negativo, y si está inmunizada', () => {
    const rh = (inmunizada: boolean) =>
      conPrimera((d) => {
        d.gestacionActual.rh = valor('-');
        d.gestacionActual.inmunizada = valor(inmunizada);
      });
    expect(evaluar(rhNegativo, rh(false))).toMatchObject({ titulo: 'Rh negativo', severidad: 1 });
    expect(evaluar(rhNegativo, rh(true))).toMatchObject({ titulo: 'Rh negativo, inmunizada', severidad: 2 });
    expect(evaluar(rhNegativo)).toBeNull();
  });

  it('hábitos: tabaco activo, drogas o alcohol', () => {
    expect(evaluar(habitos)?.porque).toEqual(['Tabaco activo.', 'Drogas.', 'Alcohol.']);
    const sinHabitos = conPrimera((d) => {
      d.gestacionActual.fumaActivo = valor(false);
      d.gestacionActual.drogas = valor(false);
      d.gestacionActual.alcohol = valor(false);
    });
    expect(evaluar(habitos, sinHabitos)).toBeNull();
  });

  it('violencia; si es sexual, urgente con la ruta y derechos', () => {
    expect(evaluar(violencia)).toMatchObject({ titulo: 'Violencia en el embarazo actual' });
    expect(evaluar(violencia, conPrimera((d) => (d.gestacionActual.violenciaSexual = valor(true))))).toMatchObject({ urgente: true, enlace: 'derechos' });
    expect(evaluar(violencia, conPrimera((d) => (d.gestacionActual.violencia = valor(false))))).toBeNull();
  });

  it('antirrubéola no recibida', () => {
    expect(evaluar(antirrubeola, conPrimera((d) => (d.gestacionActual.antirrubeola = valor('no'))))).not.toBeNull();
    expect(evaluar(antirrubeola, conPrimera((d) => (d.gestacionActual.antirrubeola = valor('no_sabe'))))).not.toBeNull();
    expect(evaluar(antirrubeola)).toBeNull(); // previa
  });

  it('antitetánica: alerta solo si el esquema no está vigente', () => {
    expect(evaluar(antitetanica)).toBeNull(); // 2 dosis, la última en 2024-03 (vigente)
    const r = evaluar(antitetanica, conPrimera((d) => (d.gestacionActual.antitetanica = valor({ dosisPrevias: 0, fechaUltima: null, informacionConfiable: true }))));
    expect(r?.porque).toContain('Aplicar 2 dosis en este embarazo.');
    expect(r?.porque.join(' ')).toContain('2.ª dosis entre el 2026-11-03');
  });
});

describe('Antitetánica según el CLAP (C3)', () => {
  const at = (dosisPrevias: number, fechaUltima: string | null, informacionConfiable = true, fpp?: string) =>
    evaluarAntitetanica({ dosisPrevias, fechaUltima, informacionConfiable }, HOY, cat, fpp);

  it('0 dosis: aplicar 2', () => {
    expect(at(0, null)).toMatchObject({ vigente: false, dosisAAplicar: 2 });
  });

  it('2 dosis dentro y fuera de 3 años', () => {
    expect(at(2, '2024-01-10')).toMatchObject({ vigente: true, dosisAAplicar: 0 });
    expect(at(2, '2023-01-10')).toMatchObject({ vigente: false, dosisAAplicar: 1 });
  });

  it('3 dosis dentro y fuera de 5 años', () => {
    expect(at(3, '2022-01-10')).toMatchObject({ vigente: true, dosisAAplicar: 0 });
    expect(at(3, '2021-01-10')).toMatchObject({ vigente: false, dosisAAplicar: 1 });
  });

  it('5 dosis: vigente', () => {
    expect(at(5, '2005-01-10')).toMatchObject({ vigente: true, dosisAAplicar: 0 });
  });

  it('información poco confiable: como si no tuviera dosis', () => {
    expect(at(3, '2025-01-10', false)).toMatchObject({ vigente: false, dosisAAplicar: 2 });
  });

  it('la 2.ª dosis va 4 semanas después de la 1.ª y 3 semanas antes de la FPP', () => {
    expect(at(0, null, true, '2027-03-08').segundaDosis).toEqual({ desde: '2026-11-03', hasta: '2027-02-15', alcanza: true });
    expect(at(0, null, true, '2026-11-20').segundaDosis?.alcanza).toBe(false);
  });

  it('usa un parámetro pendiente de validar y lo avisa', () => {
    const c = new Catalogo();
    evaluarAntitetanica({ dosisPrevias: 0, fechaUltima: null, informacionConfiable: true }, HOY, c);
    expect(c.avisos().map((a) => a.id)).toContain('clap.antitetanicaConducta');
  });
});
