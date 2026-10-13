// Altura uterina de cada control sobre la banda de los percentiles 10 y 90 del CLAP, con el
// crecimiento estimado por la app (y su margen), la proyección a dos semanas, las ecografías
// registradas y la clasificación del crecimiento. Los puntos fuera de la banda se distinguen por
// color y por forma (triángulo), y la tabla debajo da los mismos datos sin depender del color.
import { useEffect, useState } from 'react';
import { useEscala } from './useEscala';
import { construirContexto } from '../alertas/motor';
import { percentilesAU } from '../alertas/crecimiento';
import { coma } from '../alertas/anemia';
import { valorDe } from '../datos/campo';
import { ecografiasHasta, evaluarCrecimientoHasta } from '../alertas/crecimientoHistoria';
import { NOMBRE_CLASE, type ClaseCrecimiento, type EvaluacionCrecimiento } from '../alertas/crecimientoFetal';
import { useApp } from './contexto';

const ICONO_CLASE: Record<ClaseCrecimiento, string> = {
  no_aplica: 'ℹ️',
  insuficientes: '…',
  adecuado: '✓',
  pequeno_estable: '◆',
  descenso: '⚠️',
  sospecha_restriccion: '⛔',
};

/** Clasificación del crecimiento con su frase clínica y los avisos de confiabilidad. */
export function ClasificacionCrecimiento({ ev }: { ev: EvaluacionCrecimiento }) {
  return (
    <div className={`crecimiento-clase ${ev.clase}`} role="status">
      <p>
        <span className="chip-clase">
          <span aria-hidden>{ICONO_CLASE[ev.clase]} </span>
          {NOMBRE_CLASE[ev.clase]}
        </span>{' '}
        {ev.frase}
      </p>
      {ev.notas.length > 0 && (
        <ul className="suave">
          {ev.notas.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Punto {
  fecha: string;
  egDias: number;
  cm: number;
  p10: number;
  p90: number;
  posicion: 'debajo' | 'dentro' | 'encima';
}

const ANCHO = 640;
const ALTO = 340;
const M = { izq: 44, der: 16, arr: 16, aba: 40 };
const SEM_MIN = 13;
const SEM_MAX = 40;
const CM_MIN = 6;
const CM_MAX = 36;

const x = (semanas: number) => M.izq + ((semanas - SEM_MIN) / (SEM_MAX - SEM_MIN)) * (ANCHO - M.izq - M.der);
const y = (cm: number) => ALTO - M.aba - ((cm - CM_MIN) / (CM_MAX - CM_MIN)) * (ALTO - M.arr - M.aba);
const semanaTexto = (dias: number) => `${Math.floor(dias / 7)}+${dias % 7}`;
const POSICION: Record<Punto['posicion'], string> = {
  debajo: 'Por debajo del P10',
  dentro: 'Dentro de P10–P90',
  encima: 'Por encima del P90',
};

export function GraficaAlturaUterina({ embarazoId, version = 0 }: { embarazoId: string; version?: number }) {
  const { repo, catalogo, hoy } = useApp();
  const [puntos, setPuntos] = useState<Punto[]>();
  const [curva, setCurva] = useState<{ s: number; p10: number; p90: number }[]>([]);
  const [activo, setActivo] = useState<number>();
  const [ev, setEv] = useState<EvaluacionCrecimiento>();
  const [ecos, setEcos] = useState<{ fecha: string; egDias: number }[]>([]);
  const { ref: contenedor, escala } = useEscala(ANCHO);

  useEffect(() => {
    void (async () => {
      const historia = await repo.historia(embarazoId);
      if (!historia) return;
      const ctx = construirContexto(historia, hoy(), catalogo);
      const tabla = catalogo.valor('au.percentiles');
      setCurva(Object.entries(tabla).map(([s, v]) => ({ s: Number(s), ...v })));
      const lista: Punto[] = [];
      // Controles de seguimiento y examen físico de la primera consulta.
      for (const c of historia.consultas) {
        const cm = valorDe(c.seguimiento?.alturaUterinaCm ?? c.primera?.examenFisico?.alturaUterinaCm);
        const egDias = ctx.egEn(c.fecha);
        if (cm === undefined || egDias === undefined) continue;
        const p = percentilesAU(ctx, egDias);
        if (!p) continue;
        lista.push({ fecha: c.fecha, egDias, cm, ...p, posicion: cm < p.p10 ? 'debajo' : cm > p.p90 ? 'encima' : 'dentro' });
      }
      setPuntos(lista.sort((a, b) => a.egDias - b.egDias));
      setEv(evaluarCrecimientoHasta(ctx));
      setEcos(
        ecografiasHasta(historia, ctx.hoy).flatMap((e) => {
          const egDias = ctx.egEn(e.fecha);
          return egDias !== undefined && egDias >= SEM_MIN * 7 && egDias <= SEM_MAX * 7 ? [{ fecha: e.fecha, egDias }] : [];
        }),
      );
    })();
  }, [repo, catalogo, hoy, embarazoId, version]);

  if (!puntos) return null;
  const banda = [
    ...curva.map((c) => `${x(c.s)},${y(c.p90)}`),
    ...[...curva].reverse().map((c) => `${x(c.s)},${y(c.p10)}`),
  ].join(' ');
  const linea = (k: 'p10' | 'p90') => curva.map((c) => `${x(c.s)},${y(c[k])}`).join(' ');
  const sel = activo !== undefined ? puntos[activo] : undefined;
  // Crecimiento estimado: línea y margen; la proyección va punteada.
  const tray = ev?.trayectoria ?? [];
  const proy = ev?.proyeccion && tray.length ? [tray.at(-1)!, ev.proyeccion] : [];
  const areaDe = (ps: { egDias: number; bajo: number; alto: number }[]) =>
    [...ps.map((p) => `${x(p.egDias / 7)},${y(p.alto)}`), ...[...ps].reverse().map((p) => `${x(p.egDias / 7)},${y(p.bajo)}`)].join(' ');
  const lineaDe = (ps: { egDias: number; cm: number }[]) => ps.map((p) => `${x(p.egDias / 7)},${y(p.cm)}`).join(' ');

  return (
    <section className="grafica-au" aria-label="Altura uterina">
      <h3>Altura uterina y crecimiento fetal</h3>
      {ev && <ClasificacionCrecimiento ev={ev} />}
      <p className="suave">
        Banda: percentiles 10 a 90 de la curva del CLAP (semanas 13 a 40).
        {puntos.length === 0 && ' Aún no hay controles con altura uterina en ese rango.'}
      </p>
      <div ref={contenedor} style={{ ['--escala' as string]: escala }}>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Altura uterina por semana de gestación con la banda P10–P90 del CLAP">
        {/* Rejilla recesiva */}
        {Array.from({ length: (CM_MAX - CM_MIN) / 2 + 1 }, (_, i) => CM_MIN + i * 2).map((cm) => (
          <g key={`y${cm}`}>
            <line x1={M.izq} x2={ANCHO - M.der} y1={y(cm)} y2={y(cm)} className="rejilla" />
            {cm % 4 === 0 && <text x={M.izq - 6} y={y(cm) + 4} textAnchor="end" className="eje">{cm}</text>}
          </g>
        ))}
        {Array.from({ length: (SEM_MAX - SEM_MIN) + 1 }, (_, i) => SEM_MIN + i).map((s) => (
          <g key={`x${s}`}>
            {s % 2 === 1 && <line x1={x(s)} x2={x(s)} y1={M.arr} y2={ALTO - M.aba} className="rejilla" />}
            {s % 4 === 1 && <text x={x(s)} y={ALTO - M.aba + 16} textAnchor="middle" className="eje">{s}</text>}
          </g>
        ))}
        <text x={(M.izq + ANCHO - M.der) / 2} y={ALTO - 6} textAnchor="middle" className="eje">Semanas de gestación</text>
        <text x={M.izq + 4} y={M.arr + 12} className="eje">cm</text>

        {/* Banda P10–P90 */}
        <polygon points={banda} className="banda" />
        <polyline points={linea('p90')} className="percentil" />
        <polyline points={linea('p10')} className="percentil" />
        <text x={x(SEM_MAX) - 2} y={y(curva.at(-1)?.p90 ?? 0) - 6} textAnchor="end" className="eje">P90</text>
        <text x={x(SEM_MAX) - 2} y={y(curva.at(-1)?.p10 ?? 0) + 14} textAnchor="end" className="eje">P10</text>

        {/* Ecografías registradas, sobre la misma línea de tiempo */}
        {ecos.map((e) => (
          <g key={e.fecha} className="eco-marca">
            <line x1={x(e.egDias / 7)} x2={x(e.egDias / 7)} y1={M.arr} y2={ALTO - M.aba} />
            <text x={x(e.egDias / 7) + 3} y={M.arr + 10} className="eje">Eco</text>
            <title>{`Ecografía ${e.fecha} · semana ${semanaTexto(e.egDias)}`}</title>
          </g>
        ))}

        {/* Crecimiento estimado por la app (margen del 80 %) y proyección a dos semanas */}
        {tray.length > 1 && <polygon points={areaDe(tray)} className="estimado-margen" />}
        {proy.length === 2 && <polygon points={areaDe(proy)} className="estimado-margen proyeccion" />}
        {tray.length > 1 && <polyline points={lineaDe(tray)} className="estimado" />}
        {proy.length === 2 && <polyline points={lineaDe(proy)} className="estimado proyeccion" />}

        {/* Controles */}
        {tray.length < 2 && puntos.length > 1 && <polyline points={puntos.map((p) => `${x(p.egDias / 7)},${y(p.cm)}`).join(' ')} className="trayectoria" />}
        {puntos.map((p, i) => {
          const cx = x(p.egDias / 7);
          const cy = y(p.cm);
          const fuera = p.posicion !== 'dentro';
          return (
            <g
              key={p.fecha + i}
              className={`punto ${fuera ? 'fuera' : ''}`}
              tabIndex={0}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(undefined)}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(undefined)}
              onClick={() => setActivo(i)}
            >
              <circle cx={cx} cy={cy} r={14} className="objetivo" />
              {fuera ? (
                <polygon points={`${cx},${cy - 7} ${cx - 7},${cy + 5} ${cx + 7},${cy + 5}`} />
              ) : (
                <circle cx={cx} cy={cy} r={5} />
              )}
              <title>{`${p.fecha} · semana ${semanaTexto(p.egDias)} · ${coma(p.cm)} cm · ${POSICION[p.posicion]}`}</title>
            </g>
          );
        })}
        {sel && (
          <g className="tooltip" transform={`translate(${Math.min(x(sel.egDias / 7) + 10, ANCHO - 190 * escala - 4)},${Math.max(y(sel.cm) - 62 * escala, M.arr)}) scale(${escala})`}>
            <rect width={180} height={56} rx={6} />
            <text x={10} y={18}>{`Semana ${semanaTexto(sel.egDias)} · ${sel.fecha}`}</text>
            <text x={10} y={34} className="fuerte">{`${coma(sel.cm)} cm · ${POSICION[sel.posicion]}`}</text>
            <text x={10} y={49}>{`P10 ${coma(sel.p10)} · P90 ${coma(sel.p90)}`}</text>
          </g>
        )}
      </svg>
      </div>
      <p className="leyenda-au">
        <span className="item"><span className="muestra dentro" aria-hidden /> Dentro de la banda</span>
        <span className="item"><span className="muestra fuera" aria-hidden /> Fuera de la banda (triángulo)</span>
        {tray.length > 1 && <span className="item"><span className="muestra estimado" aria-hidden /> Crecimiento estimado (margen del 80 %); punteado: proyección a 2 semanas</span>}
        {ecos.length > 0 && <span className="item"><span className="muestra eco" aria-hidden /> Ecografía</span>}
      </p>
      {puntos.length > 0 && (
        <details>
          <summary>Ver los datos en tabla</summary>
          <table className="tabla-au">
            <thead>
              <tr><th>Fecha</th><th>Semana</th><th>Altura (cm)</th><th>P10</th><th>P90</th><th>Posición</th></tr>
            </thead>
            <tbody>
              {puntos.map((p, i) => (
                <tr key={p.fecha + i}>
                  <td>{p.fecha}</td>
                  <td>{semanaTexto(p.egDias)}</td>
                  <td>{coma(p.cm)}</td>
                  <td>{coma(p.p10)}</td>
                  <td>{coma(p.p90)}</td>
                  <td>{POSICION[p.posicion]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
