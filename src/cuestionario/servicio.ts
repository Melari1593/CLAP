// Guarda las respuestas de la gestante y las pasa a la primera consulta: solo llena los campos que
// están vacíos (nunca reemplaza lo que el profesional ya registró) y deja la lista para confirmar.
import type { Catalogo } from '../clinico/catalogo';
import type { Campo } from '../datos/campo';
import type { Cuestionario, DatosPrimeraConsulta } from '../datos/modelo';
import type { Repositorio } from '../datos/repositorio';
import { BLOQUES_PRIMERA, aplicarNoCorresponde, etiquetaDe } from '../consultas/esquema';
import { asignar, obtener } from '../consultas/rutas';
import { CUESTIONARIO, PREFIERO_HABLARLO, preguntasVisibles, valorParaHistoria, type Respuestas } from './preguntas';

export interface ResultadoAplicar {
  datos: DatosPrimeraConsulta;
  /** Etiquetas de los campos que se llenaron con sus respuestas. */
  llenados: string[];
  /** Campos que ya tenían dato y no se cambiaron. */
  conservados: string[];
  /** Temas que prefiere hablar con el profesional. */
  paraHablar: string[];
}

const CON_CONDICION = new Set(BLOQUES_PRIMERA.flatMap((b) => b.campos.filter((c) => c.aplica).map((c) => c.ruta)));

export function aplicarRespuestas(datos: DatosPrimeraConsulta, respuestas: Respuestas, catalogo: Catalogo): ResultadoAplicar {
  let nuevo = datos;
  const llenados: string[] = [];
  const conservados: string[] = [];
  const paraHablar: string[] = [];
  for (const seccion of CUESTIONARIO) {
    for (const p of preguntasVisibles(seccion, respuestas)) {
      const r = respuestas[p.id];
      if (r === PREFIERO_HABLARLO) paraHablar.push(p.texto);
      const valor = valorParaHistoria(p, r, catalogo);
      if (valor === undefined) continue;
      for (const ruta of p.rutas ?? []) {
        const actual = obtener(nuevo, ruta) as Campo<unknown> | undefined;
        // "No corresponde" puesto solo por otra respuesta (por ejemplo, "¿A qué es alérgica?") se puede llenar.
        const automatico = actual?.estado === 'no_corresponde' && CON_CONDICION.has(ruta);
        if (actual && actual.estado !== 'vacio' && !automatico) {
          conservados.push(etiquetaDe(BLOQUES_PRIMERA, ruta));
          continue;
        }
        nuevo = asignar(nuevo, ruta, { estado: 'valor', valor });
        llenados.push(etiquetaDe(BLOQUES_PRIMERA, ruta));
      }
    }
  }
  return { datos: aplicarNoCorresponde(BLOQUES_PRIMERA, nuevo, {}, datos), llenados, conservados, paraHablar };
}

export class ServicioCuestionarios {
  constructor(
    private readonly repo: Repositorio,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  guardar(embarazoId: string, respuestas: Respuestas, idioma: Cuestionario['idioma']): Promise<Cuestionario> {
    return this.repo.guardar('cuestionarios', { embarazoId, fechaHora: this.ahora().toISOString(), idioma, respuestas });
  }

  async marcarAplicado(id: string): Promise<Cuestionario | undefined> {
    const c = await this.repo.leer('cuestionarios', id);
    if (!c) return undefined;
    return this.repo.guardar('cuestionarios', { ...c, aplicadoEn: this.ahora().toISOString() });
  }
}
