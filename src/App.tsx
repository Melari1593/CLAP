import { useMemo, useState } from 'react';
import { Catalogo } from './clinico/catalogo';
import { hoyISO } from './clinico/calculos';
import { ServicioConsultas } from './consultas/servicio';
import { MotorAlertas } from './alertas/motor';
import { REGLAS } from './alertas/reglas';
import { ServicioDerechos } from './derechos/servicio';
import { PantallaDerechos } from './ui/PantallaDerechos';
import { ServicioCarne } from './carne/servicio';
import { PantallaImpresion } from './ui/PantallaImpresion';
import { CarneWeb } from './ui/CarneWeb';
import { RegistroEventos } from './eventos/eventos';
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
    const eventos = new RegistroEventos(bd, USUARIO_DEMO.institucionId);
    const servicio = new ServicioConsultas(repo, catalogo, hoy, eventos);
    const motor = new MotorAlertas(repo, REGLAS, catalogo, hoy, undefined, eventos);
    // Cada dato guardado vuelve a evaluar las reglas del embarazo (C1).
    servicio.alCambiar(async (cambio) => {
      await motor.sincronizar(cambio.embarazoId);
    });
    const derechos = new ServicioDerechos(repo, motor, catalogo, hoy, undefined, eventos);
    const carnes = new ServicioCarne(bd, repo, catalogo, hoy, undefined, eventos);
    return { bd, repo, catalogo, hoy, servicio, motor, derechos, carnes };
  }, []);
  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: 'buscar' });
  const [aviso, setAviso] = useState<string>();

  // Enlace del carné de la gestante: #/carne/<token>
  const token = window.location.hash.match(/^#\/carne\/([\w-]+)$/)?.[1];
  if (token) return <CarneWeb bd={contexto.bd} token={token} catalogo={contexto.catalogo} hoy={contexto.hoy} />;

  const ir = (p: Pantalla) => {
    setAviso(undefined);
    setPantalla(p);
    window.scrollTo(0, 0);
  };

  return (
    <ContextoApp.Provider value={contexto}>
      <header className="barra no-imprimir">
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
        {pantalla.tipo === 'derechos' && <PantallaDerechos gestanteId={pantalla.gestanteId} embarazoId={pantalla.embarazoId} ir={ir} />}
        {pantalla.tipo === 'impresion' && (
          <PantallaImpresion embarazoId={pantalla.embarazoId} volver={() => ir({ tipo: 'ficha', gestanteId: pantalla.gestanteId })} />
        )}
        {pantalla.tipo === 'catalogo' && <PantallaCatalogo catalogo={contexto.catalogo} />}
      </main>
    </ContextoApp.Provider>
  );
}
