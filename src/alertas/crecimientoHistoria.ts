// Crecimiento fetal desde la historia: arma los datos del modelo (alturas uterinas, ecografías y
// condiciones que alteran la altura uterina) hasta una fecha, decide si hay que generar la orden de
// ecografía y expone las reglas de alerta para el profesional.
import { imc } from '../clinico/calculos';
import { valorDe } from '../datos/campo';
import type { Consulta, FechaISO, OrdenParaclinico, ResultadoPorTipo } from '../datos/modelo';
import type { Historia } from '../datos/repositorio';
import { NOMBRE_CLASE, evaluarCrecimiento, type EcografiaCrecimiento, type EvaluacionCrecimiento, type MedicionAU } from './crecimientoFetal';
import type { ContextoClinico, Regla } from './motor';

type Eco = ResultadoPorTipo['ecografia'] & { fecha: FechaISO };

/** Ecografías con resultado (no anuladas) hasta una fecha, en orden. */
export function ecografiasHasta(historia: Historia, hasta: FechaISO): Eco[] {
  return historia.examenes
    .filter((e) => e.tipo === 'ecografia' && !e.anulado && e.resultado.estado === 'valor' && e.fecha <= hasta)
    .map((e) => ({ ...(e.resultado as { valor: ResultadoPorTipo['ecografia'] }).valor, fecha: e.fecha }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Evalúa el crecimiento con lo registrado hasta una fecha (por defecto, hoy). */
export function evaluarCrecimientoHasta(ctx: ContextoClinico, hasta: FechaISO = ctx.hoy): EvaluacionCrecimiento {
  const { historia, catalogo } = ctx;
  const consultas = historia.consultas.filter((c) => c.fecha <= hasta);
  const mediciones: MedicionAU[] = consultas.flatMap((c) => {
    const cm = valorDe(c.seguimiento?.alturaUterinaCm ?? c.primera?.examenFisico?.alturaUterinaCm);
    const egDias = ctx.egEn(c.fecha);
    return cm === undefined || egDias === undefined ? [] : [{ fecha: c.fecha, egDias, cm }];
  });
  const ecos = ecografiasHasta(historia, hasta);
  const ecografias: EcografiaCrecimiento[] = ecos.map((e) => ({ fecha: e.fecha, pfePercentil: e.pfePercentil, caPercentil: e.caPercentil, fetos: e.fetos }));

  // Condiciones que alteran la altura uterina, si están registradas.
  const condiciones: string[] = [];
  if (ecos.at(-1)?.liquido === 'polihidramnios') condiciones.push('polihidramnios');
  if (ecos.some((e) => e.miomas)) condiciones.push('miomas');
  const g = ctx.primera?.gestacionActual;
  const peso = valorDe(g?.pesoAnteriorKg);
  const talla = valorDe(g?.tallaCm);
  if (peso && talla && imc(peso, talla, catalogo).valor >= catalogo.valor('crecimiento.obesidadImc')) condiciones.push('obesidad');
  const ultimoControl = consultas.filter((c) => c.seguimiento?.presentacion.estado === 'valor').sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
  if (valorDe(ultimoControl?.seguimiento?.presentacion) === 'transversa') condiciones.push('presentación transversa');

  // FUM no confirmada y sin ecografía temprana.
  const egPocoConfiable = ctx.eg.estado === 'calculada' && ctx.eg.fuente === 'fum' && valorDe(g?.egConfiablePorFum) !== true && !valorDe(g?.ecografia);
  return evaluarCrecimiento({ mediciones, ecografias, condiciones, egPocoConfiable }, catalogo);
}

// ---------------------------------------------------------------- Órdenes de ecografía

export interface OrdenEcografia {
  consulta: Consulta;
  orden: OrdenParaclinico;
}

/** Órdenes de ecografía no anuladas cuyo resultado aún no se registró (ecografía con fecha igual o posterior). */
export function ordenesEcografiaPendientes(historia: Historia): OrdenEcografia[] {
  const fechasEco = ecografiasHasta(historia, '9999-12-31').map((e) => e.fecha);
  return historia.consultas.flatMap((consulta) =>
    (consulta.ordenes?.paraclinicos ?? [])
      .filter((o) => o.examen === 'ecografia' && !o.anulada && !fechasEco.some((f) => f >= consulta.fecha))
      .map((orden) => ({ consulta, orden })),
  );
}

/** Ecografía registrada en los días previos a una fecha (no se genera otra orden). */
export function ecografiaReciente(ctx: ContextoClinico, fecha: FechaISO): Eco | undefined {
  const dias = ctx.catalogo.valor('crecimiento.au').ecografiaRecienteDias;
  const desde = new Date(Date.parse(fecha) - dias * 86_400_000).toISOString().slice(0, 10);
  return ecografiasHasta(ctx.historia, fecha).filter((e) => e.fecha >= desde).at(-1);
}

/** Lo que se hace con la orden en el control de una fecha. */
export type DecisionOrden =
  | { tipo: 'no_requiere' }
  | { tipo: 'generar'; motivo: string; prioritaria: boolean }
  | { tipo: 'pendiente'; fecha: FechaISO }
  | { tipo: 'ecografia_reciente'; fecha: FechaISO }
  | { tipo: 'anulada'; motivo: string };

export function decidirOrden(ctx: ContextoClinico, ev: EvaluacionCrecimiento, consulta?: Pick<Consulta, 'id' | 'fecha' | 'ordenes'>): DecisionOrden {
  if (!ev.requiereOrden || !ev.motivoOrden) return { tipo: 'no_requiere' };
  const propia = consulta?.ordenes?.paraclinicos.find((o) => o.automatica);
  if (propia?.anulada) return { tipo: 'anulada', motivo: propia.anulada.motivo };
  const pendiente = ordenesEcografiaPendientes(ctx.historia).sort((a, b) => a.consulta.fecha.localeCompare(b.consulta.fecha)).at(-1);
  if (pendiente) return { tipo: 'pendiente', fecha: pendiente.consulta.fecha };
  const reciente = ecografiaReciente(ctx, consulta?.fecha ?? ctx.hoy);
  if (reciente) return { tipo: 'ecografia_reciente', fecha: reciente.fecha };
  return { tipo: 'generar', motivo: ev.motivoOrden, prioritaria: ev.prioritaria };
}

// ---------------------------------------------------------------- Reglas de alerta

const TITULO = {
  insuficientes: 'Altura uterina por debajo del percentil 10',
  descenso: 'Crecimiento fetal en descenso por altura uterina',
  sospecha_restriccion: 'Sospecha de restricción del crecimiento fetal',
} as const;

export const crecimientoFetal: Regla = {
  id: 'crecimiento_fetal',
  evaluar(ctx) {
    const ev = evaluarCrecimientoHasta(ctx);
    if (!ev.requiereOrden || !(ev.clase === 'insuficientes' || ev.clase === 'descenso' || ev.clase === 'sospecha_restriccion')) return null;
    const ultimoControl = ctx.seguimientos.filter((c) => c.fecha <= ctx.hoy).sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
    const decision = decidirOrden(ctx, ev, ultimoControl);
    const orden = ultimoControl?.ordenes?.paraclinicos.find((o) => o.automatica && !o.anulada);
    const estadoOrden =
      orden && decision.tipo === 'pendiente'
        ? `Se generó la orden de ecografía de crecimiento en el control del ${ultimoControl!.fecha}: registre su resultado cuando la traiga.`
        : decision.tipo === 'pendiente'
          ? `Hay una orden de ecografía pendiente del ${decision.fecha}: registre su resultado cuando la traiga.`
          : decision.tipo === 'ecografia_reciente'
            ? `Hay una ecografía registrada el ${decision.fecha}: no se genera otra orden. Revísela.`
            : decision.tipo === 'anulada'
              ? `La orden de ecografía se anuló: ${decision.motivo}`
              : 'Al guardar el control se genera la orden de ecografía de crecimiento.';
    return {
      titulo: TITULO[ev.clase],
      porque: [ev.frase, ...ev.notas, estadoOrden],
      severidad: ev.clase === 'sospecha_restriccion' ? 3 : ev.clase === 'descenso' ? 2 : 1,
      opciones: [{ etiqueta: 'Ecografía ordenada' }, { etiqueta: 'Referida' }, { etiqueta: 'No requiere acción', requiereMotivo: true }],
    };
  },
};

/** Una medición corregida cambió la clasificación de un control que ya había generado la orden: avisar, no anularla sola. */
export const crecimientoRevisarOrden: Regla = {
  id: 'crecimiento_revisar_orden',
  evaluar(ctx) {
    const pendientes = new Set(ordenesEcografiaPendientes(ctx.historia).map((p) => p.orden.id));
    const cambios = ctx.seguimientos.flatMap((c) =>
      (c.ordenes?.paraclinicos ?? [])
        .filter((o) => o.automatica && pendientes.has(o.id))
        .flatMap((o) => {
          const ahora = evaluarCrecimientoHasta(ctx, c.fecha);
          return ahora.requiereOrden ? [] : [`Control del ${c.fecha}: la orden se generó por "${o.automatica!.motivo}"; con los datos corregidos la clasificación es ahora: ${NOMBRE_CLASE[ahora.clase].toLowerCase()}.`];
        }),
    );
    if (!cambios.length) return null;
    return {
      titulo: 'Revise la orden de ecografía: la clasificación del crecimiento cambió',
      porque: [...cambios, 'La app no anula la orden sola: decida si sigue indicada y, si no, anúlela con el motivo.'],
      severidad: 1,
      opciones: [{ etiqueta: 'La orden sigue indicada' }, { etiqueta: 'Orden anulada' }],
    };
  },
};
