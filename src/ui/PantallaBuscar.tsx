// B1 — Buscar por documento o nombre; si no existe, registrar e iniciar la primera consulta.
import { useState, type FormEvent } from 'react';
import type { Gestante, TipoDocumento } from '../datos/modelo';
import { useApp } from './contexto';

const TIPOS: TipoDocumento[] = ['CC', 'TI', 'RC', 'CE', 'PPT', 'PA', 'otro'];

export function PantallaBuscar({ onAbrir }: { onAbrir: (gestanteId: string, aviso?: string) => void }) {
  const { servicio } = useApp();
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Gestante[] | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [nueva, setNueva] = useState({ documentoTipo: 'CC' as TipoDocumento, documentoNumero: '', nombres: '', apellidos: '', fechaNacimiento: '' });

  const buscar = async (e: FormEvent) => {
    e.preventDefault();
    setResultados(await servicio.buscar(texto));
  };

  const registrar = async (e: FormEvent) => {
    e.preventDefault();
    const { gestante, existia } = await servicio.registrarOAbrir({
      ...nueva,
      fechaNacimiento: nueva.fechaNacimiento ? { estado: 'valor', valor: nueva.fechaNacimiento } : { estado: 'vacio' },
    });
    onAbrir(gestante.id, existia ? 'Ya existía una gestante con ese documento: se abrió su registro.' : undefined);
  };

  return (
    <section>
      <h2>Buscar gestante</h2>
      <form onSubmit={buscar} className="buscador">
        <input type="search" aria-label="Documento o nombre" placeholder="Número de documento o nombre" value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
        <button type="submit">Buscar</button>
      </form>

      {resultados && (
        <ul className="resultados">
          {resultados.length === 0 && <li>No se encontró ninguna gestante en este dispositivo.</li>}
          {resultados.map((g) => (
            <li key={g.id}>
              <button type="button" className="resultado" onClick={() => onAbrir(g.id)}>
                <strong>{g.nombres} {g.apellidos}</strong> <span>{g.documentoTipo} {g.documentoNumero}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!registrando ? (
        <button type="button" onClick={() => setRegistrando(true)}>+ Registrar nueva gestante</button>
      ) : (
        <form onSubmit={registrar} className="tarjeta">
          <h3>Nueva gestante</h3>
          <label>
            Tipo de documento
            <select value={nueva.documentoTipo} onChange={(e) => setNueva({ ...nueva, documentoTipo: e.target.value as TipoDocumento })}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label>Número <input required value={nueva.documentoNumero} onChange={(e) => setNueva({ ...nueva, documentoNumero: e.target.value })} /></label>
          <label>Nombres <input required value={nueva.nombres} onChange={(e) => setNueva({ ...nueva, nombres: e.target.value })} /></label>
          <label>Apellidos <input required value={nueva.apellidos} onChange={(e) => setNueva({ ...nueva, apellidos: e.target.value })} /></label>
          <label>Fecha de nacimiento <input type="date" value={nueva.fechaNacimiento} onChange={(e) => setNueva({ ...nueva, fechaNacimiento: e.target.value })} /></label>
          <div className="navegacion">
            <button type="button" onClick={() => setRegistrando(false)}>Cancelar</button>
            <button type="submit" className="primario">Registrar e iniciar primera consulta</button>
          </div>
        </form>
      )}
    </section>
  );
}
