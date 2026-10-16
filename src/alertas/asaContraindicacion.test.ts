// ASA o calcio con una contraindicación nueva: la alerta permite suspender (con fecha) y el carné
// no le dice a la gestante que siga tomándolo mientras el profesional no lo haya valorado.
import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import { ServicioConsultas } from '../consultas/servicio';
import type { Alerta, Carne, DatosPrimeraConsulta, Indicacion } from '../datos/modelo';
import { AVISO_REVISAR_MEDICAMENTO } from '../carne/textos';
import { proyectarCarne } from '../privacidad/carne';
import { primeraConsultaCompleta } from '../pruebas/fixtures';
import { historiaDePrueba } from '../pruebas/historia';
import { nuevaBD, repo } from '../pruebas/util';
import { asa } from './asa';
import { calcio } from './calcio';
import { construirContexto, MotorAlertas } from './motor';
import { REGLAS } from './reglas';

const cat = new Catalogo();
const HOY = '2026-10-06';
const CARNE = { estado: 'activo' } as Carne;

const conCriterio = (d: DatosPrimeraConsulta) => {
  d.riesgoPreeclampsia.hipertensionCronica = valor(true);
};
const conAlergia = (d: DatosPrimeraConsulta) => {
  conCriterio(d);
  d.riesgoPreeclampsia.alergiaASAoAINE = valor(true);
};

describe('ASA con contraindicación', () => {
  it('si el ASA ya estaba indicado, la alerta pide valorar y permite suspenderlo', () => {
    const h = historiaDePrueba({ primera: conAlergia, indicaciones: [{ tipo: 'asa', estado: 'indicado' }] });
    const r = asa.evaluar(construirContexto(h, HOY, cat))!;
    expect(r.titulo).toBe('ASA indicado, pero con contraindicación registrada: valorar');
    expect(r.opciones).toContainEqual({ etiqueta: 'Valorado: se suspende', requiereMotivo: true, registraIndicacion: { tipo: 'asa', estado: 'suspendido' } });
    expect(r.opciones).toContainEqual({ etiqueta: 'Valorado: se mantiene', requiereMotivo: true });
  });

  it('si ya lo toma, la alerta de contraindicación aparece aunque aún no llegue la semana de inicio (ASA 12, calcio 14)', () => {
    const TEMPRANO = '2026-08-01'; // semana 8+5
    const h = historiaDePrueba({
      primera: (d) => {
        conAlergia(d);
        d.antecedentesCalcio.hipercalcemia = valor(true);
      },
      indicaciones: [
        { tipo: 'asa', estado: 'ya_lo_toma' },
        { tipo: 'calcio', estado: 'ya_lo_toma' },
      ],
    });
    const ctx = construirContexto(h, TEMPRANO, cat);
    expect(asa.evaluar(ctx)?.titulo).toBe('ASA indicado, pero con contraindicación registrada: valorar');
    expect(calcio.evaluar(ctx)?.titulo).toBe('Calcio indicado, pero con contraindicación registrada: valorar');
  });

  it('si no estaba indicado, "no se indica" lo registra como no indicado', () => {
    const r = asa.evaluar(construirContexto(historiaDePrueba({ primera: conAlergia }), HOY, cat))!;
    expect(r.titulo).toBe('Criterio de ASA presente, pero con contraindicación registrada');
    expect(r.opciones).toContainEqual({ etiqueta: 'Valorado: no se indica', requiereMotivo: true, registraIndicacion: { tipo: 'asa', estado: 'no_indicado' } });
  });

  it('flujo completo: indicado → alergia → se suspende con fecha → el carné ya no muestra la aspirina', async () => {
    const r = repo(nuevaBD());
    const servicio = new ServicioConsultas(r, cat, () => HOY);
    const motor = new MotorAlertas(r, REGLAS, cat, () => HOY);
    const { embarazo } = await servicio.registrarOAbrir({ documentoTipo: 'CC', documentoNumero: '9', nombres: 'Ana', apellidos: 'P', fechaNacimiento: valor('1998-04-12') });
    const embarazoId = embarazo!.id;
    const d = primeraConsultaCompleta();
    conCriterio(d);
    const g = await servicio.guardarPrimeraConsulta(embarazoId, d);
    const consultaId = g.estado === 'guardado' ? g.registro.id : '';
    await motor.sincronizar(embarazoId);
    await motor.atender(`${embarazoId}:asa`, 'Indicado');

    d.riesgoPreeclampsia.alergiaASAoAINE = valor(true);
    await servicio.guardarPrimeraConsulta(embarazoId, d, { consultaId });
    const alerta = (await motor.sincronizar(embarazoId)).find((a) => a.regla === 'asa')!;
    expect(alerta).toMatchObject({ activa: true, titulo: 'ASA indicado, pero con contraindicación registrada: valorar' });

    await motor.atender(alerta.id, 'Valorado: se suspende', 'Alergia a AINE');
    const indicacion = (await r.indicacionesDe(embarazoId)).find((i) => i.tipo === 'asa')!;
    expect(indicacion).toMatchObject({ estado: 'suspendido', fechaSuspension: HOY, motivo: 'Alergia a AINE' });
    // Una sola decisión: suspender no hace reaparecer la alerta pidiendo "no se indica".
    expect((await motor.sincronizar(embarazoId)).find((a) => a.regla === 'asa')?.activa).toBe(false);

    const datos = proyectarCarne((await r.historia(embarazoId))!, CARNE, HOY, cat);
    expect(datos.estado === 'activo' && datos.indicaciones).not.toContain('asa');
  });
});

describe('Carné: medicamento con contraindicación sin valorar', () => {
  const decision = (opcion: string, varianteAtendida?: string) => ({ opcion, fecha: '2026-10-06T10:00:00Z', profesionalId: 'p', severidadAtendida: 1, varianteAtendida });
  const alertaDecidida = (regla: string, opcion: string): Alerta =>
    ({ id: `e1:${regla}`, embarazoId: 'e1', regla, vigente: true, activa: false, variante: 'v', decision: decision(opcion, 'v') }) as Alerta;

  const carneDe = (opciones: Parameters<typeof historiaDePrueba>[0], alertas: Alerta[] = []) => {
    const h = historiaDePrueba(opciones);
    h.alertas = alertas;
    const d = proyectarCarne(h, CARNE, HOY, cat);
    if (d.estado !== 'activo') throw new Error('carné pausado');
    return d;
  };
  const asaIndicado: Pick<Indicacion, 'tipo' | 'estado'>[] = [{ tipo: 'asa', estado: 'indicado' }];

  it('sin contraindicación, el ASA indicado aparece en el carné', () => {
    const d = carneDe({ primera: conCriterio, indicaciones: asaIndicado });
    expect(d.indicaciones).toContain('asa');
    expect(d.avisos).not.toContain(AVISO_REVISAR_MEDICAMENTO.asa);
  });

  it('con contraindicación sin valorar, el ASA no aparece y el carné pide consultar', () => {
    const d = carneDe({ primera: conAlergia, indicaciones: asaIndicado });
    expect(d.indicaciones).not.toContain('asa');
    expect(d.avisos).toContain(AVISO_REVISAR_MEDICAMENTO.asa);
  });

  it('si el profesional decidió mantenerlo, vuelve a aparecer', () => {
    const d = carneDe({ primera: conAlergia, indicaciones: asaIndicado }, [alertaDecidida('asa', 'Valorado: se mantiene')]);
    expect(d.indicaciones).toContain('asa');
    expect(d.avisos).not.toContain(AVISO_REVISAR_MEDICAMENTO.asa);
  });

  it('"se mantiene" sigue valiendo si la alerta reapareció solo porque subió la severidad', () => {
    const reactivada = { id: 'e1:asa', embarazoId: 'e1', regla: 'asa', vigente: true, activa: true, variante: 'v', decisionesAnteriores: [decision('Valorado: se mantiene', 'v')] } as Alerta;
    expect(carneDe({ primera: conAlergia, indicaciones: asaIndicado }, [reactivada]).indicaciones).toContain('asa');
  });

  it('"se mantiene" deja de valer si cambió la contraindicación (otra variante)', () => {
    const otra = { id: 'e1:asa', embarazoId: 'e1', regla: 'asa', vigente: true, activa: true, variante: 'otra', decisionesAnteriores: [decision('Valorado: se mantiene', 'v')] } as Alerta;
    const d = carneDe({ primera: conAlergia, indicaciones: asaIndicado }, [otra]);
    expect(d.indicaciones).not.toContain('asa');
    expect(d.avisos).toContain(AVISO_REVISAR_MEDICAMENTO.asa);
  });

  it('desde la semana 36 no avisa sobre la aspirina (ya terminó)', () => {
    const d = proyectarCarne(historiaDePrueba({ primera: conAlergia, indicaciones: asaIndicado }), CARNE, '2027-02-15', cat);
    expect(d.estado === 'activo' && d.avisos).not.toContain(AVISO_REVISAR_MEDICAMENTO.asa);
  });

  it('lo mismo con el calcio', () => {
    const conHipercalcemia = (d: DatosPrimeraConsulta) => {
      d.antecedentesCalcio.hipercalcemia = valor(true);
    };
    const calcio: Pick<Indicacion, 'tipo' | 'estado'>[] = [{ tipo: 'calcio', estado: 'indicado' }];
    expect(carneDe({ primera: conHipercalcemia, indicaciones: calcio }).indicaciones).not.toContain('calcio');
    expect(carneDe({ primera: conHipercalcemia, indicaciones: calcio }, [alertaDecidida('calcio', 'Valorado: se mantiene')]).indicaciones).toContain('calcio');
  });
});
