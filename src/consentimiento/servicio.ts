// Consentimiento informado (Resolución 3100 de 2019, estándar de historia clínica y registros):
// aceptación libre, voluntaria y consciente, después de informar beneficios, riesgos, alternativas e
// implicaciones. Se registra para el tratamiento de datos y el envío del carné, para los procedimientos
// y para la IVE (este último es privado y solo se ve en "Opciones y derechos").
import type { Consentimiento, TipoConsentimiento } from '../datos/modelo';
import type { Repositorio } from '../datos/repositorio';
import { carneDebeEstarPausado } from '../derechos/servicio';

export class ErrorConsentimiento extends Error {}

export interface NuevoConsentimiento {
  tipo: TipoConsentimiento;
  procedimiento?: string;
  decision: Consentimiento['decision'];
  informado: Consentimiento['informado'];
  preguntasResueltas: boolean;
  otorga: Consentimiento['otorga'];
  representante?: Consentimiento['representante'];
  notas?: string;
}

const normalizar = (t: string | undefined) => t?.trim().toLowerCase() ?? '';

/** Último consentimiento registrado de un tipo (y del mismo procedimiento, si se da). */
export function ultimoConsentimiento(lista: Consentimiento[], tipo: TipoConsentimiento, procedimiento?: string): Consentimiento | undefined {
  return [...lista]
    .filter((c) => c.tipo === tipo && (procedimiento === undefined || normalizar(c.procedimiento) === normalizar(procedimiento)))
    .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
    .at(-1);
}

/** Aceptado y no revocado. */
export function estaVigente(c: Consentimiento | undefined): boolean {
  return c?.decision === 'acepta' && !c.revocado;
}

/** Para crear y enviar el carné hace falta el consentimiento vigente para el tratamiento de datos. */
export function datosCarneAutorizados(lista: Consentimiento[]): boolean {
  return estaVigente(ultimoConsentimiento(lista, 'datos_carne'));
}

/** El carné se pausa si la gestante no acepta o revoca el tratamiento de datos (sin registro previo, no cambia). */
export function datosCarneRetirados(lista: Consentimiento[]): boolean {
  const ultimo = ultimoConsentimiento(lista, 'datos_carne');
  return ultimo !== undefined && !estaVigente(ultimo);
}

export class ServicioConsentimientos {
  constructor(
    private readonly repo: Repositorio,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  async registrar(embarazoId: string, d: NuevoConsentimiento): Promise<Consentimiento> {
    const procedimiento = d.procedimiento?.trim();
    if (d.tipo === 'procedimiento' && !procedimiento) throw new ErrorConsentimiento('Escriba el procedimiento.');
    if (d.tipo === 'ive' && d.otorga !== 'gestante') {
      throw new ErrorConsentimiento('En la IVE decide la gestante, también si es menor de edad: no se pide representante.');
    }
    if (d.otorga === 'representante') {
      const r = d.representante;
      if (!r?.nombre.trim() || !r.parentesco.trim() || !r.documento.trim()) {
        throw new ErrorConsentimiento('Registre nombre, parentesco y documento del representante.');
      }
    }
    if (d.decision === 'acepta') {
      const { beneficios, riesgos, alternativas, implicaciones } = d.informado;
      if (!(beneficios && riesgos && alternativas && implicaciones)) {
        throw new ErrorConsentimiento('Antes de registrar la aceptación, informe beneficios, riesgos, alternativas e implicaciones.');
      }
      if (!d.preguntasResueltas) throw new ErrorConsentimiento('Antes de registrar la aceptación, resuelva sus preguntas.');
    }

    const { nombre, registroProfesional } = this.repo.usuario;
    const registro = await this.repo.guardar('consentimientos', {
      embarazoId,
      tipo: d.tipo,
      procedimiento: d.tipo === 'procedimiento' ? procedimiento : undefined,
      fechaHora: this.ahora().toISOString(),
      decision: d.decision,
      informado: d.informado,
      preguntasResueltas: d.preguntasResueltas,
      otorga: d.otorga,
      representante: d.otorga === 'representante' ? d.representante : undefined,
      informadoPor: { nombre, registroProfesional: registroProfesional ?? null },
      notas: d.notas?.trim() || undefined,
    });
    if (d.tipo === 'datos_carne') await this.actualizarCarne(embarazoId);
    return registro;
  }

  /** La gestante retira el consentimiento. Queda el registro original con la fecha de la revocatoria. */
  async revocar(id: string, motivo?: string): Promise<Consentimiento> {
    const c = await this.repo.leer('consentimientos', id);
    if (!c) throw new ErrorConsentimiento('Consentimiento no encontrado.');
    if (c.revocado) return c;
    if (c.decision !== 'acepta') throw new ErrorConsentimiento('Solo se revoca un consentimiento aceptado.');
    const guardado = await this.repo.guardar('consentimientos', {
      ...c,
      revocado: { fechaHora: this.ahora().toISOString(), motivo: motivo?.trim() || undefined },
    });
    if (c.tipo === 'datos_carne') await this.actualizarCarne(c.embarazoId);
    return guardado;
  }

  private async actualizarCarne(embarazoId: string) {
    const historia = await this.repo.historia(embarazoId);
    const carne = historia?.carne;
    if (!historia || !carne) return;
    const estado = carneDebeEstarPausado(historia.derechos, historia.consentimientos) ? 'pausado' : 'activo';
    if (carne.estado !== estado) await this.repo.guardar('carnes', { ...carne, estado });
  }
}
