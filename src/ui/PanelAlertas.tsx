// C1 — Alertas activas (urgentes primero), con el porqué y la decisión del profesional.
import { useEffect, useRef, useState } from 'react';
import type { Alerta } from '../datos/modelo';
import { construirContexto, ordenarAlertas } from '../alertas/motor';
import { notasResumen } from '../alertas/resumen';
import { useApp } from './contexto';

export function PanelAlertas({ embarazoId, version = 0 }: { embarazoId: string; version?: number }) {
  const { motor, repo, catalogo, hoy } = useApp();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [notas, setNotas] = useState<string[]>([]);
  const [nuevas, setNuevas] = useState<Set<string>>(new Set());
  const vistas = useRef<Set<string> | null>(null);

  const cargar = async () => {
    const todas = await motor.sincronizar(embarazoId);
    const activas = todas.filter((a) => a.activa).map((a) => a.id);
    // La primera carga no destaca nada; después se destacan las que acaban de aparecer.
    setNuevas(vistas.current ? new Set(activas.filter((id) => !vistas.current!.has(id))) : new Set());
    vistas.current = new Set(activas);
    setAlertas(todas);
    const historia = await repo.historia(embarazoId);
    setNotas(historia ? notasResumen(construirContexto(historia, hoy(), catalogo)) : []);
  };

  useEffect(() => {
    void cargar();
  }, [embarazoId, version]);

  const decidir = async (alerta: Alerta, opcion: string, requiereMotivo?: boolean) => {
    let motivo: string | undefined;
    if (requiereMotivo) {
      motivo = prompt(`Motivo de "${opcion}":`)?.trim();
      if (!motivo) return;
    }
    await motor.atender(alerta.id, opcion, motivo);
    await cargar();
  };

  const activas = ordenarAlertas(alertas.filter((a) => a.activa));
  const atendidas = alertas.filter((a) => a.vigente && !a.activa);

  return (
    <section className="alertas" aria-label="Alertas">
      <h3>Alertas {activas.length > 0 && <span className="contador">{activas.length}</span>}</h3>
      {activas.length === 0 && <p className="suave">Sin alertas activas.</p>}
      {activas.map((a) => (
        <article key={a.id} className={`alerta ${a.urgente ? 'urgente' : ''} ${nuevas.has(a.id) ? 'nueva' : ''}`} role={nuevas.has(a.id) ? 'alert' : undefined}>
          <h4>{a.urgente && <span aria-hidden>⚠ </span>}{a.titulo}</h4>
          {a.decisionesAnteriores && a.decisionesAnteriores.length > 0 && (
            <p className="suave">Reapareció: la situación cambió después de la última decisión.</p>
          )}
          <ul>{a.porque.map((p) => <li key={p}>{p}</li>)}</ul>
          <div className="botones">
            {a.opciones.map((o) => (
              <button key={o.etiqueta} type="button" onClick={() => void decidir(a, o.etiqueta, o.requiereMotivo)}>
                {o.etiqueta}{o.requiereMotivo ? ' — motivo' : ''}
              </button>
            ))}
            {a.enlace === 'derechos' && (
              <button type="button" disabled title="Llega con el Bloque E">Opciones y derechos (próximamente)</button>
            )}
          </div>
        </article>
      ))}
      {notas.length > 0 && (
        <ul className="notas" aria-label="Notas del resumen">
          {notas.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
      {atendidas.length > 0 && (
        <details>
          <summary>Atendidas ({atendidas.length})</summary>
          <ul className="lista">
            {atendidas.map((a) => (
              <li key={a.id}>
                <strong>{a.titulo}</strong> · {a.decision?.opcion}
                {a.decision?.motivo && ` (${a.decision.motivo})`} · {a.decision?.fecha.slice(0, 10)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
