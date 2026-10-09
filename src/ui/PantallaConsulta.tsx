// B2 / B4 — Primera consulta y control de seguimiento.
import { useEffect, useRef, useState } from 'react';
import type { Consulta, Cuestionario, DatosPrimeraConsulta, DatosSeguimiento, Gestante, Ordenes } from '../datos/modelo';
import { aplicarRespuestas, contextoCuestionario, tipoDeCuestionario, type ResultadoAplicar } from '../cuestionario/servicio';
import type { ContextoCuestionario } from '../cuestionario/preguntas';
import { localeDe } from '../i18n/dom';
import {
  BLOQUES_PRIMERA,
  BLOQUES_SEGUIMIENTO,
  aplicarNoCorresponde,
  primeraConsultaVacia,
  seguimientoVacio,
} from '../consultas/esquema';
import type { ResultadoGuardado } from '../consultas/servicio';
import type { Advertencia } from '../consultas/validaciones';
import { useApp, type Pantalla } from './contexto';
import { Formulario } from './Formulario';
import { PanelCalculos } from './PanelCalculos';
import { PanelAlertas } from './PanelAlertas';
import { SeccionesSeguimiento } from './SeccionesSeguimiento';
import { CierreCarne } from './CierreCarne';
import { PanelPendientes } from './PanelPendientes';
import { GraficaAlturaUterina } from './GraficaAlturaUterina';
import { GraficaIMC } from './GraficaIMC';
import { SeccionLaboratorios } from './SeccionLaboratorios';
import { SeccionOrdenes } from './SeccionOrdenes';
import { FirmaProfesional } from './FirmaProfesional';
import { ordenesIncompletas, ordenesVacias } from '../consultas/ordenes';
import { valorDe } from '../datos/campo';
import { grupoRh } from '../clinico/grupoRh';
import { edad } from '../clinico/calculos';
import { borrarBorrador, guardarBorrador, leerBorrador } from './borrador';

type Cita = { fecha: string; lugar: string; queLlevar: string };
type Borrador = { primera?: DatosPrimeraConsulta; seguimiento?: DatosSeguimiento; cita: Cita; consultaId?: string; ordenes?: Ordenes };

interface Props {
  tipo: 'primera' | 'seguimiento';
  gestanteId: string;
  embarazoId: string;
  consultaId?: string;
  ir: (p: Pantalla) => void;
}

export function PantallaConsulta({ tipo, gestanteId, embarazoId, consultaId: idInicial, ir }: Props) {
  const { repo, servicio, hoy, catalogo, cuestionarios } = useApp();
  const [cuestionario, setCuestionario] = useState<Cuestionario>();
  const [aplicado, setAplicado] = useState<Omit<ResultadoAplicar<unknown>, 'datos'>>();
  const [ctxCuestionario, setCtxCuestionario] = useState<ContextoCuestionario>({ indicaciones: [] });
  const [gestante, setGestante] = useState<Gestante>();
  const [primeraDelEmbarazo, setPrimeraDelEmbarazo] = useState<DatosPrimeraConsulta>();
  const [egSemanas, setEgSemanas] = useState<number>();
  const [egTexto, setEgTexto] = useState<string>();
  const [rhNegativo, setRhNegativo] = useState(false);
  const [consultaId, setConsultaId] = useState(idInicial);
  const [cerrada, setCerrada] = useState(false);
  const [primera, setPrimera] = useState<DatosPrimeraConsulta>();
  const [seguimiento, setSeguimiento] = useState<DatosSeguimiento>();
  const [cita, setCita] = useState<Cita>({ fecha: '', lugar: '', queLlevar: '' });
  const [ordenes, setOrdenes] = useState<Ordenes>(ordenesVacias());
  const [firma, setFirma] = useState<string>();
  const [cierre, setCierre] = useState<Consulta['cierre']>();
  const [advertencias, setAdvertencias] = useState<Advertencia[]>();
  /** Advertencias que el profesional ya confirmó: no se vuelven a preguntar. */
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set());
  const [vacios, setVacios] = useState<string[]>();
  const [mensaje, setMensaje] = useState<string>();
  /** Sube con cada guardado para que el panel de alertas se actualice. */
  const [guardados, setGuardados] = useState(0);
  /** Para medir la duración de la consulta (G2). */
  const inicio = useRef(new Date());
  /** Lo que se estaba llenando antes de una recarga de la página, si la hubo. */
  const clave = `${embarazoId}:${tipo}:${idInicial ?? 'nueva'}`;
  const borrador = useRef(leerBorrador<Borrador>(clave));

  useEffect(() => {
    void (async () => {
      setGestante(await repo.leer('gestantes', gestanteId));
      const historia = await repo.historia(embarazoId);
      const existente = idInicial ? historia?.consultas.find((c) => c.id === idInicial) : undefined;
      if (historia) {
        const eg = servicio.egDeHistoria(historia);
        if (eg.estado === 'calculada') {
          setEgSemanas(eg.semanas);
          setEgTexto(`${eg.semanas} sem + ${eg.diasResto} d`);
        }
        // El último cuestionario de este tipo de consulta.
        // En un control solo se ofrece el que aún no se ha pasado (cada control tiene el suyo).
        const delTipo = historia.cuestionarios.filter((c) => tipoDeCuestionario(c) === tipo && (tipo === 'primera' || !c.aplicadoEn)).sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
        setCuestionario(delTipo.at(-1));
        setCtxCuestionario(contextoCuestionario(historia.indicaciones));
        const primera = historia.consultas.find((c) => c.tipo === 'primera')?.primera;
        setPrimeraDelEmbarazo(primera);
        setRhNegativo(grupoRh(primera, historia.examenes).rh === '-');
      }
      if (existente) {
        setCerrada(existente.cerrada);
        setCierre(existente.cierre);
        if (existente.ordenes) setOrdenes(existente.ordenes);
        if (existente.proximaCita.estado === 'valor') setCita(existente.proximaCita.valor);
      }
      const b = borrador.current;
      if (tipo === 'primera') setPrimera(b?.primera ?? existente?.primera ?? aplicarNoCorresponde(BLOQUES_PRIMERA, primeraConsultaVacia(), {}));
      else setSeguimiento(b?.seguimiento ?? existente?.seguimiento ?? seguimientoVacio());
      if (b) {
        setCita(b.cita);
        if (b.ordenes) setOrdenes(b.ordenes);
        if (b.consultaId) setConsultaId(b.consultaId);
        setMensaje('Se recuperó lo que estaba llenando antes de que se recargara la página. Guarde para no perderlo.');
      }
    })();
  }, [repo, servicio, gestanteId, embarazoId, idInicial, tipo]);

  // Copia de trabajo para recuperar lo escrito si la página se recarga; se borra al salir de la pantalla.
  useEffect(() => {
    if (primera || seguimiento) guardarBorrador(clave, { primera, seguimiento, cita, consultaId, ordenes } satisfies Borrador);
  }, [clave, primera, seguimiento, cita, consultaId, ordenes]);
  useEffect(
    () => () => {
      borrarBorrador(clave);
      borrarBorrador(`bloque:${clave}`);
    },
    [clave],
  );

  if (!gestante || (tipo === 'primera' ? !primera : !seguimiento)) return <p>Cargando…</p>;

  // Curvas de altura uterina e IMC dentro del examen físico (se actualizan al guardar).
  const curvas = (
    <div className="curvas-examen">
      <GraficaAlturaUterina embarazoId={embarazoId} version={guardados} />
      <GraficaIMC embarazoId={embarazoId} version={guardados} />
    </div>
  );

  // 5. Laboratorios y ecografías: registrar, corregir o anular resultados.
  const laboratorios = (
    <SeccionLaboratorios embarazoId={embarazoId} consultaId={consultaId ?? null} version={guardados} alCambiar={() => setGuardados((n) => n + 1)} enBloque />
  );

  // 6. Plan y órdenes: después del diagnóstico y el plan, indicaciones, próxima cita, fórmula,
  // paraclínicos y, al final, la firma del profesional.
  const planYOrdenes = (
    <>
      {tipo === 'seguimiento' &&
        (consultaId ? (
          <SeccionesSeguimiento embarazoId={embarazoId} alCambiar={() => setGuardados((n) => n + 1)} />
        ) : (
          <p className="suave">Guarde el control para registrar indicaciones y factores transitorios.</p>
        ))}
      <h4>📅 Próxima cita</h4>
      <div className="compuesto">
        <label>Fecha <input type="date" value={cita.fecha} onChange={(e) => setCita({ ...cita, fecha: e.target.value })} /></label>
        <label>Lugar <input value={cita.lugar} onChange={(e) => setCita({ ...cita, lugar: e.target.value })} /></label>
        <label>Qué llevar <input value={cita.queLlevar} onChange={(e) => setCita({ ...cita, queLlevar: e.target.value })} /></label>
      </div>
      <SeccionOrdenes embarazoId={embarazoId} ordenes={ordenes} onCambio={setOrdenes} soloLectura={cerrada} version={guardados} />
      <FirmaProfesional firma={firma} onFirma={setFirma} cierre={cerrada ? cierre : undefined} />
      {cerrada && consultaId && (ordenes.medicamentos.length > 0 || ordenes.paraclinicos.length > 0 || (ordenes.remisiones ?? []).length > 0) && (
        <button type="button" className="primario" onClick={() => ir({ tipo: 'ordenes', gestanteId, embarazoId, consultaId })}>
          🖨️ Imprimir fórmula, órdenes y remisiones
        </button>
      )}
    </>
  );
  const extras = { examenFisico: curvas, laboratorios, diagnostico: planYOrdenes };

  // Edad de la gestante (persona responsable si es menor de 18 años).
  const fechaNacimiento = valorDe(gestante.fechaNacimiento);
  const edadGestante = fechaNacimiento ? edad(fechaNacimiento, hoy()) : undefined;

  const proximaCita: Consulta['proximaCita'] = cita.fecha ? { estado: 'valor', valor: cita } : { estado: 'vacio' };

  const guardar = async (confirmado = false): Promise<Consulta | undefined> => {
    const intentar = (conf: boolean): Promise<ResultadoGuardado<Consulta>> => {
      const opciones = { consultaId, proximaCita, confirmado: conf, ordenes };
      return tipo === 'primera'
        ? servicio.guardarPrimeraConsulta(embarazoId, primera!, opciones)
        : servicio.guardarSeguimiento(embarazoId, seguimiento!, { ...opciones, egSemanas });
    };
    let r = await intentar(confirmado);
    if (r.estado === 'requiere_confirmacion' && r.advertencias.every((a) => confirmadas.has(a.mensaje))) {
      r = await intentar(true);
    }
    if (r.estado === 'requiere_confirmacion') {
      setAdvertencias(r.advertencias);
      return undefined;
    }
    if (confirmado && advertencias) setConfirmadas(new Set([...confirmadas, ...advertencias.map((a) => a.mensaje)]));
    setAdvertencias(undefined);
    // No se reemplaza el formulario con lo guardado: el profesional pudo seguir escribiendo.
    setConsultaId(r.registro.id);
    setGuardados((n) => n + 1);
    setMensaje(navigator.onLine ? 'Guardado.' : 'Guardado en este dispositivo · pendiente de enviar.');
    return r.registro;
  };

  const pedirCierre = async () => {
    const incompletas = ordenesIncompletas(ordenes);
    if (incompletas.length > 0) return setMensaje(`Complete las órdenes (sección "Plan y órdenes") antes de cerrar: ${incompletas.join('; ')}.`);
    if (!firma) return setMensaje('Firme al final de la sección "Plan y órdenes" antes de cerrar la consulta.');
    const consulta = await guardar();
    if (consulta) setVacios(servicio.camposVaciosDe(consulta));
  };

  // Respuestas del cuestionario de la gestante: se pasan a la consulta y se confirman con ella.
  const pasarCuestionario = async (c: Cuestionario) => {
    let resto: Omit<ResultadoAplicar<unknown>, 'datos'>;
    if (tipo === 'primera') {
      const { datos, ...r } = aplicarRespuestas(primera!, c.respuestas, catalogo);
      setPrimera(datos);
      resto = r;
    } else {
      const { datos, ...r } = aplicarRespuestas(seguimiento!, c.respuestas, catalogo, 'seguimiento', ctxCuestionario);
      setSeguimiento(datos);
      resto = r;
    }
    setAplicado(resto);
    await cuestionarios.marcarAplicado(c.id);
  };
  const avisoCuestionario = (
    <>
      {cuestionario && !aplicado && !cerrada && (
        <div className="aviso cuestionario-aviso">
          📝 La gestante respondió el cuestionario el {new Date(cuestionario.fechaHora).toLocaleString(localeDe(), { dateStyle: 'medium', timeStyle: 'short' })}
          {cuestionario.aplicadoEn && ' (ya se pasó a la historia una vez)'}.{' '}
          <button type="button" className="primario" onClick={() => void pasarCuestionario(cuestionario)}>
            Pasar sus respuestas a la historia
          </button>
        </div>
      )}
      {aplicado && (
        <div className="aviso cuestionario-aviso" role="status">
          {aplicado.alarmas.length > 0 && (
            <div className="cuestionario-alarmas" role="alert">
              <strong>⚠️ Revise primero lo que refiere la gestante:</strong>
              <ul>
                {aplicado.alarmas.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          <p>
            <strong>Se llenaron {aplicado.llenados.length} campos con lo que respondió la gestante.</strong> Revíselos con ella y guarde la consulta. Lo que ya estaba registrado no se cambió
            {aplicado.conservados.length > 0 && ` (${aplicado.conservados.length} campos)`}.
          </p>
          {aplicado.paraHablar.length > 0 && (
            <p>
              🔒 Prefiere hablar con usted, a solas: <em>{aplicado.paraHablar.join(' · ')}</em>
            </p>
          )}
          {aplicado.otras.length > 0 && (
            <div>
              <strong>Otras respuestas (no llenan campos):</strong>
              <ul>
                {aplicado.otras.map((o) => (
                  <li key={o.pregunta}>
                    {o.pregunta} <strong>{o.respuesta}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details>
            <summary>Campos llenados</summary>
            <p>{aplicado.llenados.join(' · ')}</p>
          </details>
        </div>
      )}
    </>
  );

  const cerrar = async () => {
    if (!consultaId) return;
    const { consulta } = await servicio.cerrarConsulta(consultaId, idInicial ? undefined : Math.round((Date.now() - inicio.current.getTime()) / 1000), firma);
    setCerrada(true);
    setCierre(consulta.cierre);
    setVacios(undefined);
    setMensaje('Consulta cerrada.');
  };

  return (
    <section>
      <button type="button" className="enlace" onClick={() => ir({ tipo: 'ficha', gestanteId })}>← {gestante.nombres} {gestante.apellidos}</button>
      <h2>{tipo === 'primera' ? 'Primera consulta' : 'Control de seguimiento'}</h2>
      {cerrada && <p className="aviso">Esta consulta está cerrada. Los cambios quedan en la bitácora.</p>}
      <PanelAlertas embarazoId={embarazoId} version={guardados} abrirDerechos={() => ir({ tipo: 'derechos', gestanteId, embarazoId })} />
      <PanelPendientes embarazoId={embarazoId} version={guardados} />

      {tipo === 'primera' ? (
        <>
          <PanelCalculos gestante={gestante} datos={primera} />
          {avisoCuestionario}
          {/* Se vuelve a montar al pasar el cuestionario, para que los controles muestren lo nuevo. */}
          <Formulario key={aplicado ? 'con-cuestionario' : 'sin-cuestionario'} bloques={BLOQUES_PRIMERA} datos={primera!} onCambio={setPrimera} clave={clave} extras={extras} ctx={{ edad: edadGestante }} />
        </>
      ) : (
        <>
          <PanelCalculos gestante={gestante} datos={primeraDelEmbarazo} />
          <p className="suave">EG del día: {egTexto ?? 'no calculable'}</p>
          {avisoCuestionario}
          <Formulario key={aplicado ? 'con-cuestionario' : 'sin-cuestionario'} bloques={BLOQUES_SEGUIMIENTO} datos={seguimiento!} onCambio={setSeguimiento} clave={clave} extras={extras} ctx={{ egSemanas, rhNegativo }} />
        </>
      )}

      {advertencias && (
        <div className="dialogo" role="alertdialog" aria-label="Confirmar valores">
          <h3>Revise estos datos antes de guardar</h3>
          <ul>{advertencias.map((a) => <li key={a.ruta + a.mensaje}>{a.mensaje}</li>)}</ul>
          <div className="navegacion">
            <button type="button" onClick={() => setAdvertencias(undefined)}>Corregir</button>
            <button type="button" className="primario" onClick={() => void guardar(true)}>Son correctos, guardar</button>
          </div>
        </div>
      )}

      {vacios && (
        <div className="dialogo" role="alertdialog" aria-label="Campos vacíos">
          <h3>{vacios.length === 0 ? 'No quedaron campos vacíos' : `Quedaron ${vacios.length} campos vacíos`}</h3>
          {vacios.length > 0 && <ul className="vacios">{vacios.map((v) => <li key={v}>{v}</li>)}</ul>}
          <div className="navegacion">
            <button type="button" onClick={() => setVacios(undefined)}>Completar</button>
            <button type="button" className="primario" onClick={() => void cerrar()}>Cerrar consulta</button>
          </div>
        </div>
      )}

      {mensaje && <p className="aviso" role="status">{mensaje}</p>}
      {cerrada && (
        <CierreCarne
          embarazoId={embarazoId}
          telefono={valorDe((tipo === 'primera' ? primera : primeraDelEmbarazo)?.identificacion.telefono)}
          correo={valorDe((tipo === 'primera' ? primera : primeraDelEmbarazo)?.identificacion.correo)}
          onImprimir={() => ir({ tipo: 'impresion', gestanteId, embarazoId })}
        />
      )}
      <div className="navegacion fija">
        <button type="button" onClick={() => void guardar()}>Guardar</button>
        {!cerrada && <button type="button" className="primario" onClick={() => void pedirCierre()}>Cerrar consulta</button>}
      </div>
    </section>
  );
}
