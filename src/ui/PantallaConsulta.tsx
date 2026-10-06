// B2 / B4 — Primera consulta y control de seguimiento.
import { useEffect, useState } from 'react';
import type { Consulta, DatosPrimeraConsulta, DatosSeguimiento, Gestante } from '../datos/modelo';
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
import { SeccionesSeguimiento } from './SeccionesSeguimiento';

type Cita = { fecha: string; lugar: string; queLlevar: string };

interface Props {
  tipo: 'primera' | 'seguimiento';
  gestanteId: string;
  embarazoId: string;
  consultaId?: string;
  ir: (p: Pantalla) => void;
}

export function PantallaConsulta({ tipo, gestanteId, embarazoId, consultaId: idInicial, ir }: Props) {
  const { repo, servicio } = useApp();
  const [gestante, setGestante] = useState<Gestante>();
  const [primeraDelEmbarazo, setPrimeraDelEmbarazo] = useState<DatosPrimeraConsulta>();
  const [egSemanas, setEgSemanas] = useState<number>();
  const [egTexto, setEgTexto] = useState<string>();
  const [consultaId, setConsultaId] = useState(idInicial);
  const [cerrada, setCerrada] = useState(false);
  const [primera, setPrimera] = useState<DatosPrimeraConsulta>();
  const [seguimiento, setSeguimiento] = useState<DatosSeguimiento>();
  const [cita, setCita] = useState<Cita>({ fecha: '', lugar: '', queLlevar: '' });
  const [advertencias, setAdvertencias] = useState<Advertencia[]>();
  /** Advertencias que el profesional ya confirmó: no se vuelven a preguntar. */
  const [confirmadas, setConfirmadas] = useState<Set<string>>(new Set());
  const [vacios, setVacios] = useState<string[]>();
  const [mensaje, setMensaje] = useState<string>();

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
        setPrimeraDelEmbarazo(historia.consultas.find((c) => c.tipo === 'primera')?.primera);
      }
      if (existente) {
        setCerrada(existente.cerrada);
        if (existente.proximaCita.estado === 'valor') setCita(existente.proximaCita.valor);
      }
      if (tipo === 'primera') setPrimera(existente?.primera ?? aplicarNoCorresponde(BLOQUES_PRIMERA, primeraConsultaVacia(), {}));
      else setSeguimiento(existente?.seguimiento ?? seguimientoVacio());
    })();
  }, [repo, servicio, gestanteId, embarazoId, idInicial, tipo]);

  if (!gestante || (tipo === 'primera' ? !primera : !seguimiento)) return <p>Cargando…</p>;

  const proximaCita: Consulta['proximaCita'] = cita.fecha ? { estado: 'valor', valor: cita } : { estado: 'vacio' };

  const guardar = async (confirmado = false): Promise<Consulta | undefined> => {
    const intentar = (conf: boolean): Promise<ResultadoGuardado<Consulta>> => {
      const opciones = { consultaId, proximaCita, confirmado: conf };
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
    setMensaje(navigator.onLine ? 'Guardado.' : 'Guardado en este dispositivo · pendiente de enviar.');
    return r.registro;
  };

  const pedirCierre = async () => {
    const consulta = await guardar();
    if (consulta) setVacios(servicio.camposVaciosDe(consulta));
  };

  const cerrar = async () => {
    if (!consultaId) return;
    await servicio.cerrarConsulta(consultaId);
    setCerrada(true);
    setVacios(undefined);
    setMensaje('Consulta cerrada. (La vista previa y el envío del carné llegan con el Bloque F.)');
  };

  return (
    <section>
      <button type="button" className="enlace" onClick={() => ir({ tipo: 'ficha', gestanteId })}>← {gestante.nombres} {gestante.apellidos}</button>
      <h2>{tipo === 'primera' ? 'Primera consulta' : 'Control de seguimiento'}</h2>
      {cerrada && <p className="aviso">Esta consulta está cerrada. Los cambios quedan en la bitácora.</p>}

      {tipo === 'primera' ? (
        <>
          <PanelCalculos gestante={gestante} datos={primera} />
          <Formulario bloques={BLOQUES_PRIMERA} datos={primera!} onCambio={setPrimera} />
        </>
      ) : (
        <>
          <PanelCalculos gestante={gestante} datos={primeraDelEmbarazo} />
          <p className="suave">EG del día: {egTexto ?? 'no calculable'}</p>
          <Formulario bloques={BLOQUES_SEGUIMIENTO} datos={seguimiento!} onCambio={setSeguimiento} ctx={{ egSemanas }} />
        </>
      )}

      {tipo === 'seguimiento' &&
        (consultaId ? (
          <SeccionesSeguimiento embarazoId={embarazoId} consultaId={consultaId} />
        ) : (
          <p className="suave">Guarde el control para registrar exámenes, indicaciones y factores transitorios.</p>
        ))}

      <fieldset>
        <legend>Próxima cita</legend>
        <div className="compuesto">
          <label>Fecha <input type="date" value={cita.fecha} onChange={(e) => setCita({ ...cita, fecha: e.target.value })} /></label>
          <label>Lugar <input value={cita.lugar} onChange={(e) => setCita({ ...cita, lugar: e.target.value })} /></label>
          <label>Qué llevar <input value={cita.queLlevar} onChange={(e) => setCita({ ...cita, queLlevar: e.target.value })} /></label>
        </div>
      </fieldset>

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
      <div className="navegacion fija">
        <button type="button" onClick={() => void guardar()}>Guardar</button>
        {!cerrada && <button type="button" className="primario" onClick={() => void pedirCierre()}>Cerrar consulta</button>}
      </div>
    </section>
  );
}
