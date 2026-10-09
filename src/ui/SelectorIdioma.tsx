// Selector de idioma (para el profesional o para la gestante en su carné).
import { IDIOMAS, type Idioma } from '../i18n/motor';

export function SelectorIdioma({ idioma, onCambio }: { idioma: Idioma; onCambio: (i: Idioma) => void }) {
  return (
    <label className="selector-idioma" data-no-traducir>
      <span aria-hidden>🌐 </span>
      <select aria-label="Idioma / Language / Langue / اللغة" value={idioma} onChange={(e) => onCambio(e.target.value as Idioma)}>
        {IDIOMAS.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
      </select>
    </label>
  );
}
