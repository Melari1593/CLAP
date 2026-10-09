// F1 / F2 — Pendientes y atrasados según la semana, e indicaciones vigentes.
import { useEffect, useState } from 'react';
import { construirContexto } from '../alertas/motor';
import type { Indicacion } from '../datos/modelo';
import { recordatorios, type Recordatorio } from '../recordatorios/recordatorios';
import { useApp } from './contexto';

const NOMBRE_INDICACION: Record<Indicacion['tipo'], string> = {
  hierro: 'Hierro',
  acidoFolico: 'Ácido fólico',
  calcio: 'Carbonato de calcio',
  asa: 'ASA',
  tromboprofilaxis: 'Tromboprofilaxis',
  levotiroxina: 'Levotiroxina',
  espiramicina: 'Espiramicina (toxoplasmosis)',
  toxoTratamientoPleno: 'Tratamiento pleno de toxoplasmosis',
  preparacionParto: 'Preparación para el parto',
  lactancia: 'Consejería en lactancia',
};
const ESTADO: Record<Indicacion['estado'], string> = {
  indicado: 'indicado',
  no_indicado: 'no indicado',
  ya_lo_toma: 'ya lo toma',
  referida: 'referida',
  suspendido: 'suspendido',
};

export function PanelPendientes({ embarazoId, version = 0 }: { embarazoId: string; version?: number }) {
  const { repo, catalogo, hoy } = useApp();
  const [lista, setLista] = useState<Recordatorio[]>([]);
  const [indicaciones, setIndicaciones] = useState<Indicacion[]>([]);

  useEffect(() => {
    void (async () => {
      const h = await repo.historia(embarazoId);
      if (!h) return;
      setLista(recordatorios(construirContexto(h, hoy(), catalogo)));
      setIndicaciones(h.indicaciones);
    })();
  }, [embarazoId, version, repo, catalogo, hoy]);

  return (
    <section className="pendientes" aria-label="Pendientes">
      <h3>Pendientes {lista.some((r) => r.estado === 'atrasado') && <span className="contador">{lista.filter((r) => r.estado === 'atrasado').length} atrasados</span>}</h3>
      {lista.length === 0 ? (
        <p className="suave">Nada pendiente para esta semana.</p>
      ) : (
        <ul className="lista">
          {lista.map((r) => (
            <li key={r.id} className={r.estado}>
              {r.estado === 'atrasado' && <strong>Atrasado · </strong>}
              {r.texto}
            </li>
          ))}
        </ul>
      )}
      {indicaciones.length > 0 && (
        <p className="suave">
          Indicaciones: {indicaciones.map((i) => `${NOMBRE_INDICACION[i.tipo]} (${ESTADO[i.estado]})`).join(' · ')}
        </p>
      )}
    </section>
  );
}
