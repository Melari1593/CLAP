// C1 — Motor genérico de alertas y decisiones.
// Evalúa todas las reglas cada vez que cambia un dato. Una alerta queda activa hasta que el
// profesional registra una decisión; si después la regla da un resultado peor, avisa de nuevo.
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
  urgente?: boolean;
  opciones?: OpcionDecision[];
  enlace?: Alerta['enlace'];
}

export interface Regla {
  id: string;
  /** Devuelve la alerta si la condición se cumple; si no, null. */
  evaluar(ctx: ContextoClinico): ResultadoRegla | null;
}

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
    const r = regla.evaluar(ctx);
    if (r) resultados.set(regla.id, r);
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
  ) {}

  /** Recalcula todas las reglas del embarazo y actualiza sus alertas. */
  sincronizar(embarazoId: string): Promise<Alerta[]> {
    return this.enFila(() => this.sincronizarAhora(embarazoId));
  }

  private async sincronizarAhora(embarazoId: string): Promise<Alerta[]> {
    const historia = await this.repo.historia(embarazoId);
    if (!historia) return [];
    const resultados = evaluar(this.reglas, construirContexto(historia, this.hoy(), this.catalogo));
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
      // Reaparece si nunca se atendió, o si la situación empeoró respecto de cuando se atendió.
      const activa = !decision || severidad > decision.severidadAtendida;
      await this.repo.guardar('alertas', {
        ...(previa ?? {}),
        id: previa?.id ?? `${embarazoId}:${regla.id}`,
        embarazoId,
        regla: regla.id,
        titulo: r.titulo,
        porque: r.porque,
        severidad,
        urgente: r.urgente ?? false,
        opciones: r.opciones ?? OPCIONES_GENERICAS,
        enlace: r.enlace,
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
      const { tipo, estado } = def.registraIndicacion;
      const existente = (await this.repo.indicacionesDe(alerta.embarazoId)).find((i) => i.tipo === tipo);
      await this.repo.guardar('indicaciones', {
        ...(existente ?? {}),
        embarazoId: alerta.embarazoId,
        tipo,
        estado,
        motivo: motivo?.trim() || undefined,
        fechaInicio: existente?.fechaInicio ?? this.hoy(),
      });
    }
    const atendida = await this.repo.guardar('alertas', {
      ...alerta,
      activa: false,
      decision: {
        opcion,
        motivo: motivo?.trim() || undefined,
        fecha: this.ahora().toISOString(),
        profesionalId: this.repo.usuarioId,
        severidadAtendida: alerta.severidad,
      },
    });
    // La indicación puede cambiar otras reglas (por ejemplo, el calcio ya indicado).
    if (def.registraIndicacion) await this.sincronizarAhora(alerta.embarazoId);
    return (await this.repo.leer('alertas', atendida.id)) ?? atendida;
  }
}

/** Activas primero las urgentes; luego por severidad. */
export function ordenarAlertas(alertas: Alerta[]): Alerta[] {
  return [...alertas].sort((a, b) => Number(b.urgente) - Number(a.urgente) || b.severidad - a.severidad || a.titulo.localeCompare(b.titulo));
}
