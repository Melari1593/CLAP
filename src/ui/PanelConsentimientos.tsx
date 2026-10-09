// Consentimiento informado: registro de lo que se explicó, quién decide y su decisión, con la
// posibilidad de revocarlo. El de la IVE solo se muestra en "Opciones y derechos".
import { localeDe } from '../i18n/dom';
import { useEffect, useState, type FormEvent } from 'react';
import type { Consentimiento, TipoConsentimiento } from '../datos/modelo';
import { ErrorConsentimiento } from '../consentimiento/servicio';
import { GUIA_CONSENTIMIENTO, PROCEDIMIENTOS_FRECUENTES } from '../consentimiento/textos';
import { useApp } from './contexto';

const fechaHora = (iso: string) => new Date(iso).toLocaleString(localeDe(), { dateStyle: 'medium', timeStyle: 'short' });
const PUNTOS = ['beneficios', 'riesgos', 'alternativas', 'implicaciones'] as const;
const NOMBRE_PUNTO: Record<(typeof PUNTOS)[number], string> = {
  beneficios: 'Beneficios',
  riesgos: 'Riesgos',
  alternativas: 'Alternativas',
  implicaciones: 'Implicaciones',
};

export function nombreConsentimiento(c: Consentimiento): string {
  return c.tipo === 'procedimiento' ? `Procedimiento: ${c.procedimiento}` : GUIA_CONSENTIMIENTO[c.tipo].titulo;
}

export function PanelConsentimientos({ embarazoId, tipos, titulo = 'Consentimiento informado', abierto, onCambio, version = 0 }: {
  embarazoId: string;
  tipos: TipoConsentimiento[];
  titulo?: string;
  /** Muestra el formulario desde el inicio. */
  abierto?: boolean;
  onCambio?: () => void;
  version?: number;
}) {
  const { repo, consentimientos } = useApp();
  const [lista, setLista] = useState<Consentimiento[]>([]);
  const [nuevo, setNuevo] = useState(Boolean(abierto));

  const cargar = async () => {
    const h = await repo.historia(embarazoId);
    setLista((h?.consentimientos ?? []).filter((c) => tipos.includes(c.tipo)));
  };
  useEffect(() => {
    void cargar();
  }, [embarazoId, version]);

  const revocar = async (c: Consentimiento) => {
    const motivo = prompt('La gestante retira su consentimiento. Motivo (opcional):');
    if (motivo === null) return;
    await consentimientos.revocar(c.id, motivo);
    await cargar();
    onCambio?.();
  };

  return (
    <section className="consentimientos">
      <h3>{titulo}</h3>
      <ul className="lista">
        {lista.length === 0 && <li className="suave">Sin registros.</li>}
        {[...lista].reverse().map((c) => (
          <li key={c.id}>
            <strong>{nombreConsentimiento(c)}</strong> · {c.decision === 'acepta' ? 'Acepta' : 'No acepta'} · {fechaHora(c.fechaHora)}
            {c.otorga === 'representante' && c.representante && ` · decide ${c.representante.nombre} (${c.representante.parentesco})`}
            <small className="suave">
              {' '}· informó {c.informadoPor.nombre}
              {c.informadoPor.registroProfesional && ` (${c.informadoPor.registroProfesional})`}
            </small>
            {c.revocado ? (
              <span className="etiqueta-estado"> revocado el {fechaHora(c.revocado.fechaHora)}{c.revocado.motivo && `: ${c.revocado.motivo}`}</span>
            ) : (
              c.decision === 'acepta' && <button type="button" className="enlace" onClick={() => void revocar(c)}>Revocar</button>
            )}
          </li>
        ))}
      </ul>
      {nuevo ? (
        <FormConsentimiento
          embarazoId={embarazoId}
          tipos={tipos}
          onListo={async () => {
            setNuevo(Boolean(abierto));
            await cargar();
            onCambio?.();
          }}
          onCancelar={abierto ? undefined : () => setNuevo(false)}
        />
      ) : (
        <button type="button" onClick={() => setNuevo(true)}>Registrar consentimiento</button>
      )}
    </section>
  );
}

function FormConsentimiento({ embarazoId, tipos, onListo, onCancelar }: {
  embarazoId: string;
  tipos: TipoConsentimiento[];
  onListo: () => Promise<void>;
  onCancelar?: () => void;
}) {
  const { consentimientos } = useApp();
  const [tipo, setTipo] = useState<TipoConsentimiento>(tipos[0]!);
  const [procedimiento, setProcedimiento] = useState('');
  const [informado, setInformado] = useState({ beneficios: false, riesgos: false, alternativas: false, implicaciones: false });
  const [preguntas, setPreguntas] = useState(false);
  const [otorga, setOtorga] = useState<'gestante' | 'representante'>('gestante');
  const [representante, setRepresentante] = useState({ nombre: '', parentesco: '', documento: '' });
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string>();
  const guia = GUIA_CONSENTIMIENTO[tipo];

  const registrar = async (decision: Consentimiento['decision']) => {
    setError(undefined);
    try {
      await consentimientos.registrar(embarazoId, {
        tipo,
        procedimiento,
        decision,
        informado,
        preguntasResueltas: preguntas,
        otorga: tipo === 'ive' ? 'gestante' : otorga,
        representante: otorga === 'representante' ? representante : undefined,
        notas,
      });
      await onListo();
    } catch (err) {
      setError(err instanceof ErrorConsentimiento ? err.message : String(err));
    }
  };

  return (
    <form className="tarjeta" onSubmit={(e: FormEvent) => e.preventDefault()}>
      {tipos.length > 1 && (
        <div className="botones" role="radiogroup" aria-label="Tipo de consentimiento">
          {tipos.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={tipo === t} className={tipo === t ? 'activo' : ''} onClick={() => setTipo(t)}>
              {GUIA_CONSENTIMIENTO[t].titulo}
            </button>
          ))}
        </div>
      )}
      {tipo === 'procedimiento' && (
        <label>
          Procedimiento
          <input list="procedimientos-frecuentes" value={procedimiento} onChange={(e) => setProcedimiento(e.target.value)} />
          <datalist id="procedimientos-frecuentes">
            {PROCEDIMIENTOS_FRECUENTES.map((p) => <option key={p} value={p} />)}
          </datalist>
        </label>
      )}
      <p>Explique con palabras sencillas y marque lo que informó:</p>
      {PUNTOS.map((k) => (
        <label key={k} className="en-linea">
          <input type="checkbox" checked={informado[k]} onChange={(e) => setInformado({ ...informado, [k]: e.target.checked })} />{' '}
          <strong>{NOMBRE_PUNTO[k]}.</strong> {guia[k]}
        </label>
      ))}
      <label className="en-linea">
        <input type="checkbox" checked={preguntas} onChange={(e) => setPreguntas(e.target.checked)} /> Pudo hacer preguntas y se le resolvieron.
      </label>
      {tipo !== 'ive' ? (
        <div className="botones" role="radiogroup" aria-label="Quién decide">
          {(['gestante', 'representante'] as const).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={otorga === o} className={otorga === o ? 'activo' : ''} onClick={() => setOtorga(o)}>
              {o === 'gestante' ? 'Decide la gestante' : 'Decide su representante legal'}
            </button>
          ))}
        </div>
      ) : (
        <p className="suave">{guia.implicaciones}</p>
      )}
      {tipo !== 'ive' && otorga === 'representante' && (
        <div className="compuesto">
          <label>Nombre <input value={representante.nombre} onChange={(e) => setRepresentante({ ...representante, nombre: e.target.value })} /></label>
          <label>Parentesco <input value={representante.parentesco} onChange={(e) => setRepresentante({ ...representante, parentesco: e.target.value })} /></label>
          <label>Documento <input value={representante.documento} onChange={(e) => setRepresentante({ ...representante, documento: e.target.value })} /></label>
        </div>
      )}
      <label>Notas <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="botones">
        <button type="button" className="primario" onClick={() => void registrar('acepta')}>Acepta</button>
        <button type="button" onClick={() => void registrar('no_acepta')}>No acepta</button>
        {onCancelar && <button type="button" className="enlace" onClick={onCancelar}>Cancelar</button>}
      </div>
    </form>
  );
}
