// B4 — Indicaciones y factores transitorios del control de seguimiento. Los exámenes están en
// la sección de laboratorios y ecografías (SeccionLaboratorios).
import { useEffect, useState } from 'react';
import type { FactorTransitorio, Indicacion, TipoFactorTransitorio, TipoIndicacion } from '../datos/modelo';
import { atcDe } from '../clinico/codigos';
import { useApp } from './contexto';

const INDICACIONES: { tipo: TipoIndicacion; etiqueta: string }[] = [
  { tipo: 'hierro', etiqueta: 'Hierro' },
  { tipo: 'acidoFolico', etiqueta: 'Ácido fólico' },
  { tipo: 'calcio', etiqueta: 'Carbonato de calcio' },
  { tipo: 'preparacionParto', etiqueta: 'Preparación para el parto' },
  { tipo: 'lactancia', etiqueta: 'Consejería en lactancia' },
];

const FACTORES: { tipo: TipoFactorTransitorio; etiqueta: string }[] = [
  { tipo: 'hiperemesis', etiqueta: 'Hiperémesis' },
  { tipo: 'cirugia', etiqueta: 'Cirugía en el embarazo' },
  { tipo: 'hiperestimulacionOvarica', etiqueta: 'Síndrome de hiperestimulación ovárica' },
  { tipo: 'infeccionSistemica', etiqueta: 'Infección sistémica (antibióticos IV u hospitalización)' },
  { tipo: 'inmovilidadODeshidratacion', etiqueta: 'Inmovilidad o deshidratación' },
  { tipo: 'hospitalizacion', etiqueta: 'Hospitalización' },
];


export function SeccionesSeguimiento({ embarazoId, alCambiar }: { embarazoId: string; alCambiar?: () => void }) {
  const { repo, servicio, hoy, catalogo } = useApp();
  const [indicaciones, setIndicaciones] = useState<Indicacion[]>([]);
  const [factores, setFactores] = useState<FactorTransitorio[]>([]);
  const [nuevoFactor, setNuevoFactor] = useState<{ tipo: TipoFactorTransitorio; inicio: string; hosp: boolean }>({ tipo: 'hiperemesis', inicio: hoy(), hosp: false });

  const cargar = async () => {
    const h = await repo.historia(embarazoId);
    setIndicaciones(h?.indicaciones ?? []);
    setFactores(h?.factores ?? []);
  };
  useEffect(() => {
    void cargar();
  }, [embarazoId]);

  const estadoDe = (tipo: TipoIndicacion) => indicaciones.find((i) => i.tipo === tipo)?.estado;

  return (
    <>
      <fieldset>
        <legend>Indicaciones</legend>
        {INDICACIONES.map(({ tipo, etiqueta }) => (
          <div key={tipo} className="fila-campo">
            <div className="etiqueta">
              {etiqueta}
              {atcDe(tipo, catalogo).length > 0 && <small>{atcDe(tipo, catalogo).map((m) => `${m.principio} · ATC ${m.atc}`).join(' + ')}</small>}
            </div>
            <div className="botones">
              {(['indicado', 'no_indicado', 'ya_lo_toma'] as const).map((estado) => (
                <button
                  key={estado}
                  type="button"
                  className={estadoDe(tipo) === estado ? 'activo' : ''}
                  onClick={async () => {
                    const motivo = estado === 'no_indicado' ? prompt('Motivo por el que no se indica:') ?? undefined : undefined;
                    if (estado === 'no_indicado' && !motivo) return;
                    await servicio.marcarIndicacion(embarazoId, tipo, { estado, motivo });
                    await cargar();
                    alCambiar?.();
                  }}
                >
                  {estado === 'indicado' ? 'Indicado' : estado === 'no_indicado' ? 'No indicado' : 'Ya lo toma'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend>Eventos que cambian el riesgo trombótico</legend>
        <ul className="lista">
          {factores.length === 0 && <li className="suave">Sin factores transitorios.</li>}
          {factores.map((f) => (
            <li key={f.id}>
              <strong>{FACTORES.find((x) => x.tipo === f.tipo)?.etiqueta}</strong> desde {f.inicio}
              {f.conHospitalizacion && ' · con hospitalización'}
              {f.resolucion ? (
                ` · resuelto el ${f.resolucion}`
              ) : (
                <button
                  type="button"
                  className="enlace"
                  onClick={async () => {
                    await servicio.resolverFactorTransitorio(f.id, hoy());
                    await cargar();
                    alCambiar?.();
                    alCambiar?.();
                  }}
                >
                  Marcar resuelto hoy
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="compuesto">
          <select value={nuevoFactor.tipo} onChange={(e) => setNuevoFactor({ ...nuevoFactor, tipo: e.target.value as TipoFactorTransitorio })}>
            {FACTORES.map((x) => <option key={x.tipo} value={x.tipo}>{x.etiqueta}</option>)}
          </select>
          <input type="date" aria-label="Inicio" value={nuevoFactor.inicio} onChange={(e) => setNuevoFactor({ ...nuevoFactor, inicio: e.target.value })} />
          <label><input type="checkbox" checked={nuevoFactor.hosp} onChange={(e) => setNuevoFactor({ ...nuevoFactor, hosp: e.target.checked })} /> Con hospitalización</label>
          <button
            type="button"
            onClick={async () => {
              await servicio.registrarFactorTransitorio(embarazoId, nuevoFactor.tipo, nuevoFactor.inicio, nuevoFactor.hosp);
              await cargar();
              alCambiar?.();
            }}
          >
            Registrar evento
          </button>
        </div>
      </fieldset>
    </>
  );
}
