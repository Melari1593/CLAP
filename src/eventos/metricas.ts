// G2 — Cada métrica de "Éxito" del spec, calculada solo con los eventos registrados.
import type { CanalEnvio } from '../datos/modelo';
import type { Evento, TipoEvento } from './eventos';

export interface Proporcion {
  numerador: number;
  denominador: number;
  /** null si no hay denominador. */
  valor: number | null;
}

const proporcion = (numerador: number, denominador: number): Proporcion => ({
  numerador,
  denominador,
  valor: denominador === 0 ? null : numerador / denominador,
});

type De<T extends TipoEvento> = Extract<Evento, { tipo: T }>;
const dia = (iso: string) => iso.slice(0, 10);

function porEmbarazo(eventos: Evento[]): Map<string, Evento[]> {
  const mapa = new Map<string, Evento[]>();
  for (const e of [...eventos].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))) {
    mapa.set(e.embarazoId, [...(mapa.get(e.embarazoId) ?? []), e]);
  }
  return mapa;
}
const de = <T extends TipoEvento>(lista: Evento[], tipo: T) => lista.filter((e): e is De<T> => e.tipo === tipo);

/** Intervalos entre una consulta cerrada y la siguiente. */
function intervalos(lista: Evento[]) {
  const cierres = de(lista, 'consulta_cerrada');
  return cierres.slice(1).map((fin, i) => ({ desde: cierres[i]!, hasta: fin }));
}

/** "El carné se usa": intervalos entre consultas con al menos una apertura del carné, por canal. */
export function usoDelCarne(eventos: Evento[], canal: CanalEnvio = 'whatsapp') {
  let conApertura = 0;
  let total = 0;
  let gestantesQueAbren = 0;
  let gestantes = 0;
  for (const lista of porEmbarazo(eventos).values()) {
    const envio = de(lista, 'carne_enviado').at(-1);
    if (envio?.canal !== canal) continue;
    const aperturas = de(lista, 'carne_abierto');
    const tramos = intervalos(lista);
    if (tramos.length === 0) continue;
    gestantes++;
    let abrio = false;
    for (const t of tramos) {
      total++;
      if (aperturas.some((a) => a.fechaHora > t.desde.fechaHora && a.fechaHora <= t.hasta.fechaHora)) {
        conApertura++;
        abrio = true;
      }
    }
    if (abrio) gestantesQueAbren++;
  }
  return { intervalos: proporcion(conApertura, total), gestantes: proporcion(gestantesQueAbren, gestantes) };
}

/** "Llegan preparadas": exámenes pendientes al cerrar una consulta que se registraron antes de cerrar la siguiente. */
export function llegadaPreparada(eventos: Evento[]): Proporcion {
  let traidos = 0;
  let pendientes = 0;
  for (const lista of porEmbarazo(eventos).values()) {
    const examenes = de(lista, 'examen_registrado');
    for (const { desde, hasta } of intervalos(lista)) {
      for (const tipo of new Set(desde.examenesPendientes)) {
        pendientes++;
        if (examenes.some((x) => x.examen === tipo && x.fechaHora > desde.fechaHora && x.fechaHora <= hasta.fechaHora)) traidos++;
      }
    }
  }
  return proporcion(traidos, pendientes);
}

/** "El profesional no pierde tiempo": mediana de la duración de las consultas (en minutos). */
export function duracionConsultas(eventos: Evento[], tipo: 'primera' | 'seguimiento' = 'seguimiento') {
  const minutos = de(eventos, 'consulta_cerrada')
    .filter((e) => e.consultaTipo === tipo && e.duracionSegundos !== undefined)
    .map((e) => e.duracionSegundos! / 60)
    .sort((a, b) => a - b);
  const n = minutos.length;
  const mediana = n === 0 ? null : n % 2 ? minutos[(n - 1) / 2]! : (minutos[n / 2 - 1]! + minutos[n / 2]!) / 2;
  return { consultas: n, medianaMinutos: mediana };
}

/** "No se escapan alertas": cuántas veces se activó cada regla (insumo de la revisión de historias). */
export function alertasPorRegla(eventos: Evento[]): Record<string, number> {
  const cuenta: Record<string, number> = {};
  for (const e of de(eventos, 'alerta_activada')) cuenta[e.regla] = (cuenta[e.regla] ?? 0) + 1;
  return cuenta;
}

/** "ASA a tiempo": con criterio desde la semana 12, decisión registrada el mismo día en que apareció la alerta. */
export function asaATiempo(eventos: Evento[]): Proporcion {
  let conDecision = 0;
  let conCriterio = 0;
  for (const lista of porEmbarazo(eventos).values()) {
    const activacion = de(lista, 'alerta_activada').find((e) => e.regla === 'asa');
    if (!activacion) continue;
    conCriterio++;
    if (de(lista, 'alerta_decidida').some((d) => d.regla === 'asa' && dia(d.fechaHora) === dia(activacion.fechaHora))) conDecision++;
  }
  return proporcion(conDecision, conCriterio);
}

/** "PTOG a tiempo": entre las gestantes que llegaron a la semana 29, PTOG registrada entre las semanas 24 y 28. */
export function ptogATiempo(eventos: Evento[], ventana = { desdeSemana: 24, hastaSemana: 28 }): Proporcion {
  let aTiempo = 0;
  let llegaron = 0;
  for (const lista of porEmbarazo(eventos).values()) {
    if (!de(lista, 'consulta_cerrada').some((c) => (c.egDias ?? -1) >= (ventana.hastaSemana + 1) * 7)) continue;
    llegaron++;
    const ok = de(lista, 'examen_registrado').some(
      (x) => x.examen === 'ptog' && x.egDias !== null && x.egDias >= ventana.desdeSemana * 7 && x.egDias < (ventana.hastaSemana + 1) * 7,
    );
    if (ok) aTiempo++;
  }
  return proporcion(aTiempo, llegaron);
}

/** "Asesoría de opciones a tiempo" y remisión de la IVE el mismo día. */
export function asesoriaATiempo(eventos: Evento[]) {
  let asesoradas = 0;
  let conAlerta = 0;
  let remitidas = 0;
  let solicitudes = 0;
  for (const lista of porEmbarazo(eventos).values()) {
    const alerta = de(lista, 'alerta_activada').find((e) => e.regla === 'no_planeado' && e.urgente);
    const registros = de(lista, 'derechos_registrado');
    if (alerta) {
      conAlerta++;
      if (registros.some((r) => dia(r.fechaHora) === dia(alerta.fechaHora))) asesoradas++;
    }
    for (const r of registros.filter((x) => x.decision === 'solicita_ive')) {
      solicitudes++;
      const remisionPosterior = de(lista, 'remision_registrada').some((x) => x.mismoDiaQueLaSolicitud && x.fechaHora >= r.fechaHora);
      if (r.remisionMismoDia || remisionPosterior) remitidas++;
    }
  }
  return { asesoria: proporcion(asesoradas, conAlerta), remisionMismoDia: proporcion(remitidas, solicitudes) };
}

/** "Ruta activada": menor de 14 o violencia sexual con la activación de la ruta registrada. */
export function rutaActivada(eventos: Evento[]): Proporcion {
  let activadas = 0;
  let casos = 0;
  for (const lista of porEmbarazo(eventos).values()) {
    const alerta = de(lista, 'alerta_activada').some((e) => e.urgente && (e.regla === 'menor_14' || e.regla === 'violencia'));
    if (!alerta) continue;
    casos++;
    if (de(lista, 'ruta_activada').length > 0) activadas++;
  }
  return proporcion(activadas, casos);
}

/** "Riesgo trombótico evaluado": en la primera consulta, en la semana 28 y con decisión cuando hay criterio. */
export function riesgoTromboticoEvaluado(eventos: Evento[]) {
  let primera = 0;
  let conPrimera = 0;
  let semana28 = 0;
  let llegaron28 = 0;
  let decididas = 0;
  let conCriterio = 0;
  for (const lista of porEmbarazo(eventos).values()) {
    const cierres = de(lista, 'consulta_cerrada');
    const p = cierres.find((c) => c.consultaTipo === 'primera');
    if (p) {
      conPrimera++;
      if (p.puntajeTrombotico !== undefined) primera++;
    }
    const desde28 = cierres.filter((c) => (c.egDias ?? -1) >= 28 * 7);
    if (desde28.length > 0) {
      llegaron28++;
      if (desde28.some((c) => c.puntajeTrombotico !== undefined)) semana28++;
    }
    if (de(lista, 'alerta_activada').some((e) => e.regla === 'tromboprofilaxis')) {
      conCriterio++;
      if (de(lista, 'alerta_decidida').some((d) => d.regla === 'tromboprofilaxis')) decididas++;
    }
  }
  return {
    primeraConsulta: proporcion(primera, conPrimera),
    semana28: proporcion(semana28, llegaron28),
    decisionConCriterio: proporcion(decididas, conCriterio),
  };
}

/** "La gestante entiende": sabe su próxima cita y al menos dos signos de alarma. */
export function comprension(eventos: Evento[]): Proporcion {
  const respuestas = de(eventos, 'comprension');
  return proporcion(respuestas.filter((r) => r.sabeProximaCita && r.signosAlarma >= 2).length, respuestas.length);
}
