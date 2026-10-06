// G1 — Batería de casos clínicos. Gestantes ficticias que cubren cada regla, incluidos los
// ejemplos del spec. Corren como prueba automática y generan docs/casos-clinicos.md para que el
// equipo clínico revise y firme los resultados esperados.
import { noCorresponde, valor } from '../datos/campo';
import type { DatosPrimeraConsulta } from '../datos/modelo';
import type { historiaDePrueba } from '../pruebas/historia';

type Opciones = NonNullable<Parameters<typeof historiaDePrueba>[0]>;

export interface CasoClinico {
  id: string;
  grupo: string;
  /** Qué se prueba, en una frase para el equipo clínico. */
  descripcion: string;
  /** Datos que cambian respecto de la gestante base. */
  datos: string[];
  /** Fecha de evaluación (por defecto 2026-10-06, semana 18+1). */
  hoy?: string;
  opciones: Opciones;
  /** Alertas activas esperadas: regla → título. Ninguna otra debe aparecer. */
  alertas: Record<string, string>;
  /** Textos que deben aparecer en el porqué de una alerta. */
  contiene?: Record<string, string[]>;
  /** Textos que no deben aparecer en el porqué de una alerta. */
  noContiene?: Record<string, string[]>;
}

/**
 * Gestante base sin factores de riesgo: 28 años, Bogotá (2600 m), FUM 2026-06-01, segundo embarazo
 * (parto vaginal previo de 3200 g, terminado el 2023-01-01), planeado, no fuma, sin hábitos ni
 * violencia, Rh +, antirrubéola previa, antitetánica vigente (2 dosis, la última 2024-03-10),
 * IMC 24,8, calcio ya indicado.
 */
export function gestanteBase(d: DatosPrimeraConsulta) {
  d.planificacion.embarazoPlaneado = valor(true);
  d.planificacion.deseaContinuar = noCorresponde();
  d.gestacionActual.fumaActivo = valor(false);
  d.gestacionActual.cigarrillosDia = noCorresponde();
  d.gestacionActual.drogas = valor(false);
  d.gestacionActual.alcohol = valor(false);
  d.gestacionActual.violencia = valor(false);
  d.antecedentesPersonales.violencia = valor(false);
  d.antecedentesCalcio.levotiroxina = valor(false);
  d.riesgoPreeclampsia.antecedenteFamiliarPreeclampsia = valor(false);
  d.antecedentesFamiliares.preeclampsia = valor(false);
  const o = d.antecedentesObstetricos;
  o.gestas = valor(1);
  o.partosVaginales = valor(1);
  o.nacidosVivos = valor(1);
  o.viven = valor(1);
  o.pesoUltimoRNg = valor(3200);
  o.gemelares = valor(false);
  o.finEmbarazoAnterior = valor('2023-01-01');
}

const CALCIO_INDICADO = [{ tipo: 'calcio' as const, estado: 'indicado' as const }];
const T2 = '2026-09-15'; // 15+1
const T1 = '2026-08-01'; // 8+5

function caso(c: Omit<CasoClinico, 'opciones'> & { cambios?: (d: DatosPrimeraConsulta) => void; extra?: Opciones }): CasoClinico {
  return {
    ...c,
    opciones: {
      indicaciones: CALCIO_INDICADO,
      ...c.extra,
      primera: (d) => {
        gestanteBase(d);
        c.cambios?.(d);
      },
    },
  };
}

const hb = (gdl: number, fecha = T2, muestra: 'venosa' | 'capilar' = 'venosa') => ({ tipo: 'hb' as const, valor: { gdl, muestra }, fecha });
const ptog = (a: number | null, h1: number | null, h2: number | null, fecha = '2026-11-23') => ({
  tipo: 'ptog' as const,
  valor: {
    ayunas: a === null ? { estado: 'vacio' as const } : valor(a),
    unaHora: h1 === null ? { estado: 'vacio' as const } : valor(h1),
    dosHoras: h2 === null ? { estado: 'vacio' as const } : valor(h2),
  },
  fecha,
});

export const CASOS: CasoClinico[] = [
  caso({ id: 'BASE', grupo: 'Control', descripcion: 'Gestante base sin factores de riesgo: no debe tener alertas.', datos: [], alertas: {} }),

  // ---------------- CLAP
  caso({ id: 'CLAP-01', grupo: 'CLAP', descripcion: 'Edad de 38 años.', datos: ['Nacimiento 1988-01-01'], extra: { fechaNacimiento: '1988-01-01' }, alertas: { edad_riesgo: 'Edad de riesgo' } }),
  caso({
    id: 'CLAP-02',
    grupo: 'CLAP',
    descripcion: 'Menor de 14 años: se presume violencia sexual (urgente, enlaza con derechos).',
    datos: ['Nacimiento 2013-01-01 (13 años)'],
    extra: { fechaNacimiento: '2013-01-01' },
    alertas: { menor_14: 'Gestante menor de 14 años: se presume violencia sexual', edad_riesgo: 'Edad de riesgo' },
    contiene: { menor_14: ['sin límite de edad gestacional'] },
  }),
  caso({ id: 'CLAP-03', grupo: 'CLAP', descripcion: 'Edad de 14 años: edad de riesgo, sin presunción de violencia.', datos: ['Nacimiento 2012-01-01'], extra: { fechaNacimiento: '2012-01-01' }, alertas: { edad_riesgo: 'Edad de riesgo' } }),
  caso({
    id: 'CLAP-04',
    grupo: 'CLAP',
    descripcion: 'Tres abortos espontáneos consecutivos.',
    datos: ['Gestas 3, abortos 3, 3 espontáneos consecutivos'],
    cambios: (d) => {
      const o = d.antecedentesObstetricos;
      o.gestas = valor(3);
      o.abortos = valor(3);
      o.partosVaginales = valor(0);
      o.tresEspontaneosConsecutivos = valor(true);
    },
    alertas: { abortos_repeticion: 'Abortos a repetición' },
  }),
  caso({ id: 'CLAP-05', grupo: 'CLAP', descripcion: 'Intervalo intergenésico de 8 meses.', datos: ['Fin del embarazo anterior 2025-10-01'], cambios: (d) => (d.antecedentesObstetricos.finEmbarazoAnterior = valor('2025-10-01')), alertas: { intervalo_corto: 'Intervalo intergenésico corto' }, contiene: { intervalo_corto: ['8 meses'] } }),
  caso({ id: 'CLAP-06', grupo: 'CLAP', descripcion: 'RN previo de 2400 g.', datos: ['Peso del último RN 2400 g'], cambios: (d) => (d.antecedentesObstetricos.pesoUltimoRNg = valor(2400)), alertas: { peso_rn_previo: 'Peso del RN previo' } }),
  caso({ id: 'CLAP-07', grupo: 'CLAP', descripcion: 'RN previo de 4000 g.', datos: ['Peso del último RN 4000 g'], cambios: (d) => (d.antecedentesObstetricos.pesoUltimoRNg = valor(4000)), alertas: { peso_rn_previo: 'Peso del RN previo' } }),
  caso({
    id: 'CLAP-08',
    grupo: 'CLAP',
    descripcion: 'Embarazo no planeado y no desea continuarlo: asesoría urgente.',
    datos: ['No planeado', 'No desea continuar'],
    cambios: (d) => {
      d.planificacion.embarazoPlaneado = valor(false);
      d.planificacion.deseaContinuar = valor('no');
    },
    alertas: { no_planeado: 'Embarazo no planeado: asesoría de opciones' },
  }),
  caso({
    id: 'CLAP-09',
    grupo: 'CLAP',
    descripcion: 'Embarazo no planeado y desea continuar: alerta no urgente.',
    datos: ['No planeado', 'Desea continuar'],
    cambios: (d) => {
      d.planificacion.embarazoPlaneado = valor(false);
      d.planificacion.deseaContinuar = valor('si');
    },
    alertas: { no_planeado: 'Embarazo no planeado' },
  }),
  caso({
    id: 'CLAP-10',
    grupo: 'CLAP',
    descripcion: 'VDRL reactivo sin tratamiento.',
    datos: ['VDRL reactivo, sin tratamiento'],
    extra: { examenes: [{ tipo: 'vdrl', valor: { reactivo: true, fta: null, tratamiento: null, tratamientoPareja: null }, fecha: T2 }] },
    alertas: { sifilis: 'Sífilis: VDRL/RPR reactivo' },
    contiene: { sifilis: ['Sin tratamiento registrado.'] },
  }),
  caso({
    id: 'CLAP-11',
    grupo: 'CLAP',
    descripcion: 'Bacteriuria y estreptococo B positivos.',
    datos: ['Bacteriuria positiva', 'EGB positivo'],
    extra: { examenes: [{ tipo: 'bacteriuria', valor: { positivo: true }, fecha: T2 }, { tipo: 'egb', valor: { positivo: true }, fecha: T2 }] },
    alertas: { infecciones: 'Infecciones' },
  }),
  caso({
    id: 'CLAP-12',
    grupo: 'CLAP',
    descripcion: 'Rh negativo inmunizada.',
    datos: ['Rh negativo', 'Inmunizada'],
    cambios: (d) => {
      d.gestacionActual.rh = valor('-');
      d.gestacionActual.inmunizada = valor(true);
    },
    alertas: { rh_negativo: 'Rh negativo, inmunizada' },
  }),
  caso({
    id: 'CLAP-13',
    grupo: 'CLAP',
    descripcion: 'Fuma (cantidad desconocida) y consume alcohol. Sumar tabaquismo da 1 punto trombótico, sin alerta.',
    datos: ['Fuma, no sabe cuánto', 'Alcohol'],
    cambios: (d) => {
      d.gestacionActual.fumaActivo = valor(true);
      d.gestacionActual.cigarrillosDia = valor('no_sabe');
      d.gestacionActual.alcohol = valor(true);
    },
    alertas: { habitos: 'Hábitos de riesgo' },
  }),
  caso({
    id: 'CLAP-14',
    grupo: 'CLAP',
    descripcion: 'Violencia sexual: urgente, ruta y derechos.',
    datos: ['Violencia SÍ', 'Violencia sexual SÍ'],
    cambios: (d) => {
      d.gestacionActual.violencia = valor(true);
      d.gestacionActual.violenciaSexual = valor(true);
    },
    alertas: { violencia: 'Violencia sexual' },
    contiene: { violencia: ['después de la semana 24'] },
  }),
  caso({ id: 'CLAP-15', grupo: 'CLAP', descripcion: 'Antirrubéola no recibida.', datos: ['Antirrubéola: no'], cambios: (d) => (d.gestacionActual.antirrubeola = valor('no')), alertas: { antirrubeola: 'Antirrubéola no recibida' } }),

  // ---------------- Antitetánica
  caso({
    id: 'AT-01',
    grupo: 'Antitetánica',
    descripcion: 'Sin dosis previas: 2 dosis, con la ventana de la segunda.',
    datos: ['0 dosis'],
    cambios: (d) => (d.gestacionActual.antitetanica = valor({ dosisPrevias: 0, fechaUltima: null, informacionConfiable: true })),
    alertas: { antitetanica: 'Antitetánica: esquema no vigente' },
    contiene: { antitetanica: ['Aplicar 2 dosis en este embarazo.', '2.ª dosis entre el 2026-11-03', 'y el 2027-02-15'] },
  }),
  caso({
    id: 'AT-02',
    grupo: 'Antitetánica',
    descripcion: '2 dosis, la última hace más de 3 años: 1 refuerzo.',
    datos: ['2 dosis, última 2023-01-10'],
    cambios: (d) => (d.gestacionActual.antitetanica = valor({ dosisPrevias: 2, fechaUltima: '2023-01-10', informacionConfiable: true })),
    alertas: { antitetanica: 'Antitetánica: esquema no vigente' },
    contiene: { antitetanica: ['Aplicar 1 dosis en este embarazo.'] },
  }),
  caso({ id: 'AT-03', grupo: 'Antitetánica', descripcion: '3 dosis, la última hace menos de 5 años: vigente.', datos: ['3 dosis, última 2022-01-10'], cambios: (d) => (d.gestacionActual.antitetanica = valor({ dosisPrevias: 3, fechaUltima: '2022-01-10', informacionConfiable: true })), alertas: {} }),
  caso({ id: 'AT-04', grupo: 'Antitetánica', descripcion: '5 dosis: vigente.', datos: ['5 dosis, última 2005-01-10'], cambios: (d) => (d.gestacionActual.antitetanica = valor({ dosisPrevias: 5, fechaUltima: '2005-01-10', informacionConfiable: true })), alertas: {} }),
  caso({
    id: 'AT-05',
    grupo: 'Antitetánica',
    descripcion: 'Información poco confiable: como sin dosis.',
    datos: ['3 dosis, información poco confiable'],
    cambios: (d) => (d.gestacionActual.antitetanica = valor({ dosisPrevias: 3, fechaUltima: '2025-01-10', informacionConfiable: false })),
    alertas: { antitetanica: 'Antitetánica: esquema no vigente' },
    contiene: { antitetanica: ['Aplicar 2 dosis'] },
  }),

  // ---------------- Anemia y hierro
  caso({
    id: 'AN-01',
    grupo: 'Anemia',
    descripcion: 'Ejemplo del spec: Bogotá, 2.º trimestre, Hb 11,8 venosa, no fumadora → anemia leve.',
    datos: ['Hb 11,8 g/dL venosa el 2026-09-15 (15+1)'],
    extra: { examenes: [hb(11.8)] },
    alertas: { anemia: 'Anemia leve' },
    contiene: { anemia: ['Hb medida 11,8 g/dL (venosa) · ajuste por altitud −1,8 · Hb ajustada 10,0 g/dL → anemia leve (punto de corte del 2.º trimestre: 10,5)', 'Solicitar ferritina sérica.'] },
  }),
  caso({
    id: 'AN-02',
    grupo: 'Anemia',
    descripcion: 'Fumadora de 15 cigarrillos en altura: los dos ajustes.',
    datos: ['Fuma 15 al día', 'Hb 12,6 venosa (15+1)'],
    cambios: (d) => {
      d.gestacionActual.fumaActivo = valor(true);
      d.gestacionActual.cigarrillosDia = valor(15);
    },
    extra: { examenes: [hb(12.6)] },
    alertas: { anemia: 'Anemia leve', habitos: 'Hábitos de riesgo' },
    contiene: { anemia: ['ajuste por altitud −1,8 · ajuste por tabaquismo −0,5 · Hb ajustada 10,3 g/dL'] },
  }),
  caso({
    id: 'AN-03',
    grupo: 'Anemia',
    descripcion: 'Hb ajustada menor de 7: anemia grave urgente.',
    datos: ['Hb 8,5 venosa (15+1)'],
    extra: { examenes: [hb(8.5)] },
    alertas: { anemia: 'Anemia grave' },
  }),
  caso({
    id: 'AN-04',
    grupo: 'Anemia',
    descripcion: 'Sin altitud registrada: clasifica a nivel del mar y avisa posible subdiagnóstico.',
    datos: ['Altitud vacía', 'Hb 10,8 venosa (8+5)'],
    cambios: (d) => (d.identificacion.altitudM = { estado: 'vacio' }),
    extra: { examenes: [hb(10.8, T1)] },
    alertas: { anemia: 'Anemia leve' },
    contiene: { anemia: ['Falta la altitud de residencia'] },
  }),
  caso({
    id: 'AN-05',
    grupo: 'Anemia',
    descripcion: 'Muestra capilar: se marca junto al resultado.',
    datos: ['Hb 11,8 capilar (15+1)'],
    extra: { examenes: [hb(11.8, T2, 'capilar')] },
    alertas: { anemia: 'Anemia leve' },
    contiene: { anemia: ['Muestra capilar'] },
  }),
  caso({
    id: 'FE-01',
    grupo: 'Hierro',
    descripcion: 'Anemia con ferritina de 42: déficit de hierro.',
    datos: ['Hb 11,8 (15+1)', 'Ferritina 42 ng/mL'],
    extra: { examenes: [hb(11.8), { tipo: 'ferritina', valor: { ngMl: 42 }, fecha: '2026-09-20' }] },
    alertas: { anemia: 'Anemia leve', deficit_hierro: 'Anemia con déficit de hierro (Hb ajustada 10,0 g/dL · ferritina 42 ng/mL)' },
    noContiene: { anemia: ['Solicitar ferritina'] },
  }),
  caso({
    id: 'FE-02',
    grupo: 'Hierro',
    descripcion: 'Anemia con ferritina de 60: considerar otras causas.',
    datos: ['Hb 11,8 (15+1)', 'Ferritina 60 ng/mL'],
    extra: { examenes: [hb(11.8), { tipo: 'ferritina', valor: { ngMl: 60 }, fecha: '2026-09-20' }] },
    alertas: { anemia: 'Anemia leve', deficit_hierro: 'Anemia sin déficit de hierro por ferritina: considerar otras causas' },
  }),
  caso({
    id: 'FE-03',
    grupo: 'Hierro',
    descripcion: 'Ferritina de 24 sin anemia: solo como dato, sin alerta.',
    datos: ['Hb 13 (15+1)', 'Ferritina 24 ng/mL'],
    extra: { examenes: [hb(13), { tipo: 'ferritina', valor: { ngMl: 24 }, fecha: '2026-09-20' }] },
    alertas: {},
  }),

  // ---------------- ASA
  caso({
    id: 'ASA-01',
    grupo: 'ASA',
    descripcion: 'Hipertensión crónica (1 factor alto) en la semana 18.',
    datos: ['HTA crónica'],
    cambios: (d) => (d.riesgoPreeclampsia.hipertensionCronica = valor(true)),
    alertas: { asa: 'Considerar ASA para prevenir preeclampsia' },
    contiene: { asa: ['Aspirina 75–100 mg por vía oral todos los días, desde la semana 12 hasta el día del parto.'] },
  }),
  caso({
    id: 'ASA-02',
    grupo: 'ASA',
    descripcion: 'Primer embarazo y gemelar (2 moderados).',
    datos: ['Gestas 0', 'Embarazo múltiple'],
    cambios: (d) => {
      const o = d.antecedentesObstetricos;
      o.gestas = valor(0);
      o.partosVaginales = valor(0);
      o.pesoUltimoRNg = noCorresponde();
      o.finEmbarazoAnterior = noCorresponde();
      d.riesgoPreeclampsia.embarazoMultiple = valor(true);
    },
    alertas: { asa: 'Considerar ASA para prevenir preeclampsia' },
    contiene: { asa: ['Primer embarazo (moderado); Embarazo múltiple (moderado)'] },
  }),
  caso({
    id: 'ASA-03',
    grupo: 'ASA',
    descripcion: 'Solo primer embarazo (1 moderado): sin alerta.',
    datos: ['Gestas 0'],
    cambios: (d) => {
      const o = d.antecedentesObstetricos;
      o.gestas = valor(0);
      o.partosVaginales = valor(0);
      o.pesoUltimoRNg = noCorresponde();
      o.finEmbarazoAnterior = noCorresponde();
    },
    alertas: {},
  }),
  caso({
    id: 'ASA-04',
    grupo: 'ASA',
    descripcion: 'Criterio presente en la semana 10: sin alerta (el resumen muestra la fecha de inicio).',
    datos: ['HTA crónica', 'Evaluada el 2026-08-10 (10+0)'],
    hoy: '2026-08-10',
    cambios: (d) => (d.riesgoPreeclampsia.hipertensionCronica = valor(true)),
    extra: { fechaPrimera: '2026-08-10' },
    alertas: {},
  }),
  caso({
    id: 'ASA-05',
    grupo: 'ASA',
    descripcion: 'Criterio con alergia al ASA: contraindicación, sin dosis.',
    datos: ['HTA crónica', 'Alergia al ASA'],
    cambios: (d) => {
      d.riesgoPreeclampsia.hipertensionCronica = valor(true);
      d.riesgoPreeclampsia.alergiaASAoAINE = valor(true);
    },
    alertas: { asa: 'Criterio de ASA presente, pero con contraindicación registrada' },
    noContiene: { asa: ['Aspirina'] },
  }),
  caso({
    id: 'ASA-06',
    grupo: 'ASA',
    descripcion: 'Primera consulta en la semana 20: inicio después de la semana 16.',
    datos: ['HTA crónica', 'Primera consulta 2026-10-19 (20+0)'],
    hoy: '2026-10-19',
    cambios: (d) => (d.riesgoPreeclampsia.hipertensionCronica = valor(true)),
    extra: { fechaPrimera: '2026-10-19' },
    alertas: { asa: 'Considerar ASA para prevenir preeclampsia' },
    contiene: { asa: ['Inicio después de la semana 16'] },
  }),

  // ---------------- Calcio
  caso({ id: 'CA-01', grupo: 'Calcio', descripcion: 'Semana 12 sin calcio: sin alerta todavía.', datos: ['Sin calcio indicado', 'Evaluada en 12+0'], hoy: '2026-08-24', extra: { indicaciones: [] }, alertas: {} }),
  caso({
    id: 'CA-02',
    grupo: 'Calcio',
    descripcion: 'Semana 14+0 sin calcio: alerta con dosis.',
    datos: ['Sin calcio indicado', 'Evaluada en 14+0'],
    hoy: '2026-09-07',
    extra: { indicaciones: [] },
    alertas: { calcio: 'Iniciar carbonato de calcio' },
    contiene: { calcio: ['Semana 14+0', '1200 mg al día (2 tabletas de 600 mg)'] },
  }),
  caso({
    id: 'CA-03',
    grupo: 'Calcio',
    descripcion: 'Nefrolitiasis sin calcio indicado: contraindicación sin dosis.',
    datos: ['Nefrolitiasis', 'Sin calcio indicado'],
    cambios: (d) => (d.antecedentesCalcio.nefrolitiasisONefrocalcinosis = valor(true)),
    extra: { indicaciones: [] },
    alertas: { calcio: 'Calcio recomendado, pero con contraindicación registrada: valorar antes de indicar' },
    noContiene: { calcio: ['Dosis'] },
  }),
  caso({
    id: 'CA-04',
    grupo: 'Calcio',
    descripcion: 'Levotiroxina: dosis con nota de separación.',
    datos: ['Levotiroxina', 'Sin calcio indicado'],
    cambios: (d) => (d.antecedentesCalcio.levotiroxina = valor(true)),
    extra: { indicaciones: [] },
    alertas: { calcio: 'Iniciar carbonato de calcio' },
    contiene: { calcio: ['Precaución — Levotiroxina'] },
  }),
  caso({
    id: 'CA-05',
    grupo: 'Calcio',
    descripcion: 'Hipercalcemia con el calcio ya indicado: vuelve a avisar.',
    datos: ['Calcio indicado', 'Hipercalcemia'],
    cambios: (d) => (d.antecedentesCalcio.hipercalcemia = valor(true)),
    alertas: { calcio: 'Calcio indicado, pero con contraindicación registrada: valorar' },
  }),

  // ---------------- Tromboprofilaxis
  caso({
    id: 'TR-01',
    grupo: 'Tromboprofilaxis',
    descripcion: 'Puntaje 2 (várices y FIV): sin alerta.',
    datos: ['Várices gruesas', 'FIV'],
    cambios: (d) => {
      d.riesgoTrombotico.varicesGruesas = valor(true);
      d.riesgoPreeclampsia.fertilizacionInVitro = valor(true);
    },
    alertas: {},
  }),
  caso({
    id: 'TR-02',
    grupo: 'Tromboprofilaxis',
    descripcion: 'Puntaje 3: desde la semana 28.',
    datos: ['Várices gruesas', 'FIV', 'Edad 38'],
    extra: { fechaNacimiento: '1988-01-01' },
    cambios: (d) => {
      d.riesgoTrombotico.varicesGruesas = valor(true);
      d.riesgoPreeclampsia.fertilizacionInVitro = valor(true);
    },
    alertas: { tromboprofilaxis: 'Considerar tromboprofilaxis desde la semana 28', edad_riesgo: 'Edad de riesgo' },
    contiene: { tromboprofilaxis: ['Puntaje 3', 'enoxaparina 40 mg al día'] },
  }),
  caso({
    id: 'TR-03',
    grupo: 'Tromboprofilaxis',
    descripcion: 'Puntaje 4 (trombosis previa sin causa): desde ahora y remisión.',
    datos: ['Trombosis previa sin causa'],
    cambios: (d) => {
      d.riesgoTrombotico.trombosisPrevia = valor(true);
      d.riesgoTrombotico.causaTrombosisPrevia = valor('sin_causa');
    },
    alertas: { tromboprofilaxis: 'Considerar tromboprofilaxis desde ahora (primer trimestre)' },
    contiene: { tromboprofilaxis: ['Puntaje 4', 'sugerir remisión al equipo o especialista en trombosis'] },
  }),
  caso({
    id: 'TR-04',
    grupo: 'Tromboprofilaxis',
    descripcion: 'IMC 52: todo el embarazo y 6 semanas posparto; dosis de 130–169 kg.',
    datos: ['Peso 130 kg, talla 158 cm'],
    cambios: (d) => (d.gestacionActual.pesoAnteriorKg = valor(130)),
    alertas: { tromboprofilaxis: 'Considerar tromboprofilaxis desde ahora (primer trimestre)' },
    contiene: { tromboprofilaxis: ['6 semanas posparto', 'enoxaparina 80 mg al día*'] },
  }),
  caso({
    id: 'TR-05',
    grupo: 'Tromboprofilaxis',
    descripcion: 'Hiperémesis activa: iniciar en las primeras 72 horas.',
    datos: ['Hiperémesis desde 2026-10-01'],
    extra: { indicaciones: CALCIO_INDICADO, factores: [{ tipo: 'hiperemesis', inicio: '2026-10-01', conHospitalizacion: false }] },
    alertas: { tromboprofilaxis: 'Considerar tromboprofilaxis desde la semana 28' },
    contiene: { tromboprofilaxis: ['primeras 72 horas'] },
  }),
  caso({
    id: 'TR-06',
    grupo: 'Tromboprofilaxis',
    descripcion: 'Cirugía resuelta el 2026-10-01 con tromboprofilaxis indicada: suspender 7 días después.',
    datos: ['Cirugía 2026-09-20, resuelta 2026-10-01', 'Tromboprofilaxis indicada'],
    extra: {
      indicaciones: [...CALCIO_INDICADO, { tipo: 'tromboprofilaxis', estado: 'indicado' }],
      factores: [{ tipo: 'cirugia', inicio: '2026-09-20', resolucion: '2026-10-01', conHospitalizacion: false }],
    },
    alertas: { tromboprofilaxis: 'Tromboprofilaxis: fecha de suspensión' },
    contiene: { tromboprofilaxis: ['suspender el 2026-10-08'] },
  }),
  caso({
    id: 'TR-07',
    grupo: 'Tromboprofilaxis',
    descripcion: 'Hospitalización antenatal: considerar aunque el puntaje no lo dé.',
    datos: ['Hospitalización desde 2026-10-04'],
    extra: { indicaciones: CALCIO_INDICADO, factores: [{ tipo: 'hospitalizacion', inicio: '2026-10-04', conHospitalizacion: true }] },
    alertas: { tromboprofilaxis: 'Considerar tromboprofilaxis' },
  }),
  caso({
    id: 'TR-08',
    grupo: 'Tromboprofilaxis',
    descripcion: 'Criterio con plaquetas de 70: riesgo de sangrado, sin dosis.',
    datos: ['Trombosis previa sin causa', 'Plaquetas 70 × 10⁹/L'],
    cambios: (d) => {
      d.riesgoTrombotico.trombosisPrevia = valor(true);
      d.riesgoTrombotico.causaTrombosisPrevia = valor('sin_causa');
    },
    extra: { examenes: [{ tipo: 'plaquetas', valor: { x10e9L: 70 }, fecha: T2 }] },
    alertas: { tromboprofilaxis: 'Criterio de tromboprofilaxis presente, con riesgo de sangrado registrado' },
    noContiene: { tromboprofilaxis: ['enoxaparina'] },
  }),

  // ---------------- PTOG
  caso({ id: 'DG-01', grupo: 'Diabetes gestacional', descripcion: 'PTOG 91/179/152: normal.', datos: ['PTOG 2026-11-23 (25+0)'], extra: { indicaciones: CALCIO_INDICADO, examenes: [ptog(91, 179, 152)] }, alertas: {} }),
  caso({ id: 'DG-02', grupo: 'Diabetes gestacional', descripcion: 'Ayunas de 92 sola: alterada.', datos: ['PTOG 92/100/100'], extra: { indicaciones: CALCIO_INDICADO, examenes: [ptog(92, 100, 100)] }, alertas: { ptog: 'Diabetes gestacional: PTOG alterada' }, contiene: { ptog: ['Ayunas: 92 mg/dL'] } }),
  caso({ id: 'DG-03', grupo: 'Diabetes gestacional', descripcion: '2 horas de 153 sola: alterada.', datos: ['PTOG 80/100/153'], extra: { indicaciones: CALCIO_INDICADO, examenes: [ptog(80, 100, 153)] }, alertas: { ptog: 'Diabetes gestacional: PTOG alterada' }, contiene: { ptog: ['2 horas: 153 mg/dL'] } }),
  caso({ id: 'DG-04', grupo: 'Diabetes gestacional', descripcion: 'Falta el valor de 1 hora: no clasifica.', datos: ['PTOG 95/—/120'], extra: { indicaciones: CALCIO_INDICADO, examenes: [ptog(95, null, 120)] }, alertas: { ptog: 'PTOG incompleta: no se puede clasificar' } }),
  caso({
    id: 'DG-05',
    grupo: 'Diabetes gestacional',
    descripcion: 'PTOG alterada hecha en la semana 15: indica la semana.',
    datos: ['PTOG 95/100/100 el 2026-09-15 (15+1)'],
    extra: { indicaciones: CALCIO_INDICADO, examenes: [ptog(95, 100, 100, T2)] },
    alertas: { ptog: 'Diabetes gestacional: PTOG alterada' },
    contiene: { ptog: ['semana 15+1, fuera de las semanas 24 a 28'] },
  }),
];
