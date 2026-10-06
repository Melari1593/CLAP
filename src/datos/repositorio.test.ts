import { describe, expect, it } from 'vitest';
import { camposVacios } from './campo';
import { SinPermisoError } from './repositorio';
import { ADMINISTRATIVO, OTRA_INSTITUCION, primeraConsultaCompleta, seguimiento } from '../pruebas/fixtures';
import { gestanteConEmbarazo, nuevaBD, repo } from '../pruebas/util';

describe('Modelo de datos (A2)', () => {
  it('guarda y recupera una historia completa con los tres estados', async () => {
    const r = repo(nuevaBD());
    const { embarazo } = await gestanteConEmbarazo(r);
    const primera = primeraConsultaCompleta();
    await r.guardar('consultas', {
      embarazoId: embarazo.id,
      tipo: 'primera',
      fecha: '2026-07-20',
      profesionalId: 'prof-1',
      proximaCita: { estado: 'valor', valor: { fecha: '2026-08-20', lugar: 'IPS 1', queLlevar: 'Exámenes' } },
      cerrada: true,
      primera,
    });
    await r.guardar('consultas', {
      embarazoId: embarazo.id,
      tipo: 'seguimiento',
      fecha: '2026-08-20',
      profesionalId: 'prof-1',
      proximaCita: { estado: 'vacio' },
      cerrada: false,
      seguimiento: seguimiento(64),
    });
    await r.guardar('examenes', {
      embarazoId: embarazo.id,
      consultaId: 'c1',
      fecha: '2026-08-20',
      tipo: 'hb',
      resultado: { estado: 'valor', valor: { gdl: 11.8, muestra: 'venosa' } },
    });

    const historia = await r.historia(embarazo.id);
    expect(historia?.consultas).toHaveLength(2);
    expect(historia?.consultas[0]?.primera).toEqual(primera);
    expect(historia?.consultas[0]?.primera?.gestacionActual.cervixPap).toEqual({ estado: 'no_se_hizo' });
    expect(historia?.consultas[0]?.primera?.gestacionActual.cervixColposcopia).toEqual({ estado: 'no_corresponde' });
    expect(historia?.examenes[0]?.resultado).toEqual({ estado: 'valor', valor: { gdl: 11.8, muestra: 'venosa' } });
    expect(camposVacios(primera)).toEqual(['antecedentesFamiliares.otraCondicionGrave']);
  });

  it('un embarazo nuevo no sobrescribe el anterior', async () => {
    const r = repo(nuevaBD());
    const { gestante, embarazo } = await gestanteConEmbarazo(r);
    const nuevo = await r.abrirEmbarazo(gestante.id, '2028-01-10');
    const embarazos = await r.embarazosDe(gestante.id);
    expect(embarazos).toHaveLength(2);
    expect(embarazos.find((e) => e.id === embarazo.id)?.estado).toBe('cerrado');
    expect(embarazos.find((e) => e.id === nuevo.id)?.estado).toBe('activo');
  });

  it('no permite dos gestantes con el mismo documento', async () => {
    const r = repo(nuevaBD());
    await gestanteConEmbarazo(r);
    await expect(gestanteConEmbarazo(r)).rejects.toThrow();
    expect((await r.buscarPorDocumento('CC', ' 1020304050 '))?.nombres).toBe('Ana María');
  });
});

describe('Permisos y bitácora (A3)', () => {
  it('cada edición queda en la bitácora con usuario, hora y cambio', async () => {
    const bd = nuevaBD();
    const r = repo(bd);
    const { gestante } = await gestanteConEmbarazo(r);
    await repo(bd, undefined, '2026-10-07T09:30:00.000Z').guardar('gestantes', { ...gestante, apellidos: 'Pérez Gómez' });

    const entradas = await r.bitacoraDe(gestante.id);
    expect(entradas.map((e) => e.accion)).toEqual(['crear', 'editar']);
    expect(entradas[1]).toMatchObject({
      usuarioId: 'prof-1',
      fechaHora: '2026-10-07T09:30:00.000Z',
      cambios: [{ ruta: 'apellidos', antes: 'Pérez', despues: 'Pérez Gómez' }],
    });
  });

  it('guardar sin cambios no crea entrada ni sube la versión', async () => {
    const r = repo(nuevaBD());
    const { gestante } = await gestanteConEmbarazo(r);
    const igual = await r.guardar('gestantes', { ...gestante });
    expect(igual.version).toBe(1);
    expect(await r.bitacoraDe(gestante.id)).toHaveLength(1);
  });

  it('un usuario sin rol autorizado no puede ver la historia', async () => {
    const bd = nuevaBD();
    const { embarazo } = await gestanteConEmbarazo(repo(bd));
    await expect(repo(bd, ADMINISTRATIVO).historia(embarazo.id)).rejects.toBeInstanceOf(SinPermisoError);
    await expect(repo(bd, OTRA_INSTITUCION).historia(embarazo.id)).rejects.toBeInstanceOf(SinPermisoError);
    await expect(
      repo(bd, ADMINISTRATIVO).guardar('embarazos', { ...embarazo, estado: 'cerrado' }),
    ).rejects.toBeInstanceOf(SinPermisoError);
  });
});
