// Glucemia en ayunas y TSH del primer trimestre (cortes en el catálogo, pendientes de confirmar).
import { coma } from './anemia';
import type { Regla } from './motor';

const semanaDe = (dias: number | undefined) => (dias === undefined ? undefined : `${Math.floor(dias / 7)}+${dias % 7}`);

export const glucemia: Regla = {
  id: 'glucemia',
  evaluar(ctx) {
    const r = ctx.ultimo('glucemia');
    if (!r) return null;
    const { diabetesGestacionalDesde, diabetesDesde } = ctx.catalogo.valor('glucemia.cortes');
    const semana = semanaDe(ctx.egEn(r.fecha));
    const dato = semana ? `Glucemia en ayunas ${r.mgDl} mg/dL el ${r.fecha} (semana ${semana}).` : `Glucemia en ayunas ${r.mgDl} mg/dL el ${r.fecha}.`;
    const opciones = [
      { etiqueta: 'Manejo iniciado' },
      { etiqueta: 'Referida' },
      { etiqueta: 'Repetir la prueba' },
      { etiqueta: 'Otra conducta', requiereMotivo: true },
    ];
    if (r.mgDl >= diabetesDesde) {
      return {
        titulo: 'Diabetes manifiesta en el embarazo: glucemia en ayunas alterada',
        porque: [dato, `Desde ${diabetesDesde} mg/dL: diabetes manifiesta (criterios IADPSG/OMS 2013).`, 'Remitir a control prenatal de alto riesgo.'],
        severidad: 3,
        opciones,
      };
    }
    if (r.mgDl >= diabetesGestacionalDesde) {
      return {
        titulo: 'Diabetes gestacional: glucemia en ayunas alterada',
        porque: [dato, `Desde ${diabetesGestacionalDesde} mg/dL: diabetes gestacional (criterios IADPSG/OMS 2013).`, 'Consejería en alimentación y actividad física, y seguimiento de la glucemia.'],
        severidad: 2,
        opciones,
      };
    }
    return null;
  },
};

export const tsh: Regla = {
  id: 'tsh',
  evaluar(ctx) {
    const r = ctx.ultimo('tsh');
    if (!r) return null;
    const superior = ctx.catalogo.valor('tsh.limiteSuperior');
    const inferior = ctx.catalogo.valor('tsh.limiteInferior');
    const semana = semanaDe(ctx.egEn(r.fecha));
    const valor = coma(r.mUIL, 2);
    const dato = semana ? `TSH ${valor} mUI/L el ${r.fecha} (semana ${semana}).` : `TSH ${valor} mUI/L el ${r.fecha}.`;
    const opciones = [{ etiqueta: 'T4 libre solicitada' }, { etiqueta: 'Referida' }, { etiqueta: 'Otra conducta', requiereMotivo: true }];
    if (r.mUIL > superior) {
      return {
        titulo: 'TSH elevada: posible hipotiroidismo',
        porque: [dato, `Por encima de ${coma(superior)} mUI/L.`, 'Solicitar T4 libre y anticuerpos antiperoxidasa tiroidea (anti-TPO) y valorar tratamiento.'],
        severidad: 2,
        opciones,
      };
    }
    if (r.mUIL < inferior) {
      return {
        titulo: 'TSH baja: posible hipertiroidismo',
        porque: [dato, `Por debajo de ${coma(inferior)} mUI/L.`, 'Solicitar T4 libre y valorar: en el primer trimestre puede ser transitoria (hCG).'],
        severidad: 1,
        opciones,
      };
    }
    return null;
  },
};
