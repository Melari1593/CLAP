// Guarda las respuestas de la gestante y las pasa a la consulta (primera o de seguimiento): solo llena los campos que
// están vacíos (nunca reemplaza lo que el profesional ya registró) y deja la lista para confirmar.
import type { Catalogo } from '../clinico/catalogo';
import type { Campo } from '../datos/campo';
import type { Cuestionario, DatosPrimeraConsulta, DatosSeguimiento, Indicacion } from '../datos/modelo';
import type { Repositorio } from '../datos/repositorio';
import { BLOQUES_PRIMERA, BLOQUES_SEGUIMIENTO, aplicarNoCorresponde, etiquetaDe, type Bloque } from '../consultas/esquema';
import { asignar, obtener } from '../consultas/rutas';
import {
  PREFIERO_HABLARLO,
  cuestionarioDe,
  preguntasVisibles,
  textoRespuesta,
  valorParaHistoria,
  type ContextoCuestionario,
  type Respuestas,
  type TipoCuestionario,
} from './preguntas';

/** Contexto para el cuestionario: los medicamentos que la gestante tiene indicados o ya toma. */
export const contextoCuestionario = (indicaciones: Indicacion[]): ContextoCuestionario => ({
  indicaciones: [...new Set(indicaciones.filter((i) => i.estado === 'indicado' || i.estado === 'ya_lo_toma').map((i) => i.tipo))],
});

/** Para qué consulta es el cuestionario (los guardados antes del de seguimiento son de la primera). */
export const tipoDeCuestionario = (c: Cuestionario): TipoCuestionario => c.tipo ?? 'primera';

export interface ResultadoAplicar<D> {
  datos: D;
  /** Etiquetas de los campos que se llenaron con sus respuestas. */
  llenados: string[];
  /** Campos que ya tenían dato y no se cambiaron. */
  conservados: string[];
  /** Temas que prefiere hablar con el profesional. */
  paraHablar: string[];
  /** Signos de alarma y respuestas que el profesional debe revisar primero. */
  alarmas: string[];
  /** Respuestas que no llenan ningún campo, para leerlas en la consulta. */
  otras: { pregunta: string; respuesta: string }[];
}

type Datos = DatosPrimeraConsulta | DatosSeguimiento;

const conCondicion = (bloques: Bloque<never>[]) => new Set(bloques.flatMap((b) => b.campos.filter((c) => c.aplica).map((c) => c.ruta)));
const CON_CONDICION = { primera: conCondicion(BLOQUES_PRIMERA as Bloque<never>[]), seguimiento: conCondicion(BLOQUES_SEGUIMIENTO as Bloque<never>[]) };

export function aplicarRespuestas(datos: DatosPrimeraConsulta, respuestas: Respuestas, catalogo: Catalogo): ResultadoAplicar<DatosPrimeraConsulta>;
export function aplicarRespuestas(
  datos: DatosSeguimiento,
  respuestas: Respuestas,
  catalogo: Catalogo,
  tipo: 'seguimiento',
  ctx?: ContextoCuestionario,
): ResultadoAplicar<DatosSeguimiento>;
export function aplicarRespuestas(
  datos: Datos,
  respuestas: Respuestas,
  catalogo: Catalogo,
  tipo: TipoCuestionario = 'primera',
  ctx?: ContextoCuestionario,
): ResultadoAplicar<Datos> {
  const bloques = (tipo === 'seguimiento' ? BLOQUES_SEGUIMIENTO : BLOQUES_PRIMERA) as Bloque<Datos>[];
  const llenados: string[] = [];
  const conservados: string[] = [];
  const paraHablar: string[] = [];
  const alarmas: string[] = [];
  const otras: ResultadoAplicar<Datos>['otras'] = [];
  // Primero se reúne lo que va a cada campo: si varias respuestas son texto del mismo campo, se juntan.
  const porRuta = new Map<string, unknown>();
  for (const seccion of cuestionarioDe(tipo)) {
    for (const p of preguntasVisibles(seccion, respuestas, ctx)) {
      const r = respuestas[p.id];
      if (r === PREFIERO_HABLARLO) paraHablar.push(p.texto);
      const valor = valorParaHistoria(p, r, catalogo);
      if (valor === undefined) continue;
      if (p.alerta) alarmas.push(...p.alerta(r));
      if (p.resumen) otras.push({ pregunta: p.texto, respuesta: textoRespuesta(p, r) });
      for (const ruta of p.rutas ?? []) {
        const previo = porRuta.get(ruta);
        porRuta.set(ruta, typeof previo === 'string' && typeof valor === 'string' ? `${previo} ${valor}` : valor);
      }
    }
  }
  let nuevo = datos;
  for (const [ruta, valor] of porRuta) {
    const actual = obtener(nuevo, ruta) as Campo<unknown> | undefined;
    // "No corresponde" puesto solo por otra respuesta (por ejemplo, "¿A qué es alérgica?") se puede llenar.
    const automatico = actual?.estado === 'no_corresponde' && CON_CONDICION[tipo].has(ruta);
    if (actual && actual.estado !== 'vacio' && !automatico) {
      conservados.push(etiquetaDe(bloques, ruta));
      continue;
    }
    nuevo = asignar(nuevo, ruta, { estado: 'valor', valor });
    llenados.push(etiquetaDe(bloques, ruta));
  }
  return { datos: aplicarNoCorresponde(bloques, nuevo, {}, datos), llenados, conservados, paraHablar, alarmas, otras };
}

export class ServicioCuestionarios {
  constructor(
    private readonly repo: Repositorio,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  guardar(embarazoId: string, respuestas: Respuestas, idioma: Cuestionario['idioma'], tipo: TipoCuestionario = 'primera'): Promise<Cuestionario> {
    return this.repo.guardar('cuestionarios', { embarazoId, fechaHora: this.ahora().toISOString(), idioma, respuestas, tipo });
  }

  async marcarAplicado(id: string): Promise<Cuestionario | undefined> {
    const c = await this.repo.leer('cuestionarios', id);
    if (!c) return undefined;
    return this.repo.guardar('cuestionarios', { ...c, aplicadoEn: this.ahora().toISOString() });
  }
}
