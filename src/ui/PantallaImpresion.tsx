// F6 — Carné impreso: el mismo contenido y las mismas exclusiones que el carné web. Funciona sin conexión.
import { useEffect, useState } from 'react';
import type { DatosCarne } from '../privacidad/carne';
import { CarneGestante } from './CarneGestante';
import { useApp } from './contexto';

export function PantallaImpresion({ embarazoId, volver }: { embarazoId: string; volver: () => void }) {
  const { carnes } = useApp();
  const [datos, setDatos] = useState<DatosCarne | null>();

  useEffect(() => {
    void carnes.vistaPrevia(embarazoId).then((d) => setDatos(d ?? null));
  }, [carnes, embarazoId]);

  useEffect(() => {
    if (datos) window.setTimeout(() => window.print(), 300);
  }, [datos]);

  if (datos === undefined) return <p>Preparando…</p>;
  return (
    <section className="impresion">
      <div className="no-imprimir navegacion">
        <button type="button" onClick={volver}>← Volver</button>
        <button type="button" className="primario" onClick={() => window.print()}>Imprimir</button>
      </div>
      {datos ? <CarneGestante datos={datos} /> : <p>Primero cree el carné al cerrar la consulta.</p>}
    </section>
  );
}
