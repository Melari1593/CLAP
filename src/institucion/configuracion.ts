// Datos que cambian de una institución a otra: el prestador de referencia para IVE y los contactos
// de la ruta de atención a víctimas de violencia sexual. Con el servidor, cada institución los
// administra; mientras tanto, la demostración usa una configuración ficticia.

export interface ContactoRuta {
  /** Entidad a la que se notifica o con la que se activa la ruta. */
  entidad: string;
  /** Teléfono, correo u otro medio de contacto. */
  contacto: string;
  /** Solo para gestantes menores de 14 años. */
  soloMenores14?: boolean;
}

export interface ConfiguracionInstitucional {
  institucionId: string;
  nombre: string;
  /** Prestador de referencia para IVE; null si la institución no lo ha definido. */
  prestadorIVE: { nombre: string; contacto: string } | null;
  /** Contactos de la ruta de violencia sexual de la institución. */
  rutaViolenciaSexual: ContactoRuta[];
  /** Fecha (AAAA-MM-DD) en que la institución revisó estos datos; null en la demostración. */
  revisado: string | null;
  /** Datos de ejemplo, no reales. */
  ficticia: boolean;
}

export const CONFIGURACION_DEMO: ConfiguracionInstitucional = {
  institucionId: 'demo-ips',
  nombre: 'IPS de demostración',
  prestadorIVE: { nombre: 'IPS Ejemplo Salud Sexual (ficticia)', contacto: 'Tel. 000 000 0000' },
  rutaViolenciaSexual: [
    { entidad: 'SIVIGILA (evento 875)', contacto: 'Epidemiología de la IPS · ext. 000 (ficticio)' },
    { entidad: 'Comisaría de familia', contacto: 'Tel. 000 000 0001 (ficticio)' },
    { entidad: 'ICBF', contacto: 'Línea 141', soloMenores14: true },
    { entidad: 'Fiscalía (CAIVAS / URI)', contacto: 'Línea 122' },
  ],
  revisado: null,
  ficticia: true,
};
