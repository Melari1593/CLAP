// C1 — Motor genérico de alertas y decisiones.
// Evalúa todas las reglas cada vez que cambia un dato. Una alerta queda activa hasta que el
// profesional registra una decisión; si después la regla da un resultado peor, o una situación
// clínica distinta (otra variante), avisa de nuevo.
// Nunca impide guardar: se ejecuta después del guardado.
import type { Catalogo } from '../clinico/catalogo';
import { diasEntre, edad, edadGestacional, type EdadGestacional } from '../clinico/calculos';
import { valorDe } from '../datos/campo';
import type {
  Alerta,
  Consulta,
  DatosPrimeraConsulta,
  FechaISO,
  OpcionDecision,
  ResultadoExamen,
  ResultadoPorTipo,
  TipoExamen,
} from '../datos/modelo';
import type { Historia, Repositorio } from '../datos/repositorio';
import type { RegistroEventos } from '../eventos/eventos';

/** Lo que las reglas necesitan saber del embarazo, calculado una sola vez. */
export interface ContextoClinico {
  hoy: FechaISO;
  catalogo: Catalogo;
  historia: Historia;
  /** Edad en la primera consulta (o hoy, si aún no hay primera consulta). */
  edad?: number;
  primera?: DatosPrimeraConsulta;
  seguimientos: Consulta[];
  eg: EdadGestacional;
  /** EG (en días) en una fecha dada, si se puede calcular. */
  egEn(fecha: FechaISO): number | undefined;
  /** EG (en días) el día de la primera consulta. */
  egPrimeraConsulta?: number;
  /** Último resultado con valor de un tipo de examen. */
  ultimo<K extends TipoExamen>(tipo: K): (ResultadoPorTipo[K] & { fecha: FechaISO }) | undefined;
}

export interface ResultadoRegla {
  titulo: string;
  porque: string[];
  severidad?: number;
  /**
   * Situación clínica distinta dentro de la misma regla (por ejemplo, "sangrado:Trombocitopenia").
   * Si cambia después de atendida, la alerta reaparece aunque la severidad no suba.
   */
  variante?: string;
  urgente?: boolean;
  opciones?: OpcionDecision[];
  enlace?: Alerta['enlace'];
  /** Nombres de los parámetros pendientes de validar que usó la regla (lo llena el motor). */
  parametrosPendientes?: string[];
}

export interface Regla {
  id: string;
  /** Devuelve la alerta si la condición se cumple; si no, null. */
  evaluar(ctx: ContextoClinico): ResultadoRegla | null;
}

/**
 * Reglas cuya sola activación revela un resultado de examen (VIH, sífilis). En los eventos de métricas
 * salen con un nombre genérico y sin la opción elegida: los eventos no llevan resultados de exámenes.
 */
const REGLAS_RESULTADO_SENSIBLE = new Set(['vih', 'sifilis']);
const reglaEnEvento = (regla: string) => (REGLAS_RESULTADO_SENSIBLE.has(regla) ? 'resultado_sensible' : regla);

export const OPCIONES_GENERICAS: OpcionDecision[] = [
  { etiqueta: 'Atendida' },
  { etiqueta: 'Referida a especialista' },
  { etiqueta: 'No requiere acción', requiereMotivo: true },
];

export function construirContexto(historia: Historia, hoy: FechaISO, catalogo: Catalogo): ContextoClinico {
  const consultaPrimera = historia.consultas.find((c) => c.tipo === 'primera');
  const primera = consultaPrimera?.primera;
  const g = primera?.gestacionActual;
  const fechaNac = valorDe(historia.gestante.fechaNacimiento);
  const ordenados = [...historia.examenes].sort((a, b) => (a.fecha + a.creadoEn).localeCompare(b.fecha + b.creadoEn));

  const eg = edadGestacional(
    {
      fum: valorDe(g?.fum),
      egConfiablePorFum: valorDe(g?.egConfiablePorFum),
      ecografia: valorDe(g?.ecografia),
      egConfiablePorEco: valorDe(g?.egConfiablePorEco),
    },
    hoy,
    catalogo,
  );
  const egEn = (fecha: FechaISO) => (eg.estado === 'calculada' ? diasEntre(eg.inicio, fecha) : undefined);

  return {
    hoy,
    catalogo,
    historia,
    eg,
    egEn,
    egPrimeraConsulta: consultaPrimera ? egEn(consultaPrimera.fecha) : undefined,
    edad: fechaNac ? edad(fechaNac, consultaPrimera?.fecha ?? hoy) : undefined,
    primera,
    seguimientos: historia.consultas.filter((c) => c.tipo === 'seguimiento'),
    ultimo<K extends TipoExamen>(tipo: K) {
      const conValor = ordenados.filter(
        (e): e is Extract<ResultadoExamen, { tipo: K }> => e.tipo === tipo && e.resultado.estado === 'valor',
      );
      const e = conValor[conValor.length - 1];
      if (!e || e.resultado.estado !== 'valor') return undefined;
      return { ...(e.resultado.valor as ResultadoPorTipo[K]), fecha: e.fecha };
    },
  };
}

export function evaluar(reglas: Regla[], ctx: ContextoClinico): Map<string, ResultadoRegla> {
  const resultados = new Map<string, ResultadoRegla>();
  for (const regla of reglas) {
    const { resultado: r, pendientes } = ctx.catalogo.registrarPendientes(() => regla.evaluar(ctx));
    if (!r) continue;
    // La alerta avisa al profesional si se apoya en parámetros que el equipo clínico aún no validó.
    resultados.set(regla.id, pendientes.length > 0 ? { ...r, parametrosPendientes: pendientes.map((p) => p.nombre) } : r);
  }
  return resultados;
}

export class MotorAlertas {
  /** Las operaciones van en fila para que una sincronización no pise una decisión. */
  private fila: Promise<unknown> = Promise.resolve();

  private enFila<T>(tarea: () => Promise<T>): Promise<T> {
    const resultado = this.fila.then(tarea, tarea);
    this.fila = resultado.catch(() => undefined);
    return resultado;
  }

  constructor(
    private readonly repo: Repositorio,
    private readonly reglas: Regla[],
    private readonly catalogo: Catalogo,
    private readonly hoy: () => FechaISO,
    private readonly ahora: () => Date = () => new Date(),
    private readonly eventos?: RegistroEventos,
  ) {}

  /** Recalcula todas las reglas del embarazo y actualiza sus alertas. */
  sincronizar(embarazoId: string): Promise<Alerta[]> {
    return this.enFila(() => this.sincronizarAhora(embarazoId));
  }

  private async sincronizarAhora(embarazoId: string): Promise<Alerta[]> {
    const historia = await this.repo.historia(embarazoId);
    if (!historia) return [];
    const ctx = construirContexto(historia, this.hoy(), this.catalogo);
    const egDias = ctx.eg.estado === 'calculada' ? ctx.eg.dias : null;
    const resultados = evaluar(this.reglas, ctx);
    const existentes = new Map(historia.alertas.map((a) => [a.regla, a]));

    for (const regla of this.reglas) {
      const r = resultados.get(regla.id);
      const previa = existentes.get(regla.id);
      if (!r) {
        // Ya no se cumple: la decisión pasa al historial, para que un episodio nuevo vuelva a avisar.
        if (previa?.vigente) {
          await this.repo.guardar('alertas', {
            ...previa,
            vigente: false,
            activa: false,
            decision: undefined,
            decisionesAnteriores: previa.decision ? [...(previa.decisionesAnteriores ?? []), previa.decision] : previa.decisionesAnteriores,
          });
        }
        continue;
      }
      const severidad = r.severidad ?? 1;
      const decision = previa?.decision;
      // Reaparece si nunca se atendió, si la situación empeoró respecto de cuando se atendió,
      // o si cambió de variante (otra situación clínica que pide una decisión nueva).
      const activa =
        !decision || severidad > decision.severidadAtendida || (r.variante ?? null) !== (decision.varianteAtendida ?? null);
      if (activa && !previa?.activa) {
        await this.eventos?.registrar(embarazoId, { tipo: 'alerta_activada', regla: reglaEnEvento(regla.id), urgente: REGLAS_RESULTADO_SENSIBLE.has(regla.id) ? false : (r.urgente ?? false), egDias });
      }
      await this.repo.guardar('alertas', {
        ...(previa ?? {}),
        id: previa?.id ?? `${embarazoId}:${regla.id}`,
        embarazoId,
        regla: regla.id,
        titulo: r.titulo,
        porque: r.porque,
        severidad,
        variante: r.variante,
        urgente: r.urgente ?? false,
        opciones: r.opciones ?? OPCIONES_GENERICAS,
        enlace: r.enlace,
        parametrosPendientes: r.parametrosPendientes,
        vigente: true,
        activa,
        decision: activa && decision ? undefined : decision,
        decisionesAnteriores: activa && decision ? [...(previa?.decisionesAnteriores ?? []), decision] : previa?.decisionesAnteriores,
      });
    }
    return (await this.repo.historia(embarazoId))?.alertas ?? [];
  }

  /** El profesional marca la alerta como atendida con una de sus opciones. */
  atender(alertaId: string, opcion: string, motivo?: string): Promise<Alerta> {
    return this.enFila(() => this.atenderAhora(alertaId, opcion, motivo));
  }

  private async atenderAhora(alertaId: string, opcion: string, motivo?: string): Promise<Alerta> {
    const alerta = await this.repo.leer('alertas', alertaId);
    if (!alerta) throw new Error('Alerta no encontrada');
    const def = alerta.opciones.find((o) => o.etiqueta === opcion);
    if (!def) throw new Error(`Opción no válida: ${opcion}`);
    if (def.requiereMotivo && !motivo?.trim()) throw new Error('Esta decisión requiere un motivo.');
    if (def.registraIndicacion) {
      const { tipo, estado, fechaDeHoy } = def.registraIndicacion;
      const existente = (await this.repo.indicacionesDe(alerta.embarazoId)).find((i) => i.tipo === tipo);
      await this.repo.guardar('indicaciones', {
        ...(existente ?? {}),
        embarazoId: alerta.embarazoId,
        tipo,
        estado,
        motivo: motivo?.trim() || undefined,
        fechaInicio: fechaDeHoy ? this.hoy() : (existente?.fechaInicio ?? this.hoy()),
        // Una suspensión queda con su fecha, como cuando se registra desde las indicaciones.
        fechaSuspension: estado === 'suspendido' ? this.hoy() : undefined,
      });
    }
    // Si la decisión registró una indicación, la regla puede cambiar de variante por esa misma decisión
    // (por ejemplo, ASA "se suspende" deja de estar indicado): se atiende la situación que resulta.
    let severidadAtendida = alerta.severidad;
    let varianteAtendida = alerta.variante;
    const regla = this.reglas.find((r) => r.id === alerta.regla);
    const historiaTras = def.registraIndicacion && regla ? await this.repo.historia(alerta.embarazoId) : undefined;
    const tras = historiaTras && regla ? regla.evaluar(construirContexto(historiaTras, this.hoy(), this.catalogo)) : null;
    if (tras) {
      severidadAtendida = tras.severidad ?? 1;
      varianteAtendida = tras.variante;
    }
    const atendida = await this.repo.guardar('alertas', {
      ...alerta,
      activa: false,
      decision: {
        opcion,
        motivo: motivo?.trim() || undefined,
        fecha: this.ahora().toISOString(),
        profesionalId: this.repo.usuarioId,
        severidadAtendida,
        varianteAtendida,
      },
    });
    if (this.eventos) {
      const historia = await this.repo.historia(alerta.embarazoId);
      const eg = historia ? construirContexto(historia, this.hoy(), this.catalogo).eg : undefined;
      await this.eventos.registrar(alerta.embarazoId, {
        tipo: 'alerta_decidida',
        regla: reglaEnEvento(alerta.regla),
        opcion: REGLAS_RESULTADO_SENSIBLE.has(alerta.regla) ? '—' : opcion,
        egDias: eg?.estado === 'calculada' ? eg.dias : null });
    }
    // La indicación puede cambiar otras reglas (por ejemplo, el calcio ya indicado).
    if (def.registraIndicacion) await this.sincronizarAhora(alerta.embarazoId);
    return (await this.repo.leer('alertas', atendida.id)) ?? atendida;
  }
}

/** Activas primero las urgentes; luego por severidad. */
export function ordenarAlertas(alertas: Alerta[]): Alerta[] {
  return [...alertas].sort((a, b) => Number(b.urgente) - Number(a.urgente) || b.severidad - a.severidad || a.titulo.localeCompare(b.titulo));
}
