// Grupo sanguíneo y Rh: manda la hemoclasificación de laboratorio, que se pide a todas las gestantes;
// lo que ella declara en la primera consulta solo se usa mientras no haya resultado.
import { valorDe } from '../datos/campo';
import type { DatosPrimeraConsulta, FechaISO, ResultadoExamen, ResultadoPorTipo } from '../datos/modelo';

type Hemo = ResultadoPorTipo['hemoclasificacion'];

export interface GrupoRh {
  grupo?: Hemo['grupo'];
  rh?: Hemo['rh'];
  fuente?: 'laboratorio' | 'declarado';
  /** Fecha del resultado de laboratorio, si lo hay. */
  fecha?: FechaISO;
  /** Lo declarado, para comparar con el laboratorio. */
  declarado: { grupo?: Hemo['grupo']; rh?: Hemo['rh'] };
}

export function grupoRh(primera: DatosPrimeraConsulta | undefined, examenes: ResultadoExamen[]): GrupoRh {
  const declarado = { grupo: valorDe(primera?.gestacionActual.grupo), rh: valorDe(primera?.gestacionActual.rh) };
  const lab = [...examenes]
    .filter((e) => e.tipo === 'hemoclasificacion' && e.resultado.estado === 'valor')
    .sort((a, b) => (a.fecha + a.creadoEn).localeCompare(b.fecha + b.creadoEn))
    .at(-1);
  if (lab && lab.resultado.estado === 'valor') {
    const v = lab.resultado.valor as Hemo;
    return { grupo: v.grupo, rh: v.rh, fuente: 'laboratorio', fecha: lab.fecha, declarado };
  }
  if (declarado.grupo || declarado.rh) return { ...declarado, fuente: 'declarado', declarado };
  return { declarado };
}
