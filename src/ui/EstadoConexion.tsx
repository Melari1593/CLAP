// A4 — Aviso de conexión y de lo que queda pendiente de enviar.
import { useEffect, useState } from 'react';
import type { BaseDatos } from '../datos/bd';
import { resumenCola } from '../sync/cola';

export function EstadoConexion({ bd }: { bd: BaseDatos }) {
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [cola, setCola] = useState({ pendientes: 0, conflictos: 0 });

  useEffect(() => {
    const actualizar = () => {
      setEnLinea(navigator.onLine);
      void resumenCola(bd).then(setCola);
    };
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    const intervalo = window.setInterval(actualizar, 5000);
    actualizar();
    return () => {
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
      window.clearInterval(intervalo);
    };
  }, [bd]);

  return (
    <div className={`conexion ${enLinea ? 'en-linea' : 'sin-conexion'}`} role="status">
      {enLinea ? 'En línea' : 'Sin conexión: todo se guarda en este dispositivo'}
      {cola.pendientes > 0 && ` · ${cola.pendientes} pendiente(s) de enviar`}
      {cola.conflictos > 0 && ` · ${cola.conflictos} conflicto(s) por revisar`}
    </div>
  );
}
