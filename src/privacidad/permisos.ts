// A3 — Solo el personal autorizado de la institución ve y edita la historia.
import type { Usuario } from '../datos/modelo';

export function puedeVerHistoria(usuario: Usuario, institucionId: string): boolean {
  return usuario.institucionId === institucionId && usuario.roles.includes('profesional_autorizado');
}
