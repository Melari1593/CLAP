import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import { primeraConsultaVacia } from '../consultas/esquema';
import { CUESTIONARIO, NO_SABE, PREFIERO_HABLARLO, preguntasVisibles } from './preguntas';
import { aplicarRespuestas } from './servicio';
import { BLOQUES_PRIMERA, aplicarNoCorresponde } from '../consultas/esquema';

const cat = new Catalogo();
const rutasDelFormulario = new Set(BLOQUES_PRIMERA.flatMap((b) => b.campos.map((c) => c.ruta)));

describe('Cuestionario de la gestante', () => {
  it('cada pregunta llena un campo que existe en la primera consulta', () => {
    for (const p of CUESTIONARIO.flatMap((s) => s.preguntas)) {
      for (const r of p.rutas ?? []) expect(rutasDelFormulario.has(r), `${p.id} → ${r}`).toBe(true);
    }
  });

  it('pasa las respuestas a la historia, con códigos y conversiones', () => {
    const { datos, llenados } = aplicarRespuestas(
      primeraConsultaVacia(),
      { municipio: 'Bogotá, D. C.', fum: '2026-06-01', pesoAntes: 58, presionAlta: true, gestas: 2, partos: 1, tetanos: 3, famPreeclampsia: true },
      cat,
    );
    expect(datos.identificacion.municipio).toEqual(valor({ codigo: '11001', nombre: 'Bogotá, D. C.' }));
    expect(datos.gestacionActual.fum).toEqual(valor('2026-06-01'));
    expect(datos.gestacionActual.antitetanica).toEqual(valor({ dosisPrevias: 3, fechaUltima: null, informacionConfiable: false }));
    expect(datos.antecedentesFamiliares.preeclampsia).toEqual(valor(true));
    expect(datos.riesgoPreeclampsia.antecedenteFamiliarPreeclampsia).toEqual(valor(true));
    expect(llenados).toContain('FUM');
  });

  it('no reemplaza lo que el profesional ya registró; "No sé" y "Prefiero hablarlo" no llenan nada', () => {
    const base = primeraConsultaVacia();
    base.gestacionActual.fum = valor('2026-05-20');
    const { datos, conservados, paraHablar } = aplicarRespuestas(base, { fum: '2026-06-01', fuma: PREFIERO_HABLARLO, grupo: NO_SABE }, cat);
    expect(datos.gestacionActual.fum).toEqual(valor('2026-05-20'));
    expect(conservados).toEqual(['FUM']);
    expect(datos.gestacionActual.fumaActivo.estado).toBe('vacio');
    expect(datos.gestacionActual.grupo.estado).toBe('vacio');
    expect(paraHablar).toEqual(['¿Fumas cigarrillo?']);
  });

  it('llena un campo que solo estaba en "no corresponde" por otra respuesta', () => {
    const base = aplicarNoCorresponde(BLOQUES_PRIMERA, primeraConsultaVacia(), {});
    expect(base.antecedentesPersonales.alergiasCuales.estado).toBe('no_corresponde');
    const { datos, conservados } = aplicarRespuestas(base, { alergias: true, alergiasCuales: 'Penicilina' }, cat);
    expect(datos.antecedentesPersonales.alergiasCuales).toEqual(valor('Penicilina'));
    expect(conservados).toEqual([]);
  });

  it('las preguntas que dependen de otra solo aparecen si aplican', () => {
    const embarazos = CUESTIONARIO.find((s) => s.id === 'embarazosAnteriores')!;
    expect(preguntasVisibles(embarazos, { gestas: 0 }).map((p) => p.id)).toEqual(['gestas']);
    expect(preguntasVisibles(embarazos, { gestas: 2 }).length).toBeGreaterThan(5);
  });
});
