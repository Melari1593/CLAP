// Lectura y escritura por ruta ("gestacionActual.fum") sobre objetos de datos, sin mutarlos.

export function obtener(objeto: unknown, ruta: string): unknown {
  return ruta.split('.').reduce<unknown>(
    (actual, clave) => (typeof actual === 'object' && actual !== null ? (actual as Record<string, unknown>)[clave] : undefined),
    objeto,
  );
}

export function asignar<T>(objeto: T, ruta: string, valor: unknown): T {
  const [clave, ...resto] = ruta.split('.');
  if (clave === undefined) return objeto;
  const base = (typeof objeto === 'object' && objeto !== null ? objeto : {}) as Record<string, unknown>;
  return {
    ...base,
    [clave]: resto.length === 0 ? valor : asignar(base[clave], resto.join('.'), valor),
  } as T;
}
