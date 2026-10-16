// D3 — ASA para prevenir preeclampsia (GPC colombiana 2013).
import { imc, intervaloIntergenesico, sumarDias } from '../clinico/calculos';
import { valorDe, type Campo } from '../datos/campo';
import type { FechaISO } from '../datos/modelo';
import type { ContextoClinico, Regla } from './motor';

export interface EvaluacionASA {
  altos: string[];
  moderados: string[];
  cumpleCriterio: boolean;
  contraindicacion: string[];
  /** Fecha en que se cumple la semana de inicio, si se conoce la EG. */
  fechaInicio?: FechaISO;
  /** EG de hoy antes de la semana de inicio. */
  antesDeInicio: boolean;
  inicioTardio: boolean;
}

export function evaluarASA(ctx: ContextoClinico): EvaluacionASA | undefined {
  const d = ctx.primera;
  if (!d) return undefined;
  const { catalogo, eg } = ctx;
  const criterio = catalogo.valor('asa.criterio');
  const semanaInicio = catalogo.valor('asa.semanaInicio');
  const si = (c: Campo<boolean> | undefined) => valorDe(c) === true;
  const p = d.riesgoPreeclampsia;
  const ap = d.antecedentesPersonales;
  const diabetes = valorDe(ap.diabetes);

  const altos = [
    (si(p.trastornoHipertensivoPrevio) || si(ap.preeclampsia) || si(ap.eclampsia)) && 'Trastorno hipertensivo en un embarazo anterior',
    si(p.enfermedadRenalCronica) && 'Enfermedad renal crónica',
    si(p.autoinmune) && 'Enfermedad autoinmune (lupus, síndrome antifosfolípido)',
    (si(p.diabetes1o2) || diabetes === 'tipo1' || diabetes === 'tipo2') && 'Diabetes tipo 1 o 2',
    (si(p.hipertensionCronica) || si(ap.hipertension)) && 'Hipertensión crónica',
  ].filter((x): x is string => Boolean(x));

  const gestas = valorDe(d.antecedentesObstetricos.gestas);
  const fin = valorDe(d.antecedentesObstetricos.finEmbarazoAnterior);
  const intervalo = fin && eg.estado === 'calculada' ? intervaloIntergenesico(fin, eg.inicio) : undefined;
  const peso = valorDe(d.gestacionActual.pesoAnteriorKg);
  const talla = valorDe(d.gestacionActual.tallaCm);
  const imcValor = peso !== undefined && talla ? imc(peso, talla, catalogo).valor : undefined;

  const moderados = [
    gestas === 0 && 'Primer embarazo',
    ctx.edad !== undefined && ctx.edad >= criterio.edadModerada && `Edad de ${ctx.edad} años (${criterio.edadModerada} o más)`,
    intervalo && intervalo.meses > criterio.intervaloModeradoMayorDeAnios * 12 && `Intervalo intergenésico de ${intervalo.anios} años (mayor de ${criterio.intervaloModeradoMayorDeAnios})`,
    imcValor !== undefined && imcValor >= criterio.imcModerado && `IMC de ${imcValor.toString().replace('.', ',')} (${criterio.imcModerado} o más)`,
    (si(p.antecedenteFamiliarPreeclampsia) || si(d.antecedentesFamiliares.preeclampsia)) && 'Antecedente familiar de preeclampsia',
    si(p.embarazoMultiple) && 'Embarazo múltiple',
  ].filter((x): x is string => Boolean(x));

  const contraindicacion = [
    si(p.alergiaASAoAINE) && 'Alergia al ASA o a los AINE',
    si(p.asmaQueEmpeoraConAINE) && 'Asma que empeora con ASA o AINE',
  ].filter((x): x is string => Boolean(x));

  return {
    altos,
    moderados,
    cumpleCriterio: altos.length >= criterio.minimoAltos || moderados.length >= criterio.minimoModerados,
    contraindicacion,
    fechaInicio: eg.estado === 'calculada' ? sumarDias(eg.inicio, semanaInicio * 7) : undefined,
    antesDeInicio: eg.estado === 'calculada' && eg.dias < semanaInicio * 7,
    inicioTardio: ctx.egPrimeraConsulta !== undefined && ctx.egPrimeraConsulta > catalogo.valor('asa.semanaInicioTardio') * 7,
  };
}

export const asa: Regla = {
  id: 'asa',
  evaluar(ctx) {
    const e = evaluarASA(ctx);
    if (!e) return null;
    const semanaFin = ctx.catalogo.valor('asa.semanaFin');
    const terminado = ctx.eg.estado === 'calculada' && ctx.eg.dias >= semanaFin * 7;
    const indicacion = ctx.historia.indicaciones.find((i) => i.tipo === 'asa');
    const indicado = indicacion?.estado === 'indicado' || indicacion?.estado === 'ya_lo_toma';
    // Si ya lo toma y aparece una contraindicación, se valora aunque no se cumpla el criterio o aún no
    // llegue la semana de inicio: el carné deja de mostrarlo hasta esa decisión (desde la semana 36 ya terminó).
    const valorarContraindicacion = indicado && e.contraindicacion.length > 0 && !terminado;
    // Antes de la semana 12 no hay alerta: el resumen muestra la fecha de inicio.
    if (!valorarContraindicacion && (!e.cumpleCriterio || e.antesDeInicio || terminado)) return null;
    const { minimaMg, maximaMg } = ctx.catalogo.valor('asa.dosis');
    const semanaInicio = ctx.catalogo.valor('asa.semanaInicio');
    const factores = [...e.altos.map((f) => `${f} (alto)`), ...e.moderados.map((f) => `${f} (moderado)`)];
    const porque = factores.length > 0 ? [`Factores: ${factores.join('; ')}.`] : ['Sin criterio de ASA registrado, pero la gestante ya lo toma.'];
    if (ctx.eg.estado !== 'calculada') porque.push('EG no confiable: confirme la semana de gestación.');
    if (e.inicioTardio && !indicado) porque.push(`Inicio después de la semana ${ctx.catalogo.valor('asa.semanaInicioTardio')}: el profesional decide.`);

    if (e.contraindicacion.length > 0) {
      // Igual que el calcio: si ya lo toma, se valora si se suspende (con fecha) o se mantiene (con motivo).
      // Mientras no se decida "se mantiene", el carné no le dice a la gestante que siga tomándolo.
      return {
        titulo: indicado ? 'ASA indicado, pero con contraindicación registrada: valorar' : 'Criterio de ASA presente, pero con contraindicación registrada',
        porque: [
          ...porque,
          `Contraindicación: ${e.contraindicacion.join('; ')}.`,
          ...(indicado ? ['Mientras no se valore, el carné le pide a la gestante no tomar la aspirina y consultar.'] : []),
        ],
        severidad: Math.max(1, factores.length),
        variante: `contraindicacion:${indicado ? 'indicado' : 'sin_indicar'}:${[...e.contraindicacion].sort().join('|')}`,
        opciones: indicado
          ? [
              { etiqueta: 'Valorado: se suspende', requiereMotivo: true, registraIndicacion: { tipo: 'asa', estado: 'suspendido' } },
              { etiqueta: 'Valorado: se mantiene', requiereMotivo: true },
              { etiqueta: 'Referida a especialista' },
            ]
          : [
              { etiqueta: 'Valorado: no se indica', requiereMotivo: true, registraIndicacion: { tipo: 'asa', estado: 'no_indicado' } },
              { etiqueta: 'Referida a especialista' },
            ],
      };
    }
    return {
      titulo: 'Considerar ASA para prevenir preeclampsia',
      porque: [...porque, `Aspirina ${minimaMg}–${maximaMg} mg por vía oral todos los días, desde la semana ${semanaInicio} hasta la semana ${semanaFin}.`],
      severidad: factores.length,
      opciones: [
        { etiqueta: 'Indicado', registraIndicacion: { tipo: 'asa', estado: 'indicado' } },
        { etiqueta: 'No indicado', requiereMotivo: true, registraIndicacion: { tipo: 'asa', estado: 'no_indicado' } },
        { etiqueta: 'Ya lo toma', registraIndicacion: { tipo: 'asa', estado: 'ya_lo_toma' } },
      ],
    };
  },
};
