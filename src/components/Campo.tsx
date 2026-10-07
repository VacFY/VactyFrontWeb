import type { ReactNode } from 'react';

interface Props {
  id: string;
  etiqueta: ReactNode;
  error?: string | null;
  ayuda?: ReactNode;
  children: ReactNode;
}

/** Etiqueta + control + ayuda + error, con los atributos de accesibilidad enlazados por id. */
export function Campo({ id, etiqueta, error, ayuda, children }: Props) {
  return (
    <div className={`campo${error ? ' campo--error' : ''}`}>
      <label htmlFor={id} className="campo__etiqueta">
        {etiqueta}
      </label>
      {children}
      {ayuda && !error && (
        <p id={`${id}-ayuda`} className="campo__ayuda">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="campo__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Atributos aria para el control dentro de <Campo>. */
export function ariaCampo(id: string, error?: string | null, conAyuda = false) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : conAyuda ? `${id}-ayuda` : undefined,
  } as const;
}

export function Aviso({ tipo, children }: { tipo: 'error' | 'exito' | 'info' | 'alerta'; children: ReactNode }) {
  return (
    <div className={`aviso aviso--${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
