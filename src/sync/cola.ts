// A4 — Cola de acciones que necesitan red. Todo se guarda primero en el dispositivo;
// lo que requiere internet queda "pendiente de enviar" y sale solo al volver la señal.
//
// Conflictos: cada registro lleva la última versión confirmada por el servidor (versionServidor).
// El servidor rechaza un cambio hecho sobre una versión que ya no es la suya; ese registro queda
// en estado "conflicto" para que un profesional lo revise. Nunca se sobrescribe en silencio,
// porque la HCP tiene valor legal. (La regla definitiva es una decisión pendiente del plan.)
import type { BaseDatos, NombreTabla, TablasHistoria } from '../datos/bd';
import type { CanalEnvio } from '../datos/modelo';

export type EstadoItem = 'pendiente' | 'enviado' | 'conflicto' | 'descartado';

interface ItemBase {
  id: string;
  estado: EstadoItem;
  creadoEn: string;
  intentos: number;
  ultimoError?: string;
}

export type ItemCola =
  | (ItemBase & { tipo: 'sincronizar'; entidad: NombreTabla; entidadId: string })
  | (ItemBase & { tipo: 'enviar_carne'; carneId: string; canal: CanalEnvio });

export type RespuestaSincronizacion =
  | { resultado: 'ok'; versionServidor: number }
  | { resultado: 'conflicto'; versionServidor: number };

/** Comunicación con el servidor. Si no hay red, sus métodos lanzan un error. */
export interface Transporte {
  sincronizar(p: { entidad: NombreTabla; registro: TablasHistoria[NombreTabla]; versionBase: number }): Promise<RespuestaSincronizacion>;
  /** El servidor arma el mensaje con el enlace del carné y lo envía por el canal indicado. */
  enviarCarne(p: { carneId: string; canal: CanalEnvio }): Promise<void>;
}

/** Un registro tiene a lo sumo un ítem de sincronización pendiente: se envía su versión más reciente. */
export async function encolarSincronizacion(bd: BaseDatos, entidad: NombreTabla, entidadId: string, fecha: string) {
  const id = `sync:${entidad}:${entidadId}`;
  const existente = await bd.cola.get(id);
  if (existente?.estado === 'pendiente' || existente?.estado === 'conflicto') return;
  const item: ItemCola = { id, tipo: 'sincronizar', entidad, entidadId, estado: 'pendiente', creadoEn: fecha, intentos: 0 };
  await bd.cola.put(item);
}

export async function encolarEnvioCarne(bd: BaseDatos, carneId: string, canal: CanalEnvio, fecha: string) {
  const item: ItemCola = {
    id: `carne:${carneId}:${fecha}`,
    tipo: 'enviar_carne',
    carneId,
    canal,
    estado: 'pendiente',
    creadoEn: fecha,
    intentos: 0,
  };
  await bd.cola.put(item);
}

export interface ResultadoProceso {
  enviados: number;
  conflictos: number;
  descartados: number;
  /** true si se detuvo por falta de red; lo pendiente queda en la cola. */
  sinRed: boolean;
}

let enCurso: Promise<ResultadoProceso> | null = null;

/** Envía lo pendiente en orden de llegada. Se detiene al primer error de red. */
export function procesarCola(bd: BaseDatos, transporte: Transporte): Promise<ResultadoProceso> {
  enCurso ??= procesar(bd, transporte).finally(() => {
    enCurso = null;
  });
  return enCurso;
}

async function procesar(bd: BaseDatos, transporte: Transporte): Promise<ResultadoProceso> {
  const r: ResultadoProceso = { enviados: 0, conflictos: 0, descartados: 0, sinRed: false };
  const pendientes = await bd.cola.where({ estado: 'pendiente' }).sortBy('creadoEn');

  for (const item of pendientes) {
    try {
      if (item.tipo === 'sincronizar') {
        const tabla = bd.table<TablasHistoria[NombreTabla], string>(item.entidad);
        const registro = await tabla.get(item.entidadId);
        if (!registro) {
          await bd.cola.update(item.id, { estado: 'descartado' });
          r.descartados++;
          continue;
        }
        const respuesta = await transporte.sincronizar({
          entidad: item.entidad,
          registro,
          versionBase: registro.versionServidor,
        });
        if (respuesta.resultado === 'conflicto') {
          await bd.cola.update(item.id, { estado: 'conflicto' });
          r.conflictos++;
          continue;
        }
        await bd.transaction('rw', [tabla, bd.cola], async () => {
          await tabla.update(item.entidadId, { versionServidor: respuesta.versionServidor });
          const actual = await tabla.get(item.entidadId);
          // Si se editó mientras se enviaba, queda pendiente para enviar la versión nueva.
          const sigue = actual !== undefined && actual.version !== registro.version;
          await bd.cola.update(item.id, { estado: sigue ? 'pendiente' : 'enviado' });
        });
        r.enviados++;
      } else {
        const carne = await bd.carnes.get(item.carneId);
        // Un carné pausado (sección 7) nunca genera envío.
        if (!carne || carne.estado === 'pausado') {
          await bd.cola.update(item.id, { estado: 'descartado' });
          r.descartados++;
          continue;
        }
        await transporte.enviarCarne({ carneId: item.carneId, canal: item.canal });
        await bd.cola.update(item.id, { estado: 'enviado' });
        r.enviados++;
      }
    } catch (error) {
      await bd.cola.update(item.id, { intentos: item.intentos + 1, ultimoError: String(error) });
      r.sinRed = true;
      break;
    }
  }
  return r;
}

export async function resumenCola(bd: BaseDatos) {
  const [pendientes, conflictos] = await Promise.all([
    bd.cola.where({ estado: 'pendiente' }).count(),
    bd.cola.where({ estado: 'conflicto' }).count(),
  ]);
  return { pendientes, conflictos };
}

/** Procesa la cola al volver la señal y cada minuto mientras haya red. Devuelve cómo detenerlo. */
export function iniciarSincronizacionAutomatica(
  bd: BaseDatos,
  transporte: Transporte,
  alTerminar?: (r: ResultadoProceso) => void,
): () => void {
  const intentar = () => {
    if (navigator.onLine) void procesarCola(bd, transporte).then(alTerminar);
  };
  window.addEventListener('online', intentar);
  const intervalo = window.setInterval(intentar, 60_000);
  intentar();
  return () => {
    window.removeEventListener('online', intentar);
    window.clearInterval(intervalo);
  };
}

/** Transporte HTTP hacia el servidor de la institución (el servidor se construye en una tarea aparte). */
export function transporteHttp(urlBase: string, token: () => string): Transporte {
  const post = async (ruta: string, cuerpo: unknown) => {
    const respuesta = await fetch(`${urlBase}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(cuerpo),
    });
    if (respuesta.status === 409) return { conflicto: true, cuerpo: await respuesta.json() };
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return { conflicto: false, cuerpo: await respuesta.json() };
  };
  return {
    async sincronizar(p) {
      const { conflicto, cuerpo } = await post('/api/sincronizar', p);
      const versionServidor = (cuerpo as { versionServidor: number }).versionServidor;
      return conflicto ? { resultado: 'conflicto', versionServidor } : { resultado: 'ok', versionServidor };
    },
    async enviarCarne(p) {
      await post('/api/carne/enviar', p);
    },
  };
}
