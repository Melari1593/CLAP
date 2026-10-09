// F3 — Después de cerrar la consulta: PIN y canal (primera vez), vista previa, envío e impresión.
import { useEffect, useState, type FormEvent } from 'react';
import type { CanalEnvio, Carne } from '../datos/modelo';
import type { DatosCarne } from '../privacidad/carne';
import { ErrorCarne } from '../carne/servicio';
import { CarneGestante } from './CarneGestante';
import { useApp } from './contexto';
import { IDIOMAS, type Idioma } from '../i18n/motor';
import { PanelConsentimientos } from './PanelConsentimientos';
import { datosCarneAutorizados } from '../consentimiento/servicio';

const CANALES: { canal: CanalEnvio; etiqueta: string }[] = [
  { canal: 'whatsapp', etiqueta: 'WhatsApp' },
  { canal: 'correo', etiqueta: 'Correo electrónico' },
  { canal: 'impreso', etiqueta: 'Solo impreso' },
];

/** Idioma en que la gestante lee su carné. Los nombres de los idiomas no se traducen. */
function ElegirIdioma({ idioma, onCambio }: { idioma: Idioma; onCambio: (i: Idioma) => void }) {
  return (
    <label>
      Idioma del carné{' '}
      <select data-no-traducir value={idioma} onChange={(e) => onCambio(e.target.value as Idioma)}>
        {IDIOMAS.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
      </select>
    </label>
  );
}

function FormDestino({ inicial, onGuardar, conPin }: {
  inicial?: { canal: CanalEnvio; destino?: string; idioma?: Idioma };
  onGuardar: (d: { canal: CanalEnvio; destino?: string; pin?: string; idioma: Idioma }) => Promise<void>;
  conPin: boolean;
}) {
  const [canal, setCanal] = useState<CanalEnvio>(inicial?.canal ?? 'whatsapp');
  const [idioma, setIdioma] = useState<Idioma>(inicial?.idioma ?? 'es');
  const [destino, setDestino] = useState(inicial?.destino ?? '');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState<string>();

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (conPin && pin !== pin2) return setError('Los dos PIN no coinciden.');
    try {
      await onGuardar({ canal, destino: canal === 'impreso' ? undefined : destino, pin: conPin ? pin : undefined, idioma });
    } catch (err) {
      setError(err instanceof ErrorCarne ? err.message : String(err));
    }
  };

  return (
    <form onSubmit={guardar} className="tarjeta">
      {conPin && (
        <>
          <p>La gestante elige un PIN de 4 dígitos. Ingréselo con ella.</p>
          <div className="compuesto">
            <label>PIN <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} required value={pin} onChange={(e) => setPin(e.target.value)} /></label>
            <label>Repetir PIN <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} required value={pin2} onChange={(e) => setPin2(e.target.value)} /></label>
          </div>
        </>
      )}
      <div className="botones" role="radiogroup" aria-label="Cómo recibe el carné">
        {CANALES.map((c) => (
          <button key={c.canal} type="button" role="radio" aria-checked={canal === c.canal} className={canal === c.canal ? 'activo' : ''} onClick={() => setCanal(c.canal)}>
            {c.etiqueta}
          </button>
        ))}
      </div>
      {canal === 'whatsapp' && <label>Número de WhatsApp (confírmelo con ella) <input inputMode="tel" required value={destino} onChange={(e) => setDestino(e.target.value)} /></label>}
      {canal === 'correo' && (
        <label>Correo (solo si lo revisa; confírmelo con ella) <input type="email" required value={destino} onChange={(e) => setDestino(e.target.value)} /></label>
      )}
      <ElegirIdioma idioma={idioma} onCambio={setIdioma} />
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="primario">Guardar</button>
    </form>
  );
}

export function CierreCarne({ embarazoId, telefono, correo, onImprimir }: {
  embarazoId: string;
  telefono?: string;
  correo?: string;
  onImprimir: () => void;
}) {
  const { carnes, repo } = useApp();
  const [carne, setCarne] = useState<Carne | null>();
  const [autorizado, setAutorizado] = useState(false);
  const [vista, setVista] = useState<DatosCarne>();
  const [editando, setEditando] = useState<'pin' | 'destino'>();
  const [mensaje, setMensaje] = useState<string>();

  const cargar = async () => {
    setCarne((await carnes.carneDe(embarazoId)) ?? null);
    setVista(await carnes.vistaPrevia(embarazoId));
    setAutorizado(datosCarneAutorizados((await repo.historia(embarazoId))?.consentimientos ?? []));
  };
  useEffect(() => {
    void cargar();
  }, [embarazoId]);

  if (carne === undefined) return null;

  const enviar = async () => {
    const r = await carnes.enviar(embarazoId);
    setMensaje(
      r === 'en_cola'
        ? navigator.onLine
          ? 'Enviando el enlace. Verá la confirmación cuando el servidor lo entregue.'
          : 'Sin conexión: el envío quedó pendiente y saldrá solo al volver la señal.'
        : r === 'pausado'
          ? 'El carné está pausado: no se envía nada.'
          : 'El canal es "solo impreso": imprima el carné.',
    );
  };

  return (
    <section className="cierre-carne">
      <h3>Carné de la gestante</h3>
      {!carne && !autorizado ? (
        <>
          <p className="aviso">Antes de crear el carné, registre si la gestante acepta el tratamiento de sus datos y el envío del carné.</p>
          <PanelConsentimientos embarazoId={embarazoId} tipos={['datos_carne']} titulo="Consentimiento para el carné" abierto onCambio={() => void cargar()} />
        </>
      ) : !carne ? (
        <FormDestino
          conPin
          inicial={{ canal: telefono ? 'whatsapp' : correo ? 'correo' : 'impreso', destino: telefono ?? correo }}
          onGuardar={async ({ canal, destino, pin, idioma }) => {
            await carnes.crear(embarazoId, pin!, { canal, destino, idioma });
            await cargar();
          }}
        />
      ) : (
        <>
          <p className="suave">
            Envío: {CANALES.find((c) => c.canal === carne.canal)?.etiqueta}
            {carne.destino && ` · ${carne.destino}`}
            {carne.estado === 'pausado' && ' · pausado'}
          </p>
          <ElegirIdioma
            idioma={carne.idioma ?? 'es'}
            onCambio={async (i) => {
              await carnes.cambiarIdioma(carne.id, i);
              setMensaje('Idioma del carné actualizado.');
              await cargar();
            }}
          />
          <div className="botones">
            {carne.canal !== 'impreso' && carne.estado === 'activo' && (
              <button type="button" className="primario" onClick={() => void enviar()}>
                {carne.canal === 'whatsapp' ? 'Enviar por WhatsApp' : 'Enviar por correo'}
              </button>
            )}
            <button type="button" onClick={onImprimir}>Imprimir carné</button>
            <button type="button" onClick={() => setEditando(editando === 'pin' ? undefined : 'pin')}>Asignar PIN nuevo</button>
            <button type="button" onClick={() => setEditando(editando === 'destino' ? undefined : 'destino')}>Cambiar número o correo</button>
          </div>
          {editando === 'pin' && (
            <FormPinNuevo
              onGuardar={async (pin) => {
                await carnes.nuevoPin(carne.id, pin);
                setEditando(undefined);
                setMensaje('PIN actualizado.');
              }}
            />
          )}
          {editando === 'destino' && (
            <>
              <p className="aviso">Al cambiar el número o el correo, el enlace anterior deja de funcionar.</p>
              <FormDestino
                conPin={false}
                inicial={{ canal: carne.canal, destino: carne.destino, idioma: carne.idioma }}
                onGuardar={async ({ canal, destino, idioma }) => {
                  await carnes.cambiarDestino(carne.id, { canal, destino, idioma });
                  setEditando(undefined);
                  setMensaje('Destino actualizado: reenvíe el enlace.');
                  await cargar();
                }}
              />
            </>
          )}
        </>
      )}
      {mensaje && <p className="aviso" role="status">{mensaje}</p>}
      {carne && <Comprension embarazoId={embarazoId} />}
      {vista && (
        <details open>
          <summary>Vista previa: así verá la gestante su carné</summary>
          <div className="vista-previa">
            <CarneGestante datos={vista} idioma={carne?.idioma ?? 'es'} />
          </div>
        </details>
      )}
    </section>
  );
}

function FormPinNuevo({ onGuardar }: { onGuardar: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string>();
  return (
    <form
      className="compuesto"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await onGuardar(pin);
        } catch (err) {
          setError(err instanceof ErrorCarne ? err.message : String(err));
        }
      }}
    >
      <label>PIN nuevo <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} /></label>
      <button type="submit">Guardar PIN</button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}

/** "La gestante entiende": dos preguntas cortas al final de la consulta (métrica del spec). */
function Comprension({ embarazoId }: { embarazoId: string }) {
  const { carnes } = useApp();
  const [sabeCita, setSabeCita] = useState<boolean>();
  const [signos, setSignos] = useState<number>();
  const [listo, setListo] = useState(false);
  if (listo) return <p className="suave">Respuesta de comprensión registrada.</p>;
  return (
    <details className="tarjeta">
      <summary>Pregunta corta a la gestante (opcional)</summary>
      <p>¿Sabe decir cuándo es su próxima cita?</p>
      <div className="botones">
        {[true, false].map((b) => (
          <button key={String(b)} type="button" className={sabeCita === b ? 'activo' : ''} onClick={() => setSabeCita(b)}>{b ? 'Sí' : 'No'}</button>
        ))}
      </div>
      <p>¿Cuántos signos de alarma sabe decir sin ayuda?</p>
      <div className="botones">
        {[0, 1, 2].map((n) => (
          <button key={n} type="button" className={signos === n ? 'activo' : ''} onClick={() => setSignos(n)}>{n === 2 ? '2 o más' : n}</button>
        ))}
      </div>
      <button
        type="button"
        disabled={sabeCita === undefined || signos === undefined}
        onClick={async () => {
          await carnes.registrarComprension(embarazoId, sabeCita!, signos!);
          setListo(true);
        }}
      >
        Registrar respuesta
      </button>
    </details>
  );
}
