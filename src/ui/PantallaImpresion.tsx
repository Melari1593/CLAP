// F6 — Carné impreso: el mismo contenido y las mismas exclusiones que el carné web. Funciona sin conexión.
import { useEffect, useState } from 'react';
import type { DatosCarne } from '../privacidad/carne';
import { CarneGestante } from './CarneGestante';
import { useApp } from './contexto';
import type { Idioma } from '../i18n/motor';
import { cargarIdioma } from '../i18n/dom';

export function PantallaImpresion({ embarazoId, volver }: { embarazoId: string; volver: () => void }) {
  const { carnes } = useApp();
  const [datos, setDatos] = useState<DatosCarne | null>();
  const [idioma, setIdioma] = useState<Idioma>('es');

  useEffect(() => {
    void carnes.carneDe(embarazoId).then((c) => setIdioma(c?.idioma ?? 'es'));
    void carnes.vistaPrevia(embarazoId).then((d) => setDatos(d ?? null));
  }, [carnes, embarazoId]);

  useEffect(() => {
    // Espera el diccionario del idioma del carné antes de abrir la impresión.
    if (datos) void cargarIdioma(idioma).then(() => window.setTimeout(() => window.print(), 400));
  }, [datos, idioma]);

  if (datos === undefined) return <p>Preparando…</p>;
  return (
    <section className="impresion">
      <div className="no-imprimir navegacion">
        <button type="button" onClick={volver}>← Volver</button>
        <button type="button" className="primario" onClick={() => window.print()}>Imprimir</button>
      </div>
      {datos ? <CarneGestante datos={datos} idioma={idioma} /> : <p>Primero cree el carné al cerrar la consulta.</p>}
    </section>
  );
}
