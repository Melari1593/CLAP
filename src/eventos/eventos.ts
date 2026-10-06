// G2 — Registro de eventos para medir el éxito (sin tableros: los reportes son V2).
// Los eventos no llevan nombres, documentos ni resultados de exámenes: solo el id del embarazo,
// el tipo de evento y los datos mínimos para la métrica. Son información privada de la institución.
import type { BaseDatos } from '../datos/bd';
import type { CanalEnvio, DecisionDerechos, DesencadenanteDerechos, FechaHoraISO, TipoExamen } from '../datos/modelo';

export type DatosEvento =
  | { tipo: 'consulta_cerrada'; consultaId: string; consultaTipo: 'primera' | 'seguimiento'; egDias: number | null; duracionSegundos?: number; examenesPendientes: TipoExamen[]; puntajeTrombotico?: number }
  | { tipo: 'alerta_activada'; regla: string; urgente: boolean; egDias: number | null }
  | { tipo: 'alerta_decidida'; regla: string; opcion: string; egDias: number | null }
  | { tipo: 'examen_registrado'; examen: TipoExamen; egDias: number | null }
  | { tipo: 'derechos_registrado'; decision: DecisionDerechos; desencadenante: DesencadenanteDerechos; remisionMismoDia: boolean }
  | { tipo: 'remision_registrada'; mismoDiaQueLaSolicitud: boolean }
  | { tipo: 'ruta_activada' }
  | { tipo: 'carne_enviado'; canal: CanalEnvio }
  | { tipo: 'carne_abierto' }
  | { tipo: 'comprension'; sabeProximaCita: boolean; signosAlarma: number };

export type TipoEvento = DatosEvento['tipo'];

export type Evento = DatosEvento & {
  id: string;
  fechaHora: FechaHoraISO;
  institucionId: string;
  embarazoId: string;
  /** 0: pendiente de enviar al servidor; 1: enviado. */
  enviado: 0 | 1;
};

export class RegistroEventos {
  constructor(
    private readonly bd: BaseDatos,
    private readonly institucionId: string,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async registrar(embarazoId: string, datos: DatosEvento): Promise<Evento> {
    const evento = {
      ...datos,
      id: crypto.randomUUID(),
      fechaHora: this.ahora().toISOString(),
      institucionId: this.institucionId,
      embarazoId,
      enviado: 0,
    } as Evento;
    await this.bd.eventos.add(evento);
    return evento;
  }

  todos(): Promise<Evento[]> {
    return this.bd.eventos.orderBy('fechaHora').toArray();
  }
}
