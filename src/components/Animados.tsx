// Envoltorios de los componentes de React Bits con los valores de VacTy, para usarlos igual en todas las pantallas.
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import AnimatedContent from './reactbits/AnimatedContent/AnimatedContent';
import BlurText from './reactbits/BlurText/BlurText';
import Counter from './reactbits/Counter/Counter';
import CountUp from './reactbits/CountUp/CountUp';

/** Título de pantalla que aparece desenfocado y se enfoca palabra por palabra. */
export function Titulo({ children }: { children: string }) {
  return <BlurText as="h1" text={children} className="titulo-pagina" delay={80} animateBy="words" direction="top" />;
}

type PropsSeccion = React.HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'div' | 'form';
  onSubmit?: React.FormEventHandler<HTMLElement>;
  noValidate?: boolean;
};

/** Bloque abierto de contenido (sin caja): el ritmo lo dan el espacio y la tipografía. */
export function Seccion({ as: Tag = 'section', className = '', ...props }: PropsSeccion) {
  return <Tag className={`seccion ${className}`} {...(props as object)} />;
}

/** Entrada suave al aparecer en pantalla. `orden` escalona varios elementos seguidos. */
export function Aparecer({
  children,
  orden = 0,
  as = 'div',
  className,
}: {
  children: ReactNode;
  orden?: number;
  as?: 'div' | 'li' | 'section';
  className?: string;
}) {
  return (
    <AnimatedContent as={as} className={className} delay={Math.min(orden, 8) * 0.06} threshold={0.05}>
      {children}
    </AnimatedContent>
  );
}

/** Número que cuenta hasta su valor. Sin valor, muestra un guion. */
export function Numero({ valor, decimales = 0, sufijo = '' }: { valor: number | null | undefined; decimales?: number; sufijo?: string }) {
  if (valor == null || !Number.isFinite(valor)) return <>—</>;
  const redondeado = Number(valor.toFixed(decimales));
  return (
    <>
      <CountUp to={redondeado} duration={0.9} />
      {sufijo}
    </>
  );
}

function useEsAngosto(): boolean {
  const consulta = '(max-width: 560px)';
  const [angosto, setAngosto] = useState(() => window.matchMedia?.(consulta).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(consulta);
    if (!mq) return;
    const alCambiar = () => setAngosto(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return angosto;
}

/** Temperatura con dígitos que ruedan como un contador mecánico (admite negativos). */
export function TemperaturaRodante({ valor, color }: { valor: number; color: string }) {
  const angosto = useEsAngosto();
  const absoluto = Math.round(Math.abs(valor) * 10) / 10;
  const places: (number | '.')[] = absoluto >= 10 ? [10, 1, '.', 0.1] : [1, '.', 0.1];
  const tamano = angosto ? 84 : 132;
  return (
    <span className="temperatura-rodante" aria-hidden="true" style={{ color }}>
      {valor < 0 && <span className="temperatura-rodante__signo">−</span>}
      <Counter
        value={absoluto}
        places={places}
        fontSize={tamano}
        padding={4}
        gap={0}
        horizontalPadding={0}
        textColor={color}
        fontWeight={800}
        gradientHeight={0}
        gradientFrom="transparent"
        gradientTo="transparent"
      />
      <span className="temperatura-rodante__unidad">°C</span>
    </span>
  );
}
