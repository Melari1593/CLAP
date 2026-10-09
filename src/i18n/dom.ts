// Traduce lo que se ve en pantalla: los textos y algunos atributos (placeholder, aria-label, title,
// alt) de los elementos, según el idioma global o el de la sección más cercana con data-idioma (el
// carné usa el idioma de la gestante). Guarda el original en español para volver a él o cambiar de
// idioma, y deja intactos los campos donde se escribe y lo marcado con data-no-traducir.
import { direccion, esIdioma, type Diccionario, type Idioma, Traductor } from './motor';

const ATRIBUTOS = ['placeholder', 'aria-label', 'title', 'alt'];
const OMITIR = 'input, textarea, script, style, [data-no-traducir], [contenteditable="true"]';

const cargadores: Record<Exclude<Idioma, 'es'>, () => Promise<{ default: Diccionario }>> = {
  en: () => import('./en.json'),
  fr: () => import('./fr.json'),
  ar: () => import('./ar.json'),
};

const traductores = new Map<Idioma, Traductor>();
const cargando = new Map<Idioma, Promise<Traductor | undefined>>();

export function cargarIdioma(idioma: Idioma): Promise<Traductor | undefined> {
  if (idioma === 'es') return Promise.resolve(undefined);
  const listo = traductores.get(idioma);
  if (listo) return Promise.resolve(listo);
  let p = cargando.get(idioma);
  if (!p) {
    p = cargadores[idioma]().then((m) => {
      const t = new Traductor(m.default);
      traductores.set(idioma, t);
      return t;
    });
    cargando.set(idioma, p);
  }
  return p;
}

/** Texto original (en español) y la última traducción puesta, por nodo. */
const textos = new WeakMap<Text, { original: string; puesto: string }>();
const atributos = new WeakMap<Element, Map<string, { original: string; puesto: string }>>();

let idiomaGlobal: Idioma = 'es';

function idiomaDe(nodo: Node): Idioma {
  const el = nodo instanceof Element ? nodo : nodo.parentElement;
  const marcado = el?.closest('[data-idioma]')?.getAttribute('data-idioma');
  return esIdioma(marcado) ? marcado : idiomaGlobal;
}

function enIdioma(texto: string, idioma: Idioma): string {
  if (idioma === 'es') return texto;
  const t = traductores.get(idioma);
  if (!t) {
    // Se traduce cuando termine de cargar el diccionario.
    void cargarIdioma(idioma).then(() => programar(document.body));
    return texto;
  }
  return t.traducir(texto);
}

/** Para mensajes fuera del DOM (confirmaciones, avisos del navegador). */
export function traducir(texto: string, idioma: Idioma = idiomaGlobal): string {
  return enIdioma(texto, idioma);
}

function traducirTexto(n: Text) {
  const el = n.parentElement;
  if (!el || el.closest(OMITIR)) return;
  const actual = n.nodeValue ?? '';
  let reg = textos.get(n);
  // Si React cambió el texto, el nuevo valor es el nuevo original.
  if (!reg || actual !== reg.puesto) reg = { original: actual, puesto: actual };
  const nuevo = enIdioma(reg.original, idiomaDe(n));
  reg.puesto = nuevo;
  textos.set(n, reg);
  if (nuevo !== actual) n.nodeValue = nuevo;
}

function traducirAtributos(el: Element) {
  if (el.closest('[data-no-traducir]')) return;
  for (const a of ATRIBUTOS) {
    const actual = el.getAttribute(a);
    if (actual === null) continue;
    let mapa = atributos.get(el);
    if (!mapa) atributos.set(el, (mapa = new Map()));
    let reg = mapa.get(a);
    if (!reg || actual !== reg.puesto) reg = { original: actual, puesto: actual };
    const nuevo = enIdioma(reg.original, idiomaDe(el));
    reg.puesto = nuevo;
    mapa.set(a, reg);
    if (nuevo !== actual) el.setAttribute(a, nuevo);
  }
}

function recorrer(raiz: Node) {
  if (raiz instanceof Text) return traducirTexto(raiz);
  if (!(raiz instanceof Element) && !(raiz instanceof DocumentFragment)) return;
  if (raiz instanceof Element) {
    traducirAtributos(raiz);
    // Cada sección con su idioma lleva también su dirección de escritura.
    const propio = raiz.getAttribute('data-idioma');
    if (esIdioma(propio)) raiz.setAttribute('dir', direccion(propio));
  }
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = w.nextNode();
  while (n) {
    if (n instanceof Text) traducirTexto(n);
    else if (n instanceof Element) {
      traducirAtributos(n);
      const propio = n.getAttribute('data-idioma');
      if (esIdioma(propio)) n.setAttribute('dir', direccion(propio));
    }
    n = w.nextNode();
  }
}

const pendientes = new Set<Node>();
let agendado = false;
function programar(n: Node) {
  pendientes.add(n);
  if (agendado) return;
  agendado = true;
  queueMicrotask(() => {
    agendado = false;
    const lista = [...pendientes];
    pendientes.clear();
    observador?.disconnect();
    for (const x of lista) if (x.isConnected) recorrer(x);
    conectar();
  });
}

let observador: MutationObserver | undefined;
function conectar() {
  observador?.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATRIBUTOS, 'data-idioma'] });
}

/** Arranca la traducción automática de la página. */
export function iniciarTraduccion(idioma: Idioma) {
  if (!observador) {
    observador = new MutationObserver((cambios) => {
      for (const c of cambios) {
        if (c.type === 'childList') c.addedNodes.forEach((n) => programar(n));
        else programar(c.target);
      }
    });
    // Confirmaciones y avisos del navegador.
    const confirmar = window.confirm.bind(window);
    const preguntar = window.prompt.bind(window);
    const avisar = window.alert.bind(window);
    window.confirm = (m?: string) => confirmar(m === undefined ? m : traducir(m));
    window.prompt = (m?: string, d?: string) => preguntar(m === undefined ? m : traducir(m), d);
    window.alert = (m?: string) => avisar(m === undefined ? m : traducir(String(m)));
  }
  cambiarIdioma(idioma);
}

/** Cambia el idioma de toda la página (las secciones con data-idioma conservan el suyo). */
export function cambiarIdioma(idioma: Idioma) {
  idiomaGlobal = idioma;
  document.documentElement.lang = idioma;
  document.documentElement.dir = direccion(idioma);
  void cargarIdioma(idioma).then(() => programar(document.body));
  programar(document.body);
}

export const idiomaActual = (): Idioma => idiomaGlobal;

/** Formato de fechas según el idioma (con dígitos occidentales también en árabe). */
export function localeDe(idioma: Idioma = idiomaGlobal): string {
  return { es: 'es-CO', en: 'en-US', fr: 'fr-FR', ar: 'ar-u-nu-latn' }[idioma];
}

const CLAVE = 'hcp-idioma';
export function idiomaGuardado(): Idioma {
  try {
    const x = localStorage.getItem(CLAVE);
    return esIdioma(x) ? x : 'es';
  } catch {
    return 'es';
  }
}
export function guardarIdioma(idioma: Idioma) {
  try {
    localStorage.setItem(CLAVE, idioma);
  } catch {
    /* sin almacenamiento: se usa solo en esta sesión */
  }
}
