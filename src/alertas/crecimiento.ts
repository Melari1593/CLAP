// Altura uterina (curva del CLAP), estado nutricional (IMC para la edad gestacional, Atalah),
// movimientos fetales y frecuencia cardíaca fetal, con el último control.
import { imc } from '../clinico/calculos';
import { valorDe } from '../datos/campo';
import type { Consulta, DatosSeguimiento } from '../datos/modelo';
import { coma } from './anemia';
import type { ContextoClinico, Regla } from './motor';

/** Último control de seguimiento con un dato registrado, y su EG en días. */
function ultimoCon<K extends keyof DatosSeguimiento>(ctx: ContextoClinico, campo: K) {
  const con = ctx.seguimientos
    .filter((c) => c.seguimiento && c.seguimiento[campo].estado === 'valor')
    .sort((a, b) => (a.fecha + a.creadoEn).localeCompare(b.fecha + b.creadoEn));
  const c: Consulta | undefined = con.at(-1);
  if (!c?.seguimiento) return undefined;
  return { fecha: c.fecha, valor: (c.seguimiento[campo] as { valor: unknown }).valor, egDias: ctx.egEn(c.fecha) };
}

const semanaTexto = (dias: number) => `${Math.floor(dias / 7)}+${dias % 7}`;

/** Interpola linealmente los percentiles de altura uterina para una EG en días. */
export function percentilesAU(ctx: ContextoClinico, egDias: number): { p10: number; p90: number } | undefined {
  const tabla = ctx.catalogo.valor('au.percentiles');
  const semanas = Object.keys(tabla).map(Number).sort((a, b) => a - b);
  const s = egDias / 7;
  if (s < semanas[0]! || s > semanas.at(-1)!) return undefined;
  const baja = Math.floor(s);
  const alta = Math.min(baja + 1, semanas.at(-1)!);
  const a = tabla[baja]!;
  const b = tabla[alta]!;
  const f = s - baja;
  const r = (x: number) => Math.round(x * 10) / 10;
  return { p10: r(a.p10 + (b.p10 - a.p10) * f), p90: r(a.p90 + (b.p90 - a.p90) * f) };
}

export const alturaUterina: Regla = {
  id: 'altura_uterina',
  evaluar(ctx) {
    const au = ultimoCon(ctx, 'alturaUterinaCm');
    if (!au || au.egDias === undefined) return null;
    const p = percentilesAU(ctx, au.egDias);
    if (!p) return null;
    const cm = au.valor as number;
    if (cm >= p.p10 && cm <= p.p90) return null;
    const baja = cm < p.p10;
    return {
      titulo: baja ? 'Altura uterina por debajo del percentil 10' : 'Altura uterina por encima del percentil 90',
      porque: [
        `Altura uterina ${coma(cm)} cm en la semana ${semanaTexto(au.egDias)} (${au.fecha}); percentil 10: ${coma(p.p10)} · percentil 90: ${coma(p.p90)} (CLAP).`,
        baja
          ? 'Posible restricción del crecimiento fetal u oligohidramnios.'
          : 'Posible macrosomía, polihidramnios o embarazo múltiple.',
        'Confirmar la edad gestacional y la técnica de medida; solicitar ecografía.',
      ],
      opciones: [{ etiqueta: 'Ecografía solicitada' }, { etiqueta: 'Referida' }, { etiqueta: 'No requiere acción', requiereMotivo: true }],
    };
  },
};

export type EstadoNutricional = 'bajo_peso' | 'adecuado' | 'sobrepeso' | 'obesidad';

/** Clasifica el IMC para la edad gestacional con la tabla de Atalah (interpolada). */
export function clasificarIMCGestacional(ctx: ContextoClinico, imcValor: number, egDias: number): EstadoNutricional | undefined {
  const tabla = ctx.catalogo.valor('nutricion.atalah');
  const s = egDias / 7;
  if (s < tabla[0]!.semana || s > tabla.at(-1)!.semana) return undefined;
  const i = Math.max(0, tabla.findIndex((t) => t.semana > s) - 1);
  const a = tabla[i]!;
  const b = tabla[Math.min(i + 1, tabla.length - 1)]!;
  const f = b.semana === a.semana ? 0 : (s - a.semana) / (b.semana - a.semana);
  const lim = (k: 'adecuadoDesde' | 'sobrepesoDesde' | 'obesidadDesde') => a[k] + (b[k] - a[k]) * f;
  if (imcValor < lim('adecuadoDesde')) return 'bajo_peso';
  if (imcValor < lim('sobrepesoDesde')) return 'adecuado';
  if (imcValor < lim('obesidadDesde')) return 'sobrepeso';
  return 'obesidad';
}

const NOMBRE_ESTADO: Record<EstadoNutricional, string> = {
  bajo_peso: 'bajo peso',
  adecuado: 'IMC adecuado',
  sobrepeso: 'sobrepeso',
  obesidad: 'obesidad',
};

export const estadoNutricional: Regla = {
  id: 'estado_nutricional',
  evaluar(ctx) {
    const peso = ultimoCon(ctx, 'pesoKg');
    const talla = valorDe(ctx.primera?.gestacionActual.tallaCm);
    if (!peso || peso.egDias === undefined || !talla) return null;
    const valor = imc(peso.valor as number, talla, ctx.catalogo).valor;
    const estado = clasificarIMCGestacional(ctx, valor, peso.egDias);
    if (!estado || estado === 'adecuado') return null;
    return {
      titulo: `Estado nutricional: ${NOMBRE_ESTADO[estado]} para la edad gestacional`,
      porque: [
        `IMC ${coma(valor)} (peso ${coma(peso.valor as number)} kg, talla ${talla} cm) en la semana ${semanaTexto(peso.egDias)} (${peso.fecha}).`,
        'Clasificación por IMC para la edad gestacional (Atalah, Resolución 2465 de 2016).',
        'Consejería nutricional y seguimiento de la ganancia de peso.',
      ],
      severidad: estado === 'obesidad' ? 2 : 1,
      opciones: [{ etiqueta: 'Consejería nutricional' }, { etiqueta: 'Referida a nutrición' }, { etiqueta: 'No requiere acción', requiereMotivo: true }],
    };
  },
};

export const movimientosFetales: Regla = {
  id: 'movimientos_fetales',
  evaluar(ctx) {
    const mov = ultimoCon(ctx, 'movimientosFetales');
    const { movimientosDesdeSemana } = ctx.catalogo.valor('bienestarFetal');
    if (!mov || mov.valor !== false || mov.egDias === undefined || mov.egDias < movimientosDesdeSemana * 7) return null;
    return {
      titulo: 'Movimientos fetales ausentes o disminuidos',
      porque: [
        `Registrado "No" en el control del ${mov.fecha} (semana ${semanaTexto(mov.egDias)}).`,
        'Evaluar el bienestar fetal (FCF y monitoreo según la semana) y remitir si no se confirma.',
      ],
      urgente: true,
      severidad: 2,
      opciones: [{ etiqueta: 'Bienestar fetal confirmado' }, { etiqueta: 'Remitida' }, { etiqueta: 'Otra conducta', requiereMotivo: true }],
    };
  },
};

export const frecuenciaCardiacaFetal: Regla = {
  id: 'fcf',
  evaluar(ctx) {
    const fcf = ultimoCon(ctx, 'fcfLpm');
    if (!fcf) return null;
    const { fcfMin, fcfMax } = ctx.catalogo.valor('bienestarFetal');
    const lpm = fcf.valor as number;
    if (lpm >= fcfMin && lpm <= fcfMax) return null;
    return {
      titulo: 'Frecuencia cardíaca fetal fuera de rango',
      porque: [
        `FCF ${lpm} lpm el ${fcf.fecha}${fcf.egDias !== undefined ? ` (semana ${semanaTexto(fcf.egDias)})` : ''}; rango normal ${fcfMin}–${fcfMax}.`,
        'Repetir la medición y evaluar el bienestar fetal; remitir si se confirma.',
      ],
      urgente: true,
      severidad: 2,
      opciones: [{ etiqueta: 'Repetida: normal' }, { etiqueta: 'Remitida' }, { etiqueta: 'Otra conducta', requiereMotivo: true }],
    };
  },
};
