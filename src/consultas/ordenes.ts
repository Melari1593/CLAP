// Fórmula médica y órdenes de paraclínicos de la consulta.
import type { Catalogo, PlantillaMedicamento } from '../clinico/catalogo';
import { cupsDe } from '../clinico/codigos';
import type { OrdenMedicamento, OrdenParaclinico, Ordenes, TipoExamen } from '../datos/modelo';
import { etiquetaExamen } from '../examenes/resumen';

export const ordenesVacias = (): Ordenes => ({ medicamentos: [], paraclinicos: [] });

const id = () => crypto.randomUUID();

export function medicamentoDesde(p?: PlantillaMedicamento): OrdenMedicamento {
  return {
    id: id(),
    principio: p?.principio ?? '',
    atc: p?.atc ?? null,
    presentacion: p?.presentacion ?? '',
    dosis: p?.dosis ?? '',
    via: p?.via ?? '',
    frecuencia: p?.frecuencia ?? '',
    duracion: '',
    cantidad: null,
    indicaciones: p?.indicaciones,
  };
}

export function paraclinicoDe(examen: TipoExamen, catalogo: Catalogo): OrdenParaclinico {
  const cups = cupsDe(examen, catalogo);
  return { id: id(), nombre: cups?.nombre ?? etiquetaExamen(examen), examen, cups: cups?.codigo ?? null };
}

const REQUERIDOS: [keyof OrdenMedicamento, string][] = [
  ['principio', 'medicamento'],
  ['presentacion', 'concentración y forma'],
  ['dosis', 'dosis'],
  ['via', 'vía'],
  ['frecuencia', 'frecuencia'],
  ['duracion', 'duración'],
];

/** Lo que falta en cada línea de la fórmula (Decreto 2200 de 2005). Vacío si está completa. */
export function faltantesMedicamento(m: OrdenMedicamento): string[] {
  const faltan = REQUERIDOS.filter(([k]) => !String(m[k] ?? '').trim()).map(([, nombre]) => nombre);
  if (!m.cantidad || m.cantidad <= 0) faltan.push('cantidad total');
  return faltan;
}

export function ordenesIncompletas(o: Ordenes | undefined): string[] {
  return (o?.medicamentos ?? []).flatMap((m, i) => {
    const faltan = faltantesMedicamento(m);
    return faltan.length ? [`${m.principio || `línea ${i + 1}`}: falta ${faltan.join(', ')}`] : [];
  });
}

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function hasta999(n: number): string {
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const resto = r < 30 ? UNIDADES[r]! : `${DECENAS[Math.floor(r / 10)]}${r % 10 ? ` y ${UNIDADES[r % 10]}` : ''}`;
  return [CENTENAS[c], resto].filter(Boolean).join(' ');
}

/** Cantidad en letras para la fórmula (0 a 999.999). */
export function numeroEnLetras(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) return String(n);
  if (n === 0) return 'cero';
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const m = miles === 0 ? '' : miles === 1 ? 'mil' : `${hasta999(miles).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')} mil`;
  return [m, resto ? hasta999(resto) : ''].filter(Boolean).join(' ');
}
