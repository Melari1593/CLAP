// Modo gestante: responde el cuestionario antes de la consulta, en palabras sencillas y en su
// idioma. Sin menús de la historia: al terminar, entrega la tableta al profesional.
import { useEffect, useState } from 'react';
import type { Gestante } from '../datos/modelo';
import { NO_SABE, PREFIERO_HABLARLO, cuestionarioDe, preguntasVisibles, type ContextoCuestionario, type Pregunta, type Respuestas, type TipoCuestionario } from '../cuestionario/preguntas';
import { contextoCuestionario } from '../cuestionario/servicio';
import { etiquetaCodificado } from '../clinico/codigos';
import type { Idioma } from '../i18n/motor';
import { borrarBorrador, guardarBorrador, leerBorrador } from './borrador';
import { useApp, type Pantalla } from './contexto';
import { SelectorIdioma } from './SelectorIdioma';

type Estado = { paso: number; respuestas: Respuestas; idioma: Idioma };

function Control({ p, valor, onCambio }: { p: Pregunta; valor: unknown; onCambio: (v: unknown) => void }) {
  const { catalogo } = useApp();
  const boton = (v: unknown, texto: string, extra = '') => (
    <button key={String(v)} type="button" role="radio" aria-checked={valor === v} className={`opcion-grande ${valor === v ? 'activo' : ''} ${extra}`} onClick={() => onCambio(v)}>
      {texto}
    </button>
  );
  const finales = [boton(NO_SABE, 'No sé', 'secundaria'), ...(p.delicada ? [boton(PREFIERO_HABLARLO, 'Prefiero hablarlo con el profesional', 'secundaria')] : [])];
  switch (p.tipo) {
    case 'sino':
      return <div className="opciones-grandes" role="radiogroup" aria-label={p.texto}>{boton(true, 'Sí')}{boton(false, 'No')}{finales}</div>;
    case 'multiple': {
      // Varias a la vez; "Ninguno" deja la lista vacía (respondida, sin síntomas).
      const marcados = Array.isArray(valor) ? (valor as string[]) : [];
      const casilla = (activo: boolean, texto: string, alPulsar: () => void, clave: string) => (
        <button key={clave} type="button" role="checkbox" aria-checked={activo} className={`opcion-grande ${activo ? 'activo' : ''}`} onClick={alPulsar}>
          {activo ? '☑' : '☐'} {texto}
        </button>
      );
      return (
        <div className="opciones-grandes" role="group" aria-label={p.texto}>
          {p.opciones!.map((o) =>
            casilla(marcados.includes(o.valor), o.texto, () => onCambio(marcados.includes(o.valor) ? marcados.filter((v) => v !== o.valor) : [...marcados, o.valor]), o.valor),
          )}
          {casilla(Array.isArray(valor) && marcados.length === 0, 'Ninguno', () => onCambio([]), 'ninguno')}
          {finales}
        </div>
      );
    }
    case 'opciones':
      return <div className="opciones-grandes" role="radiogroup" aria-label={p.texto}>{p.opciones!.map((o) => boton(o.valor, o.texto))}{finales}</div>;
    case 'numero':
      return (
        <div className="opciones-grandes">
          <span className="numero">
            <input
              type="number"
              inputMode="decimal"
              aria-label={p.texto}
              value={typeof valor === 'number' ? valor : ''}
              onChange={(e) => onCambio(e.target.value === '' ? undefined : Number(e.target.value.replace(',', '.')))}
            />
            {p.unidad && <span className="unidad">{p.unidad}</span>}
          </span>
          {finales}
        </div>
      );
    case 'fecha':
      return (
        <div className="opciones-grandes">
          <input type="date" aria-label={p.texto} value={typeof valor === 'string' && valor !== NO_SABE ? valor : ''} onChange={(e) => onCambio(e.target.value || undefined)} />
          {finales}
        </div>
      );
    case 'municipio':
    case 'aseguradora': {
      const lista = p.tipo === 'municipio' ? 'codigos.divipola' : 'codigos.aseguradoras';
      return (
        <div className="opciones-grandes">
          <input list={`cuestionario-${p.tipo}`} aria-label={p.texto} value={typeof valor === 'string' && valor !== NO_SABE ? valor : ''} onChange={(e) => onCambio(e.target.value || undefined)} />
          <datalist id={`cuestionario-${p.tipo}`} data-no-traducir>
            {catalogo.valor(lista).map((o) => <option key={o.codigo} value={etiquetaCodificado(o)} />)}
          </datalist>
          {finales}
        </div>
      );
    }
    default:
      return <textarea aria-label={p.texto} rows={3} value={typeof valor === 'string' ? valor : ''} onChange={(e) => onCambio(e.target.value || undefined)} />;
  }
}

interface Props {
  gestanteId: string;
  embarazoId: string;
  /** Primera consulta o control de seguimiento. */
  consulta?: TipoCuestionario;
  ir: (p: Pantalla) => void;
}

export function PantallaCuestionario({ gestanteId, embarazoId, consulta = 'primera', ir }: Props) {
  const { repo, cuestionarios } = useApp();
  const clave = `cuestionario:${embarazoId}:${consulta}`;
  const secciones = cuestionarioDe(consulta);
  const [ctx, setCtx] = useState<ContextoCuestionario>({ indicaciones: [] });
  const [gestante, setGestante] = useState<Gestante>();
  const [estado, setEstadoInterno] = useState<Estado>(() => leerBorrador<Estado>(clave) ?? { paso: -1, respuestas: {}, idioma: 'es' });
  const [terminado, setTerminado] = useState(false);
  const setEstado = (e: Estado) => {
    setEstadoInterno(e);
    guardarBorrador(clave, e);
  };

  useEffect(() => {
    void repo.leer('gestantes', gestanteId).then(setGestante);
    void repo.historia(embarazoId).then((h) => {
      if (h) setCtx(contextoCuestionario(h.indicaciones));
      // Ofrece el idioma del carné si ya lo eligió.
      const idioma = h?.carne?.idioma;
      if (idioma && !leerBorrador<Estado>(clave)) setEstadoInterno((e) => ({ ...e, idioma }));
    });
  }, [repo, gestanteId, embarazoId]);

  const total = secciones.length;
  const seccion = secciones[estado.paso];
  const responder = (id: string, v: unknown) => setEstado({ ...estado, respuestas: { ...estado.respuestas, [id]: v } });
  const irPaso = (paso: number) => {
    setEstado({ ...estado, paso });
    window.scrollTo(0, 0);
  };
  const terminar = async () => {
    await cuestionarios.guardar(embarazoId, estado.respuestas, estado.idioma, consulta);
    borrarBorrador(clave);
    setTerminado(true);
    window.scrollTo(0, 0);
  };

  return (
    <main className="cuestionario" data-idioma={estado.idioma} lang={estado.idioma}>
      <div className="cuestionario-barra">
        <img src="/logo.png" alt="" width={28} height={60} />
        <SelectorIdioma idioma={estado.idioma} onCambio={(idioma) => setEstado({ ...estado, idioma })} />
      </div>

      {terminado ? (
        <section className="cuestionario-fin">
          <h2>¡Gracias!</h2>
          <p>Tus respuestas quedaron guardadas. Entrega la tableta al profesional de salud: las revisará contigo en la consulta.</p>
          <button type="button" className="enlace" onClick={() => ir({ tipo: 'ficha', gestanteId })}>Volver a la historia (solo el profesional)</button>
        </section>
      ) : estado.paso < 0 || !seccion ? (
        <section className="cuestionario-inicio">
          <h2>
            Hola{gestante ? ', ' : ''}
            {gestante && <span data-no-traducir>{gestante.nombres.split(' ')[0]}</span>}
          </h2>
          {consulta === 'primera' ? (
            <p>Antes de tu consulta, responde unas preguntas sobre tu salud y tu embarazo. Toma unos 10 minutos.</p>
          ) : (
            <p>Antes de tu control, cuéntanos cómo has estado desde la última consulta. Toma unos 3 minutos.</p>
          )}
          <ul>
            <li>Si no sabes una respuesta, marca "No sé".</li>
            <li>Tus respuestas son confidenciales y solo las ve el profesional que te atiende.</li>
            <li>En la consulta las revisarán contigo.</li>
          </ul>
          <button type="button" className="primario grande" onClick={() => irPaso(0)}>Empezar</button>
          <button type="button" className="enlace" onClick={() => ir({ tipo: 'ficha', gestanteId })}>Volver (solo el profesional)</button>
        </section>
      ) : (
        <section>
          <p className="cuestionario-progreso">Parte {estado.paso + 1} de {total}</p>
          <progress max={total} value={estado.paso + 1} aria-hidden />
          <h2>
            <span aria-hidden>{seccion.icono} </span>
            {seccion.titulo}
          </h2>
          {preguntasVisibles(seccion, estado.respuestas, ctx).map((p) => (
            <div key={p.id} className="pregunta">
              <p className="pregunta-texto">{p.texto}</p>
              {p.ayuda && <p className="suave">{p.ayuda}</p>}
              <Control p={p} valor={estado.respuestas[p.id]} onCambio={(v) => responder(p.id, v)} />
            </div>
          ))}
          <div className="navegacion">
            <button type="button" onClick={() => irPaso(estado.paso - 1)}>← Atrás</button>
            {estado.paso < total - 1 ? (
              <button type="button" className="primario" onClick={() => irPaso(estado.paso + 1)}>Siguiente →</button>
            ) : (
              <button type="button" className="primario" onClick={() => void terminar()}>Terminar</button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
