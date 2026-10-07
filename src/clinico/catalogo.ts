// A1 — Catálogo único de parámetros clínicos.
// Las reglas leen sus valores de aquí; ningún valor clínico se quema en el código de las reglas.
// Un parámetro "pendiente" se puede usar, pero la app avisa internamente que no está validado.

export type Fuente =
  | 'CLAP 2007'
  | 'OMS 2024'
  | 'OMS (IMC adultos)'
  | 'ASH 2026'
  | 'RCOG 37a + declaración de posición'
  | 'GPC Colombia 2013'
  | 'Fichas técnicas de carbonato de calcio'
  | 'Sentencia C-355 de 2006'
  | 'Sentencia SU-096 de 2018'
  | 'Sentencia C-055 de 2022'
  | 'Resolución 051 de 2023'
  | 'Resolución 2465 de 2016'
  | 'Resolución 459 de 2012'
  | 'Spec HCP Digital v1'
  | 'Equipo clínico';

export type EstadoParametro = 'decidido' | 'pendiente';

export interface Parametro<T> {
  nombre: string;
  valor: T;
  unidad?: string;
  fuentes: Fuente[];
  estado: EstadoParametro;
  /** Fecha de la última revisión (AAAA-MM-DD). */
  revisado: string;
  nota?: string;
}

const REVISION_SPEC = '2026-10-06';

function p<T>(param: Omit<Parametro<T>, 'revisado'> & { revisado?: string }): Parametro<T> {
  return { revisado: REVISION_SPEC, ...param };
}

/** Banda que empieza en `desde` (inclusive) y llega hasta la siguiente banda. */
export interface Banda<T> {
  desde: number;
  valor: T;
}

export interface CortesHbTrimestre {
  /** Hb ≥ este valor: sin anemia. */
  sinAnemia: number;
  /** Hb ≥ este valor (y < sinAnemia): leve. */
  leve: number;
  /** Hb ≥ este valor (y < leve): moderada. Por debajo: grave. */
  moderada: number;
}

/** Fila del cuadro 12 de la Resolución 2465 de 2016: rangos [desde, hasta] en kg/m², ambos inclusive. */
export interface FilaAtalah {
  semana: number;
  adecuado: [number, number];
  sobrepeso: [number, number];
}

export interface DosisHeparina {
  enoxaparina: string;
  dalteparina: string;
  tinzaparina: string;
}

export interface NormaDerechos {
  norma: string;
  contenido: string;
  /** Fecha de la última verificación de vigencia (AAAA-MM-DD); null mientras no se verifique. */
  fechaVerificacion: string | null;
}

const BASE = {
  // ---------- Cálculos (B3) ----------
  'calculo.fppDias': p<number>({
    nombre: 'Días desde la FUM hasta la FPP',
    valor: 280,
    unidad: 'días',
    fuentes: ['CLAP 2007'],
    estado: 'decidido',
  }),
  'calculo.imcClasificacion': p<Banda<string>[]>({
    nombre: 'Clasificación del IMC pregestacional',
    valor: [
      { desde: 0, valor: 'Bajo peso' },
      { desde: 18.5, valor: 'Normal' },
      { desde: 25, valor: 'Sobrepeso' },
      { desde: 30, valor: 'Obesidad' },
    ],
    unidad: 'kg/m²',
    fuentes: ['OMS (IMC adultos)'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'IMC pregestacional con la clasificación de la OMS para adultos. Aprobado por la responsable del proyecto el 2026-10-07.',
  }),
  'trimestres.limites': p<{ finPrimeroSemanas: number; finSegundoSemanas: number }>({
    nombre: 'Límites de los trimestres',
    valor: { finPrimeroSemanas: 14, finSegundoSemanas: 28 },
    unidad: 'semanas (límite exclusivo: 1.º hasta 13+6, 2.º de 14+0 a 27+6, 3.º desde 28+0)',
    fuentes: ['Spec HCP Digital v1'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: '1.º hasta 13+6, 2.º de 14+0 a 27+6, 3.º desde 28+0. Aprobado por la responsable del proyecto el 2026-10-07.',
  }),

  // ---------- Anemia (D1) ----------
  'anemia.cortesHb': p<Record<1 | 2 | 3, CortesHbTrimestre>>({
    nombre: 'Puntos de corte de Hb por trimestre (a nivel del mar)',
    valor: {
      1: { sinAnemia: 11.0, leve: 10.0, moderada: 7.0 },
      2: { sinAnemia: 10.5, leve: 9.5, moderada: 7.0 },
      3: { sinAnemia: 11.0, leve: 10.0, moderada: 7.0 },
    },
    unidad: 'g/dL',
    fuentes: ['OMS 2024'],
    estado: 'decidido',
  }),
  'anemia.ajusteAltitud': p<Banda<number>[]>({
    nombre: 'Ajuste de Hb por altitud de residencia',
    valor: [
      { desde: 0, valor: 0 },
      { desde: 500, valor: 4 },
      { desde: 1000, valor: 8 },
      { desde: 1500, valor: 11 },
      { desde: 2000, valor: 14 },
      { desde: 2500, valor: 18 },
      { desde: 3000, valor: 21 },
      { desde: 3500, valor: 25 },
      { desde: 4000, valor: 29 },
      { desde: 4500, valor: 33 },
    ],
    unidad: 'g/L (por metros sobre el nivel del mar)',
    fuentes: ['OMS 2024'],
    estado: 'decidido',
  }),
  'anemia.altitudMaximaAjuste': p<number>({
    nombre: 'Altitud desde la cual no se ajusta y se pide revisar el dato',
    valor: 5000,
    unidad: 'm s. n. m.',
    fuentes: ['OMS 2024'],
    estado: 'decidido',
  }),
  'anemia.ajusteTabaquismo': p<{ cantidadDesconocida: number; bandas: Banda<number>[] }>({
    nombre: 'Ajuste de Hb por tabaquismo (Tabla 5)',
    valor: {
      cantidadDesconocida: 3,
      bandas: [
        { desde: 0, valor: 3 },
        { desde: 10, valor: 5 },
        { desde: 20, valor: 6 },
      ],
    },
    unidad: 'g/L (por cigarrillos al día)',
    fuentes: ['OMS 2024'],
    estado: 'decidido',
    nota: 'Para exactamente 20 cigarrillos se usa la fórmula de la guía (0,4565·c − 0,0078·c² = 6 g/L).',
  }),

  // ---------- Déficit de hierro (D2) ----------
  'hierro.ferritinaConAnemia': p<number>({
    nombre: 'Ferritina para déficit de hierro en gestante con anemia (≤)',
    valor: 50,
    unidad: 'ng/mL',
    fuentes: ['ASH 2026'],
    estado: 'decidido',
    nota: 'Nunca usar 15 ng/mL: la guía lo desaconseja en el embarazo.',
  }),
  'hierro.ferritinaSinAnemia': p<number>({
    nombre: 'Ferritina para déficit de hierro sin anemia (≤), solo como dato',
    valor: 30,
    unidad: 'ng/mL',
    fuentes: ['ASH 2026'],
    estado: 'decidido',
  }),

  // ---------- ASA (D3) ----------
  'asa.semanaInicio': p<number>({
    nombre: 'Semana de inicio del ASA',
    valor: 12,
    unidad: 'semanas',
    fuentes: ['GPC Colombia 2013'],
    estado: 'decidido',
  }),
  'asa.semanaInicioTardio': p<number>({
    nombre: 'Semana después de la cual se señala "inicio después de la semana 16"',
    valor: 16,
    unidad: 'semanas',
    fuentes: ['GPC Colombia 2013'],
    estado: 'decidido',
  }),
  'asa.dosis': p<{ minimaMg: number; maximaMg: number }>({
    nombre: 'Dosis diaria de ASA hasta el parto',
    valor: { minimaMg: 75, maximaMg: 100 },
    unidad: 'mg/día, vía oral',
    fuentes: ['GPC Colombia 2013'],
    estado: 'decidido',
  }),
  'asa.criterio': p<{
    minimoAltos: number;
    minimoModerados: number;
    edadModerada: number;
    intervaloModeradoMayorDeAnios: number;
    imcModerado: number;
  }>({
    nombre: 'Criterio de ASA',
    valor: { minimoAltos: 1, minimoModerados: 2, edadModerada: 40, intervaloModeradoMayorDeAnios: 10, imcModerado: 35 },
    fuentes: ['GPC Colombia 2013'],
    estado: 'decidido',
    nota:
      'Alto: trastorno hipertensivo previo, ERC, autoinmune (LES, SAF), diabetes 1 o 2, HTA crónica. ' +
      'Moderado: primer embarazo, edad ≥ 40, intervalo > 10 años, IMC ≥ 35, antecedente familiar de preeclampsia, embarazo múltiple.',
  }),

  // ---------- Diabetes gestacional (D6) ----------
  'ptog.cortes': p<{ ayunas: number; unaHora: number; dosHoras: number }>({
    nombre: 'PTOG 75 g: valor alterado (≥)',
    valor: { ayunas: 92, unaHora: 180, dosHoras: 153 },
    unidad: 'mg/dL',
    fuentes: ['GPC Colombia 2013'],
    estado: 'decidido',
  }),
  'ptog.informacionGestante': p<string[]>({
    nombre: 'Puntos que la GPC pide explicar antes de solicitar la PTOG',
    valor: [
      'En muchas mujeres la diabetes gestacional responde a la dieta y el ejercicio.',
      'Entre 10 % y 20 % necesitan medicamentos o insulina.',
      'El diagnóstico implica más controles durante el embarazo y el parto.',
    ],
    fuentes: ['GPC Colombia 2013'],
    estado: 'decidido',
  }),
  'ptog.ventana': p<{ desdeSemana: number; hastaSemana: number }>({
    nombre: 'Ventana de la PTOG',
    valor: { desdeSemana: 24, hastaSemana: 28 },
    unidad: 'semanas',
    fuentes: ['GPC Colombia 2013'],
    estado: 'decidido',
  }),

  // ---------- Calcio (D4) ----------
  'calcio.indicacion': p<{ semanaInicio: number; dosisDiariaMg: number; tabletaMg: number }>({
    nombre: 'Carbonato de calcio para todas las gestantes',
    valor: { semanaInicio: 14, dosisDiariaMg: 1200, tabletaMg: 600 },
    unidad: 'mg de carbonato de calcio (no calcio elemental)',
    fuentes: ['GPC Colombia 2013'],
    estado: 'decidido',
    nota: '1200 mg de carbonato ≈ 480 mg de calcio elemental.',
  }),
  'calcio.toma': p<string[]>({
    nombre: 'Indicaciones de toma del calcio',
    valor: [
      'Al menos 1 hora separado del hierro.',
      '2 horas antes o después de las comidas principales.',
      'No con leche.',
    ],
    fuentes: ['GPC Colombia 2013'],
    estado: 'decidido',
  }),
  'calcio.contraindicaciones': p<string[]>({
    nombre: 'Contraindicaciones del carbonato de calcio',
    valor: [
      'hipercalcemia',
      'hipercalciuria',
      'hiperparatiroidismo',
      'nefrolitiasisONefrocalcinosis',
      'erCronicaGrave',
      'hipersensibilidadCalcio',
    ],
    fuentes: ['Fichas técnicas de carbonato de calcio'],
    estado: 'decidido',
  }),
  'calcio.precauciones': p<Record<string, string>>({
    nombre: 'Precauciones con el carbonato de calcio',
    valor: {
      sarcoidosis: 'Usar con cautela por mayor activación de la vitamina D; vigilar calcio sérico.',
      tiazidas: 'Reducen la excreción urinaria de calcio; vigilar calcio sérico por riesgo de hipercalcemia.',
      digoxina: 'Vigilar calcio sérico.',
      levotiroxina: 'Tomarla separada del calcio por varias horas, porque el calcio reduce su absorción.',
      antiacidosConCalcioFrecuentes:
        'Riesgo de hipercalcemia por exceso de calcio con álcalis; sumar el calcio de los antiácidos y vigilar.',
      vomitoPersistente:
        'Riesgo de hipercalcemia por exceso de calcio con álcalis; sumar el calcio de los antiácidos y vigilar.',
    },
    fuentes: ['Fichas técnicas de carbonato de calcio'],
    estado: 'decidido',
  }),

  // ---------- Tromboprofilaxis (D5) ----------
  'trombo.puntos': p<Record<string, number>>({
    nombre: 'Puntaje de riesgo trombótico antenatal',
    valor: {
      trombosisPrevia: 4,
      imc50oMas: 4,
      cirugiaEnEmbarazo: 4,
      hiperestimulacionOvarica: 4,
      infeccionSistemica: 4,
      inmovilidadODeshidratacion: 4,
      trombosisPreviaCirugiaMayor: 3,
      trombofiliaAltoRiesgo: 3,
      comorbilidadAltoRiesgo: 3,
      hiperemesis: 3,
      imc40a49: 2,
      antecedenteFamiliarTrombosis: 1,
      trombofiliaBajoRiesgoSinTrombosis: 1,
      edadMayorDe35: 1,
      imc30a39: 1,
      paridad3oMas: 1,
      tabaquismo: 1,
      varicesGruesas: 1,
      preeclampsia: 1,
      reproduccionAsistida: 1,
      embarazoMultiple: 1,
    },
    unidad: 'puntos',
    fuentes: ['RCOG 37a + declaración de posición'],
    estado: 'decidido',
    nota: 'El IMC es el de la primera consulta. Revisar cuando la RCOG publique la guía actualizada.',
  }),
  'trombo.umbrales': p<{ desdeAhora: number; desdeSemana28: number; semanaReevaluacion: number }>({
    nombre: 'Umbrales de tromboprofilaxis',
    valor: { desdeAhora: 4, desdeSemana28: 3, semanaReevaluacion: 28 },
    unidad: 'puntos / semanas',
    fuentes: ['RCOG 37a + declaración de posición'],
    estado: 'decidido',
  }),
  'trombo.casosEspeciales': p<{ imcTodoElEmbarazo: number; horasInicioHiperemesis: number; diasTrasResolverTransitorio: number }>({
    nombre: 'Casos especiales de tromboprofilaxis',
    valor: { imcTodoElEmbarazo: 50, horasInicioHiperemesis: 72, diasTrasResolverTransitorio: 7 },
    fuentes: ['RCOG 37a + declaración de posición'],
    estado: 'decidido',
  }),
  'trombo.trombofilias': p<{ alto: string[]; bajo: string[] }>({
    nombre: 'Clasificación de trombofilias',
    valor: {
      alto: [
        'deficitAntitrombina',
        'deficitProteinaC',
        'deficitProteinaS',
        'factorVLeidenHomocigota',
        'protrombinaHomocigota',
        'dobleHeterocigota',
      ],
      bajo: ['factorVLeidenHeterocigota', 'protrombinaHeterocigota', 'anticuerposAntifosfolipidos'],
    },
    fuentes: ['RCOG 37a + declaración de posición'],
    estado: 'decidido',
  }),
  'trombo.factoresSangrado': p<string[]>({
    nombre: 'Factores de riesgo de sangrado',
    valor: [
      'sangradoActivoAntenatal',
      'riesgoHemorragiaMayor',
      'trastornoHemorragico',
      'acvUltimas4Semanas',
      'enfermedadRenalGrave',
      'enfermedadHepaticaGrave',
      'hipertensionNoControlada',
      'trombocitopenia',
      'alergiaOTrombocitopeniaPorHeparina',
    ],
    fuentes: ['RCOG 37a + declaración de posición'],
    estado: 'decidido',
  }),
  'trombo.plaquetasSangrado': p<number>({
    nombre: 'Plaquetas por debajo de las cuales hay factor de sangrado (<)',
    valor: 75,
    unidad: '× 10⁹/L',
    fuentes: ['RCOG 37a + declaración de posición'],
    estado: 'decidido',
  }),
  'trombo.dosisPorPeso': p<Banda<DosisHeparina>[]>({
    nombre: 'Dosis profiláctica de HBPM por peso de la primera consulta',
    valor: [
      { desde: 0, valor: { enoxaparina: '40 mg al día', dalteparina: '5000 UI al día', tinzaparina: '4500 UI al día' } },
      { desde: 100, valor: { enoxaparina: '60 mg al día*', dalteparina: '7500 UI al día', tinzaparina: '7000 UI al día*' } },
      { desde: 130, valor: { enoxaparina: '80 mg al día*', dalteparina: '10 000 UI al día', tinzaparina: '9000 UI al día*' } },
      { desde: 170, valor: { enoxaparina: '0,6 mg/kg al día*', dalteparina: '75 UI/kg al día', tinzaparina: '75 UI/kg al día*' } },
    ],
    unidad: 'kg',
    fuentes: ['RCOG 37a + declaración de posición'],
    estado: 'decidido',
    nota: '* Se puede dar en dos dosis divididas.',
  }),
  'trombo.suspensionAntesDelParto': p<string | null>({
    nombre: 'Instrucciones a la gestante para suspender la tromboprofilaxis antes del parto',
    valor:
      'Si tienes programada la inducción del parto o una cesárea, el equipo de salud te dirá cuándo aplicarte la última inyección. Por lo general, no te la aplicas el día del procedimiento.',
    fuentes: ['RCOG 37a + declaración de posición', 'Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Texto basado en la RCOG, aprobado por la responsable del proyecto el 2026-10-07.',
  }),

  // ---------- Alertas básicas del CLAP (C2, C3) ----------
  'clap.edadRiesgo': p<{ menorDe: number; mayorDe: number; presuncionViolenciaMenorDe: number }>({
    nombre: 'Edad de riesgo',
    valor: { menorDe: 15, mayorDe: 35, presuncionViolenciaMenorDe: 14 },
    unidad: 'años',
    fuentes: ['CLAP 2007'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Se mantienen los valores del CLAP por decisión de la responsable del proyecto (2026-10-07).',
  }),
  'clap.antecedentesObstetricos': p<{ abortosEspontaneosConsecutivos: number; intervaloCortoMenorDeMeses: number }>({
    nombre: 'Abortos a repetición e intervalo corto',
    valor: { abortosEspontaneosConsecutivos: 3, intervaloCortoMenorDeMeses: 12 },
    fuentes: ['CLAP 2007'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Se mantienen los valores del CLAP por decisión de la responsable del proyecto (2026-10-07).',
  }),
  'clap.pesoRNPrevio': p<{ bajoMenorDe: number; altoDesde: number }>({
    nombre: 'Peso del RN previo',
    valor: { bajoMenorDe: 2500, altoDesde: 4000 },
    unidad: 'g',
    fuentes: ['CLAP 2007'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Se mantienen los valores del CLAP por decisión de la responsable del proyecto (2026-10-07).',
  }),
  'clap.antitetanicaConducta': p<{ vigenciaCuatroDosisAnios: number; dosisSinVacunaPrevia: number; dosisSiNoVigente: number }>({
    nombre: 'Antitetánica: vigencia con 4 dosis y dosis a aplicar en el embarazo',
    valor: { vigenciaCuatroDosisAnios: 10, dosisSinVacunaPrevia: 2, dosisSiNoVigente: 1 },
    fuentes: ['CLAP 2007'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota:
      'Sin vacuna previa o con información poco confiable: 2 dosis. Con esquema no vigente: 1 refuerzo. ' +
      'Con 4 dosis, vigente si la última fue hace menos de 10 años. Esquema propuesto aprobado por la responsable del proyecto (2026-10-07).',
  }),
  'clap.antitetanica': p<{
    vigenciaDosDosisAnios: number;
    vigenciaTresOMasDosisAnios: number;
    dosisEsquemaCompleto: number;
    semanasEntrePrimeraYSegunda: number;
    semanasAntesDeFPP: number;
  }>({
    nombre: 'Esquema antitetánico',
    valor: {
      vigenciaDosDosisAnios: 3,
      vigenciaTresOMasDosisAnios: 5,
      dosisEsquemaCompleto: 5,
      semanasEntrePrimeraYSegunda: 4,
      semanasAntesDeFPP: 3,
    },
    fuentes: ['CLAP 2007'],
    estado: 'decidido',
  }),

  // ---------- Recordatorios por semana (F1) ----------
  'recordatorios.ventanas': p<Record<string, { desdeSemana: number; hastaSemana: number | null }>>({
    nombre: 'Momentos de los exámenes y acciones por semana',
    valor: {
      examenesPrimeraConsulta: { desdeSemana: 0, hastaSemana: 20 },
      ecografiaPrimerTrimestre: { desdeSemana: 10, hastaSemana: 13 },
      ecografiaDetalle: { desdeSemana: 18, hastaSemana: 23 },
      ptog: { desdeSemana: 24, hastaSemana: 28 },
      reevaluacionTrombotica: { desdeSemana: 28, hastaSemana: 30 },
      examenesTercerTrimestre: { desdeSemana: 28, hastaSemana: 34 },
      egb: { desdeSemana: 35, hastaSemana: 37 },
    },
    unidad: 'semanas (inclusive: hasta la semana N+6)',
    fuentes: ['Spec HCP Digital v1', 'Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota:
      'Momentos de la Ruta Materno Perinatal (Resolución 3280 de 2018) aprobados por la responsable del proyecto el 2026-10-07: ecografía de 10+6 a 13+6 y de detalle de 18 a 23+6, PTOG de 24 a 28, hemograma, VIH y sífilis del tercer trimestre desde la 28, estreptococo B de 35 a 37. Tomados sin el texto de la norma a la vista: verificar contra la versión vigente.',
  }),
  'recordatorios.examenesPrimeraConsulta': p<string[]>({
    nombre: 'Exámenes de la primera consulta',
    valor: ['hb', 'sifilisTreponemica', 'vih', 'hepatitisB', 'bacteriuria', 'toxoplasmosis', 'rubeolaIgG', 'chagas', 'malaria'],
    fuentes: ['Spec HCP Digital v1', 'Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota:
      'Según la Ruta Materno Perinatal, aprobado por la responsable del proyecto el 2026-10-07: hemograma, prueba treponémica rápida, VIH, hepatitis B, urocultivo, toxoplasmosis; IgG de rubéola solo sin vacuna previa; Chagas y malaria solo en zona endémica. Además, grupo y Rh, tamizaje de cuello uterino y ecografía de 10+6 a 13+6. Verificar contra la versión vigente.',
  }),

  'hta.umbrales': p<{
    pas: number;
    pad: number;
    pasSevera: number;
    padSevera: number;
    semanaGestacional: number;
    proteinuriaMinima: '1+' | '2+' | '3+';
  }>({
    nombre: 'Hipertensión en el embarazo y sospecha de preeclampsia',
    valor: { pas: 140, pad: 90, pasSevera: 160, padSevera: 110, semanaGestacional: 20, proteinuriaMinima: '1+' },
    unidad: 'mmHg / semanas / proteinuria en tira',
    fuentes: ['GPC Colombia 2013', 'Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Aprobados por la responsable del proyecto el 2026-10-07 (proteinuria de 1+ o más). Confirmar contra la GPC vigente.',
  }),
  'au.percentiles': p<Record<number, { p10: number; p90: number }>>({
    nombre: 'Altura uterina: percentiles 10 y 90 por semana (CLAP)',
    valor: {
      13: { p10: 7.7, p90: 12.9 }, 14: { p10: 8.9, p90: 14.5 }, 15: { p10: 10.1, p90: 15.8 }, 16: { p10: 11.2, p90: 17.0 },
      17: { p10: 12.2, p90: 18.0 }, 18: { p10: 13.1, p90: 19.0 }, 19: { p10: 14.0, p90: 20.2 }, 20: { p10: 15.0, p90: 21.2 },
      21: { p10: 15.8, p90: 22.1 }, 22: { p10: 16.7, p90: 23.0 }, 23: { p10: 17.6, p90: 23.9 }, 24: { p10: 18.5, p90: 24.7 },
      25: { p10: 19.5, p90: 25.5 }, 26: { p10: 20.3, p90: 26.3 }, 27: { p10: 21.2, p90: 27.1 }, 28: { p10: 21.9, p90: 27.8 },
      29: { p10: 22.7, p90: 28.5 }, 30: { p10: 23.5, p90: 29.3 }, 31: { p10: 24.3, p90: 30.2 }, 32: { p10: 25.2, p90: 31.0 },
      33: { p10: 26.0, p90: 31.8 }, 34: { p10: 26.9, p90: 32.5 }, 35: { p10: 27.8, p90: 33.1 }, 36: { p10: 28.7, p90: 33.6 },
      37: { p10: 29.5, p90: 34.0 }, 38: { p10: 30.2, p90: 34.4 }, 39: { p10: 30.6, p90: 34.7 }, 40: { p10: 30.9, p90: 34.8 },
    },
    unidad: 'cm por semana de amenorrea (13 a 40); entre semanas se interpola',
    fuentes: ['CLAP 2007'],
    estado: 'pendiente',
    nota: 'Leídos de la curva del CLAP que entregó la responsable del proyecto (2026-10-07). Reemplazar por la tabla numérica oficial del CLAP.',
  }),
  'nutricion.atalah': p<FilaAtalah[]>({
    nombre: 'IMC para la edad gestacional (Atalah)',
    valor: [
      { semana: 6, adecuado: [20.0, 24.9], sobrepeso: [25.0, 30.0] },
      { semana: 7, adecuado: [20.1, 24.9], sobrepeso: [25.0, 30.0] },
      { semana: 8, adecuado: [20.2, 25.0], sobrepeso: [25.1, 30.1] },
      { semana: 9, adecuado: [20.2, 25.1], sobrepeso: [25.2, 30.2] },
      { semana: 10, adecuado: [20.3, 25.2], sobrepeso: [25.3, 30.2] },
      { semana: 11, adecuado: [20.4, 25.3], sobrepeso: [25.4, 30.3] },
      { semana: 12, adecuado: [20.5, 25.4], sobrepeso: [25.5, 30.3] },
      { semana: 13, adecuado: [20.7, 25.6], sobrepeso: [25.7, 30.4] },
      { semana: 14, adecuado: [20.8, 25.7], sobrepeso: [25.8, 30.5] },
      { semana: 15, adecuado: [20.9, 25.8], sobrepeso: [25.9, 30.6] },
      { semana: 16, adecuado: [21.1, 25.9], sobrepeso: [26.0, 30.7] },
      { semana: 17, adecuado: [21.2, 26.0], sobrepeso: [26.1, 30.8] },
      { semana: 18, adecuado: [21.3, 26.1], sobrepeso: [26.2, 30.9] },
      { semana: 19, adecuado: [21.5, 26.2], sobrepeso: [26.3, 30.9] },
      { semana: 20, adecuado: [21.6, 26.3], sobrepeso: [26.4, 31.0] },
      { semana: 21, adecuado: [21.8, 26.4], sobrepeso: [26.5, 31.1] },
      { semana: 22, adecuado: [21.9, 26.6], sobrepeso: [26.7, 31.2] },
      { semana: 23, adecuado: [22.1, 26.7], sobrepeso: [26.8, 31.3] },
      { semana: 24, adecuado: [22.3, 26.9], sobrepeso: [27.0, 31.5] },
      { semana: 25, adecuado: [22.5, 27.0], sobrepeso: [27.1, 31.6] },
      { semana: 26, adecuado: [22.7, 27.2], sobrepeso: [27.3, 31.7] },
      { semana: 27, adecuado: [22.8, 27.3], sobrepeso: [27.4, 31.8] },
      { semana: 28, adecuado: [23.0, 27.5], sobrepeso: [27.6, 31.9] },
      { semana: 29, adecuado: [23.2, 27.6], sobrepeso: [27.7, 32.0] },
      { semana: 30, adecuado: [23.4, 27.8], sobrepeso: [27.9, 32.1] },
      { semana: 31, adecuado: [23.5, 27.9], sobrepeso: [28.0, 32.2] },
      { semana: 32, adecuado: [23.7, 28.0], sobrepeso: [28.1, 32.3] },
      { semana: 33, adecuado: [23.9, 28.1], sobrepeso: [28.2, 32.4] },
      { semana: 34, adecuado: [24.0, 28.3], sobrepeso: [28.4, 32.5] },
      { semana: 35, adecuado: [24.2, 28.4], sobrepeso: [28.5, 32.6] },
      { semana: 36, adecuado: [24.3, 28.5], sobrepeso: [28.6, 32.7] },
      { semana: 37, adecuado: [24.5, 28.7], sobrepeso: [28.8, 32.8] },
      { semana: 38, adecuado: [24.6, 28.8], sobrepeso: [28.9, 32.9] },
      { semana: 39, adecuado: [24.8, 28.9], sobrepeso: [29.0, 33.0] },
      { semana: 40, adecuado: [25.0, 29.1], sobrepeso: [29.2, 33.1] },
      { semana: 41, adecuado: [25.1, 29.2], sobrepeso: [29.3, 33.2] },
      { semana: 42, adecuado: [25.1, 29.2], sobrepeso: [29.3, 33.2] },
    ],
    unidad: 'kg/m² por semana de gestación cumplida (6 a 42). Bajo peso: < inicio de adecuado; obesidad: > fin de sobrepeso',
    fuentes: ['Resolución 2465 de 2016'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota:
      'Cuadro 12 de la Resolución 2465 de 2016 (Atalah, Universidad de Chile), transcrito por la responsable del proyecto el 2026-10-07. En la semana 26 el cuadro publicado repite 27,2 como fin de adecuado y como inicio de sobrepeso; por decisión de la responsable del proyecto (2026-10-07) sobrepeso empieza en 27,3, como en el resto de semanas.',
  }),
  'bienestarFetal': p<{ fcfMin: number; fcfMax: number; movimientosDesdeSemana: number }>({
    nombre: 'Bienestar fetal: FCF normal y semana desde la que se evalúan los movimientos',
    valor: { fcfMin: 110, fcfMax: 160, movimientosDesdeSemana: 20 },
    unidad: 'lpm / semanas',
    fuentes: ['Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Aprobado por la responsable del proyecto el 2026-10-07. Confirmar contra la GPC vigente.',
  }),
  'rh.antiD': p<{ desdeSemana: number; hastaSemana: number | null }>({
    nombre: 'Inmunoglobulina anti-D en gestantes Rh negativo no sensibilizadas',
    valor: { desdeSemana: 28, hastaSemana: 28 },
    unidad: 'semanas (atrasada desde la 29+0)',
    fuentes: ['GPC Colombia 2013', 'Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota:
      'Semana 28 aprobada por la responsable del proyecto el 2026-10-07. También después de sangrado, trauma abdominal o procedimientos invasivos. Con Coombs indirecto positivo o inmunizada: no aplica; remitir. Verificar contra la GPC vigente.',
  }),
  'anticoncepcion.asesoriaPosparto': p<{ desdeSemana: number }>({
    nombre: 'Asesoría en anticoncepción para después del parto',
    valor: { desdeSemana: 28 },
    unidad: 'semanas (recordatorio hasta que se registre la asesoría)',
    fuentes: ['Equipo clínico'],
    estado: 'pendiente',
    nota: 'Semana 28 propuesta el 2026-10-07 (tercer trimestre, antes del parto). Verificar contra la Ruta Materno Perinatal (Resolución 3280 de 2018).',
  }),
  'vacunas.tdap': p<{ desdeSemana: number; hastaSemana: number | null }>({
    nombre: 'Vacuna Tdap (tosferina) en cada embarazo',
    valor: { desdeSemana: 26, hastaSemana: null },
    unidad: 'semanas',
    fuentes: ['Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Recordatorio desde la semana 26 hasta que se registre aplicada. Sin semana límite para marcarla atrasada. Decidido por la responsable del proyecto el 2026-10-07.',
  }),

  // ---------- Validaciones de datos imposibles (B2) ----------
  'validacion.rangos': p<Record<string, { min: number; max: number }>>({
    nombre: 'Rangos fuera de los cuales se pide confirmar el dato',
    valor: {
      paSistolica: { min: 60, max: 250 },
      paDiastolica: { min: 30, max: 150 },
      pesoKg: { min: 30, max: 250 },
      tallaCm: { min: 120, max: 200 },
      fcfLpm: { min: 60, max: 220 },
      hbGdl: { min: 3, max: 22 },
    },
    fuentes: ['Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Fuera de estos rangos la app pide confirmar el dato; nunca bloquea el guardado. Aprobado por la responsable del proyecto el 2026-10-07.',
  }),

  // ---------- Derechos sexuales y reproductivos (E1) ----------
  'ive.semanaLimiteSinCausal': p<number>({
    nombre: 'Semana hasta la cual la IVE es por la sola voluntad de la gestante',
    valor: 24,
    unidad: 'semanas',
    fuentes: ['Sentencia C-055 de 2022'],
    estado: 'decidido',
  }),
  'ive.limite': p<{ hastaDiasInclusive: number; margenEGDudosaSemanas: number }>({
    nombre: 'Límite de la IVE por la sola voluntad y margen de EG dudosa',
    valor: { hastaDiasInclusive: 24 * 7, margenEGDudosaSemanas: 2 },
    unidad: 'días de EG / semanas',
    fuentes: ['Sentencia C-055 de 2022', 'Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota:
      '"Hasta la semana 24" se toma como EG de hasta 24+0, por decisión de la responsable del proyecto el 2026-10-07. Con EG no confiable entre las semanas 22 y 26 la app pide confirmar la EG sin dilatar la atención.',
  }),
  'ive.plazoExcepcionalDias': p<number>({
    nombre: 'Plazo máximo excepcional y justificado de la atención de IVE',
    valor: 5,
    unidad: 'días calendario',
    fuentes: ['Resolución 051 de 2023'],
    estado: 'decidido',
  }),
  'derechos.normas': p<NormaDerechos[]>({
    nombre: 'Sentencias y normas que informan los textos de derechos',
    valor: [
      { norma: 'Sentencia C-355 de 2006', contenido: 'Tres causales de IVE.', fechaVerificacion: null },
      { norma: 'Sentencia SU-096 de 2018', contenido: 'Reglas sobre el acceso a la IVE.', fechaVerificacion: null },
      { norma: 'Sentencia C-055 de 2022', contenido: 'IVE hasta la semana 24 por la sola voluntad.', fechaVerificacion: null },
      { norma: 'Resolución 051 de 2023', contenido: 'Regulación única de la atención integral de la IVE.', fechaVerificacion: null },
    ],
    fuentes: ['Sentencia C-355 de 2006', 'Sentencia SU-096 de 2018', 'Sentencia C-055 de 2022', 'Resolución 051 de 2023'],
    estado: 'pendiente',
    nota: 'Falta registrar la fecha de verificación de cada norma (tarea G3).',
  }),
  // El prestador de IVE y los contactos de la ruta son de cada institución: src/institucion/configuracion.ts.
  'derechos.rutaViolenciaSexual': p<string[]>({
    nombre: 'Ruta de atención a víctimas de violencia sexual: pasos comunes a todas las instituciones',
    valor: [
      'Atender como urgencia médica, con prioridad, según el protocolo de atención integral en salud para víctimas de violencia sexual (Resolución 459 de 2012).',
      'Si la agresión ocurrió en las últimas 72 horas: profilaxis para VIH e ITS y toma de muestras con cadena de custodia. En la gestante no aplica la anticoncepción de emergencia.',
      'Notificar al SIVIGILA (evento 875, violencia de género e intrafamiliar).',
      'Activar la ruta de protección y justicia (comisaría de familia, Fiscalía; en menores de 14 años también ICBF). La atención en salud no se condiciona a la denuncia.',
      'Ofrecer atención en salud mental y seguimiento.',
    ],
    fuentes: ['Resolución 459 de 2012', 'Equipo clínico'],
    estado: 'pendiente',
    nota: 'Texto base propuesto el 2026-10-07 y aprobado como borrador por la responsable del proyecto. Lo verifica el equipo clínico o jurídico antes de marcarlo como decidido.',
  }),

  // ---------- Carné (F3, F4) ----------
  'carne.pin': p<{ digitos: number; intentosAntesDeBloqueo: number }>({
    nombre: 'PIN del carné',
    valor: { digitos: 4, intentosAntesDeBloqueo: 5 },
    fuentes: ['Spec HCP Digital v1'],
    estado: 'decidido',
  }),
  'carne.minutosBloqueo': p<number>({
    nombre: 'Duración del bloqueo del carné tras los intentos fallidos',
    valor: 15,
    unidad: 'minutos',
    fuentes: ['Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: '15 minutos después de 5 intentos fallidos. Aprobado por la responsable del proyecto el 2026-10-07.',
  }),
} as const;

type Base = typeof BASE;
export type IdParametro = keyof Base;
export type ValorDe<K extends IdParametro> = Base[K]['valor'];

export type CambiosCatalogo = {
  [K in IdParametro]?: Partial<Pick<Parametro<ValorDe<K>>, 'valor' | 'estado' | 'revisado' | 'nota'>>;
};

export interface AvisoParametroPendiente {
  id: IdParametro;
  nombre: string;
  nota?: string;
}

export class Catalogo {
  private readonly parametros: Map<IdParametro, Parametro<unknown>>;
  private readonly pendientesUsados = new Map<IdParametro, AvisoParametroPendiente>();

  constructor(cambios: CambiosCatalogo = {}) {
    this.parametros = new Map();
    for (const id of Object.keys(BASE) as IdParametro[]) {
      this.parametros.set(id, { ...BASE[id], ...(cambios[id] ?? {}) } as Parametro<unknown>);
    }
  }

  parametro<K extends IdParametro>(id: K): Parametro<ValorDe<K>> {
    return this.parametros.get(id) as Parametro<ValorDe<K>>;
  }

  /** Valor que usa una regla. Si el parámetro está pendiente, queda registrado como aviso interno. */
  valor<K extends IdParametro>(id: K): ValorDe<K> {
    const param = this.parametro(id);
    if (param.estado === 'pendiente') {
      this.pendientesUsados.set(id, { id, nombre: param.nombre, nota: param.nota });
    }
    return param.valor;
  }

  /** Parámetros pendientes de validar que alguna regla ha usado. */
  avisos(): AvisoParametroPendiente[] {
    return [...this.pendientesUsados.values()];
  }

  lista(): Array<{ id: IdParametro } & Parametro<unknown>> {
    return [...this.parametros.entries()].map(([id, param]) => ({ id, ...param }));
  }
}

/** Valor de la banda en la que cae `x` (las bandas van ordenadas por `desde`). */
export function valorEnBanda<T>(bandas: readonly Banda<T>[], x: number): T {
  let elegido: Banda<T> | undefined;
  for (const banda of bandas) {
    if (x >= banda.desde) elegido = banda;
  }
  if (!elegido) throw new RangeError(`Valor ${x} fuera de las bandas`);
  return elegido.valor;
}
