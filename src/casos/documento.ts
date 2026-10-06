// G1 — Documento de la batería de casos y de los parámetros pendientes, para el equipo clínico.
import { Catalogo } from '../clinico/catalogo';
import { CASOS } from './casos';

const celda = (t: string) => t.replace(/\|/g, '\\|');

export function documentoCasos(): string {
  const grupos = [...new Set(CASOS.map((c) => c.grupo))];
  const lineas = [
    '# Batería de casos clínicos — HCP Digital v1',
    '',
    '> Documento generado desde `src/casos/casos.ts` (`npm run casos`). No editar a mano: los casos corren como prueba automática en cada cambio.',
    '',
    'Gestante base: 28 años, Bogotá (2600 m), FUM 2026-06-01, segundo embarazo (parto vaginal previo de 3200 g, terminado el 2023-01-01), planeado, no fuma, sin hábitos ni violencia, Rh +, antirrubéola previa, antitetánica vigente, IMC 24,8 y calcio ya indicado. Salvo que se diga otra cosa, se evalúa el 2026-10-06 (semana 18+1).',
    '',
    'Para cada caso, el equipo clínico marca si el resultado esperado es correcto y anota observaciones.',
    '',
  ];
  for (const grupo of grupos) {
    lineas.push(`## ${grupo}`, '', '| Caso | Qué se prueba | Datos | Resultado esperado | ¿Correcto? | Observaciones |', '|---|---|---|---|---|---|');
    for (const c of CASOS.filter((x) => x.grupo === grupo)) {
      const alertas = Object.values(c.alertas);
      const esperado = [
        alertas.length ? alertas.map((a) => `**${a}**`).join('; ') : 'Sin alertas',
        ...Object.values(c.contiene ?? {}).flat().map((t) => `incluye «${t}»`),
        ...Object.values(c.noContiene ?? {}).flat().map((t) => `no incluye «${t}»`),
      ].join('<br>');
      const datos = [...c.datos, ...(c.hoy ? [`Evaluada el ${c.hoy}`] : [])].join('; ') || '—';
      lineas.push(`| ${c.id} | ${celda(c.descripcion)} | ${celda(datos)} | ${celda(esperado)} | ☐ Sí ☐ No | |`);
    }
    lineas.push('');
  }
  lineas.push(
    '## Firmas',
    '',
    '| Nombre | Rol | Firma | Fecha |',
    '|---|---|---|---|',
    '| | | | |',
    '| | | | |',
    '',
  );
  return lineas.join('\n');
}

export function documentoParametrosPendientes(): string {
  const pendientes = new Catalogo().lista().filter((p) => p.estado === 'pendiente');
  const lineas = [
    '# Parámetros clínicos pendientes de validar',
    '',
    '> Documento generado desde el catálogo (`src/clinico/catalogo.ts`, `npm run casos`). Las reglas ya los usan, pero no deben usarse con pacientes hasta que el equipo clínico los valide. Al validarlos, se marcan como "decidido" en el catálogo con la fecha de revisión.',
    '',
    '| Id | Parámetro | Valor actual | Fuente | Nota |',
    '|---|---|---|---|---|',
  ];
  for (const p of pendientes) {
    const v = p.valor === null ? 'Sin definir' : `\`${JSON.stringify(p.valor)}\``;
    lineas.push(`| \`${p.id}\` | ${celda(p.nombre)} | ${celda(v)} | ${p.fuentes.join(', ')} | ${celda(p.nota ?? '')} |`);
  }
  lineas.push('');
  return lineas.join('\n');
}
