// Controles para un Campo<T>: el valor, más "No se hizo", "No corresponde" y borrar.
import { useState, type ReactNode } from 'react';
import { valorDe, type Campo } from '../datos/campo';
import type { DefCampo } from '../consultas/esquema';
import { correoValido } from '../consultas/validaciones';
import { CIE10_FRECUENTES } from '../clinico/cie10';
import type { DiagnosticoCie10 } from '../datos/modelo';

type Cambio = (campo: Campo<unknown>) => void;
const vacio: Campo<unknown> = { estado: 'vacio' };
const conValor = (v: unknown): Campo<unknown> => ({ estado: 'valor', valor: v });

function numero(texto: string): number | undefined {
  if (texto.trim() === '') return undefined;
  const n = Number(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function Numero({ valor, onCambio, decimales, unidad, etiqueta }: {
  valor: number | undefined;
  onCambio: (n: number | undefined) => void;
  decimales?: boolean;
  unidad?: string;
  etiqueta: string;
}) {
  return (
    <span className="numero">
      <input
        type="number"
        inputMode={decimales ? 'decimal' : 'numeric'}
        step={decimales ? '0.1' : '1'}
        aria-label={etiqueta}
        value={valor ?? ''}
        onChange={(e) => onCambio(numero(e.target.value))}
      />
      {unidad && <span className="unidad">{unidad}</span>}
    </span>
  );
}

function Correo({ valor, onCambio }: { valor: string | undefined; onCambio: Cambio }) {
  const [texto, setTexto] = useState(valor ?? '');
  const invalido = texto.trim() !== '' && !correoValido(texto);
  return (
    <span>
      <input
        type="email"
        inputMode="email"
        aria-label="Correo electrónico"
        aria-invalid={invalido}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          const t = e.target.value.trim();
          onCambio(t === '' ? vacio : conValor(t));
        }}
      />
      {invalido && <span className="error"> Revise el correo: parece mal escrito.</span>}
    </span>
  );
}

/** Fecha de la ecografía y EG en semanas + días. Guarda el valor cuando hay fecha y semanas. */
function Ecografia({ valor, onCambio }: { valor: { fecha: string; egDias: number } | undefined; onCambio: (v: unknown) => void }) {
  const [fecha, setFecha] = useState(valor?.fecha ?? '');
  const [semanas, setSemanas] = useState<number | undefined>(valor ? Math.floor(valor.egDias / 7) : undefined);
  const [dias, setDias] = useState<number | undefined>(valor ? valor.egDias % 7 : undefined);
  const emitir = (f: string, s: number | undefined, d: number | undefined) =>
    onCambio(f && s !== undefined ? { fecha: f, egDias: s * 7 + Math.min(Math.max(d ?? 0, 0), 6) } : undefined);
  return (
    <span className="compuesto">
      <input type="date" aria-label="Fecha de la ecografía" value={fecha} onChange={(e) => { setFecha(e.target.value); emitir(e.target.value, semanas, dias); }} />
      <span>EG</span>
      <Numero etiqueta="Semanas por eco" unidad="sem" valor={semanas} onCambio={(n) => { setSemanas(n); emitir(fecha, n, dias); }} />
      <Numero etiqueta="Días por eco" unidad="d" valor={dias} onCambio={(n) => { setDias(n); emitir(fecha, semanas, n); }} />
    </span>
  );
}

/** Nuevo municipio y altitud. Guarda el valor cuando están los dos. */
function Residencia({ valor, onCambio }: { valor: { municipio: string; altitudM: number } | undefined; onCambio: (v: unknown) => void }) {
  const [municipio, setMunicipio] = useState(valor?.municipio ?? '');
  const [altitud, setAltitud] = useState<number | undefined>(valor?.altitudM);
  const emitir = (m: string, a: number | undefined) => onCambio(m.trim() && a !== undefined ? { municipio: m.trim(), altitudM: a } : undefined);
  return (
    <span className="compuesto">
      <input type="text" aria-label="Nuevo municipio" placeholder="Municipio" value={municipio} onChange={(e) => { setMunicipio(e.target.value); emitir(e.target.value, altitud); }} />
      <Numero etiqueta="Nueva altitud" unidad="m s. n. m." valor={altitud} onCambio={(n) => { setAltitud(n); emitir(municipio, n); }} />
    </span>
  );
}

function ControlValor<D>({ def, campo, onCambio }: { def: DefCampo<D>; campo: Campo<unknown>; onCambio: Cambio }) {
  const v = valorDe(campo);
  const c = def.control;
  const poner = (x: unknown) => onCambio(x === undefined ? vacio : conValor(x));

  switch (c.tipo) {
    case 'sino':
      return (
        <span className="botones" role="radiogroup" aria-label={def.etiqueta}>
          {[true, false].map((b) => (
            <button key={String(b)} type="button" role="radio" aria-checked={v === b} className={v === b ? 'activo' : ''} onClick={() => poner(b)}>
              {b ? 'Sí' : 'No'}
            </button>
          ))}
        </span>
      );
    case 'numero':
      return <Numero etiqueta={def.etiqueta} valor={v as number | undefined} onCambio={poner} decimales={c.decimales} unidad={c.unidad} />;
    case 'texto':
      return c.largo ? (
        <textarea aria-label={def.etiqueta} value={(v as string) ?? ''} onChange={(e) => poner(e.target.value || undefined)} rows={3} />
      ) : (
        <input type="text" aria-label={def.etiqueta} value={(v as string) ?? ''} onChange={(e) => poner(e.target.value || undefined)} />
      );
    case 'correo':
      return <Correo valor={v as string | undefined} onCambio={onCambio} />;
    case 'fecha':
      return <input type="date" aria-label={def.etiqueta} value={(v as string) ?? ''} onChange={(e) => poner(e.target.value || undefined)} />;
    case 'opciones':
      return c.opciones.length <= 4 ? (
        <span className="botones" role="radiogroup" aria-label={def.etiqueta}>
          {c.opciones.map((o) => (
            <button key={o.valor} type="button" role="radio" aria-checked={v === o.valor} className={v === o.valor ? 'activo' : ''} onClick={() => poner(o.valor)}>
              {o.etiqueta}
            </button>
          ))}
        </span>
      ) : (
        <select aria-label={def.etiqueta} value={(v as string) ?? ''} onChange={(e) => poner(e.target.value || undefined)}>
          <option value="">—</option>
          {c.opciones.map((o) => (
            <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
          ))}
        </select>
      );
    case 'multiple': {
      const lista = (v as string[] | undefined) ?? [];
      return (
        <span className="multiple">
          <label>
            <input type="checkbox" checked={campo.estado === 'valor' && lista.length === 0} onChange={(e) => poner(e.target.checked ? [] : undefined)} /> Ninguna
          </label>
          {c.opciones.map((o) => (
            <label key={o.valor}>
              <input
                type="checkbox"
                checked={lista.includes(o.valor)}
                onChange={(e) => poner(e.target.checked ? [...lista, o.valor] : lista.filter((x) => x !== o.valor))}
              />{' '}
              {o.etiqueta}
            </label>
          ))}
        </span>
      );
    }
    case 'ecografia':
      return <Ecografia valor={v as { fecha: string; egDias: number } | undefined} onCambio={poner} />;
    case 'antitetanica': {
      const a = (v as { dosisPrevias: number; fechaUltima: string | null; informacionConfiable: boolean } | undefined) ?? {
        dosisPrevias: 0,
        fechaUltima: null,
        informacionConfiable: true,
      };
      return (
        <span className="compuesto">
          <Numero etiqueta="Dosis previas" unidad="dosis" valor={v ? a.dosisPrevias : undefined} onCambio={(n) => poner(n === undefined ? undefined : { ...a, dosisPrevias: n })} />
          <span>Última</span>
          <input type="date" aria-label="Fecha de la última dosis" value={a.fechaUltima ?? ''} onChange={(e) => poner({ ...a, fechaUltima: e.target.value || null })} />
          <label>
            <input type="checkbox" checked={!a.informacionConfiable} onChange={(e) => poner({ ...a, informacionConfiable: !e.target.checked })} /> Información poco confiable
          </label>
        </span>
      );
    }
    case 'cigarrillos':
      return (
        <span className="compuesto">
          <Numero etiqueta="Cigarrillos al día" unidad="al día" valor={typeof v === 'number' ? v : undefined} onCambio={poner} />
          <label>
            <input type="checkbox" checked={v === 'no_sabe'} onChange={(e) => poner(e.target.checked ? 'no_sabe' : undefined)} /> No sabe
          </label>
        </span>
      );
    case 'residencia':
      return <Residencia valor={v as { municipio: string; altitudM: number } | undefined} onCambio={poner} />;
    case 'cie10':
      return <Diagnosticos valor={(v as DiagnosticoCie10[] | undefined) ?? []} onCambio={(l) => poner(l.length ? l : undefined)} />;
    case 'calculado':
      return null;
  }
}

/** Diagnósticos con código CIE-10: sugiere los frecuentes al escribir el código o la descripción. */
function Diagnosticos({ valor, onCambio }: { valor: DiagnosticoCie10[]; onCambio: (l: DiagnosticoCie10[]) => void }) {
  const [texto, setTexto] = useState('');
  const agregar = () => {
    const t = texto.trim();
    if (!t) return;
    const conocido = CIE10_FRECUENTES.find((d) => `${d.codigo} · ${d.descripcion}` === t || d.codigo.toLowerCase() === t.toLowerCase());
    const [codigo, ...resto] = t.split(/\s*[·\-–]\s*|\s+/);
    const nuevo = conocido ?? { codigo: (codigo ?? '').toUpperCase(), descripcion: resto.join(' ') };
    if (!valor.some((d) => d.codigo === nuevo.codigo)) onCambio([...valor, nuevo]);
    setTexto('');
  };
  return (
    <div className="diagnosticos">
      {valor.length > 0 && (
        <ul>
          {valor.map((d) => (
            <li key={d.codigo}>
              <strong>{d.codigo}</strong> {d.descripcion}{' '}
              <button type="button" className="enlace" onClick={() => onCambio(valor.filter((x) => x.codigo !== d.codigo))}>Quitar</button>
            </li>
          ))}
        </ul>
      )}
      <input
        list="cie10-frecuentes"
        aria-label="Agregar diagnóstico (código CIE-10 y descripción)"
        placeholder="Código o descripción, por ejemplo Z34.8"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            agregar();
          }
        }}
      />
      <datalist id="cie10-frecuentes">
        {CIE10_FRECUENTES.map((d) => <option key={d.codigo} value={`${d.codigo} · ${d.descripcion}`} />)}
      </datalist>
      <button type="button" onClick={agregar}>Agregar</button>
    </div>
  );
}

export function FilaCampo<D>({ def, campo, onCambio, automatico }: {
  def: DefCampo<D>;
  campo: Campo<unknown> | undefined;
  onCambio: Cambio;
  /** El campo no aplica por otra respuesta o por la semana. */
  automatico?: boolean;
}) {
  const actual = campo ?? vacio;
  let contenido: ReactNode;
  if (automatico) contenido = <span className="estado-campo">No corresponde (automático)</span>;
  else if (actual.estado === 'no_se_hizo' || actual.estado === 'no_corresponde')
    contenido = <span className="estado-campo">{actual.estado === 'no_se_hizo' ? 'No se hizo' : 'No corresponde'}</span>;
  else contenido = <ControlValor def={def} campo={actual} onCambio={onCambio} />;

  return (
    <div className={`fila-campo ${actual.estado}`}>
      <div className="etiqueta">
        {def.etiqueta}
        {def.privado && <span className="privado" title="Dato privado: nunca aparece en el carné"> 🔒 privado</span>}
        {def.ayuda && <small>{def.ayuda}</small>}
      </div>
      <div className="control">
        {contenido}
        {!automatico && (
          <span className="acciones-campo">
            {actual.estado !== 'no_se_hizo' && <button type="button" className="enlace" onClick={() => onCambio({ estado: 'no_se_hizo' })}>No se hizo</button>}
            {actual.estado !== 'no_corresponde' && <button type="button" className="enlace" onClick={() => onCambio({ estado: 'no_corresponde' })}>No corresponde</button>}
            {actual.estado !== 'vacio' && <button type="button" className="enlace" onClick={() => onCambio(vacio)}>Borrar</button>}
          </span>
        )}
      </div>
    </div>
  );
}
