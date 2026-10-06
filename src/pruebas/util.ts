import { BaseDatos } from '../datos/bd';
import { Repositorio } from '../datos/repositorio';
import type { Usuario } from '../datos/modelo';
import { PROFESIONAL } from './fixtures';

export function nuevaBD() {
  return new BaseDatos(`prueba-${crypto.randomUUID()}`);
}

export function repo(bd: BaseDatos, usuario: Usuario = PROFESIONAL, fecha = '2026-10-06T15:00:00.000Z') {
  return new Repositorio(bd, { usuario, dispositivoId: 'tableta-1' }, () => new Date(fecha));
}

export async function gestanteConEmbarazo(r: Repositorio) {
  const gestante = await r.guardar('gestantes', {
    documentoTipo: 'CC',
    documentoNumero: '1020304050',
    documentoClave: 'CC:1020304050',
    nombres: 'Ana María',
    apellidos: 'Pérez',
    fechaNacimiento: { estado: 'valor', valor: '1998-04-12' },
  });
  const embarazo = await r.abrirEmbarazo(gestante.id, '2026-06-01');
  return { gestante, embarazo };
}
