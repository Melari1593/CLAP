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

describe('Alertas por signos vitales', () => {
  it('fiebre con 38 °C o más; saturación baja por debajo de 92 %', async () => {
    const { fiebre, saturacionBaja } = await import('../alertas/signosVitales');
    const ctxCon = (temp: number, sat: number) =>
      construirContexto(
        historiaDePrueba({ seguimientos: [{ fecha: '2026-08-20', cambios: (d) => { d.temperaturaC = valor(temp); d.saturacionPct = valor(sat); } }] }),
        '2026-08-20',
        cat,
      );
    expect(fiebre.evaluar(ctxCon(37.9, 97))).toBeNull();
    expect(fiebre.evaluar(ctxCon(38, 97))).toMatchObject({ titulo: 'Fiebre', urgente: true });
    expect(saturacionBaja.evaluar(ctxCon(36.5, 92))).toBeNull();
    expect(saturacionBaja.evaluar(ctxCon(36.5, 91))).toMatchObject({ titulo: 'Saturación de oxígeno baja', severidad: 3 });
    // También con los signos de la primera consulta.
    const h = historiaDePrueba({ primera: (d) => (d.examenFisico.temperaturaC = valor(38.5)) });
    expect(fiebre.evaluar(construirContexto(h, '2026-07-20', cat))?.porque[0]).toContain('38,5 °C');
  });
});

describe('Taquicardia materna', () => {
  it('alerta con frecuencia cardíaca mayor de 100', async () => {
    const { taquicardiaMaterna } = await import('../alertas/signosVitales');
    const ctxCon = (fc: number) =>
      construirContexto(historiaDePrueba({ seguimientos: [{ fecha: '2026-08-20', cambios: (d) => (d.fcLpm = valor(fc)) }] }), '2026-08-20', cat);
    expect(taquicardiaMaterna.evaluar(ctxCon(100))).toBeNull();
    expect(taquicardiaMaterna.evaluar(ctxCon(101))).toMatchObject({ titulo: 'Taquicardia materna', severidad: 2 });
  });
});

describe('Taquipnea', () => {
  it('alerta con frecuencia respiratoria mayor de 20', async () => {
    const { taquipnea } = await import('../alertas/signosVitales');
    const ctxCon = (fr: number) =>
      construirContexto(historiaDePrueba({ seguimientos: [{ fecha: '2026-08-20', cambios: (d) => (d.frRpm = valor(fr)) }] }), '2026-08-20', cat);
    expect(taquipnea.evaluar(ctxCon(20))).toBeNull();
    expect(taquipnea.evaluar(ctxCon(24))).toMatchObject({ titulo: 'Taquipnea', severidad: 2 });
  });
});

describe('Bradicardia materna', () => {
  it('alerta con frecuencia cardíaca menor de 60', async () => {
    const { bradicardiaMaterna } = await import('../alertas/signosVitales');
    const ctxCon = (fc: number) =>
      construirContexto(historiaDePrueba({ seguimientos: [{ fecha: '2026-08-20', cambios: (d) => (d.fcLpm = valor(fc)) }] }), '2026-08-20', cat);
    expect(bradicardiaMaterna.evaluar(ctxCon(60))).toBeNull();
    expect(bradicardiaMaterna.evaluar(ctxCon(52))).toMatchObject({ titulo: 'Bradicardia materna', severidad: 2 });
  });
});
