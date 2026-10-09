import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registrarServiceWorker } from './ui/Actualizacion';
import './estilos.css';
import { idiomaGuardado, iniciarTraduccion } from './i18n/dom';

registrarServiceWorker();
// Español por defecto; el profesional cambia el idioma desde la barra superior.
iniciarTraduccion(idiomaGuardado());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
