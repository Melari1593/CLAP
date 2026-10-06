// A3 — Nivel de privacidad de cada dato.
// "privado": solo el profesional autorizado. "nunca_en_carne": además, nunca sale en el carné
// (ni digital, ni impreso, ni en mensajes). Lo que no está en la lista es "normal".

export type NivelPrivacidad = 'normal' | 'privado' | 'nunca_en_carne';

export const DATOS_NUNCA_EN_CARNE = [
  // VIH: resultado y código.
  'examenes.vih',
  // Respuestas sobre violencia.
  'primera.gestacionActual.violencia',
  'primera.gestacionActual.violenciaSexual',
  'primera.antecedentesPersonales.violencia',
  // Drogas y alcohol.
  'primera.gestacionActual.drogas',
  'primera.gestacionActual.alcohol',
  // Notas internas del profesional.
  'seguimiento.observaciones',
  // Sección 7: deseo de continuar, IVE, causales y ruta de violencia sexual.
  'primera.planificacion.deseaContinuar',
  'derechos',
  // Bitácora: contiene los valores anteriores de todos los campos.
  'bitacora',
] as const;

export function nivelDe(ruta: string): NivelPrivacidad {
  const coincide = DATOS_NUNCA_EN_CARNE.some((r) => ruta === r || ruta.startsWith(`${r}.`));
  return coincide ? 'nunca_en_carne' : 'normal';
}
