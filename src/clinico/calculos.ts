// B3 — Motor de cálculos: edad, FPP, edad gestacional, IMC e intervalo intergenésico.
// Las fechas se manejan como AAAA-MM-DD en UTC para que la zona horaria no mueva un día.
import { valorEnBanda, type Catalogo } from './catalogo';
import type { FechaISO } from '../datos/modelo';

const MS_DIA = 86_400_000;

function aUTC(fecha: FechaISO): number {
  const [a, m, d] = fecha.split('-').map(Number);
  if (!a || !m || !d) throw new RangeError(`Fecha inválida: ${fecha}`);
  return Date.UTC(a, m - 1, d);
}

export function diasEntre(desde: FechaISO, hasta: FechaISO): number {
  return Math.round((aUTC(hasta) - aUTC(desde)) / MS_DIA);
}

export function sumarDias(fecha: FechaISO, dias: number): FechaISO {
  return new Date(aUTC(fecha) + dias * MS_DIA).toISOString().slice(0, 10);
}

export function hoyISO(ahora = new Date()): FechaISO {
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Edad en años cumplidos. */
export function edad(fechaNacimiento: FechaISO, hoy: FechaISO): number {
  const [an, mn, dn] = fechaNacimiento.split('-').map(Number) as [number, number, number];
  const [ah, mh, dh] = hoy.split('-').map(Number) as [number, number, number];
  const yaCumplio = mh > mn || (mh === mn && dh >= dn);
  return ah - an - (yaCumplio ? 0 : 1);
}

export interface DatosEG {
  fum?: FechaISO;
  egConfiablePorFum?: boolean;
  ecografia?: { fecha: FechaISO; egDias: number };
  egConfiablePorEco?: boolean;
}

export type EdadGestacional =
  | {
      estado: 'calculada';
      dias: number;
      semanas: number;
      diasResto: number;
      /** Ej.: "18+1". */
      texto: string;
      fuente: 'fum' | 'eco';
      /** Fecha equivalente a la FUM (día 0 de la gestación). */
      inicio: FechaISO;
      fpp: FechaISO;
      confiable: boolean;
    }
  | { estado: 'no_confiable'; motivo: string };

/**
 * EG del día. Usa la FUM; sin FUM (o con FUM marcada como no confiable y ecografía disponible),
 * usa la ecografía. Sin ninguna, no calcula FPP y marca "EG no confiable".
 */
export function edadGestacional(datos: DatosEG, hoy: FechaISO, catalogo: Catalogo): EdadGestacional {
  const fppDias = catalogo.valor('calculo.fppDias');
  const usarEco = datos.ecografia && (!datos.fum || datos.egConfiablePorFum === false);

  let inicio: FechaISO;
  let fuente: 'fum' | 'eco';
  let confiable: boolean;
  if (usarEco && datos.ecografia) {
    inicio = sumarDias(datos.ecografia.fecha, -datos.ecografia.egDias);
    fuente = 'eco';
    confiable = datos.egConfiablePorEco !== false;
  } else if (datos.fum) {
    inicio = datos.fum;
    fuente = 'fum';
    confiable = datos.egConfiablePorFum !== false;
  } else {
    return { estado: 'no_confiable', motivo: 'EG no confiable: sin FUM ni ecografía. Solicitar ecografía.' };
  }

  const dias = diasEntre(inicio, hoy);
  if (dias < 0) {
    return { estado: 'no_confiable', motivo: 'EG no confiable: la fecha de inicio queda en el futuro. Revisar FUM o ecografía.' };
  }
  const semanas = Math.floor(dias / 7);
  const diasResto = dias % 7;
  return {
    estado: 'calculada',
    dias,
    semanas,
    diasResto,
    texto: `${semanas}+${diasResto}`,
    fuente,
    inicio,
    fpp: sumarDias(inicio, fppDias),
    confiable,
  };
}

/** Fecha en que se cumple una edad gestacional dada (ej.: semana 12 para el ASA). */
export function fechaDeSemana(inicio: FechaISO, semana: number): FechaISO {
  return sumarDias(inicio, semana * 7);
}

export interface IMC {
  valor: number;
  clasificacion: string;
}

/** IMC pregestacional = peso (kg) ÷ talla (m)², redondeado a un decimal. */
export function imc(pesoKg: number, tallaCm: number, catalogo: Catalogo): IMC {
  const tallaM = tallaCm / 100;
  const valor = Math.round((pesoKg / (tallaM * tallaM)) * 10) / 10;
  return { valor, clasificacion: valorEnBanda(catalogo.valor('calculo.imcClasificacion'), valor) };
}

export interface Intervalo {
  meses: number;
  anios: number;
}

/** Intervalo intergenésico: desde el fin del embarazo anterior hasta el inicio del actual. */
export function intervaloIntergenesico(finAnterior: FechaISO, inicioActual: FechaISO): Intervalo {
  const [a1, m1, d1] = finAnterior.split('-').map(Number) as [number, number, number];
  const [a2, m2, d2] = inicioActual.split('-').map(Number) as [number, number, number];
  const meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  return { meses, anios: Math.floor(meses / 12) };
}
