// Éxito de la alerta de crecimiento fetal (spec del 13 de octubre de 2026), comparada con la regla
// clásica (una medición bajo p10). La restricción se confirma con el peso fetal estimado de la
// ecografía: percentil bajo el corte del catálogo (crecimiento.ecografia.pfePercentilCorte).
// Se calcula con las historias de la institución (cada control guarda su clasificación y lo que
// habría hecho la regla clásica), no con los eventos: los eventos no llevan resultados de exámenes.
import type { Catalogo } from '../clinico/catalogo';
import type { Consulta, FechaISO } from '../datos/modelo';
import type { Historia } from '../datos/repositorio';
import type { Proporcion } from '../eventos/metricas';
import { construirContexto } from './motor';
import { ecografiasHasta } from './crecimientoHistoria';

const proporcion = (numerador: number, denominador: number): Proporcion => ({ numerador, denominador, valor: denominador === 0 ? null : numerador / denominador });

export type ReglaComparada = 'app' | 'clasica';

/** ¿Esta regla habría ordenado la ecografía en el control? */
function ordena(c: Consulta, regla: ReglaComparada): boolean {
  const k = c.crecimiento;
  if (!k || k.clase === 'no_aplica') return false;
  if (regla === 'clasica') return k.reglaClasica;
  return k.clase === 'descenso' || k.clase === 'sospecha_restriccion' || (k.clase === 'insuficientes' && k.reglaClasica);
}

export interface RendimientoCrecimiento {
  /** 1. Ecografías ordenadas cuyo peso fetal quedó en o sobre el corte (sin restricción). Menos es mejor. */
  remisionesInnecesarias: Record<ReglaComparada, Proporcion>;
  /** 2. Restricciones confirmadas por peso ecográfico que tuvieron alerta antes de la semana 37. */
  deteccionAntesDe37: Record<ReglaComparada, Proporcion>;
  /** 3. Órdenes generadas por la app con ecografía registrada antes del siguiente control. */
  ecografiaAntesDelSiguienteControl: Proporcion;
}

export function rendimientoCrecimiento(historias: Historia[], hoy: FechaISO, catalogo: Catalogo): RendimientoCrecimiento {
  const corte = catalogo.valor('crecimiento.ecografia').pfePercentilCorte;
  const innecesarias = { app: [0, 0], clasica: [0, 0] };
  const deteccion = { app: [0, 0], clasica: [0, 0] };
  const hechas = [0, 0];

  for (const historia of historias) {
    const todas = ecografiasHasta(historia, '9999-12-31');
    // Embarazo múltiple: la alerta no aplica.
    if (todas.some((e) => (e.fetos ?? 1) >= 2)) continue;
    const ctx = construirContexto(historia, hoy, catalogo);
    const conPeso = todas.filter((e) => e.pfePercentil !== undefined);
    const controles = historia.consultas
      .filter((c) => c.tipo === 'seguimiento')
      .sort((a, b) => (a.fecha + a.creadoEn).localeCompare(b.fecha + b.creadoEn));

    for (const regla of ['app', 'clasica'] as const) {
      // 1. Cada ecografía que resuelve órdenes de esta regla cuenta una vez.
      const resueltas = new Set<(typeof conPeso)[number]>();
      for (const c of controles.filter((x) => ordena(x, regla))) {
        const eco = conPeso.find((e) => e.fecha >= c.fecha);
        if (eco) resueltas.add(eco);
      }
      for (const eco of resueltas) {
        innecesarias[regla][1]!++;
        if (eco.pfePercentil! >= corte) innecesarias[regla][0]!++;
      }
      // 2. Restricción confirmada: primera ecografía con peso fetal bajo el corte.
      const confirmada = conPeso.find((e) => e.pfePercentil! < corte);
      if (confirmada) {
        deteccion[regla][1]!++;
        const temprana = controles.some((c) => ordena(c, regla) && c.fecha <= confirmada.fecha && (ctx.egEn(c.fecha) ?? Infinity) < 37 * 7);
        if (temprana) deteccion[regla][0]!++;
      }
    }

    // 3. Órdenes que generó la app (no anuladas): ¿llegó la ecografía antes del siguiente control?
    for (const [i, c] of controles.entries()) {
      if (!c.ordenes?.paraclinicos.some((o) => o.automatica && !o.anulada)) continue;
      const siguiente = controles[i + 1]?.fecha;
      const hecha = todas.some((e) => e.fecha >= c.fecha && (siguiente === undefined || e.fecha < siguiente));
      // Sin siguiente control ni ecografía, la orden sigue en curso: aún no cuenta.
      if (siguiente === undefined && !hecha) continue;
      hechas[1]!++;
      if (hecha) hechas[0]!++;
    }
  }

  const p = ([n, d]: number[]) => proporcion(n!, d!);
  return {
    remisionesInnecesarias: { app: p(innecesarias.app), clasica: p(innecesarias.clasica) },
    deteccionAntesDe37: { app: p(deteccion.app), clasica: p(deteccion.clasica) },
    ecografiaAntesDelSiguienteControl: p(hechas),
  };
}
