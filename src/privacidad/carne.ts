// A3 / F4 — Capa de lectura restringida del carné.
// El carné nunca recibe la historia completa: solo esta proyección, armada con una lista
// explícita de datos permitidos. Un dato nuevo del modelo no llega al carné hasta que se
// agrega aquí a propósito. La misma proyección alimenta la vista previa, el carné web y el impreso.
import type { Catalogo } from '../clinico/catalogo';
import { construirContexto } from '../alertas/motor';
import { evaluarTrombo } from '../alertas/trombo';
import { evaluarASA } from '../alertas/asa';
import { evaluarCalcio } from '../alertas/calcio';
import { AVISO_REVISAR_MEDICAMENTO } from '../carne/textos';
import { valorDe } from '../datos/campo';
import type { Carne, FechaISO, TipoIndicacion } from '../datos/modelo';
import type { Historia } from '../datos/repositorio';
import { recordatorios } from '../recordatorios/recordatorios';
import { examenesPorTrimestre, type GrupoTrimestre } from '../examenes/porTrimestre';
import { grupoRh } from '../clinico/grupoRh';
import { ordenesEcografiaPendientes } from '../alertas/crecimientoHistoria';

/**
 * Aviso de la orden de ecografía que generó la app por el crecimiento: qué hacer y por qué, en
 * lenguaje simple. Nunca percentiles, probabilidades ni la palabra "restricción".
 */
const AVISO_CRECIMIENTO = {
  tendencia: 'Necesitas una ecografía antes de tu próximo control. En las últimas mediciones tu bebé creció menos de lo esperado y queremos verlo mejor. Lleva la orden que te entregaron.',
  una: 'Necesitas una ecografía antes de tu próximo control. En la última medición tu barriga midió menos de lo esperado y queremos ver mejor a tu bebé. Lleva la orden que te entregaron.',
};

export const MENSAJE_CARNE_PAUSADO = 'Comunícate con tu servicio de salud.';

const INDICACIONES_EN_CARNE: TipoIndicacion[] = ['hierro', 'acidoFolico', 'calcio', 'asa', 'tromboprofilaxis', 'levotiroxina', 'espiramicina', 'toxoTratamientoPleno'];

export type EstadoExamenCarne = 'hecho' | 'falta' | 'mas_adelante';
export interface ExamenCarne {
  texto: string;
  estado: EstadoExamenCarne;
  /** Fecha del último resultado del grupo, si todo está hecho. */
  fecha?: FechaISO;
}

/**
 * Exámenes por trimestre en el carné: grupos en lenguaje sencillo, solo hecho / te falta / más
 * adelante. Nunca el resultado, ni el nombre de exámenes sensibles (VIH, sífilis, hepatitis B):
 * van dentro de "exámenes de sangre".
 */
const EXAMENES_CARNE: { trimestre: 1 | 2 | 3; texto: string; incluye: (id: string) => boolean }[] = [
  { trimestre: 1, texto: 'Exámenes de sangre de ingreso', incluye: (id) => id.startsWith('ingreso:') && id !== 'ingreso:bacteriuria' },
  { trimestre: 1, texto: 'Urocultivo (examen de orina)', incluye: (id) => id === 'ingreso:bacteriuria' },
  { trimestre: 1, texto: 'Ecografía entre las semanas 10 y 13', incluye: (id) => id === 'eco_1t' },
  { trimestre: 2, texto: 'Exámenes de sangre del segundo trimestre', incluye: (id) => id.startsWith('segundo:') && !id.endsWith(':uroanalisis') },
  { trimestre: 2, texto: 'Uroanálisis (examen de orina)', incluye: (id) => id === 'segundo:uroanalisis' },
  { trimestre: 2, texto: 'Ecografía de detalle (semanas 18 a 23)', incluye: (id) => id === 'eco_detalle' },
  { trimestre: 2, texto: 'Prueba del azúcar (semanas 24 a 28)', incluye: (id) => id === 'ptog' },
  { trimestre: 3, texto: 'Exámenes de sangre del tercer trimestre (desde la semana 28)', incluye: (id) => id.startsWith('tercer:') && !id.endsWith(':uroanalisis') },
  { trimestre: 3, texto: 'Uroanálisis (examen de orina)', incluye: (id) => id === 'tercer:uroanalisis' },
  { trimestre: 3, texto: 'Ecografía del tercer trimestre', incluye: (id) => id === 'eco_3t' },
  { trimestre: 3, texto: 'Muestra para estreptococo B (semanas 35 a 37)', incluye: (id) => id === 'egb' },
  // La toxoplasmosis mensual aparece en el trimestre actual.
  ...([1, 2, 3] as const).map((t) => ({ trimestre: t, texto: 'Examen de sangre de cada mes (toxoplasmosis)', incluye: (id: string) => id === 'toxo_mensual' })),
];
const TITULO_TRIMESTRE = { 1: 'Primer trimestre', 2: 'Segundo trimestre', 3: 'Tercer trimestre' } as const;

function examenesCarne(grupos: GrupoTrimestre[]): { trimestre: 1 | 2 | 3; titulo: string; examenes: ExamenCarne[] }[] {
  return ([1, 2, 3] as const).map((t) => ({
    trimestre: t,
    titulo: TITULO_TRIMESTRE[t],
    examenes: EXAMENES_CARNE.filter((g) => g.trimestre === t).flatMap((g): ExamenCarne[] => {
      const filas = grupos.find((x) => x.trimestre === t)?.filas ?? [];
      const del = filas.filter((f) => g.incluye(f.id));
      if (del.length === 0) return [];
      if (del.every((f) => f.estado === 'hecho')) {
        const fecha = del.map((f) => f.resultado?.fecha ?? '').sort().at(-1) || undefined;
        return [{ texto: g.texto, estado: 'hecho', fecha }];
      }
      const falta = del.some((f) => f.estado === 'pendiente' || f.estado === 'atrasado');
      return [{ texto: g.texto, estado: falta ? 'falta' : 'mas_adelante' }];
    }),
  }));
}

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
      /** Avisos importantes: qué hacer y por qué, en lenguaje sencillo. */
      avisos: string[];
      /** Exámenes pendientes en lenguaje sencillo (sin nombrar resultados). */
      examenesPendientes: string[];
      /** Exámenes por trimestre: solo si están hechos, faltan o vienen más adelante. */
      examenesPorTrimestre: { trimestre: 1 | 2 | 3; titulo: string; examenes: ExamenCarne[] }[];
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
  // ASA o calcio con una contraindicación registrada que el profesional aún no valoró ("se mantiene"):
  // el carné no le dice que lo siga tomando y le pide consultar.
  // "Se mantiene" vale mientras la contraindicación sea la misma (misma variante), aunque la alerta
  // haya reaparecido solo porque subió la severidad.
  const mantenido = (regla: 'asa' | 'calcio') =>
    historia.alertas.some((a) => {
      if (a.regla !== regla || !a.vigente) return false;
      const ultima = a.decision ?? a.decisionesAnteriores?.at(-1);
      return ultima?.opcion === 'Valorado: se mantiene' && (ultima.varianteAtendida ?? null) === (a.variante ?? null);
    });
  const enRevision: ('asa' | 'calcio')[] = [];
  if ((evaluarASA(ctx)?.contraindicacion.length ?? 0) > 0 && !mantenido('asa')) enRevision.push('asa');
  if ((evaluarCalcio(ctx)?.contraindicaciones.length ?? 0) > 0 && !mantenido('calcio')) enRevision.push('calcio');
  const vigentes = historia.indicaciones.filter(
    (i) => INDICACIONES_EN_CARNE.includes(i.tipo) && (i.estado === 'indicado' || i.estado === 'ya_lo_toma'),
  );
  const enCurso = vigentes
    // La aspirina va hasta la semana 36: desde ahí deja de aparecer en el carné.
    .filter((i) => i.tipo !== 'asa' || ctx.eg.estado !== 'calculada' || ctx.eg.dias < catalogo.valor('asa.semanaFin') * 7);
  const avisosMedicamento = enRevision.filter((t) => enCurso.some((i) => i.tipo === t)).map((t) => AVISO_REVISAR_MEDICAMENTO[t]);
  const indicaciones = enCurso.filter((i) => !(enRevision as TipoIndicacion[]).includes(i.tipo)).map((i) => i.tipo);
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
    // Orden de ecografía por el crecimiento, mientras esté pendiente (desaparece al registrar la ecografía o si se anula).
    avisos: [
      ...avisosMedicamento,
      ...new Set(
        ordenesEcografiaPendientes(historia)
          .filter((p) => p.orden.automatica)
          .map((p) => (p.orden.automatica!.clase === 'insuficientes' ? AVISO_CRECIMIENTO.una : AVISO_CRECIMIENTO.tendencia)),
      ),
    ],
    examenesPendientes: [...new Set(recordatorios(ctx).flatMap((r) => (r.paraGestante ? [r.paraGestante] : [])))],
    examenesPorTrimestre: examenesCarne(examenesPorTrimestre(ctx)),
    // Hemoclasificación de laboratorio si la hay; si no, lo declarado.
    grupo: grupoRh(ctx.primera, historia.examenes).grupo,
    rh: grupoRh(ctx.primera, historia.examenes).rh,
    vacunas: {
      antirrubeola: valorDe(actual?.antirrubeola),
      antitetanicaDosisPrevias: valorDe(actual?.antitetanica)?.dosisPrevias,
    },
    citas: cerradas.map((c) => {
      const s = c.seguimiento;
      const pas = valorDe(s?.paSistolica ?? c.primera?.examenFisico?.paSistolica);
      const pad = valorDe(s?.paDiastolica ?? c.primera?.examenFisico?.paDiastolica);
      return {
        fecha: c.fecha,
        pesoKg: valorDe(s?.pesoKg),
        presion: pas !== undefined && pad !== undefined ? `${pas}/${pad}` : undefined,
      };
    }),
  };
}
