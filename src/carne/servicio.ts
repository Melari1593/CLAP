// F3 / F5 — Carné de la gestante: PIN, canal de envío, enlace, vista previa y envío al cerrar.
import type { Catalogo } from '../clinico/catalogo';
import type { BaseDatos } from '../datos/bd';
import type { CanalEnvio, Carne, FechaISO } from '../datos/modelo';
import type { Repositorio } from '../datos/repositorio';
import { correoValido } from '../consultas/validaciones';
import { carneDebeEstarPausado } from '../derechos/servicio';
import { proyectarCarne, type DatosCarne } from '../privacidad/carne';
import { encolarEnvioCarne } from '../sync/cola';
import { aleatorio, derivarPin, pinValido } from './pin';
import type { RegistroEventos } from '../eventos/eventos';

export class ErrorCarne extends Error {}

export interface Destino {
  canal: CanalEnvio;
  /** Número de WhatsApp o correo; no aplica para el impreso. */
  destino?: string;
}

function validarDestino({ canal, destino }: Destino): string | undefined {
  if (canal === 'impreso') return undefined;
  const d = destino?.trim() ?? '';
  if (canal === 'correo' && !correoValido(d)) throw new ErrorCarne('Revise el correo: parece mal escrito.');
  if (canal === 'whatsapp' && d.replace(/\D/g, '').length < 7) throw new ErrorCarne('Revise el número de WhatsApp.');
  return canal === 'whatsapp' ? d.replace(/[^\d+]/g, '') : d.toLowerCase();
}

export class ServicioCarne {
  constructor(
    private readonly bd: BaseDatos,
    private readonly repo: Repositorio,
    private readonly catalogo: Catalogo,
    private readonly hoy: () => FechaISO,
    private readonly ahora: () => Date = () => new Date(),
    private readonly eventos?: RegistroEventos,
  ) {}

  async carneDe(embarazoId: string): Promise<Carne | undefined> {
    return (await this.repo.historia(embarazoId))?.carne;
  }

  /** Primera consulta: la gestante elige el PIN y el canal. Nace pausado si solicitó IVE (sección 7). */
  async crear(embarazoId: string, pin: string, destino: Destino): Promise<Carne> {
    if (!pinValido(pin, this.catalogo)) throw new ErrorCarne('El PIN debe tener 4 dígitos.');
    const historia = await this.repo.historia(embarazoId);
    if (!historia) throw new ErrorCarne('Embarazo no encontrado.');
    if (historia.carne) throw new ErrorCarne('El carné ya existe: asigne un PIN nuevo o cambie el destino.');
    const pinSal = aleatorio(16);
    return this.repo.guardar('carnes', {
      embarazoId,
      token: aleatorio(32),
      pinSal,
      pinHash: await derivarPin(pin, pinSal),
      canal: destino.canal,
      destino: validarDestino(destino),
      estado: carneDebeEstarPausado(historia.derechos) ? 'pausado' : 'activo',
      intentosFallidos: 0,
    });
  }

  /** Olvidó el PIN: se asigna uno nuevo en la consulta (el enlace no cambia). */
  async nuevoPin(carneId: string, pin: string): Promise<Carne> {
    if (!pinValido(pin, this.catalogo)) throw new ErrorCarne('El PIN debe tener 4 dígitos.');
    const carne = await this.repo.leer('carnes', carneId);
    if (!carne) throw new ErrorCarne('Carné no encontrado.');
    const pinSal = aleatorio(16);
    return this.repo.guardar('carnes', { ...carne, pinSal, pinHash: await derivarPin(pin, pinSal), intentosFallidos: 0, bloqueadoHasta: undefined });
  }

  /** Cambió de número o de correo (o de canal): nuevo enlace; el anterior deja de funcionar. */
  async cambiarDestino(carneId: string, destino: Destino): Promise<Carne> {
    const carne = await this.repo.leer('carnes', carneId);
    if (!carne) throw new ErrorCarne('Carné no encontrado.');
    return this.repo.guardar('carnes', { ...carne, canal: destino.canal, destino: validarDestino(destino), token: aleatorio(32) });
  }

  /** Lo mismo que verá la gestante: misma proyección que el carné web y el impreso. */
  async vistaPrevia(embarazoId: string): Promise<DatosCarne | undefined> {
    const historia = await this.repo.historia(embarazoId);
    if (!historia?.carne) return undefined;
    return proyectarCarne(historia, historia.carne, this.hoy(), this.catalogo);
  }

  /**
   * Envía (o deja en cola, si no hay red) el enlace por WhatsApp o correo. No envía nada si el carné
   * está pausado ni si el canal es el impreso.
   */
  async enviar(embarazoId: string): Promise<'en_cola' | 'pausado' | 'impreso' | 'sin_carne'> {
    const carne = await this.carneDe(embarazoId);
    if (!carne) return 'sin_carne';
    if (carne.estado === 'pausado') return 'pausado';
    if (carne.canal === 'impreso') return 'impreso';
    await encolarEnvioCarne(this.bd, carne.id, carne.canal, this.ahora().toISOString());
    await this.eventos?.registrar(embarazoId, { tipo: 'carne_enviado', canal: carne.canal });
    return 'en_cola';
  }

  /** "La gestante entiende" (pregunta corta después de la consulta). */
  async registrarComprension(embarazoId: string, sabeProximaCita: boolean, signosAlarma: number) {
    await this.eventos?.registrar(embarazoId, { tipo: 'comprension', sabeProximaCita, signosAlarma });
  }
}
