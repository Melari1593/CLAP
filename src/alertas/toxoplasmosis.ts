// Toxoplasmosis en el embarazo: interpretación de la serología y conducta, según el protocolo que
// entregó la responsable del proyecto (catálogo `toxoplasmosis.protocolo` y `toxoplasmosis.esquemas`).
//
// Caso 1 — IgG negativa antes (incluso preconcepcional) y positiva después: seroconversión confirmada.
// Caso 2 — IgG positiva sin serología previa: segunda muestra (IgG con título + IgM) a las 2 semanas.
//   IgG estable + IgM (–) → infección pasada; no requiere tratamiento ni más controles.
//   IgG se duplica + IgM (+) → infección reciente confirmada.
//   IgG se duplica + IgM (–) → IgA y repetir IgM (o avidez de IgG antes de la semana 16); con el
//   resultado, positivo o negativo, se trata (la IgA negativa no descarta la infección), salvo avidez
//   alta antes de la semana 16, que indica infección anterior al embarazo.
// Infección materna: espiramicina de inmediato y PCR en líquido amniótico después de la semana 20 y
// al menos 4 semanas desde la sospecha. PCR (–): espiramicina hasta el parto. PCR (+): tratamiento pleno.
import { diasEntre, sumarDias } from '../clinico/calculos';
import type { FechaISO, ResultadoPorTipo } from '../datos/modelo';
import type { ContextoClinico, Regla } from './motor';

type Toxo = ResultadoPorTipo['toxoplasmosis'] & { fecha: FechaISO; egDias?: number };

export type FaseToxo =
  | { fase: 'susceptible' }
  | { fase: 'inmune'; motivo: string }
  | { fase: 'segunda_muestra'; primera: Toxo; desde: FechaISO }
  | { fase: 'faltan_datos'; motivo: string }
  | { fase: 'iga_igm'; motivo: string; avidez: boolean }
  | { fase: 'infeccion'; motivo: string; sospecha: FechaISO; pcrDesde: FechaISO | undefined; pcr?: { positivo: boolean; fecha: FechaISO } }
  | { fase: 'no_previsto'; motivo: string };

export function evaluarToxo(ctx: ContextoClinico): FaseToxo | undefined {
  const { historia, catalogo, eg } = ctx;
  const p = catalogo.valor('toxoplasmosis.protocolo');
  const pruebas: Toxo[] = historia.examenes
    .filter((e) => e.tipo === 'toxoplasmosis' && e.resultado.estado === 'valor')
    .map((e) => ({ ...(e.resultado.estado === 'valor' ? (e.resultado.valor as ResultadoPorTipo['toxoplasmosis']) : { igg: null, igm: null }), fecha: e.fecha, egDias: ctx.egEn(e.fecha) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (pruebas.length === 0) return undefined;

  const pcrs = historia.examenes
    .filter((e) => e.tipo === 'pcrLiquidoAmniotico' && e.resultado.estado === 'valor')
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultimaPcr = pcrs.at(-1);
  const pcr =
    ultimaPcr && ultimaPcr.resultado.estado === 'valor'
      ? { positivo: (ultimaPcr.resultado.valor as ResultadoPorTipo['pcrLiquidoAmniotico']).positivo, fecha: ultimaPcr.fecha }
      : undefined;

  const infeccion = (motivo: string, sospecha: FechaISO): FaseToxo => {
    // PCR: después de la semana 20 y al menos 4 semanas desde la sospecha.
    const porSemana = eg.estado === 'calculada' ? sumarDias(eg.inicio, p.pcrDesdeSemana * 7) : undefined;
    const porSospecha = sumarDias(sospecha, p.pcrDiasDesdeSospecha);
    const pcrDesde = porSemana && porSemana > porSospecha ? porSemana : porSospecha;
    return { fase: 'infeccion', motivo, sospecha, pcrDesde, pcr };
  };

  const primeraPositiva = pruebas.find((t) => t.igg === 'positivo');
  if (!primeraPositiva) {
    const igmSola = pruebas.find((t) => t.igm === 'positivo');
    if (igmSola) return { fase: 'no_previsto', motivo: `IgM positiva con IgG negativa (${igmSola.fecha}).` };
    return { fase: 'susceptible' };
  }

  // Caso 1: IgG negativa antes (también preconcepcional) y luego positiva.
  const negativaPrevia = pruebas.find((t) => t.igg === 'negativo' && t.fecha < primeraPositiva.fecha);
  if (negativaPrevia) {
    return infeccion(
      `Seroconversión confirmada: IgG negativa el ${negativaPrevia.fecha}${negativaPrevia.egDias !== undefined && negativaPrevia.egDias < 0 ? ' (preconcepcional)' : ''} y positiva el ${primeraPositiva.fecha}.`,
      primeraPositiva.fecha,
    );
  }

  // Caso 2: IgG positiva sin serología previa conocida.
  const siguientes = pruebas.filter((t) => t.fecha > primeraPositiva.fecha && t.igg === 'positivo');
  const segunda = siguientes[0];
  if (!segunda) return { fase: 'segunda_muestra', primera: primeraPositiva, desde: sumarDias(primeraPositiva.fecha, p.segundaMuestraDias) };
  if (primeraPositiva.iggTitulo == null || segunda.iggTitulo == null) {
    return { fase: 'faltan_datos', motivo: 'Registre el título de IgG (UI/mL) de las dos muestras para saber si se duplicó.' };
  }
  if (!segunda.igm) return { fase: 'faltan_datos', motivo: 'Registre la IgM de la segunda muestra.' };
  const duplicada = segunda.iggTitulo >= primeraPositiva.iggTitulo * p.factorDuplicacion;
  const titulos = `IgG ${primeraPositiva.iggTitulo} UI/mL (${primeraPositiva.fecha}) → ${segunda.iggTitulo} UI/mL (${segunda.fecha})`;

  if (!duplicada && segunda.igm === 'negativo') return { fase: 'inmune', motivo: `${titulos}, estable, con IgM negativa: infección pasada.` };
  if (duplicada && segunda.igm === 'positivo') return infeccion(`${titulos}: se duplicó, con IgM positiva. Infección reciente confirmada.`, primeraPositiva.fecha);
  if (!duplicada) return { fase: 'no_previsto', motivo: `${titulos}, estable, con IgM positiva.` };

  // Se duplicó con IgM negativa: IgA y repetir IgM (o avidez si es antes de la semana 16).
  const complementarias = pruebas.filter((t) => t.fecha >= segunda.fecha && (t.iga || t.avidez || (t.fecha > segunda.fecha && t.igm)));
  const avidezAntes16 = (segunda.egDias ?? Infinity) < p.avidezHastaSemana * 7;
  if (complementarias.length === 0) {
    return { fase: 'iga_igm', motivo: `${titulos}: se duplicó, con IgM negativa.`, avidez: avidezAntes16 };
  }
  const alta = complementarias.find((t) => t.avidez === 'alta' && (t.egDias ?? Infinity) < p.avidezHastaSemana * 7);
  if (alta) return { fase: 'inmune', motivo: `Avidez de IgG alta antes de la semana ${p.avidezHastaSemana} (${alta.fecha}): infección anterior al embarazo.` };
  const positiva = complementarias.find((t) => t.iga === 'positivo' || (t.fecha > segunda.fecha && t.igm === 'positivo') || t.avidez === 'baja');
  return infeccion(
    positiva
      ? `${titulos}: se duplicó; IgA, nueva IgM o avidez compatibles con infección reciente (${positiva.fecha}).`
      : `${titulos}: se duplicó; la IgA negativa no descarta la infección.`,
    primeraPositiva.fecha,
  );
}

export const toxoplasmosis: Regla = {
  id: 'toxoplasmosis',
  evaluar(ctx) {
    const f = evaluarToxo(ctx);
    if (!f || f.fase === 'susceptible' || f.fase === 'inmune') return null;
    const esq = ctx.catalogo.valor('toxoplasmosis.esquemas');
    const p = ctx.catalogo.valor('toxoplasmosis.protocolo');
    switch (f.fase) {
      case 'segunda_muestra':
        return {
          titulo: 'Toxoplasmosis: IgG positiva sin serología previa',
          porque: [
            `IgG positiva el ${f.primera.fecha}, sin IgG previa conocida.`,
            'Con una sola muestra no se distingue inmunidad antigua de infección en el embarazo.',
            `Solicitar nueva IgG (con título) e IgM en la misma muestra desde el ${f.desde} (2 semanas).`,
          ],
          severidad: 1,
          opciones: [{ etiqueta: 'Segunda muestra solicitada' }],
        };
      case 'faltan_datos':
        return { titulo: 'Toxoplasmosis: completar los resultados', porque: [f.motivo], severidad: 1, opciones: [{ etiqueta: 'Datos solicitados' }] };
      case 'iga_igm':
        return {
          titulo: 'Toxoplasmosis: IgG duplicada con IgM negativa',
          porque: [
            f.motivo,
            f.avidez
              ? `Solicitar IgA y repetir la IgM, o avidez de IgG (antes de la semana ${p.avidezHastaSemana}).`
              : 'Solicitar IgA y repetir la IgM.',
            'Si la IgA o la nueva IgM son positivas, o si la IgA es negativa (no descarta la infección): tratamiento placentario y PCR en líquido amniótico.',
          ],
          severidad: 1,
          opciones: [{ etiqueta: 'IgA e IgM solicitadas' }],
        };
      case 'no_previsto':
        return {
          titulo: 'Toxoplasmosis: resultado a interpretar',
          porque: [f.motivo, 'El caso no encaja en el protocolo: consultar con infectología o perinatología.'],
          severidad: 1,
          opciones: [{ etiqueta: 'Consultado con especialista' }, { etiqueta: 'Referida' }],
        };
      case 'infeccion': {
        const ecografia = `Ecografía al momento de la PCR y luego mensual desde la semana ${p.ecoMensualDesdeSemana}: hidrocefalia, calcificaciones intracerebrales o hepáticas, placenta engrosada, ascitis, RCIU, hepatomegalia, hidrops.`;
        if (f.pcr?.positivo) {
          const fpp = ctx.eg.estado === 'calculada' ? ctx.eg.fpp : undefined;
          const hasta = fpp ? ` (hasta el ${sumarDias(fpp, -p.plenoHastaSemanasAntesFpp * 7)})` : '';
          return {
            titulo: 'Toxoplasmosis: infección fetal confirmada',
            porque: [
              `PCR positiva en líquido amniótico (${f.pcr.fecha}).`,
              `Pasar a tratamiento pleno${hasta}: ${esq.pleno}`,
              esq.alternativos,
              ecografia,
            ],
            severidad: 3,
            urgente: true,
            opciones: [
              { etiqueta: 'Tratamiento pleno indicado', registraIndicacion: { tipo: 'toxoTratamientoPleno', estado: 'indicado' } },
              { etiqueta: 'Referida', registraIndicacion: { tipo: 'toxoTratamientoPleno', estado: 'referida' } },
            ],
          };
        }
        const porque = [f.motivo, `Iniciar tratamiento placentario de inmediato: ${esq.placentario}`];
        if (f.pcr) porque.push(`PCR negativa en líquido amniótico (${f.pcr.fecha}): continuar la espiramicina hasta el parto.`);
        else porque.push(`Solicitar PCR en líquido amniótico desde el ${f.pcrDesde} (después de la semana ${p.pcrDesdeSemana} y al menos 4 semanas desde la sospecha, para evitar falsos negativos).`);
        porque.push(ecografia);
        return {
          titulo: 'Toxoplasmosis: infección materna en el embarazo',
          porque,
          severidad: 2,
          urgente: true,
          opciones: [
            { etiqueta: 'Espiramicina indicada', registraIndicacion: { tipo: 'espiramicina', estado: 'indicado' } },
            { etiqueta: 'Referida', registraIndicacion: { tipo: 'espiramicina', estado: 'referida' } },
          ],
        };
      }
    }
  },
};

/** Días desde una fecha hasta hoy (para los recordatorios del protocolo). */
export const diasDesde = (ctx: ContextoClinico, fecha: FechaISO) => diasEntre(fecha, ctx.hoy);
