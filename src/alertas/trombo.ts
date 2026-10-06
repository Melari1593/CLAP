// D5 — Tromboprofilaxis (RCOG 37a con las modificaciones de su declaración de posición).
import { imc, sumarDias } from '../clinico/calculos';
import { valorEnBanda, type DosisHeparina } from '../clinico/catalogo';
import { valorDe, type Campo } from '../datos/campo';
import type { FactorTransitorio, FechaISO, TipoFactorTransitorio } from '../datos/modelo';
import type { ContextoClinico, Regla } from './motor';

const NOMBRE_TRANSITORIO: Record<TipoFactorTransitorio, string> = {
  hiperemesis: 'Hiperémesis',
  cirugia: 'Cirugía en el embarazo',
  hiperestimulacionOvarica: 'Síndrome de hiperestimulación ovárica',
  infeccionSistemica: 'Infección sistémica (antibióticos IV u hospitalización)',
  inmovilidadODeshidratacion: 'Inmovilidad o deshidratación',
  hospitalizacion: 'Hospitalización antenatal',
};

const PUNTOS_TRANSITORIO: Partial<Record<TipoFactorTransitorio, string>> = {
  cirugia: 'cirugiaEnEmbarazo',
  hiperestimulacionOvarica: 'hiperestimulacionOvarica',
  infeccionSistemica: 'infeccionSistemica',
  inmovilidadODeshidratacion: 'inmovilidadODeshidratacion',
  hiperemesis: 'hiperemesis',
};

export interface FactorPuntaje {
  nombre: string;
  puntos: number;
}

export interface EvaluacionTrombo {
  puntaje: number;
  factores: FactorPuntaje[];
  nivel: 'sin_alerta' | 'semana_28' | 'desde_ahora';
  casosEspeciales: string[];
  remisionEspecialista: string[];
  sangrado: string[];
  dosis?: { pesoKg: number; texto: DosisHeparina };
  suspensiones: { factor: string; fecha: FechaISO }[];
}

const activo = (f: FactorTransitorio, hoy: FechaISO) => !f.resolucion || f.resolucion > hoy;

export function evaluarTrombo(ctx: ContextoClinico): EvaluacionTrombo | undefined {
  const d = ctx.primera;
  if (!d) return undefined;
  const { catalogo, hoy } = ctx;
  const puntos = catalogo.valor('trombo.puntos');
  const especiales = catalogo.valor('trombo.casosEspeciales');
  const si = (c: Campo<boolean> | undefined) => valorDe(c) === true;
  const factores: FactorPuntaje[] = [];
  const sumar = (clave: string, nombre: string) => factores.push({ nombre, puntos: puntos[clave] ?? 0 });

  // Trombosis previa y trombofilias
  const rt = d.riesgoTrombotico;
  const trombosisPrevia = si(rt.trombosisPrevia);
  if (trombosisPrevia) {
    if (valorDe(rt.causaTrombosisPrevia) === 'cirugia_mayor') sumar('trombosisPreviaCirugiaMayor', 'Trombosis previa provocada por cirugía mayor');
    else sumar('trombosisPrevia', 'Trombosis previa');
  }
  const trombofilias = valorDe(rt.trombofilias) ?? [];
  const { alto, bajo } = catalogo.valor('trombo.trombofilias');
  const trombofiliaAlta = trombofilias.some((t) => alto.includes(t));
  if (trombofiliaAlta) sumar('trombofiliaAltoRiesgo', 'Trombofilia de alto riesgo');
  else if (trombofilias.some((t) => bajo.includes(t)) && !trombosisPrevia) sumar('trombofiliaBajoRiesgoSinTrombosis', 'Trombofilia de bajo riesgo sin trombosis');
  if ((valorDe(rt.comorbilidades) ?? []).length > 0) sumar('comorbilidadAltoRiesgo', 'Comorbilidad de alto riesgo');

  // IMC de la primera consulta
  const peso = valorDe(d.gestacionActual.pesoAnteriorKg);
  const talla = valorDe(d.gestacionActual.tallaCm);
  const imcValor = peso !== undefined && talla ? imc(peso, talla, catalogo).valor : undefined;
  if (imcValor !== undefined) {
    const txt = `IMC de ${imcValor.toString().replace('.', ',')}`;
    if (imcValor >= 50) sumar('imc50oMas', txt);
    else if (imcValor >= 40) sumar('imc40a49', txt);
    else if (imcValor >= 30) sumar('imc30a39', txt);
  }

  // Factores de 1 punto
  if (si(d.antecedentesFamiliares.trombosis)) sumar('antecedenteFamiliarTrombosis', 'Antecedente familiar de trombosis');
  if (ctx.edad !== undefined && ctx.edad > 35) sumar('edadMayorDe35', `Edad de ${ctx.edad} años`);
  const partos = (valorDe(d.antecedentesObstetricos.partosVaginales) ?? 0) + (valorDe(d.antecedentesObstetricos.cesareas) ?? 0);
  if (partos >= 3) sumar('paridad3oMas', `Paridad de ${partos}`);
  if (si(d.gestacionActual.fumaActivo)) sumar('tabaquismo', 'Tabaquismo');
  if (si(rt.varicesGruesas)) sumar('varicesGruesas', 'Várices gruesas');
  if (ctx.seguimientos.some((c) => si(c.seguimiento?.diagnosticoPreeclampsia))) sumar('preeclampsia', 'Preeclampsia en este embarazo');
  if (si(d.riesgoPreeclampsia.fertilizacionInVitro)) sumar('reproduccionAsistida', 'Fertilización in vitro o reproducción asistida');
  if (si(d.riesgoPreeclampsia.embarazoMultiple)) sumar('embarazoMultiple', 'Embarazo múltiple');

  // Factores transitorios activos (los resueltos ya no suman)
  const transitorios = ctx.historia.factores;
  for (const f of transitorios.filter((f) => activo(f, hoy))) {
    const clave = PUNTOS_TRANSITORIO[f.tipo];
    if (clave) sumar(clave, `${NOMBRE_TRANSITORIO[f.tipo]} (desde ${f.inicio})`);
  }

  const puntaje = factores.reduce((s, f) => s + f.puntos, 0);
  const { desdeAhora, desdeSemana28 } = catalogo.valor('trombo.umbrales');

  // Casos especiales
  const casosEspeciales: string[] = [];
  if (imcValor !== undefined && imcValor >= especiales.imcTodoElEmbarazo) {
    casosEspeciales.push('IMC de 50 o más: ofrecer tromboprofilaxis durante todo el embarazo y 6 semanas posparto.');
  }
  const activos = transitorios.filter((f) => activo(f, hoy));
  if (activos.some((f) => f.tipo === 'hiperemesis')) {
    casosEspeciales.push(`Hiperémesis: ofrecer tromboprofilaxis e iniciarla en las primeras ${especiales.horasInicioHiperemesis} horas.`);
  }
  if (activos.some((f) => f.conHospitalizacion && f.tipo !== 'hospitalizacion' && (f.tipo === 'hiperemesis' || f.tipo === 'inmovilidadODeshidratacion'))) {
    casosEspeciales.push(`Hospitalización con factor transitorio: tromboprofilaxis mientras dure el factor y ${especiales.diasTrasResolverTransitorio} días más después de que se resuelva.`);
  }
  if (activos.some((f) => f.tipo === 'hospitalizacion' || (f.conHospitalizacion && f.tipo !== 'hiperemesis' && f.tipo !== 'inmovilidadODeshidratacion'))) {
    casosEspeciales.push('Hospitalización antenatal: considerar tromboprofilaxis.');
  }

  const remisionEspecialista: string[] = [];
  if (trombofiliaAlta || trombosisPrevia) {
    remisionEspecialista.push(
      `${trombofiliaAlta ? 'Trombofilia de alto riesgo' : 'Trombosis previa'}: sugerir remisión al equipo o especialista en trombosis en el embarazo.`,
    );
  }

  // Riesgo de sangrado, incluida la trombocitopenia detectada desde el hemograma
  const nombresSangrado: Record<string, string> = {
    sangradoActivoAntenatal: 'Sangrado activo antenatal',
    riesgoHemorragiaMayor: 'Riesgo aumentado de hemorragia mayor',
    trastornoHemorragico: 'Trastorno hemorrágico',
    acvUltimas4Semanas: 'ACV en las últimas 4 semanas',
    enfermedadRenalGrave: 'Enfermedad renal grave',
    enfermedadHepaticaGrave: 'Enfermedad hepática grave',
    hipertensionNoControlada: 'Hipertensión no controlada',
    trombocitopenia: 'Trombocitopenia',
    alergiaOTrombocitopeniaPorHeparina: 'Alergia o trombocitopenia inducida por heparina',
  };
  const sangrado = (valorDe(rt.factoresSangrado) ?? []).map((s) => nombresSangrado[s] ?? s);
  const plaquetas = ctx.ultimo('plaquetas');
  const limite = catalogo.valor('trombo.plaquetasSangrado');
  if (plaquetas && plaquetas.x10e9L < limite && !sangrado.includes('Trombocitopenia')) {
    sangrado.push(`Trombocitopenia: plaquetas de ${plaquetas.x10e9L} × 10⁹/L (menos de ${limite}) en el hemograma del ${plaquetas.fecha}`);
  }

  // Fechas de suspensión de factores transitorios resueltos
  const suspensiones = transitorios
    .filter((f) => f.resolucion && PUNTOS_TRANSITORIO[f.tipo] !== undefined)
    .map((f) => ({ factor: NOMBRE_TRANSITORIO[f.tipo], fecha: sumarDias(f.resolucion!, especiales.diasTrasResolverTransitorio) }))
    .filter((s) => s.fecha >= hoy);

  return {
    puntaje,
    factores,
    nivel: puntaje >= desdeAhora ? 'desde_ahora' : puntaje >= desdeSemana28 ? 'semana_28' : 'sin_alerta',
    casosEspeciales,
    remisionEspecialista,
    sangrado,
    dosis: peso !== undefined ? { pesoKg: peso, texto: dosisPorPeso(peso, ctx) } : undefined,
    suspensiones,
  };
}

function dosisPorPeso(peso: number, ctx: ContextoClinico): DosisHeparina {
  const d = valorEnBanda(ctx.catalogo.valor('trombo.dosisPorPeso'), peso);
  // En la franja más alta la dosis es por kg: se muestra también el total.
  const porKg = (texto: string, factor: number, unidad: string) =>
    texto.includes('/kg') ? `${texto} (${Math.round(peso * factor).toLocaleString('es-CO')} ${unidad} al día)` : texto;
  return {
    enoxaparina: porKg(d.enoxaparina, 0.6, 'mg'),
    dalteparina: porKg(d.dalteparina, 75, 'UI'),
    tinzaparina: porKg(d.tinzaparina, 75, 'UI'),
  };
}

export const tromboprofilaxis: Regla = {
  id: 'tromboprofilaxis',
  evaluar(ctx) {
    const e = evaluarTrombo(ctx);
    if (!e) return null;
    const indicada = ctx.historia.indicaciones.find((i) => i.tipo === 'tromboprofilaxis' && (i.estado === 'indicado' || i.estado === 'ya_lo_toma'));
    const hayCriterio = e.nivel !== 'sin_alerta' || e.casosEspeciales.length > 0;

    if (!hayCriterio) {
      // Sin criterio: solo avisa la fecha de suspensión si la estaba recibiendo por un factor ya resuelto.
      if (indicada && e.suspensiones.length > 0) {
        return {
          titulo: 'Tromboprofilaxis: fecha de suspensión',
          porque: e.suspensiones.map((s) => `${s.factor} resuelto: suspender el ${s.fecha} (7 días después), si no hay otro criterio.`),
          opciones: [{ etiqueta: 'Suspensión programada' }, { etiqueta: 'Se mantiene', requiereMotivo: true }],
        };
      }
      return null;
    }

    const porque = [
      `Puntaje ${e.puntaje}: ${e.factores.map((f) => `${f.nombre} (${f.puntos})`).join('; ') || 'sin factores que sumen'}.`,
      ...e.casosEspeciales,
      ...e.remisionEspecialista,
      ...e.suspensiones.map((s) => `${s.factor} resuelto: ese factor deja de contar el ${s.fecha}.`),
    ];
    const titulo =
      e.nivel === 'desde_ahora'
        ? 'Considerar tromboprofilaxis desde ahora (primer trimestre)'
        : e.nivel === 'semana_28'
          ? 'Considerar tromboprofilaxis desde la semana 28'
          : 'Considerar tromboprofilaxis';
    const severidad = e.nivel === 'desde_ahora' ? 3 : e.nivel === 'semana_28' ? 2 : 1;

    if (e.sangrado.length > 0) {
      return {
        titulo: 'Criterio de tromboprofilaxis presente, con riesgo de sangrado registrado',
        porque: [
          ...porque,
          `Riesgo de sangrado: ${e.sangrado.join('; ')}.`,
          'Discutir el balance de riesgos con un hematólogo con experiencia en trombosis y sangrado en el embarazo.',
        ],
        severidad,
        opciones: [
          { etiqueta: 'Referida a especialista', registraIndicacion: { tipo: 'tromboprofilaxis', estado: 'referida' } },
          { etiqueta: 'No indicada', requiereMotivo: true, registraIndicacion: { tipo: 'tromboprofilaxis', estado: 'no_indicado' } },
        ],
      };
    }

    if (e.dosis) {
      porque.push(
        `Dosis profiláctica por peso de la primera consulta (${e.dosis.pesoKg} kg): enoxaparina ${e.dosis.texto.enoxaparina}; dalteparina ${e.dosis.texto.dalteparina}; tinzaparina ${e.dosis.texto.tinzaparina}.`,
      );
      if (Object.values(e.dosis.texto).some((t) => t.includes('*'))) porque.push('* Se puede dar en dos dosis divididas.');
    } else {
      porque.push('Falta el peso de la primera consulta para sugerir la dosis.');
    }

    return {
      titulo,
      porque,
      severidad,
      opciones: [
        { etiqueta: 'Tromboprofilaxis indicada', registraIndicacion: { tipo: 'tromboprofilaxis', estado: 'indicado' } },
        { etiqueta: 'No indicada', requiereMotivo: true, registraIndicacion: { tipo: 'tromboprofilaxis', estado: 'no_indicado' } },
        { etiqueta: 'Referida a especialista', registraIndicacion: { tipo: 'tromboprofilaxis', estado: 'referida' } },
        { etiqueta: 'Ya la recibe', registraIndicacion: { tipo: 'tromboprofilaxis', estado: 'ya_lo_toma' } },
      ],
    };
  },
};
