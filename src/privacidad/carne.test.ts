import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { MENSAJE_CARNE_PAUSADO, proyectarCarne } from './carne';
import { DATOS_NUNCA_EN_CARNE, nivelDe } from './niveles';
import type { Carne } from '../datos/modelo';
import type { Repositorio } from '../datos/repositorio';
import { primeraConsultaCompleta, SECRETO, seguimiento } from '../pruebas/fixtures';
import { gestanteConEmbarazo, nuevaBD, repo } from '../pruebas/util';

async function historiaSensible(r: Repositorio) {
  const { embarazo } = await gestanteConEmbarazo(r);
  await r.guardar('consultas', {
    embarazoId: embarazo.id,
    tipo: 'primera',
    fecha: '2026-07-20',
    profesionalId: 'prof-1',
    proximaCita: { estado: 'valor', valor: { fecha: '2026-08-20', lugar: 'IPS 1', queLlevar: 'Exámenes' } },
    cerrada: true,
    primera: primeraConsultaCompleta(), // drogas, alcohol y violencia: SÍ; no ha decidido si continuar
  });
  await r.guardar('consultas', {
    embarazoId: embarazo.id,
    tipo: 'seguimiento',
    fecha: '2026-08-20',
    profesionalId: 'prof-1',
    proximaCita: { estado: 'valor', valor: { fecha: '2026-09-20', lugar: 'IPS 1', queLlevar: 'Carné' } },
    cerrada: true,
    seguimiento: seguimiento(64), // con nota interna
  });
  await r.guardar('examenes', {
    embarazoId: embarazo.id,
    consultaId: 'c1',
    fecha: '2026-07-20',
    tipo: 'vih',
    resultado: { estado: 'valor', valor: { solicitado: true, realizado: true, resultado: 'positivo', codigo: SECRETO.codigoVih } },
  });
  await r.guardar('derechos', {
    embarazoId: embarazo.id,
    fechaHora: '2026-07-20T10:00:00.000Z',
    desencadenante: 'no_planeado',
    egDias: 50,
    momentoASolas: true,
    decision: 'solicita_ive',
    solicitudIVE: { fechaHora: '2026-07-20T10:05:00.000Z', prestador: 'Prestador X', manual: true },
    notas: SECRETO.notaDerechos,
  });
  await r.guardar('indicaciones', { embarazoId: embarazo.id, tipo: 'hierro', estado: 'indicado' });
  await r.guardar('indicaciones', { embarazoId: embarazo.id, tipo: 'asa', estado: 'no_indicado', motivo: 'Sin criterio' });
  const carne = await r.guardar('carnes', {
    embarazoId: embarazo.id,
    token: 'tok-1',
    pinHash: 'h',
    pinSal: 's',
    canal: 'whatsapp',
    destino: '3000000000',
    estado: 'activo',
    intentosFallidos: 0,
  });
  return { historia: (await r.historia(embarazo.id))!, carne };
}

const PALABRAS_PROHIBIDAS = [
  'vih',
  'violencia',
  'drogas',
  'alcohol',
  'observaciones',
  'deseaContinuar',
  'derechos',
  'solicitudIVE',
  'causal',
  'rutaViolencia',
  'bitacora',
  'positivo',
  'solicita_ive',
  'no_ha_decidido',
  'Prestador X',
];

describe('Carné: lectura restringida (A3)', () => {
  it('ningún dato "nunca en carné" llega al carné, ni como clave ni como valor', async () => {
    const { historia, carne } = await historiaSensible(repo(nuevaBD()));
    const datos = proyectarCarne(historia, carne, '2026-10-06', new Catalogo());
    const texto = JSON.stringify(datos);

    for (const secreto of Object.values(SECRETO)) expect(texto).not.toContain(secreto);
    for (const palabra of PALABRAS_PROHIBIDAS) expect(texto.toLowerCase()).not.toContain(palabra.toLowerCase());

    // Sí muestra lo que la gestante necesita.
    expect(datos).toMatchObject({
      estado: 'activo',
      nombre: 'Ana',
      fpp: '2027-03-08',
      semanas: { semanas: 18, dias: 1 },
      grupo: 'O',
      rh: '+',
      indicaciones: ['hierro'],
      proximaCita: { fecha: '2026-09-20' },
    });
    if (datos.estado === 'activo') expect(datos.citas[1]).toEqual({ fecha: '2026-08-20', pesoKg: 64, presion: '110/70' });
  });

  it('un carné pausado muestra solo el mensaje', async () => {
    const { historia, carne } = await historiaSensible(repo(nuevaBD()));
    expect(proyectarCarne(historia, { ...carne, estado: 'pausado' } as Carne, '2026-10-06', new Catalogo())).toEqual({
      estado: 'pausado',
      mensaje: MENSAJE_CARNE_PAUSADO,
    });
  });

  it('clasifica los datos sensibles como "nunca en carné"', () => {
    expect(nivelDe('examenes.vih.resultado')).toBe('nunca_en_carne');
    expect(nivelDe('derechos.solicitudIVE')).toBe('nunca_en_carne');
    expect(nivelDe('primera.gestacionActual.drogas')).toBe('nunca_en_carne');
    expect(nivelDe('primera.gestacionActual.grupo')).toBe('normal');
    expect(DATOS_NUNCA_EN_CARNE.length).toBeGreaterThan(0);
  });
});
