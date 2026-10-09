import { describe, expect, it } from 'vitest';
import { direccion, Traductor } from './motor';

const t = new Traductor({
  Guardar: 'Save',
  'Anemia {0}': 'Anemia: {0}',
  leve: 'mild',
  'Semana {0} · {1}': 'Week {0} · {1}',
  'Hb medida {0} g/dL el {1}: {2} g/dL o menos.': 'Measured Hb {0} g/dL on {1}: {2} g/dL or less.',
  'Iniciar sulfato ferroso': 'Start ferrous sulfate',
  'Falta: {0}.': 'Missing: {0}.',
  duración: 'duration',
  'cantidad total': 'total quantity',
});

describe('Traductor', () => {
  it('traduce frases exactas y conserva los espacios de los bordes', () => {
    expect(t.traducir('Guardar')).toBe('Save');
    expect(t.traducir('  Guardar ')).toBe('  Save ');
  });

  it('reconoce plantillas con datos y traduce los datos que conoce', () => {
    expect(t.traducir('Anemia leve')).toBe('Anemia: mild');
    expect(t.traducir('Hb medida 12,8 g/dL el 2026-10-08: 13,0 g/dL o menos.')).toBe('Measured Hb 12,8 g/dL on 2026-10-08: 13,0 g/dL or less.');
    expect(t.traducir('Falta: duración, cantidad total.')).toBe('Missing: duration, total quantity.');
  });

  it('ignora las plantillas con casi nada de texto fijo', () => {
    // "{1} de {0}" atraparía cualquier frase con "de": no se usa.
    expect(t.traducir('Fin de embarazo')).toBe('Fin de embarazo');
    const orden = new Traductor({ 'Hemograma del {0} trimestre ({1})': 'Blood count ({1}) for trimester {0}', segundo: '2nd' });
    expect(orden.traducir('Hemograma del segundo trimestre (pendiente)')).toBe('Blood count (pendiente) for trimester 2nd');
  });

  it('traduce por partes lo que no coincide entero', () => {
    expect(t.traducir('Guardar · Iniciar sulfato ferroso')).toBe('Save · Start ferrous sulfate');
  });

  it('deja como está lo que no conoce (nombres, notas, números)', () => {
    expect(t.traducir('Marta Sánchez')).toBe('Marta Sánchez');
    expect(t.traducir('2026-10-08')).toBe('2026-10-08');
  });

  it('el árabe se escribe de derecha a izquierda', () => {
    expect(direccion('ar')).toBe('rtl');
    expect(direccion('fr')).toBe('ltr');
  });
});

describe('Diccionarios reales', () => {
  it('traducen alertas armadas con datos', async () => {
    const en = new Traductor((await import('./en.json')).default);
    expect(en.traducir('Glucemia en ayunas 95 mg/dL el 2026-08-01 (semana 8+5).')).toBe('Fasting blood glucose 95 mg/dL on 2026-08-01 (week 8+5).');
    expect(en.traducir('TSH elevada: posible hipotiroidismo')).toBe('High TSH: possible hypothyroidism');
    const ar = new Traductor((await import('./ar.json')).default);
    expect(ar.traducir('Diabetes gestacional: glucemia en ayunas alterada')).toBe('سكري الحمل: سكر الدم الصيامي غير طبيعي');
  });
});
