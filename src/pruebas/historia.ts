// Historia en memoria para probar reglas sin base de datos.
import type { Historia } from '../datos/repositorio';
import type {
  Consulta,
  DatosPrimeraConsulta,
  DatosSeguimiento,
  FactorTransitorio,
  Indicacion,
  Meta,
  ResultadoExamen,
  ResultadoPorTipo,
  TipoExamen,
} from '../datos/modelo';
import { primeraConsultaCompleta, seguimiento } from './fixtures';

const meta = (id: string): Meta => ({
  id,
  institucionId: 'ips-1',
  creadoEn: '2026-07-20T10:00:00.000Z',
  actualizadoEn: '2026-07-20T10:00:00.000Z',
  actualizadoPor: 'prof-1',
  dispositivoId: 'd',
  version: 1,
  versionServidor: 0,
});

export function historiaDePrueba(
  opciones: {
    fechaNacimiento?: string;
    primera?: (d: DatosPrimeraConsulta) => void;
    examenes?: { tipo: TipoExamen; valor: ResultadoPorTipo[TipoExamen]; fecha?: string }[];
    /** Fecha de la primera consulta (por defecto 2026-07-20). */
    fechaPrimera?: string;
    seguimientos?: { fecha: string; cambios?: (d: DatosSeguimiento) => void }[];
    factores?: Pick<FactorTransitorio, 'tipo' | 'inicio' | 'resolucion' | 'conHospitalizacion'>[];
    indicaciones?: Pick<Indicacion, 'tipo' | 'estado'>[];
  } = {},
): Historia {
  const primera = primeraConsultaCompleta();
  opciones.primera?.(primera);
  const consulta: Consulta = {
    ...meta('c1'),
    embarazoId: 'e1',
    tipo: 'primera',
    fecha: opciones.fechaPrimera ?? '2026-07-20',
    profesionalId: 'prof-1',
    proximaCita: { estado: 'vacio' },
    cerrada: true,
    primera,
  };
  return {
    gestante: {
      ...meta('g1'),
      documentoTipo: 'CC',
      documentoNumero: '1',
      documentoClave: 'CC:1',
      nombres: 'Ana',
      apellidos: 'Pérez',
      fechaNacimiento: { estado: 'valor', valor: opciones.fechaNacimiento ?? '1998-04-12' },
    },
    embarazo: { ...meta('e1'), gestanteId: 'g1', estado: 'activo', inicio: '2026-06-01' },
    consultas: [
      consulta,
      ...(opciones.seguimientos ?? []).map((s, i): Consulta => {
        const datos = seguimiento(62);
        s.cambios?.(datos);
        return { ...consulta, ...meta(`s${i}`), tipo: 'seguimiento', fecha: s.fecha, primera: undefined, seguimiento: datos };
      }),
    ],
    examenes: (opciones.examenes ?? []).map(
      (e, i) =>
        ({
          ...meta(`x${i}`),
          embarazoId: 'e1',
          consultaId: 'c1',
          fecha: e.fecha ?? '2026-08-20',
          tipo: e.tipo,
          resultado: { estado: 'valor', valor: e.valor },
        }) as ResultadoExamen,
    ),
    indicaciones: (opciones.indicaciones ?? []).map((x, i) => ({ ...meta(`i${i}`), embarazoId: 'e1', ...x })),
    alertas: [],
    factores: (opciones.factores ?? []).map((x, i) => ({ ...meta(`f${i}`), embarazoId: 'e1', ...x })),
    derechos: [],
    consentimientos: [],
    cuestionarios: [],
    carne: undefined,
  };
}
