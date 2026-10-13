// Éxito de la alerta de crecimiento fetal frente a la regla clásica, con las historias de este
// dispositivo. La restricción se confirma con el peso fetal estimado de la ecografía.
import { useEffect, useState } from 'react';
import type { Historia } from '../datos/repositorio';
import type { Proporcion } from '../eventos/metricas';
import { rendimientoCrecimiento, type RendimientoCrecimiento } from '../alertas/crecimientoRendimiento';
import { useApp } from './contexto';

const texto = (p: Proporcion) => (p.valor === null ? 'Sin datos' : `${Math.round(p.valor * 100)} % (${p.numerador} de ${p.denominador})`);

export function PanelRendimientoCrecimiento() {
  const { repo, catalogo, hoy } = useApp();
  const [r, setR] = useState<RendimientoCrecimiento>();

  useEffect(() => {
    void (async () => {
      const historias: Historia[] = [];
      for (const g of await repo.gestantes()) {
        for (const e of await repo.embarazosDe(g.id)) {
          const h = await repo.historia(e.id);
          if (h) historias.push(h);
        }
      }
      setR(rendimientoCrecimiento(historias, hoy(), catalogo));
    })();
  }, [repo, catalogo, hoy]);

  if (!r) return null;
  const corte = catalogo.parametro('crecimiento.ecografia').valor.pfePercentilCorte;
  return (
    <section className="tarjeta">
      <h3>Alerta de crecimiento fetal: app frente a la regla clásica</h3>
      <p className="suave">
        Con las historias de este dispositivo. La restricción se confirma con el peso fetal estimado de la ecografía bajo el percentil {corte}.
      </p>
      <table className="tabla-au">
        <thead>
          <tr><th>Métrica</th><th>App</th><th>Regla clásica (una medición bajo p10)</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Remisiones innecesarias (peso fetal sin restricción) · menos es mejor</td>
            <td>{texto(r.remisionesInnecesarias.app)}</td>
            <td>{texto(r.remisionesInnecesarias.clasica)}</td>
          </tr>
          <tr>
            <td>Restricciones confirmadas con alerta antes de la semana 37</td>
            <td>{texto(r.deteccionAntesDe37.app)}</td>
            <td>{texto(r.deteccionAntesDe37.clasica)}</td>
          </tr>
          <tr>
            <td>Órdenes de la app con ecografía antes del siguiente control</td>
            <td>{texto(r.ecografiaAntesDelSiguienteControl)}</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
