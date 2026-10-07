import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import { construirContexto, MotorAlertas } from '../alertas/motor';
import { REGLAS } from '../alertas/reglas';
import { ServicioConsultas } from '../consultas/servicio';
import { proyectarCarne, MENSAJE_CARNE_PAUSADO } from '../privacidad/carne';
import { primeraConsultaCompleta } from '../pruebas/fixtures';
import { historiaDePrueba } from '../pruebas/historia';
import { nuevaBD, repo } from '../pruebas/util';
import { carneDebeEstarPausado, disparadores, ErrorDerechos, marcoSegunEG, ServicioDerechos } from './servicio';
import { avisoRuta } from './textos';
import { CONFIGURACION_DEMO } from '../institucion/configuracion';

const cat = new Catalogo();
type Opciones = NonNullable<Parameters<typeof historiaDePrueba>[0]>;
const ctx = (op: Opciones = {}, hoy = '2026-10-06') => construirContexto(historiaDePrueba(op), hoy, cat);
// FUM 2026-06-01: semana 24+0 = 2026-11-16.

describe('Disparadores del flujo (E1)', () => {
  it('embarazo no planeado sin decisión de continuar, violencia y menor de 14 años', () => {
    // Los datos de prueba registran violencia no sexual en el embarazo actual.
    expect(disparadores(ctx())).toEqual(['no_planeado', 'violencia_mujer']); // no ha decidido
    expect(disparadores(ctx({ primera: (d) => (d.planificacion.deseaContinuar = valor('no')) }))).toEqual(['no_planeado', 'violencia_mujer']);
    expect(disparadores(ctx({ primera: (d) => (d.planificacion.deseaContinuar = valor('si')) }))).toEqual(['violencia_mujer']);
    expect(disparadores(ctx({ primera: (d) => {
      d.planificacion.deseaContinuar = valor('si');
      d.gestacionActual.violencia = valor(false);
    } }))).toEqual([]);
    expect(disparadores(ctx({ primera: (d) => {
      d.planificacion.embarazoPlaneado = valor(true);
      d.gestacionActual.violenciaSexual = valor(true);
    } }))).toEqual(['violencia_sexual']);
    expect(disparadores(ctx({ fechaNacimiento: '2013-01-01', primera: (d) => (d.planificacion.embarazoPlaneado = valor(true)) }))).toEqual(['violencia_mujer', 'menor_14']);
  });

  it('las alertas de esos disparadores enlazan con "Opciones y derechos"', () => {
    const enlazadas = REGLAS.map((r) => r.evaluar(ctx({
      fechaNacimiento: '2013-01-01',
      primera: (d) => (d.gestacionActual.violenciaSexual = valor(true)),
    }))).filter((r) => r?.enlace === 'derechos').map((r) => r!.titulo);
    expect(enlazadas).toHaveLength(3);
  });
});

describe('Marco según la EG (E1)', () => {
  it('hasta la semana 24: por la sola voluntad; después: causales', () => {
    expect(marcoSegunEG(ctx({}, '2026-11-16')).tipo).toBe('voluntad'); // 24+0
    const despues = marcoSegunEG(ctx({}, '2026-11-17')); // 24+1
    expect(despues.tipo).toBe('causales');
    expect(despues.texto).toContain('si se configura una causal');
    expect('norma' in despues && despues.norma).toContain('Sentencia C-355 de 2006 — fecha de verificación pendiente');
  });

  it('con EG no confiable cerca de la semana 24 pide confirmarla, sin dilatar', () => {
    const dudosa = (hoy: string) => marcoSegunEG(ctx({ primera: (d) => (d.gestacionActual.egConfiablePorFum = valor(false)) }, hoy));
    expect(dudosa('2026-11-17')).toMatchObject({ tipo: 'confirmar_eg' });
    expect(dudosa('2026-11-17').texto).toContain('sin dilatar');
    expect(dudosa('2026-08-01').tipo).toBe('voluntad'); // lejos de la 24
    expect(marcoSegunEG(ctx({ primera: (d) => (d.gestacionActual.fum = { estado: 'vacio' }) })).tipo).toBe('confirmar_eg');
  });

  it('violencia sexual y menor de 14: causal sin límite de EG', () => {
    expect(avisoRuta(true).join(' ')).toContain('se presume violencia sexual');
    expect(avisoRuta(false).join(' ')).toContain('sin límite de edad gestacional');
  });
});

async function preparar(hoy = '2026-10-06', ahora = '2026-10-06T15:00:00.000Z', institucion?: typeof CONFIGURACION_DEMO) {
  const bd = nuevaBD();
  const r = repo(bd);
  const consultas = new ServicioConsultas(r, cat, () => hoy);
  const motor = new MotorAlertas(r, REGLAS, cat, () => hoy);
  consultas.alCambiar(async (c) => {
    await motor.sincronizar(c.embarazoId);
  });
  const derechos = new ServicioDerechos(r, motor, cat, () => hoy, () => new Date(ahora), undefined, institucion);
  const { embarazo } = await consultas.registrarOAbrir({
    documentoTipo: 'CC',
    documentoNumero: '1',
    nombres: 'Ana',
    apellidos: 'Pérez',
    fechaNacimiento: valor('1998-04-12'),
  });
  const embarazoId = embarazo!.id;
  await consultas.guardarPrimeraConsulta(embarazoId, primeraConsultaCompleta()); // no planeado, no ha decidido
  const carne = await r.guardar('carnes', {
    embarazoId,
    token: 't',
    pinHash: 'h',
    pinSal: 's',
    canal: 'whatsapp',
    estado: 'activo',
    intentosFallidos: 0,
  });
  const conReloj = (fechaHora: string) => new ServicioDerechos(r, motor, cat, () => fechaHora.slice(0, 10), () => new Date(fechaHora));
  return { r, motor, derechos, embarazoId, carneId: carne.id, conReloj };
}

describe('Registro de la decisión (E1)', () => {
  it('solicitud de IVE: remisión fechada, carné pausado y alerta atendida', async () => {
    const { r, motor, derechos, embarazoId, carneId } = await preparar();
    const reg = await derechos.registrar(embarazoId, {
      desencadenante: 'no_planeado',
      momentoASolas: true,
      decision: 'solicita_ive',
      prestador: 'IPS Prestadora',
      remisionFechaHora: '2026-10-06T15:10:00.000Z',
    });
    expect(reg.solicitudIVE).toEqual({
      fechaHora: '2026-10-06T15:00:00.000Z',
      prestador: 'IPS Prestadora',
      manual: true, // sin prestador configurado
      remisionFechaHora: '2026-10-06T15:10:00.000Z',
    });
    expect(reg.egDias).toBe(127);
    expect((await r.leer('carnes', carneId))?.estado).toBe('pausado');

    const historia = (await r.historia(embarazoId))!;
    expect(proyectarCarne(historia, historia.carne!, "2026-10-06", cat)).toEqual({ estado: 'pausado', mensaje: MENSAJE_CARNE_PAUSADO });
    const alerta = (await motor.sincronizar(embarazoId)).find((a) => a.regla === 'no_planeado')!;
    expect(alerta).toMatchObject({ activa: false, decision: { opcion: 'Asesoría realizada y decisión registrada' } });
  });

  it('si cambia de decisión y continúa, el carné se reactiva', async () => {
    const { r, derechos, embarazoId, carneId, conReloj } = await preparar();
    await derechos.registrar(embarazoId, { desencadenante: 'no_planeado', momentoASolas: true, decision: 'solicita_ive', prestador: 'X' });
    expect((await r.leer('carnes', carneId))?.estado).toBe('pausado');
    await conReloj('2026-10-07T09:00:00.000Z').registrar(embarazoId, { desencadenante: 'no_planeado', momentoASolas: true, decision: 'continua' });
    expect((await r.leer('carnes', carneId))?.estado).toBe('activo');
    expect((await r.historia(embarazoId))!.derechos.map((d) => d.decision)).toEqual(['solicita_ive', 'continua']);
  });

  it('valida lo que la norma exige registrar', async () => {
    const { derechos, embarazoId } = await preparar();
    const base = { desencadenante: 'no_planeado' as const, momentoASolas: true };
    await expect(derechos.registrar(embarazoId, { ...base, decision: 'solicita_ive' })).rejects.toBeInstanceOf(ErrorDerechos);
    await expect(derechos.registrar(embarazoId, { ...base, decision: 'lo_pensara' })).rejects.toThrow('cita cercana');
  });

  it('después de la semana 24 la solicitud exige la causal', async () => {
    const { derechos, embarazoId } = await preparar('2026-11-20', '2026-11-20T10:00:00.000Z'); // 24+4
    const base = { desencadenante: 'pregunta_gestante' as const, momentoASolas: true, decision: 'solicita_ive' as const, prestador: 'X' };
    await expect(derechos.registrar(embarazoId, base)).rejects.toThrow('causal');
    const reg = await derechos.registrar(embarazoId, { ...base, causal: 'salud' });
    expect(reg.causal).toBe('salud');
    // Causal de violencia sexual: sin denuncia, pero consignada en la historia clínica.
    await expect(derechos.registrar(embarazoId, { ...base, causal: 'violencia_sexual' })).rejects.toThrow('No se exige denuncia');
    const vs = await derechos.registrar(embarazoId, { ...base, causal: 'violencia_sexual', notas: 'Relata agresión sexual en junio por conocido.' });
    expect(vs.causal).toBe('violencia_sexual');
  });

  it('activar la ruta de violencia sexual registra fecha, notificaciones y atiende la alerta', async () => {
    const { r, motor, derechos, embarazoId } = await preparar();
    const consulta = (await r.historia(embarazoId))!.consultas[0]!;
    const d = consulta.primera!;
    d.gestacionActual.violenciaSexual = valor(true);
    await r.guardar('consultas', { ...consulta, primera: d });
    await motor.sincronizar(embarazoId);

    const reg = await derechos.registrar(embarazoId, {
      desencadenante: 'violencia_sexual',
      momentoASolas: true,
      decision: 'no_desea_hablar',
      rutaActivadaFechaHora: '2026-10-06T15:05:00.000Z',
      notificaciones: [{ a: 'Comisaría de familia', fechaHora: '2026-10-06T15:20:00.000Z' }],
    });
    expect(reg.rutaViolencia?.notificaciones).toHaveLength(1);
    const violencia = (await motor.sincronizar(embarazoId)).find((a) => a.regla === 'violencia')!;
    expect(violencia).toMatchObject({ activa: false, decision: { opcion: 'Ruta activada' } });
  });

  it('nada del registro aparece en el carné activo', async () => {
    const { r, derechos, embarazoId } = await preparar();
    await derechos.registrar(embarazoId, {
      desencadenante: 'no_planeado',
      momentoASolas: true,
      decision: 'lo_pensara',
      citaCercana: '2026-10-09',
      notas: 'NOTA-DERECHOS-PRIVADA',
    });
    const historia = (await r.historia(embarazoId))!;
    expect(historia.carne?.estado).toBe('activo');
    const texto = JSON.stringify(proyectarCarne(historia, historia.carne!, "2026-10-06", cat));
    for (const prohibido of ['NOTA-DERECHOS-PRIVADA', 'lo_pensara', 'no_planeado', 'no_ha_decidido', 'IVE', 'derechos']) {
      expect(texto).not.toContain(prohibido);
    }
    expect(carneDebeEstarPausado(historia.derechos)).toBe(false);
  });
});

describe('Configuración de la institución (prestador de IVE y ruta de violencia sexual)', () => {
  it('con prestador configurado, remitir a él no es manual; a otro, sí', async () => {
    const { derechos, embarazoId } = await preparar(undefined, undefined, CONFIGURACION_DEMO);
    const nombre = CONFIGURACION_DEMO.prestadorIVE!.nombre;
    expect(derechos.prestadorConfigurado()).toBe(nombre);
    const base = { desencadenante: 'no_planeado' as const, momentoASolas: true, decision: 'solicita_ive' as const };
    expect((await derechos.registrar(embarazoId, { ...base, prestador: nombre })).solicitudIVE?.manual).toBe(false);
    expect((await derechos.registrar(embarazoId, { ...base, prestador: 'Otro prestador' })).solicitudIVE?.manual).toBe(true);
  });

  it('la ruta combina los pasos del catálogo con los contactos de la institución; el ICBF solo con menores de 14', async () => {
    const { derechos } = await preparar(undefined, undefined, CONFIGURACION_DEMO);
    const adulta = derechos.rutaViolenciaSexual(false);
    expect(adulta.pasos.join(' ')).toContain('SIVIGILA');
    expect(adulta.pasos.join(' ')).toContain('no aplica la anticoncepción de emergencia');
    expect(adulta.contactos.map((c) => c.entidad)).not.toContain('ICBF');
    expect(derechos.rutaViolenciaSexual(true).contactos.map((c) => c.entidad)).toContain('ICBF');
    expect(adulta.ficticia).toBe(true);
  });

  it('sin configuración: sin prestador ni contactos, la remisión es manual', async () => {
    const { derechos } = await preparar();
    expect(derechos.prestadorConfigurado()).toBeNull();
    expect(derechos.rutaViolenciaSexual(true).contactos).toEqual([]);
  });
});

describe('Ruta de violencia contra la mujer (Ley 1257 de 2008)', () => {
  it('la alerta de violencia no sexual enlaza con la ruta y se atiende al activarla', async () => {
    const { r, motor, derechos, embarazoId } = await preparar(undefined, undefined, CONFIGURACION_DEMO);
    const alerta = (await motor.sincronizar(embarazoId)).find((a) => a.regla === 'violencia')!;
    expect(alerta).toMatchObject({ activa: true, enlace: 'derechos', titulo: 'Violencia en el embarazo actual' });
    expect(alerta.porque.join(' ')).toContain('Ley 1257 de 2008');

    const ruta = derechos.rutaViolenciaContraLaMujer();
    expect(ruta.pasos.join(' ')).toContain('medidas de atención');
    expect(ruta.contactos.map((c) => c.entidad)).toContain('Comisaría de familia');

    await derechos.registrar(embarazoId, {
      desencadenante: 'violencia_mujer',
      momentoASolas: true,
      decision: 'continua',
      rutaActivadaFechaHora: '2026-10-06T15:05:00.000Z',
      notificaciones: [{ a: 'Comisaría de familia', fechaHora: '2026-10-06T15:20:00.000Z' }],
    });
    const despues = (await motor.sincronizar(embarazoId)).find((a) => a.regla === 'violencia')!;
    expect(despues).toMatchObject({ activa: false, decision: { opcion: 'Ruta activada' } });
    expect((await r.historia(embarazoId))!.derechos[0]?.rutaViolencia?.notificaciones).toHaveLength(1);
  });

  it('la ruta de violencia sexual dice que es gratuita y sin importar el tiempo ni la denuncia (Ley 1719 de 2014)', () => {
    const pasos = cat.valor('derechos.rutaViolenciaSexual').join(' ');
    expect(pasos).toContain('gratis');
    expect(pasos).toContain('sin importar el tiempo transcurrido');
    expect(pasos).toContain('Ley 1719 de 2014');
    expect(cat.valor('derechos.normas').map((n) => n.norma)).toEqual(expect.arrayContaining(['Ley 1146 de 2007', 'Ley 1257 de 2008', 'Ley 1719 de 2014']));
  });
});
