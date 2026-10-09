// B2 / B4 — Esquema de los formularios, en el orden de la HCP y en bloques cortos.
// Un campo que no aplica (por la semana o por otra respuesta) se marca "no corresponde" solo.
import { valorDe, type Campo } from '../datos/campo';
import type { DatosPrimeraConsulta, DatosSeguimiento } from '../datos/modelo';
import { asignar, obtener } from './rutas';
import type { ListaCodificada } from '../clinico/codigos';

export interface Opcion {
  valor: string;
  etiqueta: string;
}

export type TipoCampo =
  | { tipo: 'sino' }
  | { tipo: 'numero'; unidad?: string; decimales?: boolean }
  | { tipo: 'texto'; largo?: boolean }
  | { tipo: 'correo' }
  | { tipo: 'fecha' }
  | { tipo: 'opciones'; opciones: Opcion[] }
  | { tipo: 'multiple'; opciones: Opcion[] }
  | { tipo: 'ecografia' }
  | { tipo: 'antitetanica' }
  | { tipo: 'cigarrillos' }
  | { tipo: 'residencia' }
  /** Valor calculado a partir de otros campos: se muestra, no se guarda. */
  | { tipo: 'calculado'; calcular: (datos: unknown) => string | undefined }
  /** Lista de diagnósticos con código CIE-10. */
  | { tipo: 'cie10' }
  /** Nombre con su código de una tabla oficial del catálogo (DIVIPOLA, aseguradoras). */
  | { tipo: 'codificado'; lista: ListaCodificada };

export interface ContextoFormulario {
  /** Semanas de gestación del día, si se conocen. */
  egSemanas?: number;
  /** La gestante es Rh negativo (para la anti-D en el seguimiento). */
  rhNegativo?: boolean;
  /** Edad de la gestante (persona responsable si es menor de 18 años). */
  edad?: number;
}

export interface DefCampo<D> {
  ruta: string;
  etiqueta: string;
  ayuda?: string;
  /** Dato privado: nunca va al carné. Se muestra con un aviso en el formulario. */
  privado?: boolean;
  /** Si devuelve false, el campo se oculta y queda como "no corresponde". */
  aplica?: (datos: D, ctx: ContextoFormulario) => boolean;
  control: TipoCampo;
}

export interface Bloque<D> {
  id: string;
  titulo: string;
  campos: DefCampo<D>[];
}

const sino = { tipo: 'sino' } as const;
const num = (unidad?: string, decimales = false): TipoCampo => ({ tipo: 'numero', unidad, decimales });
const fecha = { tipo: 'fecha' } as const;
const ops = (...pares: [string, string][]): Opcion[] => pares.map(([valor, etiqueta]) => ({ valor, etiqueta }));
const normalAnormal: TipoCampo = { tipo: 'opciones', opciones: ops(['normal', 'Normal'], ['anormal', 'Anormal']) };
const siNo = (c: [string, string]): DefCampo<DatosPrimeraConsulta> => ({ ruta: c[0], etiqueta: c[1], control: sino });
const es = <T>(campo: unknown, valor: T) => (campo as Campo<T> | undefined)?.estado === 'valor' && valorDe(campo as Campo<T>) === valor;

type P = DatosPrimeraConsulta;

/** Presión arterial media: (sistólica + 2 × diastólica) / 3. */
export function presionArterialMedia(pas: number | undefined, pad: number | undefined): number | undefined {
  if (pas === undefined || pad === undefined) return undefined;
  return Math.round((pas + 2 * pad) / 3);
}

/** Signos vitales con la PAM calculada. `prefijo` es la ruta del objeto que los contiene ('' o 'examenFisico.'). */
function camposSignosVitales<D>(prefijo: string): DefCampo<D>[] {
  return [
    { ruta: `${prefijo}paSistolica`, etiqueta: 'PA sistólica', control: num('mmHg') },
    { ruta: `${prefijo}paDiastolica`, etiqueta: 'PA diastólica', control: num('mmHg') },
    {
      ruta: `${prefijo}pam`,
      etiqueta: 'Presión arterial media (PAM)',
      ayuda: 'Se calcula sola: (sistólica + 2 × diastólica) / 3.',
      control: {
        tipo: 'calculado',
        calcular: (d) => {
          const pam = presionArterialMedia(
            valorDe(obtener(d, `${prefijo}paSistolica`) as Campo<number> | undefined),
            valorDe(obtener(d, `${prefijo}paDiastolica`) as Campo<number> | undefined),
          );
          return pam === undefined ? undefined : `${pam} mmHg`;
        },
      },
    },
    { ruta: `${prefijo}fcLpm`, etiqueta: 'Frecuencia cardíaca', control: num('lpm') },
    { ruta: `${prefijo}frRpm`, etiqueta: 'Frecuencia respiratoria', control: num('rpm') },
    { ruta: `${prefijo}temperaturaC`, etiqueta: 'Temperatura', control: num('°C', true) },
    { ruta: `${prefijo}saturacionPct`, etiqueta: 'Saturación de oxígeno', control: num('%') },
  ];
}

/** Anamnesis: motivo de consulta, enfermedad actual y revisión por sistemas. */
function camposAnamnesis<D>(prefijo: string): DefCampo<D>[] {
  return [
    { ruta: `${prefijo}motivoConsulta`, etiqueta: 'Motivo de consulta', ayuda: 'Con las palabras de la gestante.', control: { tipo: 'texto', largo: true } },
    { ruta: `${prefijo}enfermedadActual`, etiqueta: 'Enfermedad actual', ayuda: 'Inicio, evolución y síntomas, en orden cronológico.', control: { tipo: 'texto', largo: true } },
    {
      ruta: `${prefijo}revisionSistemas`,
      etiqueta: 'Revisión por sistemas',
      ayuda: 'Lo positivo con detalle; lo negativo en conjunto (por ejemplo, "resto sin hallazgos").',
      control: { tipo: 'texto', largo: true },
    },
  ];
}

/** Diagnósticos con CIE-10, análisis y plan de manejo. */
function camposDiagnosticoPlan<D>(prefijo: string): DefCampo<D>[] {
  return [
    { ruta: `${prefijo}diagnosticos`, etiqueta: 'Diagnósticos (CIE-10)', control: { tipo: 'cie10' } },
    { ruta: `${prefijo}analisis`, etiqueta: 'Análisis', control: { tipo: 'texto', largo: true } },
    { ruta: `${prefijo}plan`, etiqueta: 'Plan de manejo', ayuda: 'Conducta, órdenes, educación y signos de alarma explicados.', control: { tipo: 'texto', largo: true } },
  ];
}

/** Examen físico general por sistemas, en texto libre. */
function camposExamenGeneral<D>(prefijo: string): DefCampo<D>[] {
  return (
    [
      ['aspectoGeneral', 'Aspecto general'],
      ['cabezaCuello', 'Cabeza y cuello'],
      ['cardiopulmonar', 'Cardiopulmonar'],
      ['abdomen', 'Abdomen'],
      ['extremidades', 'Extremidades (edemas, várices)'],
      ['neurologico', 'Neurológico'],
      ['piel', 'Piel y mucosas'],
      ['otros', 'Otros hallazgos'],
    ] as [string, string][]
  ).map(([r, e]) => ({ ruta: `${prefijo}${r}`, etiqueta: e, control: { tipo: 'texto', largo: true } as TipoCampo }));
}

/** Asesoría en anticoncepción para después del parto: en la primera consulta y en cada control. */
function camposAnticoncepcion<D>(prefijo: string): DefCampo<D>[] {
  return [
    {
      ruta: `${prefijo}asesoriaAnticoncepcion`,
      etiqueta: 'Asesoría en anticoncepción para después del parto',
      ayuda: 'Informe todos los métodos, incluidos los que se pueden aplicar antes del alta (DIU e implante). La decisión es de ella.',
      control: sino,
    },
    {
      ruta: `${prefijo}metodoAnticonceptivoPosparto`,
      etiqueta: 'Método elegido para después del parto',
      privado: true,
      control: {
        tipo: 'opciones',
        opciones: ops(
          ['diu_posparto', 'DIU posparto (antes del alta)'],
          ['diu', 'DIU'],
          ['implante', 'Implante subdérmico'],
          ['hormonal', 'Hormonal (píldora o inyectable)'],
          ['barrera', 'Barrera'],
          ['ligadura', 'Ligadura de trompas'],
          ['natural', 'Natural'],
          ['otro', 'Otro'],
          ['ninguno', 'Ninguno'],
          ['no_ha_decidido', 'No ha decidido'],
        ),
      },
      aplica: (d) => es(obtener(d, `${prefijo}asesoriaAnticoncepcion`), true),
    },
  ];
}

export const BLOQUES_PRIMERA: Bloque<P>[] = [
  {
    id: 'identificacion',
    titulo: 'Identificación',
    campos: [
      { ruta: 'identificacion.domicilio', etiqueta: 'Domicilio (dirección, barrio o vereda)', control: { tipo: 'texto' } },
      {
        ruta: 'identificacion.municipio',
        etiqueta: 'Municipio de residencia',
        ayuda: 'Con su código DIVIPOLA. Si no aparece en la lista, escriba "Nombre (código)", por ejemplo "Soacha (25754)".',
        control: { tipo: 'codificado', lista: 'codigos.divipola' },
      },
      {
        ruta: 'identificacion.altitudM',
        etiqueta: 'Altitud de residencia',
        ayuda: 'Metros sobre el nivel del mar. Se usa para ajustar la hemoglobina (OMS 2024).',
        control: num('m s. n. m.'),
      },
      { ruta: 'identificacion.zonaEndemicaChagas', etiqueta: 'Vive en zona endémica de Chagas', control: sino },
      { ruta: 'identificacion.zonaEndemicaMalaria', etiqueta: 'Vive en zona endémica de malaria', control: sino },
      { ruta: 'identificacion.telefono', etiqueta: 'Teléfono / WhatsApp', control: { tipo: 'texto' } },
      {
        ruta: 'identificacion.correo',
        etiqueta: 'Correo electrónico',
        ayuda: 'Opcional: solo si la gestante lo usa y lo revisa.',
        control: { tipo: 'correo' },
      },
      {
        ruta: 'identificacion.etnia',
        etiqueta: 'Etnia (autoidentificación)',
        control: { tipo: 'opciones', opciones: ops(['blanca', 'Blanca'], ['indigena', 'Indígena'], ['mestiza', 'Mestiza'], ['negra', 'Negra'], ['otra', 'Otra']) },
      },
      { ruta: 'identificacion.alfabeta', etiqueta: 'Alfabeta', control: sino },
      {
        ruta: 'identificacion.estudios',
        etiqueta: 'Estudios',
        control: { tipo: 'opciones', opciones: ops(['ninguno', 'Ninguno'], ['primaria', 'Primaria'], ['secundaria', 'Secundaria'], ['universitaria', 'Universitaria']) },
      },
      {
        ruta: 'identificacion.aniosMayorNivel',
        etiqueta: 'Años en el mayor nivel',
        control: num('años'),
        aplica: (d) => !es(d.identificacion.estudios, 'ninguno'),
      },
      {
        ruta: 'identificacion.estadoCivil',
        etiqueta: 'Estado civil',
        control: { tipo: 'opciones', opciones: ops(['casada', 'Casada'], ['union_estable', 'Unión estable'], ['soltera', 'Soltera'], ['otro', 'Otro']) },
      },
      { ruta: 'identificacion.viveSola', etiqueta: 'Vive sola', control: sino },
      { ruta: 'identificacion.ocupacion', etiqueta: 'Ocupación', control: { tipo: 'texto' } },
      {
        ruta: 'identificacion.aseguradora',
        etiqueta: 'Aseguradora (EPS)',
        ayuda: 'Con su código. Si no aparece en la lista, escriba "Nombre (código)".',
        control: { tipo: 'codificado', lista: 'codigos.aseguradoras' },
      },
      {
        ruta: 'identificacion.regimen',
        etiqueta: 'Régimen de afiliación',
        control: {
          tipo: 'opciones',
          opciones: ops(['contributivo', 'Contributivo'], ['subsidiado', 'Subsidiado'], ['especial', 'Especial'], ['excepcion', 'De excepción'], ['no_afiliada', 'No afiliada']),
        },
      },
      { ruta: 'identificacion.acompananteNombre', etiqueta: 'Acompañante: nombre', ayuda: 'Si viene sola, marque "No corresponde".', control: { tipo: 'texto' } },
      { ruta: 'identificacion.acompananteParentesco', etiqueta: 'Acompañante: parentesco', control: { tipo: 'texto' } },
      { ruta: 'identificacion.acompananteTelefono', etiqueta: 'Acompañante: teléfono', control: { tipo: 'texto' } },
      ...(
        [
          ['responsableNombre', 'Persona responsable: nombre'],
          ['responsableParentesco', 'Persona responsable: parentesco'],
          ['responsableTelefono', 'Persona responsable: teléfono'],
        ] as [string, string][]
      ).map(([r, e]): DefCampo<P> => ({
        ruta: `identificacion.${r}`,
        etiqueta: e,
        ayuda: 'Para gestantes menores de 18 años.',
        control: { tipo: 'texto' },
        aplica: (_d, ctx) => ctx.edad === undefined || ctx.edad < 18,
      })),
    ],
  },
  {
    id: 'anamnesis',
    titulo: 'Motivo de consulta, enfermedad actual y revisión por sistemas',
    campos: camposAnamnesis<P>('anamnesis.'),
  },
  {
    id: 'gestacion',
    titulo: 'Gestación actual',
    campos: [
      { ruta: 'gestacionActual.pesoAnteriorKg', etiqueta: 'Peso anterior', control: num('kg', true) },
      { ruta: 'gestacionActual.tallaCm', etiqueta: 'Talla', control: num('cm') },
      { ruta: 'gestacionActual.fum', etiqueta: 'FUM', control: fecha },
      { ruta: 'gestacionActual.egConfiablePorFum', etiqueta: 'EG confiable por FUM', control: sino },
      { ruta: 'gestacionActual.ecografia', etiqueta: 'Ecografía (fecha y EG)', control: { tipo: 'ecografia' } },
      { ruta: 'gestacionActual.egConfiablePorEco', etiqueta: 'EG confiable por eco', control: sino },
      { ruta: 'planificacion.embarazoPlaneado', etiqueta: 'Embarazo planeado', control: sino },
      {
        ruta: 'planificacion.fracasoMetodo',
        etiqueta: 'Fracaso de método anticonceptivo',
        control: {
          tipo: 'opciones',
          opciones: ops(['no_usaba', 'No usaba'], ['barrera', 'Barrera'], ['diu', 'DIU'], ['hormonal', 'Hormonal'], ['emergencia', 'Emergencia'], ['natural', 'Natural']),
        },
      },
      {
        ruta: 'planificacion.deseaContinuar',
        etiqueta: '¿Desea continuar el embarazo?',
        ayuda: 'Ofrezca un momento a solas antes de preguntar. Si no desea o no ha decidido, se abre "Opciones y derechos".',
        privado: true,
        control: { tipo: 'opciones', opciones: ops(['si', 'Sí'], ['no', 'No'], ['no_ha_decidido', 'No ha decidido']) },
        aplica: (d) => es(d.planificacion.embarazoPlaneado, false),
      },
      ...camposAnticoncepcion<P>('planificacion.'),
      { ruta: 'gestacionActual.fumaActivo', etiqueta: 'Fuma (tabaco activo)', control: sino },
      {
        ruta: 'gestacionActual.cigarrillosDia',
        etiqueta: 'Cigarrillos al día',
        ayuda: 'Se usa para ajustar la hemoglobina (OMS 2024).',
        control: { tipo: 'cigarrillos' },
        aplica: (d) => es(d.gestacionActual.fumaActivo, true),
      },
      { ruta: 'gestacionActual.fumaPasivo', etiqueta: 'Tabaco pasivo', control: sino },
      { ruta: 'gestacionActual.drogas', etiqueta: 'Drogas', privado: true, control: sino },
      { ruta: 'gestacionActual.alcohol', etiqueta: 'Alcohol', privado: true, control: sino },
      {
        ruta: 'gestacionActual.violencia',
        etiqueta: 'Violencia',
        ayuda: 'Ofrezca un momento a solas antes de preguntar.',
        privado: true,
        control: sino,
      },
      {
        ruta: 'gestacionActual.violenciaSexual',
        etiqueta: 'Violencia sexual',
        privado: true,
        control: sino,
        aplica: (d) => es(d.gestacionActual.violencia, true),
      },
      {
        ruta: 'gestacionActual.grupo',
        etiqueta: 'Grupo sanguíneo (declarado)',
        ayuda: 'La hemoclasificación de laboratorio se pide a todas las gestantes y, cuando llega, reemplaza lo declarado.',
        control: { tipo: 'opciones', opciones: ops(['A', 'A'], ['B', 'B'], ['AB', 'AB'], ['O', 'O']) },
      },
      { ruta: 'gestacionActual.rh', etiqueta: 'Rh (declarado)', control: { tipo: 'opciones', opciones: ops(['+', 'Positivo'], ['-', 'Negativo']) } },
      {
        ruta: 'gestacionActual.inmunizada',
        etiqueta: 'Inmunizada (Rh)',
        control: sino,
        aplica: (d) => es(d.gestacionActual.rh, '-'),
      },
    ],
  },
  {
    id: 'personales',
    titulo: 'Antecedentes personales, obstétricos y vacunas',
    campos: [
      siNo(['antecedentesPersonales.tbc', 'TBC']),
      {
        ruta: 'antecedentesPersonales.diabetes',
        etiqueta: 'Diabetes',
        control: { tipo: 'opciones', opciones: ops(['no', 'No'], ['tipo1', 'Tipo 1'], ['tipo2', 'Tipo 2'], ['gestacional', 'Gestacional']) },
      },
      ...(
        [
          ['hipertension', 'Hipertensión'],
          ['preeclampsia', 'Preeclampsia'],
          ['eclampsia', 'Eclampsia'],
          ['otraCondicionGrave', 'Otra condición médica grave'],
          ['cirugiaGenitoUrinaria', 'Cirugía genito-urinaria'],
          ['infertilidad', 'Infertilidad'],
          ['cardiopatia', 'Cardiopatía'],
          ['nefropatia', 'Nefropatía'],
        ] as [string, string][]
      ).map(([r, e]) => siNo([`antecedentesPersonales.${r}`, e])),
      {
        ruta: 'antecedentesPersonales.tiroides',
        etiqueta: 'Enfermedad tiroidea',
        control: {
          tipo: 'opciones',
          opciones: ops(
            ['no', 'No'],
            ['hipotiroidismo_primario', 'Hipotiroidismo (Hashimoto u otro)'],
            ['hipotiroidismo_ablacion', 'Hipotiroidismo por cirugía o yodo radiactivo'],
            ['hipertiroidismo', 'Hipertiroidismo o enfermedad de Graves'],
            ['bocio_nodulos', 'Bocio o nódulos tiroideos'],
          ),
        },
      },
      { ruta: 'antecedentesPersonales.antiTpoPrevios', etiqueta: 'Anticuerpos antitiroideos (anti-TPO) positivos conocidos', control: sino },
      { ruta: 'antecedentesPersonales.violencia', etiqueta: 'Violencia', privado: true, control: sino },
      { ruta: 'antecedentesPersonales.quirurgicos', etiqueta: 'Antecedentes quirúrgicos', ayuda: 'Cirugías y año. Si no tiene, escriba "Ninguno".', control: { tipo: 'texto', largo: true } },
      { ruta: 'antecedentesPersonales.alergias', etiqueta: 'Alergias', control: sino },
      {
        ruta: 'antecedentesPersonales.alergiasCuales',
        etiqueta: '¿A qué es alérgica?',
        control: { tipo: 'texto' },
        aplica: (d) => es(d.antecedentesPersonales.alergias, true),
      },
      { ruta: 'antecedentesPersonales.medicamentosActuales', etiqueta: 'Medicamentos que toma actualmente', control: { tipo: 'texto', largo: true } },
      { ruta: 'antecedentesPersonales.transfusiones', etiqueta: 'Transfusiones previas', control: sino },
      { ruta: 'antecedentesPersonales.menarquiaEdad', etiqueta: 'Menarquia (edad)', control: num('años') },
      { ruta: 'antecedentesPersonales.ciclos', etiqueta: 'Ciclos menstruales', control: { tipo: 'opciones', opciones: ops(['regulares', 'Regulares'], ['irregulares', 'Irregulares']) } },
      { ruta: 'antecedentesPersonales.inicioVidaSexualEdad', etiqueta: 'Inicio de vida sexual (edad)', privado: true, control: num('años') },
      { ruta: 'antecedentesPersonales.itsPrevias', etiqueta: 'Infecciones de transmisión sexual previas', privado: true, control: sino },
      { ruta: 'antecedentesObstetricos.gestas', etiqueta: 'Gestas previas', control: num() },
      { ruta: 'antecedentesObstetricos.partosVaginales', etiqueta: 'Partos vaginales', control: num() },
      { ruta: 'antecedentesObstetricos.cesareas', etiqueta: 'Cesáreas', control: num() },
      { ruta: 'antecedentesObstetricos.abortos', etiqueta: 'Abortos', control: num() },
      {
        ruta: 'antecedentesObstetricos.tresEspontaneosConsecutivos',
        etiqueta: '3 abortos espontáneos consecutivos',
        control: sino,
        aplica: (d) => (valorDe(d.antecedentesObstetricos.abortos) ?? 0) >= 3,
      },
      { ruta: 'antecedentesObstetricos.ectopicos', etiqueta: 'Embarazos ectópicos', control: num() },
      { ruta: 'antecedentesObstetricos.nacidosVivos', etiqueta: 'Nacidos vivos', control: num() },
      { ruta: 'antecedentesObstetricos.nacidosMuertos', etiqueta: 'Nacidos muertos', control: num() },
      { ruta: 'antecedentesObstetricos.viven', etiqueta: 'Viven', control: num() },
      { ruta: 'antecedentesObstetricos.muertosPrimeraSemana', etiqueta: 'Muertos en la 1.ª semana', control: num() },
      { ruta: 'antecedentesObstetricos.muertosDespuesPrimeraSemana', etiqueta: 'Muertos después de la 1.ª semana', control: num() },
      {
        ruta: 'antecedentesObstetricos.pesoUltimoRNg',
        etiqueta: 'Peso del último RN',
        control: num('g'),
        aplica: (d) => (valorDe(d.antecedentesObstetricos.gestas) ?? 0) > 0,
      },
      {
        ruta: 'antecedentesObstetricos.gemelares',
        etiqueta: 'Antecedente de gemelares',
        control: sino,
        aplica: (d) => (valorDe(d.antecedentesObstetricos.gestas) ?? 0) > 0,
      },
      {
        ruta: 'antecedentesObstetricos.finEmbarazoAnterior',
        etiqueta: 'Fin del embarazo anterior',
        control: fecha,
        aplica: (d) => (valorDe(d.antecedentesObstetricos.gestas) ?? 0) > 0,
      },
      {
        ruta: 'gestacionActual.antirrubeola',
        etiqueta: 'Antirrubéola',
        control: { tipo: 'opciones', opciones: ops(['previa', 'Previa'], ['embarazo', 'En el embarazo'], ['no', 'No'], ['no_sabe', 'No sabe']) },
      },
      {
        ruta: 'gestacionActual.antivaricela',
        etiqueta: 'Vacuna contra la varicela',
        ayuda: 'Sin antecedente de vacuna se pide la IgG para varicela zóster.',
        control: { tipo: 'opciones', opciones: ops(['previa', 'Previa'], ['no', 'No'], ['no_sabe', 'No sabe']) },
      },
      { ruta: 'gestacionActual.antitetanica', etiqueta: 'Antitetánica', control: { tipo: 'antitetanica' } },
    ],
  },
  {
    id: 'familiares',
    titulo: 'Antecedentes familiares',
    campos: (
      [
        ['tbc', 'TBC'],
        ['diabetes', 'Diabetes'],
        ['hipertension', 'Hipertensión'],
        ['preeclampsia', 'Preeclampsia'],
        ['eclampsia', 'Eclampsia'],
        ['otraCondicionGrave', 'Otra condición médica grave'],
        ['trombosis', 'Trombosis sin causa o asociada a hormonas en familiar de primer grado'],
      ] as [string, string][]
    ).map(([r, e]) => siNo([`antecedentesFamiliares.${r}`, e])),
  },
  {
    id: 'preeclampsia',
    titulo: 'Riesgo de preeclampsia',
    campos: (
      [
        ['trastornoHipertensivoPrevio', 'Trastorno hipertensivo en un embarazo anterior'],
        ['enfermedadRenalCronica', 'Enfermedad renal crónica'],
        ['autoinmune', 'Enfermedad autoinmune (lupus, síndrome antifosfolípido)'],
        ['diabetes1o2', 'Diabetes tipo 1 o 2'],
        ['hipertensionCronica', 'Hipertensión crónica'],
        ['antecedenteFamiliarPreeclampsia', 'Antecedente familiar de preeclampsia'],
        ['embarazoMultiple', 'Embarazo múltiple'],
        ['alergiaASAoAINE', 'Alergia al ASA o a los AINE'],
        ['asmaQueEmpeoraConAINE', 'Asma que empeora con ASA o AINE'],
        ['fertilizacionInVitro', 'Embarazo por fertilización in vitro o reproducción asistida'],
      ] as [string, string][]
    ).map(([r, e]) => siNo([`riesgoPreeclampsia.${r}`, e])),
  },
  {
    id: 'calcio',
    titulo: 'Antecedentes y medicamentos para el calcio',
    campos: (
      [
        ['hipercalcemia', 'Hipercalcemia'],
        ['hipercalciuria', 'Hipercalciuria'],
        ['hiperparatiroidismo', 'Hiperparatiroidismo'],
        ['nefrolitiasisONefrocalcinosis', 'Cálculos renales o nefrocalcinosis'],
        ['erCronicaGrave', 'Enfermedad renal crónica grave'],
        ['hipersensibilidadCalcio', 'Hipersensibilidad a productos con calcio'],
        ['sarcoidosis', 'Sarcoidosis'],
        ['tiazidas', 'Toma diuréticos tiazídicos'],
        ['digoxina', 'Toma digoxina'],
        ['levotiroxina', 'Toma levotiroxina'],
        ['antiacidosConCalcioFrecuentes', 'Usa antiácidos con calcio con frecuencia'],
        ['vomitoPersistente', 'Vómito persistente'],
      ] as [string, string][]
    )
      .map(([r, e]) => siNo([`antecedentesCalcio.${r}`, e]))
      .flatMap((c) =>
        c.ruta === 'antecedentesCalcio.levotiroxina'
          ? [
              c,
              {
                ruta: 'antecedentesPersonales.levotiroxinaUgDia',
                etiqueta: 'Dosis de levotiroxina antes del embarazo',
                ayuda: 'Para proponer el ajuste de dosis al confirmar el embarazo.',
                control: num('µg al día'),
                aplica: (d: P) => es(d.antecedentesCalcio.levotiroxina, true),
              },
            ]
          : [c],
      ),
  },
  {
    id: 'trombotico',
    titulo: 'Riesgo trombótico',
    campos: [
      { ruta: 'riesgoTrombotico.trombosisPrevia', etiqueta: 'Trombosis venosa o embolia previa', control: sino },
      {
        ruta: 'riesgoTrombotico.causaTrombosisPrevia',
        etiqueta: 'Causa de la trombosis previa',
        control: {
          tipo: 'opciones',
          opciones: ops(['sin_causa', 'Sin causa'], ['hormonal', 'Asociada a hormonas'], ['cirugia_mayor', 'Asociada a cirugía mayor'], ['otro_resuelto', 'Otro factor ya resuelto']),
        },
        aplica: (d) => es(d.riesgoTrombotico.trombosisPrevia, true),
      },
      {
        ruta: 'riesgoTrombotico.trombofilias',
        etiqueta: 'Trombofilia conocida',
        ayuda: 'Alto riesgo: déficit de antitrombina, proteína C o S; homocigotas; doble heterocigota.',
        control: {
          tipo: 'multiple',
          opciones: ops(
            ['deficitAntitrombina', 'Déficit de antitrombina'],
            ['deficitProteinaC', 'Déficit de proteína C'],
            ['deficitProteinaS', 'Déficit de proteína S'],
            ['factorVLeidenHomocigota', 'Factor V Leiden homocigota'],
            ['protrombinaHomocigota', 'Mutación de protrombina homocigota'],
            ['dobleHeterocigota', 'Doble heterocigota'],
            ['factorVLeidenHeterocigota', 'Factor V Leiden heterocigota'],
            ['protrombinaHeterocigota', 'Mutación de protrombina heterocigota'],
            ['anticuerposAntifosfolipidos', 'Anticuerpos antifosfolípidos'],
          ),
        },
      },
      { ruta: 'riesgoTrombotico.varicesGruesas', etiqueta: 'Várices gruesas', control: sino },
      {
        ruta: 'riesgoTrombotico.comorbilidades',
        etiqueta: 'Comorbilidades de alto riesgo',
        control: {
          tipo: 'multiple',
          opciones: ops(
            ['cancer', 'Cáncer'],
            ['insuficienciaCardiaca', 'Insuficiencia cardíaca'],
            ['lupusActivo', 'Lupus activo'],
            ['poliartropatiaInflamatoria', 'Poliartropatía inflamatoria'],
            ['enfermedadInflamatoriaIntestinal', 'Enfermedad inflamatoria intestinal'],
            ['sindromeNefrotico', 'Síndrome nefrótico'],
            ['diabetes1ConNefropatia', 'Diabetes tipo 1 con nefropatía'],
            ['drepanocitosis', 'Drepanocitosis'],
            ['drogasIntravenosas', 'Uso actual de drogas intravenosas'],
          ),
        },
      },
      {
        ruta: 'riesgoTrombotico.factoresSangrado',
        etiqueta: 'Factores de riesgo de sangrado',
        control: {
          tipo: 'multiple',
          opciones: ops(
            ['sangradoActivoAntenatal', 'Sangrado activo antenatal'],
            ['riesgoHemorragiaMayor', 'Riesgo aumentado de hemorragia mayor (ej. placenta previa)'],
            ['trastornoHemorragico', 'Trastorno hemorrágico (von Willebrand, hemofilia, coagulopatía)'],
            ['acvUltimas4Semanas', 'ACV en las últimas 4 semanas'],
            ['enfermedadRenalGrave', 'Enfermedad renal grave'],
            ['enfermedadHepaticaGrave', 'Enfermedad hepática grave'],
            ['hipertensionNoControlada', 'Hipertensión no controlada'],
            ['trombocitopenia', 'Trombocitopenia (plaquetas < 75 × 10⁹/L)'],
            ['alergiaOTrombocitopeniaPorHeparina', 'Alergia o trombocitopenia inducida por heparina'],
          ),
        },
      },
    ],
  },
  {
    id: 'examenFisico',
    titulo: 'Examen físico',
    campos: [
      { ruta: 'examenFisico.pesoKg', etiqueta: 'Peso de hoy', ayuda: 'Para el IMC por edad gestacional (curva de Atalah).', control: num('kg', true) },
      ...camposSignosVitales<P>('examenFisico.'),
      { ruta: 'examenFisico.alturaUterinaCm', etiqueta: 'Altura uterina', control: num('cm') },
      { ruta: 'examenFisico.fcfLpm', etiqueta: 'Frecuencia cardíaca fetal (FCF)', control: num('lpm') },
      { ruta: 'examenFisico.movimientosFetales', etiqueta: 'Movimientos fetales verificados', control: sino },
      ...camposExamenGeneral<P>('examenFisico.general.'),
      { ruta: 'gestacionActual.examenOdontologico', etiqueta: 'Examen odontológico', control: normalAnormal },
      { ruta: 'gestacionActual.examenMamas', etiqueta: 'Examen de mamas', control: normalAnormal },
      {
        ruta: 'gestacionActual.cervixPap',
        etiqueta: 'Citología cervicovaginal',
        ayuda: 'Según el esquema de tamizaje vigente. La inspección visual del cérvix no se hace de rutina.',
        control: normalAnormal,
      },
      {
        ruta: 'gestacionActual.cervixColposcopia',
        etiqueta: 'Colposcopia',
        control: normalAnormal,
        aplica: (d) => es(d.gestacionActual.cervixPap, 'anormal'),
      },
    ],
  },
  // Sin campos propios: el bloque muestra la sección de resultados (SeccionLaboratorios).
  { id: 'laboratorios', titulo: 'Laboratorios y ecografías', campos: [] },
  {
    id: 'diagnostico',
    titulo: 'Plan y órdenes',
    campos: camposDiagnosticoPlan<P>('diagnosticoPlan.'),
  },
];

type S = DatosSeguimiento;

export const BLOQUES_SEGUIMIENTO: Bloque<S>[] = [
  {
    id: 'control',
    titulo: 'Control',
    campos: [
      ...camposAnamnesis<S>('anamnesis.'),
      { ruta: 'diagnosticoPreeclampsia', etiqueta: 'Diagnóstico de preeclampsia en este control', control: sino },
      { ruta: 'observaciones', etiqueta: 'Observaciones (notas internas)', privado: true, control: { tipo: 'texto', largo: true } },
      {
        ruta: 'cambioResidencia',
        etiqueta: 'Cambio de residencia',
        ayuda: 'Solo si se mudó: la anemia se reclasifica desde este control.',
        control: { tipo: 'residencia' },
      },
    ],
  },
  {
    id: 'examenFisico',
    titulo: 'Examen físico',
    campos: [
      ...camposSignosVitales<S>(''),
      { ruta: 'pesoKg', etiqueta: 'Peso', control: num('kg', true) },
      { ruta: 'alturaUterinaCm', etiqueta: 'Altura uterina', control: num('cm') },
      {
        ruta: 'presentacion',
        etiqueta: 'Presentación',
        control: { tipo: 'opciones', opciones: ops(['cefalica', 'Cefálica'], ['pelviana', 'Pelviana'], ['transversa', 'Transversa']) },
        aplica: (_d, ctx) => ctx.egSemanas === undefined || ctx.egSemanas >= 28,
      },
      { ruta: 'fcfLpm', etiqueta: 'Frecuencia cardíaca fetal (FCF)', control: num('lpm') },
      { ruta: 'movimientosFetales', etiqueta: 'Movimientos fetales verificados', control: sino },
      ...camposExamenGeneral<S>('examenGeneral.'),
    ],
  },
  {
    id: 'adherencia',
    titulo: 'Adherencia y vacunas',
    campos: [
      { ruta: 'tdapAplicada', etiqueta: 'Vacuna Tdap (tosferina) aplicada hoy', ayuda: 'Desde la semana 26, en cada embarazo.', control: sino },
      {
        ruta: 'antiDAplicada',
        etiqueta: 'Inmunoglobulina anti-D aplicada hoy',
        ayuda: 'Rh negativo no sensibilizada: semana 28, y después de sangrado, trauma o procedimientos invasivos.',
        control: sino,
        aplica: (_d, ctx) => ctx.rhNegativo === true,
      },
      { ruta: 'tomaCalcioDiario', etiqueta: '¿Toma el calcio todos los días?', control: sino },
      {
        ruta: 'tomaASADiario',
        etiqueta: '¿Toma la aspirina todos los días?',
        ayuda: 'Va hasta la semana 36.',
        control: sino,
        aplica: (_d, ctx) => ctx.egSemanas === undefined || ctx.egSemanas < 36,
      },
      { ruta: 'aplicaTromboprofilaxisDiario', etiqueta: '¿Se aplica la tromboprofilaxis todos los días?', control: sino },
    ],
  },
  {
    id: 'anticoncepcion',
    titulo: 'Tabaco, alcohol y anticoncepción',
    campos: [
      {
        ruta: 'tamizajeTrimestral',
        etiqueta: 'Se preguntó en este trimestre por tabaco, alcohol y violencia',
        ayuda: 'Ofrezca un momento a solas.',
        control: sino,
      },
      ...camposAnticoncepcion<S>(''),
    ],
  },
  {
    id: 'laboratorios',
    titulo: 'Laboratorios y ecografías',
    campos: [
      {
        ruta: 'proteinuria',
        etiqueta: 'Proteinuria en tira reactiva (de hoy)',
        control: { tipo: 'opciones', opciones: ops(['negativa', 'Negativa'], ['trazas', 'Trazas'], ['1+', '1+'], ['2+', '2+'], ['3+', '3+']) },
      },
    ],
  },
  {
    id: 'diagnostico',
    titulo: 'Plan y órdenes',
    campos: camposDiagnosticoPlan<S>('diagnosticoPlan.'),
  },
];

/** Campos que se guardan (los calculados solo se muestran). */
function camposDe<D>(bloques: Bloque<D>[]): DefCampo<D>[] {
  return bloques.flatMap((b) => b.campos).filter((c) => c.control.tipo !== 'calculado');
}

function vaciaDesde<D>(bloques: Bloque<D>[]): D {
  return camposDe(bloques).reduce<D>((datos, c) => asignar(datos, c.ruta, { estado: 'vacio' }), {} as D);
}

export const primeraConsultaVacia = (): P => vaciaDesde(BLOQUES_PRIMERA);
export const seguimientoVacio = (): S => vaciaDesde(BLOQUES_SEGUIMIENTO);

/**
 * Marca "no corresponde" lo que no aplica. Si se pasa `antes` y un campo vuelve a aplicar
 * (por ejemplo, al corregir "embarazo planeado"), lo devuelve a vacío. Un "no corresponde"
 * que el profesional marcó a mano en un campo que sí aplica se respeta.
 */
export function aplicarNoCorresponde<D>(bloques: Bloque<D>[], datos: D, ctx: ContextoFormulario, antes?: D): D {
  return camposDe(bloques).reduce<D>((acc, c) => {
    if (!c.aplica) return acc;
    const actual = obtener(acc, c.ruta) as Campo<unknown> | undefined;
    const aplica = c.aplica(acc, ctx);
    if (!aplica) return actual?.estado === 'no_corresponde' ? acc : asignar(acc, c.ruta, { estado: 'no_corresponde' });
    const aplicabaAntes = antes === undefined || c.aplica(antes, ctx);
    if (!aplicabaAntes && actual?.estado === 'no_corresponde') return asignar(acc, c.ruta, { estado: 'vacio' });
    return acc;
  }, datos);
}

export function etiquetaDe<D>(bloques: Bloque<D>[], ruta: string): string {
  return camposDe(bloques).find((c) => c.ruta === ruta)?.etiqueta ?? ruta;
}
