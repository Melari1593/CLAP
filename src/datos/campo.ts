// Cada dato de la HCP admite, además del valor, tres estados: "no se hizo", "no corresponde" y vacío.

export type Campo<T> =
  | { estado: 'valor'; valor: T }
  | { estado: 'no_se_hizo' }
  | { estado: 'no_corresponde' }
  | { estado: 'vacio' };

export const valor = <T>(v: T): Campo<T> => ({ estado: 'valor', valor: v });
export const vacio = <T>(): Campo<T> => ({ estado: 'vacio' });
export const noSeHizo = <T>(): Campo<T> => ({ estado: 'no_se_hizo' });
export const noCorresponde = <T>(): Campo<T> => ({ estado: 'no_corresponde' });

export function valorDe<T>(campo: Campo<T> | undefined): T | undefined {
  return campo?.estado === 'valor' ? campo.valor : undefined;
}

function esCampo(x: unknown): x is Campo<unknown> {
  if (typeof x !== 'object' || x === null || !('estado' in x)) return false;
  const estado = (x as { estado: unknown }).estado;
  return estado === 'valor' || estado === 'vacio' || estado === 'no_se_hizo' || estado === 'no_corresponde';
}

/** Rutas de los campos que quedaron vacíos (para listarlos al cerrar la consulta). */
export function camposVacios(objeto: unknown, prefijo = ''): string[] {
  if (esCampo(objeto)) return objeto.estado === 'vacio' ? [prefijo] : [];
  if (typeof objeto !== 'object' || objeto === null) return [];
  return Object.entries(objeto).flatMap(([clave, hijo]) =>
    camposVacios(hijo, prefijo ? `${prefijo}.${clave}` : clave),
  );
}
