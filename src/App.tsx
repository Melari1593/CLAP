import { useMemo, useState } from 'react';
import { Catalogo } from './clinico/catalogo';
import { hoyISO } from './clinico/calculos';
import { ServicioConsultas } from './consultas/servicio';
import { MotorAlertas } from './alertas/motor';
import { REGLAS } from './alertas/reglas';
import { BaseDatos } from './datos/bd';
import type { Usuario } from './datos/modelo';
import { Repositorio } from './datos/repositorio';
import { ContextoApp, type Contexto, type Pantalla } from './ui/contexto';
import { EstadoConexion } from './ui/EstadoConexion';
import { PantallaBuscar } from './ui/PantallaBuscar';
import { PantallaCatalogo } from './ui/Catalogo';
import { PantallaConsulta } from './ui/PantallaConsulta';
import { PantallaFicha } from './ui/PantallaFicha';

// El inicio de sesión con roles reales llega con el servidor. Mientras tanto, la app
// usa un profesional autorizado de demostración en este dispositivo.
const USUARIO_DEMO: Usuario = {
  id: 'demo-profesional',
  nombre: 'Profesional de demostración',
  institucionId: 'demo-ips',
  roles: ['profesional_autorizado'],
};

function dispositivoId(): string {
  try {
    const guardado = localStorage.getItem('hcp-dispositivo');
    if (guardado) return guardado;
    const nuevo = crypto.randomUUID();
    localStorage.setItem('hcp-dispositivo', nuevo);
    return nuevo;
  } catch {
    return 'dispositivo-sin-almacenamiento';
  }
}

export function App() {
  const contexto = useMemo<Contexto>(() => {
    const bd = new BaseDatos();
    const catalogo = new Catalogo();
    const repo = new Repositorio(bd, { usuario: USUARIO_DEMO, dispositivoId: dispositivoId() });
    const hoy = () => hoyISO();
    const servicio = new ServicioConsultas(repo, catalogo, hoy);
    const motor = new MotorAlertas(repo, REGLAS, catalogo, hoy);
    // Cada dato guardado vuelve a evaluar las reglas del embarazo (C1).
    servicio.alCambiar(async (cambio) => {
      await motor.sincronizar(cambio.embarazoId);
    });
    return { bd, repo, catalogo, hoy, servicio, motor };
  }, []);
  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: 'buscar' });
  const [aviso, setAviso] = useState<string>();

  const ir = (p: Pantalla) => {
    setAviso(undefined);
    setPantalla(p);
    window.scrollTo(0, 0);
  };

  return (
    <ContextoApp.Provider value={contexto}>
      <header className="barra">
        <h1>HCP Digital · Control prenatal</h1>
        <EstadoConexion bd={contexto.bd} />
        <nav className="menu">
          <button type="button" onClick={() => ir({ tipo: 'buscar' })}>Buscar gestante</button>
          <button type="button" onClick={() => ir({ tipo: 'catalogo' })}>Catálogo clínico</button>
        </nav>
      </header>
      <main>
        {pantalla.tipo === 'buscar' && (
          <PantallaBuscar
            onAbrir={(gestanteId, mensaje) => {
              ir({ tipo: 'ficha', gestanteId });
              setAviso(mensaje);
            }}
          />
        )}
        {pantalla.tipo === 'ficha' && <PantallaFicha gestanteId={pantalla.gestanteId} aviso={aviso} ir={ir} />}
        {(pantalla.tipo === 'primera' || pantalla.tipo === 'seguimiento') && (
          <PantallaConsulta key={`${pantalla.tipo}-${pantalla.consultaId ?? 'nueva'}`} {...pantalla} ir={ir} />
        )}
        {pantalla.tipo === 'catalogo' && <PantallaCatalogo catalogo={contexto.catalogo} />}
      </main>
    </ContextoApp.Provider>
  );
}
