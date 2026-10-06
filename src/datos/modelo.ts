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
  telefono: Campo<string>;
  /** Opcional: solo si la gestante lo usa (canal alterno del carné). */
  correo: Campo<string>;
  etnia: Campo<'blanca' | 'indigena' | 'mestiza' | 'negra' | 'otra'>;
  alfabeta: Campo<SiNo>;
  estudios: Campo<'ninguno' | 'primaria' | 'secundaria' | 'universitaria'>;
  aniosMayorNivel: Campo<number>;
  estadoCivil: Campo<'casada' | 'union_estable' | 'soltera' | 'otro'>;
  viveSola: Campo<SiNo>;
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
  antitetanica: Campo<{ dosisPrevias: number; fechaUltima: FechaISO | null; informacionConfiable: SiNo }>;
  examenOdontologico: Campo<'normal' | 'anormal'>;
  examenMamas: Campo<'normal' | 'anormal'>;
  cervixInspeccion: Campo<'normal' | 'anormal'>;
  cervixPap: Campo<'normal' | 'anormal'>;
  cervixColposcopia: Campo<'normal' | 'anormal'>;
  grupo: Campo<'A' | 'B' | 'AB' | 'O'>;
  rh: Campo<'+' | '-'>;
  inmunizada: Campo<SiNo>;
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
}

// ---------------------------------------------------------------- Seguimiento

export interface DatosSeguimiento {
  pesoKg: Campo<number>;
  paSistolica: Campo<number>;
  paDiastolica: Campo<number>;
  alturaUterinaCm: Campo<number>;
  presentacion: Campo<'cefalica' | 'pelviana' | 'transversa'>;
  fcfLpm: Campo<number>;
  movimientosFetales: Campo<SiNo>;
  proteinuria: Campo<'negativa' | 'trazas' | '1+' | '2+' | '3+'>;
  /** Evento que cambia el riesgo trombótico (D5). */
  diagnosticoPreeclampsia: Campo<SiNo>;
  /** Notas internas del profesional: privado, nunca en el carné. */
  observaciones: Campo<string>;
  iniciales: Campo<string>;
  /** Cambio de residencia: la anemia se reclasifica desde este control (D1). */
  cambioResidencia: Campo<{ municipio: string; altitudM: number }>;
  tomaCalcioDiario: Campo<SiNo>;
  tomaASADiario: Campo<SiNo>;
  aplicaTromboprofilaxisDiario: Campo<SiNo>;
}

export interface Consulta extends Meta {
  embarazoId: string;
  tipo: 'primera' | 'seguimiento';
  fecha: FechaISO;
  profesionalId: string;
  proximaCita: Campo<{ fecha: FechaISO; lugar: string; queLlevar: string }>;
  cerrada: boolean;
  primera?: DatosPrimeraConsulta;
  seguimiento?: DatosSeguimiento;
}

// ---------------------------------------------------------------- Exámenes

export type ResultadoPorTipo = {
  hb: { gdl: number; muestra: 'venosa' | 'capilar' };
  plaquetas: { x10e9L: number };
  ferritina: { ngMl: number };
  saturacionTransferrina: { porcentaje: number };
  vdrl: { reactivo: SiNo; fta: SiNo | null; tratamiento: SiNo | null; tratamientoPareja: SiNo | null };
  /** Privado, nunca en el carné. */
  vih: { solicitado: SiNo; realizado: SiNo; resultado: 'positivo' | 'negativo' | 'no_realizado'; codigo?: string };
  toxoplasmosis: { igg: 'positivo' | 'negativo' | null; igm: 'positivo' | 'negativo' | null };
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

export interface RegistroDerechos extends Meta {
  embarazoId: string;
  fechaHora: FechaHoraISO;
  desencadenante: 'no_planeado' | 'violencia_sexual' | 'menor_14' | 'causal_clinica' | 'pregunta_gestante';
  decision: 'continua' | 'solicita_ive' | 'lo_pensara' | 'no_desea_hablar';
  citaCercana?: FechaISO;
  causal?: 'salud' | 'malformacion' | 'violencia_sexual';
  solicitudIVE?: { fechaHora: FechaHoraISO; prestador: string; remisionFechaHora?: FechaHoraISO; manual: SiNo };
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
  institucionId: string;
  roles: Rol[];
}
