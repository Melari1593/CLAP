import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import { ServicioConsultas } from '../consultas/servicio';
import { primeraConsultaCompleta } from '../pruebas/fixtures';
import { nuevaBD, repo } from '../pruebas/util';
import { MotorAlertas, ordenarAlertas } from './motor';
import { REGLAS } from './reglas';

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
