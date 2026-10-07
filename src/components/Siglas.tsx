import { SIGLAS, type Sigla as ClaveSigla } from '../lib/siglas';

/** Sigla con su significado al pasar el cursor o mantener presionado. */
export function Sigla({ s }: { s: ClaveSigla }) {
  return <abbr title={SIGLAS[s]}>{s}</abbr>;
}

/** Leyenda visible con el significado de cada sigla que aparece en la pantalla. */
export function Leyenda({ siglas }: { siglas: ClaveSigla[] }) {
  if (!siglas.length) return null;
  return (
    <aside className="leyenda" aria-label="Leyenda de siglas">
      <h2 className="leyenda__titulo">Siglas en esta pantalla</h2>
      <dl className="leyenda__lista">
        {siglas.map((s) => (
          <div key={s} className="leyenda__item">
            <dt>{s}</dt>
            <dd>{SIGLAS[s]}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
