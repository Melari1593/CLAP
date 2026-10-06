// Información para el resumen que no es una alerta (la pantalla completa es la tarea F2).
import type { ContextoClinico } from './motor';
import { evaluarFerritina } from './anemia';
import { evaluarASA } from './asa';
import { evaluarCalcio } from './calcio';
import { evaluarTrombo } from './trombo';

export function notasResumen(ctx: ContextoClinico): string[] {
  const notas: string[] = [];
  const asa = evaluarASA(ctx);
  if (asa?.cumpleCriterio && asa.antesDeInicio && asa.fechaInicio) {
    const factores = [...asa.altos, ...asa.moderados].join('; ');
    notas.push(`ASA: iniciar en la semana ${ctx.catalogo.valor('asa.semanaInicio')} (${asa.fechaInicio}). Factores: ${factores}.`);
  }
  const calcio = evaluarCalcio(ctx);
  if (calcio?.antesDeInicio && calcio.fechaInicio) {
    notas.push(`Calcio: iniciar en la semana ${ctx.catalogo.valor('calcio.indicacion').semanaInicio} (${calcio.fechaInicio}).`);
  }
  const trombo = evaluarTrombo(ctx);
  if (trombo) notas.push(`Puntaje de riesgo trombótico: ${trombo.puntaje}.`);
  const ferritina = evaluarFerritina(ctx);
  if (ferritina?.tipo === 'dato_sin_anemia') {
    notas.push(`Ferritina ${ferritina.ferritina} ng/mL sin anemia${ferritina.deficit ? ': déficit de hierro sin anemia (≤ 30 ng/mL)' : ''}. Solo como dato.`);
  }
  const { desdeSemana, hastaSemana } = ctx.catalogo.valor('ptog.ventana');
  if (ctx.eg.estado === 'calculada' && ctx.eg.semanas >= desdeSemana - 1 && ctx.eg.semanas <= hastaSemana && !ctx.ultimo('ptog')) {
    notas.push(`PTOG de 75 g entre las semanas ${desdeSemana} y ${hastaSemana}. Antes de solicitarla, explicar: ${ctx.catalogo.valor('ptog.informacionGestante').join(' ')}`);
  }
  return notas;
}
