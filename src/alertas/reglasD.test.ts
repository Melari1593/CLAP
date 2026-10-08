import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { noCorresponde, vacio, valor } from '../datos/campo';
import type { DatosPrimeraConsulta } from '../datos/modelo';
import { historiaDePrueba } from '../pruebas/historia';
import { anemia, clasificarHb, deficitHierro, explicarHb } from './anemia';
import { asa } from './asa';
import { calcio } from './calcio';
import { construirContexto, type Regla } from './motor';
import { ptog } from './ptog';
import { notasResumen } from './resumen';
import { evaluarTrombo, tromboprofilaxis } from './trombo';

// FUM de los datos de prueba: 2026-06-01. Semana 12 = 2026-08-24; semana 14 = 2026-09-07.
const T1 = '2026-08-01'; // 8+5
const T2 = '2026-09-15'; // 15+1
const T3 = '2026-12-14'; // 28+0
type Opciones = NonNullable<Parameters<typeof historiaDePrueba>[0]>;

const ctx = (op: Opciones = {}, hoy = '2026-10-06', cat = new Catalogo()) => construirContexto(historiaDePrueba(op), hoy, cat);
const evaluar = (regla: Regla, op: Opciones = {}, hoy?: string) => regla.evaluar(ctx(op, hoy));
const con = (f: (d: DatosPrimeraConsulta) => void, extra: Opciones = {}): Opciones => ({ ...extra, primera: f });
const noFuma = (d: DatosPrimeraConsulta) => {
  d.gestacionActual.fumaActivo = valor(false);
  d.gestacionActual.cigarrillosDia = noCorresponde();
};
const hb = (gdl: number, fecha: string, muestra: 'venosa' | 'capilar' = 'venosa') => ({ tipo: 'hb' as const, valor: { gdl, muestra }, fecha });

describe('D1 — Anemia (OMS 2024)', () => {
  it('ejemplo del spec: Bogotá 2600 m, 2.º trimestre, Hb 11,8 venosa, no fumadora → 10,0 → anemia leve', () => {
    const c = ctx(con(noFuma));
    const r = clasificarHb(c, { gdl: 11.8, muestra: 'venosa', fecha: T2 });
    expect(r).toMatchObject({ ajustadaGdl: 10.0, trimestre: 2, grado: 'leve', ajusteAltitudGdl: 1.8 });
    expect(explicarHb(r)).toBe(
      'Hb medida 11,8 g/dL (venosa) · ajuste por altitud −1,8 · Hb ajustada 10,0 g/dL → anemia leve (punto de corte del 2.º trimestre: 10,5)',
    );
    expect(evaluar(anemia, con(noFuma, { examenes: [hb(11.8, T2)] }))?.titulo).toBe('Anemia leve');
  });

  it.each([
    [0, 0], [499, 0], [500, 4], [999, 4], [1000, 8], [1500, 11], [2000, 14], [2500, 18],
    [3000, 21], [3500, 25], [4000, 29], [4500, 33], [4999, 33],
  ])('altitud %i m resta %i g/L', (altitud, ajuste) => {
    const c = ctx(con((d) => { noFuma(d); d.identificacion.altitudM = valor(altitud); }));
    expect(clasificarHb(c, { gdl: 12.0, muestra: 'venosa', fecha: T1 }).ajustadaGdl).toBe((120 - ajuste) / 10);
  });

  it('usa el punto de corte de cada trimestre', () => {
    const c = ctx(con((d) => { noFuma(d); d.identificacion.altitudM = valor(0); }));
    const grado = (fecha: string, gdl = 10.6) => clasificarHb(c, { gdl, muestra: 'venosa', fecha }).grado;
    expect([grado(T1), grado(T2), grado(T3)]).toEqual(['leve', 'sin_anemia', 'leve']);
    expect(grado(T2, 9.4)).toBe('moderada');
    expect(grado(T2, 6.9)).toBe('grave');
  });

  it('la anemia grave es urgente', () => {
    const r = evaluar(anemia, con((d) => { noFuma(d); d.identificacion.altitudM = valor(0); }, { examenes: [hb(6.5, T2)] }));
    expect(r).toMatchObject({ titulo: 'Anemia grave', urgente: true, severidad: 3 });
  });

  it('fumadora en altura recibe los dos ajustes', () => {
    const c = ctx(con((d) => (d.gestacionActual.cigarrillosDia = valor(15))));
    const r = clasificarHb(c, { gdl: 12.6, muestra: 'venosa', fecha: T2 });
    expect(r).toMatchObject({ ajusteAltitudGdl: 1.8, ajusteTabacoGdl: 0.5, ajustadaGdl: 10.3, grado: 'leve' });
    expect(explicarHb(r)).toContain('ajuste por tabaquismo −0,5');
  });

  it('fumadora que no sabe cuánto fuma: 3 g/L; 20 cigarrillos: 6 g/L', () => {
    expect(clasificarHb(ctx(), { gdl: 12, muestra: 'venosa', fecha: T2 }).ajusteTabacoGdl).toBe(0.3);
    const c = ctx(con((d) => (d.gestacionActual.cigarrillosDia = valor(20))));
    expect(clasificarHb(c, { gdl: 12, muestra: 'venosa', fecha: T2 }).ajusteTabacoGdl).toBe(0.6);
  });

  it('sin altitud clasifica a nivel del mar y avisa posible subdiagnóstico', () => {
    const c = ctx(con((d) => { noFuma(d); d.identificacion.altitudM = vacio(); }));
    const r = clasificarHb(c, { gdl: 11.8, muestra: 'venosa', fecha: T2 });
    expect(r.grado).toBe('sin_anemia');
    expect(r.avisos).toContain('Falta la altitud de residencia: la anemia puede estar subdiagnosticada.');
  });

  it('con 5000 m o más no ajusta y pide revisar el dato', () => {
    const c = ctx(con((d) => { noFuma(d); d.identificacion.altitudM = valor(5200); }));
    const r = clasificarHb(c, { gdl: 11.0, muestra: 'venosa', fecha: T2 });
    expect(r.ajusteAltitudGdl).toBe(0);
    expect(r.avisos.join(' ')).toContain('revise el dato');
  });

  it('marca las muestras capilares', () => {
    const c = ctx(con(noFuma));
    expect(clasificarHb(c, { gdl: 11.8, muestra: 'capilar', fecha: T2 }).avisos.join(' ')).toContain('Muestra capilar');
  });

  it('al cambiar la altitud reclasifica solo desde ese control', () => {
    const op = con((d) => { noFuma(d); d.identificacion.altitudM = valor(0); }, {
      seguimientos: [{ fecha: '2026-09-01', cambios: (s) => (s.cambioResidencia = valor({ municipio: 'Bogotá', altitudM: 2600 })) }],
    });
    const c = ctx(op);
    expect(clasificarHb(c, { gdl: 11.8, muestra: 'venosa', fecha: T1 }).ajusteAltitudGdl).toBe(0); // antes del cambio
    expect(clasificarHb(c, { gdl: 11.8, muestra: 'venosa', fecha: T2 }).ajusteAltitudGdl).toBe(1.8); // después
  });
});

describe('D2 — Déficit de hierro (ASH 2026)', () => {
  const conAnemia = (examenes: Opciones['examenes'] = []) => con(noFuma, { examenes: [hb(11.8, T2), ...examenes] });
  const ferritina = (ngMl: number) => ({ tipo: 'ferritina' as const, valor: { ngMl }, fecha: '2026-09-20' });

  it('anemia sin ferritina: pide ferritina sérica', () => {
    expect(evaluar(anemia, conAnemia())?.porque).toContain('Solicitar ferritina sérica.');
    expect(evaluar(anemia, conAnemia([ferritina(42)]))?.porque).not.toContain('Solicitar ferritina sérica.');
  });

  it('ferritina 42 con anemia: anemia con déficit de hierro', () => {
    expect(evaluar(deficitHierro, conAnemia([ferritina(42)]))?.titulo).toBe(
      'Anemia con déficit de hierro (Hb ajustada 10,0 g/dL · ferritina 42 ng/mL)',
    );
    expect(evaluar(deficitHierro, conAnemia([ferritina(50)]))?.titulo).toContain('con déficit de hierro');
  });

  it('ferritina 60 con anemia: considerar otras causas, sin sugerir conducta', () => {
    expect(evaluar(deficitHierro, conAnemia([ferritina(60)]))?.titulo).toBe(
      'Anemia sin déficit de hierro por ferritina: considerar otras causas',
    );
  });

  it('ferritina 24 sin anemia: solo como dato', () => {
    const op = con(noFuma, { examenes: [hb(13, T2), ferritina(24)] });
    expect(evaluar(deficitHierro, op)).toBeNull();
    expect(notasResumen(ctx(op)).join(' ')).toContain('Ferritina 24 ng/mL sin anemia: déficit de hierro sin anemia');
  });

  it('con inflamación sugiere interpretar con la saturación de transferrina', () => {
    const r = evaluar(deficitHierro, conAnemia([ferritina(60), { tipo: 'inflamacion', valor: { presente: true, descripcion: 'IVU' }, fecha: T2 }]));
    expect(r?.porque.join(' ')).toContain('saturación de transferrina');
  });
});

describe('D3 — ASA (GPC colombiana)', () => {
  const sinFactores = (d: DatosPrimeraConsulta) => {
    d.riesgoPreeclampsia.antecedenteFamiliarPreeclampsia = valor(false);
    d.antecedentesFamiliares.preeclampsia = valor(false);
    d.antecedentesObstetricos.gestas = valor(1);
    d.antecedentesObstetricos.abortos = valor(1);
  };
  const conFactores = (f: (d: DatosPrimeraConsulta) => void, extra: Opciones = {}) => con((d) => { sinFactores(d); f(d); }, extra);

  it('1 factor alto: alerta con dosis', () => {
    const r = evaluar(asa, conFactores((d) => (d.riesgoPreeclampsia.hipertensionCronica = valor(true))));
    expect(r?.titulo).toBe('Considerar ASA para prevenir preeclampsia');
    expect(r?.porque.join(' ')).toContain('Aspirina 75–100 mg por vía oral todos los días, desde la semana 12 hasta la semana 36.');
  });

  it('desde la semana 36 ya no hay alerta de ASA', () => {
    const op = conFactores((d) => (d.riesgoPreeclampsia.hipertensionCronica = valor(true)));
    const c = ctx(op, '2027-03-15');
    expect(c.eg.estado === 'calculada' && c.eg.dias >= 36 * 7).toBe(true);
    expect(evaluar(asa, op, '2027-03-15')).toBeNull();
  });

  it('2 moderados (primer embarazo y gemelar): alerta', () => {
    const r = evaluar(asa, conFactores((d) => {
      d.antecedentesObstetricos.gestas = valor(0);
      d.antecedentesObstetricos.abortos = valor(0);
      d.riesgoPreeclampsia.embarazoMultiple = valor(true);
    }));
    expect(r?.porque[0]).toBe('Factores: Primer embarazo (moderado); Embarazo múltiple (moderado).');
  });

  it('1 moderado: sin alerta; edad de 38 sola: sin alerta', () => {
    expect(evaluar(asa, conFactores((d) => (d.riesgoPreeclampsia.embarazoMultiple = valor(true))))).toBeNull();
    expect(evaluar(asa, { ...conFactores(() => {}), fechaNacimiento: '1988-01-01' })).toBeNull();
  });

  it('criterio en semana 10: solo la fecha en el resumen; en semana 12: alerta', () => {
    const op = conFactores((d) => (d.riesgoPreeclampsia.hipertensionCronica = valor(true)), { fechaPrimera: '2026-08-10' });
    expect(evaluar(asa, op, '2026-08-10')).toBeNull();
    expect(notasResumen(ctx(op, '2026-08-10')).join(' ')).toContain('ASA: iniciar en la semana 12 (2026-08-24)');
    expect(evaluar(asa, op, '2026-08-24')).not.toBeNull();
  });

  it('con contraindicación cambia el texto y no sugiere dosis', () => {
    const r = evaluar(asa, conFactores((d) => {
      d.riesgoPreeclampsia.hipertensionCronica = valor(true);
      d.riesgoPreeclampsia.alergiaASAoAINE = valor(true);
    }));
    expect(r?.titulo).toBe('Criterio de ASA presente, pero con contraindicación registrada');
    expect(r?.porque.join(' ')).not.toContain('Aspirina');
  });

  it('primera consulta en semana 20: señala el inicio después de la semana 16', () => {
    const op = conFactores((d) => (d.riesgoPreeclampsia.hipertensionCronica = valor(true)), { fechaPrimera: '2026-10-19' });
    expect(evaluar(asa, op, '2026-10-19')?.porque.join(' ')).toContain('Inicio después de la semana 16');
  });

  it('si un dato nuevo cambia el conteo, sube la severidad (para que el motor avise)', () => {
    const uno = evaluar(asa, conFactores((d) => (d.riesgoPreeclampsia.hipertensionCronica = valor(true))));
    const dos = evaluar(asa, conFactores((d) => {
      d.riesgoPreeclampsia.hipertensionCronica = valor(true);
      d.riesgoPreeclampsia.autoinmune = valor(true);
    }));
    expect(dos!.severidad!).toBeGreaterThan(uno!.severidad!);
  });
});

describe('D4 — Carbonato de calcio', () => {
  it('semana 12: sin alerta, con la fecha de inicio en el resumen', () => {
    expect(evaluar(calcio, {}, '2026-08-24')).toBeNull();
    expect(notasResumen(ctx({}, '2026-08-24')).join(' ')).toContain('Calcio: iniciar en la semana 14 (2026-09-07)');
  });

  it('semana 14+0: alerta con la dosis y las indicaciones de toma', () => {
    const r = evaluar(calcio, con((d) => (d.antecedentesCalcio.levotiroxina = valor(false))), '2026-09-07');
    expect(r?.titulo).toBe('Iniciar carbonato de calcio');
    const texto = r!.porque.join(' ');
    expect(texto).toContain('Semana 14+0');
    expect(texto).toContain('1200 mg al día (2 tabletas de 600 mg)');
    expect(texto).toContain('Al menos 1 hora separado del hierro.');
    expect(texto).toContain('además del ASA');
  });

  it('con nefrolitiasis: texto de contraindicación sin dosis', () => {
    const r = evaluar(calcio, con((d) => (d.antecedentesCalcio.nefrolitiasisONefrocalcinosis = valor(true))));
    expect(r?.titulo).toBe('Calcio recomendado, pero con contraindicación registrada: valorar antes de indicar');
    expect(r?.porque.join(' ')).not.toContain('Dosis');
  });

  it('con levotiroxina: la dosis con la nota de separación', () => {
    const r = evaluar(calcio); // los datos de prueba toman levotiroxina
    expect(r?.porque.join(' ')).toContain('Dosis: carbonato de calcio 1200 mg');
    expect(r?.porque.join(' ')).toContain('Precaución — Levotiroxina: Tomarla separada del calcio por varias horas');
  });

  it('calcio ya indicado: sin alerta; si se registra hipercalcemia, vuelve a avisar', () => {
    const indicaciones = [{ tipo: 'calcio' as const, estado: 'indicado' as const }];
    expect(evaluar(calcio, { indicaciones })).toBeNull();
    const r = evaluar(calcio, con((d) => (d.antecedentesCalcio.hipercalcemia = valor(true)), { indicaciones }));
    expect(r?.titulo).toBe('Calcio indicado, pero con contraindicación registrada: valorar');
  });
});

describe('D5 — Tromboprofilaxis (RCOG)', () => {
  // Los datos de prueba fuman (1 punto) y tienen IMC 24,8.
  const puntaje = (op: Opciones) => evaluarTrombo(ctx(op))!.puntaje;

  it('puntaje 2: sin alerta, visible en el resumen', () => {
    const op = con((d) => (d.riesgoTrombotico.varicesGruesas = valor(true)));
    expect(puntaje(op)).toBe(2);
    expect(evaluar(tromboprofilaxis, op)).toBeNull();
    expect(notasResumen(ctx(op))).toContain('Puntaje de riesgo trombótico: 2.');
  });

  it('puntaje 3: desde la semana 28; puntaje 4: desde ahora', () => {
    const tres = con((d) => {
      d.riesgoTrombotico.varicesGruesas = valor(true);
      d.riesgoPreeclampsia.fertilizacionInVitro = valor(true);
    });
    expect(evaluar(tromboprofilaxis, tres)?.titulo).toBe('Considerar tromboprofilaxis desde la semana 28');
    const cuatro = con((d) => {
      d.riesgoTrombotico.varicesGruesas = valor(true);
      d.riesgoPreeclampsia.fertilizacionInVitro = valor(true);
      d.riesgoPreeclampsia.embarazoMultiple = valor(true);
    });
    const r = evaluar(tromboprofilaxis, cuatro);
    expect(r?.titulo).toBe('Considerar tromboprofilaxis desde ahora (primer trimestre)');
    expect(r?.porque[0]).toBe('Puntaje 4: Tabaquismo (1); Várices gruesas (1); Fertilización in vitro o reproducción asistida (1); Embarazo múltiple (1).');
    expect(r?.porque.join(' ')).toContain('enoxaparina 40 mg al día');
  });

  it('IMC 52: caso especial durante todo el embarazo y 6 semanas posparto', () => {
    const r = evaluar(tromboprofilaxis, con((d) => (d.gestacionActual.pesoAnteriorKg = valor(130))));
    expect(r?.porque.join(' ')).toContain('IMC de 50 o más: ofrecer tromboprofilaxis durante todo el embarazo y 6 semanas posparto.');
    expect(r?.porque.join(' ')).toContain('enoxaparina 80 mg al día*');
  });

  it('hiperémesis: iniciar en las primeras 72 horas', () => {
    const r = evaluar(tromboprofilaxis, { factores: [{ tipo: 'hiperemesis', inicio: '2026-10-01', conHospitalizacion: false }] });
    expect(r?.porque.join(' ')).toContain('iniciarla en las primeras 72 horas');
  });

  it('factor transitorio resuelto: deja de sumar y da la fecha de suspensión (7 días)', () => {
    const factores = [{ tipo: 'cirugia' as const, inicio: '2026-09-20', resolucion: '2026-10-01', conHospitalizacion: false }];
    expect(puntaje({ factores })).toBe(1);
    const r = evaluar(tromboprofilaxis, { factores, indicaciones: [{ tipo: 'tromboprofilaxis', estado: 'indicado' }] });
    expect(r?.titulo).toBe('Tromboprofilaxis: fecha de suspensión');
    expect(r?.porque[0]).toContain('suspender el 2026-10-08');
    expect(puntaje({ factores: [{ ...factores[0]!, resolucion: undefined }] })).toBe(5);
  });

  it('otra hospitalización antenatal: considerar aunque el puntaje no lo dé', () => {
    const r = evaluar(tromboprofilaxis, { factores: [{ tipo: 'hospitalizacion', inicio: '2026-10-04', conHospitalizacion: true }] });
    expect(r?.titulo).toBe('Considerar tromboprofilaxis');
  });

  it('riesgo de sangrado (plaquetas < 75 desde el hemograma): cambia el texto y no sugiere dosis', () => {
    const op = con((d) => (d.gestacionActual.pesoAnteriorKg = valor(130)), {
      examenes: [{ tipo: 'plaquetas', valor: { x10e9L: 70 }, fecha: T2 }],
    });
    const r = evaluar(tromboprofilaxis, op);
    expect(r?.titulo).toBe('Criterio de tromboprofilaxis presente, con riesgo de sangrado registrado');
    expect(r?.porque.join(' ')).toContain('plaquetas de 70');
    expect(r?.porque.join(' ')).not.toContain('enoxaparina');
  });

  it('trombosis previa: 4 puntos y remisión al especialista; provocada por cirugía mayor: 3', () => {
    const r = evaluar(tromboprofilaxis, con((d) => {
      d.riesgoTrombotico.trombosisPrevia = valor(true);
      d.riesgoTrombotico.causaTrombosisPrevia = valor('sin_causa');
    }));
    expect(r?.porque.join(' ')).toContain('sugerir remisión al equipo o especialista en trombosis');
    expect(puntaje(con((d) => {
      d.riesgoTrombotico.trombosisPrevia = valor(true);
      d.riesgoTrombotico.causaTrombosisPrevia = valor('cirugia_mayor');
    }))).toBe(4); // 3 + tabaquismo
  });

  it.each([
    [99, '40 mg al día', '5000 UI al día'],
    [100, '60 mg al día*', '7500 UI al día'],
    [129, '60 mg al día*', '7500 UI al día'],
    [130, '80 mg al día*', '10 000 UI al día'],
    [169, '80 mg al día*', '10 000 UI al día'],
    [170, '0,6 mg/kg al día* (102 mg al día)', '75 UI/kg al día (12.750 UI al día)'],
  ])('peso %i kg: enoxaparina %s, dalteparina %s', (peso, enox, dalte) => {
    const e = evaluarTrombo(ctx(con((d) => (d.gestacionActual.pesoAnteriorKg = valor(peso)))))!;
    expect(e.dosis?.texto.enoxaparina).toBe(enox);
    expect(e.dosis?.texto.dalteparina).toBe(dalte);
  });
});

describe('D6 — Diabetes gestacional (PTOG)', () => {
  const prueba = (a?: number, h1?: number, h2?: number, fecha = '2026-11-23') => ({
    examenes: [
      {
        tipo: 'ptog' as const,
        valor: {
          ayunas: a === undefined ? vacio<number>() : valor(a),
          unaHora: h1 === undefined ? vacio<number>() : valor(h1),
          dosHoras: h2 === undefined ? vacio<number>() : valor(h2),
        },
        fecha,
      },
    ],
  });

  it('91/179/152: sin alerta', () => {
    expect(evaluar(ptog, prueba(91, 179, 152))).toBeNull();
  });

  it('92 en ayunas sola: alerta, mostrando cuál', () => {
    const r = evaluar(ptog, prueba(92, 100, 100));
    expect(r?.titulo).toBe('Diabetes gestacional: PTOG alterada');
    expect(r?.porque).toEqual(['Ayunas: 92 mg/dL (alterado desde 92).']);
  });

  it('153 a las 2 horas sola: alerta', () => {
    expect(evaluar(ptog, prueba(80, 100, 153))?.porque).toEqual(['2 horas: 153 mg/dL (alterado desde 153).']);
  });

  it('con un valor faltante no clasifica y lo pide', () => {
    const r = evaluar(ptog, prueba(95, undefined, 120));
    expect(r?.titulo).toBe('PTOG incompleta: no se puede clasificar');
    expect(r?.porque[0]).toContain('1 hora');
  });

  it('fuera de las semanas 24 a 28 indica la semana', () => {
    expect(evaluar(ptog, prueba(95, 100, 100, T2))?.porque.join(' ')).toContain('semana 15+1, fuera de las semanas 24 a 28');
    expect(evaluar(ptog, prueba(95, 100, 100, '2026-11-23'))?.porque.join(' ')).not.toContain('fuera de'); // 25+0
  });

  it('en la ventana sin resultado: el resumen recuerda qué explicar antes de solicitarla', () => {
    expect(notasResumen(ctx({}, '2026-11-23')).join(' ')).toContain('responde a la dieta y el ejercicio');
  });
});
