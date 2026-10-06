// D6 — Diabetes gestacional por PTOG de 75 g (GPC colombiana).
import { valorDe } from '../datos/campo';
import type { Regla } from './motor';

export const ptog: Regla = {
  id: 'ptog',
  evaluar(ctx) {
    const r = ctx.ultimo('ptog');
    if (!r) return null;
    const cortes = ctx.catalogo.valor('ptog.cortes');
    const { desdeSemana, hastaSemana } = ctx.catalogo.valor('ptog.ventana');
    const valores = [
      ['ayunas', 'Ayunas', valorDe(r.ayunas), cortes.ayunas],
      ['unaHora', '1 hora', valorDe(r.unaHora), cortes.unaHora],
      ['dosHoras', '2 horas', valorDe(r.dosHoras), cortes.dosHoras],
    ] as const;

    const faltan = valores.filter(([, , v]) => v === undefined).map(([, nombre]) => nombre);
    if (faltan.length > 0) {
      return {
        titulo: 'PTOG incompleta: no se puede clasificar',
        porque: [`Falta el valor de: ${faltan.join(', ')}. Complete el resultado.`],
        opciones: [{ etiqueta: 'Valor solicitado' }, { etiqueta: 'Repetir la prueba' }],
      };
    }

    const alterados = valores.filter(([, , v, corte]) => v! >= corte);
    if (alterados.length === 0) return null;
    const porque = alterados.map(([, nombre, v, corte]) => `${nombre}: ${v} mg/dL (alterado desde ${corte}).`);
    const egDias = ctx.egEn(r.fecha);
    if (egDias !== undefined && (egDias < desdeSemana * 7 || egDias >= (hastaSemana + 1) * 7)) {
      porque.push(`Se hizo en la semana ${Math.floor(egDias / 7)}+${egDias % 7}, fuera de las semanas ${desdeSemana} a ${hastaSemana}.`);
    }
    return {
      titulo: 'Diabetes gestacional: PTOG alterada',
      porque,
      severidad: 2,
      opciones: [{ etiqueta: 'Manejo iniciado' }, { etiqueta: 'Referida' }, { etiqueta: 'Otra conducta', requiereMotivo: true }],
    };
  },
};
