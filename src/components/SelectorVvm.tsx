import { ETAPAS_VVM, type EtapaVvm } from '../lib/lotes';
import { IlustracionVvm } from './IlustracionVvm';
import { Sigla } from './Siglas';

interface Props {
  nombre: string;
  valor: EtapaVvm | null;
  onChange(etapa: EtapaVvm): void;
  error?: string | null;
}

/** Pregunta guiada: compara el cuadrado interior con el círculo exterior del VVM. */
export function SelectorVvm({ nombre, valor, onChange, error }: Props) {
  return (
    <fieldset className={`vvm${error ? ' vvm--error' : ''}`} aria-describedby={error ? `${nombre}-error` : undefined}>
      <legend className="campo__etiqueta">
        ¿Cómo se ve el <Sigla s="VVM" /> del frasco?
      </legend>
      <p className="campo__ayuda">Compara el cuadrado del centro con el círculo que lo rodea.</p>
      <div className="vvm__opciones">
        {ETAPAS_VVM.map((e) => (
          <label key={e.etapa} className={`vvm__opcion${valor === e.etapa ? ' vvm__opcion--elegida' : ''}`}>
            <input
              type="radio"
              name={nombre}
              value={e.etapa}
              checked={valor === e.etapa}
              onChange={() => onChange(e.etapa)}
            />
            <IlustracionVvm etapa={e.etapa} />
            <span className="vvm__texto">
              <strong>
                Etapa {e.etapa}: {e.titulo}
              </strong>
              <span className={e.usable ? 'texto-ok' : 'texto-peligro'}>{e.indicacion}</span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${nombre}-error`} className="campo__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
