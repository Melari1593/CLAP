import { createContext, useContext } from 'react';
import type { Catalogo } from '../clinico/catalogo';
import type { BaseDatos } from '../datos/bd';
import type { FechaISO } from '../datos/modelo';
import type { Repositorio } from '../datos/repositorio';
import type { ServicioConsultas } from '../consultas/servicio';

export interface Contexto {
  bd: BaseDatos;
  repo: Repositorio;
  servicio: ServicioConsultas;
  catalogo: Catalogo;
  hoy: () => FechaISO;
}

export const ContextoApp = createContext<Contexto | null>(null);

export function useApp(): Contexto {
  const ctx = useContext(ContextoApp);
  if (!ctx) throw new Error('Falta ContextoApp');
  return ctx;
}

export type Pantalla =
  | { tipo: 'buscar' }
  | { tipo: 'ficha'; gestanteId: string }
  | { tipo: 'primera'; gestanteId: string; embarazoId: string; consultaId?: string }
  | { tipo: 'seguimiento'; gestanteId: string; embarazoId: string; consultaId?: string }
  | { tipo: 'catalogo' };
