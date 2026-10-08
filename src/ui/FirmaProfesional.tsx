// Firma del profesional al final de la consulta: nombre, registro profesional y firma manuscrita
// digitalizada (se dibuja con el dedo, el lápiz o el mouse). Se guarda al cerrar la consulta.
import { useEffect, useRef, useState } from 'react';
import { useApp } from './contexto';

export function FirmaProfesional({ firma, onFirma, cierre }: {
  firma?: string;
  onFirma: (dataUrl: string | undefined) => void;
  /** Si la consulta ya se cerró: muestra la firma guardada. */
  cierre?: { profesional: string; registroProfesional: string | null; fechaHora: string; firma?: string };
}) {
  const { repo } = useApp();
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [vacia, setVacia] = useState(!firma);

  useEffect(() => {
    const c = lienzo.current;
    if (!c || !firma) return;
    const img = new Image();
    img.onload = () => c.getContext('2d')?.drawImage(img, 0, 0);
    img.src = firma;
  }, []);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * e.currentTarget.width) / r.width, y: ((e.clientY - r.top) * e.currentTarget.height) / r.height };
  };

  const nombre = cierre?.profesional ?? repo.usuario.nombre;
  const registro = cierre ? cierre.registroProfesional : repo.usuario.registroProfesional;

  return (
    <fieldset className="firma">
      <legend>✍️ Firma del profesional de salud</legend>
      {cierre ? (
        <>
          {cierre.firma ? <img src={cierre.firma} alt={`Firma de ${cierre.profesional}`} className="firma-imagen" /> : <p className="suave">Cerrada sin firma manuscrita.</p>}
          <p>
            <strong>{nombre}</strong>
            {registro && ` · Registro profesional ${registro}`}
            <br />
            <small className="suave">Firmado al cerrar la consulta: {new Date(cierre.fechaHora).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</small>
          </p>
        </>
      ) : (
        <>
          <p className="suave">Firme dentro del recuadro. La firma queda guardada al cerrar la consulta, con la fecha y la hora.</p>
          <canvas
            ref={lienzo}
            width={600}
            height={180}
            className="firma-lienzo"
            aria-label="Recuadro para firmar"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const ctx = e.currentTarget.getContext('2d')!;
              const { x, y } = punto(e);
              ctx.lineWidth = 3;
              ctx.lineCap = 'round';
              ctx.strokeStyle = '#111827';
              ctx.beginPath();
              ctx.moveTo(x, y);
              dibujando.current = true;
            }}
            onPointerMove={(e) => {
              if (!dibujando.current) return;
              const ctx = e.currentTarget.getContext('2d')!;
              const { x, y } = punto(e);
              ctx.lineTo(x, y);
              ctx.stroke();
            }}
            onPointerUp={(e) => {
              if (!dibujando.current) return;
              dibujando.current = false;
              setVacia(false);
              onFirma(e.currentTarget.toDataURL('image/png'));
            }}
          />
          <p>
            <strong>{nombre}</strong>
            {registro && ` · Registro profesional ${registro}`}
          </p>
          {!vacia && (
            <button
              type="button"
              className="enlace"
              onClick={() => {
                const c = lienzo.current!;
                c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
                setVacia(true);
                onFirma(undefined);
              }}
            >
              Borrar firma
            </button>
          )}
        </>
      )}
    </fieldset>
  );
}
