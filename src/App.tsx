import { BaseDatos } from './datos/bd';
import { EstadoConexion } from './ui/EstadoConexion';
import { PantallaCatalogo } from './ui/Catalogo';

const bd = new BaseDatos();

export function App() {
  return (
    <>
      <header className="barra">
        <h1>HCP Digital · Control prenatal</h1>
        <EstadoConexion bd={bd} />
      </header>
      <main>
        <PantallaCatalogo />
      </main>
    </>
  );
}
