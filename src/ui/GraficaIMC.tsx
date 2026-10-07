// IMC de cada control sobre las zonas de IMC para la edad gestacional (Atalah, Resolución 2465 de 2016).
// Cada zona lleva su nombre escrito; los puntos fuera de la zona adecuada se distinguen por color y
// por forma (triángulo), y la tabla debajo da los mismos datos sin depender del color.
import { useEffect, useState } from 'react';
import { construirContexto } from '../alertas/motor';
import { clasificarIMCGestacional, type EstadoNutricional } from '../alertas/crecimiento';
import { coma } from '../alertas/anemia';
import { imc } from '../clinico/calculos';
import { valorDe } from '../datos/campo';
import { useApp } from './contexto';
import { useEscala } from './useEscala';

interface Punto {
  fecha: string;
  egDias: number;
  pesoKg: number;
  imc: number;
  estado: EstadoNutricional;
}

// Límites entre zonas por semana: inicio de adecuado, inicio de sobrepeso y fin de sobrepeso (después, obesidad).
type Limite = { semana: number; adecuadoDesde: number; sobrepesoDesde: number; obesidadDesde: number };

const ANCHO = 640;
const ALTO = 360;
const M = { izq: 44, der: 16, arr: 16, aba: 40 };
const SEM_MIN = 6;
const SEM_MAX = 42;
const IMC_MIN = 15;
const IMC_MAX = 40;

const x = (semanas: number) => M.izq + ((semanas - SEM_MIN) / (SEM_MAX - SEM_MIN)) * (ANCHO - M.izq - M.der);
const y = (v: number) => {
  const acotado = Math.min(IMC_MAX, Math.max(IMC_MIN, v));
  return ALTO - M.aba - ((acotado - IMC_MIN) / (IMC_MAX - IMC_MIN)) * (ALTO - M.arr - M.aba);
};
const semanaTexto = (dias: number) => `${Math.floor(dias / 7)}+${dias % 7}`;

export const NOMBRE_ZONA: Record<EstadoNutricional, string> = {
  bajo_peso: 'Bajo peso',
  adecuado: 'IMC adecuado',
  sobrepeso: 'Sobrepeso',
  obesidad: 'Obesidad',
};

export function GraficaIMC({ embarazoId, version = 0 }: { embarazoId: string; version?: number }) {
  const { repo, catalogo, hoy } = useApp();
  const [puntos, setPuntos] = useState<Punto[]>();
  const [talla, setTalla] = useState<number>();
  const [limites, setLimites] = useState<Limite[]>([]);
  const [activo, setActivo] = useState<number>();
  const { ref: contenedor, escala } = useEscala(ANCHO);

  useEffect(() => {
    void (async () => {
      const historia = await repo.historia(embarazoId);
      if (!historia) return;
      const ctx = construirContexto(historia, hoy(), catalogo);
      // Cada fila vale para la semana cumplida: el límite se dibuja escalonado, de s a s+1.
      setLimites(
        catalogo.valor('nutricion.atalah').flatMap((f) =>
          [f.semana, Math.min(f.semana + 1, SEM_MAX)].map((semana) => ({
            semana,
            adecuadoDesde: f.adecuado[0],
            sobrepesoDesde: f.sobrepeso[0],
            obesidadDesde: f.sobrepeso[1],
          })),
        ),
      );
      const t = valorDe(ctx.primera?.gestacionActual.tallaCm);
      setTalla(t);
      const lista: Punto[] = [];
      if (t) {
        for (const c of ctx.seguimientos) {
          const peso = valorDe(c.seguimiento?.pesoKg);
          const egDias = ctx.egEn(c.fecha);
          if (peso === undefined || egDias === undefined) continue;
          const valor = imc(peso, t, catalogo).valor;
          const estado = clasificarIMCGestacional(ctx, valor, egDias);
          if (estado) lista.push({ fecha: c.fecha, egDias, pesoKg: peso, imc: valor, estado });
        }
      }
      setPuntos(lista.sort((a, b) => a.egDias - b.egDias));
    })();
  }, [repo, catalogo, hoy, embarazoId, version]);

  if (!puntos || limites.length === 0) return null;

  const linea = (k: keyof Omit<Limite, 'semana'>) => limites.map((l) => `${x(l.semana)},${y(l[k])}`).join(' ');
  const zona = (abajo: keyof Omit<Limite, 'semana'> | null, arriba: keyof Omit<Limite, 'semana'> | null) =>
    [
      ...limites.map((l) => `${x(l.semana)},${y(arriba ? l[arriba] : IMC_MAX)}`),
      ...[...limites].reverse().map((l) => `${x(l.semana)},${y(abajo ? l[abajo] : IMC_MIN)}`),
    ].join(' ');
  // Rótulo de cada zona, en la semana 26 y a mitad de la zona.
  const medio = limites.find((l) => l.semana >= 25) ?? limites[0]!;
  const rotulos: { estado: EstadoNutricional; v: number }[] = [
    { estado: 'bajo_peso', v: (IMC_MIN + medio.adecuadoDesde) / 2 },
    { estado: 'adecuado', v: (medio.adecuadoDesde + medio.sobrepesoDesde) / 2 },
    { estado: 'sobrepeso', v: (medio.sobrepesoDesde + medio.obesidadDesde) / 2 },
    { estado: 'obesidad', v: (medio.obesidadDesde + IMC_MAX) / 2 },
  ];
  const sel = activo !== undefined ? puntos[activo] : undefined;

  return (
    <section className="grafica-au grafica-imc" aria-label="IMC para la edad gestacional">
      <h3>IMC para la edad gestacional</h3>
      <p className="suave">
        Zonas de Atalah (cuadro 12 de la Resolución 2465 de 2016), semanas 6 a 42.
        {!talla && ' Falta la talla de la primera consulta para calcular el IMC.'}
        {talla && puntos.length === 0 && ' Aún no hay controles con peso en ese rango.'}
      </p>
      <div ref={contenedor} style={{ ['--escala' as string]: escala }}>
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="IMC por semana de gestación sobre las zonas de Atalah">
          <polygon points={zona(null, 'adecuadoDesde')} className="zona bajo_peso" />
          <polygon points={zona('adecuadoDesde', 'sobrepesoDesde')} className="zona adecuado" />
          <polygon points={zona('sobrepesoDesde', 'obesidadDesde')} className="zona sobrepeso" />
          <polygon points={zona('obesidadDesde', null)} className="zona obesidad" />

          {/* Rejilla recesiva y ejes */}
          {Array.from({ length: (IMC_MAX - IMC_MIN) / 5 + 1 }, (_, i) => IMC_MIN + i * 5).map((v) => (
            <g key={`y${v}`}>
              <line x1={M.izq} x2={ANCHO - M.der} y1={y(v)} y2={y(v)} className="rejilla" />
              <text x={M.izq - 6} y={y(v) + 4} textAnchor="end" className="eje">{v}</text>
            </g>
          ))}
          {Array.from({ length: (SEM_MAX - SEM_MIN) / 2 + 1 }, (_, i) => SEM_MIN + i * 2).map((s) => (
            <g key={`x${s}`}>
              <line x1={x(s)} x2={x(s)} y1={M.arr} y2={ALTO - M.aba} className="rejilla" />
              {s % 4 === 2 && <text x={x(s)} y={ALTO - M.aba + 16} textAnchor="middle" className="eje">{s}</text>}
            </g>
          ))}
          <text x={(M.izq + ANCHO - M.der) / 2} y={ALTO - 6} textAnchor="middle" className="eje">Semanas de gestación</text>
          <text x={M.izq + 4} y={M.arr + 12} className="eje">IMC</text>

          <polyline points={linea('adecuadoDesde')} className="percentil limite" />
          <polyline points={linea('sobrepesoDesde')} className="percentil limite" />
          <polyline points={linea('obesidadDesde')} className="percentil limite" />
          {rotulos.map((r) => (
            <text key={r.estado} x={x(26)} y={y(r.v) + 4} textAnchor="middle" className="rotulo-zona">
              {NOMBRE_ZONA[r.estado]}
            </text>
          ))}

          {puntos.length > 1 && <polyline points={puntos.map((p) => `${x(p.egDias / 7)},${y(p.imc)}`).join(' ')} className="trayectoria" />}
          {puntos.map((p, i) => {
            const cx = x(p.egDias / 7);
            const cy = y(p.imc);
            const fuera = p.estado !== 'adecuado';
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
                {fuera ? <polygon points={`${cx},${cy - 7} ${cx - 7},${cy + 5} ${cx + 7},${cy + 5}`} /> : <circle cx={cx} cy={cy} r={5} />}
                <title>{`${p.fecha} · semana ${semanaTexto(p.egDias)} · IMC ${coma(p.imc)} · ${NOMBRE_ZONA[p.estado]}`}</title>
              </g>
            );
          })}
          {sel && (
            <g
              className="tooltip"
              transform={`translate(${Math.min(x(sel.egDias / 7) + 10, ANCHO - 190 * escala - 4)},${Math.max(y(sel.imc) - 62 * escala, M.arr)}) scale(${escala})`}
            >
              <rect width={180} height={56} rx={6} />
              <text x={10} y={18}>{`Semana ${semanaTexto(sel.egDias)} · ${sel.fecha}`}</text>
              <text x={10} y={34} className="fuerte">{`IMC ${coma(sel.imc)} · ${NOMBRE_ZONA[sel.estado]}`}</text>
              <text x={10} y={49}>{`Peso ${coma(sel.pesoKg)} kg · talla ${talla} cm`}</text>
            </g>
          )}
        </svg>
      </div>
      <p className="leyenda-au">
        <span className="item"><span className="muestra dentro" aria-hidden /> IMC adecuado</span>
        <span className="item"><span className="muestra fuera" aria-hidden /> Fuera de la zona adecuada (triángulo)</span>
      </p>
      {puntos.length > 0 && (
        <details>
          <summary>Ver los datos en tabla</summary>
          <table className="tabla-au">
            <thead>
              <tr><th>Fecha</th><th>Semana</th><th>Peso (kg)</th><th>IMC</th><th>Clasificación</th></tr>
            </thead>
            <tbody>
              {puntos.map((p, i) => (
                <tr key={p.fecha + i}>
                  <td>{p.fecha}</td>
                  <td>{semanaTexto(p.egDias)}</td>
                  <td>{coma(p.pesoKg)}</td>
                  <td>{coma(p.imc)}</td>
                  <td>{NOMBRE_ZONA[p.estado]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
