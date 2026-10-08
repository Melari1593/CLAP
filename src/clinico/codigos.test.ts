import { describe, expect, it } from 'vitest';
import { Catalogo } from './catalogo';
import { atcDe, cupsDe, etiquetaCodificado, interpretarCodificado } from './codigos';
import { buscarCie10, cargarTablaCie10, CIE10_FRECUENTES, normalizarCodigo } from './cie10';

const cat = new Catalogo();

describe('Datos codificados (Resolución 866 de 2021)', () => {
  it('reconoce el municipio por nombre, por código o por la etiqueta de la lista', () => {
    expect(interpretarCodificado('bogota, d. c.', 'codigos.divipola', cat)).toEqual({ codigo: '11001', nombre: 'Bogotá, D. C.' });
    expect(interpretarCodificado('05001', 'codigos.divipola', cat)?.nombre).toBe('Medellín (Antioquia)');
    expect(interpretarCodificado('Medellín (Antioquia) (05001)', 'codigos.divipola', cat)?.codigo).toBe('05001');
  });

  it('acepta "Nombre (código)" escrito a mano solo si el código tiene la forma correcta', () => {
    expect(interpretarCodificado('Soacha (25754)', 'codigos.divipola', cat)).toEqual({ nombre: 'Soacha', codigo: '25754' });
    expect(interpretarCodificado('Soacha (2575)', 'codigos.divipola', cat)).toEqual({ nombre: 'Soacha (2575)', codigo: null });
    expect(interpretarCodificado('Otra EPS (eps099)', 'codigos.aseguradoras', cat)).toEqual({ nombre: 'Otra EPS', codigo: 'EPS099' });
    expect(interpretarCodificado('   ', 'codigos.aseguradoras', cat)).toBeUndefined();
  });

  it('muestra el código junto al nombre, y los datos viejos sin código siguen legibles', () => {
    expect(etiquetaCodificado({ codigo: 'EPS010', nombre: 'EPS Sura' })).toBe('EPS Sura (EPS010)');
    expect(etiquetaCodificado('Bogotá')).toBe('Bogotá');
  });

  it('las listas no repiten códigos y tienen la forma esperada', () => {
    for (const [lista, patron] of [
      ['codigos.divipola', /^\d{5}$/],
      ['codigos.aseguradoras', /^[A-Z]{3,4}\d{2,3}$/],
    ] as const) {
      const codigos = cat.valor(lista).map((o) => o.codigo);
      expect(new Set(codigos).size).toBe(codigos.length);
      for (const c of codigos) expect(c).toMatch(patron);
    }
  });

  it('da el CUPS de los exámenes y el ATC de los medicamentos', () => {
    expect(cupsDe('bacteriuria', cat)?.codigo).toBe('901235');
    expect(cupsDe('chagas', cat)).toBeUndefined();
    expect(atcDe('toxoTratamientoPleno', cat).map((m) => m.atc)).toEqual(['J01EC02', 'P01BD01', 'V03AF03']);
    expect(atcDe('lactancia', cat)).toEqual([]);
  });
});

describe('CIE-10', () => {
  it('normaliza el código', () => {
    expect(normalizarCodigo('z348')).toBe('Z34.8');
    expect(normalizarCodigo(' o14,1 ')).toBe('O14.1');
    expect(normalizarCodigo('O13')).toBe('O13');
  });

  it('la tabla completa incluye los frecuentes del control prenatal', async () => {
    const tabla = await cargarTablaCie10();
    expect(tabla.size).toBeGreaterThan(14000);
    for (const d of CIE10_FRECUENTES) expect(tabla.has(d.codigo), d.codigo).toBe(true);
    expect(tabla.get('O14.2')).toBe('Síndrome HELLP');
  });

  it('busca por código o por palabras, sin importar las tildes', async () => {
    const tabla = await cargarTablaCie10();
    expect(buscarCie10(tabla, 'O14').map((d) => d.codigo)).toContain('O14.1');
    expect(buscarCie10(tabla, 'preeclampsia severa')[0]?.codigo).toBe('O14.1');
    expect(buscarCie10(tabla, 'supervision primer embarazo').map((d) => d.codigo)).toContain('Z34.0');
    expect(buscarCie10(tabla, 'x')).toEqual([]);
  });
});
