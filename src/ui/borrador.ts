// Copia de lo que se está llenando en esta pestaña (sessionStorage): si la página se recarga
// antes de guardar, se recupera. Se borra al salir de la pantalla y al cerrar la pestaña.
const PREFIJO = 'hcp-borrador:';

export function leerBorrador<T>(clave: string): T | undefined {
  try {
    const texto = sessionStorage.getItem(PREFIJO + clave);
    return texto ? (JSON.parse(texto) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function guardarBorrador(clave: string, valor: unknown): void {
  try {
    sessionStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento disponible: solo se pierde la recuperación tras recargar.
  }
}

export function borrarBorrador(clave: string): void {
  try {
    sessionStorage.removeItem(PREFIJO + clave);
  } catch {
    // Nada que borrar.
  }
}
