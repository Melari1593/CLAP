import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import { MotorAlertas } from '../alertas/motor';
import { REGLAS } from '../alertas/reglas';
import { ServicioCarne } from '../carne/servicio';
import { gestanteBase } from '../casos/casos';
import { ServicioConsultas } from '../consultas/servicio';
import { ServicioDerechos } from '../derechos/servicio';
import { primeraConsultaCompleta, seguimiento } from '../pruebas/fixtures';
import { nuevaBD, repo } from '../pruebas/util';
import { RegistroEventos } from './eventos';
import {
  alertasPorRegla,
  asaATiempo,
  asesoriaATiempo,
  comprension,
  duracionConsultas,
  llegadaPreparada,
  ptogATiempo,
  riesgoTromboticoEvaluado,
  rutaActivada,
  usoDelCarne,
} from './metricas';

/** Recorre dos gestantes con un reloj que avanza y devuelve los eventos registrados. */
async function escenario() {
  const cat = new Catalogo();
  const bd = nuevaBD();
  const r = repo(bd);
  let ahora = new Date('2026-08-24T14:00:00.000Z');
  const reloj = () => ahora;
  const hoy = () => ahora.toISOString().slice(0, 10);
  const ir = (iso: string) => (ahora = new Date(iso));
  const eventos = new RegistroEventos(bd, 'ips-1', reloj);
  const consultas = new ServicioConsultas(r, cat, hoy, eventos);
  const motor = new MotorAlertas(r, REGLAS, cat, hoy, reloj, eventos);
  consultas.alCambiar(async (c) => {
    await motor.sincronizar(c.embarazoId);
  });
  const derechos = new ServicioDerechos(r, motor, cat, hoy, reloj, eventos);
  const carnes = new ServicioCarne(bd, r, cat, hoy, reloj, eventos);
  const guardado = <T extends { estado: string }>(x: T) => {
    if (x.estado !== 'guardado') throw new Error('no guardó');
    return (x as unknown as { registro: { id: string } }).registro.id;
  };

  // Gestante 1: HTA crónica (criterio de ASA), WhatsApp.
  const { embarazo: e1 } = await consultas.registrarOAbrir({ documentoTipo: 'CC', documentoNumero: '1', nombres: 'Ana', apellidos: 'A', fechaNacimiento: valor('1998-04-12') });
  const p1 = primeraConsultaCompleta();
  gestanteBase(p1);
  p1.riesgoPreeclampsia.hipertensionCronica = valor(true);
  const c1 = guardado(await consultas.guardarPrimeraConsulta(e1!.id, p1)); // 12+0
  await motor.atender(`${e1!.id}:asa`, 'Indicado');
  await consultas.cerrarConsulta(c1, 30 * 60);
  await carnes.crear(e1!.id, '1234', { canal: 'whatsapp', destino: '3001234567' });
  await carnes.enviar(e1!.id);
  await carnes.registrarComprension(e1!.id, true, 3);

  ir('2026-09-03T20:00:00.000Z');
  await eventos.registrar(e1!.id, { tipo: 'carne_abierto' });

  ir('2026-09-21T14:00:00.000Z'); // 16+0: trae el hemograma y la prueba treponémica
  for (const tipo of ['hb', 'sifilisTreponemica'] as const) {
    await consultas.registrarExamen({
      embarazoId: e1!.id,
      consultaId: 'x',
      fecha: '2026-09-21',
      tipo,
      resultado: valor(tipo === 'hb' ? { gdl: 13, muestra: 'venosa' } : { reactiva: false }),
    } as Parameters<typeof consultas.registrarExamen>[0]);
  }
  await consultas.cerrarConsulta(guardado(await consultas.guardarSeguimiento(e1!.id, seguimiento(64))), 15 * 60);

  ir('2026-11-23T14:00:00.000Z'); // 25+0: PTOG
  await consultas.registrarExamen({
    embarazoId: e1!.id,
    consultaId: 'x',
    fecha: '2026-11-23',
    tipo: 'ptog',
    resultado: valor({ ayunas: valor(80), unaHora: valor(120), dosHoras: valor(110) }),
  });

  ir('2026-12-21T14:00:00.000Z'); // 29+0
  await consultas.cerrarConsulta(guardado(await consultas.guardarSeguimiento(e1!.id, seguimiento(68))), 25 * 60);

  // Gestante 2: 13 años, no planeado y no desea continuar; solicita IVE con remisión el mismo día.
  ir('2026-08-24T15:00:00.000Z');
  const { embarazo: e2 } = await consultas.registrarOAbrir({ documentoTipo: 'CC', documentoNumero: '2', nombres: 'Bea', apellidos: 'B', fechaNacimiento: valor('2013-01-01') });
  const p2 = primeraConsultaCompleta();
  gestanteBase(p2);
  p2.planificacion.embarazoPlaneado = valor(false);
  p2.planificacion.deseaContinuar = valor('no');
  const c2 = guardado(await consultas.guardarPrimeraConsulta(e2!.id, p2));
  await derechos.registrar(e2!.id, {
    desencadenante: 'no_planeado',
    momentoASolas: true,
    decision: 'solicita_ive',
    prestador: 'X',
    remisionFechaHora: '2026-08-24T15:30:00.000Z',
  });
  await consultas.cerrarConsulta(c2);
  await carnes.registrarComprension(e2!.id, false, 3);

  return eventos.todos();
}

describe('Métricas de éxito calculadas con los eventos (G2)', () => {
  it('cada métrica del spec se calcula con una consulta sobre los eventos', async () => {
    const ev = await escenario();
    const p = (numerador: number, denominador: number) => ({ numerador, denominador, valor: denominador ? numerador / denominador : null });

    // El carné se usa: abrió en el primer intervalo, no en el segundo.
    expect(usoDelCarne(ev, 'whatsapp')).toEqual({ intervalos: p(1, 2), gestantes: p(1, 1) });
    // Llegan preparadas: de 7 pendientes en la semana 12 (6 exámenes y la ecografía) trajo 2
    // (hemograma y sífilis); de los 5 que quedaban en la semana 16, ninguno.
    expect(llegadaPreparada(ev)).toEqual(p(2, 12));
    // Duración de los controles de seguimiento: 15 y 25 minutos.
    expect(duracionConsultas(ev)).toEqual({ consultas: 2, medianaMinutos: 20 });
    // ASA decidido el mismo día en que apareció la alerta.
    expect(asaATiempo(ev)).toEqual(p(1, 1));
    // PTOG en la semana 25 de la gestante que llegó a la 29.
    expect(ptogATiempo(ev)).toEqual(p(1, 1));
    // Asesoría el mismo día de la alerta; remisión de la IVE el mismo día.
    expect(asesoriaATiempo(ev)).toEqual({ asesoria: p(1, 1), remisionMismoDia: p(1, 1) });
    // Menor de 14 años sin la ruta registrada: 0 de 1 (la métrica lo detecta).
    expect(rutaActivada(ev)).toEqual(p(0, 1));
    // Riesgo trombótico en la primera consulta y en la semana 28.
    expect(riesgoTromboticoEvaluado(ev)).toEqual({ primeraConsulta: p(2, 2), semana28: p(1, 1), decisionConCriterio: p(0, 0) });
    // Comprensión: una sabe la cita y 3 signos; la otra no sabe la cita.
    expect(comprension(ev)).toEqual(p(1, 2));
    // Insumo para la revisión de historias.
    expect(alertasPorRegla(ev)).toMatchObject({ asa: 1, menor_14: 1, no_planeado: 1 });
  });

  it('los eventos no llevan nombres, documentos ni resultados', async () => {
    const texto = JSON.stringify(await escenario());
    for (const prohibido of ['Ana', 'Bea', '"1"', 'gdl', 'reactivo', '3001234567', 'Prestador']) expect(texto).not.toContain(prohibido);
  });
});
