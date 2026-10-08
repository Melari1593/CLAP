import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { ServicioCarne } from '../carne/servicio';
import { nivelDe } from '../privacidad/niveles';
import { gestanteConEmbarazo, nuevaBD, repo } from '../pruebas/util';
import { ErrorConsentimiento, ServicioConsentimientos, ultimoConsentimiento, type NuevoConsentimiento } from './servicio';

const cat = new Catalogo();
const TODO = { beneficios: true, riesgos: true, alternativas: true, implicaciones: true };
const base: NuevoConsentimiento = { tipo: 'datos_carne', decision: 'acepta', informado: TODO, preguntasResueltas: true, otorga: 'gestante' };

/** Cada llamada avanza un minuto desde las 15:00. */
function reloj() {
  let n = 0;
  return () => new Date(Date.parse('2026-10-06T15:00:00.000Z') + 60_000 * n++);
}

async function preparar() {
  const bd = nuevaBD();
  const r = repo(bd);
  const { embarazo } = await gestanteConEmbarazo(r);
  return { bd, r, embarazoId: embarazo.id, servicio: new ServicioConsentimientos(r, reloj()), carnes: new ServicioCarne(bd, r, cat, () => '2026-10-06') };
}

describe('Consentimiento informado (Resolución 3100 de 2019)', () => {
  it('guarda quién informó (con registro profesional), qué se explicó y la decisión', async () => {
    const { r, embarazoId, servicio } = await preparar();
    const c = await servicio.registrar(embarazoId, { ...base, tipo: 'procedimiento', procedimiento: ' Amniocentesis ' });
    expect(c.procedimiento).toBe('Amniocentesis');
    expect(c.informadoPor.nombre).toBe(r.usuario.nombre);
    expect(c.informado).toEqual(TODO);
    expect(c.fechaHora).toBe('2026-10-06T15:00:00.000Z');
  });

  it('no registra la aceptación sin informar los cuatro puntos y resolver las preguntas', async () => {
    const { embarazoId, servicio } = await preparar();
    await expect(servicio.registrar(embarazoId, { ...base, informado: { ...TODO, riesgos: false } })).rejects.toThrow('riesgos');
    await expect(servicio.registrar(embarazoId, { ...base, preguntasResueltas: false })).rejects.toThrow('preguntas');
    // "No acepta" sí se registra aunque no se haya completado la explicación.
    expect((await servicio.registrar(embarazoId, { ...base, decision: 'no_acepta', informado: { ...TODO, riesgos: false } })).decision).toBe('no_acepta');
  });

  it('exige el procedimiento, los datos del representante y que en la IVE decida la gestante', async () => {
    const { embarazoId, servicio } = await preparar();
    await expect(servicio.registrar(embarazoId, { ...base, tipo: 'procedimiento' })).rejects.toBeInstanceOf(ErrorConsentimiento);
    await expect(servicio.registrar(embarazoId, { ...base, otorga: 'representante', representante: { nombre: 'Rosa', parentesco: '', documento: '1' } })).rejects.toThrow(
      'representante',
    );
    await expect(servicio.registrar(embarazoId, { ...base, tipo: 'ive', otorga: 'representante' })).rejects.toThrow('IVE');
  });

  it('sin consentimiento para los datos no se crea el carné; si lo revoca, el carné queda pausado', async () => {
    const { r, embarazoId, servicio, carnes } = await preparar();
    await expect(carnes.crear(embarazoId, '1234', { canal: 'whatsapp', destino: '3001234567' })).rejects.toThrow('consentimiento');
    const c = await servicio.registrar(embarazoId, base);
    expect((await carnes.crear(embarazoId, '1234', { canal: 'whatsapp', destino: '3001234567' })).estado).toBe('activo');

    const revocado = await servicio.revocar(c.id, 'Prefiere no recibirlo');
    expect(revocado.revocado?.motivo).toBe('Prefiere no recibirlo');
    expect((await carnes.carneDe(embarazoId))?.estado).toBe('pausado');
    expect(await carnes.enviar(embarazoId)).toBe('pausado');

    // Vuelve a aceptar: el carné se reactiva. La revocatoria anterior se conserva.
    await servicio.registrar(embarazoId, base);
    expect((await carnes.carneDe(embarazoId))?.estado).toBe('activo');
    const historia = await r.historia(embarazoId);
    expect(historia?.consentimientos.filter((x) => x.revocado)).toHaveLength(1);
    expect(ultimoConsentimiento(historia!.consentimientos, 'datos_carne')?.revocado).toBeUndefined();
  });

  it('los consentimientos nunca van al carné', () => {
    expect(nivelDe('consentimientos')).toBe('nunca_en_carne');
  });
});
