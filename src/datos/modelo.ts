// A2 — Modelo de datos de la HCP digital (control prenatal).
import type { Campo } from './campo';

export type FechaISO = string; // AAAA-MM-DD
export type FechaHoraISO = string; // ISO 8601 completo
export type SiNo = boolean;

/** Metadatos que todo registro lleva para la bitácora y la sincronización (A3, A4). */
export interface Meta {
  id: string;
  institucionId: string;
  creadoEn: FechaHoraISO;
  actualizadoEn: FechaHoraISO;
  actualizadoPor: string;
  dispositivoId: string;
  /** Versión local; sube con cada guardado. */
  version: number;
  /** Última versión que confirmó el servidor (0 si nunca se ha sincronizado). */
  versionServidor: number;
}

// ---------------------------------------------------------------- Gestante y embarazo

export type TipoDocumento = 'CC' | 'TI' | 'RC' | 'CE' | 'PPT' | 'PA' | 'otro';

export interface Gestante extends Meta {
  documentoTipo: TipoDocumento;
  documentoNumero: string;
  /** `${documentoTipo}:${documentoNumero}`; único, evita duplicados (B1). */
  documentoClave: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: Campo<FechaISO>;
}

export interface Embarazo extends Meta {
  gestanteId: string;
  /** Un embarazo nuevo nunca sobrescribe uno anterior: el anterior pasa a "cerrado". */
  estado: 'activo' | 'cerrado';
  inicio: FechaISO;
}

// ---------------------------------------------------------------- Primera consulta

export interface Identificacion {
  domicilio: Campo<string>;
  municipio: Campo<string>;
  /** Altitud de residencia en m s. n. m., registrada por el profesional. */
  altitudM: Campo<number>;
  /** Residencia en zona endémica: define si se piden Chagas y malaria. */
  zonaEndemicaChagas: Campo<SiNo>;
  zonaEndemicaMalaria: Campo<SiNo>;
  telefono: Campo<string>;
  /** Opcional: solo si la gestante lo usa (canal alterno del carné). */
  correo: Campo<string>;
  etnia: Campo<'blanca' | 'indigena' | 'mestiza' | 'negra' | 'otra'>;
  alfabeta: Campo<SiNo>;
  estudios: Campo<'ninguno' | 'primaria' | 'secundaria' | 'universitaria'>;
  aniosMayorNivel: Campo<number>;
  estadoCivil: Campo<'casada' | 'union_estable' | 'soltera' | 'otro'>;
  viveSola: Campo<SiNo>;
  /** Resolución 1995 de 1999, art. 9: ocupación, aseguradora y tipo de vinculación. */
  ocupacion: Campo<string>;
  aseguradora: Campo<string>;
  regimen: Campo<'contributivo' | 'subsidiado' | 'especial' | 'excepcion' | 'no_afiliada'>;
  /** Acompañante en la consulta. */
  acompananteNombre: Campo<string>;
  acompananteParentesco: Campo<string>;
  acompananteTelefono: Campo<string>;
  /** Persona responsable (gestantes menores de 18 años). */
  responsableNombre: Campo<string>;
  responsableParentesco: Campo<string>;
  responsableTelefono: Campo<string>;
}

export interface AntecedentesFamiliares {
  tbc: Campo<SiNo>;
  diabetes: Campo<SiNo>;
  hipertension: Campo<SiNo>;
  preeclampsia: Campo<SiNo>;
  eclampsia: Campo<SiNo>;
  otraCondicionGrave: Campo<SiNo>;
  /** Trombosis sin causa o asociada a hormonas en familiar de primer grado (RCOG). */
  trombosis: Campo<SiNo>;
}

export interface AntecedentesPersonales {
  tbc: Campo<SiNo>;
  diabetes: Campo<'no' | 'tipo1' | 'tipo2' | 'gestacional'>;
  hipertension: Campo<SiNo>;
  preeclampsia: Campo<SiNo>;
  eclampsia: Campo<SiNo>;
  otraCondicionGrave: Campo<SiNo>;
  cirugiaGenitoUrinaria: Campo<SiNo>;
  infertilidad: Campo<SiNo>;
  cardiopatia: Campo<SiNo>;
  nefropatia: Campo<SiNo>;
  violencia: Campo<SiNo>;
  quirurgicos: Campo<string>;
  alergias: Campo<SiNo>;
  alergiasCuales: Campo<string>;
  medicamentosActuales: Campo<string>;
  transfusiones: Campo<SiNo>;
  /** Antecedentes ginecológicos. */
  menarquiaEdad: Campo<number>;
  ciclos: Campo<'regulares' | 'irregulares'>;
  /** Privado, nunca en el carné. */
  inicioVidaSexualEdad: Campo<number>;
  /** Privado, nunca en el carné. */
  itsPrevias: Campo<SiNo>;
}

export interface AntecedentesObstetricos {
  gestas: Campo<number>;
  partosVaginales: Campo<number>;
  cesareas: Campo<number>;
  abortos: Campo<number>;
  tresEspontaneosConsecutivos: Campo<SiNo>;
  ectopicos: Campo<number>;
  nacidosVivos: Campo<number>;
  nacidosMuertos: Campo<number>;
  viven: Campo<number>;
  muertosPrimeraSemana: Campo<number>;
  muertosDespuesPrimeraSemana: Campo<number>;
  pesoUltimoRNg: Campo<number>;
  gemelares: Campo<SiNo>;
  finEmbarazoAnterior: Campo<FechaISO>;
}

export type FracasoMetodo = 'no_usaba' | 'barrera' | 'diu' | 'hormonal' | 'emergencia' | 'natural';

export interface Planificacion {
  embarazoPlaneado: Campo<SiNo>;
  fracasoMetodo: Campo<FracasoMetodo>;
  /** Privado, nunca en el carné. Solo si el embarazo no fue planeado. */
  deseaContinuar: Campo<'si' | 'no' | 'no_ha_decidido'>;
  /** Asesoría en anticoncepción para después del parto (también se registra en los controles). */
  asesoriaAnticoncepcion: Campo<SiNo>;
  /** Privado, nunca en el carné. */
  metodoAnticonceptivoPosparto: Campo<MetodoAnticonceptivoPosparto>;
}

export interface RiesgoPreeclampsia {
  trastornoHipertensivoPrevio: Campo<SiNo>;
  enfermedadRenalCronica: Campo<SiNo>;
  autoinmune: Campo<SiNo>;
  diabetes1o2: Campo<SiNo>;
  hipertensionCronica: Campo<SiNo>;
  antecedenteFamiliarPreeclampsia: Campo<SiNo>;
  embarazoMultiple: Campo<SiNo>;
  alergiaASAoAINE: Campo<SiNo>;
  asmaQueEmpeoraConAINE: Campo<SiNo>;
  fertilizacionInVitro: Campo<SiNo>;
}

export interface AntecedentesCalcio {
  hipercalcemia: Campo<SiNo>;
  hipercalciuria: Campo<SiNo>;
  hiperparatiroidismo: Campo<SiNo>;
  nefrolitiasisONefrocalcinosis: Campo<SiNo>;
  erCronicaGrave: Campo<SiNo>;
  hipersensibilidadCalcio: Campo<SiNo>;
  sarcoidosis: Campo<SiNo>;
  tiazidas: Campo<SiNo>;
  digoxina: Campo<SiNo>;
  levotiroxina: Campo<SiNo>;
  antiacidosConCalcioFrecuentes: Campo<SiNo>;
  vomitoPersistente: Campo<SiNo>;
}

export type Trombofilia =
  | 'deficitAntitrombina'
  | 'deficitProteinaC'
  | 'deficitProteinaS'
  | 'factorVLeidenHomocigota'
  | 'protrombinaHomocigota'
  | 'dobleHeterocigota'
  | 'factorVLeidenHeterocigota'
  | 'protrombinaHeterocigota'
  | 'anticuerposAntifosfolipidos';

export type ComorbilidadAltoRiesgo =
  | 'cancer'
  | 'insuficienciaCardiaca'
  | 'lupusActivo'
  | 'poliartropatiaInflamatoria'
  | 'enfermedadInflamatoriaIntestinal'
  | 'sindromeNefrotico'
  | 'diabetes1ConNefropatia'
  | 'drepanocitosis'
  | 'drogasIntravenosas';

export type FactorSangrado =
  | 'sangradoActivoAntenatal'
  | 'riesgoHemorragiaMayor'
  | 'trastornoHemorragico'
  | 'acvUltimas4Semanas'
  | 'enfermedadRenalGrave'
  | 'enfermedadHepaticaGrave'
  | 'hipertensionNoControlada'
  | 'trombocitopenia'
  | 'alergiaOTrombocitopeniaPorHeparina';

export interface RiesgoTrombotico {
  trombosisPrevia: Campo<SiNo>;
  causaTrombosisPrevia: Campo<'sin_causa' | 'hormonal' | 'cirugia_mayor' | 'otro_resuelto'>;
  trombofilias: Campo<Trombofilia[]>;
  varicesGruesas: Campo<SiNo>;
  comorbilidades: Campo<ComorbilidadAltoRiesgo[]>;
  factoresSangrado: Campo<FactorSangrado[]>;
}

export interface GestacionActual {
  pesoAnteriorKg: Campo<number>;
  tallaCm: Campo<number>;
  fum: Campo<FechaISO>;
  egConfiablePorFum: Campo<SiNo>;
  egConfiablePorEco: Campo<SiNo>;
  /** EG de la ecografía (en días) a la fecha de la ecografía. */
  ecografia: Campo<{ fecha: FechaISO; egDias: number }>;
  fumaActivo: Campo<SiNo>;
  cigarrillosDia: Campo<number | 'no_sabe'>;
  fumaPasivo: Campo<SiNo>;
  /** Privado, nunca en el carné. */
  drogas: Campo<SiNo>;
  /** Privado, nunca en el carné. */
  alcohol: Campo<SiNo>;
  /** Privado, nunca en el carné. En la v1 se registra SÍ/NO. */
  violencia: Campo<SiNo>;
  violenciaSexual: Campo<SiNo>;
  antirrubeola: Campo<'previa' | 'embarazo' | 'no' | 'no_sabe'>;
  /** Antecedente de vacuna contra la varicela (si no la tiene, se pide la IgG). */
  antivaricela: Campo<'previa' | 'no' | 'no_sabe'>;
  antitetanica: Campo<{ dosisPrevias: number; fechaUltima: FechaISO | null; informacionConfiable: SiNo }>;
  examenOdontologico: Campo<'normal' | 'anormal'>;
  examenMamas: Campo<'normal' | 'anormal'>;
  /** Citología cervicovaginal. La inspección visual del cérvix no se registra: no se hace de rutina. */
  cervixPap: Campo<'normal' | 'anormal'>;
  /** Solo si la citología es anormal. */
  cervixColposcopia: Campo<'normal' | 'anormal'>;
  grupo: Campo<'A' | 'B' | 'AB' | 'O'>;
  rh: Campo<'+' | '-'>;
  inmunizada: Campo<SiNo>;
}

/** Anamnesis de cada consulta (Resolución 1995 de 1999). */
export interface Anamnesis {
  motivoConsulta: Campo<string>;
  enfermedadActual: Campo<string>;
  revisionSistemas: Campo<string>;
}

export interface DiagnosticoCie10 {
  codigo: string;
  descripcion: string;
}

/** Cierre clínico de cada consulta: diagnósticos con CIE-10, análisis y plan de manejo. */
export interface DiagnosticoPlan {
  diagnosticos: Campo<DiagnosticoCie10[]>;
  analisis: Campo<string>;
  plan: Campo<string>;
}

/** Examen físico general por sistemas (texto libre; "No se hizo" si no se examinó). */
export interface ExamenGeneral {
  aspectoGeneral: Campo<string>;
  cabezaCuello: Campo<string>;
  cardiopulmonar: Campo<string>;
  abdomen: Campo<string>;
  extremidades: Campo<string>;
  neurologico: Campo<string>;
  piel: Campo<string>;
  otros: Campo<string>;
}

/** Signos vitales, examen obstétrico y examen general de la primera consulta. */
export interface ExamenFisicoPrimera {
  paSistolica: Campo<number>;
  paDiastolica: Campo<number>;
  fcLpm: Campo<number>;
  frRpm: Campo<number>;
  temperaturaC: Campo<number>;
  saturacionPct: Campo<number>;
  alturaUterinaCm: Campo<number>;
  fcfLpm: Campo<number>;
  movimientosFetales: Campo<SiNo>;
  general: ExamenGeneral;
}

export interface DatosPrimeraConsulta {
  identificacion: Identificacion;
  antecedentesFamiliares: AntecedentesFamiliares;
  antecedentesPersonales: AntecedentesPersonales;
  antecedentesObstetricos: AntecedentesObstetricos;
  planificacion: Planificacion;
  riesgoPreeclampsia: RiesgoPreeclampsia;
  antecedentesCalcio: AntecedentesCalcio;
  riesgoTrombotico: RiesgoTrombotico;
  gestacionActual: GestacionActual;
  anamnesis: Anamnesis;
  examenFisico: ExamenFisicoPrimera;
  diagnosticoPlan: DiagnosticoPlan;
}

// ---------------------------------------------------------------- Seguimiento

export interface DatosSeguimiento {
  anamnesis: Anamnesis;
  diagnosticoPlan: DiagnosticoPlan;
  pesoKg: Campo<number>;
  paSistolica: Campo<number>;
  paDiastolica: Campo<number>;
  fcLpm: Campo<number>;
  frRpm: Campo<number>;
  temperaturaC: Campo<number>;
  saturacionPct: Campo<number>;
  examenGeneral: ExamenGeneral;
  alturaUterinaCm: Campo<number>;
  presentacion: Campo<'cefalica' | 'pelviana' | 'transversa'>;
  fcfLpm: Campo<number>;
  movimientosFetales: Campo<SiNo>;
  proteinuria: Campo<'negativa' | 'trazas' | '1+' | '2+' | '3+'>;
  /** Evento que cambia el riesgo trombótico (D5). */
  diagnosticoPreeclampsia: Campo<SiNo>;
  /** Se preguntó en este trimestre por tabaco, alcohol y violencia (recordatorio F1). */
  tamizajeTrimestral: Campo<SiNo>;
  /** Notas internas del profesional: privado, nunca en el carné. */
  observaciones: Campo<string>;
  iniciales: Campo<string>;
  /** Cambio de residencia: la anemia se reclasifica desde este control (D1). */
  cambioResidencia: Campo<{ municipio: string; altitudM: number }>;
  /** Vacuna Tdap (tosferina) aplicada en este control (recordatorio desde la semana 26). */
  tdapAplicada: Campo<SiNo>;
  /** Inmunoglobulina anti-D aplicada en este control (Rh negativo no sensibilizada). */
  antiDAplicada: Campo<SiNo>;
  tomaCalcioDiario: Campo<SiNo>;
  tomaASADiario: Campo<SiNo>;
  aplicaTromboprofilaxisDiario: Campo<SiNo>;
  /** Asesoría en anticoncepción para después del parto realizada en este control. */
  asesoriaAnticoncepcion: Campo<SiNo>;
  /** Método que la gestante eligió para después del parto. Privado, nunca en el carné. */
  metodoAnticonceptivoPosparto: Campo<MetodoAnticonceptivoPosparto>;
}

/** Opciones de la HCP del CLAP (anticoncepción al egreso), con el implante y la no decisión. */
export type MetodoAnticonceptivoPosparto =
  | 'diu_posparto'
  | 'diu'
  | 'implante'
  | 'hormonal'
  | 'barrera'
  | 'ligadura'
  | 'natural'
  | 'otro'
  | 'ninguno'
  | 'no_ha_decidido';

export interface Consulta extends Meta {
  embarazoId: string;
  tipo: 'primera' | 'seguimiento';
  fecha: FechaISO;
  profesionalId: string;
  proximaCita: Campo<{ fecha: FechaISO; lugar: string; queLlevar: string }>;
  cerrada: boolean;
  primera?: DatosPrimeraConsulta;
  seguimiento?: DatosSeguimiento;
  /** Quién cerró la consulta: nombre, registro profesional, fecha y hora (Resolución 1995 de 1999). */
  cierre?: { profesional: string; registroProfesional: string | null; fechaHora: FechaHoraISO };
}

// ---------------------------------------------------------------- Exámenes

export type ResultadoPorTipo = {
  /** Hemoclasificación de laboratorio: se pide a todas, aunque haya declarado su grupo. */
  hemoclasificacion: { grupo: 'A' | 'B' | 'AB' | 'O'; rh: '+' | '-' };
  hb: { gdl: number; muestra: 'venosa' | 'capilar' };
  plaquetas: { x10e9L: number };
  ferritina: { ngMl: number };
  saturacionTransferrina: { porcentaje: number };
  vdrl: { reactivo: SiNo; fta: SiNo | null; tratamiento: SiNo | null; tratamientoPareja: SiNo | null };
  /** Privado, nunca en el carné. */
  vih: { solicitado: SiNo; realizado: SiNo; resultado: 'positivo' | 'negativo' | 'no_realizado'; codigo?: string };
  /** Antígeno de superficie de hepatitis B. */
  hepatitisB: { antigenoSuperficie: 'positivo' | 'negativo' };
  /** Prueba treponémica rápida para sífilis (primera consulta y tercer trimestre). */
  sifilisTreponemica: { reactiva: SiNo };
  /** Coombs indirecto (gestantes Rh negativo). */
  coombsIndirecto: { positivo: SiNo };
  /** IgG para rubéola (si no hay evidencia de vacuna). */
  rubeolaIgG: { positivo: SiNo };
  /** IgG para varicela zóster. */
  varicelaIgG: { positivo: SiNo };
  ecografia: { momento: 'primer_trimestre' | 'detalle' | 'otra'; hallazgos: 'normal' | 'anormal' };
  /**
   * Toxoplasmosis: IgG e IgM. El título de IgG (UI/mL) permite ver si se duplica entre dos muestras;
   * IgA y avidez de IgG se piden cuando la IgG se duplica con IgM negativa.
   */
  toxoplasmosis: {
    igg: 'positivo' | 'negativo' | null;
    igm: 'positivo' | 'negativo' | null;
    iggTitulo?: number | null;
    iga?: 'positivo' | 'negativo' | null;
    avidez?: 'alta' | 'intermedia' | 'baja' | null;
  };
  /** PCR para toxoplasma en líquido amniótico. */
  pcrLiquidoAmniotico: { positivo: SiNo };
  chagas: { positivo: SiNo };
  malaria: { positivo: SiNo };
  bacteriuria: { positivo: SiNo };
  ptog: { ayunas: Campo<number>; unaHora: Campo<number>; dosHoras: Campo<number> };
  egb: { positivo: SiNo };
  inflamacion: { presente: SiNo; descripcion: string };
};

export type TipoExamen = keyof ResultadoPorTipo;

export type ResultadoExamen = {
  [K in TipoExamen]: Meta & {
    embarazoId: string;
    consultaId: string;
    fecha: FechaISO;
    tipo: K;
    resultado: Campo<ResultadoPorTipo[K]>;
  };
}[TipoExamen];

// ---------------------------------------------------------------- Indicaciones, alertas, factores

export type TipoIndicacion =
  | 'hierro'
  | 'acidoFolico'
  | 'calcio'
  | 'asa'
  | 'tromboprofilaxis'
  /** Toxoplasmosis: tratamiento placentario. */
  | 'espiramicina'
  /** Toxoplasmosis: tratamiento pleno (sulfadiazina + pirimetamina + ácido folínico). */
  | 'toxoTratamientoPleno'
  | 'preparacionParto'
  | 'lactancia';

export interface Indicacion extends Meta {
  embarazoId: string;
  tipo: TipoIndicacion;
  estado: 'indicado' | 'no_indicado' | 'ya_lo_toma' | 'referida' | 'suspendido';
  motivo?: string;
  fechaInicio?: FechaISO;
  fechaSuspension?: FechaISO;
  detalle?: string;
}

export interface DecisionAlerta {
  opcion: string;
  motivo?: string;
  fecha: FechaHoraISO;
  profesionalId: string;
  /** Severidad de la regla cuando se atendió; si sube después, la alerta reaparece (C1). */
  severidadAtendida: number;
}

export interface OpcionDecision {
  etiqueta: string;
  requiereMotivo?: boolean;
  /** Al elegirla se registra también la indicación (por ejemplo, "ASA indicado"). */
  registraIndicacion?: { tipo: TipoIndicacion; estado: Indicacion['estado'] };
}

/**
 * Una alerta por regla y embarazo. "vigente": la condición se cumple hoy.
 * "activa": vigente y sin atender, o atendida pero la situación empeoró después (C1).
 */
export interface Alerta extends Meta {
  embarazoId: string;
  regla: string;
  urgente: boolean;
  /** Nivel de la regla; si sube después de atendida, la alerta reaparece. */
  severidad: number;
  titulo: string;
  porque: string[];
  opciones: OpcionDecision[];
  /** Pantalla a la que lleva la alerta (por ejemplo, "Opciones y derechos", tarea E1). */
  enlace?: 'derechos';
  vigente: boolean;
  activa: boolean;
  decision?: DecisionAlerta;
  /** Decisiones anteriores, si la alerta reapareció. */
  decisionesAnteriores?: DecisionAlerta[];
}

export type TipoFactorTransitorio =
  | 'hiperemesis'
  | 'cirugia'
  | 'hiperestimulacionOvarica'
  | 'infeccionSistemica'
  | 'inmovilidadODeshidratacion'
  | 'hospitalizacion';

export interface FactorTransitorio extends Meta {
  embarazoId: string;
  tipo: TipoFactorTransitorio;
  inicio: FechaISO;
  resolucion?: FechaISO;
  conHospitalizacion: SiNo;
}

// ---------------------------------------------------------------- Derechos (sección 7): todo privado

export type DesencadenanteDerechos = 'no_planeado' | 'violencia_sexual' | 'violencia_mujer' | 'menor_14' | 'causal_clinica' | 'pregunta_gestante';
export type DecisionDerechos = 'continua' | 'solicita_ive' | 'lo_pensara' | 'no_desea_hablar';
export type Causal = 'salud' | 'malformacion' | 'violencia_sexual';

export interface RegistroDerechos extends Meta {
  embarazoId: string;
  fechaHora: FechaHoraISO;
  desencadenante: DesencadenanteDerechos;
  /** EG del día del registro (en días), o null si no era confiable. */
  egDias: number | null;
  /** Se ofreció un momento a solas antes de preguntar. */
  momentoASolas: SiNo;
  decision: DecisionDerechos;
  /** "Lo pensará": nueva cita cercana, sin dilatar. */
  citaCercana?: FechaISO;
  /** Causal identificada (obligatoria después de la semana 24). */
  causal?: Causal;
  solicitudIVE?: {
    fechaHora: FechaHoraISO;
    prestador: string;
    /** El prestador se escribió a mano porque la institución no tiene uno configurado. */
    manual: SiNo;
    remisionFechaHora?: FechaHoraISO;
  };
  rutaViolencia?: { activadaFechaHora: FechaHoraISO; notificaciones: { a: string; fechaHora: FechaHoraISO }[] };
  notas?: string;
}

// ---------------------------------------------------------------- Carné

/** Canales por los que se entrega el enlace del carné. */
export type CanalEnvio = 'whatsapp' | 'correo' | 'impreso';

export interface Carne extends Meta {
  embarazoId: string;
  /** Token del enlace. Cambiar el número genera uno nuevo e invalida el anterior. */
  token: string;
  pinHash: string;
  pinSal: string;
  canal: CanalEnvio;
  destino?: string;
  estado: 'activo' | 'pausado';
  intentosFallidos: number;
  bloqueadoHasta?: FechaHoraISO;
}

// ---------------------------------------------------------------- Bitácora

export interface CambioBitacora {
  ruta: string;
  antes: unknown;
  despues: unknown;
}

export interface EntradaBitacora {
  id: string;
  fechaHora: FechaHoraISO;
  usuarioId: string;
  institucionId: string;
  dispositivoId: string;
  entidad: string;
  entidadId: string;
  accion: 'crear' | 'editar';
  cambios: CambioBitacora[];
}

// ---------------------------------------------------------------- Usuarios y roles (A3)

export type Rol = 'profesional_autorizado' | 'administrativo';

export interface Usuario {
  id: string;
  nombre: string;
  /** Registro profesional (ReTHUS o tarjeta profesional). */
  registroProfesional?: string;
  institucionId: string;
  roles: Rol[];
}
