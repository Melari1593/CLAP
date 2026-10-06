// F4 — Textos del carné en lenguaje cotidiano, frases cortas e iconos.
// Los de hierro, ASA, calcio y tromboprofilaxis son los del spec; el de ácido fólico se valida con
// el equipo clínico y con gestantes (G3).
import type { TipoIndicacion } from '../datos/modelo';

export const QUE_HACER: Partial<Record<TipoIndicacion, { icono: string; texto: string }>> = {
  hierro: {
    icono: '💊',
    texto:
      'Tómate la pastilla de hierro todos los días. Tu sangre tiene poco hierro y eso te puede cansar a ti y afectar el crecimiento de tu bebé. Tómala 2 horas antes o 2 horas después de las comidas principales, no con leche, y al menos 1 hora separada del calcio.',
  },
  acidoFolico: {
    icono: '💊',
    texto: 'Tómate el ácido fólico todos los días. Ayuda a que tu bebé se forme bien.',
  },
  asa: {
    icono: '💊',
    texto:
      'Tómate la aspirina todos los días hasta el día del parto. Ayuda a prevenir la presión alta del embarazo, que puede ser peligrosa para ti y tu bebé. No la suspendas sin preguntar.',
  },
  calcio: {
    icono: '🦴',
    texto:
      'Tómate 2 tabletas de calcio todos los días hasta el parto. Ayuda a prevenir la presión alta del embarazo y a formar los huesos de tu bebé. No lo tomes al mismo tiempo que el hierro: deja al menos 1 hora entre uno y otro. Tómalo 2 horas antes o 2 horas después del desayuno, el almuerzo o la comida, y no con leche.',
  },
  tromboprofilaxis: {
    icono: '💉',
    texto:
      'Aplícate la inyección para prevenir coágulos todos los días a la misma hora. El embarazo aumenta el riesgo de coágulos en las venas y tú tienes factores que lo suben más. Si empiezas trabajo de parto, sangras o te van a operar, no te la apliques y avisa en el hospital que la estás usando.',
  },
};

export const SENALES_COAGULO = [
  'Pierna hinchada, roja o dolorosa de un solo lado.',
  'Falta de aire de repente.',
  'Dolor en el pecho.',
];

export const SIGNOS_ALARMA = [
  { icono: '🩸', texto: 'Sangrado.' },
  { icono: '💧', texto: 'Salida de líquido.' },
  { icono: '🤕', texto: 'Dolor de cabeza fuerte.' },
  { icono: '👁️', texto: 'Visión borrosa.' },
  { icono: '🫲', texto: 'Hinchazón de cara o manos.' },
  { icono: '🌡️', texto: 'Fiebre.' },
  { icono: '👶', texto: 'El bebé no se mueve.' },
  { icono: '⏱️', texto: 'Contracciones antes de tiempo.' },
];

export const TUS_DERECHOS = [
  'Recibir atención con respeto, sin discriminación y con información clara sobre tu salud y la de tu bebé.',
  'Que tu información sea confidencial.',
  'Recibir información sobre todas tus opciones y decidir sobre tu cuerpo. Puedes preguntar en privado a tu profesional de salud.',
  'Estar acompañada por la persona que tú elijas durante el trabajo de parto y el parto.',
  'Recibir asesoría sobre métodos anticonceptivos después del parto.',
  'Recibir atención urgente si sufres violencia, incluida la violencia sexual.',
];

export const ANTIRRUBEOLA: Record<string, string> = {
  previa: 'Antirrubéola: ya la tienes.',
  embarazo: 'Antirrubéola: aplicada.',
  no: 'Antirrubéola: te la aplicarán después del parto.',
  no_sabe: 'Antirrubéola: te la aplicarán después del parto.',
};
