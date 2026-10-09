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
  | 'Ley 1146 de 2007'
  | 'Ley 1257 de 2008'
  | 'Ley 1719 de 2014'
  | 'Resolución 3100 de 2019'
  | 'Resolución 866 de 2021'
  | 'DANE (DIVIPOLA)'
  | 'Supersalud (códigos de EPS)'
  | 'CUPS (MinSalud)'
  | 'OMS (ATC)'
  | 'Spec HCP Digital v1'
  | 'Equipo clínico';

import type { Codificado } from '../datos/modelo';
export type { Codificado };

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

/** Principio activo con su código ATC. El CUM depende del producto que se dispensa. */
export interface MedicamentoCodificado {
  principio: string;
  atc: string;
}

/** Plantilla para llenar una línea de la fórmula médica. */
export interface PlantillaMedicamento {
  principio: string;
  atc: string;
  presentacion: string;
  dosis: string;
  via: string;
  frecuencia: string;
  indicaciones?: string;
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
  'hierro.inicioConHbHasta': p<number>({
    nombre: 'Hb medida con la que se alerta para iniciar sulfato ferroso',
    valor: 13,
    unidad: 'g/dL (Hb medida de 13 o menos, sin anemia)',
    fuentes: ['Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-08',
    nota: 'Indicado por la responsable del proyecto el 2026-10-08: alerta de inicio de sulfato ferroso desde una Hb de 13 g/dL. Con anemia, la alerta de anemia ya pide indicar o ajustar el hierro.',
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
  'asa.semanaFin': p<number>({
    nombre: 'Semana en que se suspende el ASA',
    valor: 36,
    unidad: 'semanas (se toma hasta 35+6; desde 36+0 se suspende)',
    fuentes: ['Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-08',
    nota: 'El ASA va hasta la semana 36. Indicado por la responsable del proyecto el 2026-10-08.',
  }),
  'asa.dosis': p<{ minimaMg: number; maximaMg: number }>({
    nombre: 'Dosis diaria de ASA (desde la semana 12 hasta la 36)',
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
      examenesSegundoTrimestre: { desdeSemana: 14, hastaSemana: 27 },
      examenesTercerTrimestre: { desdeSemana: 28, hastaSemana: 34 },
      egb: { desdeSemana: 35, hastaSemana: 37 },
    },
    unidad: 'semanas (inclusive: hasta la semana N+6)',
    fuentes: ['Spec HCP Digital v1', 'Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota:
      'Momentos de la Ruta Materno Perinatal (Resolución 3280 de 2018) aprobados por la responsable del proyecto el 2026-10-07: ecografía de 10+6 a 13+6 y de detalle de 18 a 23+6, PTOG de 24 a 28, VIH y sífilis en cada trimestre (segundo trimestre de 14 a 27+6, por decisión de la responsable del proyecto el 2026-10-07), hemograma, VIH y sífilis del tercer trimestre desde la 28, estreptococo B de 35 a 37. Tomados sin el texto de la norma a la vista: verificar contra la versión vigente.',
  }),
  'recordatorios.examenesPrimeraConsulta': p<string[]>({
    nombre: 'Exámenes de la primera consulta',
    valor: ['hemoclasificacion', 'hb', 'glucemia', 'tsh', 'sifilisTreponemica', 'vih', 'hepatitisB', 'bacteriuria', 'toxoplasmosis', 'rubeolaIgG', 'varicelaIgG', 'chagas', 'malaria'],
    fuentes: ['Spec HCP Digital v1', 'Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-08',
    nota:
      'Según la Ruta Materno Perinatal, aprobado por la responsable del proyecto el 2026-10-07: hemograma, prueba treponémica rápida, VIH, hepatitis B, urocultivo (no solo bacteriuria), toxoplasmosis (IgG e IgM), hemoclasificación de laboratorio a todas (aunque declare su grupo); IgG para varicela zóster solo sin antecedente de vacuna; IgG de rubéola solo sin vacuna previa; Chagas y malaria solo en zona endémica. Además, grupo y Rh, tamizaje de cuello uterino y ecografía de 10+6 a 13+6. Glucemia en ayunas y TSH agregadas por la responsable del proyecto el 2026-10-08. Verificar contra la versión vigente.',
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
    valor: { desdeSemana: 0 },
    unidad: 'semanas (recordatorio hasta que se registre la asesoría)',
    fuentes: ['Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Desde el inicio del control prenatal, por decisión de la responsable del proyecto el 2026-10-07. Se registra en la primera consulta o en cualquier control.',
  }),
  'toxoplasmosis.repeticion': p<{ cadaDias: number }>({
    nombre: 'Toxoplasmosis: repetición si la IgG es negativa',
    valor: { cadaDias: 30 },
    unidad: 'días entre pruebas (cada mes) mientras la IgG sea negativa',
    fuentes: ['Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Cada mes con IgG negativa, por decisión de la responsable del proyecto el 2026-10-07. IgM positiva o seroconversión de la IgG: alerta.',
  }),
  'toxoplasmosis.protocolo': p<{
    segundaMuestraDias: number;
    factorDuplicacion: number;
    avidezHastaSemana: number;
    pcrDesdeSemana: number;
    pcrDiasDesdeSospecha: number;
    ecoMensualDesdeSemana: number;
    hemogramaCadaDias: number;
    plenoHastaSemanasAntesFpp: number;
  }>({
    nombre: 'Toxoplasmosis: momentos del protocolo',
    valor: {
      segundaMuestraDias: 14,
      factorDuplicacion: 2,
      avidezHastaSemana: 16,
      pcrDesdeSemana: 20,
      pcrDiasDesdeSospecha: 28,
      ecoMensualDesdeSemana: 30,
      hemogramaCadaDias: 7,
      plenoHastaSemanasAntesFpp: 2,
    },
    unidad: 'días / semanas',
    fuentes: ['Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota:
      'Protocolo entregado por la responsable del proyecto el 2026-10-07: segunda muestra (IgG con título + IgM) a las 2 semanas; IgG duplicada = título ≥ 2 veces el anterior; avidez antes de la semana 16; PCR en líquido amniótico después de la semana 20 y al menos 4 semanas desde la sospecha; ecografía mensual desde la semana 30; hemograma semanal con tratamiento pleno, hasta 2 semanas antes de la FPP.',
  }),
  'toxoplasmosis.esquemas': p<{ placentario: string; pleno: string; alternativos: string }>({
    nombre: 'Toxoplasmosis: esquemas de tratamiento',
    valor: {
      placentario: 'Espiramicina 9 MUI/día en 3 dosis, hasta el parto.',
      pleno:
        'Sulfadiazina 50–100 mg/kg/día (3–4 g/día en 4 dosis) + pirimetamina 1 mg/kg/día (máx. 75 mg) + ácido folínico 5–20 mg/día, desde la semana 20 hasta 2 semanas antes de la FPP, con hemograma semanal (toxicidad medular de la pirimetamina).',
      alternativos:
        'Sin disponibilidad del esquema ideal: sulfadoxina-pirimetamina, o ciclos alternando espiramicina con sulfadiazina-pirimetamina.',
    },
    fuentes: ['Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Entregados por la responsable del proyecto el 2026-10-07.',
  }),
  'signosVitales.alertas': p<{ fiebreDesdeC: number; saturacionMenorDe: number; taquicardiaMayorDe: number; taquipneaMayorDe: number; bradicardiaMenorDe: number }>({
    nombre: 'Alertas por signos vitales',
    valor: { fiebreDesdeC: 38, saturacionMenorDe: 92, taquicardiaMayorDe: 100, taquipneaMayorDe: 20, bradicardiaMenorDe: 60 },
    unidad: '°C / %',
    fuentes: ['Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-08',
    nota: 'Fiebre con temperatura de 38 °C o más, saturación baja por debajo de 92 % taquicardia materna con frecuencia cardíaca mayor de 100 lpm taquipnea con frecuencia respiratoria mayor de 20 rpm y bradicardia materna con frecuencia cardíaca menor de 60 lpm, por decisión de la responsable del proyecto el 2026-10-08.',
  }),
  'glucemia.cortes': p<{ diabetesGestacionalDesde: number; diabetesDesde: number }>({
    nombre: 'Glucemia en ayunas del primer trimestre: puntos de corte',
    valor: { diabetesGestacionalDesde: 92, diabetesDesde: 126 },
    unidad: 'mg/dL (desde 92: diabetes gestacional; desde 126: diabetes manifiesta)',
    fuentes: ['OMS 2024', 'Equipo clínico'],
    estado: 'pendiente',
    revisado: '2026-10-08',
    nota: 'Criterios IADPSG/OMS 2013. Por confirmar con el equipo clínico y la GPC vigente. Un resultado desde 92 se marca como alterado en la sección de laboratorios.',
  }),
  'tsh.limiteSuperior': p<number>({
    nombre: 'TSH: límite superior en el embarazo',
    valor: 4.0,
    unidad: 'mUI/L (por encima se marca como alterada)',
    fuentes: ['Equipo clínico'],
    estado: 'pendiente',
    revisado: '2026-10-08',
    nota: 'Valor de referencia cuando el laboratorio no tiene rangos propios por trimestre (ATA 2017). Por confirmar con el equipo clínico.',
  }),
  'tsh.limiteInferior': p<number>({
    nombre: 'TSH: límite inferior en el embarazo',
    valor: 0.1,
    unidad: 'mUI/L (por debajo se marca como alterada)',
    fuentes: ['Equipo clínico'],
    estado: 'pendiente',
    revisado: '2026-10-09',
    nota: 'Por confirmar con el equipo clínico. En el primer trimestre la TSH baja puede ser fisiológica (efecto de la hCG).',
  }),
  'plaquetas.normalDesde': p<number>({
    nombre: 'Recuento de plaquetas normal (hemograma)',
    valor: 150,
    unidad: '× 10⁹/L; por debajo se marca en la sección de laboratorios',
    fuentes: ['Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Decidido por la responsable del proyecto el 2026-10-07. La trombocitopenia que contraindica la heparina (< 75) está en el riesgo trombótico.',
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
      fcLpm: { min: 40, max: 180 },
      frRpm: { min: 8, max: 40 },
      temperaturaC: { min: 34, max: 42 },
      saturacionPct: { min: 70, max: 100 },
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
      {
        norma: 'Ley 1146 de 2007',
        contenido: 'Violencia sexual contra niñas, niños y adolescentes: atención de urgencia e integral, aunque no esté definida la afiliación (art. 9); protocolo de atención (art. 10).',
        fechaVerificacion: null,
      },
      {
        norma: 'Ley 1257 de 2008',
        contenido: 'Violencias contra las mujeres: derechos de la víctima (art. 8), medidas en salud (art. 13) y medidas de atención (art. 19).',
        fechaVerificacion: null,
      },
      {
        norma: 'Ley 1719 de 2014',
        contenido: 'Violencia sexual: derechos y confidencialidad (art. 13); atención prioritaria como urgencia médica, gratuita, sin importar el tiempo ni la denuncia, y protocolo obligatorio (art. 23; Sentencia C-754 de 2015).',
        fechaVerificacion: null,
      },
    ],
    fuentes: ['Sentencia C-355 de 2006', 'Sentencia SU-096 de 2018', 'Sentencia C-055 de 2022', 'Resolución 051 de 2023', 'Ley 1146 de 2007', 'Ley 1257 de 2008', 'Ley 1719 de 2014'],
    estado: 'pendiente',
    nota: 'Falta registrar la fecha de verificación de cada norma (tarea G3).',
  }),
  // El prestador de IVE y los contactos de la ruta son de cada institución: src/institucion/configuracion.ts.
  'derechos.rutaViolenciaSexual': p<string[]>({
    nombre: 'Ruta de atención a víctimas de violencia sexual: pasos comunes a todas las instituciones',
    valor: [
      'Atender como urgencia médica, con prioridad y gratis, sin importar el tiempo transcurrido desde la agresión, la afiliación al sistema de salud ni si hay denuncia (Ley 1719 de 2014, art. 23; Ley 1146 de 2007, art. 9), según el protocolo de la Resolución 459 de 2012.',
      'Si la agresión ocurrió en las últimas 72 horas: profilaxis para VIH e ITS y toma de muestras con cadena de custodia. Pasadas las 72 horas también se atiende. En la gestante no aplica la anticoncepción de emergencia.',
      'Notificar al SIVIGILA (evento 875, violencia de género e intrafamiliar).',
      'Activar la ruta de protección y justicia (comisaría de familia, Fiscalía; en menores de 14 años siempre también ICBF). La atención en salud no se condiciona a la denuncia.',
      'Proteger su intimidad: nombre, dirección, teléfono y datos de su familia son confidenciales (Ley 1719 de 2014, art. 13). No confrontarla con el agresor ni repetir exámenes o preguntas innecesarias.',
      'Informar sus derechos, incluida la IVE por la causal de violencia sexual sin límite de semanas, y ofrecer atención en salud mental y psicosocial.',
    ],
    fuentes: ['Resolución 459 de 2012', 'Ley 1146 de 2007', 'Ley 1719 de 2014', 'Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Texto ajustado con las Leyes 1146 de 2007 y 1719 de 2014 y aprobado por la responsable del proyecto el 2026-10-07.',
  }),
  'derechos.rutaViolenciaContraLaMujer': p<string[]>({
    nombre: 'Ruta de atención a mujeres víctimas de violencia (física, psicológica, económica): pasos comunes',
    valor: [
      'Atender las lesiones y valorar el riesgo (amenazas de muerte, violencia más frecuente o más grave, acceso a armas). Con riesgo alto, activar la protección el mismo día.',
      'Notificar al SIVIGILA (evento 875, violencia de género e intrafamiliar).',
      'Informarle que puede pedir medidas de protección a la comisaría de familia (o al juez donde no haya comisaría) y denunciar ante la Fiscalía. Ella decide; la atención en salud no depende de la denuncia.',
      'Si su salud física o mental está afectada, informarle sobre las medidas de atención (alojamiento, alimentación y transporte) que ordena la autoridad competente y presta el sistema de salud (Ley 1257 de 2008, art. 19; Decreto 4796 de 2011).',
      'Respetar su derecho a recibir información clara, completa, veraz y oportuna y a decidir si acepta ser confrontada con el agresor (Ley 1257 de 2008, art. 8). La atención a ella y al agresor no la presta la misma persona ni en el mismo lugar.',
      'Ofrecer atención en salud mental y preguntar de nuevo, a solas, en cada control.',
    ],
    fuentes: ['Ley 1257 de 2008', 'Equipo clínico'],
    estado: 'decidido',
    revisado: '2026-10-07',
    nota: 'Basado en la Ley 1257 de 2008 y aprobado por la responsable del proyecto el 2026-10-07.',
  }),

  // ---------- Códigos para la interoperabilidad (Ley 2015 de 2020, Resolución 866 de 2021) ----------
  'codigos.divipola': p<Codificado[]>({
    nombre: 'Municipios con código DIVIPOLA (sugeridos al escribir)',
    valor: [
      ['91001', 'Leticia (Amazonas)'],
      ['05001', 'Medellín (Antioquia)'],
      ['81001', 'Arauca (Arauca)'],
      ['08001', 'Barranquilla (Atlántico)'],
      ['11001', 'Bogotá, D. C.'],
      ['13001', 'Cartagena de Indias (Bolívar)'],
      ['15001', 'Tunja (Boyacá)'],
      ['17001', 'Manizales (Caldas)'],
      ['18001', 'Florencia (Caquetá)'],
      ['85001', 'Yopal (Casanare)'],
      ['19001', 'Popayán (Cauca)'],
      ['20001', 'Valledupar (Cesar)'],
      ['27001', 'Quibdó (Chocó)'],
      ['23001', 'Montería (Córdoba)'],
      ['94001', 'Inírida (Guainía)'],
      ['95001', 'San José del Guaviare (Guaviare)'],
      ['41001', 'Neiva (Huila)'],
      ['44001', 'Riohacha (La Guajira)'],
      ['47001', 'Santa Marta (Magdalena)'],
      ['50001', 'Villavicencio (Meta)'],
      ['52001', 'Pasto (Nariño)'],
      ['54001', 'Cúcuta (Norte de Santander)'],
      ['86001', 'Mocoa (Putumayo)'],
      ['63001', 'Armenia (Quindío)'],
      ['66001', 'Pereira (Risaralda)'],
      ['88001', 'San Andrés (San Andrés y Providencia)'],
      ['68001', 'Bucaramanga (Santander)'],
      ['70001', 'Sincelejo (Sucre)'],
      ['73001', 'Ibagué (Tolima)'],
      ['76001', 'Cali (Valle del Cauca)'],
      ['97001', 'Mitú (Vaupés)'],
      ['99001', 'Puerto Carreño (Vichada)'],
    ].map(([codigo, nombre]) => ({ codigo: codigo!, nombre: nombre! })),
    fuentes: ['DANE (DIVIPOLA)', 'Resolución 866 de 2021'],
    estado: 'pendiente',
    revisado: '2026-10-08',
    nota: 'Solo las capitales de departamento. Falta cargar la tabla DIVIPOLA completa del DANE (1.122 municipios); mientras tanto, otro municipio se escribe como "Nombre (código)".',
  }),
  'codigos.aseguradoras': p<Codificado[]>({
    nombre: 'Aseguradoras (EPS) con su código',
    valor: [
      ['EPS037', 'Nueva EPS (contributivo)'],
      ['EPSS37', 'Nueva EPS (subsidiado)'],
      ['EPS010', 'EPS Sura'],
      ['EPS005', 'Sanitas'],
      ['EPS002', 'Salud Total'],
      ['EPS008', 'Compensar'],
      ['EPS017', 'Famisanar'],
      ['EPS018', 'Servicio Occidental de Salud (SOS)'],
      ['EPS001', 'Aliansalud'],
      ['EPS012', 'Comfenalco Valle'],
      ['EPS040', 'Savia Salud'],
      ['ESS024', 'Coosalud'],
      ['ESS207', 'Mutual Ser'],
      ['ESS062', 'Asmet Salud'],
      ['ESS118', 'Emssanar'],
      ['EPSS34', 'Capital Salud'],
      ['EPS025', 'Capresoca'],
      ['CCF055', 'Cajacopi'],
      ['CCF050', 'Comfaoriente'],
      ['CCF102', 'Comfachocó'],
      ['EPSI01', 'Dusakawi'],
      ['EPSI04', 'Anas Wayuu'],
      ['EPSI05', 'Mallamas'],
      ['EPSI06', 'Pijaos Salud'],
    ].map(([codigo, nombre]) => ({ codigo: codigo!, nombre: nombre! })),
    fuentes: ['Supersalud (códigos de EPS)', 'Resolución 866 de 2021'],
    estado: 'pendiente',
    revisado: '2026-10-08',
    nota: 'Códigos frecuentes, por verificar contra la tabla vigente de la Supersalud (cambian con fusiones y liquidaciones). Otra aseguradora se escribe como "Nombre (código)".',
  }),
  'codigos.cups': p<Partial<Record<string, Codificado>>>({
    nombre: 'Código CUPS de cada examen',
    valor: {
      hemoclasificacion: { codigo: '911016', nombre: 'Hemoclasificación: grupo ABO y factor Rh' },
      hb: { codigo: '902210', nombre: 'Hemograma IV (automatizado)' },
      plaquetas: { codigo: '902210', nombre: 'Hemograma IV (automatizado)' },
      ferritina: { codigo: '903016', nombre: 'Ferritina' },
      vdrl: { codigo: '906915', nombre: 'Prueba no treponémica (VDRL) en suero' },
      vih: { codigo: '906249', nombre: 'VIH 1 y 2, anticuerpos' },
      hepatitisB: { codigo: '906317', nombre: 'Hepatitis B, antígeno de superficie' },
      sifilisTreponemica: { codigo: '906039', nombre: 'Treponema pallidum, anticuerpos (prueba treponémica)' },
      toxoplasmosis: { codigo: '906127', nombre: 'Toxoplasma gondii IgG (y 906129, IgM)' },
      rubeolaIgG: { codigo: '906241', nombre: 'Rubéola, anticuerpos IgG' },
      bacteriuria: { codigo: '901235', nombre: 'Urocultivo' },
      ptog: { codigo: '903843', nombre: 'Glucosa, curva de tolerancia' },
      ecografia: { codigo: '881431', nombre: 'Ecografía obstétrica transabdominal' },
      glucemia: { codigo: '903841', nombre: 'Glucosa en suero' },
      tsh: { codigo: '904902', nombre: 'Hormona estimulante del tiroides (TSH)' },
      uroanalisis: { codigo: '907106', nombre: 'Uroanálisis' },
    },
    fuentes: ['CUPS (MinSalud)', 'Resolución 866 de 2021'],
    estado: 'pendiente',
    revisado: '2026-10-08',
    nota: 'Propuesta por verificar contra la resolución CUPS vigente. Faltan: saturación de transferrina, varicela, Coombs indirecto, PCR en líquido amniótico, Chagas, malaria y estreptococo B.',
  }),
  'codigos.medicamentos': p<Partial<Record<string, MedicamentoCodificado[]>>>({
    nombre: 'Principio activo y código ATC de cada indicación',
    valor: {
      hierro: [{ principio: 'Sulfato ferroso', atc: 'B03AA07' }],
      acidoFolico: [{ principio: 'Ácido fólico', atc: 'B03BB01' }],
      calcio: [{ principio: 'Carbonato de calcio', atc: 'A12AA04' }],
      asa: [{ principio: 'Ácido acetilsalicílico', atc: 'B01AC06' }],
      tromboprofilaxis: [{ principio: 'Enoxaparina', atc: 'B01AB05' }],
      espiramicina: [{ principio: 'Espiramicina', atc: 'J01FA02' }],
      toxoTratamientoPleno: [
        { principio: 'Sulfadiazina', atc: 'J01EC02' },
        { principio: 'Pirimetamina', atc: 'P01BD01' },
        { principio: 'Ácido folínico (folinato cálcico)', atc: 'V03AF03' },
      ],
    },
    fuentes: ['OMS (ATC)', 'Resolución 866 de 2021'],
    estado: 'pendiente',
    revisado: '2026-10-08',
    nota: 'El ATC identifica el principio activo. El CUM (INVIMA) depende del producto que se dispensa y se registra al dispensar. Por confirmar con el equipo clínico qué hierro y qué heparina se usan.',
  }),

  // ---------- Fórmula médica ----------
  'ordenes.medicamentos': p<PlantillaMedicamento[]>({
    nombre: 'Medicamentos frecuentes del control prenatal (plantillas de la fórmula)',
    valor: [
      { principio: 'Sulfato ferroso', atc: 'B03AA07', presentacion: 'Tableta 300 mg (60 mg de hierro elemental)', dosis: '1 tableta', via: 'Oral', frecuencia: 'Cada 24 horas', indicaciones: '2 horas antes o después de las comidas, no con leche, separado 1 hora del calcio.' },
      { principio: 'Ácido fólico', atc: 'B03BB01', presentacion: 'Tableta 1 mg', dosis: '1 tableta', via: 'Oral', frecuencia: 'Cada 24 horas' },
      { principio: 'Carbonato de calcio', atc: 'A12AA04', presentacion: 'Tableta 600 mg', dosis: '2 tabletas (1.200 mg)', via: 'Oral', frecuencia: 'Cada 24 horas', indicaciones: 'Separado 1 hora del hierro; no con leche.' },
      { principio: 'Ácido acetilsalicílico', atc: 'B01AC06', presentacion: 'Tableta 100 mg', dosis: '1 tableta', via: 'Oral', frecuencia: 'Cada 24 horas, en la noche', indicaciones: 'Desde la semana 12 hasta la semana 36.' },
      { principio: 'Enoxaparina', atc: 'B01AB05', presentacion: 'Jeringa prellenada 40 mg / 0,4 mL', dosis: 'Según el peso (ver tromboprofilaxis)', via: 'Subcutánea', frecuencia: 'Cada 24 horas' },
      { principio: 'Espiramicina', atc: 'J01FA02', presentacion: 'Tableta 3.000.000 UI', dosis: '1 tableta', via: 'Oral', frecuencia: 'Cada 8 horas', indicaciones: 'Hasta el parto.' },
      { principio: 'Sulfadiazina', atc: 'J01EC02', presentacion: 'Tableta 500 mg', dosis: '', via: 'Oral', frecuencia: '' },
      { principio: 'Pirimetamina', atc: 'P01BD01', presentacion: 'Tableta 25 mg', dosis: '', via: 'Oral', frecuencia: '' },
      { principio: 'Ácido folínico (folinato cálcico)', atc: 'V03AF03', presentacion: 'Tableta 15 mg', dosis: '', via: 'Oral', frecuencia: '' },
    ],
    fuentes: ['OMS (ATC)', 'Equipo clínico'],
    estado: 'pendiente',
    revisado: '2026-10-08',
    nota: 'Plantillas editables: el profesional ajusta dosis, frecuencia, duración y cantidad en cada fórmula. Por confirmar con el equipo clínico las presentaciones disponibles; la dosis del tratamiento pleno de toxoplasmosis se toma del esquema del catálogo.',
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
