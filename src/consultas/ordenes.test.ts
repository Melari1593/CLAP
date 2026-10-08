import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import { primeraConsultaCompleta } from '../pruebas/fixtures';
import { gestanteConEmbarazo, nuevaBD, repo } from '../pruebas/util';
import { faltantesMedicamento, medicamentoDesde, nuevaRemision, numeroEnLetras, ordenesIncompletas, ordenesVacias, paraclinicoDe } from './ordenes';
import { ServicioConsultas } from './servicio';

const cat = new Catalogo();

describe('Fórmula médica y órdenes', () => {
  it('escribe la cantidad en letras', () => {
    expect(numeroEnLetras(1)).toBe('uno');
    expect(numeroEnLetras(21)).toBe('veintiuno');
    expect(numeroEnLetras(30)).toBe('treinta');
    expect(numeroEnLetras(45)).toBe('cuarenta y cinco');
    expect(numeroEnLetras(100)).toBe('cien');
    expect(numeroEnLetras(120)).toBe('ciento veinte');
    expect(numeroEnLetras(1000)).toBe('mil');
    expect(numeroEnLetras(21000)).toBe('veintiún mil');
    expect(numeroEnLetras(31000)).toBe('treinta y un mil');
  });

  it('la plantilla llena la línea y faltan duración y cantidad', () => {
    const asa = cat.valor('ordenes.medicamentos').find((p) => p.atc === 'B01AC06')!;
    const m = medicamentoDesde(asa);
    expect(m.presentacion).toBe('Tableta 100 mg');
    expect(faltantesMedicamento(m)).toEqual(['duración', 'cantidad total']);
    expect(faltantesMedicamento({ ...m, duracion: '30 días', cantidad: 30 })).toEqual([]);
  });

  it('la remisión exige servicio y motivo', () => {
    const r = nuevaRemision();
    expect(r.prioridad).toBe('programada');
    expect(ordenesIncompletas({ ...ordenesVacias(), remisiones: [r] })).toEqual(['remisión 1: falta servicio, motivo']);
    expect(ordenesIncompletas({ ...ordenesVacias(), remisiones: [{ ...r, servicio: 'Nutrición', motivo: 'IMC de obesidad' }] })).toEqual([]);
    // Las consultas guardadas antes de las remisiones no las tienen.
    expect(ordenesIncompletas({ medicamentos: [], paraclinicos: [] })).toEqual([]);
  });

  it('el paraclínico lleva su código CUPS', () => {
    expect(paraclinicoDe('bacteriuria', cat)).toMatchObject({ examen: 'bacteriuria', cups: '901235', nombre: 'Urocultivo' });
    expect(paraclinicoDe('chagas', cat).cups).toBeNull();
  });

  it('guarda las órdenes con la consulta; no cierra con la fórmula incompleta; guarda la firma', async () => {
    const r = repo(nuevaBD());
    const s = new ServicioConsultas(r, cat, () => '2026-10-06');
    const { embarazo } = await gestanteConEmbarazo(r);
    const asa = medicamentoDesde(cat.valor('ordenes.medicamentos').find((p) => p.atc === 'B01AC06'));
    const ordenes = { ...ordenesVacias(), medicamentos: [asa], paraclinicos: [paraclinicoDe('hb', cat)] };
    const g = await s.guardarPrimeraConsulta(embarazo.id, primeraConsultaCompleta(), { confirmado: true, ordenes, proximaCita: valor({ fecha: '2026-11-01', lugar: 'IPS', queLlevar: '' }) });
    if (g.estado !== 'guardado') throw new Error('no guardó');
    expect(g.registro.ordenes?.paraclinicos[0]?.cups).toBe('902210');
    await expect(s.cerrarConsulta(g.registro.id, undefined, 'data:image/png;base64,AAA')).rejects.toThrow('duración');

    const completa = { ...ordenes, medicamentos: [{ ...asa, duracion: '30 días', cantidad: 30 }] };
    await s.guardarPrimeraConsulta(embarazo.id, primeraConsultaCompleta(), { consultaId: g.registro.id, confirmado: true, ordenes: completa });
    const { consulta } = await s.cerrarConsulta(g.registro.id, undefined, 'data:image/png;base64,AAA');
    expect(consulta.cierre?.firma).toBe('data:image/png;base64,AAA');
    expect(consulta.cierre?.registroProfesional).toBe(r.usuario.registroProfesional ?? null);
  });
});
