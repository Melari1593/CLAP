// Historia en memoria para probar reglas sin base de datos.
import type { Historia } from '../datos/repositorio';
import type { Consulta, DatosPrimeraConsulta, Meta, ResultadoExamen, ResultadoPorTipo, TipoExamen } from '../datos/modelo';
import { primeraConsultaCompleta } from './fixtures';

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
  } = {},
): Historia {
  const primera = primeraConsultaCompleta();
  opciones.primera?.(primera);
  const consulta: Consulta = {
    ...meta('c1'),
    embarazoId: 'e1',
    tipo: 'primera',
    fecha: '2026-07-20',
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
    consultas: [consulta],
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
    indicaciones: [],
    alertas: [],
    factores: [],
    derechos: [],
    carne: undefined,
  };
}
