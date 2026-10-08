// Resumen de antecedentes de la primera consulta para la ficha: lo positivo con detalle, lo negado
// en una línea y cuántos quedaron sin registrar. Los datos privados no se muestran aquí.
import type { Campo } from '../datos/campo';
import type { DatosPrimeraConsulta } from '../datos/modelo';
import { BLOQUES_PRIMERA, type DefCampo } from './esquema';
import { obtener } from './rutas';

export interface GrupoAntecedentes {
  titulo: string;
  datos: string[];
  negados: string[];
  sinRegistrar: number;
}

const BLOQUES = ['personales', 'familiares', 'preeclampsia', 'calcio', 'trombotico'];

function texto(def: DefCampo<DatosPrimeraConsulta>, v: unknown): string | null {
  const c = def.control;
  const e = def.etiqueta;
  switch (c.tipo) {
    case 'sino':
      return v === true ? e : null;
    case 'opciones': {
      if (v === 'no') return null;
      return `${e}: ${c.opciones.find((o) => o.valor === v)?.etiqueta ?? String(v)}`;
    }
    case 'multiple': {
      const lista = v as string[];
      if (lista.length === 0) return null;
      return `${e}: ${lista.map((x) => c.opciones.find((o) => o.valor === x)?.etiqueta ?? x).join(', ')}`;
    }
    case 'numero':
      return `${e}: ${String(v).replace('.', ',')}${c.unidad ? ` ${c.unidad}` : ''}`;
    case 'antitetanica': {
      const a = v as { dosisPrevias: number; fechaUltima: string | null };
      return `${e}: ${a.dosisPrevias} dosis previas${a.fechaUltima ? `, última ${a.fechaUltima}` : ''}`;
    }
    default:
      return `${e}: ${String(v)}`;
  }
}

export function resumenAntecedentes(primera: DatosPrimeraConsulta): GrupoAntecedentes[] {
  return BLOQUES_PRIMERA.filter((b) => BLOQUES.includes(b.id)).map((b) => {
    const grupo: GrupoAntecedentes = { titulo: b.titulo, datos: [], negados: [], sinRegistrar: 0 };
    for (const def of b.campos) {
      if (def.privado || def.control.tipo === 'calculado') continue;
      const campo = obtener(primera, def.ruta) as Campo<unknown> | undefined;
      if (!campo || campo.estado === 'vacio') {
        grupo.sinRegistrar++;
        continue;
      }
      if (campo.estado !== 'valor') continue;
      const t = texto(def, campo.valor);
      if (t) grupo.datos.push(t);
      else grupo.negados.push(def.etiqueta);
    }
    return grupo;
  });
}
