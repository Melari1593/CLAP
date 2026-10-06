// A1 — Pantalla de solo lectura del catálogo para el equipo clínico.
import { Catalogo } from '../clinico/catalogo';

function mostrar(valor: unknown): string {
  if (valor === null) return 'Sin definir';
  if (typeof valor === 'object') return JSON.stringify(valor, null, 2);
  return String(valor);
}

export function PantallaCatalogo({ catalogo = new Catalogo() }: { catalogo?: Catalogo }) {
  const parametros = catalogo.lista();
  const pendientes = parametros.filter((p) => p.estado === 'pendiente').length;
  return (
    <section>
      <h2>Catálogo de parámetros clínicos</h2>
      <p>
        {parametros.length} parámetros · <strong>{pendientes} pendientes de validar</strong>. Solo lectura.
      </p>
      {parametros.map((p) => (
        <article key={p.id} className={`parametro ${p.estado}`}>
          <header>
            <h3>{p.nombre}</h3>
            <span className="estado">{p.estado === 'decidido' ? 'Decidido' : 'Pendiente de validar'}</span>
          </header>
          <pre>{mostrar(p.valor)}</pre>
          <dl>
            {p.unidad && (<><dt>Unidad</dt><dd>{p.unidad}</dd></>)}
            <dt>Fuente</dt>
            <dd>{p.fuentes.join(' · ')}</dd>
            <dt>Revisado</dt>
            <dd>{p.revisado}</dd>
            {p.nota && (<><dt>Nota</dt><dd>{p.nota}</dd></>)}
            <dt>Id</dt>
            <dd><code>{p.id}</code></dd>
          </dl>
        </article>
      ))}
    </section>
  );
}
