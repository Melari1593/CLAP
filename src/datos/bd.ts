// Almacenamiento local en el dispositivo (IndexedDB). Toda la consulta funciona sin internet (A4).
import Dexie, { type EntityTable } from 'dexie';
import type {
  Alerta,
  Carne,
  Consentimiento,
  Cuestionario,
  Consulta,
  Embarazo,
  EntradaBitacora,
  FactorTransitorio,
  Gestante,
  Indicacion,
  RegistroDerechos,
  ResultadoExamen,
} from './modelo';
import type { ItemCola } from '../sync/cola';
import type { Evento } from '../eventos/eventos';

export interface TablasHistoria {
  gestantes: Gestante;
  embarazos: Embarazo;
  consultas: Consulta;
  examenes: ResultadoExamen;
  indicaciones: Indicacion;
  alertas: Alerta;
  factores: FactorTransitorio;
  derechos: RegistroDerechos;
  carnes: Carne;
  consentimientos: Consentimiento;
  cuestionarios: Cuestionario;
}

export type NombreTabla = keyof TablasHistoria;

export const TABLAS_HISTORIA: NombreTabla[] = [
  'gestantes',
  'embarazos',
  'consultas',
  'examenes',
  'indicaciones',
  'alertas',
  'factores',
  'derechos',
  'carnes',
  'consentimientos',
  'cuestionarios',
];

export class BaseDatos extends Dexie {
  gestantes!: EntityTable<Gestante, 'id'>;
  embarazos!: EntityTable<Embarazo, 'id'>;
  consultas!: EntityTable<Consulta, 'id'>;
  examenes!: EntityTable<ResultadoExamen, 'id'>;
  indicaciones!: EntityTable<Indicacion, 'id'>;
  alertas!: EntityTable<Alerta, 'id'>;
  factores!: EntityTable<FactorTransitorio, 'id'>;
  derechos!: EntityTable<RegistroDerechos, 'id'>;
  carnes!: EntityTable<Carne, 'id'>;
  consentimientos!: EntityTable<Consentimiento, 'id'>;
  cuestionarios!: EntityTable<Cuestionario, 'id'>;
  bitacora!: EntityTable<EntradaBitacora, 'id'>;
  cola!: EntityTable<ItemCola, 'id'>;
  eventos!: EntityTable<Evento, 'id'>;

  constructor(nombre = 'hcp-digital') {
    super(nombre);
    this.version(1).stores({
      gestantes: 'id, &documentoClave, apellidos, nombres',
      embarazos: 'id, gestanteId, estado',
      consultas: 'id, embarazoId, fecha',
      examenes: 'id, embarazoId, consultaId, tipo, fecha',
      indicaciones: 'id, embarazoId, tipo',
      alertas: 'id, embarazoId, regla, activa',
      factores: 'id, embarazoId, tipo',
      derechos: 'id, embarazoId',
      carnes: 'id, embarazoId, &token',
      bitacora: 'id, entidadId, fechaHora, usuarioId',
      cola: 'id, estado, creadoEn',
    });
    this.version(2).stores({ eventos: 'id, embarazoId, tipo, fechaHora, enviado' });
    this.version(3).stores({ consentimientos: 'id, embarazoId, tipo' });
    this.version(4).stores({ cuestionarios: 'id, embarazoId, fechaHora' });
  }
}
