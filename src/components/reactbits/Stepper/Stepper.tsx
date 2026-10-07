// React Bits — Stepper (https://reactbits.dev/components/stepper), adaptado para VacTy:
// textos en español, colores de la paleta, títulos de cada paso, la altura sigue al contenido
// (errores o fotos que aparecen dentro del paso) y los indicadores no permiten saltarse pasos.
import { AnimatePresence, motion, type Variants } from 'motion/react';
import React, { Children, type HTMLAttributes, type JSX, type ReactNode, useLayoutEffect, useRef, useState } from 'react';

import './Stepper.css';

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  /** Validación antes de avanzar: devuelve false para quedarse en el paso actual. */
  canAdvance?: (step: number) => boolean;
  stepTitles?: string[];
  backButtonText?: string;
  nextButtonText?: string;
  completeButtonText?: string;
  footerExtra?: ReactNode;
}

const COLORES = {
  marron: '#390f07',
  amarillo: '#ffde59',
  gris: '#f1eeec',
  grisTexto: '#6b5f5a',
};

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  canAdvance = () => true,
  stepTitles = [],
  backButtonText = 'Atrás',
  nextButtonText = 'Siguiente',
  completeButtonText = 'Completar',
  footerExtra,
  className = '',
  ...rest
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [direction, setDirection] = useState<number>(0);
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  const updateStep = (newStep: number) => {
    setCurrentStep(newStep);
    if (newStep > totalSteps) onFinalStepCompleted();
    else onStepChange(newStep);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      updateStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (!canAdvance(currentStep)) return;
    setDirection(1);
    updateStep(isLastStep ? totalSteps + 1 : currentStep + 1);
  };

  return (
    <div className={`outer-container ${className}`} {...rest}>
      <div className="step-circle-container">
        <ol className="step-indicator-row" aria-label="Pasos">
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1;
            return (
              <React.Fragment key={stepNumber}>
                <StepIndicator step={stepNumber} currentStep={currentStep} title={stepTitles[index]} total={totalSteps} />
                {index < totalSteps - 1 && <StepConnector isComplete={currentStep > stepNumber} />}
              </React.Fragment>
            );
          })}
        </ol>

        <StepContentWrapper isCompleted={isCompleted} currentStep={currentStep} direction={direction} className="step-content-default">
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>

        {!isCompleted && (
          <div className="footer-container">
            <div className="footer-nav">
              {currentStep !== 1 && (
                <button type="button" onClick={handleBack} className="boton boton--borde">
                  {backButtonText}
                </button>
              )}
              <button type="button" onClick={handleNext} className="boton boton--primario">
                {isLastStep ? completeButtonText : nextButtonText}
              </button>
              {footerExtra}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StepContentWrapperProps {
  isCompleted: boolean;
  currentStep: number;
  direction: number;
  children: ReactNode;
  className?: string;
}

function StepContentWrapper({ isCompleted, currentStep, direction, children, className }: StepContentWrapperProps) {
  const [parentHeight, setParentHeight] = useState<number>(0);

  return (
    <motion.div
      className={className}
      style={{ position: 'relative', overflow: 'hidden' }}
      animate={{ height: isCompleted ? 0 : parentHeight }}
      transition={{ type: 'spring', duration: 0.4 }}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted && (
          <SlideTransition key={currentStep} direction={direction} onHeightReady={setParentHeight}>
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface SlideTransitionProps {
  children: ReactNode;
  direction: number;
  onHeightReady: (h: number) => void;
}

function SlideTransition({ children, direction, onHeightReady }: SlideTransitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    onHeightReady(el.offsetHeight);
    const observer = new ResizeObserver(() => onHeightReady(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [onHeightReady]);

  return (
    <motion.div
      ref={containerRef}
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.4 }}
      style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
    >
      {children}
    </motion.div>
  );
}

const stepVariants: Variants = {
  enter: (dir: number) => ({ x: dir >= 0 ? '-100%' : '100%', opacity: 0 }),
  center: { x: '0%', opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? '50%' : '-50%', opacity: 0 }),
};

export function Step({ children }: { children: ReactNode }): JSX.Element {
  return <div className="step-default">{children}</div>;
}

interface StepIndicatorProps {
  step: number;
  currentStep: number;
  total: number;
  title?: string;
}

function StepIndicator({ step, currentStep, total, title }: StepIndicatorProps) {
  const status = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete';
  const textoEstado = status === 'complete' ? 'completado' : status === 'active' ? 'paso actual' : 'pendiente';

  return (
    <li className="step-indicator" aria-current={status === 'active' ? 'step' : undefined}>
      <motion.div animate={status} initial={false}>
        <motion.div
          variants={{
            inactive: { scale: 1, backgroundColor: COLORES.gris, color: COLORES.grisTexto },
            active: { scale: 1.08, backgroundColor: COLORES.amarillo, color: COLORES.marron },
            complete: { scale: 1, backgroundColor: COLORES.marron, color: COLORES.amarillo },
          }}
          transition={{ duration: 0.3 }}
          className="step-indicator-inner"
        >
          {status === 'complete' ? (
            <CheckIcon className="check-icon" />
          ) : status === 'active' ? (
            <div className="active-dot" />
          ) : (
            <span className="step-number">{step}</span>
          )}
        </motion.div>
      </motion.div>
      {title && <span className={`step-title step-title--${status}`}>{title}</span>}
      <span className="solo-lectores">
        Paso {step} de {total}, {textoEstado}
      </span>
    </li>
  );
}

function StepConnector({ isComplete }: { isComplete: boolean }) {
  const lineVariants: Variants = {
    incomplete: { width: 0, backgroundColor: 'transparent' },
    complete: { width: '100%', backgroundColor: COLORES.marron },
  };

  return (
    <li className="step-connector" aria-hidden="true">
      <motion.div
        className="step-connector-inner"
        variants={lineVariants}
        initial={false}
        animate={isComplete ? 'complete' : 'incomplete'}
        transition={{ duration: 0.4 }}
      />
    </li>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.1, type: 'tween', ease: 'easeOut', duration: 0.3 }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
