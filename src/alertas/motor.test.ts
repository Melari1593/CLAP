import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import { ServicioConsultas } from '../consultas/servicio';
import { primeraConsultaCompleta } from '../pruebas/fixtures';
import { nuevaBD, repo } from '../pruebas/util';
import type { DatosPrimeraConsulta } from '../datos/modelo';
import type { Historia } from '../datos/repositorio';
import { historiaDePrueba } from '../pruebas/historia';
import { RegistroEventos } from '../eventos/eventos';
import { asa } from './asa';
import { construirContexto, evaluar as evaluarReglas, MotorAlertas, ordenarAlertas, type Regla, type ResultadoRegla } from './motor';
import { REGLAS } from './reglas';
import { tromboprofilaxis } from './trombo';

const cat = new Catalogo();
const HOY = '2026-10-06';

async function preparar() {
  const r = repo(nuevaBD());
  const servicio = new ServicioConsultas(r, cat, () => HOY);
  const motor = new MotorAlertas(r, REGLAS, cat, () => HOY);
  servicio.alCambiar(async (c) => {
    await motor.sincronizar(c.embarazoId);
  });
  const { embarazo } = await servicio.registrarOAbrir({
    documentoTipo: 'CC',
    documentoNumero: '1',
    nombres: 'Ana',
    apellidos: 'Pérez',
    fechaNacimiento: valor('1998-04-12'),
  });
  return { r, servicio, motor, embarazoId: embarazo!.id };
}

const activas = async (motor: MotorAlertas, embarazoId: string) =>
  (await motor.sincronizar(embarazoId)).filter((a) => a.activa).map((a) => a.regla).sort();

describe('Motor de alertas (C1)', () => {
  it('evalúa las reglas al guardar y cada alerta dice por qué se disparó', async () => {
    const { servicio, motor, embarazoId } = await preparar();
    await servicio.guardarPrimeraConsulta(embarazoId, primeraConsultaCompleta());
    const alertas = await motor.sincronizar(embarazoId);
    expect(alertas.filter((a) => a.activa).map((a) => a.regla).sort()).toEqual(['asa', 'calcio', 'habitos', 'no_planeado', 'violencia']);
    for (const a of alertas) expect(a.porque.length).toBeGreaterThan(0);
  });

  it('ninguna alerta impide guardar', async () => {
    const { servicio, embarazoId } = await preparar();
    const r = await servicio.guardarPrimeraConsulta(embarazoId, primeraConsultaCompleta());
    expect(r.estado).toBe('guardado');
  });

  it('una alerta atendida no reaparece si nada cambia, pero sí si la regla sube de nivel', async () => {
    const { servicio, motor, embarazoId } = await preparar();
    const d = primeraConsultaCompleta();
    d.gestacionActual.drogas = valor(false);
    d.gestacionActual.alcohol = valor(false); // hábitos: solo tabaco (nivel 1)
    const g = await servicio.guardarPrimeraConsulta(embarazoId, d);
    const consultaId = g.estado === 'guardado' ? g.registro.id : '';

    await motor.atender(`${embarazoId}:habitos`, 'Atendida');
    expect(await activas(motor, embarazoId)).not.toContain('habitos');
    expect(await activas(motor, embarazoId)).not.toContain('habitos'); // nada cambió

    d.gestacionActual.alcohol = valor(true); // nivel 2
    await servicio.guardarPrimeraConsulta(embarazoId, d, { consultaId });
    const alertas = await motor.sincronizar(embarazoId);
    const habitos = alertas.find((a) => a.regla === 'habitos')!;
    expect(habitos.activa).toBe(true);
    expect(habitos.decisionesAnteriores?.[0]?.opcion).toBe('Atendida');
  });

  it('si la condición deja de cumplirse y vuelve, la alerta reaparece', async () => {
    const { servicio, motor, embarazoId } = await preparar();
    const vdrl = (reactivo: boolean, fecha: string) =>
      servicio.registrarExamen({
        embarazoId,
        consultaId: 'c',
        fecha,
        tipo: 'vdrl',
        resultado: valor({ reactivo, fta: null, tratamiento: true, tratamientoPareja: true }),
      });
    await vdrl(true, '2026-07-01');
    await motor.sincronizar(embarazoId);
    await motor.atender(`${embarazoId}:sifilis`, 'Tratamiento indicado');
    await vdrl(false, '2026-08-01');
    expect(await activas(motor, embarazoId)).not.toContain('sifilis');
    await vdrl(true, '2026-09-01');
    expect(await activas(motor, embarazoId)).toContain('sifilis');
  });

  it('la decisión con motivo exige el motivo y queda en la historia', async () => {
    const { servicio, motor, embarazoId, r } = await preparar();
    await servicio.guardarPrimeraConsulta(embarazoId, primeraConsultaCompleta());
    await motor.sincronizar(embarazoId);
    const id = `${embarazoId}:habitos`;
    await expect(motor.atender(id, 'No requiere acción')).rejects.toThrow('motivo');
    const a = await motor.atender(id, 'No requiere acción', 'Consejería dada en otra institución');
    expect(a.decision).toMatchObject({ opcion: 'No requiere acción', motivo: 'Consejería dada en otra institución', profesionalId: 'prof-1' });
    expect((await r.bitacoraDe(id)).length).toBeGreaterThan(1);
  });

  it('ordena las urgentes primero', async () => {
    const { servicio, motor, embarazoId } = await preparar();
    await servicio.guardarPrimeraConsulta(embarazoId, primeraConsultaCompleta());
    const orden = ordenarAlertas((await motor.sincronizar(embarazoId)).filter((a) => a.activa)).map((a) => a.regla);
    expect(orden[0]).toBe('no_planeado');
  });

  it('decidir "Indicado" registra la indicación; una contraindicación nueva vuelve a avisar', async () => {
    const { servicio, motor, embarazoId, r } = await preparar();
    const d = primeraConsultaCompleta();
    const g = await servicio.guardarPrimeraConsulta(embarazoId, d);
    const consultaId = g.estado === 'guardado' ? g.registro.id : '';
    await motor.atender(`${embarazoId}:calcio`, 'Indicado');
    expect((await r.indicacionesDe(embarazoId)).map((i) => [i.tipo, i.estado])).toEqual([['calcio', 'indicado']]);
    expect(await activas(motor, embarazoId)).not.toContain('calcio');

    d.antecedentesCalcio.hipercalcemia = valor(true);
    await servicio.guardarPrimeraConsulta(embarazoId, d, { consultaId });
    const calcio = (await motor.sincronizar(embarazoId)).find((a) => a.regla === 'calcio')!;
    expect(calcio).toMatchObject({ activa: true, titulo: 'Calcio indicado, pero con contraindicación registrada: valorar' });
  });
});

describe('Motor de alertas: reactivación por cambio de variante', () => {
  // Regla de prueba cuyo resultado se controla desde el test.
  let actual: ResultadoRegla | null = null;
  const reglaPrueba: Regla = { id: 'prueba', evaluar: () => actual };

  async function prepararConRegla() {
    const r = repo(nuevaBD());
    const servicio = new ServicioConsultas(r, cat, () => HOY);
    const motor = new MotorAlertas(r, [reglaPrueba], cat, () => HOY);
    const { embarazo } = await servicio.registrarOAbrir({
      documentoTipo: 'CC',
      documentoNumero: '2',
      nombres: 'Bea',
      apellidos: 'Gómez',
      fechaNacimiento: valor('1995-01-01'),
    });
    return { motor, embarazoId: embarazo!.id };
  }

  const estado = async (motor: MotorAlertas, embarazoId: string) => (await motor.sincronizar(embarazoId)).find((a) => a.regla === 'prueba')!;

  it('reaparece si cambia la variante aunque la severidad no suba', async () => {
    const { motor, embarazoId } = await prepararConRegla();
    actual = { titulo: 'Considerar tromboprofilaxis', porque: ['x'], severidad: 3 };
    await motor.sincronizar(embarazoId);
    await motor.atender(`${embarazoId}:prueba`, 'Atendida');
    expect((await estado(motor, embarazoId)).activa).toBe(false);

    actual = { titulo: 'Con riesgo de sangrado', porque: ['x'], severidad: 3, variante: 'sangrado:Trombocitopenia' };
    const a = await estado(motor, embarazoId);
    expect(a.activa).toBe(true);
    expect(a.decisionesAnteriores?.[0]?.opcion).toBe('Atendida');
  });

  it('reaparece aunque la severidad baje, si la variante es otra', async () => {
    const { motor, embarazoId } = await prepararConRegla();
    actual = { titulo: 'A', porque: ['x'], severidad: 3 };
    await motor.sincronizar(embarazoId);
    await motor.atender(`${embarazoId}:prueba`, 'Atendida');
    actual = { titulo: 'Suspensión', porque: ['x'], variante: 'suspension' };
    expect((await estado(motor, embarazoId)).activa).toBe(true);
  });

  it('no reaparece si la variante y la severidad son las mismas', async () => {
    const { motor, embarazoId } = await prepararConRegla();
    actual = { titulo: 'A', porque: ['x'], severidad: 2, variante: 'sangrado:Trombocitopenia' };
    await motor.sincronizar(embarazoId);
    const atendida = await motor.atender(`${embarazoId}:prueba`, 'Atendida');
    expect(atendida.decision?.varianteAtendida).toBe('sangrado:Trombocitopenia');
    actual = { titulo: 'A', porque: ['texto actualizado'], severidad: 2, variante: 'sangrado:Trombocitopenia' };
    expect((await estado(motor, embarazoId)).activa).toBe(false);
  });
});

describe('Eventos de alertas con resultados sensibles', () => {
  it('VIH y sífilis no salen con su nombre ni con la opción elegida en los eventos de métricas', async () => {
    const bd = nuevaBD();
    const r = repo(bd);
    const eventos = new RegistroEventos(bd, 'ips-1');
    const servicio = new ServicioConsultas(r, cat, () => HOY);
    const motor = new MotorAlertas(r, REGLAS, cat, () => HOY, () => new Date(), eventos);
    const { embarazo } = await servicio.registrarOAbrir({ documentoTipo: 'CC', documentoNumero: '4', nombres: 'E', apellidos: 'F', fechaNacimiento: valor('1995-01-01') });
    const embarazoId = embarazo!.id;
    await servicio.registrarExamen({ embarazoId, consultaId: 'c', fecha: '2026-08-01', tipo: 'vih', resultado: valor({ solicitado: true, realizado: true, resultado: 'positivo' as const }) });
    await motor.sincronizar(embarazoId);
    await motor.atender(`${embarazoId}:vih`, 'Remitida al programa de VIH');
    const registrados = await bd.eventos.toArray();
    const deAlertas = registrados.filter((e) => e.tipo === 'alerta_activada' || e.tipo === 'alerta_decidida');
    expect(deAlertas.length).toBeGreaterThan(0);
    const texto = JSON.stringify(deAlertas);
    expect(texto).not.toContain('vih');
    expect(texto).not.toContain('VIH');
    // Tampoco se distingue del de sífilis por la urgencia.
    const activada = deAlertas.find((e) => e.tipo === 'alerta_activada');
    expect(activada).toMatchObject({ regla: 'resultado_sensible', urgente: false });
  });
});

describe('Parámetros pendientes de validar en las alertas', () => {
  const usaPendiente: Regla = { id: 'usa_pendiente', evaluar: (c) => (c.catalogo.valor('au.percentiles'), { titulo: 'P', porque: ['x'] }) };
  const usaDecidido: Regla = { id: 'usa_decidido', evaluar: (c) => (c.catalogo.valor('anemia.cortesHb'), { titulo: 'D', porque: ['x'] }) };

  it('cada alerta lista los parámetros pendientes que usó su regla, aunque otra regla los haya leído antes', () => {
    const catalogo = new Catalogo();
    const ctx = construirContexto(historiaDePrueba(), HOY, catalogo);
    const r = evaluarReglas([usaPendiente, { ...usaPendiente, id: 'otra' }, usaDecidido], ctx);
    const nombre = catalogo.parametro('au.percentiles').nombre;
    expect(r.get('usa_pendiente')?.parametrosPendientes).toEqual([nombre]);
    expect(r.get('otra')?.parametrosPendientes).toEqual([nombre]);
    expect(r.get('usa_decidido')?.parametrosPendientes).toBeUndefined();
  });

  it('la alerta guardada conserva el aviso para mostrarlo al profesional', async () => {
    const r = repo(nuevaBD());
    const servicio = new ServicioConsultas(r, cat, () => HOY);
    const motor = new MotorAlertas(r, [usaPendiente], cat, () => HOY);
    const { embarazo } = await servicio.registrarOAbrir({ documentoTipo: 'CC', documentoNumero: '3', nombres: 'C', apellidos: 'D', fechaNacimiento: valor('1995-01-01') });
    const [alerta] = await motor.sincronizar(embarazo!.id);
    expect(alerta?.parametrosPendientes).toEqual([cat.parametro('au.percentiles').nombre]);
  });
});

describe('Variantes de las reglas de tromboprofilaxis y ASA', () => {
  const ctx = (h: Historia) => construirContexto(h, HOY, cat);
  const conTrombosis = (d: DatosPrimeraConsulta) => {
    d.riesgoTrombotico.trombosisPrevia = valor(true);
  };

  it('tromboprofilaxis: el riesgo de sangrado (incluida la trombocitopenia del hemograma) cambia la variante', () => {
    const base = tromboprofilaxis.evaluar(ctx(historiaDePrueba({ primera: conTrombosis })));
    expect(base).not.toBeNull();
    expect(base?.variante).toBeUndefined();
    const conPlaquetas = tromboprofilaxis.evaluar(
      ctx(historiaDePrueba({ primera: conTrombosis, examenes: [{ tipo: 'plaquetas', valor: { x10e9L: 60 } }] })),
    );
    expect(conPlaquetas?.variante).toBe('sangrado:Trombocitopenia');
    expect(conPlaquetas?.severidad).toBe(base?.severidad);
  });

  it('tromboprofilaxis: el aviso de suspensión tiene su propia variante', () => {
    const r = tromboprofilaxis.evaluar(
      ctx(
        historiaDePrueba({
          factores: [{ tipo: 'inmovilidadODeshidratacion', inicio: '2026-08-01', resolucion: '2026-10-03', conHospitalizacion: false }],
          indicaciones: [{ tipo: 'tromboprofilaxis', estado: 'indicado' }],
        }),
      ),
    );
    expect(r?.titulo).toBe('Tromboprofilaxis: fecha de suspensión');
    expect(r?.variante).toBe('suspension');
  });

  it('ASA: una contraindicación nueva cambia la variante', () => {
    const conCriterio = (d: DatosPrimeraConsulta) => {
      d.riesgoPreeclampsia.hipertensionCronica = valor(true);
    };
    const sin = asa.evaluar(ctx(historiaDePrueba({ primera: conCriterio })));
    const con = asa.evaluar(
      ctx(
        historiaDePrueba({
          primera: (d) => {
            conCriterio(d);
            d.riesgoPreeclampsia.alergiaASAoAINE = valor(true);
          },
        }),
      ),
    );
    expect(sin).not.toBeNull();
    expect(sin?.variante).toBeUndefined();
    expect(con?.variante).toBe('contraindicacion:Alergia al ASA o a los AINE');
  });
});
