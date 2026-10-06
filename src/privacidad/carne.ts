// A3 / F4 — Capa de lectura restringida del carné.
// El carné nunca recibe la historia completa: solo esta proyección, armada con una lista
// explícita de datos permitidos. Un dato nuevo del modelo no llega al carné hasta que se
// agrega aquí a propósito.
import { valorDe } from '../datos/campo';
import type { Carne, FechaISO, TipoIndicacion } from '../datos/modelo';
import type { Historia } from '../datos/repositorio';

export const MENSAJE_CARNE_PAUSADO = 'Comunícate con tu servicio de salud.';

const INDICACIONES_EN_CARNE: TipoIndicacion[] = ['hierro', 'acidoFolico', 'calcio', 'asa', 'tromboprofilaxis'];

export type DatosCarne =
  | { estado: 'pausado'; mensaje: string }
  | {
      estado: 'activo';
      nombre: string;
      /** Datos para calcular semanas y FPP en el carné. */
      fum?: FechaISO;
      ecografia?: { fecha: FechaISO; egDias: number };
      proximaCita?: { fecha: FechaISO; lugar: string; queLlevar: string };
      indicaciones: TipoIndicacion[];
      grupo?: string;
      rh?: string;
      vacunas: { antirrubeola?: string; antitetanicaDosisPrevias?: number };
      citas: { fecha: FechaISO; pesoKg?: number; presion?: string }[];
    };

export function proyectarCarne(historia: Historia, carne: Carne): DatosCarne {
  if (carne.estado === 'pausado') return { estado: 'pausado', mensaje: MENSAJE_CARNE_PAUSADO };

  const primera = historia.consultas.find((c) => c.tipo === 'primera')?.primera;
  const actual = primera?.gestacionActual;
  const cerradas = historia.consultas.filter((c) => c.cerrada);
  const ultima = cerradas[cerradas.length - 1];

  return {
    estado: 'activo',
    nombre: historia.gestante.nombres.split(' ')[0] ?? '',
    fum: valorDe(actual?.fum),
    ecografia: valorDe(actual?.ecografia),
    proximaCita: valorDe(ultima?.proximaCita),
    indicaciones: historia.indicaciones
      .filter((i) => INDICACIONES_EN_CARNE.includes(i.tipo) && (i.estado === 'indicado' || i.estado === 'ya_lo_toma'))
      .map((i) => i.tipo),
    grupo: valorDe(actual?.grupo),
    rh: valorDe(actual?.rh),
    vacunas: {
      antirrubeola: valorDe(actual?.antirrubeola),
      antitetanicaDosisPrevias: valorDe(actual?.antitetanica)?.dosisPrevias,
    },
    citas: cerradas.map((c) => {
      const s = c.seguimiento;
      const pas = valorDe(s?.paSistolica);
      const pad = valorDe(s?.paDiastolica);
      return {
        fecha: c.fecha,
        pesoKg: valorDe(s?.pesoKg),
        presion: pas !== undefined && pad !== undefined ? `${pas}/${pad}` : undefined,
      };
    }),
  };
}
