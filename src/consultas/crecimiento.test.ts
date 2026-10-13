import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import type { Consulta } from '../datos/modelo';
import { construirContexto } from '../alertas/motor';
import { crecimientoFetal, crecimientoRevisarOrden } from '../alertas/crecimientoHistoria';
import { proyectarCarne } from '../privacidad/carne';
import type { Carne } from '../datos/modelo';
import { primeraConsultaCompleta, seguimiento } from '../pruebas/fixtures';
import { gestanteConEmbarazo, nuevaBD, repo } from '../pruebas/util';
import { ServicioConsultas, type ResultadoGuardado } from './servicio';

// FUM 2026-06-01: semana 24 = 2026-11-16, 26 = 11-30, 28 = 12-14, 30 = 12-28, 32 = 2027-01-11.
const CONTROLES: [string, number][] = [
  ['2026-11-16', 21.6],
  ['2026-11-30', 22.6],
  ['2026-12-14', 23.4],
  ['2026-12-28', 24.1],
];

const registro = (r: ResultadoGuardado<Consulta>) => {
  if (r.estado !== 'guardado') throw new Error(r.advertencias.map((a) => a.mensaje).join(' '));
  return r.registro;
};

async function preparar() {
  const cat = new Catalogo();
  const r = repo(nuevaBD());
  let hoy = '2026-10-06';
  const s = new ServicioConsultas(r, cat, () => hoy);
  const { embarazo } = await gestanteConEmbarazo(r);
  registro(await s.guardarPrimeraConsulta(embarazo.id, primeraConsultaCompleta(), { confirmado: true }));
  const control = async (fecha: string, cm: number, opciones: Parameters<ServicioConsultas['guardarSeguimiento']>[2] = {}) => {
    hoy = fecha;
    const d = seguimiento(64);
    d.alturaUterinaCm = valor(cm);
    return s.guardarSeguimiento(embarazo.id, d, { confirmado: true, ...opciones });
  };
  const ctx = async () => construirContexto((await r.historia(embarazo.id))!, hoy, cat);
  return { r, s, cat, embarazoId: embarazo.id, control, ctx, irA: (f: string) => (hoy = f) };
}

describe('Crecimiento fetal en los controles: orden de ecografía', () => {
  it('genera la orden de ecografía con el motivo cuando el crecimiento viene en descenso, y no la duplica', async () => {
    const { s, control, ctx } = await preparar();
    const consultas: Consulta[] = [];
    for (const [f, cm] of CONTROLES) consultas.push(registro(await control(f, cm)));
    const ultima = consultas.at(-1)!;
    const orden = ultima.ordenes!.paraclinicos.find((o) => o.automatica)!;
    expect(orden.examen).toBe('ecografia');
    expect(orden.justificacion).toBe('Descenso del crecimiento por altura uterina desde la semana 24.');
    expect(ultima.crecimiento).toMatchObject({ clase: 'descenso', reglaClasica: false, ordenGenerada: true });
    // Los controles anteriores guardan su propia clasificación.
    expect(consultas[0]!.crecimiento?.clase).toBe('insuficientes');

    // Guardar otra vez (incluso con una lista de órdenes sin la automática) no la duplica ni la pierde.
    const otra = registro(await s.guardarSeguimiento(ultima.embarazoId, ultima.seguimiento!, { consultaId: ultima.id, confirmado: true, ordenes: { medicamentos: [], paraclinicos: [] } }));
    expect(otra.ordenes!.paraclinicos.filter((o) => o.automatica)).toHaveLength(1);

    const alerta = crecimientoFetal.evaluar(await ctx())!;
    expect(alerta.titulo).toBe('Crecimiento fetal en descenso por altura uterina');
    expect(alerta.porque.join(' ')).toContain('Se generó la orden de ecografía de crecimiento en el control del 2026-12-28');
  });

  it('la anulación pide motivo, queda en la bitácora y no se vuelve a generar en ese control', async () => {
    const { r, s, control } = await preparar();
    let ultima!: Consulta;
    for (const [f, cm] of CONTROLES) ultima = registro(await control(f, cm));
    const orden = ultima.ordenes!.paraclinicos.find((o) => o.automatica)!;
    await expect(s.anularOrden(ultima.id, orden.id, ' ')).rejects.toThrow('motivo');
    await s.anularOrden(ultima.id, orden.id, 'Ecografía de crecimiento hecha ayer en otra institución');
    const otra = registro(await s.guardarSeguimiento(ultima.embarazoId, ultima.seguimiento!, { consultaId: ultima.id, confirmado: true }));
    expect(otra.ordenes!.paraclinicos).toHaveLength(1);
    expect(otra.ordenes!.paraclinicos[0]!.anulada?.motivo).toBe('Ecografía de crecimiento hecha ayer en otra institución');
    expect((await r.bitacoraDe(ultima.id)).length).toBeGreaterThanOrEqual(3);
  });

  it('con una orden pendiente o una ecografía reciente no genera otra', async () => {
    const { s, control, embarazoId, irA } = await preparar();
    for (const [f, cm] of CONTROLES) await control(f, cm);
    // Control siguiente: la orden anterior sigue pendiente.
    const siguiente = registro(await control('2027-01-04', 24.5));
    expect(siguiente.ordenes?.paraclinicos.some((o) => o.automatica) ?? false).toBe(false);
    // Llega la ecografía (sin percentiles bajos): la orden deja de estar pendiente y no hay otra en 14 días.
    irA('2027-01-05');
    await s.registrarExamen({ embarazoId, consultaId: null, fecha: '2027-01-05', tipo: 'ecografia', resultado: valor({ momento: 'tercer_trimestre' as const, hallazgos: 'normal' as const, pfePercentil: 30, caPercentil: 35 }) });
    const otro = registro(await control('2027-01-11', 24.8));
    expect(otro.ordenes?.paraclinicos.some((o) => o.automatica) ?? false).toBe(false);
  });

  it('pide confirmar una altura uterina muy distinta de la esperada', async () => {
    const { control } = await preparar();
    await control('2026-11-16', 21.6);
    const r = await control('2026-11-30', 29, { confirmado: false });
    expect(r.estado).toBe('requiere_confirmacion');
    if (r.estado === 'requiere_confirmacion') expect(r.advertencias.map((a) => a.mensaje)).toContain('¿Confirma 29 cm de altura uterina? En el control anterior (2026-11-16) midió 21,6 cm.');
    expect((await control('2026-11-30', 23, { confirmado: false })).estado).toBe('guardado');
  });

  it('si corregir una medición cambia la clasificación de un control con orden, avisa y no la anula sola', async () => {
    const { s, control, ctx } = await preparar();
    let ultima!: Consulta;
    for (const [f, cm] of CONTROLES) ultima = registro(await control(f, cm));
    // Corrige la última medición: era 26,8 cm (en su carril).
    const d = structuredClone(ultima.seguimiento!);
    d.alturaUterinaCm = valor(26.8);
    const corregida = registro(await s.guardarSeguimiento(ultima.embarazoId, d, { consultaId: ultima.id, confirmado: true }));
    expect(corregida.crecimiento?.clase).not.toBe('descenso');
    expect(corregida.ordenes!.paraclinicos.find((o) => o.automatica)?.anulada).toBeUndefined();
    const aviso = crecimientoRevisarOrden.evaluar(await ctx())!;
    expect(aviso.titulo).toContain('Revise la orden de ecografía');
    expect(aviso.porque.join(' ')).toContain('Control del 2026-12-28');
  });

  it('el carné muestra qué hacer y por qué mientras la orden está pendiente, sin percentiles ni "restricción"', async () => {
    const { r, s, cat, control, embarazoId, irA } = await preparar();
    for (const [f, cm] of CONTROLES) await control(f, cm);
    const carne = { estado: 'activo' } as Carne;
    const avisos = async (hoy: string) => {
      const d = proyectarCarne((await r.historia(embarazoId))!, carne, hoy, cat);
      return d.estado === 'activo' ? d.avisos : [];
    };
    const [aviso] = await avisos('2026-12-28');
    expect(aviso).toBe('Necesitas una ecografía antes de tu próximo control. En las últimas mediciones tu bebé creció menos de lo esperado y queremos verlo mejor. Lleva la orden que te entregaron.');
    expect(aviso).not.toMatch(/percentil|restricci|%/i);
    irA('2027-01-05');
    await s.registrarExamen({ embarazoId, consultaId: null, fecha: '2027-01-05', tipo: 'ecografia', resultado: valor({ momento: 'tercer_trimestre' as const, hallazgos: 'normal' as const }) });
    expect(await avisos('2027-01-05')).toEqual([]);
  });
});
