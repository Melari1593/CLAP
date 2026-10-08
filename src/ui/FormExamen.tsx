// Formulario de resultados de laboratorio y ecografía: registrar uno nuevo o corregir uno registrado.
import { useState, type FormEvent, type ReactNode } from 'react';
import type { ResultadoExamen, TipoExamen } from '../datos/modelo';
import { valorDe, type Campo } from '../datos/campo';
import { validarHb } from '../consultas/validaciones';
import { EXAMENES } from '../examenes/resumen';
import { useApp } from './contexto';

/** Resultado guardado → valores del formulario (las claves del formulario son las del modelo). */
export function aFormulario(valor: unknown): Record<string, string> {
  if (typeof valor !== 'object' || valor === null) return {};
  const f: Record<string, string> = {};
  for (const [k, v] of Object.entries(valor)) {
    const x = typeof v === 'object' && v !== null && 'estado' in v ? valorDe(v as Campo<unknown>) : v;
    if (typeof x === 'boolean') f[k] = x ? 'si' : 'no';
    else if (typeof x === 'number' || typeof x === 'string') f[k] = String(x);
  }
  return f;
}

export function FormExamen({ inicial, onRegistrar, onCancelar }: {
  /** Resultado que se corrige; sin él, se registra uno nuevo. */
  inicial?: ResultadoExamen;
  onRegistrar: (tipo: TipoExamen, valor: unknown, fecha: string) => Promise<void>;
  onCancelar?: () => void;
}) {
  const { catalogo, hoy } = useApp();
  const [tipo, setTipo] = useState<TipoExamen>(inicial?.tipo ?? 'hb');
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoy());
  const [f, setF] = useState<Record<string, string>>(() => (inicial ? aFormulario(valorDe(inicial.resultado as Campo<unknown>)) : {}));
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
    hb: <>{numero('gdl', 'Hb', 'g/dL')}{opcion('muestra', 'Muestra', [['venosa', 'Venosa'], ['capilar', 'Capilar']])}{!inicial && numero('plaquetasHemograma', 'Plaquetas', '× 10⁹/L')}</>,
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
    if (!inicial && tipo === 'hb' && plaquetas !== undefined) await onRegistrar('plaquetas', { x10e9L: plaquetas }, fecha);
    setF({});
    setAviso(undefined);
  };

  return (
    <form onSubmit={enviar} className="tarjeta">
      <div className="compuesto">
        <label>
          Examen
          <select value={tipo} disabled={Boolean(inicial)} onChange={(e) => { setTipo(e.target.value as TipoExamen); setF({}); }}>
            {EXAMENES.map((x) => <option key={x.tipo} value={x.tipo}>{x.etiqueta}{x.privado ? ' (privado)' : ''}</option>)}
          </select>
        </label>
        <label>Fecha <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
      </div>
      <div className="compuesto">{campos[tipo]}</div>
      {aviso && <p className="error">{aviso}</p>}
      <div className="botones">
        <button type="submit" className={inicial ? 'primario' : undefined}>{inicial ? 'Guardar corrección' : 'Registrar resultado'}</button>
        {onCancelar && <button type="button" className="enlace" onClick={onCancelar}>Cancelar</button>}
      </div>
    </form>
  );
}

