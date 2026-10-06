// Formulario en bloques cortos, en el orden de la HCP.
import { useState } from 'react';
import type { Campo } from '../datos/campo';
import { aplicarNoCorresponde, type Bloque, type ContextoFormulario } from '../consultas/esquema';
import { asignar, obtener } from '../consultas/rutas';
import { FilaCampo } from './campos';

export function Formulario<D>({ bloques, datos, onCambio, ctx = {} }: {
  bloques: Bloque<D>[];
  datos: D;
  onCambio: (datos: D) => void;
  ctx?: ContextoFormulario;
}) {
  const [actual, setActual] = useState(0);
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
        {bloque.campos.map((def) => (
          <FilaCampo
            key={def.ruta}
            def={def}
            campo={obtener(datos, def.ruta) as Campo<unknown> | undefined}
            automatico={def.aplica ? !def.aplica(datos, ctx) : false}
            onCambio={(c) => cambiar(def.ruta, c)}
          />
        ))}
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
