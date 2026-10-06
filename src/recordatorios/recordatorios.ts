// F1 — Recordatorios por semana: qué exámenes y acciones tocan según la EG y lo ya registrado.
// Un pendiente que ya pasó su ventana aparece como "atrasado".
import { trimestreDeEG } from '../clinico/trimestre';
import { valorDe } from '../datos/campo';
import type { TipoExamen, TipoIndicacion } from '../datos/modelo';
import type { ContextoClinico } from '../alertas/motor';
import { ultimaHb } from '../alertas/anemia';
import { evaluarAntitetanica } from '../alertas/antitetanica';

export interface Recordatorio {
  id: string;
  texto: string;
  estado: 'pendiente' | 'atrasado';
  tipo: 'examen' | 'accion' | 'pregunta';
  /** Texto sencillo para el carné de la gestante (solo exámenes). Nunca nombra resultados. */
  paraGestante?: string;
}

const NOMBRE_EXAMEN: Partial<Record<TipoExamen, string>> = {
  hb: 'Hemoglobina',
  vdrl: 'VDRL/RPR',
  vih: 'VIH',
  bacteriuria: 'Urocultivo (bacteriuria)',
  toxoplasmosis: 'Toxoplasmosis',
  chagas: 'Chagas',
  malaria: 'Malaria',
};

const SANGRE = 'Exámenes de sangre del control prenatal.';
const PARA_GESTANTE: Partial<Record<TipoExamen, string>> = {
  hb: SANGRE,
  vdrl: SANGRE,
  vih: SANGRE,
  toxoplasmosis: SANGRE,
  chagas: SANGRE,
  malaria: SANGRE,
  ferritina: SANGRE,
  bacteriuria: 'Examen de orina.',
  ptog: 'Entre las semanas 24 y 28 te harán la prueba del azúcar. Ve en ayunas: te toman sangre, te dan una bebida dulce y te vuelven a tomar sangre a la hora y a las 2 horas.',
  egb: 'Entre las semanas 35 y 37 te tomarán una muestra para buscar una bacteria (estreptococo B).',
};

export function recordatorios(ctx: ContextoClinico): Recordatorio[] {
  const { catalogo, eg, historia, primera } = ctx;
  const lista: Recordatorio[] = [];
  if (!primera) return lista;
  const v = catalogo.valor('recordatorios.ventanas');
  const egDias = eg.estado === 'calculada' ? eg.dias : undefined;
  const desde = (semana: number) => egDias !== undefined && egDias >= semana * 7;
  const vencida = (hasta: number | null) => hasta !== null && egDias !== undefined && egDias >= (hasta + 1) * 7;
  const estadoEn = (hasta: number | null): Recordatorio['estado'] => (vencida(hasta) ? 'atrasado' : 'pendiente');

  const hechoDesde = (tipo: TipoExamen, semana: number) =>
    historia.examenes.some((e) => {
      if (e.tipo !== tipo || e.resultado.estado !== 'valor') return false;
      const d = ctx.egEn(e.fecha);
      return semana === 0 || (d !== undefined && d >= semana * 7);
    });
  const indicacion = (tipo: TipoIndicacion) => historia.indicaciones.find((i) => i.tipo === tipo);
  const vigente = (tipo: TipoIndicacion) => ['indicado', 'ya_lo_toma'].includes(indicacion(tipo)?.estado ?? '');
  const alertaActiva = (regla: string) => historia.alertas.some((a) => a.regla === regla && a.activa);

  const examen = (id: string, tipo: TipoExamen, texto: string, hasta: number | null) =>
    lista.push({ id, texto, tipo: 'examen', estado: estadoEn(hasta), paraGestante: PARA_GESTANTE[tipo] });

  // EG no confiable
  if (eg.estado !== 'calculada' || !eg.confiable) {
    lista.push({ id: 'ecografia', texto: 'EG no confiable: solicitar ecografía.', tipo: 'examen', estado: 'pendiente', paraGestante: 'Ecografía.' });
  }

  // Primera consulta
  const ventanaInicial = v.examenesPrimeraConsulta!;
  for (const tipo of catalogo.valor('recordatorios.examenesPrimeraConsulta') as TipoExamen[]) {
    if (!hechoDesde(tipo, 0)) examen(`inicial:${tipo}`, tipo, `${NOMBRE_EXAMEN[tipo] ?? tipo} (primera consulta).`, ventanaInicial.hastaSemana);
  }
  if (!valorDe(primera.gestacionActual.grupo) || !valorDe(primera.gestacionActual.rh)) {
    lista.push({ id: 'grupo_rh', texto: 'Grupo sanguíneo y Rh.', tipo: 'examen', estado: estadoEn(ventanaInicial.hastaSemana), paraGestante: SANGRE });
  }
  const antitetanica = valorDe(primera.gestacionActual.antitetanica);
  if (!antitetanica) {
    lista.push({ id: 'antitetanica', texto: 'Registrar el esquema antitetánico.', tipo: 'accion', estado: 'pendiente' });
  } else {
    const at = evaluarAntitetanica(antitetanica, ctx.hoy, catalogo, eg.estado === 'calculada' ? eg.fpp : undefined);
    const aplicada = historia.alertas.some((a) => a.regla === 'antitetanica' && a.decision?.opcion === 'Dosis aplicada');
    if (!at.vigente && !aplicada) lista.push({ id: 'antitetanica', texto: `Aplicar antitetánica (${at.dosisAAplicar} dosis).`, tipo: 'accion', estado: 'pendiente' });
  }
  if (!indicacion('hierro') || !indicacion('acidoFolico')) {
    lista.push({ id: 'hierro_folico', texto: 'Indicar hierro y ácido fólico.', tipo: 'accion', estado: 'pendiente' });
  }
  if (primera.gestacionActual.examenOdontologico.estado === 'vacio') lista.push({ id: 'odontologico', texto: 'Examen odontológico.', tipo: 'accion', estado: 'pendiente' });
  if (primera.gestacionActual.examenMamas.estado === 'vacio') lista.push({ id: 'mamas', texto: 'Examen de mamas.', tipo: 'accion', estado: 'pendiente' });

  // Anemia sin ferritina (D2)
  const hb = ultimaHb(ctx);
  if (hb && hb.grado !== 'sin_anemia' && !ctx.ultimo('ferritina')) {
    lista.push({ id: 'ferritina', texto: 'Solicitar ferritina sérica (anemia).', tipo: 'examen', estado: 'pendiente', paraGestante: SANGRE });
  }

  // Decisiones de ASA (semana 12) y calcio (semana 14) sin tomar
  if (alertaActiva('asa')) lista.push({ id: 'asa', texto: 'Decidir sobre el ASA (criterio de preeclampsia).', tipo: 'accion', estado: 'pendiente' });
  if (alertaActiva('calcio')) lista.push({ id: 'calcio', texto: 'Decidir sobre el carbonato de calcio (desde la semana 14).', tipo: 'accion', estado: 'pendiente' });

  // Después de la semana 20
  const tras20 = v.examenesDespuesDe20!;
  if (desde(tras20.desdeSemana)) {
    for (const tipo of ['hb', 'vih', 'vdrl'] as const) {
      if (!hechoDesde(tipo, tras20.desdeSemana)) examen(`tras20:${tipo}`, tipo, `${NOMBRE_EXAMEN[tipo]} después de la semana 20.`, tras20.hastaSemana);
    }
  }

  // PTOG 24–28
  const vPtog = v.ptog!;
  if (desde(vPtog.desdeSemana) && !ctx.ultimo('ptog')) {
    examen('ptog', 'ptog', `PTOG de 75 g (semanas ${vPtog.desdeSemana} a ${vPtog.hastaSemana}).`, vPtog.hastaSemana);
  }

  // Semana 28: reevaluar el riesgo trombótico
  const v28 = v.reevaluacionTrombotica!;
  if (desde(v28.desdeSemana)) {
    const reevaluado = ctx.seguimientos.some((c) => (ctx.egEn(c.fecha) ?? -1) >= v28.desdeSemana * 7);
    if (!reevaluado) {
      lista.push({ id: 'trombo28', texto: 'Semana 28: reevaluar el riesgo trombótico (y recordar el inicio si el puntaje era 3).', tipo: 'accion', estado: estadoEn(v28.hastaSemana) });
    }
  }

  // Estreptococo B 35–37
  const vEgb = v.egb!;
  if (desde(vEgb.desdeSemana) && !hechoDesde('egb', vEgb.desdeSemana)) {
    examen('egb', 'egb', `Estreptococo B (semanas ${vEgb.desdeSemana} a ${vEgb.hastaSemana}).`, vEgb.hastaSemana);
  }

  // Factores transitorios activos
  for (const f of historia.factores.filter((f) => !f.resolucion)) {
    lista.push({ id: `factor:${f.id}`, texto: `Preguntar si ya se resolvió el factor transitorio (desde ${f.inicio}) para calcular la fecha de suspensión.`, tipo: 'pregunta', estado: 'pendiente' });
  }

  // Adherencia en cada control
  if (vigente('calcio')) lista.push({ id: 'adh:calcio', texto: 'Preguntar si toma el calcio todos los días.', tipo: 'pregunta', estado: 'pendiente' });
  if (vigente('asa')) lista.push({ id: 'adh:asa', texto: 'Preguntar si toma la aspirina todos los días.', tipo: 'pregunta', estado: 'pendiente' });
  if (vigente('tromboprofilaxis')) lista.push({ id: 'adh:trombo', texto: 'Preguntar si se aplica la tromboprofilaxis todos los días.', tipo: 'pregunta', estado: 'pendiente' });

  // Cada trimestre: tabaco, alcohol y violencia
  if (egDias !== undefined) {
    const trimestre = trimestreDeEG(egDias, catalogo);
    const enTrimestre = (fecha: string) => {
      const d = ctx.egEn(fecha);
      return d !== undefined && d >= 0 && trimestreDeEG(d, catalogo) === trimestre;
    };
    const primeraFecha = historia.consultas.find((c) => c.tipo === 'primera')?.fecha;
    const preguntado =
      (primeraFecha !== undefined && enTrimestre(primeraFecha)) ||
      ctx.seguimientos.some((c) => enTrimestre(c.fecha) && valorDe(c.seguimiento?.tamizajeTrimestral) === true);
    if (!preguntado) lista.push({ id: `tamizaje:${trimestre}`, texto: 'Preguntar en este trimestre por tabaco, alcohol y violencia (ofrecer un momento a solas).', tipo: 'pregunta', estado: 'pendiente' });
  }

  // Durante el control
  if (!indicacion('preparacionParto')) lista.push({ id: 'preparacion', texto: 'Preparación para el parto.', tipo: 'accion', estado: 'pendiente' });
  if (!indicacion('lactancia')) lista.push({ id: 'lactancia', texto: 'Consejería en lactancia.', tipo: 'accion', estado: 'pendiente' });

  return lista.sort((a, b) => Number(b.estado === 'atrasado') - Number(a.estado === 'atrasado'));
}
