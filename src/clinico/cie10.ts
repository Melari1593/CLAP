// Códigos CIE-10 frecuentes en el control prenatal, para sugerir al escribir el diagnóstico.
// No es la tabla completa: el profesional puede escribir cualquier código y descripción.
import type { DiagnosticoCie10 } from '../datos/modelo';

export const CIE10_FRECUENTES: DiagnosticoCie10[] = [
  { codigo: 'Z34.0', descripcion: 'Supervisión de primer embarazo normal' },
  { codigo: 'Z34.8', descripcion: 'Supervisión de otros embarazos normales' },
  { codigo: 'Z34.9', descripcion: 'Supervisión de embarazo normal, no especificado' },
  { codigo: 'Z35.0', descripcion: 'Supervisión de embarazo con historia de esterilidad' },
  { codigo: 'Z35.2', descripcion: 'Supervisión de embarazo con otro riesgo en la historia obstétrica o reproductiva' },
  { codigo: 'Z35.5', descripcion: 'Supervisión de primigesta añosa' },
  { codigo: 'Z35.6', descripcion: 'Supervisión de primigesta muy joven' },
  { codigo: 'Z35.7', descripcion: 'Supervisión de embarazo de alto riesgo debido a problemas sociales' },
  { codigo: 'Z35.8', descripcion: 'Supervisión de otros embarazos de alto riesgo' },
  { codigo: 'Z35.9', descripcion: 'Supervisión de embarazo de alto riesgo, sin otra especificación' },
  { codigo: 'O10.0', descripcion: 'Hipertensión esencial preexistente que complica el embarazo' },
  { codigo: 'O13', descripcion: 'Hipertensión gestacional (inducida por el embarazo) sin proteinuria significativa' },
  { codigo: 'O14.1', descripcion: 'Preeclampsia severa' },
  { codigo: 'O14.9', descripcion: 'Preeclampsia, no especificada' },
  { codigo: 'O20.0', descripcion: 'Amenaza de aborto' },
  { codigo: 'O21.0', descripcion: 'Hiperemesis gravídica leve' },
  { codigo: 'O23.4', descripcion: 'Infección no especificada de las vías urinarias en el embarazo' },
  { codigo: 'O24.4', descripcion: 'Diabetes mellitus que se origina con el embarazo' },
  { codigo: 'O30.0', descripcion: 'Embarazo doble' },
  { codigo: 'O36.0', descripcion: 'Atención materna por isoinmunización Rh' },
  { codigo: 'O36.5', descripcion: 'Atención materna por déficit del crecimiento fetal' },
  { codigo: 'O98.1', descripcion: 'Sífilis que complica el embarazo, el parto y el puerperio' },
  { codigo: 'O98.6', descripcion: 'Enfermedades causadas por protozoarios que complican el embarazo (incluye toxoplasmosis)' },
  { codigo: 'O99.0', descripcion: 'Anemia que complica el embarazo, el parto y el puerperio' },
];
