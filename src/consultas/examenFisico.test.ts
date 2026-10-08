import { describe, expect, it } from 'vitest';
import { Catalogo } from '../clinico/catalogo';
import { valor } from '../datos/campo';
import { construirContexto } from '../alertas/motor';
import { hipertension } from '../alertas/reglasClap';
import { historiaDePrueba } from '../pruebas/historia';
import { BLOQUES_PRIMERA, BLOQUES_SEGUIMIENTO, presionArterialMedia, primeraConsultaVacia, seguimientoVacio } from './esquema';
import { validarPrimeraConsulta, validarSeguimiento } from './validaciones';
import { primeraConsultaCompleta, seguimiento } from '../pruebas/fixtures';

const cat = new Catalogo();

describe('Examen físico', () => {
  it('PAM = (sistólica + 2 × diastólica) / 3, redondeada', () => {
    expect(presionArterialMedia(120, 80)).toBe(93);
    expect(presionArterialMedia(140, 90)).toBe(107);
    expect(presionArterialMedia(undefined, 80)).toBeUndefined();
  });

  it('la sección "Examen físico" tiene signos vitales, PAM calculada, altura uterina, FCF, movimientos fetales y examen general', () => {
    for (const bloques of [BLOQUES_PRIMERA, BLOQUES_SEGUIMIENTO] as const) {
      const ef = bloques.find((b) => b.id === 'examenFisico')!;
      const etiquetas = ef.campos.map((c) => c.etiqueta);
      expect(etiquetas).toEqual(
        expect.arrayContaining([
          'PA sistólica', 'PA diastólica', 'Presión arterial media (PAM)', 'Frecuencia cardíaca', 'Frecuencia respiratoria',
          'Temperatura', 'Saturación de oxígeno', 'Altura uterina', 'Frecuencia cardíaca fetal (FCF)', 'Movimientos fetales verificados',
          'Aspecto general', 'Cardiopulmonar', 'Abdomen', 'Extremidades (edemas, várices)', 'Otros hallazgos',
        ]),
      );
      const pam = ef.campos.find((c) => c.etiqueta === 'Presión arterial media (PAM)')!;
      expect(pam.control.tipo).toBe('calculado');
    }
    // La PAM no se guarda como dato.
    expect('pam' in seguimientoVacio()).toBe(false);
    expect('pam' in primeraConsultaVacia().examenFisico).toBe(false);
    const s = { ...seguimiento(60), paSistolica: valor(120), paDiastolica: valor(80) };
    const pam = BLOQUES_SEGUIMIENTO.find((b) => b.id === 'examenFisico')!.campos.find((c) => c.control.tipo === 'calculado')!;
    expect(pam.control.tipo === 'calculado' && pam.control.calcular(s)).toBe('93 mmHg');
    // En la primera consulta, el examen físico es la última sección.
    expect(BLOQUES_PRIMERA.at(-1)!.id).toBe('examenFisico');
  });

  it('pide confirmar signos vitales fuera de rango, sin bloquear', () => {
    const s = { ...seguimiento(60), temperaturaC: valor(44), saturacionPct: valor(60) };
    expect(validarSeguimiento(s, cat).map((a) => a.ruta)).toEqual(expect.arrayContaining(['temperaturaC', 'saturacionPct']));
    const p = primeraConsultaCompleta();
    p.examenFisico.frRpm = valor(60);
    expect(validarPrimeraConsulta(p, '2026-07-20', cat).map((a) => a.ruta)).toContain('examenFisico.frRpm');
  });

  it('la PA de la primera consulta también alimenta la alerta de hipertensión', () => {
    const h = historiaDePrueba({ primera: (d) => { d.examenFisico.paSistolica = valor(165); d.examenFisico.paDiastolica = valor(100); } });
    expect(hipertension.evaluar(construirContexto(h, '2026-07-20', cat))?.titulo).toBe('Hipertensión en rango severo');
  });
});
