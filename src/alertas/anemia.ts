// D1 — Anemia (OMS 2024, con ajuste por altitud de residencia y tabaquismo).
// D2 — Déficit de hierro por ferritina (ASH 2026).
import { valorEnBanda } from '../clinico/catalogo';
import { trimestreDeEG } from '../clinico/trimestre';
import { valorDe } from '../datos/campo';
import type { FechaISO } from '../datos/modelo';
import type { ContextoClinico, Regla } from './motor';

export type GradoAnemia = 'sin_anemia' | 'leve' | 'moderada' | 'grave';

export interface ClasificacionHb {
  fecha: FechaISO;
  medidaGdl: number;
  muestra: 'venosa' | 'capilar';
  altitudM?: number;
  ajusteAltitudGdl: number;
  ajusteTabacoGdl: number;
  ajustadaGdl: number;
  trimestre?: 1 | 2 | 3;
  corteGdl: number;
  grado: GradoAnemia;
  avisos: string[];
}

export const coma = (n: number, decimales = 1) => n.toFixed(decimales).replace('.', ',');
const ORDINAL = { 1: '1.er', 2: '2.º', 3: '3.er' } as const;

/** Altitud de residencia vigente en una fecha: la de la primera consulta o la del último cambio de residencia. */
export function altitudEn(ctx: ContextoClinico, fecha: FechaISO): number | undefined {
  let altitud = valorDe(ctx.primera?.identificacion.altitudM);
  const cambios = ctx.seguimientos
    .filter((c) => c.fecha <= fecha && c.seguimiento?.cambioResidencia.estado === 'valor')
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const c of cambios) altitud = valorDe(c.seguimiento?.cambioResidencia)?.altitudM ?? altitud;
  return altitud;
}

/** Clasifica una Hb con el método de la OMS: g/L, menos altitud, menos tabaco, redondeo a 0,1 g/dL. */
export function clasificarHb(ctx: ContextoClinico, hb: { gdl: number; muestra: 'venosa' | 'capilar'; fecha: FechaISO }): ClasificacionHb {
  const { catalogo } = ctx;
  const avisos: string[] = [];

  const altitud = altitudEn(ctx, hb.fecha);
  const maxima = catalogo.valor('anemia.altitudMaximaAjuste');
  let ajusteAltitudGL = 0;
  if (altitud === undefined) {
    avisos.push('Falta la altitud de residencia: la anemia puede estar subdiagnosticada.');
  } else if (altitud >= maxima) {
    avisos.push(`Altitud de ${altitud} m: fuera de la tabla de la OMS. No se aplicó ajuste; revise el dato.`);
  } else if (altitud >= 0) {
    ajusteAltitudGL = valorEnBanda(catalogo.valor('anemia.ajusteAltitud'), altitud);
    if (altitud >= 3000) avisos.push('Por encima de 3000 m el ajuste puede sobrediagnosticar anemia: interpretar con hemograma, ferritina y clínica.');
  }

  let ajusteTabacoGL = 0;
  const g = ctx.primera?.gestacionActual;
  if (valorDe(g?.fumaActivo) === true) {
    const tabaco = catalogo.valor('anemia.ajusteTabaquismo');
    const cigarrillos = valorDe(g?.cigarrillosDia);
    ajusteTabacoGL = typeof cigarrillos === 'number' && cigarrillos > 0 ? valorEnBanda(tabaco.bandas, cigarrillos) : tabaco.cantidadDesconocida;
  }

  const ajustadaGdl = Math.round(hb.gdl * 10 - ajusteAltitudGL - ajusteTabacoGL) / 10;

  const egDias = ctx.egEn(hb.fecha);
  const trimestre = egDias !== undefined && egDias >= 0 ? trimestreDeEG(egDias, catalogo) : undefined;
  if (trimestre === undefined) avisos.push('EG no confiable en la fecha del examen: se usó el punto de corte de 11,0 g/dL.');
  else if (ctx.eg.estado === 'calculada' && !ctx.eg.confiable) avisos.push('Trimestre estimado con una EG poco confiable.');
  const cortes = catalogo.valor('anemia.cortesHb')[trimestre ?? 1];

  const grado: GradoAnemia =
    ajustadaGdl >= cortes.sinAnemia ? 'sin_anemia' : ajustadaGdl >= cortes.leve ? 'leve' : ajustadaGdl >= cortes.moderada ? 'moderada' : 'grave';

  if (hb.muestra === 'capilar') avisos.push('Muestra capilar: suele dar valores más altos y no tiene factor de corrección.');

  return {
    fecha: hb.fecha,
    medidaGdl: hb.gdl,
    muestra: hb.muestra,
    altitudM: altitud,
    ajusteAltitudGdl: ajusteAltitudGL / 10,
    ajusteTabacoGdl: ajusteTabacoGL / 10,
    ajustadaGdl,
    trimestre,
    corteGdl: cortes.sinAnemia,
    grado,
    avisos,
  };
}

const NOMBRE_GRADO: Record<GradoAnemia, string> = {
  sin_anemia: 'sin anemia',
  leve: 'anemia leve',
  moderada: 'anemia moderada',
  grave: 'anemia grave',
};

/** "Hb medida 11,8 g/dL (venosa) · ajuste por altitud −1,8 · Hb ajustada 10,0 g/dL → anemia leve (punto de corte del 2.º trimestre: 10,5)" */
export function explicarHb(c: ClasificacionHb): string {
  const partes = [`Hb medida ${coma(c.medidaGdl)} g/dL (${c.muestra})`];
  if (c.ajusteAltitudGdl) partes.push(`ajuste por altitud −${coma(c.ajusteAltitudGdl)}`);
  if (c.ajusteTabacoGdl) partes.push(`ajuste por tabaquismo −${coma(c.ajusteTabacoGdl)}`);
  partes.push(`Hb ajustada ${coma(c.ajustadaGdl)} g/dL`);
  const corte = c.trimestre ? `punto de corte del ${ORDINAL[c.trimestre]} trimestre: ${coma(c.corteGdl)}` : `punto de corte: ${coma(c.corteGdl)}`;
  return `${partes.join(' · ')} → ${NOMBRE_GRADO[c.grado]} (${corte})`;
}

/** Clasificación de la última Hb del embarazo. */
export function ultimaHb(ctx: ContextoClinico): ClasificacionHb | undefined {
  const hb = ctx.ultimo('hb');
  return hb ? clasificarHb(ctx, hb) : undefined;
}

export const anemia: Regla = {
  id: 'anemia',
  evaluar(ctx) {
    const c = ultimaHb(ctx);
    if (!c || c.grado === 'sin_anemia') return null;
    const porque = [explicarHb(c), ...c.avisos];
    if (!ctx.ultimo('ferritina')) porque.push('Solicitar ferritina sérica.');
    return {
      titulo: c.grado === 'grave' ? 'Anemia grave' : `Anemia ${c.grado}`,
      porque,
      severidad: c.grado === 'leve' ? 1 : c.grado === 'moderada' ? 2 : 3,
      urgente: c.grado === 'grave',
      opciones: [
        { etiqueta: 'Hierro indicado o ajustado', registraIndicacion: { tipo: 'hierro', estado: 'indicado' } },
        { etiqueta: 'Ferritina solicitada' },
        { etiqueta: 'Referida' },
        { etiqueta: 'Otra conducta', requiereMotivo: true },
      ],
    };
  },
};

export type ResultadoFerritina =
  | { tipo: 'deficit_con_anemia'; ferritina: number; hbAjustada: number }
  | { tipo: 'sin_deficit_con_anemia'; ferritina: number; hbAjustada: number }
  | { tipo: 'dato_sin_anemia'; ferritina: number; deficit: boolean };

export function evaluarFerritina(ctx: ContextoClinico): ResultadoFerritina | undefined {
  const ferritina = ctx.ultimo('ferritina');
  if (!ferritina) return undefined;
  const hb = ultimaHb(ctx);
  if (hb && hb.grado !== 'sin_anemia') {
    const umbral = ctx.catalogo.valor('hierro.ferritinaConAnemia');
    return {
      tipo: ferritina.ngMl <= umbral ? 'deficit_con_anemia' : 'sin_deficit_con_anemia',
      ferritina: ferritina.ngMl,
      hbAjustada: hb.ajustadaGdl,
    };
  }
  return { tipo: 'dato_sin_anemia', ferritina: ferritina.ngMl, deficit: ferritina.ngMl <= ctx.catalogo.valor('hierro.ferritinaSinAnemia') };
}

export const deficitHierro: Regla = {
  id: 'deficit_hierro',
  evaluar(ctx) {
    const r = evaluarFerritina(ctx);
    if (!r || r.tipo === 'dato_sin_anemia') return null;
    const porque: string[] = [];
    const inflamacion = ctx.ultimo('inflamacion');
    if (inflamacion?.presente) {
      const sat = ctx.ultimo('saturacionTransferrina');
      porque.push(
        `Hay inflamación o infección registrada: la ferritina puede salir falsamente normal. Interpretarla junto con la saturación de transferrina${sat ? ` (${sat.porcentaje} %)` : ' (no registrada)'}.`,
      );
    }
    const opciones = [
      { etiqueta: 'Ajuste de hierro', registraIndicacion: { tipo: 'hierro' as const, estado: 'indicado' as const } },
      { etiqueta: 'Remisión' },
      { etiqueta: 'Otra conducta', requiereMotivo: true },
    ];
    const datos = `Hb ajustada ${coma(r.hbAjustada)} g/dL · ferritina ${r.ferritina} ng/mL`;
    if (r.tipo === 'deficit_con_anemia') {
      return { titulo: `Anemia con déficit de hierro (${datos})`, porque: [`Ferritina ≤ ${ctx.catalogo.valor('hierro.ferritinaConAnemia')} ng/mL con anemia (ASH 2026).`, ...porque], severidad: 2, opciones };
    }
    return {
      titulo: 'Anemia sin déficit de hierro por ferritina: considerar otras causas',
      porque: [`${datos}.`, ...porque],
      severidad: 1,
      opciones,
    };
  },
};
