// Fórmula médica y órdenes de paraclínicos de la consulta.
import type { Catalogo, PlantillaMedicamento } from '../clinico/catalogo';
import { cupsDe } from '../clinico/codigos';
import type { OrdenMedicamento, OrdenParaclinico, OrdenRemision, Ordenes, TipoExamen } from '../datos/modelo';
import { etiquetaExamen } from '../examenes/resumen';

export const ordenesVacias = (): Ordenes => ({ medicamentos: [], paraclinicos: [], remisiones: [] });

/** Servicios sugeridos al escribir la remisión; se puede escribir cualquier otro. */
export const SERVICIOS_REMISION = [
  'Ginecobstetricia (control prenatal de alto riesgo)',
  'Urgencias obstétricas',
  'Medicina materno fetal',
  'Nutrición',
  'Psicología',
  'Trabajo social',
  'Odontología',
  'Medicina interna',
  'Endocrinología',
  'Infectología',
  'Curso de preparación para la maternidad y la paternidad',
  'Vacunación',
];

export const PRIORIDAD_REMISION: Record<OrdenRemision['prioridad'], string> = {
  urgente: 'Urgente (hoy)',
  prioritaria: 'Prioritaria',
  programada: 'Programada',
};

export function nuevaRemision(): OrdenRemision {
  return { id: crypto.randomUUID(), servicio: '', motivo: '', prioridad: 'programada' };
}

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

export function faltantesRemision(r: OrdenRemision): string[] {
  return [!r.servicio.trim() && 'servicio', !r.motivo.trim() && 'motivo'].filter((x): x is string => Boolean(x));
}

export function ordenesIncompletas(o: Ordenes | undefined): string[] {
  const medicamentos = (o?.medicamentos ?? []).flatMap((m, i) => {
    const faltan = faltantesMedicamento(m);
    return faltan.length ? [`${m.principio || `línea ${i + 1}`}: falta ${faltan.join(', ')}`] : [];
  });
  const remisiones = (o?.remisiones ?? []).flatMap((r, i) => {
    const faltan = faltantesRemision(r);
    return faltan.length ? [`remisión ${r.servicio || i + 1}: falta ${faltan.join(', ')}`] : [];
  });
  return [...medicamentos, ...remisiones];
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
