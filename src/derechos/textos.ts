// E1 — Textos de "Opciones y derechos". Lenguaje neutro, sin juicios ni términos estigmatizantes.
// Cada texto legal cita su norma; la fecha de verificación viene del catálogo.
import type { Catalogo } from '../clinico/catalogo';
import type { Causal, DecisionDerechos, DesencadenanteDerechos } from '../datos/modelo';

export const CAUSALES: { id: Causal; texto: string }[] = [
  { id: 'salud', texto: 'Riesgo para la vida o la salud (física o mental) de la gestante.' },
  { id: 'malformacion', texto: 'Malformación fetal incompatible con la vida extrauterina, certificada por un médico.' },
  {
    id: 'violencia_sexual',
    texto:
      'Embarazo producto de violencia sexual, incesto, o inseminación o transferencia de óvulo no consentidas. No se exige denuncia; el hecho debe quedar consignado en la historia clínica.',
  },
];

export const DESENCADENANTES: Record<DesencadenanteDerechos, string> = {
  no_planeado: 'Embarazo no planeado: la gestante no desea continuarlo o no ha decidido',
  violencia_sexual: 'Violencia sexual',
  violencia_mujer: 'Violencia contra la mujer (física, psicológica o económica)',
  menor_14: 'Gestante menor de 14 años',
  causal_clinica: 'Malformación fetal grave o condición que pone en riesgo la vida o la salud de la gestante',
  pregunta_gestante: 'La gestante pregunta por la IVE',
};

export const DECISIONES: Record<DecisionDerechos, string> = {
  continua: 'Continúa el embarazo',
  solicita_ive: 'Solicita IVE',
  lo_pensara: 'Lo pensará (con cita cercana)',
  no_desea_hablar: 'No desea hablar del tema ahora',
};

export const MOMENTO_A_SOLAS =
  'Si hay un acompañante, ofrezca a la gestante un momento a solas antes de preguntar por su decisión o por violencia.';

export const GUIA_ASESORIA = [
  'Informe todas las opciones con lenguaje claro y sin juicios: continuar el embarazo, entregar en adopción o interrumpirlo.',
  'Cualquiera de las opciones es decisión de ella. Su voluntad se registra en la historia clínica.',
  'Las niñas y adolescentes también pueden acceder a la IVE.',
  'Resuelva sus preguntas y verifique que entendió. No dilate la atención.',
];

export const AVISO_URGENCIA =
  'La atención de la IVE es urgente y no se puede dilatar. Solo en casos excepcionales y justificados puede haber un plazo máximo de 5 días calendario, y se registra en la historia.';

export const AVISO_OBJECION =
  'La objeción de conciencia es individual del profesional que realiza el procedimiento, no de la institución. Si usted es objetor, debe remitir de inmediato a un profesional que no objete.';

export const AVISO_SIN_PRESTADOR =
  'La institución no tiene configurado un prestador de referencia para IVE: debe definir su ruta de remisión. Registre la remisión de forma manual.';

export function avisoRuta(menor14: boolean): string[] {
  return [
    menor14
      ? 'Embarazo en menor de 14 años: se presume violencia sexual. Activar la ruta de atención integral a víctimas de violencia sexual, que es una urgencia médica, y hacer las notificaciones que exige la norma.'
      : 'Violencia sexual: activar la ruta de atención integral a víctimas de violencia sexual, que es una urgencia médica, y hacer las notificaciones que exige la norma.',
    'La causal de violencia sexual permite la IVE sin límite de edad gestacional, también después de la semana 24.',
  ];
}

/** Cita de una norma con su fecha de verificación (o el aviso de que falta verificarla). */
export function cita(catalogo: Catalogo, norma: string): string {
  const n = catalogo.valor('derechos.normas').find((x) => x.norma === norma);
  if (!n) return norma;
  return `${n.norma} — ${n.fechaVerificacion ? `verificada el ${n.fechaVerificacion}` : 'fecha de verificación pendiente'}`;
}
