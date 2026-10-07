// F4 / F6 — Lo que ve la gestante. Un solo componente para la vista previa, el carné web y el impreso.
import type { DatosCarne } from '../privacidad/carne';
import { ANTIRRUBEOLA, QUE_HACER, SENALES_COAGULO, SIGNOS_ALARMA, TUS_DERECHOS } from '../carne/textos';

const fecha = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fechaCorta = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

export function CarneGestante({ datos }: { datos: DatosCarne }) {
  if (datos.estado === 'pausado') {
    return (
      <article className="carne">
        <p className="carne-pausado">{datos.mensaje}</p>
      </article>
    );
  }
  const queHacer = datos.indicaciones.flatMap((i) => (QUE_HACER[i] ? [{ id: i, ...QUE_HACER[i]! }] : []));
  return (
    <article className="carne" aria-label="Carné de control prenatal">
      <header>
        <h2>Hola, {datos.nombre}</h2>
        <small>Actualizado el {fechaCorta(datos.actualizado)}</small>
      </header>

      <section className="carne-grande">
        <span aria-hidden>🤰</span>
        {datos.semanas ? (
          <p>
            Vas en la semana <strong>{datos.semanas.semanas}</strong>
            {datos.semanas.dias > 0 && ` y ${datos.semanas.dias} ${datos.semanas.dias === 1 ? 'día' : 'días'}`}.
            {datos.fpp && <> Tu bebé podría nacer cerca del <strong>{fecha(datos.fpp)}</strong>.</>}
          </p>
        ) : (
          <p>Te harán una ecografía para saber en qué semana vas.</p>
        )}
      </section>

      <section>
        <h3><span aria-hidden>📅</span> Tu próxima cita</h3>
        {datos.proximaCita ? (
          <p>
            <strong>{fecha(datos.proximaCita.fecha)}</strong>
            {datos.proximaCita.lugar && <> en {datos.proximaCita.lugar}</>}.
            {datos.proximaCita.queLlevar && <> Lleva: {datos.proximaCita.queLlevar}.</>}
          </p>
        ) : (
          <p>Pregunta en tu servicio de salud cuándo es tu próxima cita.</p>
        )}
      </section>

      {queHacer.length > 0 && (
        <section>
          <h3><span aria-hidden>✅</span> Lo que debes hacer</h3>
          <ul className="carne-lista">
            {queHacer.map((q) => (
              <li key={q.id}><span aria-hidden>{q.icono}</span> {q.texto}</li>
            ))}
          </ul>
        </section>
      )}

      {datos.examenesPendientes.length > 0 && (
        <section>
          <h3><span aria-hidden>🧪</span> Exámenes y vacunas que te faltan</h3>
          <ul className="carne-lista">{datos.examenesPendientes.map((e) => <li key={e}>{e}</li>)}</ul>
        </section>
      )}

      <section className="carne-urgencia">
        <h3><span aria-hidden>🚨</span> Ve de urgencia si tienes</h3>
        <ul className="carne-iconos">
          {SIGNOS_ALARMA.map((s) => (
            <li key={s.texto}><span aria-hidden>{s.icono}</span> {s.texto}</li>
          ))}
        </ul>
        {datos.senalesCoagulo && (
          <>
            <p><strong>Señales de coágulo:</strong></p>
            <ul className="carne-lista">{SENALES_COAGULO.map((s) => <li key={s}>{s}</li>)}</ul>
          </>
        )}
      </section>

      <section>
        <h3><span aria-hidden>🩸</span> Tus datos</h3>
        <p>
          Grupo y Rh: <strong>{datos.grupo ?? '—'} {datos.rh ?? ''}</strong>
        </p>
        {datos.vacunas.antirrubeola && <p>{ANTIRRUBEOLA[datos.vacunas.antirrubeola]}</p>}
        {datos.vacunas.antitetanicaDosisPrevias !== undefined && <p>Antitetánica: {datos.vacunas.antitetanicaDosisPrevias} dosis antes de este embarazo.</p>}
        {datos.citas.length > 0 && (
          <table className="carne-citas">
            <thead>
              <tr><th>Cita</th><th>Peso</th><th>Presión</th></tr>
            </thead>
            <tbody>
              {datos.citas.map((c) => (
                <tr key={c.fecha}>
                  <td>{fechaCorta(c.fecha)}</td>
                  <td>{c.pesoKg !== undefined ? `${c.pesoKg} kg` : '—'}</td>
                  <td>{c.presion ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3><span aria-hidden>🤝</span> Tus derechos</h3>
        <ul className="carne-lista">{TUS_DERECHOS.map((d) => <li key={d}>{d}</li>)}</ul>
      </section>
    </article>
  );
}
