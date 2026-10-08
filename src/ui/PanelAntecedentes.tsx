// Antecedentes registrados en la primera consulta, visibles en la ficha.
import type { DatosPrimeraConsulta } from '../datos/modelo';
import { resumenAntecedentes } from '../consultas/antecedentes';

export function PanelAntecedentes({ datos, onEditar }: { datos?: DatosPrimeraConsulta; onEditar?: () => void }) {
  return (
    <section className="antecedentes" aria-label="Antecedentes">
      <h3>Antecedentes</h3>
      {!datos ? (
        <p className="suave">Se registran en la primera consulta.</p>
      ) : (
        <>
          {resumenAntecedentes(datos).map((g) => (
            <details key={g.titulo} open={g.datos.length > 0}>
              <summary>
                {g.titulo}
                {g.datos.length > 0 && <span className="etiqueta-estado"> {g.datos.length}</span>}
              </summary>
              {g.datos.length > 0 ? (
                <ul>{g.datos.map((d) => <li key={d}>{d}</li>)}</ul>
              ) : (
                <p className="suave">Sin antecedentes positivos.</p>
              )}
              {g.negados.length > 0 && <p className="suave"><strong>Niega:</strong> {g.negados.join(', ')}.</p>}
              {g.sinRegistrar > 0 && <p className="suave">{g.sinRegistrar} sin registrar.</p>}
            </details>
          ))}
          <p className="suave">Los datos privados (violencia, sustancias, vida sexual) no se muestran aquí.</p>
          {onEditar && <button type="button" onClick={onEditar}>Editar antecedentes</button>}
        </>
      )}
    </section>
  );
}
