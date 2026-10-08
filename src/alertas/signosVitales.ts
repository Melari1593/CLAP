// Alertas por signos vitales del último registro (primera consulta o control): fiebre y saturación baja.
import { valorDe } from '../datos/campo';
import { coma } from './anemia';
import type { ContextoClinico, Regla } from './motor';

type Signo = 'temperaturaC' | 'saturacionPct';

/** Último valor registrado del signo vital, en los controles o en el examen físico de la primera consulta. */
export function ultimoSigno(ctx: ContextoClinico, signo: Signo) {
  return ctx.historia.consultas
    .map((c) => ({ c, v: valorDe(c.seguimiento?.[signo] ?? c.primera?.examenFisico?.[signo]) }))
    .filter((x): x is { c: (typeof x)['c']; v: number } => x.v !== undefined)
    .sort((a, b) => (a.c.fecha + a.c.creadoEn).localeCompare(b.c.fecha + b.c.creadoEn))
    .map((x) => ({ fecha: x.c.fecha, valor: x.v }))
    .at(-1);
}

export const fiebre: Regla = {
  id: 'fiebre',
  evaluar(ctx) {
    const t = ultimoSigno(ctx, 'temperaturaC');
    const { fiebreDesdeC } = ctx.catalogo.valor('signosVitales.alertas');
    if (!t || t.valor < fiebreDesdeC) return null;
    return {
      titulo: 'Fiebre',
      porque: [
        `Temperatura ${coma(t.valor)} °C el ${t.fecha} (fiebre: ${coma(fiebreDesdeC)} °C o más).`,
        'Buscar el foco (urinario, respiratorio, corioamnionitis, otras infecciones) y evaluar el bienestar fetal.',
        'Manejo y remisión según la guía.',
      ],
      severidad: 2,
      urgente: true,
      opciones: [{ etiqueta: 'Valorada y manejo iniciado' }, { etiqueta: 'Remitida' }, { etiqueta: 'Otra conducta', requiereMotivo: true }],
    };
  },
};

export const saturacionBaja: Regla = {
  id: 'saturacion_baja',
  evaluar(ctx) {
    const s = ultimoSigno(ctx, 'saturacionPct');
    const { saturacionMenorDe } = ctx.catalogo.valor('signosVitales.alertas');
    if (!s || s.valor >= saturacionMenorDe) return null;
    return {
      titulo: 'Saturación de oxígeno baja',
      porque: [
        `Saturación ${s.valor} % el ${s.fecha} (menor de ${saturacionMenorDe} %).`,
        'Confirmar la medición; si se confirma, oxígeno y remisión urgente.',
      ],
      severidad: 3,
      urgente: true,
      opciones: [{ etiqueta: 'Remitida' }, { etiqueta: 'Medición repetida: normal', requiereMotivo: true }],
    };
  },
};
