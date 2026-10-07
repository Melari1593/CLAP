// La app no se recarga sola cuando hay una versión nueva: avisa y el profesional decide cuándo
// actualizar, para no perder lo que está llenando.
import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

let actualizar: ((recargar?: boolean) => Promise<void>) | undefined;
let hayVersionNueva = false;
const EVENTO = 'hcp-version-nueva';

export function registrarServiceWorker(): void {
  actualizar = registerSW({
    immediate: true,
    onNeedRefresh() {
      hayVersionNueva = true;
      window.dispatchEvent(new Event(EVENTO));
    },
  });
}

export function AvisoActualizacion() {
  const [nueva, setNueva] = useState(hayVersionNueva);
  useEffect(() => {
    const avisar = () => setNueva(true);
    window.addEventListener(EVENTO, avisar);
    return () => window.removeEventListener(EVENTO, avisar);
  }, []);
  if (!nueva) return null;
  return (
    <p className="actualizacion" role="status">
      Hay una versión nueva de la app. Guarde lo que está llenando y luego{' '}
      <button type="button" onClick={() => void actualizar?.(true)}>Actualizar</button>
    </p>
  );
}
