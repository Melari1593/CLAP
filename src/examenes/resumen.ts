// Nombres de los exámenes y resumen legible de cada resultado (profesional; nunca en el carné).
import { valorDe } from '../datos/campo';
import type { ResultadoExamen, ResultadoPorTipo, TipoExamen } from '../datos/modelo';

export const EXAMENES: { tipo: TipoExamen; etiqueta: string; privado?: boolean }[] = [
  { tipo: 'hb', etiqueta: 'Hemoglobina' },
  { tipo: 'plaquetas', etiqueta: 'Plaquetas' },
  { tipo: 'ferritina', etiqueta: 'Ferritina sérica' },
  { tipo: 'saturacionTransferrina', etiqueta: 'Saturación de transferrina' },
  { tipo: 'inflamacion', etiqueta: 'Inflamación o infección' },
  { tipo: 'vdrl', etiqueta: 'VDRL / RPR' },
  { tipo: 'vih', etiqueta: 'VIH', privado: true },
  { tipo: 'hepatitisB', etiqueta: 'Hepatitis B (antígeno de superficie)' },
  { tipo: 'sifilisTreponemica', etiqueta: 'Sífilis: prueba treponémica rápida' },
  { tipo: 'rubeolaIgG', etiqueta: 'IgG para rubéola' },
  { tipo: 'coombsIndirecto', etiqueta: 'Coombs indirecto' },
  { tipo: 'ecografia', etiqueta: 'Ecografía' },
  { tipo: 'toxoplasmosis', etiqueta: 'Toxoplasmosis' },
  { tipo: 'chagas', etiqueta: 'Chagas' },
  { tipo: 'malaria', etiqueta: 'Malaria' },
  { tipo: 'bacteriuria', etiqueta: 'Bacteriuria' },
  { tipo: 'ptog', etiqueta: 'PTOG 75 g' },
  { tipo: 'egb', etiqueta: 'Estreptococo B' },
];

export const etiquetaExamen = (t: TipoExamen) => EXAMENES.find((e) => e.tipo === t)?.etiqueta ?? t;
const sn = (b: boolean | null | undefined) => (b === null || b === undefined ? '—' : b ? 'Sí' : 'No');
const pos = (b: boolean) => (b ? 'Positivo' : 'Negativo');

export function resumenExamen(e: ResultadoExamen): string {
  if (e.resultado.estado !== 'valor') return e.resultado.estado === 'no_se_hizo' ? 'No se hizo' : 'No corresponde';
  const r = e.resultado.valor as ResultadoPorTipo[TipoExamen];
  switch (e.tipo) {
    case 'hb': { const v = r as ResultadoPorTipo['hb']; return `${v.gdl.toLocaleString('es-CO')} g/dL (${v.muestra})`; }
    case 'plaquetas': return `${(r as ResultadoPorTipo['plaquetas']).x10e9L} × 10⁹/L`;
    case 'ferritina': return `${(r as ResultadoPorTipo['ferritina']).ngMl} ng/mL`;
    case 'saturacionTransferrina': return `${(r as ResultadoPorTipo['saturacionTransferrina']).porcentaje} %`;
    case 'inflamacion': { const v = r as ResultadoPorTipo['inflamacion']; return v.presente ? `Presente: ${v.descripcion}` : 'Ausente'; }
    case 'vdrl': { const v = r as ResultadoPorTipo['vdrl']; return `${v.reactivo ? 'Reactivo' : 'No reactivo'} · FTA ${sn(v.fta)} · Tto ${sn(v.tratamiento)} · Tto pareja ${sn(v.tratamientoPareja)}`; }
    case 'vih': { const v = r as ResultadoPorTipo['vih']; return `Solicitado ${sn(v.solicitado)} · Realizado ${sn(v.realizado)} · ${v.resultado.replace('_', ' ')}`; }
    case 'sifilisTreponemica': return (r as ResultadoPorTipo['sifilisTreponemica']).reactiva ? 'Reactiva' : 'No reactiva';
    case 'coombsIndirecto': return pos((r as ResultadoPorTipo['coombsIndirecto']).positivo);
    case 'rubeolaIgG': return pos((r as ResultadoPorTipo['rubeolaIgG']).positivo);
    case 'ecografia': { const v = r as ResultadoPorTipo['ecografia']; return `${v.momento === 'primer_trimestre' ? 'De 10+6 a 13+6' : v.momento === 'detalle' ? 'De detalle' : 'Otra'} · ${v.hallazgos}`; }
    case 'hepatitisB': return `Antígeno de superficie ${(r as ResultadoPorTipo['hepatitisB']).antigenoSuperficie}`;
    case 'toxoplasmosis': { const v = r as ResultadoPorTipo['toxoplasmosis']; return `IgG ${v.igg ?? '—'} · IgM ${v.igm ?? '—'}`; }
    case 'ptog': { const v = r as ResultadoPorTipo['ptog']; return `${valorDe(v.ayunas) ?? '—'} / ${valorDe(v.unaHora) ?? '—'} / ${valorDe(v.dosHoras) ?? '—'} mg/dL`; }
    default: return pos((r as { positivo: boolean }).positivo);
  }
}
