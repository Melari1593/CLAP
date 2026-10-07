// Las gráficas SVG se escalan al ancho disponible. En pantallas angostas el texto se agranda
// (hasta el doble) para seguir legible. Se usa como ref de callback: empieza a medir apenas el
// contenedor aparece, aunque la gráfica se dibuje después de cargar los datos.
import { useCallback, useEffect, useState } from 'react';

export function useEscala(anchoBase: number) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(([e]) => setEscala(Math.min(2, Math.max(1, anchoBase / (e?.contentRect.width || anchoBase)))));
    obs.observe(el);
    return () => obs.disconnect();
  }, [el, anchoBase]);
  const ref = useCallback((nodo: HTMLElement | null) => setEl(nodo), []);
  return { ref, escala };
}
