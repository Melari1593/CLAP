// B2 / B4 — Valores imposibles: la app pide confirmar antes de guardar (nunca bloquea).
import type { Catalogo } from '../clinico/catalogo';
import { valorDe, type Campo } from '../datos/campo';
import type { DatosPrimeraConsulta, DatosSeguimiento, FechaISO } from '../datos/modelo';

export interface Advertencia {
  ruta: string;
  mensaje: string;
}

function fueraDeRango(
  catalogo: Catalogo,
  clave: string,
  campo: Campo<number> | undefined,
  ruta: string,
  nombre: string,
  unidad: string,
): Advertencia[] {
  const v = valorDe(campo);
  const rango = catalogo.valor('validacion.rangos')[clave];
  if (v === undefined || !rango || (v >= rango.min && v <= rango.max)) return [];
  return [{ ruta, mensaje: `${nombre} de ${v} ${unidad} está fuera del rango esperado (${rango.min}–${rango.max}). ¿Es correcto?` }];
}

function fechaFutura(fecha: FechaISO | undefined, hoy: FechaISO, ruta: string, nombre: string): Advertencia[] {
  return fecha !== undefined && fecha > hoy ? [{ ruta, mensaje: `${nombre} (${fecha}) es una fecha futura. ¿Es correcto?` }] : [];
}

export function validarPrimeraConsulta(d: DatosPrimeraConsulta, hoy: FechaISO, catalogo: Catalogo): Advertencia[] {
  const o = d.antecedentesObstetricos;
  const gestas = valorDe(o.gestas);
  const partos = (valorDe(o.partosVaginales) ?? 0) + (valorDe(o.cesareas) ?? 0);
  const terminaciones = partos + (valorDe(o.abortos) ?? 0) + (valorDe(o.ectopicos) ?? 0);
  const eco = valorDe(d.gestacionActual.ecografia);
  const altitud = valorDe(d.identificacion.altitudM);
  const altitudMaxima = catalogo.valor('anemia.altitudMaximaAjuste');

  return [
    ...fueraDeRango(catalogo, 'pesoKg', d.gestacionActual.pesoAnteriorKg, 'gestacionActual.pesoAnteriorKg', 'El peso', 'kg'),
    ...fueraDeRango(catalogo, 'tallaCm', d.gestacionActual.tallaCm, 'gestacionActual.tallaCm', 'La talla', 'cm'),
    ...(d.examenFisico ? validarSignosVitales(d.examenFisico, 'examenFisico.', catalogo) : []),
    ...(d.examenFisico ? fueraDeRango(catalogo, 'fcfLpm', d.examenFisico.fcfLpm, 'examenFisico.fcfLpm', 'La FCF', 'lpm') : []),
    ...fechaFutura(valorDe(d.gestacionActual.fum), hoy, 'gestacionActual.fum', 'La FUM'),
    ...fechaFutura(eco?.fecha, hoy, 'gestacionActual.ecografia', 'La ecografía'),
    ...fechaFutura(valorDe(o.finEmbarazoAnterior), hoy, 'antecedentesObstetricos.finEmbarazoAnterior', 'El fin del embarazo anterior'),
    ...(gestas !== undefined && partos > gestas
      ? [{ ruta: 'antecedentesObstetricos.gestas', mensaje: `Hay más partos (${partos}) que gestas (${gestas}). ¿Es correcto?` }]
      : gestas !== undefined && terminaciones > gestas
        ? [{ ruta: 'antecedentesObstetricos.gestas', mensaje: `Partos, abortos y ectópicos (${terminaciones}) suman más que las gestas (${gestas}). ¿Es correcto?` }]
        : []),
    ...(eco && (eco.egDias < 0 || eco.egDias > 300)
      ? [{ ruta: 'gestacionActual.ecografia', mensaje: `La EG de la ecografía (${eco.egDias} días) no es posible. ¿Es correcto?` }]
      : []),
    ...(altitud !== undefined && (altitud < 0 || altitud >= altitudMaxima)
      ? [{ ruta: 'identificacion.altitudM', mensaje: `La altitud de ${altitud} m está fuera de la tabla de la OMS (0–${altitudMaxima - 1} m). Revise el dato.` }]
      : []),
  ];
}

export function validarSeguimiento(d: DatosSeguimiento, catalogo: Catalogo): Advertencia[] {
  return [
    ...fueraDeRango(catalogo, 'pesoKg', d.pesoKg, 'pesoKg', 'El peso', 'kg'),
    ...fueraDeRango(catalogo, 'paSistolica', d.paSistolica, 'paSistolica', 'La PA sistólica', 'mmHg'),
    ...fueraDeRango(catalogo, 'paDiastolica', d.paDiastolica, 'paDiastolica', 'La PA diastólica', 'mmHg'),
    ...fueraDeRango(catalogo, 'fcfLpm', d.fcfLpm, 'fcfLpm', 'La FCF', 'lpm'),
    ...validarSignosVitales(d, '', catalogo),
  ];
}

/** Signos vitales: rangos y diastólica menor que sistólica. `prefijo` es la ruta del objeto ('' o 'examenFisico.'). */
function validarSignosVitales(
  s: { paSistolica: Campo<number>; paDiastolica: Campo<number>; fcLpm: Campo<number>; frRpm: Campo<number>; temperaturaC: Campo<number>; saturacionPct: Campo<number> },
  prefijo: string,
  catalogo: Catalogo,
): Advertencia[] {
  const pas = valorDe(s.paSistolica);
  const pad = valorDe(s.paDiastolica);
  return [
    ...(prefijo ? [...fueraDeRango(catalogo, 'paSistolica', s.paSistolica, `${prefijo}paSistolica`, 'La PA sistólica', 'mmHg'), ...fueraDeRango(catalogo, 'paDiastolica', s.paDiastolica, `${prefijo}paDiastolica`, 'La PA diastólica', 'mmHg')] : []),
    ...fueraDeRango(catalogo, 'fcLpm', s.fcLpm, `${prefijo}fcLpm`, 'La frecuencia cardíaca', 'lpm'),
    ...fueraDeRango(catalogo, 'frRpm', s.frRpm, `${prefijo}frRpm`, 'La frecuencia respiratoria', 'rpm'),
    ...fueraDeRango(catalogo, 'temperaturaC', s.temperaturaC, `${prefijo}temperaturaC`, 'La temperatura', '°C'),
    ...fueraDeRango(catalogo, 'saturacionPct', s.saturacionPct, `${prefijo}saturacionPct`, 'La saturación', '%'),
    ...(pas !== undefined && pad !== undefined && pad >= pas
      ? [{ ruta: `${prefijo}paDiastolica`, mensaje: `La diastólica (${pad}) no es menor que la sistólica (${pas}). ¿Es correcto?` }]
      : []),
  ];
}

export function validarHb(gdl: number, catalogo: Catalogo): Advertencia[] {
  return fueraDeRango(catalogo, 'hbGdl', { estado: 'valor', valor: gdl }, 'hb', 'La hemoglobina', 'g/dL');
}

export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());
}
