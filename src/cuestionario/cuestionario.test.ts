import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import { primeraConsultaVacia } from '../consultas/esquema';
import { CUESTIONARIO, CUESTIONARIO_SEGUIMIENTO, NO_SABE, PREFIERO_HABLARLO, preguntasVisibles } from './preguntas';
import { aplicarRespuestas, contextoCuestionario, tipoDeCuestionario } from './servicio';
import { BLOQUES_PRIMERA, BLOQUES_SEGUIMIENTO, aplicarNoCorresponde, seguimientoVacio } from '../consultas/esquema';

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

describe('Cuestionario de los controles de seguimiento', () => {
  const rutasSeguimiento = new Set(BLOQUES_SEGUIMIENTO.flatMap((b) => b.campos.map((c) => c.ruta)));
  const ctx = { indicaciones: ['calcio', 'hierro'] };

  it('cada pregunta llena un campo que existe en el control', () => {
    for (const p of CUESTIONARIO_SEGUIMIENTO.flatMap((s) => s.preguntas)) {
      for (const r of p.rutas ?? []) expect(rutasSeguimiento.has(r), `${p.id} → ${r}`).toBe(true);
    }
  });

  it('solo pregunta por los medicamentos que tiene indicados', () => {
    const ids = preguntasVisibles(CUESTIONARIO_SEGUIMIENTO.find((s) => s.id === 'medicamentos')!, {}, ctx).map((p) => p.id);
    expect(ids).toEqual(['hierro', 'calcio', 'otrosMedicamentos']);
  });

  it('pasa signos de alarma y adherencia, muestra el método posparto, y resalta las alarmas', () => {
    const r = aplicarRespuestas(
      seguimientoVacio(),
      { motivo: 'Me siento bien', alarmas: ['dolorCabeza', 'vision'], movimientos: 'menos', calcio: false, hierro: true, vrs: false, metodoPosparto: 'implante', fuma: false },
      cat,
      'seguimiento',
      ctx,
    );
    expect(r.datos.anamnesis.motivoConsulta).toEqual(valor('Me siento bien'));
    expect(r.datos.anamnesis.revisionSistemas).toEqual(valor('Refiere: dolor de cabeza fuerte, visión borrosa o lucecitas (cuestionario de la gestante).'));
    expect(r.datos.tomaCalcioDiario).toEqual(valor(false));
    expect(r.datos.metodoAnticonceptivoPosparto.estado).toBe('no_corresponde');
    expect(r.datos.observaciones).toEqual(valor('Cuestionario: ¿Fumas cigarrillo? No.'));
    expect(r.alarmas).toEqual(['Dolor de cabeza fuerte', 'Visión borrosa o lucecitas', 'El bebé se mueve menos que antes']);
    expect(r.otras.map((o) => o.respuesta)).toEqual(['Sí', 'No', 'Implante en el brazo']);
    expect(r.otras[1]?.pregunta).toContain('VRS');
  });

  it('"Ninguno" queda como que niega signos de alarma', () => {
    const r = aplicarRespuestas(seguimientoVacio(), { alarmas: [] }, cat, 'seguimiento');
    expect(r.datos.anamnesis.revisionSistemas).toEqual(valor('Niega signos de alarma (cuestionario de la gestante).'));
    expect(r.alarmas).toEqual([]);
  });

  it('junta las respuestas de hábitos en las notas internas y no reemplaza lo registrado', () => {
    const base = seguimientoVacio();
    base.tomaCalcioDiario = valor(true);
    const r = aplicarRespuestas(base, { calcio: false, alcohol: true, violencia: PREFIERO_HABLARLO }, cat, 'seguimiento', ctx);
    expect(r.datos.tomaCalcioDiario).toEqual(valor(true));
    expect(r.datos.observaciones).toEqual(valor('Cuestionario: ¿Has tomado bebidas con alcohol? Sí.'));
    expect(r.alarmas).toEqual(['¿Has tomado bebidas con alcohol?']);
    expect(r.paraHablar).toHaveLength(1);
  });

  it('los cuestionarios guardados antes de existir el de seguimiento son de la primera', () => {
    expect(tipoDeCuestionario({ embarazoId: 'e', fechaHora: '', idioma: 'es', respuestas: {} } as never)).toBe('primera');
    expect(contextoCuestionario([{ tipo: 'asa', estado: 'indicado' }, { tipo: 'hierro', estado: 'no_indicado' }] as never).indicaciones).toEqual(['asa']);
  });
});
