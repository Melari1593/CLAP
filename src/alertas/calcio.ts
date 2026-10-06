// D4 — Carbonato de calcio para todas las gestantes desde la semana 14 (GPC colombiana).
import { sumarDias } from '../clinico/calculos';
import { valorDe, type Campo } from '../datos/campo';
import type { AntecedentesCalcio, FechaISO } from '../datos/modelo';
import type { ContextoClinico, Regla } from './motor';

const NOMBRES: Record<keyof AntecedentesCalcio, string> = {
  hipercalcemia: 'Hipercalcemia',
  hipercalciuria: 'Hipercalciuria',
  hiperparatiroidismo: 'Hiperparatiroidismo',
  nefrolitiasisONefrocalcinosis: 'Nefrolitiasis o nefrocalcinosis',
  erCronicaGrave: 'Enfermedad renal crónica grave',
  hipersensibilidadCalcio: 'Hipersensibilidad a productos con calcio',
  sarcoidosis: 'Sarcoidosis',
  tiazidas: 'Diuréticos tiazídicos',
  digoxina: 'Digoxina',
  levotiroxina: 'Levotiroxina',
  antiacidosConCalcioFrecuentes: 'Antiácidos con calcio de uso frecuente',
  vomitoPersistente: 'Vómito persistente',
};

export interface EvaluacionCalcio {
  contraindicaciones: string[];
  precauciones: { nombre: string; nota: string }[];
  fechaInicio?: FechaISO;
  antesDeInicio: boolean;
  /** Calcio indicado o ya lo toma. */
  indicado: boolean;
}

export function evaluarCalcio(ctx: ContextoClinico): EvaluacionCalcio | undefined {
  const a = ctx.primera?.antecedentesCalcio;
  if (!a) return undefined;
  const { semanaInicio } = ctx.catalogo.valor('calcio.indicacion');
  const presente = (k: string) => valorDe(a[k as keyof AntecedentesCalcio] as Campo<boolean>) === true;
  const contraindicaciones = ctx.catalogo
    .valor('calcio.contraindicaciones')
    .filter(presente)
    .map((k) => NOMBRES[k as keyof AntecedentesCalcio] ?? k);
  const precauciones = Object.entries(ctx.catalogo.valor('calcio.precauciones'))
    .filter(([k]) => presente(k))
    .map(([k, nota]) => ({ nombre: NOMBRES[k as keyof AntecedentesCalcio] ?? k, nota }));
  const indicacion = ctx.historia.indicaciones.find((i) => i.tipo === 'calcio');
  return {
    contraindicaciones,
    precauciones,
    fechaInicio: ctx.eg.estado === 'calculada' ? sumarDias(ctx.eg.inicio, semanaInicio * 7) : undefined,
    antesDeInicio: ctx.eg.estado === 'calculada' && ctx.eg.dias < semanaInicio * 7,
    indicado: indicacion?.estado === 'indicado' || indicacion?.estado === 'ya_lo_toma',
  };
}

export const calcio: Regla = {
  id: 'calcio',
  evaluar(ctx) {
    const e = evaluarCalcio(ctx);
    // Antes de la semana 14 no hay alerta: el resumen muestra la fecha de inicio.
    if (!e || e.antesDeInicio) return null;
    const { semanaInicio, dosisDiariaMg, tabletaMg } = ctx.catalogo.valor('calcio.indicacion');

    if (e.contraindicaciones.length > 0) {
      return {
        titulo: e.indicado
          ? 'Calcio indicado, pero con contraindicación registrada: valorar'
          : 'Calcio recomendado, pero con contraindicación registrada: valorar antes de indicar',
        porque: [`Contraindicación: ${e.contraindicaciones.join('; ')}.`],
        severidad: 2,
        opciones: [
          { etiqueta: 'Valorado: no se indica', requiereMotivo: true, registraIndicacion: { tipo: 'calcio', estado: 'no_indicado' } },
          { etiqueta: 'Valorado: se suspende', requiereMotivo: true, registraIndicacion: { tipo: 'calcio', estado: 'suspendido' } },
          { etiqueta: 'Valorado: se mantiene', requiereMotivo: true },
        ],
      };
    }
    // Indicado y sin contraindicación: no hay nada pendiente.
    if (e.indicado) return null;

    const eg = ctx.eg.estado === 'calculada' ? `Semana ${ctx.eg.texto} · ` : '';
    return {
      titulo: 'Iniciar carbonato de calcio',
      porque: [
        `${eg}Recomendado para todas las gestantes desde la semana ${semanaInicio} (prevención de preeclampsia).`,
        `Dosis: carbonato de calcio ${dosisDiariaMg} mg al día (${dosisDiariaMg / tabletaMg} tabletas de ${tabletaMg} mg), desde ahora hasta el parto.`,
        `Toma: ${ctx.catalogo.valor('calcio.toma').join(' ')}`,
        'Si tiene ASA indicado, el calcio se da además del ASA, no en su lugar.',
        ...e.precauciones.map((p) => `Precaución — ${p.nombre}: ${p.nota}`),
      ],
      severidad: 1,
      opciones: [
        { etiqueta: 'Indicado', registraIndicacion: { tipo: 'calcio', estado: 'indicado' } },
        { etiqueta: 'No indicado', requiereMotivo: true, registraIndicacion: { tipo: 'calcio', estado: 'no_indicado' } },
        { etiqueta: 'Ya lo toma', registraIndicacion: { tipo: 'calcio', estado: 'ya_lo_toma' } },
      ],
    };
  },
};
