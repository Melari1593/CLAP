// Pantalla propia de laboratorios y ecografías, abierta desde la ficha de la gestante.
import { useEffect, useState } from 'react';
import type { Gestante } from '../datos/modelo';
import { useApp, type Pantalla } from './contexto';
import { SeccionLaboratorios } from './SeccionLaboratorios';

export function PantallaLaboratorios({ gestanteId, embarazoId, ir }: { gestanteId: string; embarazoId: string; ir: (p: Pantalla) => void }) {
  const { repo } = useApp();
  const [gestante, setGestante] = useState<Gestante>();
  useEffect(() => {
    void repo.leer('gestantes', gestanteId).then(setGestante);
  }, [repo, gestanteId]);
  if (!gestante) return <p>Cargando…</p>;
  return (
    <section>
      <button type="button" className="enlace" onClick={() => ir({ tipo: 'ficha', gestanteId })}>← {gestante.nombres} {gestante.apellidos}</button>
      <h2>Laboratorios y ecografías</h2>
      <SeccionLaboratorios embarazoId={embarazoId} consultaId={null} />
    </section>
  );
}
