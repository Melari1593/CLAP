// Única puerta de escritura y lectura de la historia: revisa permisos (A3),
// deja cada cambio en la bitácora (A3) y lo pone en la cola de sincronización (A4).
import type { BaseDatos, NombreTabla, TablasHistoria } from './bd';
import type { CambioBitacora, Embarazo, Gestante, Indicacion, Meta, Usuario } from './modelo';
import { puedeVerHistoria } from '../privacidad/permisos';
import { encolarSincronizacion } from '../sync/cola';

export class SinPermisoError extends Error {
  constructor(mensaje = 'El usuario no tiene un rol autorizado para ver o editar esta historia.') {
    super(mensaje);
    this.name = 'SinPermisoError';
  }
}

export interface Sesion {
  usuario: Usuario;
  dispositivoId: string;
}

type SinMeta<T> = Omit<T, keyof Meta>;
export type NuevoRegistro<K extends NombreTabla> = SinMeta<TablasHistoria[K]> & { id?: string };

const CLAVES_META: (keyof Meta)[] = [
  'id',
  'institucionId',
  'creadoEn',
  'actualizadoEn',
  'actualizadoPor',
  'dispositivoId',
  'version',
  'versionServidor',
];

function sinMeta(registro: object): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...registro };
  for (const clave of CLAVES_META) delete copia[clave];
  return copia;
}

function esObjetoPlano(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Diferencias hoja por hoja entre dos registros (los arreglos se comparan completos). */
export function diferencias(antes: unknown, despues: unknown, ruta = ''): CambioBitacora[] {
  if (esObjetoPlano(antes) && esObjetoPlano(despues)) {
    const claves = new Set([...Object.keys(antes), ...Object.keys(despues)]);
    return [...claves].flatMap((clave) =>
      diferencias(antes[clave], despues[clave], ruta ? `${ruta}.${clave}` : clave),
    );
  }
  if (JSON.stringify(antes) === JSON.stringify(despues)) return [];
  return [{ ruta, antes, despues }];
}

export class Repositorio {
  constructor(
    private readonly bd: BaseDatos,
    private readonly sesion: Sesion,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  /** Profesional de la sesión (para firmar el cierre de la consulta). */
  get usuario(): Usuario {
    return this.sesion.usuario;
  }

  get usuarioId(): string {
    return this.sesion.usuario.id;
  }

  private exigirAcceso(institucionId: string): void {
    if (!puedeVerHistoria(this.sesion.usuario, institucionId)) throw new SinPermisoError();
  }

  async guardar<K extends NombreTabla>(tabla: K, datos: NuevoRegistro<K>): Promise<TablasHistoria[K]> {
    const { usuario, dispositivoId } = this.sesion;
    this.exigirAcceso(usuario.institucionId);
    const t = this.bd.table<TablasHistoria[K], string>(tabla);

    return this.bd.transaction('rw', [t, this.bd.bitacora, this.bd.cola], async () => {
      const id = datos.id ?? crypto.randomUUID();
      const previo = await t.get(id);
      if (previo) this.exigirAcceso(previo.institucionId);

      const cambios = diferencias(previo ? sinMeta(previo) : {}, sinMeta({ ...datos, id }));
      if (previo && cambios.length === 0) return previo;

      const fecha = this.ahora().toISOString();
      const registro = {
        ...datos,
        id,
        institucionId: previo?.institucionId ?? usuario.institucionId,
        creadoEn: previo?.creadoEn ?? fecha,
        actualizadoEn: fecha,
        actualizadoPor: usuario.id,
        dispositivoId,
        version: (previo?.version ?? 0) + 1,
        versionServidor: previo?.versionServidor ?? 0,
      } as TablasHistoria[K];

      await t.put(registro);
      await this.bd.bitacora.add({
        id: crypto.randomUUID(),
        fechaHora: fecha,
        usuarioId: usuario.id,
        institucionId: registro.institucionId,
        dispositivoId,
        entidad: tabla,
        entidadId: id,
        accion: previo ? 'editar' : 'crear',
        cambios,
      });
      await encolarSincronizacion(this.bd, tabla, id, fecha);
      return registro;
    });
  }

  async leer<K extends NombreTabla>(tabla: K, id: string): Promise<TablasHistoria[K] | undefined> {
    this.exigirAcceso(this.sesion.usuario.institucionId);
    const registro = await this.bd.table<TablasHistoria[K], string>(tabla).get(id);
    if (registro) this.exigirAcceso(registro.institucionId);
    return registro;
  }

  async buscarPorDocumento(tipo: Gestante['documentoTipo'], numero: string): Promise<Gestante | undefined> {
    this.exigirAcceso(this.sesion.usuario.institucionId);
    const gestante = await this.bd.gestantes.get({ documentoClave: `${tipo}:${numero.trim()}` });
    if (gestante) this.exigirAcceso(gestante.institucionId);
    return gestante;
  }

  /** Abre un embarazo nuevo; los anteriores quedan cerrados y se conservan como antecedentes. */
  async abrirEmbarazo(gestanteId: string, inicio: string): Promise<Embarazo> {
    const anteriores = await this.embarazosDe(gestanteId);
    for (const anterior of anteriores.filter((e) => e.estado === 'activo')) {
      await this.guardar('embarazos', { ...anterior, estado: 'cerrado' });
    }
    return this.guardar('embarazos', { gestanteId, estado: 'activo', inicio });
  }

  /** Gestantes de la institución del usuario guardadas en este dispositivo. */
  async gestantes(): Promise<Gestante[]> {
    const { institucionId } = this.sesion.usuario;
    this.exigirAcceso(institucionId);
    return this.bd.gestantes.filter((g) => g.institucionId === institucionId).toArray();
  }

  async indicacionesDe(embarazoId: string): Promise<Indicacion[]> {
    const embarazo = await this.leer('embarazos', embarazoId);
    if (!embarazo) return [];
    return this.bd.indicaciones.where({ embarazoId }).toArray();
  }

  async embarazosDe(gestanteId: string): Promise<Embarazo[]> {
    this.exigirAcceso(this.sesion.usuario.institucionId);
    const embarazos = await this.bd.embarazos.where({ gestanteId }).toArray();
    embarazos.forEach((e) => this.exigirAcceso(e.institucionId));
    return embarazos;
  }

  /** Todo lo registrado en un embarazo, para el resumen y el carné. */
  async historia(embarazoId: string) {
    const embarazo = await this.leer('embarazos', embarazoId);
    if (!embarazo) return undefined;
    const porEmbarazo = { embarazoId };
    const [gestante, consultas, examenes, indicaciones, alertas, factores, derechos, carnes, consentimientos] = await Promise.all([
      this.leer('gestantes', embarazo.gestanteId),
      this.bd.consultas.where(porEmbarazo).sortBy('fecha'),
      this.bd.examenes.where(porEmbarazo).sortBy('fecha').then((l) => l.filter((e) => !e.anulado)),
      this.bd.indicaciones.where(porEmbarazo).toArray(),
      this.bd.alertas.where(porEmbarazo).toArray(),
      this.bd.factores.where(porEmbarazo).sortBy('inicio'),
      this.bd.derechos.where(porEmbarazo).sortBy('fechaHora'),
      this.bd.carnes.where(porEmbarazo).toArray(),
      this.bd.consentimientos.where(porEmbarazo).sortBy('fechaHora'),
    ]);
    if (!gestante) return undefined;
    return { gestante, embarazo, consultas, examenes, indicaciones, alertas, factores, derechos, consentimientos, carne: carnes[0] };
  }

  async bitacoraDe(entidadId: string) {
    this.exigirAcceso(this.sesion.usuario.institucionId);
    return this.bd.bitacora.where({ entidadId }).sortBy('fechaHora');
  }
}

export type Historia = NonNullable<Awaited<ReturnType<Repositorio['historia']>>>;
