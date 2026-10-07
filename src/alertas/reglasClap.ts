// C2 / C3 — Alertas básicas del CLAP (campos amarillos) y antitetánica.
import { intervaloIntergenesico } from '../clinico/calculos';
import { valorDe } from '../datos/campo';
import { evaluarAntitetanica } from './antitetanica';
import type { Regla } from './motor';

const enDerechos = 'Abrir "Opciones y derechos".';

export const edadDeRiesgo: Regla = {
  id: 'edad_riesgo',
  evaluar({ edad, catalogo }) {
    const { menorDe, mayorDe } = catalogo.valor('clap.edadRiesgo');
    if (edad === undefined || (edad >= menorDe && edad <= mayorDe)) return null;
    return {
      titulo: 'Edad de riesgo',
      porque: [`${edad} años (riesgo: menor de ${menorDe} o mayor de ${mayorDe}).`],
    };
  },
};

export const menorDe14: Regla = {
  id: 'menor_14',
  evaluar({ edad, catalogo }) {
    const { presuncionViolenciaMenorDe } = catalogo.valor('clap.edadRiesgo');
    if (edad === undefined || edad >= presuncionViolenciaMenorDe) return null;
    return {
      titulo: `Gestante menor de ${presuncionViolenciaMenorDe} años: se presume violencia sexual`,
      porque: [
        `${edad} años.`,
        'Activar la ruta de atención integral a víctimas de violencia sexual (urgencia médica) y hacer las notificaciones que exige la norma.',
        'La causal de violencia sexual permite la IVE sin límite de edad gestacional.',
        enDerechos,
      ],
      urgente: true,
      enlace: 'derechos',
      opciones: [{ etiqueta: 'Ruta activada' }, { etiqueta: 'Referida' }],
    };
  },
};

export const abortosARepeticion: Regla = {
  id: 'abortos_repeticion',
  evaluar({ primera, catalogo }) {
    if (valorDe(primera?.antecedentesObstetricos.tresEspontaneosConsecutivos) !== true) return null;
    const { abortosEspontaneosConsecutivos } = catalogo.valor('clap.antecedentesObstetricos');
    return { titulo: 'Abortos a repetición', porque: [`${abortosEspontaneosConsecutivos} abortos espontáneos consecutivos.`] };
  },
};

export const intervaloCorto: Regla = {
  id: 'intervalo_corto',
  evaluar({ primera, eg, catalogo }) {
    const fin = valorDe(primera?.antecedentesObstetricos.finEmbarazoAnterior);
    if (!fin || eg.estado !== 'calculada') return null;
    const { intervaloCortoMenorDeMeses } = catalogo.valor('clap.antecedentesObstetricos');
    const { meses } = intervaloIntergenesico(fin, eg.inicio);
    if (meses >= intervaloCortoMenorDeMeses) return null;
    return {
      titulo: 'Intervalo intergenésico corto',
      porque: [`${meses} meses entre el fin del embarazo anterior (${fin}) y el actual (menos de ${intervaloCortoMenorDeMeses}).`],
    };
  },
};

export const pesoRNPrevio: Regla = {
  id: 'peso_rn_previo',
  evaluar({ primera, catalogo }) {
    const peso = valorDe(primera?.antecedentesObstetricos.pesoUltimoRNg);
    if (peso === undefined) return null;
    const { bajoMenorDe, altoDesde } = catalogo.valor('clap.pesoRNPrevio');
    if (peso >= bajoMenorDe && peso < altoDesde) return null;
    return {
      titulo: 'Peso del RN previo',
      porque: [`Último RN de ${peso} g (${peso < bajoMenorDe ? `menos de ${bajoMenorDe}` : `${altoDesde} o más`}).`],
    };
  },
};

export const embarazoNoPlaneado: Regla = {
  id: 'no_planeado',
  evaluar({ primera }) {
    if (valorDe(primera?.planificacion.embarazoPlaneado) !== false) return null;
    const desea = valorDe(primera?.planificacion.deseaContinuar);
    if (desea === 'no' || desea === 'no_ha_decidido') {
      return {
        titulo: 'Embarazo no planeado: asesoría de opciones',
        porque: [
          desea === 'no' ? 'La gestante no desea continuar el embarazo.' : 'La gestante no ha decidido si continuar el embarazo.',
          'La atención es urgente: no se puede dilatar.',
          enDerechos,
        ],
        severidad: 2,
        urgente: true,
        enlace: 'derechos',
        opciones: [{ etiqueta: 'Asesoría realizada y decisión registrada' }, { etiqueta: 'No desea hablar del tema ahora' }],
      };
    }
    return {
      titulo: 'Embarazo no planeado',
      porque: [desea === 'si' ? 'Desea continuar el embarazo.' : 'Falta registrar si desea continuar el embarazo.'],
    };
  },
};

export const sifilis: Regla = {
  id: 'sifilis',
  evaluar(ctx) {
    const vdrl = ctx.ultimo('vdrl');
    const treponemica = ctx.ultimo('sifilisTreponemica');
    // Cuenta el resultado más reciente de cualquiera de las dos pruebas.
    const ultimaReactiva = [vdrl && { fecha: vdrl.fecha, reactiva: vdrl.reactivo }, treponemica && { fecha: treponemica.fecha, reactiva: treponemica.reactiva }]
      .filter((x): x is { fecha: string; reactiva: boolean } => Boolean(x))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .at(-1);
    if (!ultimaReactiva?.reactiva) return null;
    const porque: string[] = [];
    if (treponemica?.reactiva) porque.push(`Prueba treponémica rápida reactiva (${treponemica.fecha}).`);
    if (vdrl?.reactivo) porque.push(`VDRL/RPR reactivo (${vdrl.fecha}).`);
    const tratada = vdrl?.tratamiento === true;
    if (!tratada) porque.push('Sin tratamiento registrado: tratar según la guía vigente.');
    if (vdrl?.tratamientoPareja !== true) porque.push('Sin tratamiento de la pareja registrado.');
    if (treponemica?.reactiva && !vdrl) porque.push('Solicitar VDRL/RPR para el seguimiento.');
    return {
      titulo: vdrl?.reactivo ? 'Sífilis: VDRL/RPR reactivo' : 'Sífilis: prueba treponémica reactiva',
      porque,
      severidad: tratada ? 1 : 2,
      opciones: [{ etiqueta: 'Tratamiento indicado' }, { etiqueta: 'Referida' }, { etiqueta: 'Ya tratada', requiereMotivo: true }],
    };
  },
};

export const infecciones: Regla = {
  id: 'infecciones',
  evaluar(ctx) {
    const positivas: string[] = (
      [
        ['malaria', 'Malaria'],
        ['chagas', 'Chagas'],
        ['bacteriuria', 'Bacteriuria'],
        ['egb', 'Estreptococo B'],
      ] as const
    ).flatMap(([tipo, nombre]) => {
      const r = ctx.ultimo(tipo);
      return r?.positivo ? [`${nombre} positivo (${r.fecha}).`] : [];
    });
    const hepatitisB = ctx.ultimo('hepatitisB');
    if (hepatitisB?.antigenoSuperficie === 'positivo') {
      positivas.push(`Hepatitis B: antígeno de superficie positivo (${hepatitisB.fecha}). Planear la profilaxis del recién nacido.`);
    }
    if (positivas.length === 0) return null;
    return { titulo: 'Infecciones', porque: positivas, severidad: positivas.length };
  },
};

export const rhNegativo: Regla = {
  id: 'rh_negativo',
  evaluar({ primera }) {
    if (valorDe(primera?.gestacionActual.rh) !== '-') return null;
    const inmunizada = valorDe(primera?.gestacionActual.inmunizada);
    return {
      titulo: inmunizada ? 'Rh negativo, inmunizada' : 'Rh negativo',
      porque: [
        'Rh negativo.',
        inmunizada === true ? 'Está inmunizada.' : inmunizada === false ? 'No inmunizada.' : 'Falta registrar si está inmunizada.',
      ],
      severidad: inmunizada ? 2 : 1,
    };
  },
};

export const habitos: Regla = {
  id: 'habitos',
  evaluar({ primera }) {
    const g = primera?.gestacionActual;
    const presentes = [
      valorDe(g?.fumaActivo) === true && 'Tabaco activo',
      valorDe(g?.drogas) === true && 'Drogas',
      valorDe(g?.alcohol) === true && 'Alcohol',
    ].filter((x): x is string => Boolean(x));
    if (presentes.length === 0) return null;
    return { titulo: 'Hábitos de riesgo', porque: presentes.map((h) => `${h}.`), severidad: presentes.length };
  },
};

export const violencia: Regla = {
  id: 'violencia',
  evaluar({ primera }) {
    const g = primera?.gestacionActual;
    if (valorDe(g?.violencia) !== true) return null;
    if (valorDe(g?.violenciaSexual) === true) {
      return {
        titulo: 'Violencia sexual',
        porque: [
          'Activar la ruta de atención a víctimas de violencia sexual (urgencia médica).',
          'La causal de violencia sexual aplica también después de la semana 24.',
          enDerechos,
        ],
        severidad: 2,
        urgente: true,
        enlace: 'derechos',
        opciones: [{ etiqueta: 'Ruta activada' }, { etiqueta: 'Referida' }],
      };
    }
    return {
      titulo: 'Violencia en el embarazo actual',
      porque: ['Respuesta SÍ en el tamizaje de violencia.', 'Ofrezca un momento a solas.'],
    };
  },
};

export const antirrubeola: Regla = {
  id: 'antirrubeola',
  evaluar(ctx) {
    const { primera } = ctx;
    const v = valorDe(primera?.gestacionActual.antirrubeola);
    const igg = ctx.ultimo('rubeolaIgG');
    if (igg?.positivo) return null;
    if (igg && !igg.positivo) {
      return {
        titulo: 'Susceptible a rubéola',
        porque: [`IgG para rubéola negativa (${igg.fecha}).`, 'Recordar aplicar la vacuna en el puerperio.'],
        opciones: [{ etiqueta: 'Recordatorio para el puerperio' }, { etiqueta: 'No requiere acción', requiereMotivo: true }],
      };
    }
    if (v !== 'no' && v !== 'no_sabe') return null;
    return {
      titulo: 'Antirrubéola no recibida',
      porque: [v === 'no' ? 'No ha recibido la vacuna.' : 'No sabe si recibió la vacuna.', 'Recordar aplicarla en el puerperio.'],
      opciones: [{ etiqueta: 'Recordatorio para el puerperio' }, { etiqueta: 'No requiere acción', requiereMotivo: true }],
    };
  },
};

export const antitetanica: Regla = {
  id: 'antitetanica',
  evaluar({ primera, hoy, catalogo, eg }) {
    const datos = valorDe(primera?.gestacionActual.antitetanica);
    if (!datos) return null;
    const fpp = eg.estado === 'calculada' ? eg.fpp : undefined;
    const estado = evaluarAntitetanica(datos, hoy, catalogo, fpp);
    if (estado.vigente) return null;
    const porque = [estado.explicacion, `Aplicar ${estado.dosisAAplicar} dosis en este embarazo.`];
    const segunda = estado.segundaDosis;
    if (segunda) {
      porque.push(
        segunda.hasta
          ? `2.ª dosis entre el ${segunda.desde} (4 semanas después de la 1.ª) y el ${segunda.hasta} (3 semanas antes de la FPP).`
          : `2.ª dosis desde el ${segunda.desde} (4 semanas después de la 1.ª) y al menos 3 semanas antes de la FPP.`,
      );
      if (!segunda.alcanza) porque.push('No alcanza el intervalo antes de la FPP: valorar el esquema.');
    }
    return {
      titulo: 'Antitetánica: esquema no vigente',
      porque,
      opciones: [{ etiqueta: 'Dosis aplicada' }, { etiqueta: 'Se aplicará en la próxima cita' }, { etiqueta: 'No requiere acción', requiereMotivo: true }],
    };
  },
};

export const REGLAS_CLAP: Regla[] = [
  menorDe14,
  edadDeRiesgo,
  abortosARepeticion,
  intervaloCorto,
  pesoRNPrevio,
  embarazoNoPlaneado,
  sifilis,
  infecciones,
  rhNegativo,
  habitos,
  violencia,
  antirrubeola,
  antitetanica,
];
