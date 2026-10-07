// Laboratorios y ecografías por trimestre: lo esperado según la Ruta y los resultados registrados.
// Solo para el profesional; nada de esto va al carné.
import { useEffect, useState } from 'react';
import { construirContexto } from '../alertas/motor';
import { trimestreDeEG } from '../clinico/trimestre';
import { examenesPorTrimestre, type EstadoExamen, type FilaExamen, type GrupoTrimestre } from '../examenes/porTrimestre';
import { useApp } from './contexto';

const ESTADO: Record<EstadoExamen, string> = {
  hecho: 'Hecho',
  pendiente: 'Pendiente',
  atrasado: 'Atrasado',
  proximo: 'Próximo',
};

function Fila({ f }: { f: FilaExamen }) {
  return (
    <li className={`lab-fila ${f.resultado?.alterado ? 'alterado' : ''}`}>
      <div className="lab-nombre">
        <strong>{f.nombre}</strong>
        {f.momento && <small className="suave"> · {f.momento}</small>}
      </div>
      {f.resultado ? (
        <div className="lab-resultado">
          {f.resultado.alterado && <span className="lab-marca" aria-label="Resultado alterado">⚠ Alterado · </span>}
          {f.resultado.texto}
          <small className="suave"> · {f.resultado.fecha}{f.resultado.semana && ` (semana ${f.resultado.semana})`}</small>
        </div>
      ) : (
        <span className={`lab-estado ${f.estado}`}>{ESTADO[f.estado]}</span>
      )}
    </li>
  );
}

export function PanelLaboratorios({ embarazoId, version = 0 }: { embarazoId: string; version?: number }) {
  const { repo, catalogo, hoy } = useApp();
  const [grupos, setGrupos] = useState<GrupoTrimestre[]>();
  const [trimestreActual, setTrimestreActual] = useState<number>();

  useEffect(() => {
    void (async () => {
      const historia = await repo.historia(embarazoId);
      if (!historia) return;
      const ctx = construirContexto(historia, hoy(), catalogo);
      setGrupos(examenesPorTrimestre(ctx));
      setTrimestreActual(ctx.eg.estado === 'calculada' ? trimestreDeEG(ctx.eg.dias, catalogo) : undefined);
    })();
  }, [repo, catalogo, hoy, embarazoId, version]);

  if (!grupos) return null;
  return (
    <section className="laboratorios" aria-label="Laboratorios y ecografías por trimestre">
      <h3>Laboratorios y ecografías por trimestre</h3>
      {grupos.map((g) => (
        <details key={g.trimestre} open={trimestreActual === undefined || g.trimestre <= trimestreActual}>
          <summary>
            {g.titulo}
            {trimestreActual === g.trimestre && <span className="etiqueta-estado"> actual</span>}
          </summary>
          <ul className="lab-lista">{g.filas.map((f) => <Fila key={f.id} f={f} />)}</ul>
          {g.otros.length > 0 && (
            <>
              <p className="lab-otros">Otros resultados</p>
              <ul className="lab-lista">{g.otros.map((f) => <Fila key={f.id} f={f} />)}</ul>
            </>
          )}
        </details>
      ))}
    </section>
  );
}
