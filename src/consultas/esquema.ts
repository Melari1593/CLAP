// B2 / B4 — Esquema de los formularios, en el orden de la HCP y en bloques cortos.
// Un campo que no aplica (por la semana o por otra respuesta) se marca "no corresponde" solo.
import { valorDe, type Campo } from '../datos/campo';
import type { DatosPrimeraConsulta, DatosSeguimiento } from '../datos/modelo';
import { asignar, obtener } from './rutas';

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
  | { tipo: 'residencia' };

export interface ContextoFormulario {
  /** Semanas de gestación del día, si se conocen. */
  egSemanas?: number;
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

export const BLOQUES_PRIMERA: Bloque<P>[] = [
  {
    id: 'identificacion',
    titulo: 'Identificación',
    campos: [
      { ruta: 'identificacion.domicilio', etiqueta: 'Domicilio', control: { tipo: 'texto' } },
      { ruta: 'identificacion.municipio', etiqueta: 'Municipio de residencia (vereda o barrio)', control: { tipo: 'texto' } },
      {
        ruta: 'identificacion.altitudM',
        etiqueta: 'Altitud de residencia',
        ayuda: 'Metros sobre el nivel del mar. Se usa para ajustar la hemoglobina (OMS 2024).',
        control: num('m s. n. m.'),
      },
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
    id: 'personales',
    titulo: 'Antecedentes personales',
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
      { ruta: 'antecedentesPersonales.violencia', etiqueta: 'Violencia', privado: true, control: sino },
    ],
  },
  {
    id: 'obstetricos',
    titulo: 'Antecedentes obstétricos',
    campos: [
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
    ],
  },
  {
    id: 'planificacion',
    titulo: 'Embarazo planeado',
    campos: [
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
    ],
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
    ).map(([r, e]) => siNo([`antecedentesCalcio.${r}`, e])),
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
    id: 'gestacion',
    titulo: 'Gestación actual',
    campos: [
      { ruta: 'gestacionActual.pesoAnteriorKg', etiqueta: 'Peso anterior', control: num('kg', true) },
      { ruta: 'gestacionActual.tallaCm', etiqueta: 'Talla', control: num('cm') },
      { ruta: 'gestacionActual.fum', etiqueta: 'FUM', control: fecha },
      { ruta: 'gestacionActual.egConfiablePorFum', etiqueta: 'EG confiable por FUM', control: sino },
      { ruta: 'gestacionActual.ecografia', etiqueta: 'Ecografía (fecha y EG)', control: { tipo: 'ecografia' } },
      { ruta: 'gestacionActual.egConfiablePorEco', etiqueta: 'EG confiable por eco', control: sino },
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
        ruta: 'gestacionActual.antirrubeola',
        etiqueta: 'Antirrubéola',
        control: { tipo: 'opciones', opciones: ops(['previa', 'Previa'], ['embarazo', 'En el embarazo'], ['no', 'No'], ['no_sabe', 'No sabe']) },
      },
      { ruta: 'gestacionActual.antitetanica', etiqueta: 'Antitetánica', control: { tipo: 'antitetanica' } },
      { ruta: 'gestacionActual.examenOdontologico', etiqueta: 'Examen odontológico', control: normalAnormal },
      { ruta: 'gestacionActual.examenMamas', etiqueta: 'Examen de mamas', control: normalAnormal },
      { ruta: 'gestacionActual.cervixInspeccion', etiqueta: 'Cérvix: inspección visual', control: normalAnormal },
      { ruta: 'gestacionActual.cervixPap', etiqueta: 'Cérvix: PAP', control: normalAnormal },
      { ruta: 'gestacionActual.cervixColposcopia', etiqueta: 'Cérvix: colposcopia', control: normalAnormal },
      {
        ruta: 'gestacionActual.grupo',
        etiqueta: 'Grupo sanguíneo',
        control: { tipo: 'opciones', opciones: ops(['A', 'A'], ['B', 'B'], ['AB', 'AB'], ['O', 'O']) },
      },
      { ruta: 'gestacionActual.rh', etiqueta: 'Rh', control: { tipo: 'opciones', opciones: ops(['+', 'Positivo'], ['-', 'Negativo']) } },
      {
        ruta: 'gestacionActual.inmunizada',
        etiqueta: 'Inmunizada (Rh)',
        control: sino,
        aplica: (d) => es(d.gestacionActual.rh, '-'),
      },
    ],
  },
];

type S = DatosSeguimiento;

export const BLOQUES_SEGUIMIENTO: Bloque<S>[] = [
  {
    id: 'control',
    titulo: 'Control',
    campos: [
      { ruta: 'pesoKg', etiqueta: 'Peso', control: num('kg', true) },
      { ruta: 'paSistolica', etiqueta: 'PA sistólica', control: num('mmHg') },
      { ruta: 'paDiastolica', etiqueta: 'PA diastólica', control: num('mmHg') },
      { ruta: 'alturaUterinaCm', etiqueta: 'Altura uterina', control: num('cm') },
      {
        ruta: 'presentacion',
        etiqueta: 'Presentación',
        control: { tipo: 'opciones', opciones: ops(['cefalica', 'Cefálica'], ['pelviana', 'Pelviana'], ['transversa', 'Transversa']) },
        aplica: (_d, ctx) => ctx.egSemanas === undefined || ctx.egSemanas >= 28,
      },
      { ruta: 'fcfLpm', etiqueta: 'FCF', control: num('lpm') },
      { ruta: 'movimientosFetales', etiqueta: 'Movimientos fetales', control: sino },
      {
        ruta: 'proteinuria',
        etiqueta: 'Proteinuria',
        control: { tipo: 'opciones', opciones: ops(['negativa', 'Negativa'], ['trazas', 'Trazas'], ['1+', '1+'], ['2+', '2+'], ['3+', '3+']) },
      },
      {
        ruta: 'tamizajeTrimestral',
        etiqueta: 'Se preguntó en este trimestre por tabaco, alcohol y violencia',
        ayuda: 'Ofrezca un momento a solas.',
        control: sino,
      },
      { ruta: 'diagnosticoPreeclampsia', etiqueta: 'Diagnóstico de preeclampsia en este control', control: sino },
      { ruta: 'observaciones', etiqueta: 'Observaciones (notas internas)', privado: true, control: { tipo: 'texto', largo: true } },
      { ruta: 'iniciales', etiqueta: 'Iniciales del profesional', control: { tipo: 'texto' } },
      {
        ruta: 'cambioResidencia',
        etiqueta: 'Cambio de residencia',
        ayuda: 'Solo si se mudó: la anemia se reclasifica desde este control.',
        control: { tipo: 'residencia' },
      },
    ],
  },
  {
    id: 'adherencia',
    titulo: 'Adherencia',
    campos: [
      { ruta: 'tomaCalcioDiario', etiqueta: '¿Toma el calcio todos los días?', control: sino },
      { ruta: 'tomaASADiario', etiqueta: '¿Toma la aspirina todos los días?', control: sino },
      { ruta: 'aplicaTromboprofilaxisDiario', etiqueta: '¿Se aplica la tromboprofilaxis todos los días?', control: sino },
    ],
  },
];

function camposDe<D>(bloques: Bloque<D>[]): DefCampo<D>[] {
  return bloques.flatMap((b) => b.campos);
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
