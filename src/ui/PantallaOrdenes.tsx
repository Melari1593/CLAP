// Fórmula médica y orden de paraclínicos para imprimir o guardar en PDF, con la firma del cierre.
import { useEffect, useState } from 'react';
import type { Consulta, Gestante } from '../datos/modelo';
import { valorDe } from '../datos/campo';
import { edad } from '../clinico/calculos';
import { etiquetaCodificado } from '../clinico/codigos';
import { numeroEnLetras, PRIORIDAD_REMISION } from '../consultas/ordenes';
import { useApp, type Pantalla } from './contexto';

export function PantallaOrdenes({ gestanteId, embarazoId, consultaId, ir }: { gestanteId: string; embarazoId: string; consultaId: string; ir: (p: Pantalla) => void }) {
  const { repo, servicio, institucion } = useApp();
  const [gestante, setGestante] = useState<Gestante>();
  const [consulta, setConsulta] = useState<Consulta>();
  const [datos, setDatos] = useState<{ eg?: string; identificacion?: NonNullable<Consulta['primera']>['identificacion'] }>({});

  useEffect(() => {
    void (async () => {
      setGestante(await repo.leer('gestantes', gestanteId));
      const h = await repo.historia(embarazoId);
      const c = h?.consultas.find((x) => x.id === consultaId);
      setConsulta(c);
      if (h && c) {
        const eg = servicio.egDeHistoria(h, c.fecha);
        setDatos({
          eg: eg.estado === 'calculada' ? `${eg.semanas} semanas + ${eg.diasResto} días` : undefined,
          identificacion: h.consultas.find((x) => x.tipo === 'primera')?.primera?.identificacion,
        });
      }
    })();
  }, [repo, servicio, gestanteId, embarazoId, consultaId]);

  if (!gestante || !consulta) return <p>Cargando…</p>;
  const o = consulta.ordenes ?? { medicamentos: [], paraclinicos: [] };
  const dx = valorDe((consulta.primera ?? consulta.seguimiento)?.diagnosticoPlan.diagnosticos) ?? [];
  const nacimiento = valorDe(gestante.fechaNacimiento);
  const id = datos.identificacion;
  const volver = () => ir({ tipo: consulta.tipo, gestanteId, embarazoId, consultaId });

  const encabezado = (titulo: string) => (
    <header className="orden-encabezado">
      <p><strong>{institucion.nombre}</strong>{institucion.ficticia && ' (ficticia)'}</p>
      <h2>{titulo}</h2>
      <p>
        <strong>{gestante.nombres} {gestante.apellidos}</strong> · {gestante.documentoTipo} {gestante.documentoNumero}
        {nacimiento && ` · ${edad(nacimiento, consulta.fecha)} años`}
        <br />
        Fecha: {consulta.fecha}{datos.eg && ` · EG ${datos.eg}`}
        {id && valorDe(id.aseguradora) && ` · ${etiquetaCodificado(valorDe(id.aseguradora))}`}
        {id && valorDe(id.regimen) && ` · régimen ${valorDe(id.regimen)}`}
      </p>
      {dx.length > 0 && <p>Diagnósticos: {dx.map((d) => `${d.codigo} ${d.descripcion}`).join('; ')}</p>}
    </header>
  );

  const firma = consulta.cierre && (
    <footer className="orden-firma">
      {consulta.cierre.firma && <img src={consulta.cierre.firma} alt="Firma" className="firma-imagen" />}
      <p>
        <strong>{consulta.cierre.profesional}</strong>
        {consulta.cierre.registroProfesional && ` · Registro profesional ${consulta.cierre.registroProfesional}`}
        <br />
        <small>{new Date(consulta.cierre.fechaHora).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</small>
      </p>
    </footer>
  );

  return (
    <section className="impresion ordenes-impresion">
      <div className="no-imprimir navegacion">
        <button type="button" onClick={volver}>← Volver a la consulta</button>
        <button type="button" className="primario" disabled={!consulta.cierre} onClick={() => window.print()}>Imprimir o guardar en PDF</button>
      </div>
      {!consulta.cierre && <p className="aviso no-imprimir">Cierre y firme la consulta para imprimir la fórmula y las órdenes.</p>}

      {o.medicamentos.length > 0 && (
        <article className="hoja">
          {encabezado('Fórmula médica')}
          <ol>
            {o.medicamentos.map((m) => (
              <li key={m.id}>
                <strong>{m.principio}</strong> · {m.presentacion}
                <br />
                {m.dosis} · vía {m.via.toLowerCase()} · {m.frecuencia.toLowerCase()} · durante {m.duracion}
                <br />
                Cantidad: {m.cantidad} ({m.cantidad ? numeroEnLetras(m.cantidad) : '—'})
                {m.indicaciones && <><br />Indicaciones: {m.indicaciones}</>}
              </li>
            ))}
          </ol>
          {firma}
        </article>
      )}

      {o.paraclinicos.length > 0 && (
        <article className="hoja">
          {encabezado('Orden de paraclínicos')}
          <table className="tabla-au">
            <thead><tr><th>CUPS</th><th>Examen</th><th>Justificación</th></tr></thead>
            <tbody>
              {o.paraclinicos.map((p) => (
                <tr key={p.id}><td>{p.cups ?? '—'}</td><td>{p.nombre}</td><td>{p.justificacion ?? ''}</td></tr>
              ))}
            </tbody>
          </table>
          {firma}
        </article>
      )}

      {(o.remisiones ?? []).map((r) => (
        <article key={r.id} className="hoja">
          {encabezado('Orden de remisión')}
          <p><strong>Remitida a:</strong> {r.servicio}</p>
          <p><strong>Prioridad:</strong> {PRIORIDAD_REMISION[r.prioridad]}</p>
          <p><strong>Motivo:</strong> {r.motivo}</p>
          {r.resumen && <p><strong>Resumen clínico:</strong> {r.resumen}</p>}
          {firma}
        </article>
      ))}

      {o.medicamentos.length === 0 && o.paraclinicos.length === 0 && !(o.remisiones ?? []).length && <p>Esta consulta no tiene medicamentos, paraclínicos ni remisiones.</p>}
    </section>
  );
}
