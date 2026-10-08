// E1 — Pantalla privada "Opciones y derechos". Nada de lo que se registra aquí llega al carné.
import { useEffect, useState, type FormEvent } from 'react';
import type { Causal, DecisionDerechos, DesencadenanteDerechos, Gestante, RegistroDerechos } from '../datos/modelo';
import type { Historia } from '../datos/repositorio';
import { carneDebeEstarPausado, disparadores, ErrorDerechos, marcoSegunEG, type Marco } from '../derechos/servicio';
import {
  AVISO_OBJECION,
  AVISO_SIN_PRESTADOR,
  AVISO_URGENCIA,
  CAUSALES,
  DECISIONES,
  DESENCADENANTES,
  GUIA_ASESORIA,
  MOMENTO_A_SOLAS,
  avisoRuta,
} from '../derechos/textos';
import { useApp, type Pantalla } from './contexto';
import { PanelConsentimientos } from './PanelConsentimientos';

const aISO = (local: string) => (local ? new Date(local).toISOString() : undefined);
const ahoraLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export function PantallaDerechos({ gestanteId, embarazoId, ir }: { gestanteId: string; embarazoId: string; ir: (p: Pantalla) => void }) {
  const { repo, derechos } = useApp();
  const [gestante, setGestante] = useState<Gestante>();
  const [historia, setHistoria] = useState<Historia>();
  const [marco, setMarco] = useState<Marco>();
  const [detectados, setDetectados] = useState<DesencadenanteDerechos[]>([]);
  const [desencadenante, setDesencadenante] = useState<DesencadenanteDerechos>('pregunta_gestante');
  const [momentoASolas, setMomentoASolas] = useState(false);
  const [decision, setDecision] = useState<DecisionDerechos>();
  const [citaCercana, setCitaCercana] = useState('');
  const [causal, setCausal] = useState<Causal>();
  const configurado = derechos.prestadorConfigurado();
  const [prestador, setPrestador] = useState(configurado ?? '');
  const [remision, setRemision] = useState('');
  const [ruta, setRuta] = useState('');
  const [notificaciones, setNotificaciones] = useState<{ a: string; fechaHora: string }[]>([]);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string>();
  const [mensaje, setMensaje] = useState<string>();

  const cargar = async () => {
    setGestante(await repo.leer('gestantes', gestanteId));
    const h = await repo.historia(embarazoId);
    setHistoria(h);
    if (h) {
      const ctx = derechos.contexto(h);
      setMarco(marcoSegunEG(ctx));
      const d = disparadores(ctx);
      setDetectados(d);
      if (d[0]) setDesencadenante((actual) => (actual === 'pregunta_gestante' ? d[0]! : actual));
    }
  };
  useEffect(() => {
    void cargar();
  }, [embarazoId]);

  if (!gestante || !historia || !marco) return <p>Cargando…</p>;
  const ctx = derechos.contexto(historia);
  const menor14 = detectados.includes('menor_14') || desencadenante === 'menor_14';
  const hay = (d: DesencadenanteDerechos) => detectados.includes(d) || desencadenante === d;
  const conRutaSexual = hay('violencia_sexual') || hay('menor_14');
  const conRutaMujer = !conRutaSexual && hay('violencia_mujer');
  const conRuta = conRutaSexual || conRutaMujer;
  const infoRuta = conRutaSexual ? derechos.rutaViolenciaSexual(menor14) : derechos.rutaViolenciaContraLaMujer();
  const tituloRuta = conRutaSexual
    ? 'Ruta de atención a víctimas de violencia sexual'
    : 'Ruta de atención a mujeres víctimas de violencia (Ley 1257 de 2008)';

  const registrar = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    if (!decision) return setError('Registre la decisión de la gestante.');
    try {
      await derechos.registrar(embarazoId, {
        desencadenante,
        momentoASolas,
        decision,
        citaCercana: citaCercana || undefined,
        causal,
        prestador: decision === 'solicita_ive' ? prestador : undefined,
        remisionFechaHora: aISO(remision),
        rutaActivadaFechaHora: aISO(ruta),
        notificaciones: notificaciones.filter((n) => n.a.trim()).map((n) => ({ a: n.a.trim(), fechaHora: aISO(n.fechaHora) ?? new Date().toISOString() })),
        notas,
      });
      setMensaje(decision === 'solicita_ive' ? 'Solicitud registrada. El carné quedó pausado.' : 'Decisión registrada.');
      setDecision(undefined);
      setNotas('');
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorDerechos ? err.message : String(err));
    }
  };

  const registrarRemisionAhora = async (r: RegistroDerechos) => {
    await derechos.registrarRemision(r.id, new Date().toISOString());
    await cargar();
  };

  return (
    <section className="privada">
      <button type="button" className="enlace" onClick={() => ir({ tipo: 'ficha', gestanteId })}>← {gestante.nombres} {gestante.apellidos}</button>
      <h2>Opciones y derechos</h2>
      <p className="banner-privado">🔒 Información privada: solo la ve el profesional autorizado. Nunca aparece en el carné, no se envía ni se imprime.</p>

      <div className="tarjeta">
        <strong>EG hoy: {ctx.eg.estado === 'calculada' ? `${ctx.eg.semanas} sem + ${ctx.eg.diasResto} d${ctx.eg.confiable ? '' : ' (poco confiable)'}` : 'no confiable'}</strong>
        <p className={marco.tipo === 'confirmar_eg' ? 'error' : ''}>{marco.texto}</p>
        {marco.tipo === 'causales' && (
          <ul>{CAUSALES.map((c) => <li key={c.id}>{c.texto}</li>)}</ul>
        )}
        {'norma' in marco && <small className="suave">{marco.norma}</small>}
      </div>

      {conRutaSexual && (
        <div className="dialogo" role="alert">
          {avisoRuta(detectados.includes('menor_14') || desencadenante === 'menor_14').map((t) => <p key={t}>{t}</p>)}
        </div>
      )}

      <form onSubmit={registrar}>
        <fieldset>
          <legend>Motivo</legend>
          {detectados.length > 0 && <p className="suave">Detectado en la historia: {detectados.map((d) => DESENCADENANTES[d]).join(' · ')}.</p>}
          <select aria-label="Motivo" value={desencadenante} onChange={(e) => setDesencadenante(e.target.value as DesencadenanteDerechos)}>
            {(Object.keys(DESENCADENANTES) as DesencadenanteDerechos[]).map((k) => <option key={k} value={k}>{DESENCADENANTES[k]}</option>)}
          </select>
        </fieldset>

        <fieldset>
          <legend>Asesoría</legend>
          <label className="en-linea">
            <input type="checkbox" checked={momentoASolas} onChange={(e) => setMomentoASolas(e.target.checked)} /> {MOMENTO_A_SOLAS}
          </label>
          <ul>{GUIA_ASESORIA.map((t) => <li key={t}>{t}</li>)}</ul>
        </fieldset>

        {conRuta && (
          <fieldset>
            <legend>{tituloRuta}</legend>
            <ol>{infoRuta.pasos.map((t) => <li key={t}>{t}</li>)}</ol>
            {infoRuta.contactos.length > 0 && (
              <>
                <p><strong>Contactos de la institución</strong>{infoRuta.ficticia && <span className="suave"> (de demostración, ficticios)</span>}</p>
                <ul className="contactos-ruta">
                  {infoRuta.contactos.map((c) => (
                    <li key={c.entidad}>
                      {c.entidad} · {c.contacto}{' '}
                      <button
                        type="button"
                        className="enlace"
                        disabled={notificaciones.some((n) => n.a === c.entidad)}
                        onClick={() => setNotificaciones([...notificaciones, { a: c.entidad, fechaHora: ahoraLocal() }])}
                      >
                        Registrar notificación
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <label>Activación de la ruta (fecha y hora) <input type="datetime-local" value={ruta} onChange={(e) => setRuta(e.target.value)} /></label>
            <button type="button" className="enlace" onClick={() => setRuta(ahoraLocal())}>Ahora</button>
            {notificaciones.map((n, i) => (
              <div key={i} className="compuesto">
                <label>Notificado a <input value={n.a} onChange={(e) => setNotificaciones(notificaciones.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} /></label>
                <label>Fecha y hora <input type="datetime-local" value={n.fechaHora} onChange={(e) => setNotificaciones(notificaciones.map((x, j) => (j === i ? { ...x, fechaHora: e.target.value } : x)))} /></label>
              </div>
            ))}
            <button type="button" onClick={() => setNotificaciones([...notificaciones, { a: '', fechaHora: ahoraLocal() }])}>+ Notificación</button>
          </fieldset>
        )}

        <fieldset>
          <legend>Decisión de la gestante</legend>
          <div className="botones" role="radiogroup" aria-label="Decisión de la gestante">
            {(Object.keys(DECISIONES) as DecisionDerechos[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={decision === k} className={decision === k ? 'activo' : ''} onClick={() => setDecision(k)}>
                {DECISIONES[k]}
              </button>
            ))}
          </div>

          {decision === 'lo_pensara' && (
            <label>Cita cercana (sin dilatar) <input type="date" required value={citaCercana} onChange={(e) => setCitaCercana(e.target.value)} /></label>
          )}

          {decision === 'solicita_ive' && (
            <>
              <p className="dialogo">{AVISO_URGENCIA}</p>
              {marco.tipo === 'causales' && (
                <div role="radiogroup" aria-label="Causal identificada">
                  <p><strong>Causal identificada</strong></p>
                  {CAUSALES.map((c) => (
                    <label key={c.id} className="en-linea">
                      <input type="radio" name="causal" checked={causal === c.id} onChange={() => setCausal(c.id)} /> {c.texto}
                    </label>
                  ))}
                </div>
              )}
              {!configurado && <p className="error">{AVISO_SIN_PRESTADOR}</p>}
              {configurado && <p className="suave">Prestador de referencia de la institución: {configurado}. Puede cambiarlo si remite a otro.</p>}
              <label>Prestador al que se remite <input required value={prestador} onChange={(e) => setPrestador(e.target.value)} /></label>
              <label>Remisión (fecha y hora) <input type="datetime-local" value={remision} onChange={(e) => setRemision(e.target.value)} /></label>
              <button type="button" className="enlace" onClick={() => setRemision(ahoraLocal())}>Ahora</button>
              <p className="suave">{AVISO_OBJECION}</p>
            </>
          )}

          {decision === 'solicita_ive' && causal === 'violencia_sexual' ? (
            <label>
              Consigne en la historia clínica el hecho de violencia sexual (obligatorio; no se exige denuncia)
              <textarea rows={3} required value={notas} onChange={(e) => setNotas(e.target.value)} />
            </label>
          ) : (
            <label>Notas privadas <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></label>
          )}
        </fieldset>

        {error && <p className="error" role="alert">{error}</p>}
        {mensaje && <p className="aviso" role="status">{mensaje}</p>}
        <button type="submit" className="primario">Registrar</button>
      </form>

      <PanelConsentimientos embarazoId={embarazoId} tipos={['ive']} titulo="🔒 Consentimiento informado para la IVE" />

      <h3>Registros anteriores</h3>
      {carneDebeEstarPausado(historia.derechos) && <p className="aviso">El carné está pausado: el enlace solo muestra "Comunícate con tu servicio de salud".</p>}
      <ul className="lista">
        {historia.derechos.length === 0 && <li className="suave">Sin registros.</li>}
        {[...historia.derechos].reverse().map((r) => (
          <li key={r.id}>
            <strong>{fechaHora(r.fechaHora)}</strong> · {DECISIONES[r.decision]} · {DESENCADENANTES[r.desencadenante]}
            {r.citaCercana && ` · cita ${r.citaCercana}`}
            {r.causal && ` · causal: ${CAUSALES.find((c) => c.id === r.causal)?.texto}`}
            {r.solicitudIVE && (
              <>
                {` · remitida a ${r.solicitudIVE.prestador}${r.solicitudIVE.manual ? ' (registro manual)' : ''}`}
                {r.solicitudIVE.remisionFechaHora ? (
                  ` el ${fechaHora(r.solicitudIVE.remisionFechaHora)}`
                ) : (
                  <button type="button" className="enlace" onClick={() => void registrarRemisionAhora(r)}>Registrar remisión ahora</button>
                )}
              </>
            )}
            {r.rutaViolencia && ` · ruta activada el ${fechaHora(r.rutaViolencia.activadaFechaHora)} (${r.rutaViolencia.notificaciones.length} notificaciones)`}
          </li>
        ))}
      </ul>
    </section>
  );
}
