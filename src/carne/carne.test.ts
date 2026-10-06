import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import { MotorAlertas } from '../alertas/motor';
import { REGLAS } from '../alertas/reglas';
import { ServicioConsultas } from '../consultas/servicio';
import { ServicioDerechos } from '../derechos/servicio';
import { MENSAJE_CARNE_PAUSADO, proyectarCarne } from '../privacidad/carne';
import { primeraConsultaCompleta, SECRETO, seguimiento } from '../pruebas/fixtures';
import { nuevaBD, repo } from '../pruebas/util';
import { derivarPin, verificarPin } from './pin';
import { ErrorCarne, ServicioCarne } from './servicio';

const cat = new Catalogo();
const HOY = '2026-10-06';

async function preparar() {
  const bd = nuevaBD();
  const r = repo(bd);
  const consultas = new ServicioConsultas(r, cat, () => HOY);
  const motor = new MotorAlertas(r, REGLAS, cat, () => HOY);
  consultas.alCambiar(async (c) => {
    await motor.sincronizar(c.embarazoId);
  });
  const carnes = new ServicioCarne(bd, r, cat, () => HOY);
  const derechos = new ServicioDerechos(r, motor, cat, () => HOY);
  const { embarazo } = await consultas.registrarOAbrir({
    documentoTipo: 'CC',
    documentoNumero: '1',
    nombres: 'Ana María',
    apellidos: 'Pérez',
    fechaNacimiento: valor('1998-04-12'),
  });
  const embarazoId = embarazo!.id;
  return { bd, r, consultas, motor, carnes, derechos, embarazoId };
}

describe('PIN del carné (F3, F4)', () => {
  it('guarda solo la derivación del PIN, nunca el PIN', async () => {
    const { r, carnes, embarazoId } = await preparar();
    const carne = await carnes.crear(embarazoId, '4821', { canal: 'whatsapp', destino: '300 123 4567' });
    expect(JSON.stringify(await r.leer('carnes', carne.id))).not.toContain('4821');
    expect(carne.pinHash).toBe(await derivarPin('4821', carne.pinSal));
    expect(carne.destino).toBe('3001234567');
  });

  it('después de 5 intentos fallidos, el sexto queda bloqueado un rato', async () => {
    const sal = 'sal';
    let carne = { pinHash: await derivarPin('1234', sal), pinSal: sal, intentosFallidos: 0, bloqueadoHasta: undefined as string | undefined };
    const ahora = new Date('2026-10-06T10:00:00.000Z');
    const respuestas = [];
    for (let i = 0; i < 6; i++) {
      const { respuesta, cambios } = await verificarPin(carne, '0000', ahora, cat);
      respuestas.push(respuesta.resultado);
      carne = { ...carne, ...cambios };
    }
    expect(respuestas).toEqual(['incorrecto', 'incorrecto', 'incorrecto', 'incorrecto', 'bloqueado', 'bloqueado']);
    // Bloqueado, ni el PIN correcto entra.
    expect((await verificarPin(carne, '1234', ahora, cat)).respuesta.resultado).toBe('bloqueado');
    // Pasado el bloqueo, el PIN correcto entra.
    const despues = new Date(ahora.getTime() + 16 * 60_000);
    expect((await verificarPin(carne, '1234', despues, cat)).respuesta.resultado).toBe('correcto');
  });

  it('valida el PIN y el destino', async () => {
    const { carnes, embarazoId } = await preparar();
    await expect(carnes.crear(embarazoId, '12a4', { canal: 'impreso' })).rejects.toBeInstanceOf(ErrorCarne);
    await expect(carnes.crear(embarazoId, '1234', { canal: 'correo', destino: 'ana@correo' })).rejects.toThrow('correo');
    const c = await carnes.crear(embarazoId, '1234', { canal: 'correo', destino: 'Ana@Correo.com ' });
    expect(c.destino).toBe('ana@correo.com');
  });
});

describe('Enlace, destino y envío (F3, F5)', () => {
  it('cambiar el número deja inservible el enlace viejo; un PIN nuevo no cambia el enlace', async () => {
    const { carnes, embarazoId } = await preparar();
    const c = await carnes.crear(embarazoId, '1234', { canal: 'whatsapp', destino: '3001234567' });
    const otroPin = await carnes.nuevoPin(c.id, '9876');
    expect(otroPin.token).toBe(c.token);
    const otroNumero = await carnes.cambiarDestino(c.id, { canal: 'whatsapp', destino: '3109876543' });
    expect(otroNumero.token).not.toBe(c.token);
    const aCorreo = await carnes.cambiarDestino(c.id, { canal: 'correo', destino: 'ana@correo.com' });
    expect(aCorreo).toMatchObject({ canal: 'correo', destino: 'ana@correo.com' });
  });

  it('cerrar con WhatsApp o correo deja el envío en cola; impreso o pausado no envía', async () => {
    const { bd, carnes, derechos, embarazoId, consultas } = await preparar();
    await consultas.guardarPrimeraConsulta(embarazoId, primeraConsultaCompleta());
    await carnes.crear(embarazoId, '1234', { canal: 'whatsapp', destino: '3001234567' });
    expect(await carnes.enviar(embarazoId)).toBe('en_cola');
    expect(await bd.cola.where({ estado: 'pendiente' }).filter((i) => i.tipo === 'enviar_carne').count()).toBe(1);

    await derechos.registrar(embarazoId, { desencadenante: 'no_planeado', momentoASolas: true, decision: 'solicita_ive', prestador: 'X' });
    expect(await carnes.enviar(embarazoId)).toBe('pausado');
  });

  it('un carné creado después de una solicitud de IVE nace pausado', async () => {
    const { carnes, derechos, embarazoId, consultas } = await preparar();
    await consultas.guardarPrimeraConsulta(embarazoId, primeraConsultaCompleta());
    await derechos.registrar(embarazoId, { desencadenante: 'no_planeado', momentoASolas: true, decision: 'solicita_ive', prestador: 'X' });
    const c = await carnes.crear(embarazoId, '1234', { canal: 'whatsapp', destino: '3001234567' });
    expect(c.estado).toBe('pausado');
    expect(await carnes.vistaPrevia(embarazoId)).toEqual({ estado: 'pausado', mensaje: MENSAJE_CARNE_PAUSADO });
  });
});

describe('Contenido del carné (F4)', () => {
  it('muestra semanas, FPP, próxima cita, qué hacer, coágulos, pendientes, grupo, vacunas y citas', async () => {
    const { r, consultas, motor, carnes, embarazoId } = await preparar();
    const p = await consultas.guardarPrimeraConsulta(embarazoId, primeraConsultaCompleta(), {
      proximaCita: valor({ fecha: '2026-11-03', lugar: 'IPS 1', queLlevar: 'Exámenes de sangre' }),
    });
    if (p.estado !== 'guardado') throw new Error();
    await consultas.cerrarConsulta(p.registro.id);
    await motor.atender(`${embarazoId}:calcio`, 'Indicado');
    await consultas.marcarIndicacion(embarazoId, 'tromboprofilaxis', { estado: 'indicado' });
    await carnes.crear(embarazoId, '1234', { canal: 'whatsapp', destino: '3001234567' });

    const datos = await carnes.vistaPrevia(embarazoId);
    expect(datos).toMatchObject({
      estado: 'activo',
      nombre: 'Ana',
      semanas: { semanas: 18, dias: 1 },
      fpp: '2027-03-08',
      proximaCita: { fecha: '2026-11-03', lugar: 'IPS 1' },
      indicaciones: expect.arrayContaining(['calcio', 'tromboprofilaxis']),
      senalesCoagulo: true,
      grupo: 'O',
      rh: '+',
    });
    if (datos?.estado !== 'activo') throw new Error();
    expect(datos.examenesPendientes).toContain('Exámenes de sangre del control prenatal.');
    void r;
  });

  it('un caso con VIH, violencia, drogas, notas y solicitud de IVE no deja ver nada de eso', async () => {
    const { r, consultas, carnes, embarazoId } = await preparar();
    await consultas.guardarPrimeraConsulta(embarazoId, primeraConsultaCompleta());
    const s = await consultas.guardarSeguimiento(embarazoId, seguimiento(64));
    if (s.estado === 'guardado') await consultas.cerrarConsulta(s.registro.id);
    await consultas.registrarExamen({
      embarazoId,
      consultaId: 'c',
      fecha: HOY,
      tipo: 'vih',
      resultado: valor({ solicitado: true, realizado: true, resultado: 'positivo' as const, codigo: SECRETO.codigoVih }),
    });
    const c = await carnes.crear(embarazoId, '1234', { canal: 'whatsapp', destino: '3001234567' });
    const historia = (await r.historia(embarazoId))!;
    const texto = JSON.stringify(proyectarCarne(historia, c, HOY, cat)).toLowerCase();
    for (const prohibido of [SECRETO.codigoVih, SECRETO.notaInterna, 'vih', 'positivo', 'violencia', 'drogas', 'alcohol', 'no_ha_decidido', 'observaciones']) {
      expect(texto).not.toContain(prohibido.toLowerCase());
    }
  });
});
