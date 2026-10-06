// B3 — Lo que la app calcula sola mientras el profesional llena la primera consulta.
import { edad, edadGestacional, imc, intervaloIntergenesico, sumarDias } from '../clinico/calculos';
import { valorDe } from '../datos/campo';
import type { DatosPrimeraConsulta, Gestante } from '../datos/modelo';
import { useApp } from './contexto';

function fechaLarga(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function PanelCalculos({ gestante, datos }: { gestante: Gestante; datos?: DatosPrimeraConsulta }) {
  const { catalogo, hoy } = useApp();
  const fechaNac = valorDe(gestante.fechaNacimiento);
  const g = datos?.gestacionActual;
  const eg = edadGestacional(
    { fum: valorDe(g?.fum), egConfiablePorFum: valorDe(g?.egConfiablePorFum), ecografia: valorDe(g?.ecografia), egConfiablePorEco: valorDe(g?.egConfiablePorEco) },
    hoy(),
    catalogo,
  );
  const peso = valorDe(g?.pesoAnteriorKg);
  const talla = valorDe(g?.tallaCm);
  const masa = peso !== undefined && talla ? imc(peso, talla, catalogo) : undefined;
  const fin = valorDe(datos?.antecedentesObstetricos.finEmbarazoAnterior);
  const intervalo = fin && eg.estado === 'calculada' ? intervaloIntergenesico(fin, eg.inicio) : undefined;

  return (
    <aside className="calculos" aria-label="Cálculos automáticos">
      <div>
        <span>Edad</span>
        <strong>{fechaNac ? `${edad(fechaNac, hoy())} años` : '—'}</strong>
      </div>
      <div>
        <span>EG hoy</span>
        {eg.estado === 'calculada' ? (
          <strong>
            {eg.semanas} sem + {eg.diasResto} d <small>({eg.fuente === 'fum' ? 'por FUM' : 'por eco'}{eg.confiable ? '' : ', poco confiable'})</small>
          </strong>
        ) : (
          <strong className="alerta-texto">{eg.motivo}</strong>
        )}
      </div>
      <div>
        <span>FPP</span>
        <strong>{eg.estado === 'calculada' ? fechaLarga(eg.fpp) : '—'}</strong>
      </div>
      <div>
        <span>IMC pregestacional</span>
        <strong>{masa ? `${masa.valor.toLocaleString('es-CO')} · ${masa.clasificacion}` : '—'}</strong>
      </div>
      <div>
        <span>Intervalo intergenésico</span>
        <strong>{intervalo ? `${intervalo.meses} meses${intervalo.anios ? ` (${intervalo.anios} años)` : ''}` : '—'}</strong>
      </div>
      {eg.estado === 'calculada' && eg.dias < 12 * 7 && (
        <div>
          <span>Semana 12</span>
          <strong>{fechaLarga(sumarDias(eg.inicio, 12 * 7))}</strong>
        </div>
      )}
    </aside>
  );
}
