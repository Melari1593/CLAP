// B4 — Exámenes, indicaciones y factores transitorios del control de seguimiento.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type {
  FactorTransitorio,
  Indicacion,
  ResultadoExamen,
  TipoExamen,
  TipoFactorTransitorio,
  TipoIndicacion,
} from '../datos/modelo';
import { validarHb } from '../consultas/validaciones';
import { construirContexto } from '../alertas/motor';
import { clasificarHb, explicarHb } from '../alertas/anemia';
import type { Historia } from '../datos/repositorio';
import { useApp } from './contexto';
import { EXAMENES, etiquetaExamen, resumenExamen as resumen } from '../examenes/resumen';


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


function NuevoExamen({ onRegistrar }: { onRegistrar: (tipo: TipoExamen, valor: unknown, fecha: string) => Promise<void> }) {
  const { catalogo, hoy } = useApp();
  const [tipo, setTipo] = useState<TipoExamen>('hb');
  const [fecha, setFecha] = useState(hoy());
  const [f, setF] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string>();
  const n = (k: string) => (f[k] ? Number(f[k].replace(',', '.')) : undefined);
  const b = (k: string) => (f[k] === 'si' ? true : f[k] === 'no' ? false : null);
  const campo = (k: string, etiqueta: string, control: ReactNode) => (
    <label key={k}>{etiqueta} {control}</label>
  );
  const numero = (k: string, etiqueta: string, unidad: string) =>
    campo(k, etiqueta, <><input type="number" step="0.1" inputMode="decimal" aria-label={etiqueta} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /> {unidad}</>);
  const opcion = (k: string, etiqueta: string, ops: [string, string][]) =>
    campo(k, etiqueta, (
      <select aria-label={etiqueta} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
        <option value="">—</option>
        {ops.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    ));
  const siNo = (k: string, etiqueta: string) => opcion(k, etiqueta, [['si', 'Sí'], ['no', 'No']]);
  const positivo = (k: string, etiqueta: string) => opcion(k, etiqueta, [['si', 'Positivo'], ['no', 'Negativo']]);

  const campos: Record<TipoExamen, ReactNode> = {
    hemoclasificacion: <>{opcion('grupo', 'Grupo', [['A', 'A'], ['B', 'B'], ['AB', 'AB'], ['O', 'O']])}{opcion('rh', 'Rh', [['+', 'Positivo'], ['-', 'Negativo']])}</>,
    hb: <>{numero('gdl', 'Hb', 'g/dL')}{opcion('muestra', 'Muestra', [['venosa', 'Venosa'], ['capilar', 'Capilar']])}{numero('plaquetasHemograma', 'Plaquetas', '× 10⁹/L')}</>,
    plaquetas: numero('x10e9L', 'Plaquetas', '× 10⁹/L'),
    ferritina: numero('ngMl', 'Ferritina', 'ng/mL'),
    saturacionTransferrina: numero('porcentaje', 'Saturación', '%'),
    inflamacion: <>{siNo('presente', 'Presente')}{campo('descripcion', 'Descripción', <input value={f.descripcion ?? ''} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />)}</>,
    vdrl: <>{opcion('reactivo', 'Resultado', [['si', 'Reactivo'], ['no', 'No reactivo']])}{siNo('fta', 'FTA')}{siNo('tratamiento', 'Tratamiento')}{siNo('tratamientoPareja', 'Tratamiento de la pareja')}</>,
    vih: <>{siNo('solicitado', 'Solicitado')}{siNo('realizado', 'Realizado')}{opcion('resultado', 'Resultado', [['negativo', 'Negativo'], ['positivo', 'Positivo'], ['no_realizado', 'No realizado']])}</>,
    sifilisTreponemica: opcion('reactiva', 'Resultado', [['no', 'No reactiva'], ['si', 'Reactiva']]),
    rubeolaIgG: positivo('positivo', 'Resultado'),
    varicelaIgG: positivo('positivo', 'Resultado'),
    coombsIndirecto: positivo('positivo', 'Resultado'),
    ecografia: <>{opcion('momento', 'Momento', [['primer_trimestre', 'De 10+6 a 13+6'], ['detalle', 'De detalle (18–23+6)'], ['otra', 'Otra']])}{opcion('hallazgos', 'Hallazgos', [['normal', 'Normales'], ['anormal', 'Anormales']])}</>,
    hepatitisB: opcion('antigenoSuperficie', 'Antígeno de superficie', [['negativo', 'Negativo'], ['positivo', 'Positivo']]),
    toxoplasmosis: (
      <>
        {opcion('igg', 'IgG', [['positivo', 'Positivo'], ['negativo', 'Negativo']])}
        {numero('iggTitulo', 'Título de IgG', 'UI/mL')}
        {opcion('igm', 'IgM', [['positivo', 'Positivo'], ['negativo', 'Negativo']])}
        {opcion('iga', 'IgA (si se pidió)', [['positivo', 'Positivo'], ['negativo', 'Negativo']])}
        {opcion('avidez', 'Avidez de IgG (si se pidió)', [['alta', 'Alta'], ['intermedia', 'Intermedia'], ['baja', 'Baja']])}
      </>
    ),
    pcrLiquidoAmniotico: positivo('positivo', 'Resultado'),
    chagas: positivo('positivo', 'Resultado'),
    malaria: positivo('positivo', 'Resultado'),
    bacteriuria: positivo('positivo', 'Resultado'),
    egb: positivo('positivo', 'Resultado'),
    ptog: <>{numero('ayunas', 'Ayunas', 'mg/dL')}{numero('unaHora', '1 hora', 'mg/dL')}{numero('dosHoras', '2 horas', 'mg/dL')}</>,
  };

  const valor = (): unknown => {
    const c = (x: number | undefined) => (x === undefined ? { estado: 'vacio' } : { estado: 'valor', valor: x });
    switch (tipo) {
      case 'hemoclasificacion': return f.grupo && f.rh ? { grupo: f.grupo, rh: f.rh } : undefined;
      case 'hb': return n('gdl') !== undefined && f.muestra ? { gdl: n('gdl'), muestra: f.muestra } : undefined;
      case 'plaquetas': return n('x10e9L') !== undefined ? { x10e9L: n('x10e9L') } : undefined;
      case 'ferritina': return n('ngMl') !== undefined ? { ngMl: n('ngMl') } : undefined;
      case 'saturacionTransferrina': return n('porcentaje') !== undefined ? { porcentaje: n('porcentaje') } : undefined;
      case 'inflamacion': return b('presente') === null ? undefined : { presente: b('presente'), descripcion: f.descripcion ?? '' };
      case 'vdrl': return b('reactivo') === null ? undefined : { reactivo: b('reactivo'), fta: b('fta'), tratamiento: b('tratamiento'), tratamientoPareja: b('tratamientoPareja') };
      case 'vih': return f.resultado ? { solicitado: b('solicitado') ?? false, realizado: b('realizado') ?? false, resultado: f.resultado } : undefined;
      case 'sifilisTreponemica': return b('reactiva') === null ? undefined : { reactiva: b('reactiva') };
      case 'ecografia': return f.momento && f.hallazgos ? { momento: f.momento, hallazgos: f.hallazgos } : undefined;
      case 'hepatitisB': return f.antigenoSuperficie ? { antigenoSuperficie: f.antigenoSuperficie } : undefined;
      case 'toxoplasmosis': // IgG e IgM obligatorias; título, IgA y avidez si se tienen
        return f.igg && f.igm ? { igg: f.igg, igm: f.igm, iggTitulo: n('iggTitulo') ?? null, iga: f.iga || null, avidez: f.avidez || null } : undefined;
      case 'ptog': return { ayunas: c(n('ayunas')), unaHora: c(n('unaHora')), dosHoras: c(n('dosHoras')) };
      default: return b('positivo') === null ? undefined : { positivo: b('positivo') };
    }
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const v = valor();
    if (v === undefined) return setAviso(tipo === 'toxoplasmosis' ? 'Registre la IgG y la IgM.' : 'Complete el resultado.');
    const gdl = n('gdl');
    if (tipo === 'hb' && gdl !== undefined) {
      const adv = validarHb(gdl, catalogo);
      if (adv.length && !confirm(adv[0]!.mensaje)) return;
    }
    await onRegistrar(tipo, v, fecha);
    // El hemograma registra también las plaquetas, como resultado aparte con la misma fecha.
    const plaquetas = n('plaquetasHemograma');
    if (tipo === 'hb' && plaquetas !== undefined) await onRegistrar('plaquetas', { x10e9L: plaquetas }, fecha);
    setF({});
    setAviso(undefined);
  };

  return (
    <form onSubmit={enviar} className="tarjeta">
      <div className="compuesto">
        <label>
          Examen
          <select value={tipo} onChange={(e) => { setTipo(e.target.value as TipoExamen); setF({}); }}>
            {EXAMENES.map((x) => <option key={x.tipo} value={x.tipo}>{x.etiqueta}{x.privado ? ' (privado)' : ''}</option>)}
          </select>
        </label>
        <label>Fecha <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
      </div>
      <div className="compuesto">{campos[tipo]}</div>
      {aviso && <p className="error">{aviso}</p>}
      <button type="submit">Registrar resultado</button>
    </form>
  );
}

export function SeccionesSeguimiento({ embarazoId, consultaId, alCambiar }: { embarazoId: string; consultaId: string; alCambiar?: () => void }) {
  const { repo, servicio, hoy, catalogo } = useApp();
  const [historia, setHistoria] = useState<Historia>();
  const [examenes, setExamenes] = useState<ResultadoExamen[]>([]);
  const [indicaciones, setIndicaciones] = useState<Indicacion[]>([]);
  const [factores, setFactores] = useState<FactorTransitorio[]>([]);
  const [nuevoFactor, setNuevoFactor] = useState<{ tipo: TipoFactorTransitorio; inicio: string; hosp: boolean }>({ tipo: 'hiperemesis', inicio: hoy(), hosp: false });

  const cargar = async () => {
    const h = await repo.historia(embarazoId);
    setHistoria(h);
    setExamenes(h?.examenes ?? []);
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
        <legend>Exámenes</legend>
        <ul className="lista">
          {examenes.length === 0 && <li className="suave">Sin resultados registrados.</li>}
          {examenes.map((e) => (
            <li key={e.id}>
              <strong>{etiquetaExamen(e.tipo)}</strong> · {e.fecha} · {resumen(e)}
              {e.tipo === 'vih' && <span className="privado"> 🔒</span>}
              {e.tipo === 'hb' && e.resultado.estado === 'valor' && historia && (
                <small className="bloque">{explicarHb(clasificarHb(construirContexto(historia, hoy(), catalogo), { ...e.resultado.valor, fecha: e.fecha }))}</small>
              )}
            </li>
          ))}
        </ul>
        <NuevoExamen
          onRegistrar={async (tipo, valor, fecha) => {
            await servicio.registrarExamen({ embarazoId, consultaId, fecha, tipo, resultado: { estado: 'valor', valor } } as Parameters<typeof servicio.registrarExamen>[0]);
            await cargar();
            alCambiar?.();
          }}
        />
      </fieldset>

      <fieldset>
        <legend>Indicaciones</legend>
        {INDICACIONES.map(({ tipo, etiqueta }) => (
          <div key={tipo} className="fila-campo">
            <div className="etiqueta">{etiqueta}</div>
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
