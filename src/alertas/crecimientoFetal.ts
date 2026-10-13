// Crecimiento fetal por altura uterina (spec "Alerta de restricción del crecimiento por altura uterina").
// En vez de mirar una sola medición contra el percentil 10, mira la secuencia: cada altura uterina se
// pasa a puntaje z de la curva del CLAP y se ajusta una recta (regresión bayesiana con el error de la
// cinta métrica como ruido conocido). De la pendiente sale la probabilidad de que el feto se esté
// cayendo de su carril; de la recta, el tamaño estimado hoy y la proyección a dos semanas. Las
// ecografías con percentiles de peso fetal o circunferencia abdominal pueden pasar directo a sospecha.
// No diagnostica restricción: solo prioriza la remisión a ecografía.
import type { Catalogo } from '../clinico/catalogo';
import type { FechaISO } from '../datos/modelo';

export type ClaseCrecimiento = 'no_aplica' | 'insuficientes' | 'adecuado' | 'pequeno_estable' | 'descenso' | 'sospecha_restriccion';

export const NOMBRE_CLASE: Record<ClaseCrecimiento, string> = {
  no_aplica: 'No aplica (embarazo múltiple)',
  insuficientes: 'Datos insuficientes',
  adecuado: 'Crecimiento adecuado',
  pequeno_estable: 'Pequeño estable',
  descenso: 'Crecimiento en descenso',
  sospecha_restriccion: 'Sospecha de restricción',
};

export interface MedicionAU {
  fecha: FechaISO;
  egDias: number;
  cm: number;
}

export interface EcografiaCrecimiento {
  fecha: FechaISO;
  pfePercentil?: number;
  caPercentil?: number;
  fetos?: number;
}

export interface EntradaCrecimiento {
  mediciones: MedicionAU[];
  ecografias: EcografiaCrecimiento[];
  /** EG por FUM no confirmada y sin ecografía temprana. */
  egPocoConfiable?: boolean;
  /** Condiciones registradas que alteran la altura uterina (polihidramnios, miomas, obesidad, presentación transversa). */
  condiciones?: string[];
}

export interface PuntoEstimado {
  egDias: number;
  cm: number;
  bajo: number;
  alto: number;
}

export interface MedicionClasificada extends MedicionAU {
  p10: number;
  p50: number;
  p90: number;
  percentil: number;
}

export interface EvaluacionCrecimiento {
  clase: ClaseCrecimiento;
  /** Frase clínica que explica la clasificación. */
  frase: string;
  /** Avisos sobre la confiabilidad (EG, condiciones, ecografías sin percentil, mediciones fuera de rango). */
  notas: string[];
  mediciones: MedicionClasificada[];
  /** Mediciones guardadas que no se clasifican (fuera del rango de la curva del CLAP). */
  fueraDeRango: MedicionAU[];
  /** Crecimiento estimado en las semanas de la ventana, con su margen (intervalo del 80 %). */
  trayectoria: PuntoEstimado[];
  proyeccion?: PuntoEstimado;
  probDescenso?: number;
  /** Regla clásica: la última medición está bajo el percentil 10. */
  ultimaBajoP10: boolean;
  /** Se debe generar la orden de ecografía de crecimiento. */
  requiereOrden: boolean;
  prioritaria: boolean;
  motivoOrden?: string;
}

// ---------------------------------------------------------------- Curva del CLAP y estadística

const Z10 = 1.2815515655446004;
/** Mitad del intervalo del 80 % para el margen del crecimiento estimado. */
const Z80 = Z10;

/** Función de distribución normal estándar (Abramowitz y Stegun 7.1.26). */
export function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Percentiles 10, 50 y 90 de la curva del CLAP para una EG en días (interpolados entre semanas). */
export function curvaAU(catalogo: Catalogo, egDias: number): { p10: number; p50: number; p90: number; de: number } | undefined {
  const tabla = catalogo.valor('au.percentiles');
  const semanas = Object.keys(tabla).map(Number).sort((a, b) => a - b);
  const s = egDias / 7;
  if (s < semanas[0]! || s > semanas.at(-1)!) return undefined;
  const baja = Math.floor(s);
  const alta = Math.min(baja + 1, semanas.at(-1)!);
  const a = tabla[baja]!;
  const b = tabla[alta]!;
  const f = s - baja;
  const p10 = a.p10 + (b.p10 - a.p10) * f;
  const p90 = a.p90 + (b.p90 - a.p90) * f;
  // La curva da los percentiles 10 y 90: se asume distribución normal entre ellos.
  return { p10, p90, p50: (p10 + p90) / 2, de: (p90 - p10) / (2 * Z10) };
}

const redondear = (x: number) => Math.round(x * 10) / 10;
const pct = (z: number) => Math.min(99, Math.max(1, Math.round(phi(z) * 100)));
const semana = (dias: number) => Math.floor(dias / 7);

/**
 * Recta del puntaje z en el tiempo (semanas, centradas en la última medición): intercepto libre y
 * pendiente con previa normal de media 0. Devuelve la media y la covarianza de (intercepto, pendiente).
 */
function ajustar(puntos: { t: number; z: number; varianza: number }[], previaPendiente: number) {
  let s00 = 0;
  let s01 = 0;
  let s11 = 1 / (previaPendiente * previaPendiente);
  let b0 = 0;
  let b1 = 0;
  for (const p of puntos) {
    const w = 1 / p.varianza;
    s00 += w;
    s01 += w * p.t;
    s11 += w * p.t * p.t;
    b0 += w * p.z;
    b1 += w * p.z * p.t;
  }
  const det = s00 * s11 - s01 * s01;
  const v00 = s11 / det;
  const v01 = -s01 / det;
  const v11 = s00 / det;
  return { a: v00 * b0 + v01 * b1, b: v01 * b0 + v11 * b1, v00, v01, v11 };
}

// ---------------------------------------------------------------- Clasificación

export function evaluarCrecimiento(e: EntradaCrecimiento, catalogo: Catalogo): EvaluacionCrecimiento {
  const cfg = catalogo.valor('crecimiento.au');
  const notas: string[] = [];
  const ordenadas = [...e.mediciones].sort((a, b) => a.egDias - b.egDias);
  const mediciones: MedicionClasificada[] = [];
  const fueraDeRango: MedicionAU[] = [];
  for (const m of ordenadas) {
    const c = curvaAU(catalogo, m.egDias);
    if (!c) fueraDeRango.push(m);
    else mediciones.push({ ...m, p10: redondear(c.p10), p50: redondear(c.p50), p90: redondear(c.p90), percentil: pct((m.cm - c.p50) / c.de) });
  }
  const ultima = mediciones.at(-1);
  const ultimaBajoP10 = ultima !== undefined && ultima.cm < ultima.p10;
  const base = { mediciones, fueraDeRango, trayectoria: [] as PuntoEstimado[], ultimaBajoP10, notas };

  if (e.ecografias.some((x) => (x.fetos ?? 1) >= 2)) {
    return {
      ...base,
      clase: 'no_aplica',
      frase: 'Embarazo múltiple: la curva de altura uterina del CLAP no aplica. El seguimiento del crecimiento debe hacerse por ecografía.',
      ultimaBajoP10: false,
      requiereOrden: false,
      prioritaria: false,
    };
  }

  if (e.egPocoConfiable) notas.push('Edad gestacional por FUM no confirmada: la clasificación es menos confiable.');
  if (e.condiciones?.length) notas.push(`Registrado: ${e.condiciones.join(', ')}. La altura uterina es menos confiable: apóyese en la ecografía.`);
  if (fueraDeRango.length) notas.push(`Mediciones fuera del rango de la curva del CLAP (se guardan pero no se clasifican): ${fueraDeRango.length}.`);

  // Ecografía con percentiles: la más reciente que traiga alguno.
  const { pfePercentilCorte, caPercentilCorte } = catalogo.valor('crecimiento.ecografia');
  const ecos = [...e.ecografias].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const x of ecos.filter((x) => x.pfePercentil === undefined && x.caPercentil === undefined)) {
    notas.push(`La ecografía del ${x.fecha} no trae percentil de peso fetal ni de circunferencia abdominal: no se usa en la clasificación.`);
  }
  const eco = ecos.filter((x) => x.pfePercentil !== undefined || x.caPercentil !== undefined).at(-1);
  const pfeBajo = eco?.pfePercentil !== undefined && eco.pfePercentil < pfePercentilCorte;
  const caBaja = eco?.caPercentil !== undefined && eco.caPercentil < caPercentilCorte;
  const fraseEco =
    eco && (pfeBajo || caBaja)
      ? `Ecografía del ${eco.fecha}: ${[
          pfeBajo ? `peso fetal estimado en el percentil ${eco.pfePercentil} (corte: ${pfePercentilCorte})` : '',
          caBaja ? `circunferencia abdominal en el percentil ${eco.caPercentil} (corte: ${caPercentilCorte})` : '',
        ]
          .filter(Boolean)
          .join('; ')}.`
      : undefined;
  const motivoEco = fraseEco && `Sospecha de restricción del crecimiento fetal. ${fraseEco}`;

  if (mediciones.length < cfg.minimoMediciones) {
    const primeraSemana = Math.min(...Object.keys(catalogo.valor('au.percentiles')).map(Number));
    const frase = [
      `Mediciones de altura uterina desde la semana ${primeraSemana}: ${mediciones.length}. Se necesitan ${cfg.minimoMediciones} para ver la tendencia.`,
      ultimaBajoP10 ? `La última (${String(ultima!.cm).replace('.', ',')} cm en la semana ${semana(ultima!.egDias)}) está bajo el percentil 10: se aplica la regla clásica.` : '',
      fraseEco ?? '',
    ]
      .filter(Boolean)
      .join(' ');
    if (motivoEco) return { ...base, clase: 'sospecha_restriccion', frase, requiereOrden: true, prioritaria: true, motivoOrden: motivoEco };
    return {
      ...base,
      clase: 'insuficientes',
      frase,
      requiereOrden: ultimaBajoP10,
      prioritaria: false,
      motivoOrden: ultimaBajoP10 ? `Altura uterina bajo el percentil 10 (curva del CLAP) en la semana ${semana(ultima!.egDias)}.` : undefined,
    };
  }

  // Ventana: las mediciones de las últimas semanas (al menos las mínimas).
  const tUltima = ultima!.egDias / 7;
  const enVentana = mediciones.filter((m) => tUltima - m.egDias / 7 <= cfg.ventanaSemanas);
  const ventana = enVentana.length >= cfg.minimoMediciones ? enVentana : mediciones.slice(-cfg.minimoMediciones);
  const puntos = ventana.map((m) => {
    const c = curvaAU(catalogo, m.egDias)!;
    return { t: m.egDias / 7 - tUltima, z: (m.cm - c.p50) / c.de, varianza: (cfg.errorMedicionCm / c.de) ** 2 };
  });
  const r = ajustar(puntos, cfg.pendientePreviaZSemana);
  const probDescenso = 1 - phi((r.b + cfg.caidaMinimaZSemana) / Math.sqrt(r.v11));

  const estimado = (t: number): PuntoEstimado | undefined => {
    const egDias = Math.round((tUltima + t) * 7);
    const c = curvaAU(catalogo, egDias);
    if (!c) return undefined;
    const z = r.a + r.b * t;
    const de = Math.sqrt(r.v00 + 2 * t * r.v01 + t * t * r.v11);
    return { egDias, cm: redondear(c.p50 + z * c.de), bajo: redondear(c.p50 + (z - Z80 * de) * c.de), alto: redondear(c.p50 + (z + Z80 * de) * c.de) };
  };
  const t0 = puntos[0]!.t;
  const trayectoria: PuntoEstimado[] = [];
  for (let t = t0; t < 0; t += 0.5) {
    const p = estimado(t);
    if (p) trayectoria.push(p);
  }
  const hoy = estimado(0);
  if (hoy) trayectoria.push(hoy);
  const proyeccion = estimado(cfg.proyeccionSemanas);
  const zProyeccion = r.a + r.b * cfg.proyeccionSemanas;
  const percentilInicio = pct(r.a + r.b * t0);
  const percentilActual = pct(r.a);
  const semanasVentana = Math.round(-t0);
  const textoProb = `Probabilidad de descenso: ${Math.round(probDescenso * 100)} %.`;

  // Si el catálogo exige confirmar el descenso en dos controles seguidos, se evalúa sin la última medición.
  let descenso = probDescenso >= cfg.limiteProbabilidad;
  if (descenso && cfg.confirmarEnDosControles) {
    const previa = evaluarCrecimiento({ ...e, mediciones: ordenadas.slice(0, -1), ecografias: [] }, catalogo);
    descenso = (previa.probDescenso ?? 0) >= cfg.limiteProbabilidad;
  }
  const conTendencia = { ...base, trayectoria, proyeccion, probDescenso };
  const desdeSemana = semana(ventana[0]!.egDias);
  const fraseDescenso = `Bajó del percentil ${percentilInicio} al ${percentilActual} en ${semanasVentana} semanas. ${textoProb}`;

  if (motivoEco || (descenso && zProyeccion < -Z10)) {
    const partes = [descenso ? fraseDescenso : '', descenso ? `Proyección a ${cfg.proyeccionSemanas} semanas: percentil ${pct(zProyeccion)}.` : '', fraseEco ?? ''];
    return {
      ...conTendencia,
      clase: 'sospecha_restriccion',
      frase: partes.filter(Boolean).join(' '),
      requiereOrden: true,
      prioritaria: true,
      motivoOrden:
        motivoEco ?? `Sospecha de restricción del crecimiento fetal: descenso por altura uterina desde la semana ${desdeSemana}, con proyección bajo el percentil 10.`,
    };
  }
  if (descenso) {
    return {
      ...conTendencia,
      clase: 'descenso',
      frase: fraseDescenso,
      requiereOrden: true,
      prioritaria: false,
      motivoOrden: `Descenso del crecimiento por altura uterina desde la semana ${desdeSemana}.`,
    };
  }
  if (r.a < -Z10) {
    return {
      ...conTendencia,
      clase: 'pequeno_estable',
      frase: `Tamaño estimado en el percentil ${percentilActual}, sin descenso en ${semanasVentana} semanas. ${textoProb} Mantenga la medición en cada control.`,
      requiereOrden: false,
      prioritaria: false,
    };
  }
  return {
    ...conTendencia,
    clase: 'adecuado',
    frase: `Se mantiene en su carril: percentil ${percentilInicio} hace ${semanasVentana} semanas y ${percentilActual} hoy. ${textoProb}`,
    requiereOrden: false,
    prioritaria: false,
  };
}
