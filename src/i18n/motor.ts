// Traducción de los textos de la interfaz. El español es el idioma fuente: cada diccionario va de
// la frase en español a su traducción. Las frases con datos usan marcadores {0}, {1}… que se
// reconocen en el texto ya armado (por ejemplo, "Anemia {0}" con "leve"), y los datos capturados
// también se traducen si son palabras conocidas. Lo que no está en el diccionario (nombres, notas
// escritas por el profesional, descripciones CIE-10) queda como está.

export type Idioma = 'es' | 'en' | 'fr' | 'ar';
export type Diccionario = Record<string, string>;

export const IDIOMAS: { id: Idioma; nombre: string }[] = [
  { id: 'es', nombre: 'Español' },
  { id: 'en', nombre: 'English' },
  { id: 'fr', nombre: 'Français' },
  { id: 'ar', nombre: 'العربية' },
];

export const direccion = (idioma: Idioma): 'rtl' | 'ltr' => (idioma === 'ar' ? 'rtl' : 'ltr');

export const esIdioma = (x: unknown): x is Idioma => x === 'es' || x === 'en' || x === 'fr' || x === 'ar';

interface Plantilla {
  regex: RegExp;
  /** Orden de los marcadores en la fuente ({2} puede ir antes que {0}). */
  marcadores: number[];
  destino: string;
}

const CONECTORES = new Set(['de', 'del', 'y', 'o', 'el', 'la', 'los', 'las', 'a', 'al', 'en', 'con', 'por', 'para', 'un', 'una']);
function esPlantillaDebil(es: string): boolean {
  const palabras = es.replace(/\{\d+\}/g, ' ').match(/\p{L}+/gu) ?? [];
  const utiles = palabras.filter((p) => !CONECTORES.has(p.toLowerCase()));
  return utiles.join('').length < 3;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class Traductor {
  private readonly exactas = new Map<string, string>();
  private readonly plantillas: Plantilla[] = [];
  private readonly cache = new Map<string, string>();

  constructor(diccionario: Diccionario) {
    const conMarcadores: [string, string][] = [];
    for (const [es, tr] of Object.entries(diccionario)) {
      if (!/\{\d+\}/.test(es)) this.exactas.set(es, tr);
      // Una plantilla con muy poco texto fijo ("{0} de {1}") atraparía frases que no son suyas.
      else if (!esPlantillaDebil(es)) conMarcadores.push([es, tr]);
    }
    // Las más específicas primero: más texto fijo, menos comodines.
    conMarcadores.sort((a, b) => b[0].replace(/\{\d+\}/g, '').length - a[0].replace(/\{\d+\}/g, '').length);
    for (const [es, destino] of conMarcadores) {
      const marcadores: number[] = [];
      const patron = es
        .split(/(\{\d+\})/)
        .map((parte) => {
          const m = parte.match(/^\{(\d+)\}$/);
          if (!m) return escapar(parte);
          marcadores.push(Number(m[1]));
          return '(.+?)';
        })
        .join('');
      this.plantillas.push({ regex: new RegExp(`^${patron}$`, 's'), marcadores, destino });
    }
  }

  /** Traduce un texto completo; conserva los espacios del principio y del final. */
  traducir(texto: string): string {
    const m = texto.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    const centro = m[2]!;
    if (!centro || !/\p{L}/u.test(centro)) return texto;
    return m[1] + this.frase(centro, 0) + m[3];
  }

  private frase(t: string, profundidad: number): string {
    const guardada = this.cache.get(t);
    if (guardada !== undefined) return guardada;
    const r = this.calcular(t, profundidad);
    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(t, r);
    return r;
  }

  private calcular(t: string, profundidad: number): string {
    const exacta = this.exactas.get(t);
    if (exacta !== undefined) return exacta;
    if (profundidad > 3) return t;
    for (const p of this.plantillas) {
      const m = t.match(p.regex);
      if (!m) continue;
      const valores = new Map<number, string>();
      p.marcadores.forEach((n, i) => valores.set(n, this.frase(m[i + 1]!, profundidad + 1)));
      return p.destino.replace(/\{(\d+)\}/g, (_, n: string) => valores.get(Number(n)) ?? `{${n}}`);
    }
    // Sin coincidencia completa: por partes (oraciones, listas, "dato · dato").
    const partes = t.split(/(\. |; | · |, |: | — | \/ )/);
    if (partes.length > 1) {
      const traducidas = partes.map((p, i) => (i % 2 === 1 ? p : this.frase(p, profundidad + 1)));
      if (traducidas.some((x, i) => x !== partes[i])) return traducidas.join('');
    }
    // Sin punto final, "Frase." puede estar en el diccionario como "Frase".
    if (/[.:]$/.test(t)) {
      const sin = this.exactas.get(t.slice(0, -1));
      if (sin !== undefined) return sin + t.slice(-1);
    }
    return t;
  }
}
