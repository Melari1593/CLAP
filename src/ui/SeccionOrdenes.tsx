// Fórmula médica y órdenes de paraclínicos, al final de la consulta.
import { useEffect, useState } from 'react';
import type { OrdenMedicamento, OrdenParaclinico, Ordenes, TipoExamen } from '../datos/modelo';
import { faltantesMedicamento, medicamentoDesde, numeroEnLetras, paraclinicoDe } from '../consultas/ordenes';
import { construirContexto } from '../alertas/motor';
import { recordatorios } from '../recordatorios/recordatorios';
import { EXAMENES } from '../examenes/resumen';
import { useApp } from './contexto';

export function SeccionOrdenes({ embarazoId, ordenes, onCambio, soloLectura, version = 0 }: {
  embarazoId: string;
  /** Sube con cada guardado para recalcular los exámenes pendientes. */
  version?: number;
  ordenes: Ordenes;
  onCambio: (o: Ordenes) => void;
  soloLectura?: boolean;
}) {
  const { repo, catalogo, hoy } = useApp();
  const plantillas = catalogo.valor('ordenes.medicamentos');
  const [pendientes, setPendientes] = useState<TipoExamen[]>([]);
  const [examen, setExamen] = useState<TipoExamen | ''>('');
  const [otro, setOtro] = useState('');

  useEffect(() => {
    void repo.historia(embarazoId).then((h) => {
      if (h) setPendientes([...new Set(recordatorios(construirContexto(h, hoy(), catalogo)).flatMap((r) => (r.examen ? [r.examen] : [])))]);
    });
  }, [repo, embarazoId, catalogo, hoy, version]);

  const med = (i: number, cambios: Partial<OrdenMedicamento>) =>
    onCambio({ ...ordenes, medicamentos: ordenes.medicamentos.map((m, j) => (j === i ? { ...m, ...cambios } : m)) });
  const par = (i: number, cambios: Partial<OrdenParaclinico>) =>
    onCambio({ ...ordenes, paraclinicos: ordenes.paraclinicos.map((p, j) => (j === i ? { ...p, ...cambios } : p)) });
  const agregarParaclinicos = (lista: OrdenParaclinico[]) => {
    const nuevos = lista.filter((p) => !ordenes.paraclinicos.some((x) => (p.examen ? x.examen === p.examen : x.nombre === p.nombre)));
    if (nuevos.length) onCambio({ ...ordenes, paraclinicos: [...ordenes.paraclinicos, ...nuevos] });
  };
  const sinOrdenar = pendientes.filter((t) => !ordenes.paraclinicos.some((p) => p.examen === t));

  const texto = (i: number, k: keyof OrdenMedicamento, etiqueta: string, ancho?: boolean) => (
    <label className={ancho ? 'ancho' : undefined}>
      {etiqueta}
      <input disabled={soloLectura} value={String(ordenes.medicamentos[i]![k] ?? '')} onChange={(e) => med(i, { [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="ordenes">
      <h4>💊 Fórmula médica</h4>

      {ordenes.medicamentos.length === 0 && <p className="suave">Sin medicamentos formulados en esta consulta.</p>}
      {ordenes.medicamentos.map((m, i) => {
        const faltan = faltantesMedicamento(m);
        return (
          <div key={m.id} className={`tarjeta orden ${faltan.length ? 'incompleta' : ''}`}>
            <div className="compuesto">
              {texto(i, 'principio', 'Medicamento (nombre genérico)', true)}
              {texto(i, 'presentacion', 'Concentración y forma')}
              {texto(i, 'dosis', 'Dosis')}
              {texto(i, 'via', 'Vía')}
              {texto(i, 'frecuencia', 'Frecuencia')}
              {texto(i, 'duracion', 'Duración')}
              <label>
                Cantidad total
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  disabled={soloLectura}
                  value={m.cantidad ?? ''}
                  onChange={(e) => med(i, { cantidad: e.target.value ? Math.round(Number(e.target.value)) : null })}
                />
                {m.cantidad ? <small className="suave"> ({numeroEnLetras(m.cantidad)})</small> : null}
              </label>
              {texto(i, 'indicaciones', 'Indicaciones', true)}
            </div>
            {m.atc && <small className="suave">ATC {m.atc}</small>}
            {faltan.length > 0 && <p className="error">Falta: {faltan.join(', ')}.</p>}
            {!soloLectura && (
              <button type="button" className="enlace" onClick={() => onCambio({ ...ordenes, medicamentos: ordenes.medicamentos.filter((_, j) => j !== i) })}>
                Quitar
              </button>
            )}
          </div>
        );
      })}
      {!soloLectura && (
        <div className="compuesto">
          <select
            aria-label="Agregar medicamento"
            value=""
            onChange={(e) => {
              const p = e.target.value === 'otro' ? undefined : plantillas[Number(e.target.value)];
              onCambio({ ...ordenes, medicamentos: [...ordenes.medicamentos, medicamentoDesde(p)] });
            }}
          >
            <option value="">+ Agregar medicamento…</option>
            {plantillas.map((p, i) => <option key={p.principio} value={i}>{p.principio} · {p.presentacion}</option>)}
            <option value="otro">Otro medicamento</option>
          </select>
        </div>
      )}

      <h4>🧪 Orden de paraclínicos (laboratorios e imágenes)</h4>
      {ordenes.paraclinicos.length === 0 && <p className="suave">Sin paraclínicos ordenados en esta consulta.</p>}
      <ul className="lista">
        {ordenes.paraclinicos.map((p, i) => (
          <li key={p.id}>
            <strong>{p.nombre}</strong>
            {p.cups ? <small className="suave"> · CUPS {p.cups}</small> : <small className="suave"> · sin código CUPS</small>}
            <input
              aria-label={`Justificación de ${p.nombre}`}
              placeholder="Justificación (opcional)"
              disabled={soloLectura}
              value={p.justificacion ?? ''}
              onChange={(e) => par(i, { justificacion: e.target.value || undefined })}
            />
            {!soloLectura && (
              <button type="button" className="enlace" onClick={() => onCambio({ ...ordenes, paraclinicos: ordenes.paraclinicos.filter((_, j) => j !== i) })}>
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>
      {!soloLectura && (
        <>
          {sinOrdenar.length > 0 && (
            <button type="button" onClick={() => agregarParaclinicos(sinOrdenar.map((t) => paraclinicoDe(t, catalogo)))}>
              Ordenar los {sinOrdenar.length} exámenes pendientes de hoy
            </button>
          )}
          <div className="compuesto">
            <select aria-label="Paraclínico" value={examen} onChange={(e) => setExamen(e.target.value as TipoExamen | '')}>
              <option value="">Elegir examen…</option>
              {EXAMENES.map((x) => <option key={x.tipo} value={x.tipo}>{x.etiqueta}</option>)}
            </select>
            <button type="button" disabled={!examen} onClick={() => { if (examen) agregarParaclinicos([paraclinicoDe(examen, catalogo)]); setExamen(''); }}>
              Agregar
            </button>
          </div>
          <div className="compuesto">
            <input aria-label="Otro paraclínico" placeholder="Otro paraclínico (nombre)" value={otro} onChange={(e) => setOtro(e.target.value)} />
            <button
              type="button"
              disabled={!otro.trim()}
              onClick={() => {
                agregarParaclinicos([{ id: crypto.randomUUID(), nombre: otro.trim(), examen: null, cups: null }]);
                setOtro('');
              }}
            >
              Agregar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
