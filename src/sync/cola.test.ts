import { describe, expect, it } from 'vitest';
import { encolarEnvioCarne, procesarCola, resumenCola, type Transporte } from './cola';
import { gestanteConEmbarazo, nuevaBD, repo } from '../pruebas/util';

/** Servidor falso: guarda versiones y puede estar "sin red". */
function servidorFalso() {
  const estado = {
    enLinea: false,
    registros: new Map<string, number>(),
    envios: [] as string[],
    forzarConflicto: false,
  };
  const transporte: Transporte = {
    async sincronizar({ registro, versionBase }) {
      if (!estado.enLinea) throw new Error('Sin red');
      const actual = estado.registros.get(registro.id) ?? 0;
      if (estado.forzarConflicto || actual !== versionBase) return { resultado: 'conflicto', versionServidor: actual };
      estado.registros.set(registro.id, actual + 1);
      return { resultado: 'ok', versionServidor: actual + 1 };
    },
    async enviarCarne({ carneId }) {
      if (!estado.enLinea) throw new Error('Sin red');
      estado.envios.push(carneId);
    },
  };
  return { estado, transporte };
}

async function carneDePrueba(estado: 'activo' | 'pausado' = 'activo') {
  const bd = nuevaBD();
  const r = repo(bd);
  const { gestante, embarazo } = await gestanteConEmbarazo(r);
  const carne = await r.guardar('carnes', {
    embarazoId: embarazo.id,
    token: `tok-${crypto.randomUUID()}`,
    pinHash: 'h',
    pinSal: 's',
    canal: 'whatsapp',
    destino: '3000000000',
    estado,
    intentosFallidos: 0,
  });
  return { bd, r, gestante, carne };
}

describe('Sin conexión y sincronización (A4)', () => {
  it('sin red todo queda pendiente; al reconectar se sincroniza y el carné se envía', async () => {
    const { bd, gestante, carne } = await carneDePrueba();
    await encolarEnvioCarne(bd, carne.id, 'whatsapp', '2026-10-06T15:01:00.000Z');
    const servidor = servidorFalso();

    const sinRed = await procesarCola(bd, servidor.transporte);
    expect(sinRed.sinRed).toBe(true);
    expect((await resumenCola(bd)).pendientes).toBe(4); // gestante, embarazo, carné y envío

    servidor.estado.enLinea = true;
    const conRed = await procesarCola(bd, servidor.transporte);
    expect(conRed).toMatchObject({ enviados: 4, sinRed: false });
    expect((await resumenCola(bd)).pendientes).toBe(0);
    expect(servidor.estado.envios).toEqual([carne.id]);
    expect((await bd.gestantes.get(gestante.id))?.versionServidor).toBe(1);
  });

  it('varias ediciones de un registro sin red generan un solo envío con la última versión', async () => {
    const { bd, r, gestante } = await carneDePrueba();
    await r.guardar('gestantes', { ...gestante, apellidos: 'Uno' });
    const ultima = await r.guardar('gestantes', { ...gestante, apellidos: 'Dos' });
    expect(await bd.cola.where({ estado: 'pendiente' }).filter((i) => i.id.includes(gestante.id)).count()).toBe(1);

    const servidor = servidorFalso();
    servidor.estado.enLinea = true;
    let enviado: unknown;
    const espia: Transporte = {
      ...servidor.transporte,
      sincronizar: async (p) => {
        if (p.registro.id === gestante.id) enviado = p.registro;
        return servidor.transporte.sincronizar(p);
      },
    };
    await procesarCola(bd, espia);
    expect(enviado).toMatchObject({ apellidos: 'Dos', version: ultima.version });
  });

  it('un carné pausado no genera envío', async () => {
    const { bd, carne } = await carneDePrueba('pausado');
    await encolarEnvioCarne(bd, carne.id, 'whatsapp', '2026-10-06T15:01:00.000Z');
    const servidor = servidorFalso();
    servidor.estado.enLinea = true;
    const r = await procesarCola(bd, servidor.transporte);
    expect(r.descartados).toBe(1);
    expect(servidor.estado.envios).toEqual([]);
  });

  it('un conflicto con el servidor no sobrescribe: queda para revisión', async () => {
    const { bd } = await carneDePrueba();
    const servidor = servidorFalso();
    servidor.estado.enLinea = true;
    servidor.estado.forzarConflicto = true;
    const r = await procesarCola(bd, servidor.transporte);
    expect(r.conflictos).toBe(3);
    expect(await resumenCola(bd)).toEqual({ pendientes: 0, conflictos: 3 });
  });
});
