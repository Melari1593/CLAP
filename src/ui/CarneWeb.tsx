// F4 — Carné web de la gestante: pide el PIN y muestra el carné.
// En producción lo sirve el servidor de la institución (con el mismo PIN y bloqueo). Mientras tanto,
// este enlace funciona en el mismo dispositivo, leyendo la base local, para probarlo.
import { useEffect, useState, type FormEvent } from 'react';
import type { Catalogo } from '../clinico/catalogo';
import type { BaseDatos } from '../datos/bd';
import type { FechaISO } from '../datos/modelo';
import type { Historia } from '../datos/repositorio';
import { verificarPin } from '../carne/pin';
import { proyectarCarne, type DatosCarne } from '../privacidad/carne';
import { CarneGestante } from './CarneGestante';
import { RegistroEventos } from '../eventos/eventos';
import { esIdioma, type Idioma } from '../i18n/motor';
import { SelectorIdioma } from './SelectorIdioma';

async function historiaPorToken(bd: BaseDatos, token: string): Promise<Historia | undefined> {
  const carne = await bd.carnes.get({ token });
  if (!carne) return undefined;
  const embarazo = await bd.embarazos.get(carne.embarazoId);
  const gestante = embarazo && (await bd.gestantes.get(embarazo.gestanteId));
  if (!embarazo || !gestante) return undefined;
  const por = { embarazoId: embarazo.id };
  return {
    gestante,
    embarazo,
    consultas: await bd.consultas.where(por).sortBy('fecha'),
    examenes: await bd.examenes.where(por).sortBy('fecha'),
    indicaciones: await bd.indicaciones.where(por).toArray(),
    alertas: await bd.alertas.where(por).toArray(),
    factores: await bd.factores.where(por).sortBy('inicio'),
    derechos: await bd.derechos.where(por).sortBy('fechaHora'),
    // El carné no los necesita: su pausa ya quedó en carne.estado.
    consentimientos: [],
    cuestionarios: [],
    carne,
  };
}

export function CarneWeb({ bd, token, catalogo, hoy }: { bd: BaseDatos; token: string; catalogo: Catalogo; hoy: () => FechaISO }) {
  const [existe, setExiste] = useState<boolean>();
  const [pin, setPin] = useState('');
  const [mensaje, setMensaje] = useState<string>();
  const [datos, setDatos] = useState<DatosCarne>();
  // El idioma que eligió en la consulta; ella puede cambiarlo aquí (se recuerda en su teléfono).
  const clave = `hcp-idioma-carne:${token}`;
  const [idioma, setIdiomaEstado] = useState<Idioma>(() => {
    try {
      const x = localStorage.getItem(clave);
      return esIdioma(x) ? x : 'es';
    } catch {
      return 'es';
    }
  });
  const setIdioma = (i: Idioma) => {
    setIdiomaEstado(i);
    try {
      localStorage.setItem(clave, i);
    } catch {
      /* sin almacenamiento */
    }
  };

  useEffect(() => {
    void bd.carnes.get({ token }).then((c) => {
      setExiste(Boolean(c));
      let elegido = false;
      try {
        elegido = localStorage.getItem(clave) !== null;
      } catch {
        /* sin almacenamiento */
      }
      if (c?.idioma && !elegido) setIdiomaEstado(c.idioma);
    });
  }, [bd, token]);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    const carne = await bd.carnes.get({ token });
    if (!carne) return setExiste(false);
    const { respuesta, cambios } = await verificarPin(carne, pin, new Date(), catalogo);
    await bd.carnes.update(carne.id, cambios);
    setPin('');
    if (respuesta.resultado === 'correcto') {
      await new RegistroEventos(bd, carne.institucionId).registrar(carne.embarazoId, { tipo: 'carne_abierto' });
      const historia = await historiaPorToken(bd, token);
      if (historia) setDatos(proyectarCarne(historia, historia.carne!, hoy(), catalogo));
    } else if (respuesta.resultado === 'bloqueado') {
      setMensaje(`Tu carné está bloqueado por un rato. Intenta de nuevo más tarde o pide ayuda en tu próxima consulta.`);
    } else {
      setMensaje(`PIN incorrecto. ${respuesta.intentosRestantes === 1 ? "Te queda 1 intento." : `Te quedan ${respuesta.intentosRestantes} intentos.`}`);
    }
  };

  const selector = (
    <div className="no-imprimir">
      <SelectorIdioma idioma={idioma} onCambio={setIdioma} />
    </div>
  );
  if (existe === undefined) return <p className="carne-web" data-idioma={idioma}>Cargando…</p>;
  if (!existe) return <p className="carne-web" data-idioma={idioma}>Este enlace ya no funciona. Pide en tu servicio de salud que te envíen el nuevo.</p>;
  if (datos)
    return (
      <main className="carne-web" data-idioma={idioma}>
        {selector}
        <p className="demo no-imprimir">Versión de demostración con datos ficticios.</p>
        <CarneGestante datos={datos} idioma={idioma} />
      </main>
    );
  return (
    <main className="carne-web" data-idioma={idioma}>
      {selector}
      <form onSubmit={entrar} className="carne pin">
        <img src="/logo.png" alt="" width={45} height={96} className="logo-pin" />
        <h2>Tu carné de control prenatal</h2>
        <label>
          Escribe tu PIN de 4 números
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
        </label>
        <button type="submit" className="primario">Ver mi carné</button>
        {mensaje && <p role="alert">{mensaje}</p>}
      </form>
    </main>
  );
}
