// Tiroides y embarazo (protocolo BCNatal 2025): tamizaje con TSH, clasificación con T4 libre y
// anti-TPO, dosis de levotiroxina por peso, hipertiroidismo y ajuste del hipotiroidismo previo.
import { valorDe } from '../datos/campo';
import { diasEntre } from '../clinico/calculos';
import { coma } from './anemia';
import type { ContextoClinico, Regla, ResultadoRegla } from './motor';

const semana = (dias: number | undefined) => (dias === undefined ? undefined : `${Math.floor(dias / 7)}+${dias % 7}`);

/** Último peso registrado: el de los controles, el de hoy de la primera consulta o el previo al embarazo. */
export function ultimoPeso(ctx: ContextoClinico): number | undefined {
  const pesos = ctx.historia.consultas
    .map((c) => ({ orden: c.fecha + c.creadoEn, peso: valorDe(c.seguimiento?.pesoKg ?? c.primera?.examenFisico?.pesoKg) }))
    .filter((x): x is { orden: string; peso: number } => x.peso !== undefined)
    .sort((a, b) => a.orden.localeCompare(b.orden));
  return pesos.at(-1)?.peso ?? valorDe(ctx.primera?.gestacionActual.pesoAnteriorKg);
}

/** Dosis de levotiroxina por peso, redondeada a 25 µg (presentaciones de 25 en 25). */
function dosis(ctx: ContextoClinico, ugKg: number): string {
  const peso = ultimoPeso(ctx);
  if (!peso) return `${coma(ugKg)} µg/kg al día (registre el peso para calcularla)`;
  const ug = Math.round((peso * ugKg) / 25) * 25;
  return `${coma(ugKg)} µg/kg al día: unos ${ug} µg al día con ${coma(peso)} kg`;
}

export const levotiroxinaVigente = (ctx: ContextoClinico) =>
  ctx.historia.indicaciones.some((i) => i.tipo === 'levotiroxina' && (i.estado === 'indicado' || i.estado === 'ya_lo_toma'));

/** Anti-TPO positivo en el embarazo o conocido de antes. */
export const antiTpoPositivo = (ctx: ContextoClinico) =>
  ctx.ultimo('antiTPO')?.positivo === true || valorDe(ctx.primera?.antecedentesPersonales.antiTpoPrevios) === true;

/** Infertilidad, pérdidas gestacionales o abortos (antecedentes desfavorables del protocolo). */
function antecedentesDesfavorables(ctx: ContextoClinico): boolean {
  const p = ctx.primera;
  return (
    valorDe(p?.antecedentesPersonales.infertilidad) === true ||
    (valorDe(p?.antecedentesObstetricos.abortos) ?? 0) > 0 ||
    (valorDe(p?.antecedentesObstetricos.nacidosMuertos) ?? 0) > 0 ||
    valorDe(p?.antecedentesObstetricos.tresEspontaneosConsecutivos) === true
  );
}

const OPCIONES_LEVOTIROXINA = [
  { etiqueta: 'Levotiroxina indicada', registraIndicacion: { tipo: 'levotiroxina' as const, estado: 'indicado' as const } },
  { etiqueta: 'Referida a endocrinología' },
  { etiqueta: 'Otra conducta', requiereMotivo: true },
];
const OPCIONES_ESTUDIO = [{ etiqueta: 'T4 libre y anti-TPO solicitados' }, { etiqueta: 'Referida a endocrinología' }, { etiqueta: 'Otra conducta', requiereMotivo: true }];

export const tsh: Regla = {
  id: 'tsh',
  evaluar(ctx): ResultadoRegla | null {
    const r = ctx.ultimo('tsh');
    if (!r) return null;
    const { estudiarDesde, clinicoDesde, meta, supresionPersistenteDesdeSemana } = ctx.catalogo.valor('tiroides.cortesTsh');
    const inferior = ctx.catalogo.valor('tsh.limiteInferior');
    const superior = ctx.catalogo.valor('tsh.limiteSuperior');
    const t4rango = ctx.catalogo.valor('tiroides.t4libre');
    const s = semana(ctx.egEn(r.fecha));
    const valor = coma(r.mUIL, 2);
    const dato = s ? `TSH ${valor} mUI/L el ${r.fecha} (semana ${s}).` : `TSH ${valor} mUI/L el ${r.fecha}.`;
    // T4 libre tomada con esta TSH (hasta 14 días antes) o después.
    const t4 = ctx.ultimo('t4libre');
    const t4Actual = t4 && diasEntre(r.fecha, t4.fecha) >= -14 ? t4 : undefined;
    const t4Dato = t4Actual ? `T4 libre ${coma(t4Actual.ngDl, 2)} ng/dL (normal de ${coma(t4rango.inferior, 2)} a ${coma(t4rango.superior, 2)}).` : undefined;
    const t4Baja = t4Actual !== undefined && t4Actual.ngDl < t4rango.inferior;
    const t4Alta = t4Actual !== undefined && t4Actual.ngDl > t4rango.superior;
    const conTratamiento = levotiroxinaVigente(ctx);
    const seguimiento = `Control de TSH cada 4 semanas hasta la semana 20 y al menos una vez entre las semanas 26 y 32. Meta: TSH < ${coma(meta)} mUI/L.`;

    // Hipertiroidismo
    if (r.mUIL < inferior) {
      const egDias = ctx.egEn(r.fecha);
      if (t4Alta) {
        return {
          titulo: 'Hipertiroidismo: TSH suprimida con T4 libre alta',
          porque: [dato, t4Dato!, 'Remitir de inmediato a endocrinología. Solicitar TRAb (anti-TSI) para diferenciar la enfermedad de Graves del hipertiroidismo gestacional.', 'El metimazol está contraindicado en el primer trimestre: se prefiere el propiltiouracilo.'],
          severidad: 3,
          opciones: [{ etiqueta: 'Referida a endocrinología' }, { etiqueta: 'Otra conducta', requiereMotivo: true }],
        };
      }
      if (egDias !== undefined && egDias >= supresionPersistenteDesdeSemana * 7) {
        return {
          titulo: `TSH suprimida después de la semana ${supresionPersistenteDesdeSemana}: remitir a endocrinología`,
          porque: [dato, ...(t4Dato ? [t4Dato] : []), 'El hipertiroidismo gestacional suele resolverse antes; si persiste, descartar enfermedad de Graves (TRAb).'],
          severidad: 2,
          opciones: [{ etiqueta: 'Referida a endocrinología' }, { etiqueta: 'Otra conducta', requiereMotivo: true }],
        };
      }
      return {
        titulo: 'TSH baja: posible hipertiroidismo',
        porque: [
          dato,
          ...(t4Dato ? [t4Dato] : ['Solicitar T4 libre (y TRAb si hay sospecha de enfermedad de Graves).']),
          'En el primer trimestre suele ser transitoria (hCG), sobre todo con hiperémesis: seguimiento sin antitiroideos.',
        ],
        severidad: 1,
        opciones: [{ etiqueta: 'T4 libre solicitada' }, { etiqueta: 'Referida a endocrinología' }, { etiqueta: 'Otra conducta', requiereMotivo: true }],
      };
    }

    // Con levotiroxina: TSH fuera de meta
    if (conTratamiento && r.mUIL >= meta) {
      return {
        titulo: 'TSH fuera de meta con levotiroxina: ajustar la dosis',
        porque: [dato, `Meta: TSH < ${coma(meta)} mUI/L. Aumentar la dosis de 25 a 50 µg y repetir la TSH en 4 semanas.`],
        severidad: r.mUIL >= clinicoDesde ? 3 : 2,
        opciones: [{ etiqueta: 'Dosis ajustada' }, { etiqueta: 'Referida a endocrinología' }, { etiqueta: 'Otra conducta', requiereMotivo: true }],
      };
    }
    if (conTratamiento) return null;

    // Hipotiroidismo clínico por TSH ≥ 10
    if (r.mUIL >= clinicoDesde) {
      const { clinicoInicial } = ctx.catalogo.valor('tiroides.levotiroxina');
      return {
        titulo: 'Hipotiroidismo clínico: TSH de 10 o más',
        porque: [dato, ...(t4Dato ? [t4Dato] : []), `Levotiroxina ${dosis(ctx, clinicoInicial)}, o hasta el doble, para normalizar cuanto antes.`, seguimiento],
        severidad: 3,
        opciones: OPCIONES_LEVOTIROXINA,
      };
    }

    // TSH entre 2,5 y 10
    if (r.mUIL >= estudiarDesde) {
      const tpo = ctx.ultimo('antiTPO');
      if (!t4Actual || (!tpo && valorDe(ctx.primera?.antecedentesPersonales.antiTpoPrevios) !== true)) {
        return {
          titulo: 'TSH elevada: solicitar T4 libre y anti-TPO',
          porque: [dato, `Desde ${coma(estudiarDesde)} mUI/L se completa el estudio con T4 libre y anticuerpos anti-TPO.`, ...(t4Dato ? [t4Dato] : [])],
          severidad: 1,
          opciones: OPCIONES_ESTUDIO,
        };
      }
      const l = ctx.catalogo.valor('tiroides.levotiroxina');
      if (t4Baja && r.mUIL >= superior) {
        return {
          titulo: 'Hipotiroidismo clínico: TSH elevada con T4 libre baja',
          porque: [dato, t4Dato!, `Levotiroxina ${dosis(ctx, l.clinicoInicial)} la primera semana; después ${dosis(ctx, l.clinicoMantenimiento)}.`, seguimiento],
          severidad: 3,
          opciones: OPCIONES_LEVOTIROXINA,
        };
      }
      if (antiTpoPositivo(ctx)) {
        return {
          titulo: 'Hipotiroidismo subclínico con anti-TPO positivo: iniciar levotiroxina',
          porque: [dato, t4Dato!, `Levotiroxina ${dosis(ctx, l.subclinicoAntiTpo)}.`, seguimiento],
          severidad: 2,
          opciones: OPCIONES_LEVOTIROXINA,
        };
      }
      if (r.mUIL >= superior && antecedentesDesfavorables(ctx)) {
        return {
          titulo: 'Hipotiroidismo subclínico con antecedentes desfavorables: iniciar levotiroxina',
          porque: [dato, t4Dato!, 'Antecedente de infertilidad, abortos o pérdidas gestacionales.', `Levotiroxina ${dosis(ctx, l.subclinicoAntecedentes)}.`, seguimiento],
          severidad: 2,
          opciones: OPCIONES_LEVOTIROXINA,
        };
      }
      return {
        titulo: 'Hipotiroidismo subclínico sin criterio de tratamiento',
        porque: [dato, t4Dato!, 'Anti-TPO negativo y sin antecedentes desfavorables: TSH y T4 libre en cada trimestre para descartar la progresión.'],
        severidad: 1,
        opciones: [{ etiqueta: 'Seguimiento programado' }, { etiqueta: 'Otra conducta', requiereMotivo: true }],
      };
    }

    // TSH normal con T4 libre baja
    if (t4Baja) {
      return {
        titulo: 'Hipotiroxinemia: TSH normal con T4 libre baja',
        porque: [dato, t4Dato!, 'No se trata con levotiroxina: asegurar el aporte de yodo.'],
        severidad: 1,
        opciones: [{ etiqueta: 'Atendida' }, { etiqueta: 'Otra conducta', requiereMotivo: true }],
      };
    }
    return null;
  },
};

/** Enfermedad tiroidea conocida antes del embarazo. */
export const tiroidesAntecedente: Regla = {
  id: 'tiroides_antecedente',
  evaluar(ctx) {
    const p = ctx.primera?.antecedentesPersonales;
    const tipo = valorDe(p?.tiroides);
    if (!tipo || tipo === 'no') return null;
    const opcionesRemision = [{ etiqueta: 'Referida a endocrinología' }, { etiqueta: 'Atendida' }, { etiqueta: 'Otra conducta', requiereMotivo: true }];
    if (tipo === 'hipertiroidismo') {
      return {
        titulo: 'Antecedente de hipertiroidismo o enfermedad de Graves',
        porque: [
          'Control conjunto con endocrinología.',
          'Solicitar TRAb (anti-TSI) al inicio del embarazo; repetir entre las semanas 18 y 22 si es positivo o requiere antitiroideos.',
          'El metimazol está contraindicado en el primer trimestre: se prefiere el propiltiouracilo.',
        ],
        severidad: 2,
        opciones: opcionesRemision,
      };
    }
    if (tipo === 'bocio_nodulos') {
      return {
        titulo: 'Bocio o nódulos tiroideos: estudio y remisión a endocrinología',
        porque: ['Un bocio significativo o nódulos tiroideos en el embarazo se estudian igual que fuera del embarazo.', 'Solicitar TSH y T4 libre.'],
        severidad: 1,
        opciones: opcionesRemision,
      };
    }
    const toma = valorDe(ctx.primera?.antecedentesCalcio.levotiroxina) === true;
    const { aumentoPrimarioPct, aumentoAblacionPct } = ctx.catalogo.valor('tiroides.levotiroxina');
    const ablacion = tipo === 'hipotiroidismo_ablacion';
    const [min, max] = ablacion ? aumentoAblacionPct : aumentoPrimarioPct;
    const previa = valorDe(p?.levotiroxinaUgDia);
    const porque = [
      ablacion ? 'Hipotiroidismo por cirugía o yodo radiactivo.' : 'Hipotiroidismo primario (Hashimoto u otro).',
      toma
        ? `Al confirmar el embarazo, aumentar la dosis de levotiroxina entre ${min} y ${max} % (${ablacion ? 'doblar la dosis 3 días por semana' : 'doblar la dosis 2 días por semana'}).`
        : 'No registra levotiroxina: solicitar TSH y T4 libre.',
    ];
    if (toma && previa) {
      const a = Math.round((previa * (1 + min / 100)) / 25) * 25;
      const b = Math.round((previa * (1 + max / 100)) / 25) * 25;
      porque.push(
        a === b
          ? `Dosis previa ${previa} µg al día: nueva dosis de unos ${a} µg al día.`
          : `Dosis previa ${previa} µg al día: nueva dosis de unos ${a} a ${b} µg al día.`,
      );
    }
    porque.push('Si la TSH preconcepcional era menor de 1,2 mUI/L, no se modifica la dosis. Meta: TSH < 2,5 mUI/L.');
    return {
      titulo: 'Hipotiroidismo previo al embarazo: ajustar la levotiroxina',
      porque,
      severidad: 2,
      opciones: toma
        ? [{ etiqueta: 'Dosis ajustada', registraIndicacion: { tipo: 'levotiroxina', estado: 'ya_lo_toma' } }, { etiqueta: 'Referida a endocrinología' }, { etiqueta: 'Otra conducta', requiereMotivo: true }]
        : [{ etiqueta: 'TSH y T4 libre solicitadas' }, { etiqueta: 'Referida a endocrinología' }, { etiqueta: 'Otra conducta', requiereMotivo: true }],
    };
  },
};
