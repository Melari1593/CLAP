// Formulario en bloques cortos, en el orden de la HCP.
import { useState, type ReactNode } from 'react';
import type { Campo } from '../datos/campo';
import { aplicarNoCorresponde, type Bloque, type ContextoFormulario } from '../consultas/esquema';
import { asignar, obtener } from '../consultas/rutas';
import { FilaCampo } from './campos';
import { guardarBorrador, leerBorrador } from './borrador';

export function Formulario<D>({ bloques, datos, onCambio, ctx = {}, clave, extras }: {
  bloques: Bloque<D>[];
  datos: D;
  onCambio: (datos: D) => void;
  ctx?: ContextoFormulario;
  /** Si se da, el bloque abierto sobrevive a una recarga de la página. */
  clave?: string;
  /** Contenido adicional al final de un bloque (por ejemplo, las curvas en el examen físico). */
  extras?: Partial<Record<string, ReactNode>>;
}) {
  const [actual, setActualEstado] = useState(() => (clave ? leerBorrador<number>(`bloque:${clave}`) : undefined) ?? 0);
  const setActual = (i: number) => {
    setActualEstado(i);
    if (clave) guardarBorrador(`bloque:${clave}`, i);
  };
  const bloque = bloques[actual] ?? bloques[0]!;

  const cambiar = (ruta: string, campo: Campo<unknown>) => {
    const nuevo = asignar(datos, ruta, campo);
    onCambio(aplicarNoCorresponde(bloques, nuevo, ctx, datos));
  };

  return (
    <div className="formulario">
      {bloques.length > 1 && (
        <nav className="pasos" aria-label="Bloques del formulario">
          {bloques.map((b, i) => (
            <button key={b.id} type="button" className={i === actual ? 'activo' : ''} aria-current={i === actual ? 'step' : undefined} onClick={() => setActual(i)}>
              {i + 1}. {b.titulo}
            </button>
          ))}
        </nav>
      )}
      <fieldset>
        <legend>{bloque.titulo}</legend>
        {bloque.campos.map((def) =>
          def.control.tipo === 'calculado' ? (
            <div key={def.ruta} className="fila-campo calculado">
              <div className="etiqueta">
                {def.etiqueta}
                {def.ayuda && <small>{def.ayuda}</small>}
              </div>
              <div className="control">
                <output aria-label={def.etiqueta}>{def.control.calcular(datos) ?? '—'}</output>
              </div>
            </div>
          ) : (
            <FilaCampo
              key={def.ruta}
              def={def}
              campo={obtener(datos, def.ruta) as Campo<unknown> | undefined}
              automatico={def.aplica ? !def.aplica(datos, ctx) : false}
              onCambio={(c) => cambiar(def.ruta, c)}
            />
          ),
        )}
        {extras?.[bloque.id]}
      </fieldset>
      {bloques.length > 1 && (
        <div className="navegacion">
          <button type="button" disabled={actual === 0} onClick={() => setActual(actual - 1)}>← Anterior</button>
          <button type="button" disabled={actual === bloques.length - 1} onClick={() => setActual(actual + 1)}>Siguiente →</button>
        </div>
      )}
    </div>
  );
}
