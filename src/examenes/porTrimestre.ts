// Laboratorios y ecografías por trimestre: lo que la Ruta Materno Perinatal espera en cada momento
// (catálogo `recordatorios.ventanas` y `recordatorios.examenesPrimeraConsulta`) junto con los
// resultados registrados. Los resultados que no corresponden a un examen esperado se listan como
// "otros" en el trimestre de su fecha.
import { clasificarHb } from '../alertas/anemia';
import type { ContextoClinico } from '../alertas/motor';
import { trimestreDeEG } from '../clinico/trimestre';
import { valorDe } from '../datos/campo';
import type { ResultadoExamen, ResultadoPorTipo, TipoExamen } from '../datos/modelo';
import { etiquetaExamen, resumenExamen } from './resumen';

export type EstadoExamen = 'hecho' | 'pendiente' | 'atrasado' | 'proximo';

export interface FilaExamen {
  id: string;
  nombre: string;
  /** Momento esperado, en texto ("semanas 24 a 28"); vacío para los resultados no esperados. */
  momento: string;
  estado: EstadoExamen;
  resultado?: { fecha: string; semana?: string; texto: string; alterado: boolean };
}

export interface GrupoTrimestre {
  trimestre: 1 | 2 | 3;
  titulo: string;
  filas: FilaExamen[];
  otros: FilaExamen[];
}

const semanaTexto = (dias: number) => `${Math.floor(dias / 7)}+${dias % 7}`;

/** Resultado fuera de lo esperado, para resaltarlo (además del texto). */
export function alterado(ctx: ContextoClinico, e: ResultadoExamen): boolean {
  if (e.resultado.estado !== 'valor') return false;
  const r = e.resultado.valor as ResultadoPorTipo[TipoExamen];
  switch (e.tipo) {
    case 'hb': {
      const v = r as ResultadoPorTipo['hb'];
      return clasificarHb(ctx, { ...v, fecha: e.fecha }).grado !== 'sin_anemia';
    }
    case 'vdrl': return (r as ResultadoPorTipo['vdrl']).reactivo;
    case 'vih': return (r as ResultadoPorTipo['vih']).resultado === 'positivo';
    case 'sifilisTreponemica': return (r as ResultadoPorTipo['sifilisTreponemica']).reactiva;
    case 'hepatitisB': return (r as ResultadoPorTipo['hepatitisB']).antigenoSuperficie === 'positivo';
    case 'rubeolaIgG': return !(r as ResultadoPorTipo['rubeolaIgG']).positivo; // sin inmunidad
    case 'varicelaIgG': return !(r as ResultadoPorTipo['varicelaIgG']).positivo; // sin inmunidad
    case 'toxoplasmosis': return (r as ResultadoPorTipo['toxoplasmosis']).igm === 'positivo';
    case 'ecografia': return (r as ResultadoPorTipo['ecografia']).hallazgos === 'anormal';
    case 'coombsIndirecto':
    case 'chagas':
    case 'malaria':
    case 'bacteriuria':
    case 'egb':
      return (r as { positivo: boolean }).positivo;
    case 'inflamacion': return (r as ResultadoPorTipo['inflamacion']).presente;
    default: return false;
  }
}

export function examenesPorTrimestre(ctx: ContextoClinico): GrupoTrimestre[] {
  const { catalogo, historia, primera, eg } = ctx;
  const v = catalogo.valor('recordatorios.ventanas');
  const egHoy = eg.estado === 'calculada' ? eg.dias : undefined;
  const usados = new Set<string>();
  const ordenados = [...historia.examenes].sort((a, b) => (a.fecha + a.creadoEn).localeCompare(b.fecha + b.creadoEn));

  const fila = (id: string, nombre: string, ventana: { desdeSemana: number; hastaSemana: number | null }, e?: ResultadoExamen): FilaExamen => {
    const momento =
      ventana.desdeSemana === 0
        ? `primera consulta (hasta la semana ${ventana.hastaSemana})`
        : `semanas ${ventana.desdeSemana} a ${ventana.hastaSemana ?? '—'}`;
    if (e) {
      usados.add(e.id);
      const d = ctx.egEn(e.fecha);
      return {
        id,
        nombre,
        momento,
        estado: 'hecho',
        resultado: { fecha: e.fecha, semana: d !== undefined ? semanaTexto(d) : undefined, texto: resumenExamen(e), alterado: alterado(ctx, e) },
      };
    }
    let estado: EstadoExamen = 'pendiente';
    if (egHoy !== undefined && egHoy < ventana.desdeSemana * 7) estado = 'proximo';
    else if (egHoy !== undefined && ventana.hastaSemana !== null && egHoy >= (ventana.hastaSemana + 1) * 7) estado = 'atrasado';
    return { id, nombre, momento, estado };
  };

  /** Primer resultado sin usar de alguno de los tipos, dentro de un rango de EG (en semanas). */
  const buscar = (tipos: TipoExamen[], desde: number, hasta: number | null, filtro?: (e: ResultadoExamen) => boolean, reusar = false) =>
    ordenados.find((e) => {
      if (!tipos.includes(e.tipo) || (usados.has(e.id) && !reusar) || e.resultado.estado === 'vacio') return false;
      if (filtro && !filtro(e)) return false;
      const d = ctx.egEn(e.fecha);
      if (d === undefined) return desde === 0;
      return d >= desde * 7 && (hasta === null || d < hasta * 7);
    });
  const esEco = (momento: ResultadoPorTipo['ecografia']['momento']) => (e: ResultadoExamen) =>
    e.tipo === 'ecografia' && e.resultado.estado === 'valor' && (e.resultado.valor as ResultadoPorTipo['ecografia']).momento === momento;

  const tercer = v.examenesTercerTrimestre!;
  const g = primera?.gestacionActual;

  // 1.er trimestre: exámenes de ingreso (primera consulta) y ecografía de 10+6 a 13+6.
  const ingreso = v.examenesPrimeraConsulta!;
  const aplica: Partial<Record<TipoExamen, boolean>> = {
    rubeolaIgG: !['previa', 'embarazo'].includes(valorDe(g?.antirrubeola) ?? ''),
    chagas: valorDe(primera?.identificacion.zonaEndemicaChagas) === true,
    malaria: valorDe(primera?.identificacion.zonaEndemicaMalaria) === true,
  };
  const tiposIngreso = (catalogo.valor('recordatorios.examenesPrimeraConsulta') as TipoExamen[]).filter((t) => aplica[t] !== false);
  if (valorDe(g?.rh) === '-') tiposIngreso.push('coombsIndirecto');
  // Hemoclasificación: grupo y Rh se registran en la primera consulta.
  const grupo = valorDe(g?.grupo);
  const rh = valorDe(g?.rh);
  const filaHemo = fila('ingreso:hemoclasificacion', 'Hemoclasificación (grupo y Rh)', ingreso);
  if (grupo && rh) {
    const fechaPrimera = historia.consultas.find((c) => c.tipo === 'primera')?.fecha ?? ctx.hoy;
    const d = ctx.egEn(fechaPrimera);
    filaHemo.estado = 'hecho';
    filaHemo.resultado = { fecha: fechaPrimera, semana: d !== undefined ? semanaTexto(d) : undefined, texto: `${grupo} ${rh === '+' ? 'positivo' : 'negativo'}`, alterado: rh === '-' };
  }
  const filas1 = [
    filaHemo,
    ...tiposIngreso.map((t) => {
      const tipos: TipoExamen[] = t === 'sifilisTreponemica' ? ['sifilisTreponemica', 'vdrl'] : [t];
      return fila(`ingreso:${t}`, etiquetaExamen(t), ingreso, buscar(tipos, 0, tercer.desdeSemana));
    }),
  ];
  const eco1 = v.ecografiaPrimerTrimestre!;
  const ecoGestacion = valorDe(g?.ecografia);
  const filaEco1 = fila('eco_1t', 'Ecografía de 10+6 a 13+6', eco1, buscar(['ecografia'], 0, null, esEco('primer_trimestre')));
  if (filaEco1.estado !== 'hecho' && ecoGestacion && ecoGestacion.egDias >= eco1.desdeSemana * 7 && ecoGestacion.egDias < ((eco1.hastaSemana ?? 0) + 1) * 7) {
    filaEco1.estado = 'hecho';
    filaEco1.resultado = { fecha: ecoGestacion.fecha, semana: semanaTexto(ecoGestacion.egDias), texto: 'Registrada en la primera consulta', alterado: false };
  }
  filas1.push(filaEco1);

  // 2.º trimestre: VIH y sífilis (cada trimestre), ecografía de detalle y PTOG. Si la primera
  // consulta fue en el segundo trimestre, sus pruebas cuentan también para este trimestre.
  const segundo = v.examenesSegundoTrimestre!;
  const delSegundo = (tipos: TipoExamen[]) =>
    buscar(tipos, segundo.desdeSemana, tercer.desdeSemana) ?? buscar(tipos, segundo.desdeSemana, tercer.desdeSemana, undefined, true);
  const filas2 = [
    fila('segundo:vih', 'VIH del segundo trimestre', segundo, delSegundo(['vih'])),
    fila('segundo:sifilis', 'Sífilis del segundo trimestre', segundo, delSegundo(['sifilisTreponemica', 'vdrl'])),
    fila('eco_detalle', 'Ecografía de detalle', v.ecografiaDetalle!, buscar(['ecografia'], 0, null, esEco('detalle'))),
    fila('ptog', etiquetaExamen('ptog'), v.ptog!, buscar(['ptog'], 0, null)),
  ];

  // 3.er trimestre: hemograma, VIH y sífilis desde la semana 28; estreptococo B de 35 a 37.
  const filas3 = [
    fila('tercer:hb', 'Hemoglobina del tercer trimestre', tercer, buscar(['hb'], tercer.desdeSemana, null)),
    fila('tercer:vih', 'VIH del tercer trimestre', tercer, buscar(['vih'], tercer.desdeSemana, null)),
    fila('tercer:sifilis', 'Sífilis del tercer trimestre', tercer, buscar(['sifilisTreponemica', 'vdrl'], tercer.desdeSemana, null)),
    fila('egb', etiquetaExamen('egb'), v.egb!, buscar(['egb'], 0, null)),
  ];

  // Otros resultados, en el trimestre de su fecha (sin EG calculable: primer trimestre).
  const otros: Record<1 | 2 | 3, FilaExamen[]> = { 1: [], 2: [], 3: [] };
  for (const e of ordenados) {
    if (usados.has(e.id) || e.resultado.estado === 'vacio') continue;
    const d = ctx.egEn(e.fecha);
    const t = d !== undefined && d >= 0 ? trimestreDeEG(d, catalogo) : 1;
    otros[t].push({
      id: e.id,
      nombre: etiquetaExamen(e.tipo),
      momento: '',
      estado: 'hecho',
      resultado: { fecha: e.fecha, semana: d !== undefined ? semanaTexto(d) : undefined, texto: resumenExamen(e), alterado: alterado(ctx, e) },
    });
  }

  return [
    { trimestre: 1, titulo: 'Primer trimestre y exámenes de ingreso', filas: filas1, otros: otros[1] },
    { trimestre: 2, titulo: 'Segundo trimestre', filas: filas2, otros: otros[2] },
    { trimestre: 3, titulo: 'Tercer trimestre', filas: filas3, otros: otros[3] },
  ];
}
