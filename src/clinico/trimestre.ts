import type { Catalogo } from './catalogo';

/** Trimestre según la edad gestacional en días, con los límites del catálogo. */
export function trimestreDeEG(egDias: number, catalogo: Catalogo): 1 | 2 | 3 {
  const { finPrimeroSemanas, finSegundoSemanas } = catalogo.valor('trimestres.limites');
  if (egDias < finPrimeroSemanas * 7) return 1;
  if (egDias < finSegundoSemanas * 7) return 2;
  return 3;
}
