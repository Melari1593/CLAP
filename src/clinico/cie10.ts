// CIE-10 (OMS, en español): la tabla completa se carga aparte (cie10-tabla.json, 14.215 códigos,
// generada de github.com/verasativa/CIE-10 más O14.2, U07.1 y U07.2). Los frecuentes del control
// prenatal se sugieren primero.
import type { DiagnosticoCie10 } from '../datos/modelo';

export type TablaCie10 = Map<string, string>;

let tabla: Promise<TablaCie10> | undefined;

/** Carga la tabla una sola vez (queda en la caché de la app para usarla sin internet). */
export function cargarTablaCie10(): Promise<TablaCie10> {
  tabla ??= import('./cie10-tabla.json').then((m) => new Map(m.default as [string, string][]));
  return tabla;
}

const plano = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** "z348", "Z34.8" o "z34,8" → "Z34.8". */
export function normalizarCodigo(texto: string): string {
  const c = texto.trim().toUpperCase().replace(/[.,\s]/g, '');
  return c.length > 3 ? `${c.slice(0, 3)}.${c.slice(3)}` : c;
}

/** Busca por el comienzo del código o por todas las palabras de la descripción (sin tildes). */
export function buscarCie10(t: TablaCie10, texto: string, maximo = 20): DiagnosticoCie10[] {
  const q = texto.trim();
  if (q.length < 2) return [];
  const resultado: DiagnosticoCie10[] = [];
  if (/^[a-z]\d/i.test(q)) {
    const prefijo = normalizarCodigo(q);
    for (const [codigo, descripcion] of t) {
      if (codigo.startsWith(prefijo)) resultado.push({ codigo, descripcion });
      if (resultado.length >= maximo) return resultado;
    }
  }
  const palabras = plano(q).split(/\s+/).filter(Boolean);
  for (const [codigo, descripcion] of t) {
    const d = plano(descripcion);
    if (palabras.every((p) => d.includes(p)) && !resultado.some((r) => r.codigo === codigo)) resultado.push({ codigo, descripcion });
    if (resultado.length >= maximo) break;
  }
  return resultado;
}

export const CIE10_FRECUENTES: DiagnosticoCie10[] = [
  { codigo: 'Z34.0', descripcion: 'Supervisión de primer embarazo normal' },
  { codigo: 'Z34.8', descripcion: 'Supervisión de otros embarazos normales' },
  { codigo: 'Z34.9', descripcion: 'Supervisión de embarazo normal, no especificado' },
  { codigo: 'Z35.0', descripcion: 'Supervisión de embarazo con historia de esterilidad' },
  { codigo: 'Z35.2', descripcion: 'Supervisión de embarazo con otro riesgo en la historia obstétrica o reproductiva' },
  { codigo: 'Z35.5', descripcion: 'Supervisión de primigesta añosa' },
  { codigo: 'Z35.6', descripcion: 'Supervisión de primigesta muy joven' },
  { codigo: 'Z35.7', descripcion: 'Supervisión de embarazo de alto riesgo debido a problemas sociales' },
  { codigo: 'Z35.8', descripcion: 'Supervisión de otros embarazos de alto riesgo' },
  { codigo: 'Z35.9', descripcion: 'Supervisión de embarazo de alto riesgo, sin otra especificación' },
  { codigo: 'O10.0', descripcion: 'Hipertensión esencial preexistente que complica el embarazo' },
  { codigo: 'O13', descripcion: 'Hipertensión gestacional (inducida por el embarazo) sin proteinuria significativa' },
  { codigo: 'O14.1', descripcion: 'Preeclampsia severa' },
  { codigo: 'O14.9', descripcion: 'Preeclampsia, no especificada' },
  { codigo: 'O20.0', descripcion: 'Amenaza de aborto' },
  { codigo: 'O21.0', descripcion: 'Hiperemesis gravídica leve' },
  { codigo: 'O23.4', descripcion: 'Infección no especificada de las vías urinarias en el embarazo' },
  { codigo: 'O24.4', descripcion: 'Diabetes mellitus que se origina con el embarazo' },
  { codigo: 'O30.0', descripcion: 'Embarazo doble' },
  { codigo: 'O36.0', descripcion: 'Atención materna por isoinmunización Rh' },
  { codigo: 'O36.5', descripcion: 'Atención materna por déficit del crecimiento fetal' },
  { codigo: 'O98.1', descripcion: 'Sífilis que complica el embarazo, el parto y el puerperio' },
  { codigo: 'O98.6', descripcion: 'Enfermedades causadas por protozoarios que complican el embarazo (incluye toxoplasmosis)' },
  { codigo: 'O99.0', descripcion: 'Anemia que complica el embarazo, el parto y el puerperio' },
];
