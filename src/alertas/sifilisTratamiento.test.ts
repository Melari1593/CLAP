// Sífilis: el tratamiento se registra desde la alerta, con fecha, y la alerta se cierra solo con un
// VDRL/RPR de control posterior no reactivo. Una reinfección pide un tratamiento nuevo.
import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import { ServicioConsultas } from '../consultas/servicio';
import type { Carne, Indicacion, ResultadoPorTipo, TipoExamen } from '../datos/modelo';
import { proyectarCarne } from '../privacidad/carne';
import { historiaDePrueba } from '../pruebas/historia';
import { nuevaBD, repo } from '../pruebas/util';
import { construirContexto, MotorAlertas } from './motor';
import { REGLAS } from './reglas';
import { sifilis } from './reglasClap';

const cat = new Catalogo();
const HOY = '2026-10-06';

type Examen = { tipo: TipoExamen; valor: ResultadoPorTipo[TipoExamen]; fecha?: string };
const trep = (fecha: string): Examen => ({ tipo: 'sifilisTreponemica', valor: { reactiva: true }, fecha });
const vdrl = (reactivo: boolean, fecha: string): Examen => ({ tipo: 'vdrl', valor: { reactivo, fta: null, tratamiento: null, tratamientoPareja: true }, fecha });

function evaluarCon(examenes: Examen[], tratamiento?: Pick<Indicacion, 'estado' | 'fechaInicio'>) {
  const h = historiaDePrueba({ examenes, indicaciones: tratamiento ? [{ tipo: 'tratamientoSifilis', estado: tratamiento.estado }] : [] });
  if (tratamiento) h.indicaciones[0]!.fechaInicio = tratamiento.fechaInicio;
  return sifilis.evaluar(construirContexto(h, HOY, cat));
}

describe('Sífilis: tratamiento registrado como indicación con fecha', () => {
  it('tratamiento indicado y VDRL de control posterior no reactivo: se cierra', () => {
    expect(evaluarCon([trep('2026-07-20'), vdrl(false, '2026-09-01')], { estado: 'indicado', fechaInicio: '2026-08-01' })).toBeNull();
  });

  it('un VDRL no reactivo del mismo día del tratamiento no es control posterior', () => {
    const r = evaluarCon([trep('2026-07-20'), vdrl(false, '2026-08-01')], { estado: 'indicado', fechaInicio: '2026-08-01' });
    expect(r).toMatchObject({ severidad: 1 });
    expect(r!.porque.join(' ')).toContain('Tratamiento registrado (2026-08-01): falta un VDRL/RPR de control posterior');
  });

  it('"ya tratada" también cuenta como tratamiento', () => {
    expect(evaluarCon([trep('2026-07-20'), vdrl(false, '2026-09-01')], { estado: 'ya_lo_toma', fechaInicio: '2026-08-01' })).toBeNull();
  });

  it('un tratamiento anterior al último VDRL reactivo (reinfección) no cuenta', () => {
    const r = evaluarCon([vdrl(true, '2026-07-01'), vdrl(false, '2026-08-01'), vdrl(true, '2026-09-01'), vdrl(false, '2026-10-01')], { estado: 'indicado', fechaInicio: '2026-07-05' });
    expect(r).toMatchObject({ severidad: 2 });
    expect(r!.porque.join(' ')).toContain('posible reinfección o falla del tratamiento');
  });

  it('remitida no cuenta como tratamiento', () => {
    expect(evaluarCon([trep('2026-07-20'), vdrl(false, '2026-09-01')], { estado: 'referida', fechaInicio: '2026-08-01' })).toMatchObject({ severidad: 2 });
  });
});

describe('Sífilis: flujo desde la alerta', () => {
  it('tratar desde la alerta registra la fecha; el control posterior cierra; una reinfección pide tratar otra vez con fecha nueva', async () => {
    let hoy = '2026-08-01';
    const r = repo(nuevaBD());
    const servicio = new ServicioConsultas(r, cat, () => hoy);
    const motor = new MotorAlertas(r, REGLAS, cat, () => hoy);
    const { embarazo } = await servicio.registrarOAbrir({ documentoTipo: 'CC', documentoNumero: '7', nombres: 'Sol', apellidos: 'R', fechaNacimiento: valor('1998-04-12') });
    const embarazoId = embarazo!.id;
    const examenVdrl = (fecha: string, reactivo: boolean) =>
      servicio.registrarExamen({ embarazoId, consultaId: 'c', fecha, tipo: 'vdrl', resultado: valor({ reactivo, fta: null, tratamiento: null, tratamientoPareja: true }) });
    const alerta = async () => (await motor.sincronizar(embarazoId)).find((a) => a.regla === 'sifilis');
    const tratamiento = async () => (await r.indicacionesDe(embarazoId)).find((i) => i.tipo === 'tratamientoSifilis');

    await servicio.registrarExamen({ embarazoId, consultaId: 'c', fecha: '2026-08-01', tipo: 'sifilisTreponemica', resultado: valor({ reactiva: true }) });
    expect((await alerta())?.activa).toBe(true);
    await motor.atender(`${embarazoId}:sifilis`, 'Tratamiento indicado');
    expect(await tratamiento()).toMatchObject({ estado: 'indicado', fechaInicio: '2026-08-01' });
    expect((await alerta())?.activa).toBe(false); // atendida, esperando el control

    hoy = '2026-09-10';
    await examenVdrl('2026-09-10', false);
    expect((await alerta())?.vigente).toBe(false); // control posterior no reactivo: se cierra

    hoy = '2026-10-06';
    await examenVdrl('2026-10-06', true); // reinfección
    expect(await alerta()).toMatchObject({ vigente: true, activa: true, severidad: 2 });
    await motor.atender(`${embarazoId}:sifilis`, 'Tratamiento indicado');
    expect((await tratamiento())?.fechaInicio).toBe('2026-10-06');
  });

  it('"Ya tratada" (tratamiento anterior sin fecha) no cuenta para cerrar tras un VDRL reactivo', async () => {
    let hoy = '2026-09-01';
    const r = repo(nuevaBD());
    const servicio = new ServicioConsultas(r, cat, () => hoy);
    const motor = new MotorAlertas(r, REGLAS, cat, () => hoy);
    const { embarazo } = await servicio.registrarOAbrir({ documentoTipo: 'CC', documentoNumero: '8', nombres: 'Luz', apellidos: 'M', fechaNacimiento: valor('1998-04-12') });
    const embarazoId = embarazo!.id;
    await servicio.registrarExamen({ embarazoId, consultaId: 'c', fecha: '2026-09-01', tipo: 'vdrl', resultado: valor({ reactivo: true, fta: null, tratamiento: null, tratamientoPareja: true }) });
    await motor.sincronizar(embarazoId);
    await motor.atender(`${embarazoId}:sifilis`, 'Ya tratada', 'Tratada en el embarazo anterior');
    expect((await r.indicacionesDe(embarazoId)).some((i) => i.tipo === 'tratamientoSifilis')).toBe(false);

    hoy = '2026-10-06';
    await servicio.registrarExamen({ embarazoId, consultaId: 'c', fecha: '2026-10-06', tipo: 'vdrl', resultado: valor({ reactivo: false, fta: null, tratamiento: null, tratamientoPareja: true }) });
    const alerta = (await motor.sincronizar(embarazoId)).find((a) => a.regla === 'sifilis');
    expect(alerta?.vigente).toBe(true);
    expect(alerta?.porque.join(' ')).toContain('Sin tratamiento registrado');
  });

  it('con el tratamiento solo indicado, pide confirmar la aplicación', () => {
    const r = evaluarCon([trep('2026-07-20')], { estado: 'indicado', fechaInicio: '2026-08-01' });
    expect(r!.porque.join(' ')).toContain('Confirmar que se aplicó el tratamiento indicado.');
  });

  it('el tratamiento de sífilis nunca llega al carné', () => {
    const h = historiaDePrueba({ examenes: [trep('2026-07-20')], indicaciones: [{ tipo: 'tratamientoSifilis', estado: 'indicado' }] });
    const texto = JSON.stringify(proyectarCarne(h, { estado: 'activo' } as Carne, HOY, cat)).toLowerCase();
    expect(texto).not.toContain('sifilis');
    expect(texto).not.toContain('sífilis');
  });
});
