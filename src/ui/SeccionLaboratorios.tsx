// Laboratorios y ecografías: registrar, corregir o anular resultados, y verlos por trimestre.
// Se usa en su propia pantalla (desde la ficha) y dentro de la primera consulta y de los controles.
import { useEffect, useState, type ReactNode } from 'react';
import type { ResultadoExamen, TipoExamen } from '../datos/modelo';
import type { Historia } from '../datos/repositorio';
import { construirContexto } from '../alertas/motor';
import { clasificarHb, explicarHb } from '../alertas/anemia';
import { cupsDe } from '../clinico/codigos';
import { etiquetaExamen, resumenExamen } from '../examenes/resumen';
import { FormExamen } from './FormExamen';
import { PanelLaboratorios } from './PanelLaboratorios';
import { useApp } from './contexto';

const conValor = (valor: unknown) => ({ estado: 'valor', valor }) as ResultadoExamen['resultado'];

export function SeccionLaboratorios({ embarazoId, consultaId, alCambiar, version = 0, enBloque }: {
  embarazoId: string;
  /** Consulta en la que se registra; null desde la pantalla de laboratorios. */
  consultaId: string | null;
  alCambiar?: () => void;
  version?: number;
  /** Dentro de un bloque del formulario, que ya tiene su título. */
  enBloque?: boolean;
}) {
  const { repo, servicio, hoy, catalogo } = useApp();
  const [historia, setHistoria] = useState<Historia>();
  const [editando, setEditando] = useState<string>();
  const [cambios, setCambios] = useState(0);
  const [mensaje, setMensaje] = useState<string>();

  const cargar = async () => setHistoria(await repo.historia(embarazoId));
  useEffect(() => {
    void cargar();
  }, [embarazoId, version]);

  const listo = async (texto: string) => {
    setEditando(undefined);
    setMensaje(texto);
    setCambios((n) => n + 1);
    await cargar();
    alCambiar?.();
  };

  const registrar = async (tipo: TipoExamen, valor: unknown, fecha: string) => {
    await servicio.registrarExamen({ embarazoId, consultaId, fecha, tipo, resultado: conValor(valor) } as Parameters<typeof servicio.registrarExamen>[0]);
    await listo(`${etiquetaExamen(tipo)} registrado.`);
  };

  const anular = async (e: ResultadoExamen) => {
    const motivo = prompt(`Anular "${etiquetaExamen(e.tipo)}" del ${e.fecha}. No se borra: queda en la historia. Motivo:`);
    if (!motivo?.trim()) return;
    await servicio.anularExamen(e.id, motivo);
    await listo('Resultado anulado.');
  };

  const examenes = [...(historia?.examenes ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ctx = historia ? construirContexto(historia, hoy(), catalogo) : undefined;

  return (
    <Marco enBloque={enBloque}>
      <FormExamen onRegistrar={registrar} />
      {mensaje && <p className="aviso" role="status">{mensaje}</p>}

      <h4>Resultados registrados</h4>
      <ul className="lista">
        {examenes.length === 0 && <li className="suave">Sin resultados registrados.</li>}
        {examenes.map((e) =>
          editando === e.id ? (
            <li key={e.id}>
              <FormExamen
                inicial={e}
                onCancelar={() => setEditando(undefined)}
                onRegistrar={async (_tipo, valor, fecha) => {
                  await servicio.corregirExamen(e.id, { fecha, resultado: conValor(valor) });
                  await listo('Resultado corregido. El cambio queda en la bitácora.');
                }}
              />
            </li>
          ) : (
            <li key={e.id}>
              <strong>{etiquetaExamen(e.tipo)}</strong>
              {cupsDe(e.tipo, catalogo) && <small className="suave"> (CUPS {cupsDe(e.tipo, catalogo)!.codigo})</small>} · {e.fecha} · {resumenExamen(e)}
              {e.tipo === 'vih' && <span className="privado"> 🔒</span>}
              {e.tipo === 'hb' && e.resultado.estado === 'valor' && ctx && (
                <small className="bloque">{explicarHb(clasificarHb(ctx, { ...e.resultado.valor, fecha: e.fecha }))}</small>
              )}{' '}
              <button type="button" className="enlace" onClick={() => setEditando(e.id)}>Corregir</button>
              <button type="button" className="enlace" onClick={() => void anular(e)}>Anular</button>
            </li>
          ),
        )}
      </ul>
      <PanelLaboratorios embarazoId={embarazoId} version={version + cambios} />
    </Marco>
  );
}

function Marco({ enBloque, children }: { enBloque?: boolean; children: ReactNode }) {
  if (enBloque) return <div className="seccion-laboratorios">{children}</div>;
  return (
    <fieldset className="seccion-laboratorios">
      <legend>🧪 Laboratorios y ecografías</legend>
      {children}
    </fieldset>
  );
}
