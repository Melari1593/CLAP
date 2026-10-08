import type { Regla } from './motor';
import { REGLAS_CLAP } from './reglasClap';
import { anemia, deficitHierro } from './anemia';
import { asa } from './asa';
import { calcio } from './calcio';
import { tromboprofilaxis } from './trombo';
import { ptog } from './ptog';
import { toxoplasmosis } from './toxoplasmosis';
import { fiebre, saturacionBaja, taquicardiaMaterna, taquipnea } from './signosVitales';
import { alturaUterina, estadoNutricional, frecuenciaCardiacaFetal, movimientosFetales } from './crecimiento';

/** Todas las reglas que evalúa el motor. */
export const REGLAS: Regla[] = [...REGLAS_CLAP, anemia, deficitHierro, asa, calcio, tromboprofilaxis, ptog, toxoplasmosis, fiebre, saturacionBaja, taquicardiaMaterna, taquipnea, movimientosFetales, frecuenciaCardiacaFetal, alturaUterina, estadoNutricional];
