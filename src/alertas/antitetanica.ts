// C3 — Antitetánica: si el esquema está vigente y cuántas dosis aplicar en el embarazo.
import type { Catalogo } from '../clinico/catalogo';
import { diasEntre, sumarDias } from '../clinico/calculos';
import type { FechaISO } from '../datos/modelo';

export interface DatosAntitetanica {
  dosisPrevias: number;
  fechaUltima: FechaISO | null;
  informacionConfiable: boolean;
}

export interface EstadoAntitetanica {
  vigente: boolean;
  dosisAAplicar: number;
  explicacion: string;
  /** Si hay que aplicar 2 dosis: ventana para la segunda. */
  segundaDosis?: { desde: FechaISO; hasta?: FechaISO; alcanza: boolean };
}

function aniosDesde(fecha: FechaISO, hoy: FechaISO): number {
  return diasEntre(fecha, hoy) / 365.25;
}

export function evaluarAntitetanica(
  d: DatosAntitetanica,
  hoy: FechaISO,
  catalogo: Catalogo,
  fpp?: FechaISO,
): EstadoAntitetanica {
  const reglas = catalogo.valor('clap.antitetanica');
  const conducta = catalogo.valor('clap.antitetanicaConducta');

  const aplicarDos = (explicacion: string): EstadoAntitetanica => {
    // 1.ª dosis hoy; la 2.ª al menos 4 semanas después y al menos 3 semanas antes de la FPP.
    const desde = sumarDias(hoy, reglas.semanasEntrePrimeraYSegunda * 7);
    const hasta = fpp ? sumarDias(fpp, -reglas.semanasAntesDeFPP * 7) : undefined;
    return {
      vigente: false,
      dosisAAplicar: conducta.dosisSinVacunaPrevia,
      explicacion,
      segundaDosis: { desde, hasta, alcanza: hasta === undefined || desde <= hasta },
    };
  };

  if (!d.informacionConfiable) return aplicarDos('Información poco confiable: se considera sin vacuna previa.');
  if (d.dosisPrevias <= 0) return aplicarDos('Sin dosis previas.');
  if (d.dosisPrevias >= reglas.dosisEsquemaCompleto) {
    return { vigente: true, dosisAAplicar: 0, explicacion: `${d.dosisPrevias} dosis: esquema completo.` };
  }

  const vigenciaAnios =
    d.dosisPrevias === 1
      ? 0
      : d.dosisPrevias === 2
        ? reglas.vigenciaDosDosisAnios
        : d.dosisPrevias === 3
          ? reglas.vigenciaTresOMasDosisAnios
          : conducta.vigenciaCuatroDosisAnios;

  if (!d.fechaUltima) {
    return {
      vigente: false,
      dosisAAplicar: conducta.dosisSiNoVigente,
      explicacion: `${d.dosisPrevias} dosis sin fecha de la última: no se puede confirmar la vigencia.`,
    };
  }
  const anios = aniosDesde(d.fechaUltima, hoy);
  if (vigenciaAnios > 0 && anios < vigenciaAnios) {
    return {
      vigente: true,
      dosisAAplicar: 0,
      explicacion: `${d.dosisPrevias} dosis, la última hace menos de ${vigenciaAnios} años.`,
    };
  }
  return {
    vigente: false,
    dosisAAplicar: conducta.dosisSiNoVigente,
    explicacion:
      d.dosisPrevias === 1
        ? '1 dosis previa: esquema incompleto.'
        : `${d.dosisPrevias} dosis, la última hace ${Math.floor(anios)} años (vigencia: ${vigenciaAnios} años).`,
  };
}
