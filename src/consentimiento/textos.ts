// Lo que el profesional explica antes de que la gestante decida (Resolución 3100 de 2019:
// beneficios, riesgos, alternativas e implicaciones). Lenguaje cotidiano, para leerlo con ella.
import type { TipoConsentimiento } from '../datos/modelo';

export interface GuiaConsentimiento {
  titulo: string;
  beneficios: string;
  riesgos: string;
  alternativas: string;
  implicaciones: string;
}

export const GUIA_CONSENTIMIENTO: Record<TipoConsentimiento, GuiaConsentimiento> = {
  datos_carne: {
    titulo: 'Tratamiento de datos y envío del carné',
    beneficios: 'Tiene su carné en el celular (o impreso) con la próxima cita, los exámenes pendientes, qué hacer y los signos de alarma.',
    riesgos:
      'Si otra persona usa su celular o conoce su PIN, puede ver el carné. El carné nunca muestra VIH, violencia, drogas, alcohol, IVE ni notas privadas.',
    alternativas: 'No recibir el carné digital. Su atención no cambia si no acepta.',
    implicaciones:
      'Sus datos se usan solo para su atención (Ley 1581 de 2012). Puede retirar el consentimiento cuando quiera: el enlace deja de mostrar el carné.',
  },
  procedimiento: {
    titulo: 'Procedimiento',
    beneficios: 'Para qué sirve el procedimiento y qué se espera saber o lograr con él.',
    riesgos: 'Riesgos frecuentes y graves, para ella y para el bebé, y qué hacer si se presentan.',
    alternativas: 'Otras opciones, incluida la de no hacerlo, y lo que pasa en cada caso.',
    implicaciones: 'Cómo se hace, cuánto dura, la preparación y los cuidados después. Puede cambiar de opinión antes del procedimiento.',
  },
  ive: {
    titulo: 'Interrupción voluntaria del embarazo (IVE)',
    beneficios: 'Los métodos disponibles para su semana de embarazo y lo que se espera de cada uno.',
    riesgos: 'Riesgos de cada método, signos de alarma después del procedimiento y a dónde consultar.',
    alternativas: 'Continuar el embarazo, con la opción de entregar al bebé en adopción.',
    implicaciones:
      'La decisión es solo suya: no se pide autorización de la pareja, de la familia ni de los padres. Puede cambiar de opinión en cualquier momento antes del procedimiento.',
  },
};

/** Sugerencias al escribir el procedimiento; se puede escribir cualquier otro. */
export const PROCEDIMIENTOS_FRECUENTES = [
  'Amniocentesis (PCR para toxoplasma en líquido amniótico)',
  'Prueba de VIH',
  'Aplicación de inmunoglobulina anti-D',
  'Inserción de DIU después del parto',
  'Inserción de implante subdérmico',
  'Ligadura de trompas',
  'Colposcopia',
];
