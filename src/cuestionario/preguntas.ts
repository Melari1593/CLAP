// Cuestionario para la gestante: las preguntas de la primera consulta en palabras sencillas.
// Ella lo responde antes de la consulta (en la tableta, en su idioma); el profesional después pasa
// las respuestas a la historia y las confirma. "No sé" y "Prefiero hablarlo" no llenan nada.
import type { Catalogo } from '../clinico/catalogo';
import { interpretarCodificado } from '../clinico/codigos';

export type TipoPregunta = 'sino' | 'opciones' | 'multiple' | 'numero' | 'fecha' | 'texto' | 'municipio' | 'aseguradora';

export interface OpcionPregunta {
  valor: string;
  texto: string;
}

export interface Pregunta {
  id: string;
  texto: string;
  ayuda?: string;
  tipo: TipoPregunta;
  opciones?: OpcionPregunta[];
  unidad?: string;
  /** Campo de la primera consulta que llena (o varios). */
  rutas?: string[];
  /** Pasa la respuesta al valor del campo (por defecto, la misma). */
  convertir?: (respuesta: unknown, catalogo: Catalogo) => unknown;
  /** Tema delicado: se ofrece "Prefiero hablarlo con el profesional". */
  delicada?: boolean;
  /** Si devuelve false, la pregunta no se muestra. */
  aplica?: (r: Respuestas, ctx: ContextoCuestionario) => boolean;
  /** Para el profesional: la respuesta se resalta como signo de alarma o dato a revisar. */
  alerta?: (respuesta: unknown) => string[];
  /** Si no llena ningún campo, se muestra al profesional como "otras respuestas". */
  resumen?: boolean;
}

/** Lo que el cuestionario sabe de la historia para decidir qué preguntar. */
export interface ContextoCuestionario {
  /** Indicaciones vigentes (indicadas o que ya toma). */
  indicaciones: string[];
}

export interface SeccionCuestionario {
  id: string;
  titulo: string;
  icono: string;
  preguntas: Pregunta[];
}

export type Respuestas = Record<string, unknown>;

export const NO_SABE = 'no_sabe';
export const PREFIERO_HABLARLO = 'prefiero_hablarlo';

const sino = (id: string, texto: string, rutas: string[], extra: Partial<Pregunta> = {}): Pregunta => ({ id, texto, tipo: 'sino', rutas, ...extra });
const op = (...pares: [string, string][]): OpcionPregunta[] => pares.map(([valor, texto]) => ({ valor, texto }));
const si = (id: string) => (r: Respuestas) => r[id] === true;
const numero = (r: unknown) => (typeof r === 'number' ? r : undefined);
const tuvoEmbarazos = (r: Respuestas) => typeof r.gestas === 'number' && r.gestas > 0;

export const CUESTIONARIO: SeccionCuestionario[] = [
  {
    id: 'tu',
    titulo: 'Sobre ti',
    icono: '🙋',
    preguntas: [
      { id: 'motivo', texto: '¿Cómo te has sentido? ¿Hay algo que te preocupe o que quieras contarnos hoy?', tipo: 'texto', rutas: ['anamnesis.motivoConsulta'] },
      { id: 'direccion', texto: '¿Dónde vives? Escribe la dirección, el barrio o la vereda.', tipo: 'texto', rutas: ['identificacion.domicilio'] },
      { id: 'municipio', texto: '¿En qué municipio vives?', tipo: 'municipio', rutas: ['identificacion.municipio'] },
      { id: 'telefono', texto: '¿Cuál es tu número de celular o WhatsApp?', tipo: 'texto', rutas: ['identificacion.telefono'] },
      { id: 'correo', texto: '¿Tienes correo electrónico que revises? Escríbelo (si no tienes, déjalo en blanco).', tipo: 'texto', rutas: ['identificacion.correo'] },
      {
        id: 'estudios',
        texto: '¿Hasta qué nivel estudiaste?',
        tipo: 'opciones',
        opciones: op(['ninguno', 'No estudié'], ['primaria', 'Primaria'], ['secundaria', 'Bachillerato'], ['universitaria', 'Técnica o universidad']),
        rutas: ['identificacion.estudios'],
      },
      {
        id: 'estadoCivil',
        texto: '¿Vives con tu pareja?',
        tipo: 'opciones',
        opciones: op(['casada', 'Sí, estamos casados'], ['union_estable', 'Sí, vivimos juntos'], ['soltera', 'No tengo pareja'], ['otro', 'Otra situación']),
        rutas: ['identificacion.estadoCivil'],
      },
      sino('viveSola', '¿Vives sola?', ['identificacion.viveSola']),
      { id: 'ocupacion', texto: '¿A qué te dedicas?', tipo: 'texto', rutas: ['identificacion.ocupacion'] },
      { id: 'eps', texto: '¿Cuál es tu EPS?', tipo: 'aseguradora', rutas: ['identificacion.aseguradora'] },
      {
        id: 'etnia',
        texto: '¿Cómo te reconoces?',
        tipo: 'opciones',
        opciones: op(['indigena', 'Indígena'], ['negra', 'Negra, afrocolombiana, raizal o palenquera'], ['mestiza', 'Mestiza'], ['blanca', 'Blanca'], ['otra', 'Otra']),
        rutas: ['identificacion.etnia'],
      },
      { id: 'acompanante', texto: '¿Quién te acompaña hoy? Escribe su nombre (si vienes sola, déjalo en blanco).', tipo: 'texto', rutas: ['identificacion.acompananteNombre'] },
    ],
  },
  {
    id: 'embarazo',
    titulo: 'Este embarazo',
    icono: '🤰',
    preguntas: [
      { id: 'fum', texto: '¿Cuándo empezó tu última menstruación (regla)?', ayuda: 'Si no recuerdas la fecha exacta, marca "No sé".', tipo: 'fecha', rutas: ['gestacionActual.fum'] },
      { id: 'pesoAntes', texto: '¿Cuánto pesabas antes de quedar embarazada?', tipo: 'numero', unidad: 'kg', rutas: ['gestacionActual.pesoAnteriorKg'], convertir: numero },
      sino('planeado', '¿Estabas buscando este embarazo?', ['planificacion.embarazoPlaneado']),
      {
        id: 'metodo',
        texto: '¿Estabas usando algún método para no quedar embarazada?',
        tipo: 'opciones',
        opciones: op(['no_usaba', 'No usaba ninguno'], ['barrera', 'Condón'], ['hormonal', 'Pastillas, inyección o implante'], ['diu', 'DIU (T de cobre u hormonal)'], ['emergencia', 'Pastilla del día después'], ['natural', 'Ritmo o retiro']),
        rutas: ['planificacion.fracasoMetodo'],
      },
      sino('gemelos', '¿Te han dicho que esperas gemelos o más bebés?', ['riesgoPreeclampsia.embarazoMultiple']),
      sino('fiv', '¿Quedaste embarazada con tratamiento de fertilidad (in vitro u otro)?', ['riesgoPreeclampsia.fertilizacionInVitro']),
      {
        id: 'grupo',
        texto: '¿Sabes tu grupo de sangre?',
        tipo: 'opciones',
        opciones: op(['A', 'A'], ['B', 'B'], ['AB', 'AB'], ['O', 'O']),
        rutas: ['gestacionActual.grupo'],
      },
      { id: 'rh', texto: '¿Tu sangre es positiva o negativa (Rh)?', tipo: 'opciones', opciones: op(['+', 'Positiva'], ['-', 'Negativa']), rutas: ['gestacionActual.rh'] },
    ],
  },
  {
    id: 'salud',
    titulo: 'Tu salud',
    icono: '❤️',
    preguntas: [
      sino('presionAlta', '¿Has tenido la presión alta (hipertensión)?', ['antecedentesPersonales.hipertension']),
      {
        id: 'diabetes',
        texto: '¿Tienes o has tenido diabetes (azúcar alta en la sangre)?',
        tipo: 'opciones',
        opciones: op(['no', 'No'], ['tipo1', 'Sí, uso insulina desde joven (tipo 1)'], ['tipo2', 'Sí, diabetes tipo 2'], ['gestacional', 'Solo en un embarazo anterior']),
        rutas: ['antecedentesPersonales.diabetes'],
      },
      sino('corazon', '¿Tienes alguna enfermedad del corazón?', ['antecedentesPersonales.cardiopatia']),
      sino('rinones', '¿Tienes alguna enfermedad de los riñones?', ['antecedentesPersonales.nefropatia', 'riesgoPreeclampsia.enfermedadRenalCronica']),
      sino('calculos', '¿Has tenido cálculos (piedras) en los riñones?', ['antecedentesCalcio.nefrolitiasisONefrocalcinosis']),
      sino('lupus', '¿Tienes lupus u otra enfermedad de las defensas (autoinmune)?', ['riesgoPreeclampsia.autoinmune']),
      {
        id: 'tiroides',
        texto: '¿Tienes alguna enfermedad de la tiroides?',
        tipo: 'opciones',
        opciones: op(['no', 'No'], ['hipotiroidismo_primario', 'Sí, la tiroides me funciona poco (hipotiroidismo)'], ['hipotiroidismo_ablacion', 'Me operaron la tiroides o me dieron yodo'], ['hipertiroidismo', 'Sí, la tiroides me funciona mucho (hipertiroidismo)'], ['bocio_nodulos', 'Tengo bocio o bolitas en la tiroides']),
        rutas: ['antecedentesPersonales.tiroides'],
      },
      sino('levotiroxina', '¿Tomas medicamento para la tiroides (levotiroxina)?', ['antecedentesCalcio.levotiroxina']),
      { id: 'levotiroxinaDosis', texto: '¿Cuántos microgramos (µg) tomas al día?', ayuda: 'Está escrito en la caja, por ejemplo 50 o 100.', tipo: 'numero', unidad: 'µg', rutas: ['antecedentesPersonales.levotiroxinaUgDia'], convertir: numero, aplica: si('levotiroxina') },
      sino('coagulos', '¿Has tenido un coágulo en las venas de las piernas o en los pulmones (trombosis)?', ['riesgoTrombotico.trombosisPrevia']),
      sino('varices', '¿Tienes várices grandes en las piernas?', ['riesgoTrombotico.varicesGruesas']),
      sino('tbc', '¿Has tenido tuberculosis?', ['antecedentesPersonales.tbc']),
      sino('alergias', '¿Eres alérgica a algún medicamento o alimento?', ['antecedentesPersonales.alergias']),
      { id: 'alergiasCuales', texto: '¿A qué eres alérgica?', tipo: 'texto', rutas: ['antecedentesPersonales.alergiasCuales'], aplica: si('alergias') },
      { id: 'medicamentos', texto: '¿Qué medicamentos, vitaminas o plantas tomas ahora? (si no tomas nada, déjalo en blanco)', tipo: 'texto', rutas: ['antecedentesPersonales.medicamentosActuales'] },
      { id: 'cirugias', texto: '¿Te han operado? ¿De qué y en qué año? (si no, déjalo en blanco)', tipo: 'texto', rutas: ['antecedentesPersonales.quirurgicos'] },
      sino('transfusion', '¿Alguna vez te pusieron sangre (transfusión)?', ['antecedentesPersonales.transfusiones']),
      sino('infertilidad', '¿Te costó mucho tiempo quedar embarazada o te trataron por infertilidad?', ['antecedentesPersonales.infertilidad']),
      { id: 'menarquia', texto: '¿A qué edad te llegó la primera menstruación?', tipo: 'numero', unidad: 'años', rutas: ['antecedentesPersonales.menarquiaEdad'], convertir: numero },
      {
        id: 'ciclos',
        texto: 'Antes del embarazo, ¿tu regla llegaba más o menos cada mes?',
        tipo: 'opciones',
        opciones: op(['regulares', 'Sí, cada mes'], ['irregulares', 'No, era irregular']),
        rutas: ['antecedentesPersonales.ciclos'],
      },
    ],
  },
  {
    id: 'embarazosAnteriores',
    titulo: 'Embarazos anteriores',
    icono: '👶',
    preguntas: [
      { id: 'gestas', texto: '¿Cuántas veces has estado embarazada antes de este embarazo?', ayuda: 'Cuenta también las pérdidas. Si es tu primer embarazo, escribe 0.', tipo: 'numero', rutas: ['antecedentesObstetricos.gestas'], convertir: numero },
      { id: 'partos', texto: '¿Cuántos partos por la vagina (partos normales)?', tipo: 'numero', rutas: ['antecedentesObstetricos.partosVaginales'], convertir: numero, aplica: tuvoEmbarazos },
      { id: 'cesareas', texto: '¿Cuántas cesáreas?', tipo: 'numero', rutas: ['antecedentesObstetricos.cesareas'], convertir: numero, aplica: tuvoEmbarazos },
      { id: 'abortos', texto: '¿Cuántas pérdidas o abortos?', tipo: 'numero', rutas: ['antecedentesObstetricos.abortos'], convertir: numero, aplica: tuvoEmbarazos, delicada: true },
      { id: 'ectopicos', texto: '¿Cuántos embarazos fuera de la matriz (ectópicos)?', tipo: 'numero', rutas: ['antecedentesObstetricos.ectopicos'], convertir: numero, aplica: tuvoEmbarazos },
      { id: 'nacidosVivos', texto: '¿Cuántos bebés nacieron vivos?', tipo: 'numero', rutas: ['antecedentesObstetricos.nacidosVivos'], convertir: numero, aplica: tuvoEmbarazos },
      { id: 'viven', texto: '¿Cuántos de tus hijos viven hoy?', tipo: 'numero', rutas: ['antecedentesObstetricos.viven'], convertir: numero, aplica: tuvoEmbarazos },
      { id: 'nacidosMuertos', texto: '¿Cuántos bebés nacieron sin vida?', tipo: 'numero', rutas: ['antecedentesObstetricos.nacidosMuertos'], convertir: numero, aplica: tuvoEmbarazos, delicada: true },
      { id: 'pesoUltimo', texto: '¿Cuánto pesó tu último bebé al nacer?', ayuda: 'En gramos, por ejemplo 3200.', tipo: 'numero', unidad: 'g', rutas: ['antecedentesObstetricos.pesoUltimoRNg'], convertir: numero, aplica: tuvoEmbarazos },
      { id: 'finAnterior', texto: '¿Cuándo terminó tu embarazo anterior?', tipo: 'fecha', rutas: ['antecedentesObstetricos.finEmbarazoAnterior'], aplica: tuvoEmbarazos },
      sino('gemelaresAntes', '¿Has tenido gemelos antes?', ['antecedentesObstetricos.gemelares'], { aplica: tuvoEmbarazos }),
      sino('presionEmbarazo', '¿En otro embarazo tuviste la presión alta o preeclampsia?', ['antecedentesPersonales.preeclampsia', 'riesgoPreeclampsia.trastornoHipertensivoPrevio'], { aplica: tuvoEmbarazos }),
      sino('convulsiones', '¿En otro embarazo tuviste convulsiones (eclampsia)?', ['antecedentesPersonales.eclampsia'], { aplica: tuvoEmbarazos }),
    ],
  },
  {
    id: 'familia',
    titulo: 'Tu familia',
    icono: '👪',
    preguntas: [
      sino('famDiabetes', '¿Tu mamá, papá, hermanos o abuelos tienen diabetes?', ['antecedentesFamiliares.diabetes']),
      sino('famPresion', '¿Alguno de ellos tiene la presión alta?', ['antecedentesFamiliares.hipertension']),
      sino('famPreeclampsia', '¿Tu mamá o una hermana tuvo preeclampsia (presión alta en el embarazo)?', ['antecedentesFamiliares.preeclampsia', 'riesgoPreeclampsia.antecedenteFamiliarPreeclampsia']),
      sino('famTrombosis', '¿Tu mamá, papá o hermanos han tenido coágulos en las venas (trombosis)?', ['antecedentesFamiliares.trombosis']),
      sino('famTbc', '¿Alguien en tu familia ha tenido tuberculosis?', ['antecedentesFamiliares.tbc']),
    ],
  },
  {
    id: 'vacunas',
    titulo: 'Tus vacunas',
    icono: '💉',
    preguntas: [
      {
        id: 'rubeola',
        texto: '¿Te han puesto la vacuna contra la rubéola (o la triple viral)?',
        tipo: 'opciones',
        opciones: op(['previa', 'Sí, antes del embarazo'], ['embarazo', 'Sí, en este embarazo'], ['no', 'No']),
        rutas: ['gestacionActual.antirrubeola'],
      },
      { id: 'varicela', texto: '¿Te han puesto la vacuna contra la varicela?', tipo: 'opciones', opciones: op(['previa', 'Sí'], ['no', 'No']), rutas: ['gestacionActual.antivaricela'] },
      {
        id: 'tetanos',
        texto: '¿Cuántas vacunas contra el tétanos te han puesto en tu vida?',
        ayuda: 'Si tienes tu carné de vacunas, tráelo a la consulta.',
        tipo: 'numero',
        unidad: 'dosis',
        rutas: ['gestacionActual.antitetanica'],
        // Lo que ella recuerda: el profesional lo confirma con el carné de vacunas.
        convertir: (r) => (typeof r === 'number' ? { dosisPrevias: r, fechaUltima: null, informacionConfiable: false } : undefined),
      },
    ],
  },
  {
    id: 'habitos',
    titulo: 'Hábitos y bienestar',
    icono: '🌱',
    preguntas: [
      sino('fuma', '¿Fumas cigarrillo?', ['gestacionActual.fumaActivo'], { delicada: true }),
      { id: 'cigarrillos', texto: '¿Cuántos cigarrillos al día?', tipo: 'numero', unidad: 'al día', rutas: ['gestacionActual.cigarrillosDia'], convertir: numero, aplica: si('fuma') },
      sino('humo', '¿Alguien fuma cerca de ti, en la casa o en el trabajo?', ['gestacionActual.fumaPasivo']),
      sino('alcohol', 'En este embarazo, ¿has tomado bebidas con alcohol?', ['gestacionActual.alcohol'], { delicada: true }),
      sino('drogas', 'En este embarazo, ¿has usado alguna droga (marihuana, cocaína u otra)?', ['gestacionActual.drogas'], { delicada: true }),
      sino('violencia', '¿Alguien te ha golpeado, maltratado o te hace sentir miedo?', ['gestacionActual.violencia'], {
        delicada: true,
        ayuda: 'Tu respuesta es confidencial. Si quieres, puedes hablarlo a solas con el profesional.',
      }),
    ],
  },
];

export type TipoCuestionario = 'primera' | 'seguimiento';

const SIN_CONTEXTO: ContextoCuestionario = { indicaciones: [] };

/** Preguntas visibles según lo respondido y la historia. */
export const preguntasVisibles = (seccion: SeccionCuestionario, r: Respuestas, ctx: ContextoCuestionario = SIN_CONTEXTO) =>
  seccion.preguntas.filter((p) => !p.aplica || p.aplica(r, ctx));

/** Texto de una respuesta, para mostrarla al profesional. */
export function textoRespuesta(p: Pregunta, r: unknown): string {
  if (r === NO_SABE) return 'No sé';
  if (r === PREFIERO_HABLARLO) return 'Prefiere hablarlo';
  if (r === true) return 'Sí';
  if (r === false) return 'No';
  if (Array.isArray(r)) return r.map((v) => p.opciones?.find((o) => o.valor === v)?.texto ?? String(v)).join(', ');
  return p.opciones?.find((o) => o.valor === r)?.texto ?? String(r);
}

// ---------------------------------------------------------------- Controles de seguimiento

const ALARMAS = op(
  ['sangrado', 'Sangrado por la vagina'],
  ['liquido', 'Salida de líquido por la vagina'],
  ['dolorCabeza', 'Dolor de cabeza fuerte'],
  ['vision', 'Visión borrosa o lucecitas'],
  ['hinchazon', 'Hinchazón de la cara o de las manos'],
  ['fiebre', 'Fiebre'],
  ['dolorBarriga', 'Dolor fuerte en la barriga'],
  ['contracciones', 'Contracciones o la barriga se pone dura muy seguido'],
  ['orina', 'Ardor o dolor al orinar'],
  ['vomito', 'Vómito que no se quita'],
  ['tristeza', 'Tristeza, angustia o ganas de llorar casi todos los días'],
);
const MOVIMIENTOS = op(['siempre', 'Sí, se mueve como siempre'], ['menos', 'Se mueve menos que antes'], ['aun_no', 'Todavía no lo siento']);
const tiene = (tipo: string) => (_r: Respuestas, ctx: ContextoCuestionario) => ctx.indicaciones.includes(tipo);
/** Lo que responde sobre un tema: va como texto a la historia. */
const comoTexto = (p: () => Pregunta) => (r: unknown) => `${p().texto} ${textoRespuesta(p(), r)}.`;

const preguntaAlarmas: Pregunta = {
  id: 'alarmas',
  texto: 'Desde la última consulta, ¿has tenido alguno de estos síntomas?',
  ayuda: 'Marca todos los que hayas tenido. Si no has tenido ninguno, marca "Ninguno".',
  tipo: 'multiple',
  opciones: ALARMAS,
  rutas: ['anamnesis.revisionSistemas'],
  convertir: (r) => {
    if (!Array.isArray(r)) return undefined;
    if (r.length === 0) return 'Niega signos de alarma (cuestionario de la gestante).';
    return `Refiere: ${r.map((v) => ALARMAS.find((o) => o.valor === v)?.texto.toLowerCase() ?? v).join(', ')} (cuestionario de la gestante).`;
  },
  alerta: (r) => (Array.isArray(r) ? r.map((v) => ALARMAS.find((o) => o.valor === v)?.texto ?? String(v)) : []),
};
const preguntaMovimientos: Pregunta = {
  id: 'movimientos',
  texto: '¿Sientes que tu bebé se mueve?',
  tipo: 'opciones',
  opciones: MOVIMIENTOS,
  rutas: ['anamnesis.enfermedadActual'],
  convertir: comoTexto(() => preguntaMovimientos),
  alerta: (r) => (r === 'menos' ? ['El bebé se mueve menos que antes'] : []),
};

const habito = (id: string, texto: string): Pregunta => ({
  id,
  texto,
  tipo: 'sino',
  delicada: true,
  rutas: ['observaciones'],
  convertir: (r) => `Cuestionario: ${texto} ${r === true ? 'Sí' : 'No'}.`,
  alerta: (r) => (r === true ? [texto] : []),
});

export const CUESTIONARIO_SEGUIMIENTO: SeccionCuestionario[] = [
  {
    id: 'comoEstas',
    titulo: '¿Cómo estás?',
    icono: '🙂',
    preguntas: [
      { id: 'motivo', texto: '¿Cómo te has sentido desde la última consulta? ¿Hay algo que te preocupe?', tipo: 'texto', rutas: ['anamnesis.motivoConsulta'] },
      preguntaAlarmas,
      preguntaMovimientos,
    ],
  },
  {
    id: 'medicamentos',
    titulo: 'Tus medicamentos',
    icono: '💊',
    preguntas: [
      sino('hierro', '¿Te tomas el hierro todos los días?', [], { aplica: tiene('hierro'), resumen: true }),
      sino('calcio', '¿Te tomas el calcio todos los días?', ['tomaCalcioDiario'], { aplica: tiene('calcio') }),
      sino('asa', '¿Te tomas la aspirina todos los días?', ['tomaASADiario'], { aplica: tiene('asa') }),
      sino('heparina', '¿Te aplicas la inyección para prevenir coágulos (heparina) todos los días?', ['aplicaTromboprofilaxisDiario'], { aplica: tiene('tromboprofilaxis') }),
      sino('levotiroxina', '¿Te tomas la levotiroxina todos los días, en ayunas?', [], { aplica: tiene('levotiroxina'), resumen: true }),
      { id: 'otrosMedicamentos', texto: '¿Estás tomando algún otro medicamento, vitamina o planta? ¿Cuál?', tipo: 'texto', resumen: true },
    ],
  },
  {
    id: 'bienestar',
    titulo: 'Hábitos y bienestar',
    icono: '🌱',
    preguntas: [
      habito('fuma', '¿Fumas cigarrillo?'),
      habito('alcohol', '¿Has tomado bebidas con alcohol?'),
      habito('drogas', '¿Has usado alguna droga?'),
      {
        ...habito('violencia', '¿Alguien te ha golpeado, maltratado o te hace sentir miedo?'),
        ayuda: 'Tu respuesta es confidencial. Si quieres, puedes hablarlo a solas con el profesional.',
      },
    ],
  },
  {
    id: 'vacunasParto',
    titulo: 'Vacunas y después del parto',
    icono: '💉',
    preguntas: [
      sino('tdap', '¿Ya te pusieron en este embarazo la vacuna contra la tosferina (Tdap)?', [], { resumen: true }),
      sino('vrs', '¿Ya te pusieron en este embarazo la vacuna contra el virus respiratorio sincitial (VRS)?', [], {
        resumen: true,
        ayuda: 'Se pone entre las semanas 32 y 36 y protege a tu bebé de infecciones de los pulmones en sus primeros meses.',
      }),
      {
        id: 'metodoPosparto',
        texto: 'Después del parto, ¿qué método quieres usar para no quedar embarazada pronto?',
        tipo: 'opciones',
        opciones: op(['diu_posparto', 'DIU antes de salir del hospital'], ['implante', 'Implante en el brazo'], ['hormonal', 'Pastillas o inyección'], ['barrera', 'Condón'], ['ligadura', 'Operación para no tener más hijos'], ['no_ha_decidido', 'Todavía no sé']),
        // Se registra en la historia solo después de la asesoría del profesional: aquí es un dato para conversar.
        resumen: true,
      },
      sino('mudanza', '¿Te cambiaste de casa o de municipio desde la última consulta?', [], { resumen: true }),
    ],
  },
];

export const cuestionarioDe = (tipo: TipoCuestionario): SeccionCuestionario[] => (tipo === 'seguimiento' ? CUESTIONARIO_SEGUIMIENTO : CUESTIONARIO);

/** Valor que va a la historia, o undefined si la respuesta no llena nada ("No sé", en blanco…). */
export function valorParaHistoria(p: Pregunta, respuesta: unknown, catalogo: Catalogo): unknown {
  if (respuesta === undefined || respuesta === null || respuesta === NO_SABE || respuesta === PREFIERO_HABLARLO) return undefined;
  if (typeof respuesta === 'string' && !respuesta.trim()) return undefined;
  if (p.tipo === 'municipio') return interpretarCodificado(String(respuesta), 'codigos.divipola', catalogo);
  if (p.tipo === 'aseguradora') return interpretarCodificado(String(respuesta), 'codigos.aseguradoras', catalogo);
  if (p.convertir) return p.convertir(respuesta, catalogo);
  if (Array.isArray(respuesta)) return respuesta.length ? respuesta : undefined;
  return typeof respuesta === 'string' ? respuesta.trim() : respuesta;
}
