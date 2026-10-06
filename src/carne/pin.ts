// F3 / F4 — PIN del carné. El PIN nunca se guarda: solo su derivación PBKDF2 con sal.
// La verificación y el bloqueo se hacen en el servidor que sirve el carné; esta es la misma lógica.
import type { Catalogo } from '../clinico/catalogo';
import type { Carne } from '../datos/modelo';

const ITERACIONES = 100_000;

function aBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function aleatorio(bytes: number): string {
  return aBase64(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function pinValido(pin: string, catalogo: Catalogo): boolean {
  return new RegExp(`^\\d{${catalogo.valor('carne.pin').digitos}}$`).test(pin);
}

export async function derivarPin(pin: string, sal: string): Promise<string> {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(sal), iterations: ITERACIONES, hash: 'SHA-256' },
    clave,
    256,
  );
  return aBase64(new Uint8Array(bits));
}

export type ResultadoPin =
  | { resultado: 'correcto' }
  | { resultado: 'incorrecto'; intentosRestantes: number }
  | { resultado: 'bloqueado'; hasta: string };

/** Verifica el PIN y devuelve los cambios que hay que guardar en el carné (intentos y bloqueo). */
export async function verificarPin(
  carne: Pick<Carne, 'pinHash' | 'pinSal' | 'intentosFallidos' | 'bloqueadoHasta'>,
  pin: string,
  ahora: Date,
  catalogo: Catalogo,
): Promise<{ respuesta: ResultadoPin; cambios: Pick<Carne, 'intentosFallidos' | 'bloqueadoHasta'> }> {
  if (carne.bloqueadoHasta && new Date(carne.bloqueadoHasta) > ahora) {
    return { respuesta: { resultado: 'bloqueado', hasta: carne.bloqueadoHasta }, cambios: { intentosFallidos: carne.intentosFallidos, bloqueadoHasta: carne.bloqueadoHasta } };
  }
  const { intentosAntesDeBloqueo } = catalogo.valor('carne.pin');
  if ((await derivarPin(pin, carne.pinSal)) === carne.pinHash) {
    return { respuesta: { resultado: 'correcto' }, cambios: { intentosFallidos: 0, bloqueadoHasta: undefined } };
  }
  // Pasado un bloqueo, los intentos vuelven a empezar.
  const previos = carne.bloqueadoHasta ? 0 : carne.intentosFallidos;
  const intentos = previos + 1;
  if (intentos >= intentosAntesDeBloqueo) {
    const hasta = new Date(ahora.getTime() + catalogo.valor('carne.minutosBloqueo') * 60_000).toISOString();
    return { respuesta: { resultado: 'bloqueado', hasta }, cambios: { intentosFallidos: intentos, bloqueadoHasta: hasta } };
  }
  return {
    respuesta: { resultado: 'incorrecto', intentosRestantes: intentosAntesDeBloqueo - intentos },
    cambios: { intentosFallidos: intentos, bloqueadoHasta: undefined },
  };
}
