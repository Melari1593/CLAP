import { describe, expect, it, vi } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { camposVacios, noCorresponde, valor } from '../datos/campo';
import { primeraConsultaCompleta, seguimiento } from '../pruebas/fixtures';
import { nuevaBD, repo } from '../pruebas/util';
import {
  BLOQUES_PRIMERA,
  BLOQUES_SEGUIMIENTO,
  aplicarNoCorresponde,
  primeraConsultaVacia,
  seguimientoVacio,
} from './esquema';
import { ServicioConsultas, type NuevaGestante } from './servicio';
import { correoValido, validarPrimeraConsulta, validarSeguimiento } from './validaciones';

const cat = new Catalogo();
const HOY = '2026-10-06';

function rutasHoja(objeto: unknown, prefijo = ''): string[] {
  return camposVacios(JSON.parse(JSON.stringify(objeto, (_k, v) => (v && v.estado ? { estado: 'vacio' } : v))), prefijo);
}

const ANA: NuevaGestante = {
  documentoTipo: 'CC',
  documentoNumero: '1020304050',
  nombres: 'Ana María',
  apellidos: 'Pérez Gómez',
  fechaNacimiento: valor('1998-04-12'),
};

function servicio(bd = nuevaBD()) {
  return new ServicioConsultas(repo(bd), cat, () => HOY);
}

describe('Esquema de formularios (B2, B4)', () => {
  it('el formulario de primera consulta cubre todos los campos del modelo', () => {
    expect(rutasHoja(primeraConsultaVacia()).sort()).toEqual(rutasHoja(primeraConsultaCompleta()).sort());
  });

  it('el formulario de seguimiento cubre todos los campos del modelo', () => {
    expect(rutasHoja(seguimientoVacio()).sort()).toEqual(rutasHoja(seguimiento(60)).sort());
  });

  it('un control en semana 20 marca "no corresponde" la presentación; en semana 30 no', () => {
    const d20 = aplicarNoCorresponde(BLOQUES_SEGUIMIENTO, seguimientoVacio(), { egSemanas: 20 });
    expect(d20.presentacion).toEqual({ estado: 'no_corresponde' });
    const d30 = aplicarNoCorresponde(BLOQUES_SEGUIMIENTO, seguimientoVacio(), { egSemanas: 30 });
    expect(d30.presentacion).toEqual({ estado: 'vacio' });
  });

  it('el deseo de continuar solo aplica si el embarazo no fue planeado', () => {
    const planeado = primeraConsultaVacia();
    planeado.planificacion.embarazoPlaneado = valor(true);
    const d = aplicarNoCorresponde(BLOQUES_PRIMERA, planeado, {});
    expect(d.planificacion.deseaContinuar).toEqual({ estado: 'no_corresponde' });

    const corregido = { ...d, planificacion: { ...d.planificacion, embarazoPlaneado: valor(false) } };
    const d2 = aplicarNoCorresponde(BLOQUES_PRIMERA, corregido, {}, d);
    expect(d2.planificacion.deseaContinuar).toEqual({ estado: 'vacio' });
  });

  it('respeta un "no corresponde" marcado a mano en un campo que sí aplica', () => {
    const d = primeraConsultaVacia();
    d.antecedentesObstetricos.gestas = valor(1);
    d.antecedentesObstetricos.pesoUltimoRNg = noCorresponde(); // la gesta previa fue un aborto
    const ajustado = aplicarNoCorresponde(BLOQUES_PRIMERA, d, {}, d);
    expect(ajustado.antecedentesObstetricos.pesoUltimoRNg).toEqual({ estado: 'no_corresponde' });
  });
});

describe('Valores imposibles (B2)', () => {
  it('pide confirmar PA 300/20, peso 400 kg, FUM futura y más partos que gestas', () => {
    const d = primeraConsultaCompleta();
    d.gestacionActual.pesoAnteriorKg = valor(400);
    d.gestacionActual.fum = valor('2026-12-01');
    d.antecedentesObstetricos.gestas = valor(1);
    d.antecedentesObstetricos.partosVaginales = valor(2);
    const rutas = validarPrimeraConsulta(d, HOY, cat).map((a) => a.ruta);
    expect(rutas).toEqual(['gestacionActual.pesoAnteriorKg', 'gestacionActual.fum', 'antecedentesObstetricos.gestas']);

    const s = seguimiento(60);
    s.paSistolica = valor(300);
    s.paDiastolica = valor(20);
    expect(validarSeguimiento(s, cat).map((a) => a.ruta)).toEqual(['paSistolica', 'paDiastolica']);
  });

  it('los datos de prueba completos no generan advertencias', () => {
    expect(validarPrimeraConsulta(primeraConsultaCompleta(), HOY, cat)).toEqual([]);
    expect(validarSeguimiento(seguimiento(64), cat)).toEqual([]);
  });

  it('pide revisar una altitud de 5000 m o más', () => {
    const d = primeraConsultaCompleta();
    d.identificacion.altitudM = valor(5200);
    expect(validarPrimeraConsulta(d, HOY, cat).map((a) => a.ruta)).toEqual(['identificacion.altitudM']);
  });

  it('valida la forma del correo', () => {
    expect(correoValido('ana@correo.com')).toBe(true);
    expect(correoValido('ana@correo')).toBe(false);
    expect(correoValido('ana correo.com')).toBe(false);
  });
});

describe('Búsqueda e inicio de consulta (B1)', () => {
  it('buscar un documento existente nunca crea un duplicado', async () => {
    const s = servicio();
    const primero = await s.registrarOAbrir(ANA);
    const segundo = await s.registrarOAbrir({ ...ANA, documentoNumero: ' 1020304050 ', nombres: 'Otra' });
    expect(primero.existia).toBe(false);
    expect(segundo.existia).toBe(true);
    expect(segundo.gestante.id).toBe(primero.gestante.id);
    expect(segundo.embarazo?.id).toBe(primero.embarazo?.id);
    expect(await s.buscar('1020304050')).toHaveLength(1);
  });

  it('busca por documento o por nombre sin importar tildes ni mayúsculas', async () => {
    const s = servicio();
    await s.registrarOAbrir(ANA);
    expect(await s.buscar('1.020.304.050')).toHaveLength(1);
    expect(await s.buscar('maria perez')).toHaveLength(1);
    expect(await s.buscar('MARÍA gómez')).toHaveLength(1);
    expect(await s.buscar('lucía')).toHaveLength(0);
  });

  it('una gestante con embarazo previo queda con dos episodios separados', async () => {
    const bd = nuevaBD();
    const s = servicio(bd);
    const { gestante, embarazo } = await s.registrarOAbrir(ANA);
    const nuevo = await s.nuevoEmbarazo(gestante.id);
    const episodios = await repo(bd).embarazosDe(gestante.id);
    expect(episodios).toHaveLength(2);
    expect(nuevo.id).not.toBe(embarazo?.id);
    expect((await s.embarazoActivo(gestante.id))?.id).toBe(nuevo.id);
  });
});

describe('Primera consulta y seguimiento (B2, B4)', () => {
  it('guarda la primera consulta; con valores imposibles pide confirmación y luego guarda', async () => {
    const s = servicio();
    const { embarazo } = await s.registrarOAbrir(ANA);
    const d = primeraConsultaCompleta();
    d.gestacionActual.pesoAnteriorKg = valor(400);

    const intento = await s.guardarPrimeraConsulta(embarazo!.id, d);
    expect(intento.estado).toBe('requiere_confirmacion');
    const guardado = await s.guardarPrimeraConsulta(embarazo!.id, d, { confirmado: true });
    expect(guardado.estado).toBe('guardado');
  });

  it('al cerrar lista los campos vacíos con su etiqueta', async () => {
    const s = servicio();
    const { embarazo } = await s.registrarOAbrir(ANA);
    const r = await s.guardarPrimeraConsulta(embarazo!.id, primeraConsultaCompleta());
    if (r.estado !== 'guardado') throw new Error('no guardó');
    const { consulta, vacios } = await s.cerrarConsulta(r.registro.id);
    expect(consulta.cerrada).toBe(true);
    expect(vacios).toEqual(['Otra condición médica grave']);
  });

  it('calcula la EG del día desde la primera consulta', async () => {
    const bd = nuevaBD();
    const s = servicio(bd);
    const { embarazo } = await s.registrarOAbrir(ANA);
    await s.guardarPrimeraConsulta(embarazo!.id, primeraConsultaCompleta());
    const historia = await repo(bd).historia(embarazo!.id);
    expect(s.egDeHistoria(historia!)).toMatchObject({ estado: 'calculada', texto: '18+1' });
  });

  it('registrar o resolver un factor transitorio dispara el recálculo', async () => {
    const s = servicio();
    const { embarazo } = await s.registrarOAbrir(ANA);
    const recalcular = vi.fn();
    s.alCambiar(recalcular);

    const factor = await s.registrarFactorTransitorio(embarazo!.id, 'hiperemesis', '2026-10-01', true);
    const resuelto = await s.resolverFactorTransitorio(factor.id, '2026-10-05');
    expect(resuelto.resolucion).toBe('2026-10-05');
    expect(recalcular.mock.calls.map((c) => c[0])).toEqual([
      { tipo: 'factor_transitorio', embarazoId: embarazo!.id, factor: 'hiperemesis', resuelto: false },
      { tipo: 'factor_transitorio', embarazoId: embarazo!.id, factor: 'hiperemesis', resuelto: true },
    ]);
  });

  it('registra exámenes e indicaciones (una indicación por tipo) y avisa al motor', async () => {
    const bd = nuevaBD();
    const s = servicio(bd);
    const { embarazo } = await s.registrarOAbrir(ANA);
    const recalcular = vi.fn();
    s.alCambiar(recalcular);

    await s.registrarExamen({
      embarazoId: embarazo!.id,
      consultaId: 'c1',
      fecha: HOY,
      tipo: 'hb',
      resultado: valor({ gdl: 11.8, muestra: 'venosa' as const }),
    });
    await s.marcarIndicacion(embarazo!.id, 'calcio', { estado: 'indicado' });
    await s.marcarIndicacion(embarazo!.id, 'calcio', { estado: 'no_indicado', motivo: 'Hipercalcemia' });

    const indicaciones = await repo(bd).indicacionesDe(embarazo!.id);
    expect(indicaciones).toHaveLength(1);
    expect(indicaciones[0]).toMatchObject({ tipo: 'calcio', estado: 'no_indicado', motivo: 'Hipercalcemia', fechaInicio: HOY });
    expect(recalcular).toHaveBeenCalledTimes(3);
  });

  it('el seguimiento en semana 20 se guarda con la presentación en "no corresponde"', async () => {
    const s = servicio();
    const { embarazo } = await s.registrarOAbrir(ANA);
    const d = seguimiento(64);
    d.presentacion = { estado: 'vacio' };
    const r = await s.guardarSeguimiento(embarazo!.id, d, { egSemanas: 20 });
    expect(r.estado === 'guardado' && r.registro.seguimiento?.presentacion).toEqual({ estado: 'no_corresponde' });
  });
});
