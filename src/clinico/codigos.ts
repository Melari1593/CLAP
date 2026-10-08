// Datos codificados para la interoperabilidad (Ley 2015 de 2020, Resolución 866 de 2021): municipio
// (DIVIPOLA), aseguradora, CUPS de los exámenes y ATC de los medicamentos. Las tablas están en el catálogo.
import type { Catalogo } from './catalogo';
import type { Codificado, TipoExamen, TipoIndicacion } from '../datos/modelo';

export type ListaCodificada = 'codigos.divipola' | 'codigos.aseguradoras';

/** Forma del código escrito a mano: DIVIPOLA de 5 dígitos; EPS como EPS037, EPSS37, ESS024, CCF055 o EPSI06. */
const PATRON: Record<ListaCodificada, RegExp> = {
  'codigos.divipola': /^\d{5}$/,
  'codigos.aseguradoras': /^[A-Z]{3,4}\d{2,3}$/,
};

const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function etiquetaCodificado(c: Codificado | string | undefined): string {
  if (c === undefined) return '';
  if (typeof c === 'string') return c;
  return c.codigo ? `${c.nombre} (${c.codigo})` : c.nombre;
}

/**
 * Interpreta lo escrito: un nombre o un código de la lista, "Nombre (código)" de la lista o escrito a mano
 * (si el código tiene la forma correcta), o solo el nombre (sin código).
 */
export function interpretarCodificado(texto: string, lista: ListaCodificada, catalogo: Catalogo): Codificado | undefined {
  const t = texto.trim().replace(/\s+/g, ' ');
  if (!t) return undefined;
  const opciones = catalogo.valor(lista);
  const conocido = opciones.find((o) => plano(o.nombre) === plano(t) || o.codigo === t.toUpperCase() || plano(etiquetaCodificado(o)) === plano(t));
  if (conocido) return conocido;
  const m = t.match(/^(.+?)\s*\(\s*([\w]+)\s*\)$/);
  if (m) {
    const codigo = m[2]!.toUpperCase();
    if (PATRON[lista].test(codigo)) return { nombre: m[1]!, codigo };
  }
  return { nombre: t, codigo: null };
}

export function cupsDe(tipo: TipoExamen, catalogo: Catalogo): Codificado | undefined {
  return catalogo.valor('codigos.cups')[tipo];
}

export function atcDe(tipo: TipoIndicacion, catalogo: Catalogo) {
  return catalogo.valor('codigos.medicamentos')[tipo] ?? [];
}
