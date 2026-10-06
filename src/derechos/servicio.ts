// E1 — Flujo "Opciones y derechos" (sección 7 del spec). Todo lo que se registra aquí es privado
// y nunca llega al carné.
import type { Catalogo } from '../clinico/catalogo';
import { valorDe } from '../datos/campo';
import type {
  Causal,
  DecisionDerechos,
  DesencadenanteDerechos,
  FechaHoraISO,
  FechaISO,
  RegistroDerechos,
} from '../datos/modelo';
import type { Historia, Repositorio } from '../datos/repositorio';
import { construirContexto, type ContextoClinico, type MotorAlertas } from '../alertas/motor';
import { CAUSALES, cita } from './textos';

export type Marco =
  | { tipo: 'voluntad'; texto: string; norma: string }
  | { tipo: 'causales'; texto: string; norma: string }
  | { tipo: 'confirmar_eg'; texto: string };

/** Marco legal según la EG de hoy. Con EG dudosa cerca de la semana 24 pide confirmarla sin dilatar. */
export function marcoSegunEG(ctx: ContextoClinico): Marco {
  const { catalogo, eg } = ctx;
  const semana = catalogo.valor('ive.semanaLimiteSinCausal');
  const { hastaDiasInclusive, margenEGDudosaSemanas } = catalogo.valor('ive.limite');
  const voluntad: Marco = {
    tipo: 'voluntad',
    texto: 'La IVE es un derecho por la sola voluntad de la gestante. No requiere causal.',
    norma: cita(catalogo, 'Sentencia C-055 de 2022'),
  };
  const causales: Marco = {
    tipo: 'causales',
    texto: `Después de la semana ${semana}, la IVE es legal si se configura una causal. Una vez identificada, solo la gestante decide.`,
    norma: `${cita(catalogo, 'Sentencia C-355 de 2006')} · ${cita(catalogo, 'Resolución 051 de 2023')}`,
  };
  const confirmar: Marco = {
    tipo: 'confirmar_eg',
    texto: `La EG no es confiable y está cerca de la semana ${semana}: confirme la EG (por ejemplo, con ecografía) sin dilatar la atención.`,
  };

  if (eg.estado !== 'calculada') return confirmar;
  const cerca = Math.abs(eg.dias - hastaDiasInclusive) <= margenEGDudosaSemanas * 7;
  if (!eg.confiable && cerca) return confirmar;
  return eg.dias <= hastaDiasInclusive ? voluntad : causales;
}

/** Disparadores del flujo presentes en la historia (los otros dos los marca el profesional). */
export function disparadores(ctx: ContextoClinico): DesencadenanteDerechos[] {
  const d = ctx.primera;
  const lista: DesencadenanteDerechos[] = [];
  const desea = valorDe(d?.planificacion.deseaContinuar);
  if (valorDe(d?.planificacion.embarazoPlaneado) === false && (desea === 'no' || desea === 'no_ha_decidido')) lista.push('no_planeado');
  if (valorDe(d?.gestacionActual.violenciaSexual) === true) lista.push('violencia_sexual');
  const menorDe = ctx.catalogo.valor('clap.edadRiesgo').presuncionViolenciaMenorDe;
  if (ctx.edad !== undefined && ctx.edad < menorDe) lista.push('menor_14');
  return lista;
}

/** El carné queda pausado mientras la última decisión registrada sea "solicita IVE". */
export function carneDebeEstarPausado(derechos: RegistroDerechos[]): boolean {
  const ultimo = [...derechos].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)).at(-1);
  return ultimo?.decision === 'solicita_ive';
}

export interface NuevaDecision {
  desencadenante: DesencadenanteDerechos;
  momentoASolas: boolean;
  decision: DecisionDerechos;
  citaCercana?: FechaISO;
  causal?: Causal;
  /** Si solicita IVE: prestador (configurado o escrito a mano). */
  prestador?: string;
  remisionFechaHora?: FechaHoraISO;
  rutaActivadaFechaHora?: FechaHoraISO;
  notificaciones?: { a: string; fechaHora: FechaHoraISO }[];
  notas?: string;
}

export class ErrorDerechos extends Error {}

export class ServicioDerechos {
  constructor(
    private readonly repo: Repositorio,
    private readonly motor: MotorAlertas,
    private readonly catalogo: Catalogo,
    private readonly hoy: () => FechaISO,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  contexto(historia: Historia): ContextoClinico {
    return construirContexto(historia, this.hoy(), this.catalogo);
  }

  prestadorConfigurado(): string | null {
    return this.catalogo.valor('derechos.prestadorIVE');
  }

  async registrar(embarazoId: string, d: NuevaDecision): Promise<RegistroDerechos> {
    const historia = await this.repo.historia(embarazoId);
    if (!historia) throw new ErrorDerechos('Embarazo no encontrado');
    const ctx = this.contexto(historia);
    const marco = marcoSegunEG(ctx);

    if (d.decision === 'lo_pensara' && !d.citaCercana) throw new ErrorDerechos('Registre la fecha de la cita cercana.');
    if (d.decision === 'solicita_ive') {
      if (!d.prestador?.trim()) throw new ErrorDerechos('Registre el prestador al que se remite.');
      if (marco.tipo === 'causales' && !d.causal) throw new ErrorDerechos('Después de la semana 24 marque la causal identificada.');
    }
    if (d.causal && !CAUSALES.some((c) => c.id === d.causal)) throw new ErrorDerechos('Causal no válida.');

    const fechaHora = this.ahora().toISOString();
    const configurado = this.prestadorConfigurado();
    const registro = await this.repo.guardar('derechos', {
      embarazoId,
      fechaHora,
      desencadenante: d.desencadenante,
      egDias: ctx.eg.estado === 'calculada' ? ctx.eg.dias : null,
      momentoASolas: d.momentoASolas,
      decision: d.decision,
      citaCercana: d.decision === 'lo_pensara' ? d.citaCercana : undefined,
      causal: d.causal,
      solicitudIVE:
        d.decision === 'solicita_ive'
          ? {
              fechaHora,
              prestador: d.prestador!.trim(),
              manual: configurado === null || d.prestador!.trim() !== configurado,
              remisionFechaHora: d.remisionFechaHora,
            }
          : undefined,
      rutaViolencia: d.rutaActivadaFechaHora
        ? { activadaFechaHora: d.rutaActivadaFechaHora, notificaciones: d.notificaciones ?? [] }
        : undefined,
      notas: d.notas?.trim() || undefined,
    });

    await this.actualizarCarne(embarazoId);
    await this.atenderAlertas(embarazoId, registro);
    return registro;
  }

  /** Registra la remisión (fecha y hora) de una solicitud de IVE ya registrada. */
  async registrarRemision(registroId: string, remisionFechaHora: FechaHoraISO): Promise<RegistroDerechos> {
    const r = await this.repo.leer('derechos', registroId);
    if (!r?.solicitudIVE) throw new ErrorDerechos('El registro no tiene una solicitud de IVE.');
    return this.repo.guardar('derechos', { ...r, solicitudIVE: { ...r.solicitudIVE, remisionFechaHora } });
  }

  /** Registra la activación de la ruta de violencia sexual y sus notificaciones. */
  async registrarRuta(
    registroId: string,
    activadaFechaHora: FechaHoraISO,
    notificaciones: { a: string; fechaHora: FechaHoraISO }[],
  ): Promise<RegistroDerechos> {
    const r = await this.repo.leer('derechos', registroId);
    if (!r) throw new ErrorDerechos('Registro no encontrado.');
    const guardado = await this.repo.guardar('derechos', { ...r, rutaViolencia: { activadaFechaHora, notificaciones } });
    await this.atenderAlertas(r.embarazoId, guardado);
    return guardado;
  }

  /** Pausa el carné si solicita IVE; lo reactiva si después decide otra cosa (por ejemplo, continuar). */
  private async actualizarCarne(embarazoId: string) {
    const historia = await this.repo.historia(embarazoId);
    const carne = historia?.carne;
    if (!historia || !carne) return;
    const estado = carneDebeEstarPausado(historia.derechos) ? 'pausado' : 'activo';
    if (carne.estado !== estado) await this.repo.guardar('carnes', { ...carne, estado });
  }

  /** El registro en este flujo atiende las alertas que lo enlazan. */
  private async atenderAlertas(embarazoId: string, r: RegistroDerechos) {
    const alertas = await this.motor.sincronizar(embarazoId);
    const activa = (regla: string) => alertas.find((a) => a.regla === regla && a.activa);
    const noPlaneado = activa('no_planeado');
    if (noPlaneado && noPlaneado.urgente) {
      const opcion = r.decision === 'no_desea_hablar' ? 'No desea hablar del tema ahora' : 'Asesoría realizada y decisión registrada';
      await this.motor.atender(noPlaneado.id, opcion);
    }
    if (r.rutaViolencia) {
      for (const regla of ['menor_14', 'violencia']) {
        const a = activa(regla);
        if (a && a.opciones.some((o) => o.etiqueta === 'Ruta activada')) await this.motor.atender(a.id, 'Ruta activada');
      }
    }
  }
}
