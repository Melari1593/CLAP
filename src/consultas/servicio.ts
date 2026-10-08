// B1 / B2 / B4 — Búsqueda, inicio de consulta y guardado de consultas, exámenes,
// indicaciones y factores transitorios.
import { Catalogo } from '../clinico/catalogo';
import { edadGestacional, type EdadGestacional } from '../clinico/calculos';
import { camposVacios, valorDe, type Campo } from '../datos/campo';
import type {
  Consulta,
  DatosPrimeraConsulta,
  DatosSeguimiento,
  Embarazo,
  FactorTransitorio,
  FechaISO,
  Gestante,
  Indicacion,
  ResultadoExamen,
  TipoDocumento,
  TipoFactorTransitorio,
  TipoIndicacion,
} from '../datos/modelo';
import type { Historia, NuevoRegistro, Repositorio } from '../datos/repositorio';
import { grupoRh } from '../clinico/grupoRh';
import { BLOQUES_PRIMERA, BLOQUES_SEGUIMIENTO, aplicarNoCorresponde, etiquetaDe } from './esquema';
import { validarPrimeraConsulta, validarSeguimiento, type Advertencia } from './validaciones';
import type { RegistroEventos } from '../eventos/eventos';
import { construirContexto } from '../alertas/motor';
import { evaluarTrombo } from '../alertas/trombo';
import { recordatorios } from '../recordatorios/recordatorios';

// ------------------------------------------------------------------ Cambios clínicos

/** Qué cambió, para que el motor de reglas (C1) recalcule lo que corresponda. */
export type CambioClinico =
  | { tipo: 'consulta'; embarazoId: string; consultaId: string }
  | { tipo: 'examen'; embarazoId: string; examen: ResultadoExamen['tipo'] }
  | { tipo: 'indicacion'; embarazoId: string; indicacion: TipoIndicacion }
  | { tipo: 'factor_transitorio'; embarazoId: string; factor: TipoFactorTransitorio; resuelto: boolean };

type Oyente = (cambio: CambioClinico) => void | Promise<void>;

// ------------------------------------------------------------------ Búsqueda (B1)

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export interface NuevaGestante {
  documentoTipo: TipoDocumento;
  documentoNumero: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: Campo<FechaISO>;
}

export type ResultadoGuardado<T> =
  | { estado: 'guardado'; registro: T }
  | { estado: 'requiere_confirmacion'; advertencias: Advertencia[] };

export class ServicioConsultas {
  private readonly oyentes = new Set<Oyente>();

  constructor(
    private readonly repo: Repositorio,
    private readonly catalogo: Catalogo = new Catalogo(),
    private readonly hoy: () => FechaISO,
    private readonly eventos?: RegistroEventos,
  ) {}

  alCambiar(oyente: Oyente): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  private async avisar(cambio: CambioClinico) {
    for (const oyente of this.oyentes) await oyente(cambio);
  }

  /** Busca por número de documento (exacto) o por nombre (todas las palabras, sin tildes). */
  async buscar(texto: string): Promise<Gestante[]> {
    const consulta = normalizar(texto);
    if (!consulta) return [];
    const todas = await this.repo.gestantes();
    const soloDigitos = consulta.replace(/[\s.-]/g, '');
    if (/^\d+$/.test(soloDigitos)) return todas.filter((g) => g.documentoNumero.replace(/[\s.-]/g, '') === soloDigitos);
    const palabras = consulta.split(/\s+/);
    return todas.filter((g) => {
      const nombre = normalizar(`${g.nombres} ${g.apellidos}`);
      return palabras.every((p) => nombre.includes(p));
    });
  }

  /**
   * Si el documento ya existe, devuelve ese registro (nunca duplica). Si no, crea la gestante
   * y abre su primer embarazo.
   */
  async registrarOAbrir(datos: NuevaGestante): Promise<{ gestante: Gestante; embarazo?: Embarazo; existia: boolean }> {
    const numero = datos.documentoNumero.trim();
    const existente = await this.repo.buscarPorDocumento(datos.documentoTipo, numero);
    if (existente) {
      return { gestante: existente, embarazo: await this.embarazoActivo(existente.id), existia: true };
    }
    const gestante = await this.repo.guardar('gestantes', {
      ...datos,
      documentoNumero: numero,
      documentoClave: `${datos.documentoTipo}:${numero}`,
      nombres: datos.nombres.trim(),
      apellidos: datos.apellidos.trim(),
    });
    const embarazo = await this.repo.abrirEmbarazo(gestante.id, this.hoy());
    return { gestante, embarazo, existia: false };
  }

  async embarazoActivo(gestanteId: string): Promise<Embarazo | undefined> {
    return (await this.repo.embarazosDe(gestanteId)).find((e) => e.estado === 'activo');
  }

  /** Nuevo embarazo de una gestante que ya tuvo uno: el anterior se conserva como antecedente. */
  nuevoEmbarazo(gestanteId: string): Promise<Embarazo> {
    return this.repo.abrirEmbarazo(gestanteId, this.hoy());
  }

  // ---------------------------------------------------------------- Consultas (B2, B4)

  /** EG del día con los datos de la primera consulta del embarazo. */
  egDeHistoria(historia: Historia, fecha = this.hoy()): EdadGestacional {
    const g = historia.consultas.find((c) => c.tipo === 'primera')?.primera?.gestacionActual;
    return edadGestacional(
      {
        fum: valorDe(g?.fum),
        egConfiablePorFum: valorDe(g?.egConfiablePorFum),
        ecografia: valorDe(g?.ecografia),
        egConfiablePorEco: valorDe(g?.egConfiablePorEco),
      },
      fecha,
      this.catalogo,
    );
  }

  async guardarPrimeraConsulta(
    embarazoId: string,
    datos: DatosPrimeraConsulta,
    opciones: { consultaId?: string; proximaCita?: Consulta['proximaCita']; confirmado?: boolean } = {},
  ): Promise<ResultadoGuardado<Consulta>> {
    const hoy = this.hoy();
    const ajustados = aplicarNoCorresponde(BLOQUES_PRIMERA, datos, {});
    const advertencias = validarPrimeraConsulta(ajustados, hoy, this.catalogo);
    if (advertencias.length > 0 && !opciones.confirmado) return { estado: 'requiere_confirmacion', advertencias };

    const previa = opciones.consultaId ? await this.repo.leer('consultas', opciones.consultaId) : undefined;
    const consulta = await this.repo.guardar('consultas', {
      id: opciones.consultaId,
      embarazoId,
      tipo: 'primera',
      fecha: previa?.fecha ?? hoy,
      profesionalId: this.repo.usuarioId,
      proximaCita: opciones.proximaCita ?? previa?.proximaCita ?? { estado: 'vacio' },
      cerrada: previa?.cerrada ?? false,
      primera: ajustados,
    });
    await this.avisar({ tipo: 'consulta', embarazoId, consultaId: consulta.id });
    return { estado: 'guardado', registro: consulta };
  }

  async guardarSeguimiento(
    embarazoId: string,
    datos: DatosSeguimiento,
    opciones: { consultaId?: string; proximaCita?: Consulta['proximaCita']; confirmado?: boolean; egSemanas?: number } = {},
  ): Promise<ResultadoGuardado<Consulta>> {
    const historia = await this.repo.historia(embarazoId);
    const primera = historia?.consultas.find((c) => c.tipo === 'primera')?.primera;
    const rhNegativo = grupoRh(primera, historia?.examenes ?? []).rh === '-';
    const ajustados = aplicarNoCorresponde(BLOQUES_SEGUIMIENTO, datos, { egSemanas: opciones.egSemanas, rhNegativo });
    const advertencias = validarSeguimiento(ajustados, this.catalogo);
    if (advertencias.length > 0 && !opciones.confirmado) return { estado: 'requiere_confirmacion', advertencias };

    const previa = opciones.consultaId ? await this.repo.leer('consultas', opciones.consultaId) : undefined;
    const consulta = await this.repo.guardar('consultas', {
      id: opciones.consultaId,
      embarazoId,
      tipo: 'seguimiento',
      fecha: previa?.fecha ?? this.hoy(),
      profesionalId: this.repo.usuarioId,
      proximaCita: opciones.proximaCita ?? previa?.proximaCita ?? { estado: 'vacio' },
      cerrada: previa?.cerrada ?? false,
      seguimiento: ajustados,
    });
    await this.avisar({ tipo: 'consulta', embarazoId, consultaId: consulta.id });
    return { estado: 'guardado', registro: consulta };
  }

  /** Lista lo que quedó vacío (con su etiqueta) para que el profesional decida si lo completa. */
  camposVaciosDe(consulta: Consulta): string[] {
    if (consulta.primera) {
      // Solo campos del formulario actual: las consultas guardadas antes pueden traer campos retirados.
      const rutas = new Set(BLOQUES_PRIMERA.flatMap((b) => b.campos.map((c) => c.ruta)));
      return camposVacios(consulta.primera).filter((r) => rutas.has(r)).map((r) => etiquetaDe(BLOQUES_PRIMERA, r));
    }
    const vacios = consulta.seguimiento ? camposVacios(consulta.seguimiento).map((r) => etiquetaDe(BLOQUES_SEGUIMIENTO, r)) : [];
    return consulta.proximaCita.estado === 'vacio' ? [...vacios, 'Próxima cita'] : vacios;
  }

  // ---------------------------------------------------------------- Exámenes, indicaciones y factores (B4)

  async registrarExamen(datos: NuevoRegistro<'examenes'>): Promise<ResultadoExamen> {
    const examen = await this.repo.guardar('examenes', datos);
    await this.avisar({ tipo: 'examen', embarazoId: examen.embarazoId, examen: examen.tipo });
    if (this.eventos && examen.resultado.estado === 'valor') {
      const historia = await this.repo.historia(examen.embarazoId);
      const eg = historia ? this.egDeHistoria(historia, examen.fecha) : undefined;
      await this.eventos.registrar(examen.embarazoId, { tipo: 'examen_registrado', examen: examen.tipo, egDias: eg?.estado === 'calculada' ? eg.dias : null });
    }
    return examen;
  }

  /** Corrige el resultado o la fecha de un examen ya registrado (el cambio queda en la bitácora). */
  async corregirExamen(id: string, cambios: Pick<ResultadoExamen, 'fecha' | 'resultado'>): Promise<ResultadoExamen> {
    const previo = await this.repo.leer('examenes', id);
    if (!previo) throw new Error('Resultado no encontrado.');
    const examen = await this.repo.guardar('examenes', { ...previo, fecha: cambios.fecha, resultado: cambios.resultado } as ResultadoExamen);
    await this.avisar({ tipo: 'examen', embarazoId: examen.embarazoId, examen: examen.tipo });
    return examen;
  }

  /** Anula un resultado registrado por error. No se borra: queda en la historia con el motivo. */
  async anularExamen(id: string, motivo: string): Promise<ResultadoExamen> {
    if (!motivo.trim()) throw new Error('Escriba el motivo de la anulación.');
    const previo = await this.repo.leer('examenes', id);
    if (!previo) throw new Error('Resultado no encontrado.');
    const examen = await this.repo.guardar('examenes', { ...previo, anulado: { fechaHora: new Date().toISOString(), motivo: motivo.trim() } });
    await this.avisar({ tipo: 'examen', embarazoId: examen.embarazoId, examen: examen.tipo });
    return examen;
  }

  /** Una indicación por tipo y embarazo: marcarla de nuevo actualiza la existente. */
  async marcarIndicacion(
    embarazoId: string,
    tipo: TipoIndicacion,
    cambios: Pick<Indicacion, 'estado'> & Partial<Pick<Indicacion, 'motivo' | 'fechaInicio' | 'fechaSuspension' | 'detalle'>>,
  ): Promise<Indicacion> {
    const existente = (await this.repo.indicacionesDe(embarazoId)).find((i) => i.tipo === tipo);
    const indicacion = await this.repo.guardar('indicaciones', {
      ...(existente ?? {}),
      embarazoId,
      tipo,
      ...cambios,
      fechaInicio: cambios.fechaInicio ?? existente?.fechaInicio ?? (cambios.estado === 'indicado' ? this.hoy() : undefined),
    });
    await this.avisar({ tipo: 'indicacion', embarazoId, indicacion: tipo });
    return indicacion;
  }

  async registrarFactorTransitorio(
    embarazoId: string,
    tipo: TipoFactorTransitorio,
    inicio: FechaISO,
    conHospitalizacion: boolean,
  ): Promise<FactorTransitorio> {
    const factor = await this.repo.guardar('factores', { embarazoId, tipo, inicio, conHospitalizacion });
    await this.avisar({ tipo: 'factor_transitorio', embarazoId, factor: tipo, resuelto: false });
    return factor;
  }

  async resolverFactorTransitorio(factorId: string, resolucion: FechaISO): Promise<FactorTransitorio> {
    const factor = await this.repo.leer('factores', factorId);
    if (!factor) throw new Error('Factor transitorio no encontrado');
    const resuelto = await this.repo.guardar('factores', { ...factor, resolucion });
    await this.avisar({ tipo: 'factor_transitorio', embarazoId: factor.embarazoId, factor: factor.tipo, resuelto: true });
    return resuelto;
  }

  /** Cierra la consulta. Devuelve los campos vacíos para mostrarlos antes del carné. */
  /** `duracionSegundos`: desde que se abrió la consulta hasta el cierre (métrica de G2). */
  async cerrarConsulta(consultaId: string, duracionSegundos?: number): Promise<{ consulta: Consulta; vacios: string[] }> {
    const consulta = await this.repo.leer('consultas', consultaId);
    if (!consulta) throw new Error('Consulta no encontrada');
    // Firma del cierre: nombre y registro profesional, fecha y hora (Resolución 1995 de 1999).
    const { nombre, registroProfesional } = this.repo.usuario;
    const cierre = consulta.cierre ?? { profesional: nombre, registroProfesional: registroProfesional ?? null, fechaHora: new Date().toISOString() };
    const cerrada = await this.repo.guardar('consultas', { ...consulta, cerrada: true, cierre });
    if (this.eventos && !consulta.cerrada) {
      const historia = await this.repo.historia(consulta.embarazoId);
      if (historia) {
        const ctx = construirContexto(historia, this.hoy(), this.catalogo);
        await this.eventos.registrar(consulta.embarazoId, {
          tipo: 'consulta_cerrada',
          consultaId,
          consultaTipo: consulta.tipo,
          egDias: ctx.egEn(consulta.fecha) ?? null,
          duracionSegundos,
          examenesPendientes: recordatorios(ctx).flatMap((r) => (r.examen ? [r.examen] : [])),
          puntajeTrombotico: evaluarTrombo(ctx)?.puntaje,
        });
      }
    }
    return { consulta: cerrada, vacios: this.camposVaciosDe(cerrada) };
  }
}
