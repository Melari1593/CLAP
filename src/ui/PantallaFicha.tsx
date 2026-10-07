// Ficha de la gestante: embarazo actual, cálculos y consultas. (El resumen completo con
// alertas y pendientes es la tarea F2.)
import { useEffect, useState } from 'react';
import type { Embarazo, Gestante } from '../datos/modelo';
import type { Historia } from '../datos/repositorio';
import { useApp, type Pantalla } from './contexto';
import { PanelCalculos } from './PanelCalculos';
import { PanelAlertas } from './PanelAlertas';
import { PanelPendientes } from './PanelPendientes';
import { GraficaAlturaUterina } from './GraficaAlturaUterina';
import { GraficaIMC } from './GraficaIMC';

export function PantallaFicha({ gestanteId, aviso, ir }: { gestanteId: string; aviso?: string; ir: (p: Pantalla) => void }) {
  const { repo, servicio } = useApp();
  const [gestante, setGestante] = useState<Gestante>();
  const [embarazos, setEmbarazos] = useState<Embarazo[]>([]);
  const [historia, setHistoria] = useState<Historia>();

  const cargar = async () => {
    setGestante(await repo.leer('gestantes', gestanteId));
    const lista = await repo.embarazosDe(gestanteId);
    setEmbarazos(lista);
    const activo = lista.find((e) => e.estado === 'activo');
    setHistoria(activo ? await repo.historia(activo.id) : undefined);
  };

  useEffect(() => {
    void cargar();
  }, [gestanteId]);

  if (!gestante) return <p>Cargando…</p>;
  const activo = embarazos.find((e) => e.estado === 'activo');
  const primera = historia?.consultas.find((c) => c.tipo === 'primera');
  const anteriores = embarazos.filter((e) => e.estado === 'cerrado');

  const nuevoEmbarazo = async () => {
    if (!confirm('¿Abrir un embarazo nuevo? El actual se conserva como antecedente.')) return;
    await servicio.nuevoEmbarazo(gestanteId);
    await cargar();
  };

  return (
    <section>
      {aviso && <p className="aviso">{aviso}</p>}
      <h2>{gestante.nombres} {gestante.apellidos}</h2>
      <p className="suave">{gestante.documentoTipo} {gestante.documentoNumero}</p>

      {activo && historia ? (
        <>
          <PanelCalculos gestante={gestante} datos={primera?.primera} />
          <PanelAlertas embarazoId={activo.id} abrirDerechos={() => ir({ tipo: 'derechos', gestanteId, embarazoId: activo.id })} />
          <PanelPendientes embarazoId={activo.id} />
          <GraficaAlturaUterina embarazoId={activo.id} />
          <GraficaIMC embarazoId={activo.id} />
          <h3>Consultas de este embarazo</h3>
          <ul className="consultas">
            {historia.consultas.length === 0 && <li>Aún no hay consultas.</li>}
            {historia.consultas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="resultado"
                  onClick={() => ir({ tipo: c.tipo, gestanteId, embarazoId: activo.id, consultaId: c.id })}
                >
                  <strong>{c.fecha}</strong> · {c.tipo === 'primera' ? 'Primera consulta' : 'Control'}
                  {!c.cerrada && <span className="etiqueta-estado"> abierta</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="navegacion">
            {!primera ? (
              <button type="button" className="primario" onClick={() => ir({ tipo: 'primera', gestanteId, embarazoId: activo.id })}>
                Iniciar primera consulta
              </button>
            ) : (
              <button type="button" className="primario" onClick={() => ir({ tipo: 'seguimiento', gestanteId, embarazoId: activo.id })}>
                Nuevo control de seguimiento
              </button>
            )}
            {historia.carne && <button type="button" onClick={() => ir({ tipo: 'impresion', gestanteId, embarazoId: activo.id })}>Reimprimir carné</button>}
            <button type="button" onClick={() => ir({ tipo: 'derechos', gestanteId, embarazoId: activo.id })}>🔒 Opciones y derechos</button>
            <button type="button" onClick={nuevoEmbarazo}>Abrir embarazo nuevo</button>
          </div>
        </>
      ) : (
        <>
          <p>No tiene un embarazo activo.</p>
          <button type="button" className="primario" onClick={nuevoEmbarazo}>Abrir embarazo nuevo</button>
        </>
      )}
      {anteriores.length > 0 && <p className="suave">Embarazos anteriores registrados: {anteriores.length}.</p>}
    </section>
  );
}
