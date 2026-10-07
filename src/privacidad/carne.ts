// A3 / F4 — Capa de lectura restringida del carné.
// El carné nunca recibe la historia completa: solo esta proyección, armada con una lista
// explícita de datos permitidos. Un dato nuevo del modelo no llega al carné hasta que se
// agrega aquí a propósito. La misma proyección alimenta la vista previa, el carné web y el impreso.
import type { Catalogo } from '../clinico/catalogo';
import { construirContexto } from '../alertas/motor';
import { evaluarTrombo } from '../alertas/trombo';
import { valorDe } from '../datos/campo';
import type { Carne, FechaISO, TipoIndicacion } from '../datos/modelo';
import type { Historia } from '../datos/repositorio';
import { recordatorios } from '../recordatorios/recordatorios';

export const MENSAJE_CARNE_PAUSADO = 'Comunícate con tu servicio de salud.';

const INDICACIONES_EN_CARNE: TipoIndicacion[] = ['hierro', 'acidoFolico', 'calcio', 'asa', 'tromboprofilaxis'];

export type DatosCarne =
  | { estado: 'pausado'; mensaje: string }
  | {
      estado: 'activo';
      /** Fecha en que se armó el carné. */
      actualizado: FechaISO;
      nombre: string;
      semanas?: { semanas: number; dias: number };
      fpp?: FechaISO;
      proximaCita?: { fecha: FechaISO; lugar: string; queLlevar: string };
      indicaciones: TipoIndicacion[];
      senalesCoagulo: boolean;
      /** Si tiene tromboprofilaxis: qué hacer antes de un parto programado (texto del catálogo). */
      tromboAntesDelParto?: string;
      /** Exámenes pendientes en lenguaje sencillo (sin nombrar resultados). */
      examenesPendientes: string[];
      grupo?: string;
      rh?: string;
      vacunas: { antirrubeola?: string; antitetanicaDosisPrevias?: number };
      citas: { fecha: FechaISO; pesoKg?: number; presion?: string }[];
    };

export function proyectarCarne(historia: Historia, carne: Carne, hoy: FechaISO, catalogo: Catalogo): DatosCarne {
  if (carne.estado === 'pausado') return { estado: 'pausado', mensaje: MENSAJE_CARNE_PAUSADO };

  const ctx = construirContexto(historia, hoy, catalogo);
  const actual = ctx.primera?.gestacionActual;
  const cerradas = historia.consultas.filter((c) => c.cerrada);
  const ultima = cerradas[cerradas.length - 1];
  const indicaciones = historia.indicaciones
    .filter((i) => INDICACIONES_EN_CARNE.includes(i.tipo) && (i.estado === 'indicado' || i.estado === 'ya_lo_toma'))
    .map((i) => i.tipo);
  const trombo = evaluarTrombo(ctx);
  const umbralCoagulo = catalogo.valor('trombo.umbrales').desdeSemana28;

  return {
    estado: 'activo',
    actualizado: hoy,
    nombre: historia.gestante.nombres.split(' ')[0] ?? '',
    semanas: ctx.eg.estado === 'calculada' ? { semanas: ctx.eg.semanas, dias: ctx.eg.diasResto } : undefined,
    fpp: ctx.eg.estado === 'calculada' ? ctx.eg.fpp : undefined,
    proximaCita: valorDe(ultima?.proximaCita),
    indicaciones,
    senalesCoagulo: indicaciones.includes('tromboprofilaxis') || (trombo?.puntaje ?? 0) >= umbralCoagulo,
    tromboAntesDelParto: indicaciones.includes('tromboprofilaxis') ? catalogo.valor('trombo.suspensionAntesDelParto') ?? undefined : undefined,
    examenesPendientes: [...new Set(recordatorios(ctx).flatMap((r) => (r.paraGestante ? [r.paraGestante] : [])))],
    grupo: valorDe(actual?.grupo),
    rh: valorDe(actual?.rh),
    vacunas: {
      antirrubeola: valorDe(actual?.antirrubeola),
      antitetanicaDosisPrevias: valorDe(actual?.antitetanica)?.dosisPrevias,
    },
    citas: cerradas.map((c) => {
      const s = c.seguimiento;
      const pas = valorDe(s?.paSistolica);
      const pad = valorDe(s?.paDiastolica);
      return {
        fecha: c.fecha,
        pesoKg: valorDe(s?.pesoKg),
        presion: pas !== undefined && pad !== undefined ? `${pas}/${pad}` : undefined,
      };
    }),
  };
}
