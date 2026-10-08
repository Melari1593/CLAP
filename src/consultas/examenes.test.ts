import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import { gestanteConEmbarazo, nuevaBD, repo } from '../pruebas/util';
import { ServicioConsultas } from './servicio';

async function preparar() {
  const r = repo(nuevaBD());
  const s = new ServicioConsultas(r, new Catalogo(), () => '2026-10-06');
  const { embarazo } = await gestanteConEmbarazo(r);
  const hb = await s.registrarExamen({ embarazoId: embarazo.id, consultaId: null, fecha: '2026-10-01', tipo: 'hb', resultado: valor({ gdl: 9.5, muestra: 'venosa' as const }) });
  return { r, s, embarazoId: embarazo.id, hb };
}

describe('Corregir y anular resultados de laboratorio', () => {
  it('corrige el valor y la fecha; el cambio queda en la bitácora', async () => {
    const { r, s, embarazoId, hb } = await preparar();
    await s.corregirExamen(hb.id, { fecha: '2026-10-02', resultado: valor({ gdl: 11.5, muestra: 'venosa' as const }) });
    const [e] = (await r.historia(embarazoId))!.examenes;
    expect(e!.fecha).toBe('2026-10-02');
    expect(e!.resultado).toEqual(valor({ gdl: 11.5, muestra: 'venosa' }));
    expect((await r.bitacoraDe(hb.id)).map((b) => b.accion)).toEqual(['crear', 'editar']);
  });

  it('anula con motivo: deja de contar pero no se borra', async () => {
    const { r, s, embarazoId, hb } = await preparar();
    await expect(s.anularExamen(hb.id, ' ')).rejects.toThrow('motivo');
    await s.anularExamen(hb.id, 'Era de otra paciente');
    expect((await r.historia(embarazoId))!.examenes).toHaveLength(0);
    expect((await r.leer('examenes', hb.id))?.anulado?.motivo).toBe('Era de otra paciente');
  });
});
